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
      sendFontSizeToMain: (fontSize: number) => ipcRenderer.send('font-size', fontSize),
      sendTextToMain: (text: string, sendToAll: boolean) => ipcRenderer.send('text', text, sendToAll),
      sendLogsToMain: (logs: { id: number; text: string }[]) => ipcRenderer.send('logs', logs),
      getInitialSettings: () => ipcRenderer.invoke('get-initial-settings'),
      openExternalLink: (url: string) => ipcRenderer.send('open-external-link', url),
      reloadCurrentView: () => ipcRenderer.send('reload-current-view'),
      reloadAllViews: () => ipcRenderer.send('reload-all-views'),
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
