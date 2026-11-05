// レンダラーと Rust（src-tauri）のやり取りをまとめたモジュール。
// - appBridge      : タブ・送信・設定・アップデートなど
// - terminalBridge : ターミナルとクリップボード画像
// Rust 側のコマンドは src-tauri/src/lib.rs の invoke_handler を参照。
// メソッド名は Electron 版の preload と揃えてある（Electron 版は v1.7.2 で終了）。

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { BROWSER_DEFINITIONS } from '../../../shared/constants/browsers';
import { TERMINAL_DEFINITIONS } from '../../../shared/constants/terminals';
import { BROWSER_SCRIPTS } from '../../../shared/scripts/browserScripts';

import type { UnlistenFn } from '@tauri-apps/api/event';

// ───────────────────────────────────────────────────────────
// 型
// ───────────────────────────────────────────────────────────

export type BoilerplateBank = 'A' | 'B' | 'C' | 'D' | 'E';

export interface LogEntry {
  id: number;
  text: string;
}

export interface InitialSettings {
  currentVersion: string;
  isDarkMode: boolean;
  editorMode: number;
  browserWidth: number;
  logs: LogEntry[];
  language: string;
  fontSize: number;
  /** Node の process.platform と同じ表記（win32 / darwin / linux） */
  osInfo: string;
  isAppImage: boolean;
  enabledBrowsers: Record<string, boolean>;
  enabledTerminals: Record<string, boolean>;
  tabOrders?: Record<string, number>;
  sendTargets?: Record<string, boolean>;
  boilerplates?: Record<string, string>;
  boilerplateBank?: BoilerplateBank;
}

export interface LoadingStatus {
  index: number;
  isLoading: boolean;
}

export interface ScriptError {
  browser: string;
  error: string;
}

export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface UpdateResult {
  success: boolean;
  error?: string;
}

export interface ClipboardImageResult {
  hasImage: boolean;
  filePath?: string;
  error?: string;
}

export type TerminalOutputCallback = (terminalId: string, data: string) => void;

// ───────────────────────────────────────────────────────────
// イベント購読（チャンネル単位でまとめて解除できるようにする）
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

// ───────────────────────────────────────────────────────────
// コマンドの送信
// Tauri の async コマンドは呼び出し順に実行されるとは限らない。タブ切替やサイズ変更が
// 前後すると表示がずれるため、戻り値を使わない呼び出しは 1 本のキューで順に実行する
// ───────────────────────────────────────────────────────────

let commandQueue: Promise<unknown> = Promise.resolve();

function enqueue(label: string, task: () => Promise<unknown>): void {
  commandQueue = commandQueue.then(task).catch((error) => {
    console.error(`[bridge] ${label} failed:`, error);
  });
}

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
// テキスト送信・表示領域
// ───────────────────────────────────────────────────────────

const scriptTemplates = BROWSER_SCRIPTS as Record<string, string>;

