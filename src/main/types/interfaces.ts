import { BrowserView } from 'electron';

export interface AppState {
  bounds: Electron.Rectangle;
  isMaximized: boolean;
  isDarkMode: boolean;
  editorMode: number;
  browserWidth: number;
  browserTabIndex: number;
  language: string;
  fontSize: number;
  enabledBrowsers: boolean[];
}

export interface Log {
  id: number;
  text: string;
}

export interface TabManager {
  views: BrowserView[];
  currentIndex: number;
}

export interface UrlPattern {
  index: number;
  pattern: string | string[];
  url: string;
}
