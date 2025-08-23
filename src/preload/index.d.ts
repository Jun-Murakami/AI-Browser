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
  onUpdateLoadingStatus: (
    callback: (status: { index: number; isLoading: boolean }) => void,
  ) => void;
  removeUpdateLoadingStatusListener: () => void;
  sendEnabledBrowsersToMain: (enabledBrowsers: boolean[]) => void;
  sendEnabledTerminalsToMain: (enabledTerminals: boolean[]) => void;
  saveTabOrders: (tabOrders: Record<string, number>) => void;
  onScriptError: (
    callback: (error: { browser: string; error: string }) => void,
  ) => void;
  removeScriptErrorListener: () => void;
}

interface Browser {
  id: string;
  label: string;
  index: number;
  url: string;
}

interface Terminal {
  id: string;
  label: string;
  index: number;
  type: string;
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
  enabledTerminals: Record<string, boolean>;
  browsers: Browser[];
  terminals: Terminal[];
  tabOrders?: Record<string, number>;
}

interface TerminalAPI {
  createTerminalSession: (terminalId: string) => Promise<void>;
  destroyTerminalSession: (terminalId: string) => Promise<void>;
  sendTerminalInput: (terminalId: string, data: string) => void;
  onTerminalOutput: (
    callback: (
      event: Electron.IpcRendererEvent,
      terminalId: string,
      data: string,
    ) => void,
  ) => void;
  removeTerminalOutputListener: (
    callback: (
      event: Electron.IpcRendererEvent,
      terminalId: string,
      data: string,
    ) => void,
  ) => void;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => void;
}

declare global {
  interface Window {
    electron: ExtendedElectronAPI;
    api: TerminalAPI;
  }
}
