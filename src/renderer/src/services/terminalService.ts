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
  private _platform = '';
  private _clipboardHandlerAttached = new Set<string>();

  /** メインプロセスから取得した process.platform をセットする */
  setPlatform(platform: string): void {
    this._platform = platform;
    // 既に作成済みのインスタンスにもクリップボード画像ハンドラーを適用
    if (platform === 'win32') {
      for (const [terminalId, instance] of this.instances) {
        this._attachClipboardImageHandler(terminalId, instance.terminal);
      }
    }
  }

  /**
   * Windows 用: クリップボード画像ペーストのキーハンドラーを登録する。
   * 同一ターミナルに対して二重登録しないよう Set で管理。
   *
   * Electron ネイティブの clipboard.readImage()（メインプロセス経由）を使用し、
   * レンダラーの navigator.clipboard.read() の不安定さを回避する。
   */
  private _attachClipboardImageHandler(
    terminalId: string,
    terminal: Terminal,
  ): void {
    if (this._clipboardHandlerAttached.has(terminalId)) return;
    this._clipboardHandlerAttached.add(terminalId);

    terminal.attachCustomKeyEventHandler((e) => {
      // Ctrl+C: 選択範囲があればコピー、なければ SIGINT をそのまま送出
      if (
        e.type === 'keydown' &&
        e.key === 'c' &&
        e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          terminal.clearSelection();
          return false; // xterm のデフォルト処理（SIGINT）を抑制
        }
        return true; // 選択なし → 通常の Ctrl+C（SIGINT）
      }

      const isPaste =
        e.type === 'keydown' &&
        e.key === 'v' &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey;
      if (!isPaste) return true; // 他のキーはそのまま

      (async () => {
        try {
          // メインプロセスで clipboard.readImage() を実行
          const result = await window.api.readClipboardImage();
          if (result.hasImage && result.filePath) {
            this.pasteToTerminal(terminalId, result.filePath, {
              autoSubmit: false,
            });
            return;
          }
          // 画像がない場合は通常のテキストペーストを実行
          const text = await navigator.clipboard.readText();
          if (text) {
            this.pasteToTerminal(terminalId, text, { autoSubmit: false });
          }
        } catch {
          // IPC失敗時はテキストペーストにフォールバック
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              this.pasteToTerminal(terminalId, text, { autoSubmit: false });
            }
          } catch {
            // 無視
          }
        }
      })();

      return false; // xterm のデフォルトペースト処理を抑制
    });
  }

  /**
   * ターミナルインスタンスを取得（なければ作成）。
   * 作成時に、描画負荷を抑えるための設定と出力バッファリングを初期化します。
   */
  getOrCreateInstance(terminalId: string): TerminalInstance {
    let instance = this.instances.get(terminalId);

    if (!instance) {
      // ターミナルインスタンスを作成
      const terminal = new Terminal({
        // xterm.js v5 以降は windowsMode が削除されたため、
        // Windows 向けの互換性は既定挙動に任せる（型エラー回避も兼ねる）
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
      const webLinksAddon = new WebLinksAddon((_event, uri) => {
        window.electron.openExternalLink(uri);
      });

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

      // Windows でのクリップボード画像ペースト対応（macOS はネイティブで対応済み）
      // setPlatform が先に呼ばれていれば即登録、まだなら setPlatform 側で後から登録
      if (this._platform === 'win32') {
        this._attachClipboardImageHandler(terminalId, terminal);
      }

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
      window.api.createTerminalSession(terminalId).catch((_error) => {
        // セッション作成に失敗した場合はフラグを戻す
        instance.isSessionCreated = false;
      });
    }

    return instance;
  }

  attachToDOM(terminalId: string, element: HTMLElement): void {
    const instance = this.getOrCreateInstance(terminalId);

    // 既にDOMに接続されている場合
    if (instance.terminal.element?.parentElement) {
      // 既存の要素を新しい親に移動
      element.appendChild(instance.terminal.element);
      // 表示を確実にする
      (instance.terminal.element as HTMLElement).style.display = 'block';
    } else if (instance.terminal.element) {
      // 要素はあるが親がない場合
      element.appendChild(instance.terminal.element);
      (instance.terminal.element as HTMLElement).style.display = 'block';
    } else {
      // 初回のみopen()を呼ぶ
      instance.terminal.open(element);
    }

    // フィット
    setTimeout(() => {
      try {
        instance.fitAddon.fit();
      } catch (_error) {}
    }, 50);
  }

  detachFromDOM(terminalId: string): void {
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
    } catch (_error) {
      // リサイズ中の一時的な失敗は無視（ログ抑制）
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
    this._clipboardHandlerAttached.clear();
  }

  /**
   * 対象ターミナルの PTY セッションを再生成し、xterm の画面をリセットする。
   * 既存の xterm インスタンスと IPC リスナーは使い回す。
   */
  async reloadInstance(terminalId: string): Promise<void> {
    const instance = this.instances.get(terminalId);
    if (!instance?.isSessionCreated) return;

    instance.isSessionCreated = false;
    instance.terminal.reset();

    try {
      await window.api.reloadTerminalSession(terminalId);
      instance.isSessionCreated = true;
      // 新しい PTY を現在の xterm サイズに合わせる
      this.resize(terminalId);
    } catch (_error) {
      // 失敗時は次回の getOrCreateInstance で再作成される
    }
  }

  /** 生成済みの全ターミナルインスタンスを一括でリロードする */
  reloadAllInstances(): void {
    for (const terminalId of this.instances.keys()) {
      void this.reloadInstance(terminalId);
    }
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
      this._clipboardHandlerAttached.delete(terminalId);
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

  /**
   * Monaco からのテキスト送信を「貼り付け」としてターミナルへ渡し、
   * 既定で Enter を 1 回送って入力確定まで行います。
   *
   * 優先:
   * - xterm の paste API を使用（bracketed paste 有効時は自動でラップ）
   * フォールバック:
   * - 手動で bracketed paste のシーケンスでラップして PTY へ直送
   *
   * autoSubmit: true のときは、貼り付け完了後に通常の Enter("\r") を
   *             1 回だけ別送信します（bracketed paste の外で確定させる）。
   */
  pasteToTerminal(
    terminalId: string,
    text: string,
    options?: {
      autoSubmit?: boolean;
      submitDelayMs?: number;
      submitKey?: 'cr' | 'lf' | 'crlf';
    },
  ): void {
    const instance = this.getOrCreateInstance(terminalId);
    const { terminal } = instance;
    const autoSubmit = options?.autoSubmit !== false; // 既定で確定まで送る
    const delayMs = options?.submitDelayMs ?? 300; // 貼り付け終了を待つ遅延（Claude Code等のTUI対応）
    const submitKey = options?.submitKey ?? 'cr';

    const sendEnter = () => {
      const seq =
        submitKey === 'lf' ? '\n' : submitKey === 'crlf' ? '\r\n' : '\r';
      window.api.sendTerminalInput(terminalId, seq);
    };

    // テキストが空の場合はEnterのみ送信（ターミナルでの確認応答用）
    if (!text) {
      sendEnter();
      return;
    }

    // 1) xterm の paste を最優先で使用
    try {
      if (
        typeof (terminal as unknown as { paste?: (data: string) => void })
          .paste === 'function'
      ) {
        // 改行はそのまま渡す（CLI 側の入力欄に蓄積させる意図）
        (terminal as unknown as { paste: (data: string) => void }).paste(text);
        // 貼り付け後に通常の Enter を別送信して確定
        if (autoSubmit) setTimeout(sendEnter, delayMs);
        return;
      }
    } catch (_error) {
      // paste API の失敗はフォールバックに任せる（ログ抑制）
    }

    // 2) フォールバック: bracketed paste シーケンスでラップして送信
    const BRACKETED_PASTE_START = '\x1b[200~';
    const BRACKETED_PASTE_END = '\x1b[201~';
    const payload = `${BRACKETED_PASTE_START}${text}${BRACKETED_PASTE_END}`;

    // 直接 PTY に送る（IPC 経由）
    window.api.sendTerminalInput(terminalId, payload);
    // 通常の Enter を別送信して確定（bracketed paste の外側）
    if (autoSubmit) setTimeout(sendEnter, delayMs);
  }
}

// シングルトンインスタンス
export const terminalService = new TerminalService();
