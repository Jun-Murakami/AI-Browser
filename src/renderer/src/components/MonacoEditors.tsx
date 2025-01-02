import { useRef } from 'react';
import * as monaco from 'monaco-editor';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { MonacoEditor, MonacoEditorProps } from './MonacoEditor';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
interface MonacoEditorsProps {
  darkMode: boolean;
  language: string;
  fontSize: number;
  editorIndex: number;
  browserWidth?: number;
  browserHeight?: number;
  sendButtonRef: React.RefObject<HTMLButtonElement | null>;
  copyButtonRef: React.RefObject<HTMLButtonElement | null>;
  clearButtonRef: React.RefObject<HTMLButtonElement | null>;
  saveButtonRef: React.RefObject<HTMLButtonElement | null>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement | null>;
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
  osInfo: string;
}

export const MonacoEditors = ({
  darkMode,
  language,
  fontSize,
  editorIndex,
  browserWidth,
  browserHeight,
  sendButtonRef,
  copyButtonRef,
  clearButtonRef,
  newerLogButtonRef,
  olderLogButtonRef,
  saveButtonRef,
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
  osInfo,
}: MonacoEditorsProps) => {
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

  const editor1Ref = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const editor2Ref = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const editor3Ref = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const editor4Ref = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const editor5Ref = useRef<monaco.editor.IStandaloneCodeEditor>(null);

  const theme = useTheme();

  const editorProps: MonacoEditorProps = {
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
    osInfo,
  };

  const placeholderText = 'Type your prompt for the AI assistant...';

  return (
    <Box sx={{ height: 'calc(100% - 156px)', p: 1, pt: 0 }}>
      <Box
        sx={{
          borderWidth: 1,
          borderColor: theme.palette.divider,
          borderStyle: 'solid',
          height: '100%',
          backgroundColor: darkMode ? '#1e1e1e' : undefined,
        }}
      >
        {editorIndex === 0 && (
          <Box sx={{ pt: 1, height: '100%' }}>
            <MonacoEditor
              {...editorProps}
              value={editor1Value}
              onChange={handleEditor1Change}
              ref={editor1Ref}
              placeholder={placeholderText}
            />
          </Box>
        )}
        {editorIndex === 1 && (
          <Allotment
            vertical={true}
            onChange={() => {
              editor1Ref.current?.layout();
              editor2Ref.current?.layout();
            }}
          >
            <Allotment.Pane minSize={200}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor
                  {...editorProps}
                  value={editor1Value}
                  onChange={handleEditor1Change}
                  ref={editor1Ref}
                  placeholder={placeholderText}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={200}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor2Value} onChange={handleEditor2Change} ref={editor2Ref} />
              </Box>
            </Allotment.Pane>
          </Allotment>
        )}
        {editorIndex === 2 && (
          <Allotment
            vertical={true}
            onChange={() => {
              editor1Ref.current?.layout();
              editor2Ref.current?.layout();
              editor3Ref.current?.layout();
            }}
          >
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor
                  {...editorProps}
                  value={editor1Value}
                  onChange={handleEditor1Change}
                  ref={editor1Ref}
                  placeholder={placeholderText}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor2Value} onChange={handleEditor2Change} ref={editor2Ref} />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor3Value} onChange={handleEditor3Change} ref={editor3Ref} />
              </Box>
            </Allotment.Pane>
          </Allotment>
        )}
        {editorIndex === 3 && (
          <Allotment
            vertical={true}
            onChange={() => {
              editor1Ref.current?.layout();
              editor2Ref.current?.layout();
              editor3Ref.current?.layout();
              editor4Ref.current?.layout();
            }}
          >
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor
                  {...editorProps}
                  value={editor1Value}
                  onChange={handleEditor1Change}
                  ref={editor1Ref}
                  placeholder={placeholderText}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor2Value} onChange={handleEditor2Change} ref={editor2Ref} />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor3Value} onChange={handleEditor3Change} ref={editor3Ref} />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor4Value} onChange={handleEditor4Change} ref={editor4Ref} />
              </Box>
            </Allotment.Pane>
          </Allotment>
        )}
        {editorIndex === 4 && (
          <Allotment
            vertical={true}
            onChange={() => {
              editor1Ref.current?.layout();
              editor2Ref.current?.layout();
              editor3Ref.current?.layout();
              editor4Ref.current?.layout();
            }}
          >
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor
                  {...editorProps}
                  value={editor1Value}
                  onChange={handleEditor1Change}
                  ref={editor1Ref}
                  placeholder={placeholderText}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor2Value} onChange={handleEditor2Change} ref={editor2Ref} />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor3Value} onChange={handleEditor3Change} ref={editor3Ref} />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor4Value} onChange={handleEditor4Change} ref={editor4Ref} />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <MonacoEditor {...editorProps} value={editor5Value} onChange={handleEditor5Change} ref={editor5Ref} />
              </Box>
            </Allotment.Pane>
          </Allotment>
        )}
      </Box>
    </Box>
  );
};
