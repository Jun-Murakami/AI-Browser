import type { WebContentsView } from 'electron';
import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';

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
}

export interface Log {
  id: number;
  text: string;
}

export interface TabManager {
  views: WebContentsView[];
  currentIndex: number;
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
