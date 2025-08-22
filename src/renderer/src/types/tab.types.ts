import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';

// タブの基本インターフェース
export interface BaseTab {
  id: string;
  label: string;
  type: 'browser' | 'terminal';
  order: number; // 表示順序
  enabled?: boolean;
  icon?: string;
  IconComponent?: ComponentType<SvgIconProps> | null;
}

// ブラウザタブ
export interface BrowserTab extends BaseTab {
  type: 'browser';
  url: string;
  index: number;
}

// ターミナルタブ
export interface TerminalTab extends BaseTab {
  type: 'terminal';
}

// 統合タブ型
export type Tab = BrowserTab | TerminalTab;

// タブの設定
export interface TabConfig {
  tabs: Tab[];
  activeTabId: string | null;
}

// タブアクション
export interface TabActions {
  selectTab: (tabId: string) => void;
  sendMessage: (tabId: string, message: string) => void;
  sendMessageToAll: (message: string) => void;
  reorderTab: (tabId: string, newOrder: number) => void;
  toggleTabEnabled: (tabId: string) => void;
}
