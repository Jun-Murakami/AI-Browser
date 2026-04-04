import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import type { WebContentsView } from 'electron';

export interface AppState {
  bounds: Electron.Rectangle;
  isMaximized: boolean;
  isDarkMode: boolean;
  editorMode: number;
  browserWidth: number;
  browserTabIndex: number;
  language: string;
  fontSize: number;
  enabledBrowsers: Record<string, boolean>;
  // ターミナルの有効/無効状態を保持
  enabledTerminals: Record<string, boolean>;
  tabOrders: Record<string, number>;
  sendTargets: Record<string, boolean>;
  boilerplates: Record<string, string>;
}

export interface Log {
  id: number;
  text: string;
}

export interface TabManager {
  views: WebContentsView[];
  currentIndex: number;
  isTerminalActive: boolean;
}

export interface UrlPattern {
  index: number;
  pattern: string | string[];
  url: string;
}

export interface Browser {
  id: string;
  label: string;
  index: number;
  url: string;
  urlPattern: string | string[];
  script: string;
}

export interface Terminal {
  id: string;
  label: string;
  index: number;
  type: 'terminal';
}

export interface TerminalSession {
  id: string;
  ptyProcess?: IPty;
  shell?: string;
  cwd?: string;
}
