import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  shell,
  WebContentsView,
} from 'electron';
import contextMenu from 'electron-context-menu';

import icon from '../../resources/icon.png?asset';
import { BROWSERS, URL_PATTERNS } from './constants/browsers';
import { TERMINALS } from './constants/terminals';
import { terminalManager } from './terminal/terminalManager';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { join } from 'node:path';

import type { AppState, Log, TabManager } from './types/interfaces';

// 初期のenabledBrowsersを生成
const initialEnabledBrowsers = Object.fromEntries(
  BROWSERS.map((browser) => [browser.id, true]),
);

let appState: AppState = {
  bounds: { x: 0, y: 0, width: 1100, height: 800 },
  isMaximized: false,
  isDarkMode: false,
  editorMode: 0,
  browserWidth: 550,
  browserTabIndex: 0,
  language: 'text',
  fontSize: 16,
  enabledBrowsers: initialEnabledBrowsers,
  // 既定では全ターミナル有効
  enabledTerminals: Object.fromEntries(TERMINALS.map((t) => [t.id, true])),
  tabOrders: {},
};

let logs: Log[] = [];

const tabManager: TabManager = {
  views: [],
  currentIndex: 0,
};

/**
 * タブの表示/非表示を切り替える
 */
function switchTab(mainWindow: BrowserWindow, newIndex: number) {
  // BrowserWindow を BaseWindow に変更
  if (newIndex < 0 || newIndex >= tabManager.views.length) return;

  // 現在のビューを非表示
  if (
    tabManager.currentIndex >= 0 &&
    tabManager.currentIndex < tabManager.views.length
  ) {
    const currentView = tabManager.views[tabManager.currentIndex];
    mainWindow.contentView.removeChildView(currentView); // removeBrowserView を removeChildView に変更
  }

  // 新しいビューを表示
  const newView = tabManager.views[newIndex];
  mainWindow.contentView.addChildView(newView); // addBrowserView を addChildView に変更
  const bounds = mainWindow.getBounds();
  newView.setBounds({
    x: 0,
    y: 108,
    width: appState.browserWidth ? appState.browserWidth - 2 : bounds.width - 2,
    height: bounds.height - 108 - 36,
  });

  tabManager.currentIndex = newIndex;
}

/**
 * 新しい WebContentsView を生成し、イベントリスナーを付与
 */
function setupView(
  mainWindow: BrowserWindow,
  url: string,
  index: number,
  urls: string[],
) {
  // BrowserWindow を BaseWindow に変更
  const view = new WebContentsView({
    // BrowserView を WebContentsView に変更
    webPreferences: {
      spellcheck: false,
    },
  });

  // タブマネージャーに追加
  tabManager.views.push(view);

  view.webContents.loadURL(url);

  contextMenu({
    window: view.webContents,
    showInspectElement: is.dev,
  });

  // ブラウザのURLを更新するイベント
  view.webContents.on('did-navigate', (_, newUrl) => {
    urls[index] = newUrl;
    mainWindow.webContents.send('update-urls', urls);
  });

  // 初期ロード時のURLを取得するために追加
  view.webContents.on('did-finish-load', () => {
    urls[index] = view.webContents.getURL();
    mainWindow.webContents.send('update-urls', urls);
  });

  // ローディング開始時
  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('loading-status', { index, isLoading: true });
  });

  // ローディング終了時
  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('loading-status', { index, isLoading: false });
  });

  // 最初のタブを表示
  if (index === urls.length - 1) {
    switchTab(mainWindow, 0);
  }
}

/**
 * メインウィンドウ用のIPCハンドラを登録
 */