/**
 * 全サービス分の送信スクリプトを組み立てて Rust に渡す。送信先の判定は Rust 側で行う
 * （有効なタブのうち、一斉送信なら送信対象、単体送信なら表示中のタブ）。
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

// ───────────────────────────────────────────────────────────
// appBridge
// ───────────────────────────────────────────────────────────

export const appBridge = {
  getInitialSettings,
  sendBrowserSizeToMain: sendBrowserSize,
  /** BROWSERS 配列での位置。-1 はターミナルが選ばれたとき */
  sendBrowserTabIndexToMain: (index: number): void =>
    send('select_browser_tab', { index }),
  sendTextToMain: sendText,
  /** 表示中のタブにキーを送る。テキスト送信と同じキューなので、送信スクリプトの後に届く */
  sendKeyToView: (keyCode: string, modifiers: string[] = []): void =>
    send('send_key_to_view', { keyCode, modifiers }),
  reloadCurrentView: (): void => send('reload_current_view'),
  reloadAllViews: (): void => send('reload_all_views'),
  openExternalLink: (url: string): void => send('open_external_link', { url }),

  sendIsDarkModeToMain: (isDarkMode: boolean): void =>
    updateState({ isDarkMode }),
  sendEditorModeToMain: (editorMode: number): void =>
    updateState({ editorMode }),
  sendLanguageToMain: (language: string): void => updateState({ language }),
  sendFontSizeToMain: (fontSize: number): void => updateState({ fontSize }),
  sendLogsToMain: (logs: LogEntry[]): void => send('set_logs', { logs }),
  /** BROWSER_DEFINITIONS の順の有効/無効 */
  sendEnabledBrowsersToMain: (enabledBrowsers: boolean[]): void =>
    updateState({
      enabledBrowsers: Object.fromEntries(
        BROWSER_DEFINITIONS.map((browser, i) => [
          browser.id,
          enabledBrowsers[i],
        ]),
      ),
    }),
  /** TERMINAL_DEFINITIONS の順の有効/無効 */
  sendEnabledTerminalsToMain: (enabledTerminals: boolean[]): void =>
    updateState({
      enabledTerminals: Object.fromEntries(
        TERMINAL_DEFINITIONS.map((terminal, i) => [
          terminal.id,
          enabledTerminals[i],
        ]),
      ),
    }),
  saveTabOrders: (tabOrders: Record<string, number>): void =>
    updateState({ tabOrders }),
  saveSendTargets: (sendTargets: Record<string, boolean>): void =>
    updateState({ sendTargets }),
  saveBoilerplatesToMain: (boilerplates: Record<string, string>): void =>
    updateState({ boilerplates }),
  saveBoilerplateBankToMain: (boilerplateBank: BoilerplateBank): void =>
    updateState({ boilerplateBank }),

  onUpdateUrls: (callback: (urls: string[]) => void): void => {
    on<string[]>('update-urls', callback);
    // 購読前に届いた URL を取りこぼさないよう、現在値も一度渡す
    invoke<string[]>('current_urls')
      .then((urls) => {
        if (urls.length > 0) callback(urls);
      })
      .catch(() => {});
  },
  removeUpdateUrlsListener: (): void => removeAll('update-urls'),
  onUpdateLoadingStatus: (callback: (status: LoadingStatus) => void): void =>
    on('loading-status', callback),
  removeUpdateLoadingStatusListener: (): void => removeAll('loading-status'),
  onScriptError: (callback: (error: ScriptError) => void): void =>
    on('script-error', callback),
  removeScriptErrorListener: (): void => removeAll('script-error'),

  /**
   * アプリ内アップデート（src-tauri/src/updater.rs）。GitHub Releases の latest.json を読み、
   * 署名を検証してからインストールする。時間がかかるのでキューには積まずに直接呼ぶ
   */
  startUpdateDownload: (): Promise<UpdateResult> =>
    invoke<UpdateResult>('update_download').catch((error) => ({
      success: false,
      error: String(error),
    })),
  cancelUpdateDownload: (): void => {
    void invoke('update_cancel');
  },
  onUpdateDownloadProgress: (
    callback: (progress: DownloadProgress) => void,
  ): void => on('update:download-progress', callback),
  removeUpdateDownloadProgressListener: (): void =>
    removeAll('update:download-progress'),
};

// ───────────────────────────────────────────────────────────
// terminalBridge
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
        callback(event.payload.terminalId, event.payload.data);
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
        console.error('[bridge] terminal_input failed:', error);
      }
    }
    target.isSending = false;
  })();
}

export const terminalBridge = {
  createTerminalSession: (terminalId: string): Promise<void> =>
    invoke<void>('terminal_create', { terminalId }),
  destroyTerminalSession: (terminalId: string): Promise<void> =>
    invoke<void>('terminal_destroy', { terminalId }),
  reloadTerminalSession: (terminalId: string): Promise<void> =>
    invoke<void>('terminal_reload', { terminalId }),
  sendTerminalInput,
  onTerminalOutput: (callback: TerminalOutputCallback): void => {
    listenTerminalOutput();
    terminalOutputCallbacks.add(callback);
  },
  removeTerminalOutputListener: (callback: TerminalOutputCallback): void => {
    terminalOutputCallbacks.delete(callback);
  },
  resizeTerminal: (terminalId: string, cols: number, rows: number): void =>
    send('terminal_resize', { terminalId, cols, rows }),
  /** クリップボードの画像を PNG で一時保存してパスを返す */
  readClipboardImage: (): Promise<ClipboardImageResult> =>
    invoke<ClipboardImageResult>('terminal_read_clipboard_image'),
};

// ───────────────────────────────────────────────────────────
// 起動時の設定
// ───────────────────────────────────────────────────────────

/** 本番ビルドで F5 / Ctrl+R による UI のリロードを止める */
export function installReloadShortcutGuard(): void {
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
