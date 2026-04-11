import { create } from 'zustand';

interface EditorState {
  /** 5つのエディタの値 */
  editorValues: string[];

  /** 個別のエディタ値を設定 */
  setEditorValue: (index: number, value: string) => void;

  /** 個別のエディタ値を取得（セレクタ用ではなく、コールバック内での使用向け） */
  getEditorValue: (index: number) => string;

  /** 複数エディタの値を結合して取得 */
  getCombinedValue: (editorCount: number) => string;

  /** 全ての値を設定 */
  setAllValues: (values: string[]) => void;

  /** 全ての値をクリア（新しい値配列を返す） */
  clearAllValues: () => string[];

  /** ログから値を設定（新しい値配列を返す） */
  setValuesFromLog: (logText: string, editorCount: number) => string[];
}

const EMPTY_VALUES = ['', '', '', '', ''];

export const useEditorStore = create<EditorState>((set, get) => ({
  editorValues: [...EMPTY_VALUES],

  setEditorValue: (index, value) => {
    set((state) => {
      if (state.editorValues[index] === value) return state;
      const newValues = [...state.editorValues];
      newValues[index] = value;
      return { editorValues: newValues };
    });
  },

  getEditorValue: (index) => {
    return get().editorValues[index] || '';
  },

  getCombinedValue: (editorCount) => {
    const divider = '\n----\n';
    const values = get().editorValues.slice(0, editorCount + 1);
    return values.filter((value) => value.trim() !== '').join(divider);
  },

  setAllValues: (values) => {
    set({ editorValues: values.concat(['', '', '', '', '']).slice(0, 5) });
  },

  clearAllValues: () => {
    const newValues = [...EMPTY_VALUES];
    set({ editorValues: newValues });
    return newValues;
  },

  setValuesFromLog: (logText, editorCount) => {
    const parts = logText.split('\n----\n');
    const newValues = [...EMPTY_VALUES];

    for (let i = 0; i <= editorCount; i++) {
      if (i === editorCount) {
        newValues[i] = parts.slice(i).join('\n----\n') || '';
      } else {
        newValues[i] = parts[i] || '';
      }
    }

    set({ editorValues: newValues });
    return newValues;
  },
}));
