import { BROWSER_DEFINITIONS } from '../../../shared/constants/browsers';
import {
  AIStudioIcon,
  ChatGPTIcon,
  ClaudeIcon,
  DeepSeekIcon,
  GeminiIcon,
  GensparkIcon,
  GrokIcon,
  KimiIcon,
  NaniIcon,
  PerplexityIcon,
  SakanaIcon,
} from '../components/Icons';

import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';

// アイコンコンポーネントのマッピング
const BROWSER_ICON_COMPONENTS: Record<string, ComponentType<SvgIconProps>> = {
  CHATGPT: ChatGPTIcon,
  GEMINI: GeminiIcon,
  AISTUDIO: AIStudioIcon,
  CLAUDE: ClaudeIcon,
  DEEPSEEK: DeepSeekIcon,
  GROK: GrokIcon,
  NANI: NaniIcon,
  KIMI: KimiIcon,
  SAKANA: SakanaIcon,
  PERPLEXITY: PerplexityIcon,
  GENSPARK: GensparkIcon,
};

// 共通定義にアイコンコンポーネントを追加（ラベルはそのまま使用）
export const BROWSERS = BROWSER_DEFINITIONS.map((def) => ({
  ...def,
  IconComponent: BROWSER_ICON_COMPONENTS[def.id] || null,
}));
