import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';

import { BROWSERS } from '../../constants/browsers';
import { ContentArea } from './ContentArea';
import { TabBar } from './TabBar';
import { UrlBar } from './UrlBar';

import type { Tab } from '../../types/tab.types';

interface BrowserViewProps {
  tabs: Tab[];
  activeTabId: string | null;
  isTerminalActive: boolean;
  visibleTabs: Tab[];
  isInitialized: boolean;
  onTabChange: (tabId: string) => void;
  onToggleTabEnabled: (tabId: string) => void;
  onTabReorder: (tabId: string, newOrder: number) => void;
  isDarkMode?: boolean;
}

export const BrowserView = forwardRef<HTMLDivElement, BrowserViewProps>(
  (
    {
      tabs,
      activeTabId,
      isTerminalActive,
      visibleTabs,
      isInitialized,
      onTabChange,
      onToggleTabEnabled,
      onTabReorder,
      isDarkMode = true,
    },
    ref,
  ) => {
    const [browserUrls, setBrowserUrls] = useState<string[]>([]);
    const [browserLoadings, setBrowserLoadings] = useState<boolean[]>([]);
    const [isEditingBrowserShow, setIsEditingBrowserShow] = useState(false);

    // 現在のブラウザURLまたはターミナル名
    const currentBrowserUrl = useMemo(() => {
      const activeTab = visibleTabs.find((tab) => tab.id === activeTabId);
      if (!activeTab) return '';

      // ターミナルタブの場合はターミナル名を表示
      if (activeTab.type === 'terminal') {
        return activeTab.label;
      }

      // ブラウザタブの場合はURLを表示
      const browserIndex = BROWSERS.findIndex((b) => b.id === activeTab.id);
      return browserUrls[browserIndex] || '';
    }, [browserUrls, visibleTabs, activeTabId]);

    // タブが切り替わったときの処理
    const handleBrowserTabChange = useCallback(
      (_: React.SyntheticEvent, newValue: number) => {
        const tab = visibleTabs[newValue];
        if (tab) {
          onTabChange(tab.id);
        }
      },
      [visibleTabs, onTabChange],
    );

    // 編集モードの切り替え
    const handleToggleEditMode = useCallback(() => {
      setIsEditingBrowserShow(!isEditingBrowserShow);
    }, [isEditingBrowserShow]);

    // ブラウザのURLとローディング状態を監視
    useEffect(() => {
      // ローディング状態を監視
      window.electron.onUpdateLoadingStatus((status) => {
        setBrowserLoadings((prev) => {
          const newLoadings = [...prev];
          newLoadings[status.index] = status.isLoading;
          return newLoadings;
        });
      });

      // ブラウザのURLを監視
      window.electron.onUpdateUrls((newUrls) => {
        setBrowserUrls(newUrls);
      });

      // クリーンアップ
      return () => {
        window.electron.removeUpdateUrlsListener();
        window.electron.removeUpdateLoadingStatusListener();
      };
    }, []);

    return (
      <Box sx={{ height: '100%' }}>
        <TabBar
          isInitialized={isInitialized}
          visibleTabs={
            isEditingBrowserShow
              ? [...tabs].sort((a, b) => a.order - b.order)
              : visibleTabs
          }
          activeTabId={activeTabId}
          isEditingBrowserShow={isEditingBrowserShow}
          browserLoadings={browserLoadings}
          onTabChange={handleBrowserTabChange}
          onToggleEditMode={handleToggleEditMode}
          onToggleTabEnabled={onToggleTabEnabled}
          onTabReorder={onTabReorder}
        />

        <UrlBar
          browserUrl={currentBrowserUrl}
          isTerminalActive={isTerminalActive}
        />

        <ContentArea
          ref={ref}
          isTerminalActive={isTerminalActive}
          activeTabId={activeTabId}
          tabs={tabs}
          isDarkMode={isDarkMode}
        />
      </Box>
    );
  },
);

BrowserView.displayName = 'BrowserView';
