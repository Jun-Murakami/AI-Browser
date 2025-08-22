import { useCallback, useState } from 'react';

interface UseEditorValuesReturn {
  editorValues: string[];
  setEditorValue: (index: number, value: string) => void;
  getEditorValue: (index: number) => string;
  getCombinedValue: (editorCount: number) => string;
  setAllValues: (values: string[]) => void;
  clearAllValues: () => void;
  setValuesFromLog: (logText: string, editorCount: number) => void;
}

export function useEditorValues(): UseEditorValuesReturn {
  const [editorValues, setEditorValues] = useState<string[]>([
    '',
    '',
    '',
    '',
    '',
  ]);

  // 個別のエディタ値を設定
  const setEditorValue = useCallback((index: number, value: string) => {
    setEditorValues((prev) => {
      const newValues = [...prev];
      newValues[index] = value;
      return newValues;
    });
  }, []);

  // 個別のエディタ値を取得
  const getEditorValue = useCallback(
    (index: number) => {
      return editorValues[index] || '';
    },
    [editorValues],
  );

  // 複数エディタの値を結合して取得
  const getCombinedValue = useCallback(
    (editorCount: number) => {
      const divider = '\n----\n';
      const values = editorValues.slice(0, editorCount + 1);

      // 空白のある行があればディバイダーごと削除
      const combinedValue = values
        .filter((value) => value.trim() !== '')
        .join(divider);

      return combinedValue;
    },
    [editorValues],
  );

  // 全ての値を設定
  const setAllValues = useCallback((values: string[]) => {
    setEditorValues(values.concat(['', '', '', '', '']).slice(0, 5));
  }, []);

  // 全ての値をクリア
  const clearAllValues = useCallback(() => {
    setEditorValues(['', '', '', '', '']);
  }, []);

  // ログから値を設定
  const setValuesFromLog = useCallback(
    (logText: string, editorCount: number) => {
      const parts = logText.split('\n----\n');
      const newValues = ['', '', '', '', ''];

      for (let i = 0; i <= editorCount; i++) {
        if (i === editorCount) {
          // 最後のエディターには残りのすべての部分を結合して設定
          newValues[i] = parts.slice(i).join('\n----\n') || '';
        } else {
          // それ以外のエディターには対応する部分を設定
          newValues[i] = parts[i] || '';
        }
      }

      setEditorValues(newValues);
    },
    [],
  );

  return {
    editorValues,
    setEditorValue,
    getEditorValue,
    getCombinedValue,
    setAllValues,
    clearAllValues,
    setValuesFromLog,
  };
}
