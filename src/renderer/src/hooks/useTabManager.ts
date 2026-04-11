import { useCallback, useEffect, useState } from 'react';

import { BROWSERS } from '../constants/browsers';
import { TERMINALS } from '../constants/terminals';
import { terminalService } from '../services/terminalService';
import { useBrowserLoadingStore } from '../stores/useBrowserLoadingStore';

import type {
  BrowserTab,
  Tab,
  TabActions,
  TerminalTab,
} from '../types/tab.types';

interface UseTabManagerReturn {
  tabs: Tab[];
  activeTabId: string | null;
  activeTab: Tab | null;
  isTerminalActive: boolean;
  visibleTabs: Tab[];
  sendTargets: Record<string, boolean>;
  actions: TabActions;
}

// ブラウザタブをグループで分割（primary: ターミナルの前, secondary: ターミナルの後）
const primaryBrowsers = BROWSERS.filter((b) => b.group === 'primary');
const secondaryBrowsers = BROWSERS.filter((b) => b.group === 'secondary');

const browserTabsBeforeTerminal: BrowserTab[] = primaryBrowsers.map(
  (browser, index) => ({
    ...browser,
    type: 'browser' as const,
    order: index,
  }),
);

const browserTabsAfterTerminal: BrowserTab[] = secondaryBrowsers.map(
  (browser, index) => ({
    ...browser,
    type: 'browser' as const,
    order: primaryBrowsers.length + TERMINALS.length + index,
  }),
);

// ターミナルタブを作成（primaryブラウザの後に配置）
const terminalTabs: TerminalTab[] = TERMINALS.map((terminal, index) => ({
  ...terminal,
  type: 'terminal' as const,
  order: primaryBrowsers.length + index,
}));

const allTabs = [
  ...browserTabsBeforeTerminal,
  ...terminalTabs,
  ...browserTabsAfterTerminal,
];

