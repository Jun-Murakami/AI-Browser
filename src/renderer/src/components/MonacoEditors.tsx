import { useImperativeHandle, useRef } from 'react';
import { Allotment } from 'allotment';

import type * as monaco from 'monaco-editor';
import 'allotment/dist/style.css';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { ConnectedMonacoEditor } from './ConnectedMonacoEditor';

import type { MonacoEditorHandle } from './MonacoEditor';

/** 親コンポーネントから全エディタを一括操作するためのハンドル */
export interface MonacoEditorsHandle {
  /** darkMode / language / fontSize を全エディタに反映 */
  syncSettings: (settings: {
    darkMode: boolean;
    language: string;
    fontSize: number;
  }) => void;
  /** 全エディタの値を一括設定 */
  setAllValues: (values: string[]) => void;
  /** 指定インデックスのエディタの値を設定 */
  setEditorValue: (index: number, value: string) => void;
  /** 全エディタのレイアウトを再計算 */
  layoutAll: () => void;
}

interface MonacoEditorsProps {
  darkMode: boolean;
  language: string;
  fontSize: number;
  editorIndex: number;
  sendButtonRef: React.RefObject<HTMLButtonElement | null>;
  copyButtonRef: React.RefObject<HTMLButtonElement | null>;
  clearButtonRef: React.RefObject<HTMLButtonElement | null>;
  saveButtonRef: React.RefObject<HTMLButtonElement | null>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  lastFocusedEditorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>;
  osInfo: string;
  isTerminalActive?: boolean;
  ref?: React.Ref<MonacoEditorsHandle>;
}

export const MonacoEditors = ({
  darkMode,
  language,
  fontSize,
  editorIndex,
  sendButtonRef,
  copyButtonRef,
  clearButtonRef,
  saveButtonRef,
  newerLogButtonRef,
  olderLogButtonRef,
  lastFocusedEditorRef,
  osInfo,
  isTerminalActive,
  ref,
}: MonacoEditorsProps) => {
  const editor1Ref = useRef<MonacoEditorHandle>(null);
  const editor2Ref = useRef<MonacoEditorHandle>(null);
  const editor3Ref = useRef<MonacoEditorHandle>(null);
  const editor4Ref = useRef<MonacoEditorHandle>(null);
  const editor5Ref = useRef<MonacoEditorHandle>(null);

  // 親コンポーネントに一括操作ハンドルを公開
  useImperativeHandle(ref, () => ({
    syncSettings: (settings) => {
      editor1Ref.current?.syncSettings(settings);
      editor2Ref.current?.syncSettings(settings);
      editor3Ref.current?.syncSettings(settings);
      editor4Ref.current?.syncSettings(settings);
      editor5Ref.current?.syncSettings(settings);
    },
    setAllValues: (values) => {
      editor1Ref.current?.setValue(values[0] ?? '');
      editor2Ref.current?.setValue(values[1] ?? '');
      editor3Ref.current?.setValue(values[2] ?? '');
      editor4Ref.current?.setValue(values[3] ?? '');
      editor5Ref.current?.setValue(values[4] ?? '');
    },
    setEditorValue: (index, value) => {
      const refs = [editor1Ref, editor2Ref, editor3Ref, editor4Ref, editor5Ref];
      refs[index]?.current?.setValue(value);
    },
    layoutAll: () => {
      editor1Ref.current?.layout();
      editor2Ref.current?.layout();
      editor3Ref.current?.layout();
      editor4Ref.current?.layout();
      editor5Ref.current?.layout();
    },
  }));

  const theme = useTheme();

  const commonProps = {
    darkMode,
    language,
    fontSize,
    sendButtonRef,
    copyButtonRef,
    clearButtonRef,
    saveButtonRef,
    newerLogButtonRef,
    olderLogButtonRef,
    lastFocusedEditorRef,
    isTerminalActive,
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
            <ConnectedMonacoEditor
              {...commonProps}
              index={0}
              editorRef={editor1Ref}
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
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={0}
                  editorRef={editor1Ref}
                  placeholder={placeholderText}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={200}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={1}
                  editorRef={editor2Ref}
                />
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
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={0}
                  editorRef={editor1Ref}
                  placeholder={placeholderText}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={1}
                  editorRef={editor2Ref}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={2}
                  editorRef={editor3Ref}
                />
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
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={0}
                  editorRef={editor1Ref}
                  placeholder={placeholderText}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={1}
                  editorRef={editor2Ref}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={2}
                  editorRef={editor3Ref}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={3}
                  editorRef={editor4Ref}
                />
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
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={0}
                  editorRef={editor1Ref}
                  placeholder={placeholderText}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={1}
                  editorRef={editor2Ref}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={2}
                  editorRef={editor3Ref}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={3}
                  editorRef={editor4Ref}
                />
              </Box>
            </Allotment.Pane>
            <Allotment.Pane minSize={20}>
              <Box sx={{ pt: 1, height: '100%' }}>
                <ConnectedMonacoEditor
                  {...commonProps}
                  index={4}
                  editorRef={editor5Ref}
                />
              </Box>
            </Allotment.Pane>
          </Allotment>
        )}
      </Box>
    </Box>
  );
};
