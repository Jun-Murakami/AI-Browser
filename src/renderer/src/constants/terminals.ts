import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';
import { TERMINAL_DEFINITIONS } from '../../../shared/constants/terminals';
import { TerminalIcon } from '../components/Icons';

// 共通定義にアイコンコンポーネントを追加
export const TERMINALS = TERMINAL_DEFINITIONS.map((def) => ({
  ...def,
  IconComponent: TerminalIcon as ComponentType<SvgIconProps>,
}));