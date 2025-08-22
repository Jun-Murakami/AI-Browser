import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  outputHandler: (event: any, id: string, data: string) => void;
  isSessionCreated: boolean;
}

class TerminalService {
  private instances = new Map<string, TerminalInstance>();

  getOrCreateInstance(terminalId: string): TerminalInstance {
    let instance = this.instances.get(terminalId);
    
    if (!instance) {
      console.log('Creating new terminal instance for', terminalId);
      // ターミナルインスタンスを作成
      const terminal = new Terminal({
        fontFamily:
          '"Cascadia Code", "M PLUS 1p", "Consolas", "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selectionBackground: '#264f78',
          selectionForeground: '#ffffff',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5',
        },
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
      });

      // アドオンを追加
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // 入力ハンドラー
      terminal.onData((data) => {
        window.api.sendTerminalInput(terminalId, data);
      });

      // 出力ハンドラー
      const outputHandler = (_event: any, id: string, data: string) => {
        if (id === terminalId) {
          terminal.write(data);
        }
      };

      // インスタンスを保存
      instance = {
        terminal,
        fitAddon,
        outputHandler,
        isSessionCreated: false
      };
      
      this.instances.set(terminalId, instance);

      // IPCリスナーを登録
      window.api.onTerminalOutput(outputHandler);
    }

    // セッションを作成（一度だけ）
    if (!instance.isSessionCreated) {
      instance.isSessionCreated = true; // 即座にフラグを立てて重複を防ぐ
      window.api.createTerminalSession(terminalId)
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
    if (instance.terminal.element && instance.terminal.element.parentElement) {
      console.log(`Terminal ${terminalId} already has parent, moving to new parent`);
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
    console.log('Element dimensions:', element.offsetWidth, 'x', element.offsetHeight);
    
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
        instance.terminal.element.parentElement.removeChild(instance.terminal.element);
      }
    }
  }

  resize(terminalId: string): { cols: number; rows: number } | null {
    const instance = this.instances.get(terminalId);
    if (!instance) return null;

    try {
      instance.fitAddon.fit();
      const dimensions = instance.fitAddon.proposeDimensions();
      if (dimensions && dimensions.cols && dimensions.rows) {
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
}

// シングルトンインスタンス
export const terminalService = new TerminalService();