import { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import * as monaco from 'monaco-editor';

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

  useEffect(() => {
    if (editorRef.current) {
      const editor = monaco.editor.create(editorRef.current, {
        value: value,
        language: language,
        theme: darkMode ? 'vs-dark' : 'light',
        minimap: { enabled: false },
        renderWhitespace: 'all',
        fontFamily: '"Migu 1M", Consolas, "Courier New", monospace',
        renderValidationDecorations: 'off',
        showUnused: false,
        scrollBeyondLastLine: false,
        renderLineHighlightOnlyWhenFocus: true,
        unicodeHighlight: { allowedLocales: { _os: true, _vscode: true } },
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

      // コンポーネントがアンマウントされる際にエディターを破棄
      return () => {
        editor.dispose();
      };
    }
    return () => {};
  }, [darkMode, language, editorIndex]);

  return <Box ref={editorRef} sx={{ width: '100%', height: '100%' }} />;
};
