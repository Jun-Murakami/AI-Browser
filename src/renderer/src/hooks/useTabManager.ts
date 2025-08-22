import { useCallback, useEffect, useState } from 'react';

import { BROWSERS } from '../constants/browsers';
import { TERMINALS } from '../constants/terminals';

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
  actions: TabActions;
}

// ブラウザタブを作成（Grokまでとそれ以降を分割）
const browserTabsBeforeTerminal: BrowserTab[] = BROWSERS.slice(0, 6).map(
  (browser, index) => ({
    ...browser,
    type: 'browser' as const,
    order: index,
  }),
);

const browserTabsAfterTerminal: BrowserTab[] = BROWSERS.slice(6).map(
  (browser, index) => ({
    ...browser,
    type: 'browser' as const,
    order: 6 + TERMINALS.length + index, // Grokまで(6) + ターミナル(3) + インデックス
  }),
);

// ターミナルタブを作成（Grokの後に配置）
const terminalTabs: TerminalTab[] = TERMINALS.map((terminal, index) => ({
  ...terminal,
  type: 'terminal' as const,
  order: 6 + index, // Grokの後（index 6）から開始
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

  // 初期化
  useEffect(() => {
    // 初期設定を取得
    window.electron.getInitialSettings().then((settings) => {
      // ブラウザの有効状態を設定
      const initialEnabledTabs = { ...settings.enabledBrowsers };

      // ターミナルタブのデフォルト有効状態を追加（保存されていない場合）
      TERMINALS.forEach((terminal) => {
        if (!(terminal.id in initialEnabledTabs)) {
          initialEnabledTabs[terminal.id] = true;
        }
      });

      setEnabledTabs(initialEnabledTabs);

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
        // ターミナルにメッセージを送信
        window.api.sendTerminalInput(tabId, `${message}\r\n`);
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
      newTabs.splice(oldIndex, 1);
      newTabs.splice(newOrder, 0, movingTab);

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

      // メインプロセスに通知（ブラウザタブの場合のみ）
      if (tab.type === 'browser') {
        // BROWSERS配列の順序でboolean配列を作成
        const enabledTabsArray = BROWSERS.map(
          (browser) => newEnabledTabs[browser.id] !== false,
        );
        window.electron.sendEnabledBrowsersToMain(enabledTabsArray);
      }

      // TODO: ターミナルタブの有効/無効状態も保存する
    },
    [tabsWithEnabled, enabledTabs],
  );

  const actions: TabActions = {
    selectTab,
    sendMessage,
    sendMessageToAll,
    reorderTab,
    toggleTabEnabled,
  };

  return {
    tabs: tabsWithEnabled,
    activeTabId,
    activeTab,
    isTerminalActive,
    visibleTabs,
    actions,
  };
}
