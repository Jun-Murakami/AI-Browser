// Tauri 版で window.electron / window.api（Electron の preload が公開していた API）を
// 同じ形で用意する互換レイヤー。レンダラーのコンポーネントは変更せずに Tauri で動かすためのもの。
// 対応表は docs/tauri-migration-plan.md を参照。

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { BROWSER_SCRIPTS } from '../../../main/scripts/browserScripts';
import { BROWSER_DEFINITIONS } from '../../../shared/constants/browsers';
import { TERMINAL_DEFINITIONS } from '../../../shared/constants/terminals';

import type { ElectronAPI } from '@electron-toolkit/preload';
import type { UnlistenFn } from '@tauri-apps/api/event';

type ElectronCompat = Omit<Window['electron'], keyof ElectronAPI>;
type InitialSettings = Awaited<
  ReturnType<Window['electron']['getInitialSettings']>
>;
type TerminalOutputCallback = Parameters<Window['api']['onTerminalOutput']>[0];

export const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;

// ───────────────────────────────────────────────────────────
// イベント購読（Electron の ipcRenderer.on / removeAllListeners 相当）
// ───────────────────────────────────────────────────────────

const unlistenersByChannel = new Map<string, Promise<UnlistenFn>[]>();

function on<T>(channel: string, callback: (payload: T) => void): void {
  const unlisten = listen<T>(channel, (event) => callback(event.payload));
  const list = unlistenersByChannel.get(channel) ?? [];
  list.push(unlisten);
  unlistenersByChannel.set(channel, list);
}

function removeAll(channel: string): void {
  for (const unlisten of unlistenersByChannel.get(channel) ?? []) {
    void unlisten.then((fn) => fn());
  }
  unlistenersByChannel.delete(channel);
}

// Tauri の async コマンドは呼び出し順に実行されるとは限らない。タブ切替やサイズ変更が
// 前後すると表示がずれるため、Electron の ipcRenderer.send と同じく順番に実行する
let commandQueue: Promise<unknown> = Promise.resolve();

function enqueue(label: string, task: () => Promise<unknown>): void {
  commandQueue = commandQueue.then(task).catch((error) => {
    console.error(`[tauri] ${label} failed:`, error);
  });
}

// 戻り値を使わない呼び出し（Electron の ipcRenderer.send 相当）。失敗はログだけ残す
function send(command: string, args?: Record<string, unknown>): void {
  enqueue(command, () => invoke(command, args));
}

function updateState(patch: Record<string, unknown>): void {
  send('update_state', { patch });
}

// ───────────────────────────────────────────────────────────
// 初期化
// ───────────────────────────────────────────────────────────

let initPromise: Promise<InitialSettings> | null = null;

