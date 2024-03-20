import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import Editor, { useMonaco, EditorProps } from '@monaco-editor/react';
import { Box } from '@mui/system';

interface MonacoEditorsProps {
  darkMode: boolean;
  language: string;
  editorIndex: number;
  sendButtonRef: React.RefObject<HTMLButtonElement>;
  copyButtonRef: React.RefObject<HTMLButtonElement>;
  clearButtonRef: React.RefObject<HTMLButtonElement>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement>;
  editor1Value: string;
  editor2Value: string;
  editor3Value: string;
  editor4Value: string;
  editor5Value: string;
  setEditor1Value: (value: string) => void;
  setEditor2Value: (value: string) => void;
  setEditor3Value: (value: string) => void;
  setEditor4Value: (value: string) => void;
  setEditor5Value: (value: string) => void;
  setBrowserIndexTimestamp: (timestamp: number) => void;
}

export const MonacoEditors = ({
  darkMode,
  language,
  editorIndex,
  sendButtonRef,
  copyButtonRef,
  clearButtonRef,
  newerLogButtonRef,
  olderLogButtonRef,
  editor1Value,
  editor2Value,
  editor3Value,
  editor4Value,
  editor5Value,
  setEditor1Value,
  setEditor2Value,
  setEditor3Value,
  setEditor4Value,
  setEditor5Value,
  setBrowserIndexTimestamp,
}: MonacoEditorsProps) => {
  const editorProps: EditorProps = {
    height: '100%',
    theme: darkMode ? 'vs-dark' : 'light',
    language,
    options: {
      minimap: { enabled: false },
      renderWhitespace: 'all',
      fontFamily: '"Migu 1M", Consolas, "Courier New", monospace',
      renderValidationDecorations: 'off',
      showUnused: false,
      scrollBeyondLastLine: false,
      renderLineHighlightOnlyWhenFocus: true,
      unicodeHighlight: { allowedLocales: { _os: true, _vscode: true } },
      wordWrap: 'on',
    },
  };

  const monaco = useMonaco();
  monaco?.editor.remeasureFonts();

  function handleEditorMount(editor, monaco) {
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
  }

  const handleEditor1Change = (value: string | undefined) => {
    setEditor1Value(value ?? '');
  };

  const handleEditor2Change = (value: string | undefined) => {
    setEditor2Value(value ?? '');
  };

  const handleEditor3Change = (value: string | undefined) => {
    setEditor3Value(value ?? '');
  };

  const handleEditor4Change = (value: string | undefined) => {
    setEditor4Value(value ?? '');
  };

  const handleEditor5Change = (value: string | undefined) => {
    setEditor5Value(value ?? '');
  };

  return (
    <>
      <Box sx={{ height: 'calc(100% - 156px)' }} hidden={editorIndex !== 0}>
        <Editor {...editorProps} value={editor1Value} onChange={handleEditor1Change} onMount={handleEditorMount} />
      </Box>
      <Box sx={{ height: 'calc(100% - 156px)' }} hidden={editorIndex !== 1}>
        <Allotment vertical={true}>
          <Allotment.Pane minSize={200}>
            <Editor {...editorProps} value={editor1Value} onChange={handleEditor1Change} onMount={handleEditorMount} />
          </Allotment.Pane>
          <Allotment.Pane minSize={200}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor2Value} onChange={handleEditor2Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
        </Allotment>
      </Box>
      <Box sx={{ height: 'calc(100% - 156px)' }} hidden={editorIndex !== 2}>
        <Allotment vertical={true}>
          <Allotment.Pane minSize={20}>
            <Editor {...editorProps} value={editor1Value} onChange={handleEditor1Change} onMount={handleEditorMount} />
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor2Value} onChange={handleEditor2Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor3Value} onChange={handleEditor3Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
        </Allotment>
      </Box>
      <Box sx={{ height: 'calc(100% - 156px)' }} hidden={editorIndex !== 3}>
        <Allotment vertical={true}>
          <Allotment.Pane minSize={20}>
            <Editor {...editorProps} value={editor1Value} onChange={handleEditor1Change} onMount={handleEditorMount} />
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor2Value} onChange={handleEditor2Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor3Value} onChange={handleEditor3Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor4Value} onChange={handleEditor4Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
        </Allotment>
      </Box>
      <Box sx={{ height: 'calc(100% - 156px)' }} hidden={editorIndex !== 4}>
        <Allotment vertical={true}>
          <Allotment.Pane minSize={20}>
            <Editor {...editorProps} value={editor1Value} onChange={handleEditor1Change} onMount={handleEditorMount} />
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor2Value} onChange={handleEditor2Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor3Value} onChange={handleEditor3Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor4Value} onChange={handleEditor4Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
          <Allotment.Pane minSize={20}>
            <Box sx={{ pt: 1, height: '100%' }}>
              <Editor {...editorProps} value={editor5Value} onChange={handleEditor5Change} onMount={handleEditorMount} />
            </Box>
          </Allotment.Pane>
        </Allotment>
      </Box>
    </>
  );
};