export function useTabManager(): UseTabManagerReturn {
  const [tabs, setTabs] = useState<Tab[]>(allTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [enabledTabs, setEnabledTabs] = useState<Record<string, boolean>>({});
  const [sendTargets, setSendTargets] = useState<Record<string, boolean>>({});
  const setBrowserLoading = useBrowserLoadingStore((s) => s.setBrowserLoading);

  // ローディング状態の監視（ストアに直接書き込み）
  useEffect(() => {
    const handleLoadingStatus = (status: {
      index: number;
      isLoading: boolean;
    }) => {
      const browser = BROWSERS[status.index];
      if (browser) {
        setBrowserLoading(browser.id, status.isLoading);
      }
    };
    window.electron.onUpdateLoadingStatus(handleLoadingStatus);
    return () => {
      window.electron.removeUpdateLoadingStatusListener();
    };
  }, [setBrowserLoading]);

  // 初期化
  useEffect(() => {
    // 初期設定を取得
    window.electron.getInitialSettings().then((settings) => {
      // ブラウザの有効状態を設定
      const initialEnabledTabs = { ...settings.enabledBrowsers };

      // ターミナルタブのデフォルト有効状態を追加（保存されていない場合）
      TERMINALS.forEach((terminal) => {
        // main から復元できる場合はそれを優先
        if (
          settings.enabledTerminals &&
          terminal.id in settings.enabledTerminals
        ) {
          initialEnabledTabs[terminal.id] =
            settings.enabledTerminals[terminal.id] !== false;
        } else if (!(terminal.id in initialEnabledTabs)) {
          // それ以外はデフォルト有効
          initialEnabledTabs[terminal.id] = true;
        }
      });

      setEnabledTabs(initialEnabledTabs);

      // 送信対象の初期化
      if (settings.sendTargets) {
        setSendTargets(settings.sendTargets);
      } else {
        // デフォルト: 全ブラウザタブを対象（NANIは除外）
        const defaultTargets = Object.fromEntries(
          BROWSERS.map((b) => [b.id, b.id !== 'NANI']),
        );
        setSendTargets(defaultTargets);
      }

      // 保存されたタブ順序があれば適用
      if (settings.tabOrders) {
        setTabs((prevTabs) => {
          const sortedTabs = [...prevTabs].sort((a, b) => {
            const orderA = settings.tabOrders?.[a.id] ?? a.order;
            const orderB = settings.tabOrders?.[b.id] ?? b.order;
            return orderA - orderB;
          });

          // orderプロパティを更新
          sortedTabs.forEach((tab, index) => {
            tab.order = index;
          });

          return sortedTabs;
        });
      }

      // 最初のタブを選択
      if (allTabs.length > 0) {
        setActiveTabId(allTabs[0].id);
      }
    });
  }, []);

  // タブにenabledプロパティを追加
  const tabsWithEnabled = tabs.map((tab) => ({
    ...tab,
    enabled: enabledTabs[tab.id] !== false,
  }));

  // アクティブなタブを取得
  const activeTab =
    tabsWithEnabled.find((tab) => tab.id === activeTabId) || null;
  const isTerminalActive = activeTab?.type === 'terminal';

  // 表示するタブをフィルタリング
  const visibleTabs = tabsWithEnabled
    .filter((tab) => enabledTabs[tab.id] !== false)
    .sort((a, b) => a.order - b.order);

  // タブを選択
  const selectTab = useCallback(
    (tabId: string) => {
      const tab = tabsWithEnabled.find((t) => t.id === tabId);
      if (!tab) return;

      setActiveTabId(tabId);

      if (tab.type === 'terminal') {
        // ターミナルが選択された場合、ブラウザビューを非表示
        window.electron.sendBrowserTabIndexToMain(-1);
      } else {
        // ブラウザタブが選択された場合、BROWSERS配列での元のインデックスを送信
        const browserIndex = BROWSERS.findIndex((b) => b.id === tabId);
        if (browserIndex !== -1) {
          window.electron.sendBrowserTabIndexToMain(browserIndex);
        }
      }
    },
    [tabsWithEnabled],
  );

  // メッセージを送信
  const sendMessage = useCallback(
    (tabId: string, message: string) => {
      const tab = tabsWithEnabled.find((t) => t.id === tabId);
      if (!tab) return;

      if (tab.type === 'terminal') {
        // ターミナルに貼り付けとして送信（bracketed paste対応）
        terminalService.pasteToTerminal(tabId, message);
      } else {
        // ブラウザにメッセージを送信
        window.electron.sendTextToMain(message, false);
      }
    },
    [tabsWithEnabled],
  );

  // 全てのブラウザタブにメッセージを送信（ターミナルは除外）
  const sendMessageToAll = useCallback((message: string) => {
    // ブラウザタブにのみ送信（ターミナルは除外）
    window.electron.sendTextToMain(message, true);
  }, []);

  // タブの順序を変更
  const reorderTab = useCallback((tabId: string, newOrder: number) => {
    setTabs((prevTabs) => {
      const newTabs = [...prevTabs];
      const movingTab = newTabs.find((t) => t.id === tabId);
      if (!movingTab) return prevTabs;

      // 現在のタブのインデックスを取得
      const oldIndex = newTabs.indexOf(movingTab);
      if (oldIndex === -1) return prevTabs;

      // タブを新しい位置に移動
      // まず移動対象のタブを配列から取り除く
      newTabs.splice(oldIndex, 1);

      // 右方向（oldIndex < newOrder）へ移動する場合、
      // 先に要素を取り除いたことで挿入位置が1つ左に詰まるため、
      // newOrder を 1 減算して補正する。
      const insertIndex = oldIndex < newOrder ? newOrder - 1 : newOrder;

      // 補正後の位置に挿入する
      newTabs.splice(insertIndex, 0, movingTab);

      // 全てのタブのorderを更新
      newTabs.forEach((tab, index) => {
        tab.order = index;
      });

      // タブ順序を保存
      const tabOrders = newTabs.reduce(
        (acc, tab) => {
          acc[tab.id] = tab.order;
          return acc;
        },
        {} as Record<string, number>,
      );

      window.electron.saveTabOrders(tabOrders);

      return newTabs;
    });
  }, []);

  // タブの有効/無効を切り替え
  const toggleTabEnabled = useCallback(
    (tabId: string) => {
      const tab = tabsWithEnabled.find((t) => t.id === tabId);
      if (!tab) return;

      // 新しい状態を計算: 現在が false(無効) なら true(有効) に、それ以外は false(無効) にする
      const newEnabledState = enabledTabs[tabId] === false;

      // 状態を更新
      const newEnabledTabs = {
        ...enabledTabs,
        [tabId]: newEnabledState,
      };
      setEnabledTabs(newEnabledTabs);

      // メインプロセスに通知
      if (tab.type === 'browser') {
        // BROWSERS配列の順序でboolean配列を作成
        const enabledTabsArray = BROWSERS.map(
          (browser) => newEnabledTabs[browser.id] !== false,
        );
        window.electron.sendEnabledBrowsersToMain(enabledTabsArray);
      } else if (tab.type === 'terminal') {
        // TERMINALS配列の順序でboolean配列を作成
        const enabledTerminalsArray = TERMINALS.map(
          (terminal) => newEnabledTabs[terminal.id] !== false,
        );
        window.electron.sendEnabledTerminalsToMain(enabledTerminalsArray);
      }
    },
    [tabsWithEnabled, enabledTabs],
  );

  // 送信対象の切り替え
  const toggleSendTarget = useCallback(
    (tabId: string) => {
      const newTargets = {
        ...sendTargets,
        [tabId]: !sendTargets[tabId],
      };
      setSendTargets(newTargets);
      window.electron.saveSendTargets(newTargets);
    },
    [sendTargets],
  );

  const actions: TabActions = {
    selectTab,
    sendMessage,
    sendMessageToAll,
    reorderTab,
    toggleTabEnabled,
    toggleSendTarget,
  };

  return {
    tabs: tabsWithEnabled,
    activeTabId,
    activeTab,
    isTerminalActive,
    visibleTabs,
    sendTargets,
    actions,
  };
}
