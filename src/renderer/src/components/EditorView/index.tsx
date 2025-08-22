import { forwardRef, type RefObject } from 'react';
import { Box, Chip } from '@mui/material';

import { getSupportedLanguages } from '../MonacoEditor';
import { MonacoEditors } from '../MonacoEditors';
import { EditorTabs } from './EditorTabs';
import { EditorToolbar } from './EditorToolbar';
import { LogSelector } from './LogSelector';

import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';
import type { Log } from '../../types/log.types';
import type { Tab } from '../../types/tab.types';

interface EditorViewProps {
  // チップ関連
  isChipVisible: boolean;
  latestVersion: string | null;
  releasePageUrl: string | null;
  onChipClick: () => void;
  onChipClose: () => void;

  // エディタ関連
  editorIndex: number;
  language: string;
  fontSize: number;
  darkMode: boolean;
  commandKey: string;
  isInitialized: boolean;
  activeTab: Tab | null;
  isTerminalActive: boolean;

  // ログ関連
  logs: Log[];
  selectedLog: Log | null;

  // エディタ値
  editor1Value: string;
  editor2Value: string;
  editor3Value: string;
  editor4Value: string;
  editor5Value: string;

  // イベントハンドラ
  onEditorTabChange: (event: React.SyntheticEvent, index: number) => void;
  onLicenseClick: () => void;
  onSelectLog: (logId: number) => void;
  onDeleteLog: (logId: number, event: React.MouseEvent) => void;
  onNextLog: () => void;
  onPreviousLog: () => void;
  onLanguageChange: (language: string) => void;
  onFontSizeChange: (size: number) => void;
  onDarkModeToggle: () => void;
  onClearClick: () => void;
  onSaveClick: () => void;
  onCopyClick: () => void;
  onSendClick: (sendToAll: boolean) => void;
  setEditor1Value: (value: string) => void;
  setEditor2Value: (value: string) => void;
  setEditor3Value: (value: string) => void;
  setEditor4Value: (value: string) => void;
  setEditor5Value: (value: string) => void;

  // Refs
  sendButtonRef: RefObject<HTMLButtonElement | null>;
  copyButtonRef: RefObject<HTMLButtonElement | null>;
  clearButtonRef: RefObject<HTMLButtonElement | null>;
  saveButtonRef: RefObject<HTMLButtonElement | null>;
  newerLogButtonRef: RefObject<HTMLButtonElement | null>;
  olderLogButtonRef: RefObject<HTMLButtonElement | null>;
  sendButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  copyButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  clearButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  saveButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  newerLogButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  olderLogButtonTouchRippleRef: RefObject<TouchRippleActions | null>;

  // サイズ情報
  browserWidth: number | null;
  browserHeight: number | null;
  osInfo: string;
}

export const EditorView = forwardRef<HTMLDivElement, EditorViewProps>(
  (props, ref) => {
    const {
      isChipVisible,
      latestVersion,
      onChipClick,
      onChipClose,
      editorIndex,
      language,
      fontSize,
      darkMode,
      commandKey,
      isInitialized,
      activeTab,
      isTerminalActive,
      logs,
      selectedLog,
      editor1Value,
      editor2Value,
      editor3Value,
      editor4Value,
      editor5Value,
      onEditorTabChange,
      onLicenseClick,
      onSelectLog,
      onDeleteLog,
      onNextLog,
      onPreviousLog,
      onLanguageChange,
      onFontSizeChange,
      onDarkModeToggle,
      onClearClick,
      onSaveClick,
      onCopyClick,
      onSendClick,
      setEditor1Value,
      setEditor2Value,
      setEditor3Value,
      setEditor4Value,
      setEditor5Value,
      sendButtonRef,
      copyButtonRef,
      clearButtonRef,
      saveButtonRef,
      newerLogButtonRef,
      olderLogButtonRef,
      sendButtonTouchRippleRef,
      copyButtonTouchRippleRef,
      clearButtonTouchRippleRef,
      saveButtonTouchRippleRef,
      newerLogButtonTouchRippleRef,
      olderLogButtonTouchRippleRef,
      browserWidth,
      browserHeight,
      osInfo,
    } = props;

    const fontSizeOptions = [
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
      25, 26, 27, 28, 29, 30,
    ];

    return (
      <Box sx={{ height: '100%' }} ref={ref}>
        {isChipVisible && (
          <Chip
            label={`Update? v${latestVersion}`}
            color="primary"
            onClick={onChipClick}
            onDelete={onChipClose}
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              m: 1,
              zIndex: 1000,
            }}
          />
        )}

        <EditorTabs
          editorIndex={editorIndex}
          onTabChange={onEditorTabChange}
          onLicenseClick={onLicenseClick}
        />

        <LogSelector
          logs={logs}
          selectedLog={selectedLog}
          commandKey={commandKey}
          onSelectLog={onSelectLog}
          onDeleteLog={onDeleteLog}
          onNextLog={onNextLog}
          onPreviousLog={onPreviousLog}
          language={language}
          supportedLanguages={getSupportedLanguages()}
          onLanguageChange={onLanguageChange}
          newerLogButtonRef={newerLogButtonRef}
          olderLogButtonRef={olderLogButtonRef}
          newerLogButtonTouchRippleRef={newerLogButtonTouchRippleRef}
          olderLogButtonTouchRippleRef={olderLogButtonTouchRippleRef}
        />

        <MonacoEditors
          darkMode={darkMode}
          editorIndex={editorIndex}
          language={language}
          fontSize={fontSize}
          editor1Value={editor1Value}
          setEditor1Value={setEditor1Value}
          editor2Value={editor2Value}
          setEditor2Value={setEditor2Value}
          editor3Value={editor3Value}
          setEditor3Value={setEditor3Value}
          editor4Value={editor4Value}
          setEditor4Value={setEditor4Value}
          editor5Value={editor5Value}
          setEditor5Value={setEditor5Value}
          sendButtonRef={sendButtonRef}
          copyButtonRef={copyButtonRef}
          clearButtonRef={clearButtonRef}
          saveButtonRef={saveButtonRef}
          newerLogButtonRef={newerLogButtonRef}
          olderLogButtonRef={olderLogButtonRef}
          browserWidth={browserWidth ?? undefined}
          browserHeight={browserHeight ?? undefined}
          osInfo={osInfo}
        />

        <EditorToolbar
          fontSize={fontSize}
          darkMode={darkMode}
          commandKey={commandKey}
          isInitialized={isInitialized}
          activeTab={activeTab}
          isTerminalActive={isTerminalActive}
          fontSizeOptions={fontSizeOptions}
          onFontSizeChange={onFontSizeChange}
          onDarkModeToggle={onDarkModeToggle}
          onClearClick={onClearClick}
          onSaveClick={onSaveClick}
          onCopyClick={onCopyClick}
          onSendClick={onSendClick}
          clearButtonRef={clearButtonRef}
          saveButtonRef={saveButtonRef}
          copyButtonRef={copyButtonRef}
          sendButtonRef={sendButtonRef}
          clearButtonTouchRippleRef={clearButtonTouchRippleRef}
          saveButtonTouchRippleRef={saveButtonTouchRippleRef}
          copyButtonTouchRippleRef={copyButtonTouchRippleRef}
          sendButtonTouchRippleRef={sendButtonTouchRippleRef}
        />
      </Box>
    );
  },
);

EditorView.displayName = 'EditorView';
