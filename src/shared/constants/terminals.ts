// 共通のターミナル定義
export interface TerminalDefinition {
  id: string;
  label: string;
  index: number;
}

export const TERMINAL_DEFINITIONS: TerminalDefinition[] = [
  { id: 'TERMINAL_1', label: 'Terminal1', index: 10 },
  { id: 'TERMINAL_2', label: 'Terminal2', index: 11 },
  { id: 'TERMINAL_3', label: 'Terminal3', index: 12 },
];
