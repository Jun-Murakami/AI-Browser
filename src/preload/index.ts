import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      sendBrowserSizeToMain: ({ width, height }: { width: number; height: number }) =>
        ipcRenderer.send('browser-size', { width, height }),
      sendBrowserTabIndexToMain: (index: number) => ipcRenderer.send('browser-tab-index', index),
      sendIsDarkModeToMain: (isDarkMode: boolean) => ipcRenderer.send('is-dark-mode', isDarkMode),
      sendEditorModeToMain: (editorMode: number) => ipcRenderer.send('editor-mode', editorMode),
      sendLanguageToMain: (language: string) => ipcRenderer.send('language', language),
      sendTextToMain: (text: string) => ipcRenderer.send('text', text),
      sendLogsToMain: (logs: { id: number; text: string }[]) => ipcRenderer.send('logs', logs),
      recieveDarkModeFromMain: (callback: (isDarkMode: boolean) => void) =>
        ipcRenderer.on('is-dark-mode', (_, isDarkMode) => callback(isDarkMode)),
      removeDarkModeListener: () => ipcRenderer.removeAllListeners('is-dark-mode'),
      recieveEditorModeFromMain: (callback: (editorMode: number) => void) =>
        ipcRenderer.on('editor-mode', (_, editorMode) => callback(editorMode)),
      removeEditorModeListener: () => ipcRenderer.removeAllListeners('editor-mode'),
      recieveBrowserWidthFromMain: (callback: (browserWidth: number) => void) =>
        ipcRenderer.on('browser-width', (_, browserWidth) => callback(browserWidth)),
      removeBrowserWidthListener: () => ipcRenderer.removeAllListeners('browser-width'),
      recieveLanguageFromMain: (callback: (language: string) => void) =>
        ipcRenderer.on('language', (_, language) => callback(language)),
      removeLanguageListener: () => ipcRenderer.removeAllListeners('language'),
      recieveLogsFromMain: (callback: (logs: { id: number; text: string }[]) => void) =>
        ipcRenderer.on('logs', (_, logs) => callback(logs)),
      removeLogsListener: () => ipcRenderer.removeAllListeners('logs'),
      recieveOSInfoFromMain: (callback: (osInfo: string) => void) => ipcRenderer.on('os-info', (_, osInfo) => callback(osInfo)),
      removeOSInfoListener: () => ipcRenderer.removeAllListeners('os-info'),
      sendRequestDarkModeToMain: () => ipcRenderer.send('request-dark-mode'),
      sendRequestEditorModeToMain: () => ipcRenderer.send('request-editor-mode'),
      sendRequestBrowserWidthToMain: () => ipcRenderer.send('request-browser-width'),
      sendRequestLanguageToMain: () => ipcRenderer.send('request-language'),
      sendRequestLogsToMain: () => ipcRenderer.send('request-logs'),
      sendReuestOSInfoToMain: () => ipcRenderer.send('request-os-info'),
    });
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