// 初期設定の取得と子 WebView の生成を兼ねる。複数箇所から呼ばれるため 1 回だけ実行する
function getInitialSettings(): Promise<InitialSettings> {
  initPromise ??= invoke<InitialSettings>('init', {
    browsers: BROWSER_DEFINITIONS.map((browser) => ({
      id: browser.id,
      label: browser.label,
      index: browser.index,
      url: browser.url,
      urlPatterns: [browser.urlPattern ?? browser.url].flat(),
    })),
    terminals: TERMINAL_DEFINITIONS.map(({ id, label, index }) => ({
      id,
      label,
      index,
    })),
  }).catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

// ───────────────────────────────────────────────────────────
// テキスト送信
// ───────────────────────────────────────────────────────────

const scriptTemplates = BROWSER_SCRIPTS as Record<string, string>;

/**
 * 全サービス分のスクリプトを組み立てて Rust に渡す。送信先の判定は Rust 側で行う。
 * 組み立て方は Electron 版（src/main/index.ts の 'text' ハンドラ）と同じ。
 */
function sendText(text: string, sendToAll: boolean): void {
  const escapedText = JSON.stringify(text).replace(/`/g, '\\`');
  const scripts = Object.fromEntries(
    BROWSER_DEFINITIONS.flatMap((browser) => {
      const template = scriptTemplates[browser.id];
      if (!template) return [];
      // 置換文字列だと "$&" 等が特殊パターンとして解釈されるため関数で渡す
      return [
        [browser.id, template.replace('TEXT_TO_SEND', () => escapedText)],
      ];
    }),
  );
  send('send_text', { scripts, sendToAll });
}

// ───────────────────────────────────────────────────────────
// ターミナル
// ───────────────────────────────────────────────────────────

const terminalOutputCallbacks = new Set<TerminalOutputCallback>();
let isTerminalOutputListening = false;

// 出力は Rust から 1 本のイベントで届くので、購読は 1 回だけにして各コールバックへ配る
function listenTerminalOutput(): void {
  if (isTerminalOutputListening) return;
  isTerminalOutputListening = true;
  void listen<{ terminalId: string; data: string }>(
    'terminal:output',
    (event) => {
      for (const callback of terminalOutputCallbacks) {
        callback(
          {} as Electron.IpcRendererEvent,
          event.payload.terminalId,
          event.payload.data,
        );
      }
    },
  );
}

const terminalInputQueues = new Map<
  string,
  { pending: string; isSending: boolean }
>();

/**
 * キー入力を送る。invoke の完了を待ってから次を送ることで順序を保ち、
 * 送信中に溜まった入力はまとめて送る。
 */
function sendTerminalInput(terminalId: string, data: string): void {
  let queue = terminalInputQueues.get(terminalId);
  if (!queue) {
    queue = { pending: '', isSending: false };
    terminalInputQueues.set(terminalId, queue);
  }
  queue.pending += data;
  if (queue.isSending) return;

  const target = queue;
  target.isSending = true;
  void (async () => {
    while (target.pending) {
      const chunk = target.pending;
      target.pending = '';
      try {
        await invoke('terminal_input', { terminalId, data: chunk });
      } catch (error) {
        console.error('[tauri] terminal_input failed:', error);
      }
    }
    target.isSending = false;
  })();
}

const terminalApi: Window['api'] = {
  createTerminalSession: (terminalId) =>
    invoke<void>('terminal_create', { terminalId }),
  destroyTerminalSession: (terminalId) =>
    invoke<void>('terminal_destroy', { terminalId }),
  reloadTerminalSession: (terminalId) =>
    invoke<void>('terminal_reload', { terminalId }),
  sendTerminalInput,
  onTerminalOutput: (callback) => {
    listenTerminalOutput();
    terminalOutputCallbacks.add(callback);
  },
  removeTerminalOutputListener: (callback) => {
    terminalOutputCallbacks.delete(callback);
  },
  resizeTerminal: (terminalId, cols, rows) =>
    send('terminal_resize', { terminalId, cols, rows }),
  readClipboardImage: () =>
    invoke<Awaited<ReturnType<Window['api']['readClipboardImage']>>>(
      'terminal_read_clipboard_image',
    ),
};

// ───────────────────────────────────────────────────────────
// window.electron
// ───────────────────────────────────────────────────────────

let latestBrowserSize: { width: number; height: number } | null = null;
let isBrowserSizeQueued = false;

/**
 * 表示領域の大きさを送る。分割線のドラッグ中は大量に届くため、キューには 1 件だけ積み、
 * 実行時点の最新値を送る。また init より先に届くと、起動直後の一時的な小さい幅が
 * 保存済みの幅を上書きし、init がその値を返してしまうため、init の完了を待ってから送る。
 */
function sendBrowserSize(size: { width: number; height: number }): void {
  latestBrowserSize = size;
  if (isBrowserSizeQueued) return;
  isBrowserSizeQueued = true;
  enqueue('set_browser_size', async () => {
    isBrowserSizeQueued = false;
    await getInitialSettings();
    await invoke('set_browser_size', { ...latestBrowserSize });
  });
}

const electronCompat: ElectronCompat = {
  sendBrowserSizeToMain: sendBrowserSize,
  sendBrowserTabIndexToMain: (index) => send('select_browser_tab', { index }),
  sendIsDarkModeToMain: (isDarkMode) => updateState({ isDarkMode }),
  sendEditorModeToMain: (editorMode) => updateState({ editorMode }),
  sendLanguageToMain: (language) => updateState({ language }),
  sendFontSizeToMain: (fontSize) => updateState({ fontSize }),
  sendTextToMain: sendText,
  sendLogsToMain: (logs) => send('set_logs', { logs }),
  getInitialSettings,
  openExternalLink: (url) => send('open_external_link', { url }),
  // テキスト送信直後の Enter と同じキューに積むので、送信スクリプトの後に届く
  sendKeyToView: (keyCode, modifiers) =>
    send('send_key_to_view', { keyCode, modifiers: modifiers ?? [] }),
  reloadCurrentView: () => send('reload_current_view'),
  reloadAllViews: () => send('reload_all_views'),
  onUpdateUrls: (callback) => {
    on<string[]>('update-urls', callback);
    // 購読前に届いた URL を取りこぼさないよう、現在値も一度渡す
    invoke<string[]>('current_urls')
      .then((urls) => {
        if (urls.length > 0) callback(urls);
      })
      .catch(() => {});
  },
  removeUpdateUrlsListener: () => removeAll('update-urls'),
  onUpdateLoadingStatus: (callback) => on('loading-status', callback),
  removeUpdateLoadingStatusListener: () => removeAll('loading-status'),
  sendEnabledBrowsersToMain: (enabledBrowsers) =>
    updateState({
      enabledBrowsers: Object.fromEntries(
        BROWSER_DEFINITIONS.map((browser, i) => [
          browser.id,
          enabledBrowsers[i],
        ]),
      ),
    }),
  sendEnabledTerminalsToMain: (enabledTerminals) =>
    updateState({
      enabledTerminals: Object.fromEntries(
        TERMINAL_DEFINITIONS.map((terminal, i) => [
          terminal.id,
          enabledTerminals[i],
        ]),
      ),
    }),
  saveTabOrders: (tabOrders) => updateState({ tabOrders }),
  saveSendTargets: (sendTargets) => updateState({ sendTargets }),
  saveBoilerplatesToMain: (boilerplates) => updateState({ boilerplates }),
  saveBoilerplateBankToMain: (boilerplateBank) =>
    updateState({ boilerplateBank }),
  // Tauri では UI の keyup が普通に届くため不要（Electron の before-input-event 対策だった）
  onModKeyUp: () => {},
  removeModKeyUpListener: () => {},
  onScriptError: (callback) => on('script-error', callback),
  removeScriptErrorListener: () => removeAll('script-error'),
  // tauri-plugin-updater で更新する（src-tauri/src/updater.rs）。
  // 取得先は latest.json の URL なので、Electron 版用の引数（インストーラと .sha256 の URL）は使わない。
  // ダウンロードは時間がかかるため、コマンドのキューには積まずに直接呼ぶ
  startUpdateDownload: () =>
    invoke<{ success: boolean; error?: string }>('update_download').catch(
      (error) => ({ success: false, error: String(error) }),
    ),
  cancelUpdateDownload: () => {
    void invoke('update_cancel');
  },
  onUpdateDownloadProgress: (callback) =>
    on('update:download-progress', callback),
  removeUpdateDownloadProgressListener: () =>
    removeAll('update:download-progress'),
};

/** 本番ビルドで F5 / Ctrl+R によるリロードを止める（Electron 版の before-input-event と同じ） */
function blockReloadShortcuts(): void {
  if (import.meta.env.DEV) return;
  window.addEventListener(
    'keydown',
    (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (e.key === 'F5' || (isMod && e.code === 'KeyR')) {
        e.preventDefault();
      }
    },
    true,
  );
}

export function installTauriCompat(): void {
  window.electron = electronCompat as unknown as Window['electron'];
  window.api = terminalApi;
  blockReloadShortcuts();
}
