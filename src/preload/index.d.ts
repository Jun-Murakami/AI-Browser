import type { ElectronAPI } from '@electron-toolkit/preload';

interface ExtendedElectronAPI extends ElectronAPI {
  sendBrowserSizeToMain: (size: { width: number; height: number }) => void;
  sendBrowserTabIndexToMain: (index: number) => void;
  sendIsDarkModeToMain: (isDarkMode: boolean) => void;
  sendEditorModeToMain: (editorMode: number) => void;
  sendLanguageToMain: (language: string) => void;
  sendFontSizeToMain: (fontSize: number) => void;
  sendTextToMain: (text: string, sendToAll: boolean) => void;
  sendLogsToMain: (logs: { id: number; text: string }[]) => void;
  getInitialSettings: () => Promise<InitialSettings>;
  openExternalLink: (url: string) => void;
  reloadCurrentView: () => void;
  reloadAllViews: () => void;
  onUpdateUrls: (callback: (urls: string[]) => void) => void;
  removeUpdateUrlsListener: () => void;
  onUpdateLoadingStatus: (callback: (status: { index: number; isLoading: boolean }) => void) => void;
  removeUpdateLoadingStatusListener: () => void;
  sendEnabledBrowsersToMain: (enabledBrowsers: boolean[]) => void;
  onScriptError: (callback: (error: { browser: string; error: string }) => void) => void;
  removeScriptErrorListener: () => void;
}

interface Browser {
  id: string;
  label: string;
  index: number;
  url: string;
}

interface InitialSettings {
  currentVersion: string;
  isDarkMode: boolean;
  editorMode: number;
  browserWidth: number;
  logs: { id: number; text: string }[];
  language: string;
  fontSize: number;
  osInfo: string;
  enabledBrowsers: Record<string, boolean>;
  browsers: Browser[];
}

declare global {
  interface Window {
    electron: ExtendedElectronAPI;
    api: unknown;
  }
}
