import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {
  // Terminal APIs
  createTerminalSession: (terminalId: string) =>
    ipcRenderer.invoke('terminal:create', terminalId),
  destroyTerminalSession: (terminalId: string) =>
    ipcRenderer.invoke('terminal:destroy', terminalId),
  sendTerminalInput: (terminalId: string, data: string) =>
    ipcRenderer.send('terminal:input', terminalId, data),
  onTerminalOutput: (
    callback: (event: any, terminalId: string, data: string) => void,
  ) => ipcRenderer.on('terminal:output', callback),
  removeTerminalOutputListener: (
    callback: (event: any, terminalId: string, data: string) => void,
  ) => ipcRenderer.removeListener('terminal:output', callback),
  resizeTerminal: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', terminalId, cols, rows),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      sendBrowserSizeToMain: ({
        width,
        height,
      }: {
        width: number;
        height: number;
      }) => ipcRenderer.send('browser-size', { width, height }),
      sendBrowserTabIndexToMain: (index: number) =>
        ipcRenderer.send('browser-tab-index', index),
      sendIsDarkModeToMain: (isDarkMode: boolean) =>
        ipcRenderer.send('is-dark-mode', isDarkMode),
      sendEditorModeToMain: (editorMode: number) =>
        ipcRenderer.send('editor-mode', editorMode),
      sendLanguageToMain: (language: string) =>
        ipcRenderer.send('language', language),
      sendFontSizeToMain: (fontSize: number) =>
        ipcRenderer.send('font-size', fontSize),
      sendTextToMain: (text: string, sendToAll: boolean) =>
        ipcRenderer.send('text', text, sendToAll),
      sendLogsToMain: (logs: { id: number; text: string }[]) =>
        ipcRenderer.send('logs', logs),
      getInitialSettings: () => ipcRenderer.invoke('get-initial-settings'),
      openExternalLink: (url: string) =>
        ipcRenderer.send('open-external-link', url),
      reloadCurrentView: () => ipcRenderer.send('reload-current-view'),
      reloadAllViews: () => ipcRenderer.send('reload-all-views'),
      onUpdateUrls: (callback: (urls: string[]) => void) =>
        ipcRenderer.on('update-urls', (_, urls: string[]) => callback(urls)),
      removeUpdateUrlsListener: () =>
        ipcRenderer.removeAllListeners('update-urls'),
      onUpdateLoadingStatus: (
        callback: (status: { index: number; isLoading: boolean }) => void,
      ) =>
        ipcRenderer.on(
          'loading-status',
          (_, status: { index: number; isLoading: boolean }) =>
            callback(status),
        ),
      removeUpdateLoadingStatusListener: () =>
        ipcRenderer.removeAllListeners('loading-status'),
      sendEnabledBrowsersToMain: (enabledBrowsers: boolean[]) =>
        ipcRenderer.send('update-enabled-browsers', enabledBrowsers),
      onScriptError: (
        callback: (error: { browser: string; error: string }) => void,
      ) =>
        ipcRenderer.on(
          'script-error',
          (_, error: { browser: string; error: string }) => callback(error),
        ),
      removeScriptErrorListener: () =>
        ipcRenderer.removeAllListeners('script-error'),
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
