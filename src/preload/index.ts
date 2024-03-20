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
      getInitialSettings: () => ipcRenderer.invoke('get-initial-settings'),
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
