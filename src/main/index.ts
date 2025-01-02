import { app, shell, BrowserWindow, ipcMain, BrowserView, nativeTheme } from 'electron';
import fs from 'fs';
import path, { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import contextMenu from 'electron-context-menu';
import icon from '../../resources/icon.png?asset';

interface AppState {
  bounds?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
  isMaximized?: boolean;
  isDarkMode?: boolean;
  editorMode?: number;
  browserWidth?: number;
  browserTabIndex?: number;
  language?: string;
  fontSize?: number;
  enabledBrowsers?: boolean[];
}

let appState: AppState = {
  bounds: {},
  isMaximized: false,
  isDarkMode: false,
  editorMode: 0,
  browserWidth: 500,
  browserTabIndex: 0,
  language: 'text',
  fontSize: 16,
  enabledBrowsers: [true, true, true, true, true, true, true],
};

interface Log {
  id: number;
  text: string;
}

let logs: Log[] = [];

function registerIpcHandlers(mainWindow: BrowserWindow) {
  ipcMain.on('browser-size', (_, arg) => {
    const { width, height } = arg;
    if (!width || !height || mainWindow.getBrowserViews().length === 0) {
      return;
    }
    mainWindow.getBrowserViews().forEach((view) => {
      view.setBounds({ x: 0, y: 108, width: width - 2, height: height - 8 });
    });
    appState.browserWidth = width;
  });

  ipcMain.on('browser-tab-index', (_, index) => {
    if (mainWindow.getBrowserViews().length === 0) {
      return;
    }
    appState.browserTabIndex = index;
    mainWindow.getBrowserViews().forEach((view) => {
      if (index === 0 && view.webContents.getURL().includes('chatgpt.com')) {
        mainWindow.setTopBrowserView(view);
      } else if (index === 1 && view.webContents.getURL().includes('gemini.google.com')) {
        mainWindow.setTopBrowserView(view);
      } else if (index === 2 && view.webContents.getURL().includes('claude.ai')) {
        mainWindow.setTopBrowserView(view);
      } else if (index === 3 && view.webContents.getURL().includes('phind.com')) {
        mainWindow.setTopBrowserView(view);
      } else if (index === 4 && view.webContents.getURL().includes('perplexity.ai')) {
        mainWindow.setTopBrowserView(view);
      } else if (index === 5 && view.webContents.getURL().includes('genspark.ai')) {
        mainWindow.setTopBrowserView(view);
      } else if (
        (index === 6 && view.webContents.getURL().includes('aistudio.google.com')) ||
        view.webContents.getURL().includes('ai.google.dev')
      ) {
        mainWindow.setTopBrowserView(view);
      } else if (index === 7 && view.webContents.getURL().includes('jenova.ai')) {
        mainWindow.setTopBrowserView(view);
      }
    });
  });

  ipcMain.on('reload-current-view', () => {
    const index = appState.browserTabIndex;
    mainWindow.getBrowserViews().forEach((view) => {
      if (index === 0 && view.webContents.getURL().includes('chatgpt.com')) {
        view.webContents.reload();
      } else if (index === 1 && view.webContents.getURL().includes('gemini.google.com')) {
        view.webContents.reload();
      } else if (index === 2 && view.webContents.getURL().includes('claude.ai')) {
        view.webContents.reload();
      } else if (index === 3 && view.webContents.getURL().includes('phind.com')) {
        view.webContents.reload();
      } else if (index === 4 && view.webContents.getURL().includes('perplexity.ai')) {
        view.webContents.reload();
      } else if (index === 5 && view.webContents.getURL().includes('genspark.ai')) {
        view.webContents.reload();
      } else if (
        (index === 6 && view.webContents.getURL().includes('aistudio.google.com')) ||
        view.webContents.getURL().includes('ai.google.dev')
      ) {
        view.webContents.reload();
      } else if (index === 7 && view.webContents.getURL().includes('jenova.ai')) {
        view.webContents.reload();
      }
    });
  });

  ipcMain.on('reload-all-views', () => {
    mainWindow.getBrowserViews().forEach((view) => {
      if (view.webContents.getURL().includes('chatgpt.com')) {
        view.webContents.loadURL('https://chatgpt.com/');
      } else if (view.webContents.getURL().includes('gemini.google.com')) {
        view.webContents.loadURL('https://gemini.google.com/');
      } else if (view.webContents.getURL().includes('claude.ai')) {
        view.webContents.loadURL('https://claude.ai/');
      } else if (view.webContents.getURL().includes('phind.com')) {
        view.webContents.loadURL('https://www.phind.com/');
      } else if (view.webContents.getURL().includes('perplexity.ai')) {
        view.webContents.loadURL('https://www.perplexity.ai/');
      } else if (view.webContents.getURL().includes('genspark.ai')) {
        view.webContents.loadURL('https://www.genspark.ai/');
      } else if (
        view.webContents.getURL().includes('aistudio.google.com') ||
        view.webContents.getURL().includes('ai.google.dev')
      ) {
        view.webContents.loadURL('https://aistudio.google.com/');
      } else if (view.webContents.getURL().includes('jenova.ai')) {
        view.webContents.loadURL('https://app.jenova.ai/');
      }
    });
  });

  ipcMain.on('is-dark-mode', (_, isDarkMode) => {
    appState.isDarkMode = isDarkMode;
    nativeTheme.themeSource = isDarkMode ? 'dark' : 'light';
  });

  ipcMain.on('editor-mode', (_, editorMode) => {
    appState.editorMode = editorMode;
  });

  ipcMain.on('language', (_, language) => {
    appState.language = language;
  });

  ipcMain.on('font-size', (_, fontSize) => {
    appState.fontSize = fontSize;
  });

  ipcMain.on('logs', (_, newLogs: Log[]) => {
    logs = newLogs;
  });

  ipcMain.handle('get-initial-settings', async () => {
    return {
      currentVersion: app.getVersion(),
      isDarkMode: appState.isDarkMode,
      editorMode: appState.editorMode,
      browserWidth: appState.browserWidth,
      logs: logs,
      language: appState.language,
      fontSize: appState.fontSize,
      osInfo: process.platform,
      enabledBrowsers: appState.enabledBrowsers,
    };
  });

  ipcMain.on('update-enabled-browsers', (_, enabledBrowsers: boolean[]) => {
    appState.enabledBrowsers = enabledBrowsers;
  });

  ipcMain.on('text', (_, text: string, sendToAll: boolean) => {
    if (mainWindow.getBrowserViews().length === 0) {
      return;
    }
    mainWindow.getBrowserViews().forEach((view) => {
      if (!appState.enabledBrowsers) {
        return;
      }
      if (
        view.webContents.getURL().includes('chatgpt.com') &&
        appState.enabledBrowsers[0] &&
        (appState.browserTabIndex === 0 || sendToAll)
      ) {
        const script = `var textareaTag = document.querySelector('main div[id="prompt-textarea"]');
                        textareaTag.textContent = ${JSON.stringify(text)};
                        textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => {
                          var buttons = document.querySelectorAll('main button[data-testid="send-button"]');
                          if (buttons.length > 0) {
                            buttons[buttons.length - 1].click();
                          }
                        }, 700);
                        `;
        view.webContents.executeJavaScript(script).catch((error) => {
          console.error('Script execution failed:', error);
        });
      } else if (
        view.webContents.getURL().includes('gemini.google.com') &&
        appState.enabledBrowsers[1] &&
        (appState.browserTabIndex === 1 || sendToAll)
      ) {
        const script = `var textareaTag = document.querySelector('main rich-textarea div[role="textbox"] p');
                        textareaTag.textContent = ${JSON.stringify(text)};
                        textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => {
                          var sendButton = document.querySelector('main div.send-button-container button.send-button');
                          if (sendButton) {
                            sendButton.click();
                          }
                        }, 700);
                        `;
        view.webContents.executeJavaScript(script).catch((error) => {
          console.error('Script execution failed:', error);
        });
      } else if (
        view.webContents.getURL().includes('claude.ai') &&
        appState.enabledBrowsers[2] &&
        (appState.browserTabIndex === 2 || sendToAll)
      ) {
        const script = `var textareaTags = document.querySelectorAll('div[contenteditable="true"] p');
                        var textareaTag = textareaTags[textareaTags.length - 1];
                        if (textareaTag) {
                          textareaTag.textContent = ${JSON.stringify(text)};
                          textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        setTimeout(() => {
                          var sendButton = document.querySelector('div[data-value="new chat"] button');
                          if (!sendButton) {
                            sendButton = document.querySelector('button[aria-label="Send Message"]');
                          }
                          if (sendButton) {
                            sendButton.click();
                          }
                        }, 700);
                        `;
        view.webContents.executeJavaScript(script).catch((error) => {
          console.error('Script execution failed:', error);
        });
      } else if (
        view.webContents.getURL().includes('phind.com') &&
        appState.enabledBrowsers[3] &&
        (appState.browserTabIndex === 3 || sendToAll)
      ) {
        const script = `var textareaTag = document.querySelector('main form textarea');
                        textareaTag.textContent = ${JSON.stringify(text)};
                        textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => {
                          var sendButton = document.querySelector('main form button[type="submit"]');
                          if (sendButton) {
                            sendButton.click();
                          }
                        }, 700);
                        `;
        view.webContents.executeJavaScript(script).catch((error) => {
          console.error('Script execution failed:', error);
        });
      } else if (
        view.webContents.getURL().includes('perplexity.ai') &&
        appState.enabledBrowsers[4] &&
        (appState.browserTabIndex === 4 || sendToAll)
      ) {
        const script = `var textareaTags = document.querySelectorAll('main textarea');
                        var textareaTag = textareaTags[textareaTags.length - 1];
                        if (textareaTag) {
                          const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                          nativeTextAreaValueSetter.call(textareaTag, ${JSON.stringify(text)});
                          textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
                          setTimeout(() => {
                            var buttons = document.querySelectorAll('main button[aria-label="Submit"]');
                            var sendButton = buttons[buttons.length - 1];
                            if (sendButton) {
                              sendButton.click();
                            }
                          }, 300);
                        }`;
        view.webContents.executeJavaScript(script).catch((error) => {
          console.error('Script execution failed:', error);
        });
      } else if (
        view.webContents.getURL().includes('genspark.ai') &&
        appState.enabledBrowsers[5] &&
        (appState.browserTabIndex === 5 || sendToAll)
      ) {
        const script = `var textareaTag = document.querySelector('.search-input') || document.querySelector('textarea[id="searchInput"]');
                        textareaTag.value = ${JSON.stringify(text)};
                        textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => {
                          var sendButton = document.querySelector('div.input-icon') || document.querySelector('div.enter-icon-wrapper');
                          if (sendButton) {
                            sendButton.click();
                          }
                        }, 700);  
                        `;
        view.webContents.executeJavaScript(script).catch((error) => {
          console.error('Script execution failed:', error);
        });
      } else if (
        view.webContents.getURL().includes('aistudio.google.com') &&
        appState.enabledBrowsers[6] &&
        (appState.browserTabIndex === 6 || sendToAll)
      ) {
        const script = `var textareaTag = document.querySelector('textarea[aria-label="User text input"]');
                        textareaTag.value = ${JSON.stringify(text)};
                        textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => {
                          var sendButton = document.querySelector('button.run-button');
                          if (sendButton) {
                            sendButton.click();
                          }
                        }, 700);
                        `;
        view.webContents.executeJavaScript(script).catch((error) => {
          console.error('Script execution failed:', error);
        });
      } else if (
        view.webContents.getURL().includes('jenova.ai') &&
        appState.enabledBrowsers[7] &&
        (appState.browserTabIndex === 7 || sendToAll)
      ) {
        const script = `var textareaTag = document.querySelector('textarea[name="message"]');
                        var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                          window.HTMLTextAreaElement.prototype,
                          "value"
                        ).set;
                        nativeTextAreaValueSetter.call(textareaTag, ${JSON.stringify(text)});
                        textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        setTimeout(() => {
                          var siblingDivs = textareaTag.parentElement.querySelectorAll(':scope > div');
                          var sendButton = siblingDivs[siblingDivs.length - 1];
                          if (sendButton) {
                            console.log('sendButton', sendButton);
                            sendButton.click();
                          }
                        }, 700);
                        `;
        view.webContents.executeJavaScript(script).catch((error) => {
          console.error('Script execution failed:', error);
        });
      }
    });
  });

  ipcMain.on('open-external-link', (_, url) => {
    shell.openExternal(url);
  });
}

function removeIpcHandlers() {
  ipcMain.removeAllListeners('browser-size');
  ipcMain.removeAllListeners('browser-tab-index');
  ipcMain.removeAllListeners('is-dark-mode');
  ipcMain.removeAllListeners('editor-mode');
  ipcMain.removeAllListeners('language');
  ipcMain.removeAllListeners('font-size');
  ipcMain.removeAllListeners('logs');
  ipcMain.removeAllListeners('get-initial-settings');
  ipcMain.removeAllListeners('text');
}

contextMenu({
  showInspectElement: is.dev,
});

function removeBrowserViewListeners(view: BrowserView) {
  const wc = view.webContents;
  wc.removeAllListeners('did-navigate');
  wc.removeAllListeners('did-start-loading');
  wc.removeAllListeners('did-stop-loading');
  // ほかに付与しているイベントがあれば追加で削除
}

function removeAllBrowserViewsListeners(mainWindow: BrowserWindow) {
  mainWindow.getBrowserViews().forEach((view) => {
    removeBrowserViewListeners(view);
  });
}

function createWindow(): void {
  // 保存されたウィンドウの状態を読み込む
  const userDataPath = app.getPath('userData');
  const appStatePath = path.join(userDataPath, 'appState.json');
  if (fs.existsSync(appStatePath)) {
    try {
      appState = JSON.parse(fs.readFileSync(appStatePath, 'utf8'));
    } catch (error) {
      console.error('ウィンドウの状態の読み込みに失敗しました:', error);
    }
  }

  // Ensure enabledBrowsers is initialized
  if (!appState.enabledBrowsers) {
    appState.enabledBrowsers = [true, true, true, true, true, true, true];
  }

  const logsPath = path.join(userDataPath, 'logs.json');
  if (fs.existsSync(logsPath)) {
    try {
      logs = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    } catch (error) {
      console.error('ログの読み込みに失敗しました:', error);
    }
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    minWidth: 1000,
    height: 700,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    ...appState.bounds,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
  });

  // 保存された状態が最大化なら最大化する
  if (appState.isMaximized) {
    mainWindow.maximize();
  }

  const urls = [
    'https://chatgpt.com/',
    'https://gemini.google.com/',
    'https://claude.ai/',
    'https://www.phind.com/',
    'https://www.perplexity.ai/',
    'https://www.genspark.ai/',
    'https://aistudio.google.com/',
    'https://app.jenova.ai/',
  ];

  function setupView(url: string, index: number) {
    const view = new BrowserView({
      webPreferences: {
        spellcheck: false,
      },
    });
    mainWindow.addBrowserView(view);
    view.webContents.loadURL(url);

    contextMenu({
      window: view.webContents,
      showInspectElement: is.dev,
    });

    // ブラウザのURLを更新
    view.webContents.on('did-navigate', (_, newUrl) => {
      urls[index] = newUrl;
      mainWindow.webContents.send('update-urls', urls);
    });

    // ローディング開始時のイベント
    view.webContents.on('did-start-loading', () => {
      mainWindow.webContents.send('loading-status', { index, isLoading: true });
    });

    // ローディング終了時のイベント
    view.webContents.on('did-stop-loading', () => {
      mainWindow.webContents.send('loading-status', { index, isLoading: false });
    });
  }

  urls
    .slice()
    .reverse()
    .forEach((url, index) => setupView(url, urls.length - 1 - index));

  if (appState.isDarkMode) {
    nativeTheme.themeSource = 'dark';
  }

  registerIpcHandlers(mainWindow);

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (is.dev) {
    //mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (e) => {
    // Mac以外でデフォルトの閉じる動作をキャンセル
    e.preventDefault();

    // ここでBrowserViewのイベントリスナーを削除
    removeAllBrowserViewsListeners(mainWindow);

    if (mainWindow && !mainWindow.isDestroyed()) {
      // ウィンドウの状態を取得
      const isMaximized = mainWindow.isMaximized();
      mainWindow.unmaximize(); // 最大化状態を解除
      const bounds = mainWindow.getBounds();

      // widthとウィンドウ幅の残りの幅の合計が100になるように比率を計算（小数点以下は丸める）
      if (!appState.browserWidth) {
        appState.browserWidth = 400;
      }

      // JSON形式で保存するデータ
      appState = {
        ...appState,
        bounds: bounds,
        isMaximized: isMaximized,
        enabledBrowsers: appState.enabledBrowsers,
      };

      // ファイルに保存（fsモジュールを使用）
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.writeFileSync(path.join(userDataPath, 'appState.json'), JSON.stringify(appState));
      //人間に読みやすいようにログを整形して保存
      fs.writeFileSync(path.join(userDataPath, 'logs.json'), JSON.stringify(logs, null, 2));
    }
    removeIpcHandlers();
    mainWindow.destroy();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron.AiBrowser');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // アプリケーション終了直前にレンダラープロセスのリスナーを削除
  removeIpcHandlers();
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