function registerIpcHandlers(mainWindow: BrowserWindow) {
  // BrowserWindow を BaseWindow に変更
  ipcMain.on('browser-size', (_, arg) => {
    const { width, height } = arg;
    if (!width || !height || tabManager.views.length === 0) {
      return;
    }
    // 現在表示中のビューのサイズのみを更新
    const currentView = tabManager.views[tabManager.currentIndex];
    if (currentView) {
      currentView.setBounds({
        x: 0,
        y: 108,
        width: width - 2,
        height: height - 8,
      });
    }
    appState.browserWidth = width;
  });

  ipcMain.on('browser-tab-index', (_, index) => {
    if (index === -1) {
      // ターミナルが選択された場合、現在のブラウザビューを非表示にする
      if (
        tabManager.currentIndex >= 0 &&
        tabManager.currentIndex < tabManager.views.length
      ) {
        const currentView = tabManager.views[tabManager.currentIndex];
        mainWindow.contentView.removeChildView(currentView);
      }
      return;
    }

    if (tabManager.views.length === 0) {
      return;
    }
    appState.browserTabIndex = index;
    switchTab(mainWindow, index);
  });

  ipcMain.on('reload-current-view', () => {
    const currentView = tabManager.views[tabManager.currentIndex];
    if (!currentView) return;

    // 現在のタブのURLに基づいてリロード
    const url = currentView.webContents.getURL();
    const urlPattern = URL_PATTERNS.find(
      (pattern) =>
        tabManager.currentIndex === pattern.index &&
        (Array.isArray(pattern.pattern)
          ? pattern.pattern.some((p) => url.includes(p))
          : url.includes(pattern.pattern)),
    );

    if (urlPattern) {
      currentView.webContents.reload();
    }
  });

  ipcMain.on('reload-all-views', () => {
    // 全てのビューを初期URLにリセット
    tabManager.views.forEach((view, index) => {
      const urlPattern = URL_PATTERNS.find(
        (pattern) => pattern.index === index,
      );
      if (urlPattern) {
        view.webContents.loadURL(urlPattern.url);
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
      // レンダラー初期化用にターミナルの有効状態も返す
      enabledTerminals: appState.enabledTerminals,
      browsers: BROWSERS.map((browser) => ({
        id: browser.id,
        label: browser.label,
        index: browser.index,
        url: browser.url,
      })),
      terminals: TERMINALS.map((terminal) => ({
        id: terminal.id,
        label: terminal.label,
        index: terminal.index,
        type: terminal.type,
      })),
      tabOrders: appState.tabOrders,
    };
  });

  ipcMain.on('update-enabled-browsers', (_, enabledBrowsers: boolean[]) => {
    // boolean[]をRecord<string, boolean>に変換
    appState.enabledBrowsers = Object.fromEntries(
      BROWSERS.map((browser, index) => [browser.id, enabledBrowsers[index]]),
    );
  });

  // ターミナルの有効/無効状態を更新
  ipcMain.on('update-enabled-terminals', (_, enabledTerminals: boolean[]) => {
    appState.enabledTerminals = Object.fromEntries(
      TERMINALS.map((terminal, index) => [
        terminal.id,
        enabledTerminals[index],
      ]),
    );
  });

  ipcMain.on('save-tab-orders', (_, tabOrders: Record<string, number>) => {
    appState.tabOrders = tabOrders;
  });

  ipcMain.on('text', (_, text: string, sendToAll: boolean) => {
    if (tabManager.views.length === 0) {
      return;
    }

    tabManager.views.forEach((view, index) => {
      const browser = BROWSERS[index];
      if (!browser || !appState.enabledBrowsers[browser.id]) {
        return;
      }

      const currentUrl = view.webContents.getURL();
      const shouldSend =
        sendToAll ||
        (tabManager.currentIndex === index &&
          (Array.isArray(browser.urlPattern)
            ? browser.urlPattern.some((p) => currentUrl.includes(p))
            : currentUrl.includes(browser.urlPattern)));

      if (shouldSend) {
        try {
          const escapedText = JSON.stringify(text).replace(/`/g, '\\`'); // バッククォートのエスケープを強化

          const script = browser.script.replace('TEXT_TO_SEND', escapedText);
          view.webContents.executeJavaScript(script).catch((error) => {
            console.error('Script execution failed:', error);
            mainWindow.webContents.send('script-error', {
              browser: browser.label,
              error: error.message,
            });
          });
        } catch (error) {
          console.error('Script preparation failed:', error);
          mainWindow.webContents.send('script-error', {
            browser: browser.label,
            error: 'Failed to prepare script',
          });
        }
      }
    });
  });

  ipcMain.on('open-external-link', (_, url) => {
    shell.openExternal(url);
  });
}

/**
 * メインウィンドウ用のIPCハンドラを削除
 */
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
  ipcMain.removeAllListeners('save-tab-orders');
}

/**
 * BrowserView に登録しているイベントリスナーを削除
 */
function removeBrowserViewListeners(view: WebContentsView) {
  // BrowserView を WebContentsView に変更
  const wc = view.webContents;
  wc.removeAllListeners('did-navigate');
  wc.removeAllListeners('did-finish-load');
  wc.removeAllListeners('did-start-loading');
  wc.removeAllListeners('did-stop-loading');
}

/**
 * メインウィンドウに登録されている全ての BrowserView のイベントを削除
 */
function removeAllBrowserViewsListeners() {
  for (const view of tabManager.views) {
    removeBrowserViewListeners(view);
  }
}

/**
 * メインウィンドウ（BaseWindow）を生成する
 */
function createMainWindow(): BrowserWindow {
  // 保存されたウィンドウの状態を読み込む
  const userDataPath = app.getPath('userData');
  const appStatePath = path.join(userDataPath, 'appState.json');
  if (fs.existsSync(appStatePath)) {
    try {
      const savedState = JSON.parse(fs.readFileSync(appStatePath, 'utf8'));

      // enabledBrowsersの検証とガード処理
      const isValidEnabledBrowsers =
        savedState.enabledBrowsers &&
        typeof savedState.enabledBrowsers === 'object' &&
        !Array.isArray(savedState.enabledBrowsers);

      // 保存された設定のブラウザIDと現在のブラウザIDを比較
      const savedBrowserIds = isValidEnabledBrowsers
        ? Object.keys(savedState.enabledBrowsers)
        : [];
      const currentBrowserIds = BROWSERS.map((browser) => browser.id);

      // ブラウザの構成が変更された場合は設定をリセット
      if (
        !isValidEnabledBrowsers ||
        savedBrowserIds.length !== currentBrowserIds.length ||
        !currentBrowserIds.every((id) => savedBrowserIds.includes(id))
      ) {
        savedState.enabledBrowsers = Object.fromEntries(
          BROWSERS.map((browser) => [browser.id, true]),
        );
      }

      appState = savedState;

      // enabledTerminals の検証とガード処理
      const isValidEnabledTerminals =
        appState.enabledTerminals &&
        typeof appState.enabledTerminals === 'object' &&
        !Array.isArray(appState.enabledTerminals);

      const savedTerminalIds = isValidEnabledTerminals
        ? Object.keys(appState.enabledTerminals)
        : [];
      const currentTerminalIds = TERMINALS.map((t) => t.id);

      if (
        !isValidEnabledTerminals ||
        savedTerminalIds.length !== currentTerminalIds.length ||
        !currentTerminalIds.every((id) => savedTerminalIds.includes(id))
      ) {
        appState.enabledTerminals = Object.fromEntries(
          TERMINALS.map((t) => [t.id, true]),
        );
      }
    } catch (error) {
      console.error('ウィンドウの状態の読み込みに失敗しました:', error);
      // エラーが発生した場合も全てのブラウザを有効にする
      appState.enabledBrowsers = Object.fromEntries(
        BROWSERS.map((browser) => [browser.id, true]),
      );
      // ターミナルも全て有効にする
      appState.enabledTerminals = Object.fromEntries(
        TERMINALS.map((t) => [t.id, true]),
      );
    }
  }

  // 有効ブラウザの初期化処理を更新
  if (
    !appState.enabledBrowsers ||
    typeof appState.enabledBrowsers !== 'object'
  ) {
    appState.enabledBrowsers = Object.fromEntries(
      BROWSERS.map((browser) => [browser.id, true]),
    );
  }

  // 有効ターミナルの初期化処理
  if (
    !appState.enabledTerminals ||
    typeof appState.enabledTerminals !== 'object'
  ) {
    appState.enabledTerminals = Object.fromEntries(
      TERMINALS.map((t) => [t.id, true]),
    );
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
    // BrowserWindow を BaseWindow に変更
    minWidth: 1000,
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

  // 各ブラウザのURLリスト
  const urls = URL_PATTERNS.map((pattern) => pattern.url);
  // WebContentsViewを生成
  urls.forEach((url, index) => {
    setupView(mainWindow, url, index, urls);
  });

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
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  contextMenu({
    window: mainWindow.webContents,
    showInspectElement: is.dev,
  });

  mainWindow.on('close', (e) => {
    // Mac以外でデフォルトの閉じる動作をキャンセル
    e.preventDefault();

    // ここでBrowserViewのイベントリスナーを削除
    removeAllBrowserViewsListeners();

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
        bounds: bounds,
        isMaximized: isMaximized,
        isDarkMode: appState.isDarkMode,
        editorMode: appState.editorMode,
        browserWidth: appState.browserWidth,
        browserTabIndex: appState.browserTabIndex,
        language: appState.language,
        fontSize: appState.fontSize,
        enabledBrowsers: appState.enabledBrowsers,
        enabledTerminals: appState.enabledTerminals,
        tabOrders: appState.tabOrders,
      };

      // ファイルに保存（fsモジュールを使用）
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(userDataPath, 'appState.json'),
        JSON.stringify(appState),
      );
      //人間に読みやすいようにログを整形して保存
      fs.writeFileSync(
        path.join(userDataPath, 'logs.json'),
        JSON.stringify(logs, null, 2),
      );
    }
    removeIpcHandlers();
    mainWindow.destroy();
  });

  return mainWindow;
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

  createMainWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
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
  // ターミナルセッションをクリーンアップ
  terminalManager.destroyAllSessions();
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
