import { useRef, useEffect, useState, useMemo } from 'react';
import * as monaco from 'monaco-editor';
import { useWatchBoxHeight } from '../hooks/useWatchBoxHeight';

export interface LanguageInfo {
  id: string;
  extensions?: string[];
  aliases?: string[];
  mimetypes?: string[];
  filenames?: string[];
  firstLine?: string;
}

let _supportedLanguages: LanguageInfo[] | null = null;
export const getSupportedLanguages = (): LanguageInfo[] => {
  if (!_supportedLanguages) {
    _supportedLanguages = monaco.languages.getLanguages();
  }
  return _supportedLanguages;
};

export interface MonacoEditorProps {
  darkMode: boolean;
  language: string;
  fontSize: number;
  browserWidth?: number;
  browserHeight?: number;
  sendButtonRef: React.RefObject<HTMLButtonElement | null>;
  copyButtonRef: React.RefObject<HTMLButtonElement | null>;
  clearButtonRef: React.RefObject<HTMLButtonElement | null>;
  saveButtonRef: React.RefObject<HTMLButtonElement | null>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  setBrowserIndexTimestamp: (timestamp: number) => void;
  value?: string;
  onChange?: (value: string) => void;
  osInfo: string;
  placeholder?: string;
  ref?: React.Ref<monaco.editor.IStandaloneCodeEditor>;
}

export const MonacoEditor = ({
  darkMode,
  language,
  fontSize,
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
  ref,
}: MonacoEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isBoxReady = useWatchBoxHeight({ targetRef: editorRef });
  const [editorInstance, setEditorInstance] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const initialValue = useRef(value);
  const memoizedValue = useMemo(() => value, [value]);

  // refを通じてエディターインスタンスを親コンポーネントに渡す
  useEffect(() => {
    if (ref && typeof ref === 'function') {
      ref(editorInstance);
    } else if (ref && 'current' in ref) {
      ref.current = editorInstance;
    }
  }, [ref, editorInstance]);

  useEffect(() => {
    if (editorRef.current && isBoxReady) {
      const editor = monaco.editor.create(editorRef.current, {
        value: initialValue.current,
        language: language,
        theme: darkMode ? 'vs-dark' : 'light',
        minimap: { enabled: false },
        renderWhitespace: 'all',
        fontFamily: '"Migu 1M", Consolas, "Courier New", monospace',
        renderValidationDecorations: 'off',
        showUnused: false,
        scrollBeyondLastLine: false,
        renderLineHighlightOnlyWhenFocus: true,
        unicodeHighlight: {
          allowedLocales: { _os: true, _vscode: true },
          ambiguousCharacters: false,
        },
        wordWrap: 'on',
        occurrencesHighlight: 'off',
        placeholder: placeholder,
      });

      monaco.editor.remeasureFonts();

      setEditorInstance(editor);

      return () => {
        editor.dispose();
      };
    }
    return () => {};
  }, [darkMode, language, isBoxReady, placeholder]);

  // モデル変更のハンドラーを別のuseEffectで管理
  useEffect(() => {
    if (!editorInstance) return;

    const disposable = editorInstance.onDidChangeModelContent(() => {
      const newValue = editorInstance.getValue();
      if (onChange) {
        onChange(newValue);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [editorInstance, onChange]);

  // 外部からの値の変更を反映（初期値以外）
  useEffect(() => {
    if (
      editorInstance &&
      memoizedValue !== undefined &&
      memoizedValue !== editorInstance.getValue()
    ) {
      const position = editorInstance.getPosition();
      const selection = editorInstance.getSelection();
      editorInstance.setValue(memoizedValue);
      if (position) {
        editorInstance.setPosition(position);
      }
      if (selection) {
        editorInstance.setSelection(selection);
      }
    }
  }, [editorInstance, memoizedValue]);

  // コマンドの登録を別のuseEffectで行う
  useEffect(() => {
    if (!editorInstance) return;

    // キーバインディングの設定
    const disposables: monaco.IDisposable[] = [];

    const addCommand = (keybinding: number, handler: () => void) => {
      const command = editorInstance.addCommand(keybinding, handler);
      if (command && typeof command === 'object' && 'dispose' in command) {
        disposables.push(command as monaco.IDisposable);
      }
    };

    // Send command
    addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      sendButtonRef.current?.click();
    });

    // Save command
    addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveButtonRef.current?.click();
    });

    // Copy command
    addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC,
      () => {
        copyButtonRef.current?.click();
      },
    );

    // Clear command
    addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backspace, () => {
      clearButtonRef.current?.click();
    });

    // Tab switch command
    addCommand(
      osInfo === 'darwin'
        ? monaco.KeyMod.WinCtrl | monaco.KeyCode.Tab
        : monaco.KeyMod.CtrlCmd | monaco.KeyCode.Tab,
      () => {
        setBrowserIndexTimestamp(new Date().getTime());
      },
    );

    // Log navigation commands
    addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.UpArrow, () => {
      newerLogButtonRef.current?.click();
    });

    addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.DownArrow, () => {
      olderLogButtonRef.current?.click();
    });

    return () => {
      for (const disposable of disposables) {
        if (
          disposable &&
          typeof disposable === 'object' &&
          'dispose' in disposable
        ) {
          disposable.dispose();
        }
      }
    };
  }, [
    editorInstance,
    osInfo,
    sendButtonRef,
    saveButtonRef,
    copyButtonRef,
    clearButtonRef,
    newerLogButtonRef,
    olderLogButtonRef,
    setBrowserIndexTimestamp,
  ]);

  // ウィンドウのリサイズ時にエディターのレイアウトを更新
  useEffect(() => {
    if (
      editorRef.current &&
      isBoxReady &&
      editorInstance &&
      browserWidth &&
      browserHeight
    ) {
      editorInstance.updateOptions({ fontSize: fontSize });
      editorInstance.layout();
    }
  }, [isBoxReady, editorInstance, browserWidth, browserHeight, fontSize]);

  return <div ref={editorRef} style={{ width: '100%', height: '100%' }} />;
};
