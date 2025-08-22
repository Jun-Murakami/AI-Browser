import { TERMINAL_DEFINITIONS } from '../../shared/constants/terminals';
import type { Terminal } from '../types/interfaces';

// 共通定義にtype追加してTerminal型に変換
export const TERMINALS: Terminal[] = TERMINAL_DEFINITIONS.map((def) => ({
  ...def,
  type: 'terminal' as const,
}));

export const TERMINAL_COUNT = TERMINALS.length;
