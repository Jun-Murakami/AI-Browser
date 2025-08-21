import { spawn, IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import { BrowserWindow, ipcMain } from 'electron';
import { platform } from 'os';
import { existsSync } from 'fs';
import type { TerminalSession } from '../types/interfaces';

class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private ptyProcesses: Map<string, IPty> = new Map();

  constructor() {
    this.registerIpcHandlers();
  }

  private getDefaultShell(): string {
    switch (platform()) {
      case 'win32':
        // Windows環境では以下の優先順位でシェルを選択
        // 1. PowerShell Core (推奨)
        // 2. Windows PowerShell
        // 3. Command Prompt (cmd.exe)
        const shells = [
          'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
          process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe'
        ];
        
        // 利用可能な最初のシェルを返す
        for (const shell of shells) {
          try {
            if (existsSync(shell)) {
              return shell;
            }
          } catch (e) {
            // Continue to next shell
          }
        }
        return 'cmd.exe';
      case 'darwin':
        return process.env.SHELL || '/bin/zsh';
      default:
        return process.env.SHELL || '/bin/bash';
    }
  }

  private getShellEnvironment(): NodeJS.ProcessEnv {
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
  }

  createSession(terminalId: string): void {
    if (this.sessions.has(terminalId)) {
      console.log(`Terminal session ${terminalId} already exists, skipping creation`);
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

      // データハンドラー
      ptyProcess.onData((data) => {
        this.sendOutput(terminalId, data);
      });

      // 終了ハンドラー
      ptyProcess.onExit(({ exitCode, signal }) => {
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
      console.error('Failed to create terminal session:', error);
      this.sendOutput(
        terminalId,
        `\r\nError creating terminal: ${error.message}\r\n`,
      );
    }
  }

  destroySession(terminalId: string): void {
    const ptyProcess = this.ptyProcesses.get(terminalId);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (error) {
        console.error('Error killing PTY process:', error);
      }
      this.ptyProcesses.delete(terminalId);
    }
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
      } catch (error) {
        console.error('Error resizing terminal:', error);
      }
    }
  }

  destroyAllSessions(): void {
    for (const terminalId of this.sessions.keys()) {
      this.destroySession(terminalId);
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
