import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';

import { TERMINAL_THEMES } from '../constants/terminalThemes';

interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  outputHandler: (
    event: Electron.IpcRendererEvent,
    id: string,
    data: string,
  ) => void;
  isSessionCreated: boolean;
  // 高頻度の出力を集約するためのバッファとフラグ
  writeBuffer: string;
  isFlushScheduled: boolean;
}

class TerminalService {
  private instances = new Map<string, TerminalInstance>();
  private currentTheme: 'dark' | 'light' = 'dark';

  /**
   * ターミナルインスタンスを取得（なければ作成）。
   * 作成時に、描画負荷を抑えるための設定と出力バッファリングを初期化します。
   */
  getOrCreateInstance(terminalId: string): TerminalInstance {
    let instance = this.instances.get(terminalId);

    if (!instance) {
      console.log('Creating new terminal instance for', terminalId);
      // ターミナルインスタンスを作成
      const terminal = new Terminal({
        // Windows での描画と入力の互換性を高める
        windowsMode: true,
        // VSCode に近い等幅フォントとチューニング
        fontFamily: '"Consolas", "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1,
        letterSpacing: 0,
        theme: TERMINAL_THEMES[this.currentTheme],
        allowProposedApi: true,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 10000,
        rightClickSelectsWord: true,
        wordSeparator: ' ()[]{}\'"`,;',
        allowTransparency: false,
        macOptionIsMeta: true,
        macOptionClickForcesSelection: true,
        minimumContrastRatio: 4.5,
        screenReaderMode: false,
      });

      // アドオンを追加
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // 出力集約用の一時バッファ
      let writeBufferLocal = '';
      let isFlushScheduledLocal = false;

      /**
       * requestAnimationFrame 単位でバッファをまとめて描画。
       * 頻繁な小さな write 呼び出しを削減し、入力体感の遅さを緩和します。
       */
      const scheduleFlush = () => {
        if (isFlushScheduledLocal) return;
        isFlushScheduledLocal = true;
        requestAnimationFrame(() => {
          isFlushScheduledLocal = false;
          if (writeBufferLocal) {
            const toWrite = writeBufferLocal;
            writeBufferLocal = '';
            terminal.write(toWrite);
          }
        });
      };

      // 入力ハンドラー
      terminal.onData((data) => {
        window.api.sendTerminalInput(terminalId, data);
      });

      // 出力ハンドラー（集約あり）
      const outputHandler = (
        _event: Electron.IpcRendererEvent,
        id: string,
        data: string,
      ) => {
        if (id === terminalId) {
          writeBufferLocal += data;
          scheduleFlush();
        }
      };

      // インスタンスを保存
      instance = {
        terminal,
        fitAddon,
        outputHandler,
        isSessionCreated: false,
        writeBuffer: writeBufferLocal,
        isFlushScheduled: isFlushScheduledLocal,
      };

      this.instances.set(terminalId, instance);

      // IPCリスナーを登録
      window.api.onTerminalOutput(outputHandler);
    }

    // セッションを作成（一度だけ）
    if (!instance.isSessionCreated) {
      instance.isSessionCreated = true; // 即座にフラグを立てて重複を防ぐ
      window.api
        .createTerminalSession(terminalId)
        .then(() => {
          console.log(`Terminal session created: ${terminalId}`);
        })
        .catch((error) => {
          console.error('Failed to create terminal session:', error);
          instance.isSessionCreated = false; // エラー時はフラグを戻す
        });
    }

    return instance;
  }

  attachToDOM(terminalId: string, element: HTMLElement): void {
    console.log(`Attaching terminal ${terminalId} to DOM`);
    const instance = this.getOrCreateInstance(terminalId);

    // 既にDOMに接続されている場合
    if (instance.terminal.element?.parentElement) {
      console.log(
        `Terminal ${terminalId} already has parent, moving to new parent`,
      );
      // 既存の要素を新しい親に移動
      element.appendChild(instance.terminal.element);
      // 表示を確実にする
      (instance.terminal.element as HTMLElement).style.display = 'block';
    } else if (instance.terminal.element) {
      console.log(`Terminal ${terminalId} element exists but no parent`);
      // 要素はあるが親がない場合
      element.appendChild(instance.terminal.element);
      (instance.terminal.element as HTMLElement).style.display = 'block';
    } else {
      console.log(`Terminal ${terminalId} opening for first time`);
      // 初回のみopen()を呼ぶ
      instance.terminal.open(element);
    }

    console.log(`Terminal ${terminalId} attached to DOM`);
    console.log('Terminal element:', instance.terminal.element);
    console.log('Parent element:', element);
    console.log(
      'Element dimensions:',
      element.offsetWidth,
      'x',
      element.offsetHeight,
    );

    // フィット
    setTimeout(() => {
      try {
        instance.fitAddon.fit();
        console.log(`Terminal ${terminalId} fitted`);
      } catch (error) {
        console.error('Initial fit error:', error);
      }
    }, 50);
  }

  detachFromDOM(terminalId: string): void {
    console.log(`Detaching terminal ${terminalId} from DOM`);
    const instance = this.instances.get(terminalId);
    if (instance?.terminal.element) {
      // 要素をDOMから削除するが、インスタンスは保持
      if (instance.terminal.element.parentElement) {
        instance.terminal.element.parentElement.removeChild(
          instance.terminal.element,
        );
      }
    }
  }

  resize(terminalId: string): { cols: number; rows: number } | null {
    const instance = this.instances.get(terminalId);
    if (!instance) return null;

    try {
      instance.fitAddon.fit();
      const dimensions = instance.fitAddon.proposeDimensions();
      if (dimensions?.cols && dimensions?.rows) {
        window.api.resizeTerminal(terminalId, dimensions.cols, dimensions.rows);
        return dimensions;
      }
    } catch (error) {
      console.error('Terminal resize error:', error);
    }

    return null;
  }

  cleanup(): void {
    this.instances.forEach((instance, terminalId) => {
      window.api.removeTerminalOutputListener(instance.outputHandler);
      if (instance.isSessionCreated) {
        window.api.destroyTerminalSession(terminalId);
      }
      instance.terminal.dispose();
    });
    this.instances.clear();
  }

  cleanupInstance(terminalId: string): void {
    const instance = this.instances.get(terminalId);
    if (instance) {
      window.api.removeTerminalOutputListener(instance.outputHandler);
      if (instance.isSessionCreated) {
        window.api.destroyTerminalSession(terminalId);
      }
      instance.terminal.dispose();
      this.instances.delete(terminalId);
    }
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.currentTheme = theme;
    // すべての既存のターミナルインスタンスのテーマを更新
    this.instances.forEach((instance) => {
      instance.terminal.options.theme = TERMINAL_THEMES[theme];
    });
  }

  getCurrentTheme(): 'dark' | 'light' {
    return this.currentTheme;
  }
}

// シングルトンインスタンス
export const terminalService = new TerminalService();
