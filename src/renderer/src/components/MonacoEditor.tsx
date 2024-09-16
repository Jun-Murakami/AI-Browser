import { forwardRef, useRef, useEffect, useState, useMemo, useImperativeHandle } from 'react';
import * as monaco from 'monaco-editor';
import { useWatchBoxHeight } from '../utils/useWatchBoxHeight';

export interface MonacoEditorProps {
  darkMode: boolean;
  language: string;
  fontSize: number;
  editorIndex: number;
  browserWidth?: number;
  browserHeight?: number;
  sendButtonRef: React.RefObject<HTMLButtonElement>;
  copyButtonRef: React.RefObject<HTMLButtonElement>;
  clearButtonRef: React.RefObject<HTMLButtonElement>;
  saveButtonRef: React.RefObject<HTMLButtonElement>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement>;
  setBrowserIndexTimestamp: (timestamp: number) => void;
  value?: string;
  onChange?: (value: string) => void;
  osInfo: string;
  placeholder?: string;
}

export const MonacoEditor = forwardRef<monaco.editor.IStandaloneCodeEditor, MonacoEditorProps>(
  (
    {
      darkMode,
      language,
      fontSize,
      editorIndex,
      browserWidth,
      browserHeight,
      sendButtonRef,
      copyButtonRef,
      clearButtonRef,
      saveButtonRef,
      newerLogButtonRef,
      olderLogButtonRef,
      setBrowserIndexTimestamp,
      value,
      onChange,
      osInfo,
      placeholder,
    },
    ref
  ) => {
    const editorRef = useRef(null);
    const isBoxReady = useWatchBoxHeight(editorRef);
    const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
    // メモ化された値を使ってプロップスの変更を検知
    const memoizedValue = useMemo(() => value, [value]);

    useImperativeHandle(ref, () => editorInstance!, [editorInstance]);

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
          occurrencesHighlight: 'off',
          placeholder: placeholder,
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

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          saveButtonRef.current?.focus();
          saveButtonRef.current?.click();
          setTimeout(() => {
            saveButtonRef.current?.blur();
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

        if (osInfo === 'darwin') {
          editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.Tab, () => {
            setBrowserIndexTimestamp(new Date().getTime());
          });
        } else {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Tab, () => {
            setBrowserIndexTimestamp(new Date().getTime());
          });
        }

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
      if (editorRef.current && isBoxReady && editorInstance && browserWidth && browserHeight) {
        editorInstance.updateOptions({ fontSize: fontSize });
        editorInstance.layout();
      }
    }, [editorRef, isBoxReady, editorInstance, browserWidth, browserHeight, fontSize]);

    return <div ref={editorRef} style={{ width: '100%', height: '100%' }} />;
  }
);
