import { app, BrowserWindow, clipboard, ipcMain } from 'electron';
import { spawn } from 'node-pty';

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import { join as pathJoin } from 'node:path';

import type { IPty } from 'node-pty';
import type { TerminalSession } from '../types/interfaces';

class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private ptyProcesses: Map<string, IPty> = new Map();
  // ターミナルごとの出力バッファとフラッシュ状態
  private outputBuffers: Map<string, string> = new Map();
  private isFlushScheduled: Map<string, boolean> = new Map();

  constructor() {
    this.registerIpcHandlers();
  }

  private getDefaultShell(): string {
    switch (platform()) {
      case 'win32': {
        // Windows環境では以下の優先順位でシェルを選択
        // 1. PowerShell Core (推奨) - where.exeで検索
        // 2. Windows PowerShell - where.exeで検索
        // 3. Command Prompt (cmd.exe) - 環境変数から

        const { execSync } = require('node:child_process');

        // PowerShell Coreを検索
        try {
          const pwshPath = execSync('where.exe pwsh.exe', { encoding: 'utf8' })
            .trim()
            .split('\n')[0];
          if (pwshPath && existsSync(pwshPath)) {
            return pwshPath;
          }
        } catch {
          // pwsh.exeが見つからない場合は次へ
        }

        // Windows PowerShellを検索
        try {
          const powershellPath = execSync('where.exe powershell.exe', {
            encoding: 'utf8',
          })
            .trim()
            .split('\n')[0];
          if (powershellPath && existsSync(powershellPath)) {
            return powershellPath;
          }
        } catch {
          // powershell.exeが見つからない場合は次へ
        }

        // 既知のインストールパスをチェック（フォールバック）
        const knownPaths = [
          'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
          'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        ];

        for (const path of knownPaths) {
          try {
            if (existsSync(path)) {
              return path;
            }
          } catch {
            // Continue to next path
          }
        }

        // 最後の手段としてcmd.exeを使用
        return process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
      }
      case 'darwin':
        return process.env.SHELL || '/bin/zsh';
      default:
        return process.env.SHELL || '/bin/bash';
    }
  }

  private getShellEnvironment(): NodeJS.ProcessEnv {
    // システムの環境変数をより確実に取得
    const env = { ...process.env };

    // Windows環境での日本語文字化け対策
    if (platform() === 'win32') {
      env.LANG = 'ja_JP.UTF-8';
      env.CHCP = '65001'; // UTF-8コードページ
      // PowerShellのための追加設定
      env.PSModulePath = process.env.PSModulePath || '';
      env.POWERSHELL_TELEMETRY_OPTOUT = '1';
    }

    // ターミナルタイプを設定
    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';

    return env;
  }

  private registerIpcHandlers() {
    ipcMain.handle('terminal:create', async (_event, terminalId: string) => {
      return this.createSession(terminalId);
    });

    ipcMain.handle('terminal:destroy', async (_event, terminalId: string) => {
      return this.destroySession(terminalId);
    });

    ipcMain.on('terminal:input', (_event, terminalId: string, data: string) => {
      this.sendInput(terminalId, data);
    });

    ipcMain.on(
      'terminal:resize',
      (_event, terminalId: string, cols: number, rows: number) => {
        this.resizeTerminal(terminalId, cols, rows);
      },
    );

    // クリップボードから画像を読み取り、一時ファイルに保存して返す
    // Electron ネイティブの clipboard.readImage() を使用し、
    // レンダラーの navigator.clipboard.read() の不安定さを回避する
    ipcMain.handle('terminal:read-clipboard-image', async () => {
      try {
        const image = clipboard.readImage();
        if (image.isEmpty()) {
          return { hasImage: false };
        }
        const dir = pathJoin(app.getPath('userData'), 'Clipboard');
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        const filePath = pathJoin(dir, `${Date.now()}.png`);
        writeFileSync(filePath, image.toPNG());
        return { hasImage: true, filePath };
      } catch (error) {
        return {
          hasImage: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }

  private scheduleFlush(terminalId: string) {
    if (this.isFlushScheduled.get(terminalId)) return;
    this.isFlushScheduled.set(terminalId, true);

    // メインプロセスには rAF が無いので、16ms タイマーで近似
    setTimeout(() => {
      this.isFlushScheduled.set(terminalId, false);
      const data = this.outputBuffers.get(terminalId);
      if (data && data.length > 0) {
        this.outputBuffers.set(terminalId, '');
        this.sendOutput(terminalId, data);
      }
    }, 16);
  }

  createSession(terminalId: string): void {
    if (this.sessions.has(terminalId)) {
      return;
    }

    const shell = this.getDefaultShell();
    const cwd = process.env.HOME || process.env.USERPROFILE || process.cwd();
    const env = this.getShellEnvironment();

    try {
      // PowerShellの場合は起動オプションを追加
      const shellArgs: string[] = [];
      if (shell.includes('powershell') || shell.includes('pwsh')) {
        shellArgs.push('-NoLogo'); // ロゴを表示しない
      }

      // node-ptyを使用してPTYプロセスを作成
      const ptyProcess = spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd,
        env,
        useConpty: platform() === 'win32', // Windows用のConPTY設定
      });

      // 出力バッファを初期化
      this.outputBuffers.set(terminalId, '');
      this.isFlushScheduled.set(terminalId, false);

      // データハンドラー（集約）
      ptyProcess.onData((data) => {
        const current = this.outputBuffers.get(terminalId) || '';
        this.outputBuffers.set(terminalId, current + data);
        this.scheduleFlush(terminalId);
      });

      // 終了ハンドラー
      ptyProcess.onExit(({ exitCode, signal }) => {
        // 残りのバッファをフラッシュ
        const remaining = this.outputBuffers.get(terminalId);
        if (remaining && remaining.length > 0) {
          this.sendOutput(terminalId, remaining);
          this.outputBuffers.set(terminalId, '');
        }
        const message = signal
          ? `\r\nProcess terminated with signal ${signal}\r\n`
          : `\r\nProcess exited with code ${exitCode}\r\n`;
        this.sendOutput(terminalId, message);
        this.destroySession(terminalId);
      });

      // セッション情報を保存
      this.sessions.set(terminalId, {
        id: terminalId,
        shell,
        cwd,
        ptyProcess: ptyProcess,
      });
      this.ptyProcesses.set(terminalId, ptyProcess);

      // シェルごとの初期化設定
      // PowerShellの初期化コマンドは実行しない（プロンプト重複の原因）
      if (platform() === 'win32' && shell.includes('cmd')) {
        // Command Promptの場合のみ初期化
        setTimeout(() => {
          ptyProcess.write('chcp 65001\r\n');
          ptyProcess.write('cls\r\n');
        }, 200);
      }
    } catch (error) {
      console.error('Terminal session creation error:', error);
      this.sendOutput(terminalId, `\r\nError creating terminal session.\r\n`);
    }
  }

  destroySession(terminalId: string): void {
    const ptyProcess = this.ptyProcesses.get(terminalId);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (_error) {}
      this.ptyProcesses.delete(terminalId);
    }
    // バッファも掃除
    this.outputBuffers.delete(terminalId);
    this.isFlushScheduled.delete(terminalId);
    this.sessions.delete(terminalId);
  }

  sendInput(terminalId: string, data: string): void {
    const ptyProcess = this.ptyProcesses.get(terminalId);
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  }

  sendOutput(terminalId: string, data: string): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('terminal:output', terminalId, data);
    }
  }

  resizeTerminal(terminalId: string, cols: number, rows: number): void {
    const ptyProcess = this.ptyProcesses.get(terminalId);
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
      } catch (_error) {}
    }
  }

  destroyAllSessions(): void {
    for (const terminalId of this.sessions.keys()) {
      this.destroySession(terminalId);
    }
  }

  /** Clipboard フォルダを丸ごと削除する */
  cleanupClipboardImages(): void {
    try {
      const dir = pathJoin(app.getPath('userData'), 'Clipboard');
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      // 無視
    }
  }

  // セッション情報を取得
  getSession(terminalId: string): TerminalSession | undefined {
    return this.sessions.get(terminalId);
  }

  // アクティブなセッション数を取得
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

export const terminalManager = new TerminalManager();
