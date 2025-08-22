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

// ブラウザタブを作成
const browserTabs: BrowserTab[] = BROWSERS.map((browser, index) => ({
  ...browser,
  type: 'browser' as const,
  order: index,
}));

// ターミナルタブを作成
const terminalTabs: TerminalTab[] = TERMINALS.map((terminal, index) => ({
  ...terminal,
  type: 'terminal' as const,
  order: BROWSERS.length + index,
  enabled: true, // ターミナルは常に有効
}));

const allTabs = [...browserTabs, ...terminalTabs];

export function useTabManager(): UseTabManagerReturn {
  const [tabs, setTabs] = useState<Tab[]>(allTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [enabledBrowsers, setEnabledBrowsers] = useState<
    Record<string, boolean>
  >({});

  // 初期化
  useEffect(() => {
    // 初期設定を取得
    window.electron.getInitialSettings().then((settings) => {
      setEnabledBrowsers(settings.enabledBrowsers);
      // 最初のタブを選択
      if (allTabs.length > 0) {
        setActiveTabId(allTabs[0].id);
      }
    });
  }, []);

  // アクティブなタブを取得
  const activeTab = tabs.find((tab) => tab.id === activeTabId) || null;
  const isTerminalActive = activeTab?.type === 'terminal';

  // 表示するタブをフィルタリング
  const visibleTabs = tabs
    .filter((tab) => {
      if (tab.type === 'browser') {
        return enabledBrowsers[tab.id] !== false;
      }
      return true; // ターミナルは常に表示
    })
    .sort((a, b) => a.order - b.order);

  // タブを選択
  const selectTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      setActiveTabId(tabId);

      if (tab.type === 'terminal') {
        // ターミナルが選択された場合、ブラウザビューを非表示
        window.electron.sendBrowserTabIndexToMain(-1);
      } else {
        // ブラウザタブが選択された場合
        const browserIndex = BROWSERS.findIndex((b) => b.id === tabId);
        if (browserIndex !== -1) {
          window.electron.sendBrowserTabIndexToMain(browserIndex);
        }
      }
    },
    [tabs],
  );

  // メッセージを送信
  const sendMessage = useCallback(
    (tabId: string, message: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      if (tab.type === 'terminal') {
        // ターミナルにメッセージを送信
        window.api.sendTerminalInput(tabId, message + '\r\n');
      } else {
        // ブラウザにメッセージを送信
        window.electron.sendTextToMain(message, false);
      }
    },
    [tabs],
  );

  // 全てのブラウザタブにメッセージを送信（ターミナルは除外）
  const sendMessageToAll = useCallback(
    (message: string) => {
      // ブラウザタブにのみ送信（ターミナルは除外）
      window.electron.sendTextToMain(message, true);
    },
    [],
  );

  // タブの順序を変更
  const reorderTab = useCallback((tabId: string, newOrder: number) => {
    setTabs((prevTabs) => {
      const newTabs = [...prevTabs];
      const tabIndex = newTabs.findIndex((t) => t.id === tabId);
      if (tabIndex === -1) return prevTabs;

      const [movedTab] = newTabs.splice(tabIndex, 1);
      movedTab.order = newOrder;

      // 他のタブの順序を調整
      newTabs.forEach((tab, index) => {
        if (tab.order >= newOrder) {
          tab.order = index + 1;
        }
      });

      newTabs.splice(newOrder, 0, movedTab);
      return newTabs;
    });
  }, []);

  // タブの有効/無効を切り替え
  const toggleTabEnabled = useCallback(
    (tabId: string) => {
      if (tabs.find((t) => t.id === tabId)?.type === 'browser') {
        setEnabledBrowsers((prev) => ({
          ...prev,
          [tabId]: !prev[tabId],
        }));
        // メインプロセスに通知
        // enabledBrowsersをboolean配列に変換
        const enabledBrowsersArray = Object.values(enabledBrowsers);
        enabledBrowsersArray[tabs.findIndex((t) => t.id === tabId)] =
          !enabledBrowsers[tabId];
        window.electron.sendEnabledBrowsersToMain(enabledBrowsersArray);
      }
    },
    [tabs, enabledBrowsers],
  );

  const actions: TabActions = {
    selectTab,
    sendMessage,
    sendMessageToAll,
    reorderTab,
    toggleTabEnabled,
  };

  return {
    tabs,
    activeTabId,
    activeTab,
    isTerminalActive,
    visibleTabs,
    actions,
  };
}
