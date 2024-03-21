import { ElectronAPI } from '@electron-toolkit/preload';

interface ExtendedElectronAPI extends ElectronAPI {
  sendBrowserSizeToMain: (size: { width: number; height: number }) => void;
  sendBrowserTabIndexToMain: (index: number) => void;
  sendIsDarkModeToMain: (isDarkMode: boolean) => void;
  sendEditorModeToMain: (editorMode: number) => void;
  sendLanguageToMain: (language: string) => void;
  sendTextToMain: (text: string) => void;
  sendLogsToMain: (logs: { id: number; text: string }[]) => void;
  getInitialSettings: () => Promise<InitialSettings>;
  openExternalLink: (url: string) => void;
}

interface InitialSettings {
  currentVersion: string;
  isDarkMode: boolean;
  editorMode: number;
  browserWidth: number;
  logs: { id: number; text: string }[];
  language: string;
  osInfo: string;
}

declare global {
  interface Window {
    electron: ExtendedElectronAPI;
    api: unknown;
  }
}
