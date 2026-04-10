import { useEffect, useImperativeHandle, useRef } from 'react';
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

/** 親コンポーネントから命令的にエディタを操作するためのハンドル */
export interface MonacoEditorHandle {
  /** darkMode / language / fontSize をエディタに反映 */
  syncSettings: (settings: {
    darkMode: boolean;
    language: string;
    fontSize: number;
  }) => void;
  /** 外部から値を設定（カーソル位置を保持） */
  setValue: (value: string) => void;
  getValue: () => string;
  /** エディタのレイアウトを再計算 */
  layout: () => void;
  /** 生の monaco エディタインスタンスを取得 */
  getEditor: () => monaco.editor.IStandaloneCodeEditor | null;
}

export interface MonacoEditorProps {
  darkMode: boolean;
  language: string;
  fontSize: number;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  sendButtonRef: React.RefObject<HTMLButtonElement | null>;
  copyButtonRef: React.RefObject<HTMLButtonElement | null>;
  clearButtonRef: React.RefObject<HTMLButtonElement | null>;
  saveButtonRef: React.RefObject<HTMLButtonElement | null>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  lastFocusedEditorRef?: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>;
  isTerminalActive?: boolean;
  osInfo?: string;
  ref?: React.Ref<MonacoEditorHandle>;
}

export const MonacoEditor = ({
  darkMode,
  language,
  fontSize,
  placeholder,
  value,
  onChange,
  sendButtonRef,
  copyButtonRef,
  clearButtonRef,
  saveButtonRef,
  newerLogButtonRef,
  olderLogButtonRef,
  lastFocusedEditorRef,
  isTerminalActive,
  osInfo,
  ref,
}: MonacoEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const isBoxReady = useWatchBoxHeight({ targetRef: containerRef });

  // 最新の props を ref 経由で参照（エフェクトの依存配列を安定化）
  const propsRef = useRef({
    darkMode,
    language,
    fontSize,
    value,
    onChange,
    isTerminalActive,
    osInfo,
    lastFocusedEditorRef,
    sendButtonRef,
    copyButtonRef,
    clearButtonRef,
    saveButtonRef,
    newerLogButtonRef,
    olderLogButtonRef,
  });
  propsRef.current = {
    darkMode,
    language,
    fontSize,
    value,
    onChange,
    isTerminalActive,
    osInfo,
    lastFocusedEditorRef,
    sendButtonRef,
    copyButtonRef,
    clearButtonRef,
    saveButtonRef,
    newerLogButtonRef,
    olderLogButtonRef,
  };

  // 親コンポーネントに命令的ハンドルを公開
  useImperativeHandle(ref, () => ({
    syncSettings: ({ darkMode, language, fontSize }) => {
      const editor = editorRef.current;
      if (!editor) return;
      monaco.editor.setTheme(darkMode ? 'vs-dark' : 'light');
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, language);
      editor.updateOptions({ fontSize });
    },
    setValue: (value: string) => {
      const editor = editorRef.current;
      if (!editor || value === editor.getValue()) return;
      const position = editor.getPosition();
      const selection = editor.getSelection();
      editor.setValue(value);
      if (position) editor.setPosition(position);
      if (selection) editor.setSelection(selection);
    },
    getValue: () => editorRef.current?.getValue() ?? '',
    layout: () => editorRef.current?.layout(),
    getEditor: () => editorRef.current,
  }));

  // エディタ作成 + コマンド登録 + イベントリスナー（一括セットアップ）
  useEffect(() => {
    if (!containerRef.current || !isBoxReady) return;

    const { darkMode, language, fontSize, value } = propsRef.current;
    const editor = monaco.editor.create(containerRef.current, {
      value: value ?? '',
      language,
      theme: darkMode ? 'vs-dark' : 'light',
      fontSize,
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
      placeholder,
    });

    monaco.editor.remeasureFonts();
    editorRef.current = editor;

    // --- イベントリスナー ---
    const disposables: monaco.IDisposable[] = [];

    disposables.push(
      editor.onDidChangeModelContent(() => {
        propsRef.current.onChange?.(editor.getValue());
      }),
    );

    disposables.push(
      editor.onDidFocusEditorText(() => {
        const focusRef = propsRef.current.lastFocusedEditorRef;
        if (focusRef) focusRef.current = editor;
      }),
    );

    // --- コマンド（propsRef 経由で最新のボタン ref を参照）---
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      propsRef.current.sendButtonRef.current?.click(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      propsRef.current.saveButtonRef.current?.click(),
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC,
      () => propsRef.current.copyButtonRef.current?.click(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backspace, () =>
      propsRef.current.clearButtonRef.current?.click(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.UpArrow, () =>
      propsRef.current.newerLogButtonRef.current?.click(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.DownArrow, () =>
      propsRef.current.olderLogButtonRef.current?.click(),
    );

    // --- クリップボード画像ペースト（Windows + ターミナルモード）---
    const container = editor.getDomNode();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !propsRef.current.isTerminalActive ||
        propsRef.current.osInfo !== 'win32'
      )
        return;
      const isPaste =
        e.key === 'v' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
      if (!isPaste) return;

      e.preventDefault();
      e.stopPropagation();

      (async () => {
        try {
          const result = await window.api.readClipboardImage();
          if (result.hasImage && result.filePath) {
            const sel = editor.getSelection();
            if (sel)
              editor.executeEdits('clipboard-image', [
                { range: sel, text: result.filePath },
              ]);
            return;
          }
        } catch {
          // テキストペーストにフォールバック
        }
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            const sel = editor.getSelection();
            if (sel)
              editor.executeEdits('clipboard-paste', [{ range: sel, text }]);
          }
        } catch {
          // 無視
        }
      })();
    };

    container?.addEventListener('keydown', handleKeyDown, true);

    return () => {
      container?.removeEventListener('keydown', handleKeyDown, true);
      for (const d of disposables) d.dispose();
      editor.dispose();
      editorRef.current = null;
    };
  }, [isBoxReady, placeholder]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};
