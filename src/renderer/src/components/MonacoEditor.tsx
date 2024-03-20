import { useRef, useEffect, useState, useMemo } from 'react';
import { Box } from '@mui/material';
import * as monaco from 'monaco-editor';
import { useWatchBoxHeight } from '../utils/useWatchBoxHeight';

export interface MonacoEditorProps {
  darkMode: boolean;
  language: string;
  editorIndex: number;
  sendButtonRef: React.RefObject<HTMLButtonElement>;
  copyButtonRef: React.RefObject<HTMLButtonElement>;
  clearButtonRef: React.RefObject<HTMLButtonElement>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement>;
  setBrowserIndexTimestamp: (timestamp: number) => void;
  value?: string;
  onChange?: (value: string) => void;
}

export const MonacoEditor = ({
  darkMode,
  language,
  editorIndex,
  sendButtonRef,
  copyButtonRef,
  clearButtonRef,
  newerLogButtonRef,
  olderLogButtonRef,
  setBrowserIndexTimestamp,
  value,
  onChange,
}: MonacoEditorProps) => {
  const editorRef = useRef(null);
  const isBoxReady = useWatchBoxHeight(editorRef);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  // メモ化された値を使ってプロップスの変更を検知
  const memoizedValue = useMemo(() => value, [value]);

  useEffect(() => {
    if (editorRef.current && isBoxReady) {
      const editor = monaco.editor.create(editorRef.current, {
        value: memoizedValue, // メモ化された値を初期値として設定
        language: language,
        theme: darkMode ? 'vs-dark' : 'light',
        minimap: { enabled: false },
        renderWhitespace: 'all',
        fontFamily: '"Migu 1M", Consolas, "Courier New", monospace',
        renderValidationDecorations: 'off',
        showUnused: false,
        scrollBeyondLastLine: false,
        renderLineHighlightOnlyWhenFocus: true,
        unicodeHighlight: { allowedLocales: { _os: true, _vscode: true }, ambiguousCharacters: false },
        wordWrap: 'on',
      });

      monaco.editor.remeasureFonts();

      // キーバインディングの設定
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        sendButtonRef.current?.focus();
        setTimeout(() => {
          sendButtonRef.current?.click();
        }, 100);
        setTimeout(() => {
          sendButtonRef.current?.blur();
        }, 500);
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC, () => {
        copyButtonRef.current?.focus();
        copyButtonRef.current?.click();
        setTimeout(() => {
          copyButtonRef.current?.blur();
        }, 500);
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backspace, () => {
        clearButtonRef.current?.focus();
        clearButtonRef.current?.click();
        setTimeout(() => {
          clearButtonRef.current?.blur();
        }, 500);
      });

      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Tab, () => {
        setBrowserIndexTimestamp(new Date().getTime());
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.UpArrow, () => {
        newerLogButtonRef.current?.click();
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.DownArrow, () => {
        olderLogButtonRef.current?.click();
      });

      // エディターの値が変更されたときのハンドラ
      editor.onDidChangeModelContent(() => {
        const newValue = editor.getValue();
        if (onChange) {
          onChange(newValue);
        }
      });

      setEditorInstance(editor); // エディターのインスタンスを保持

      // コンポーネントがアンマウントされる際にエディターを破棄
      return () => {
        editor.dispose();
      };
    }
    return () => {};
  }, [darkMode, language, editorIndex, isBoxReady]);

  // プロップスが変更された時のみエディターの値を更新する
  useEffect(() => {
    if (editorInstance && memoizedValue !== undefined && memoizedValue !== editorInstance.getValue()) {
      editorInstance.setValue(memoizedValue);
    }
  }, [editorInstance, memoizedValue]);

  // ウィンドウのリサイズ時にエディターのレイアウトを更新
  useEffect(() => {
    if (editorRef.current && isBoxReady && editorInstance) {
      const handleResize = () => {
        editorInstance.layout();
      };

      window.addEventListener('resize', handleResize);

      // クリーンアップ関数でイベントリスナーを削除
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
    return () => {};
  }, [editorRef, isBoxReady, editorInstance]);

  return <Box ref={editorRef} sx={{ width: '100%', height: '100%' }} />;
};
