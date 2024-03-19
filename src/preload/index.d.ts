import { ElectronAPI } from '@electron-toolkit/preload';

interface ExtendedElectronAPI extends ElectronAPI {
  sendBrowserSizeToMain: (size: { width: number; height: number }) => void;
  sendBrowserTabIndexToMain: (index: number) => void;
  sendIsDarkModeToMain: (isDarkMode: boolean) => void;
  sendEditorModeToMain: (editorMode: number) => void;
  sendLanguageToMain: (language: string) => void;
  sendTextToMain: (text: string) => void;
  sendLogsToMain: (logs: { id: number; text: string }[]) => void;
  recieveDarkModeFromMain: (callback: (isDarkMode: boolean) => void) => void;
  removeDarkModeListener: () => void;
  recieveEditorModeFromMain: (callback: (editorMode: number) => void) => void;
  removeEditorModeListener: () => void;
  recieveBrowserWidthFromMain: (callback: (browserWidth: number) => void) => void;
  removeBrowserWidthListener: () => void;
  recieveLanguageFromMain: (callback: (language: string) => void) => void;
  removeLanguageListener: () => void;
  recieveLogsFromMain: (callback: (logs: { id: number; text: string }[]) => void) => void;
  removeLogsListener: () => void;
  recieveOSInfoFromMain: (callback: (osInfo: string) => void) => void;
  removeOSInfoListener: () => void;
  sendRequestDarkModeToMain: () => void;
  sendRequestEditorModeToMain: () => void;
  sendRequestBrowserWidthToMain: () => void;
  sendRequestLanguageToMain: () => void;
  sendRequestLogsToMain: () => void;
  sendReuestOSInfoToMain: () => void;
}

declare global {
  interface Window {
    electron: ExtendedElectronAPI;
    api: unknown;
  }
}
