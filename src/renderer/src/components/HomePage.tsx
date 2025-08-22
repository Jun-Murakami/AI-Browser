import { useCallback, useEffect, useRef, useState } from 'react';
import { Allotment, type AllotmentHandle } from 'allotment';
import 'allotment/dist/style.css';
import { Box } from '@mui/material';
import { useTheme } from '@mui/system';
import * as monaco from 'monaco-editor';
import { toast } from 'sonner';

import { useCheckForUpdates } from '../hooks/useCheckForUpdates';
import { useEditorValues } from '../hooks/useEditorValues';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { useLogManager } from '../hooks/useLogManager';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { useTabManager } from '../hooks/useTabManager';
import { BrowserView } from './BrowserView';
import { EditorView } from './EditorView';
import { LicenseDialog } from './EditorView/LicenseDialog';
import { cleanupAllTerminals } from './TerminalView';

import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';

interface HomePageProps {
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
}

export const HomePage = ({ darkMode, setDarkMode }: HomePageProps) => {
  // タブ管理システム
  const {
    tabs,
    activeTabId,
    activeTab,
    isTerminalActive,
    visibleTabs,
    actions,
  } = useTabManager();

  // ログ管理システム
  const {
    logs,
    selectedLog,
    addLog,
    deleteLog,
    selectLog,
    clearSelection,
    getNextLog,
    getPreviousLog,
    setLogs,
  } = useLogManager();

  // エディタ値管理システム
  const {
    setEditorValue,
    getEditorValue,
    getCombinedValue,
    clearAllValues,
    setValuesFromLog,
  } = useEditorValues();

  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releasePageUrl, setReleasePageUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editorIndex, setEditorIndex] = useState(0);
  const [language, setLanguage] = useState('plaintext');
  const [fontSize, setFontSize] = useState(15);
  const [preferredSize, setPreferredSize] = useState(500);
  const [commandKey, setCommandKey] = useState('Ctrl');
  const [osInfo, setOsInfo] = useState('');
  const [isChipVisible, setIsChipVisible] = useState(false);
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);

  const checkForUpdates = useCheckForUpdates();

  const theme = useTheme();

  const {
    ref: browserRef,
    width: browserWidth,
    height: browserHeight,
  } = useResizeObserver<HTMLDivElement>();

  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const newerLogButtonRef = useRef<HTMLButtonElement>(null);
  const olderLogButtonRef = useRef<HTMLButtonElement>(null);

  const sendButtonTouchRippleRef = useRef<TouchRippleActions>(null);
  const copyButtonTouchRippleRef = useRef<TouchRippleActions>(null);
  const clearButtonTouchRippleRef = useRef<TouchRippleActions>(null);
  const saveButtonTouchRippleRef = useRef<TouchRippleActions>(null);
  const newerLogButtonTouchRippleRef = useRef<TouchRippleActions>(null);
  const olderLogButtonTouchRippleRef = useRef<TouchRippleActions>(null);

  const editorSplitRef = useRef<AllotmentHandle | null>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);

  // ブラウザのサイズが変更されたらメインプロセスに通知
  useEffect(() => {
    if (!browserWidth || !browserHeight) {
      return;
    }
    window.electron.sendBrowserSizeToMain({
      width: browserWidth,
      height: browserHeight,
    });
  }, [browserWidth, browserHeight]);

  // タブが切り替わったときの処理
  const handleTabChange = useCallback(
    (tabId: string) => {
      actions.selectTab(tabId);
    },
    [actions],
  );

  // タブの有効/無効を切り替え
  const handleToggleTabEnabled = useCallback(
    (tabId: string) => {
      actions.toggleTabEnabled(tabId);
    },
    [actions],
  );

  // エディタのタブが切り替わったらメインプロセスに通知
  const handleEditorTabChange = useCallback(
    (_: React.SyntheticEvent, index: number) => {
      setEditorIndex(index);
      window.electron.sendEditorModeToMain(index);
    },
    [],
  );

  // 初期設定を取得
  useEffect(() => {
    // クリーンアップ関数
    const cleanup = () => {
      cleanupAllTerminals();
    };

    // ウィンドウ終了時のクリーンアップ
    window.addEventListener('beforeunload', cleanup);

    // スクリプトエラーを監視
    window.electron.onScriptError((error) => {
      toast.error(`${error.browser}: ${error.error}`);
    });

    window.electron
      .getInitialSettings()
      .then(async (settings) => {
        setCurrentVersion(settings.currentVersion);
        // タブの初期化はuseTabManagerで処理される
        setDarkMode(settings.isDarkMode);
        setEditorIndex(settings.editorMode);
        setPreferredSize(settings.browserWidth);
        setIsInitialized(true);
        setTimeout(() => {
          editorSplitRef.current?.reset();
        }, 100);
        // settings.logs は { id, text }[] なので、Log 型に必要な displayText を生成してから保存する
        setLogs(
          settings.logs.map((log: { id: number; text: string }) => {
            // UI 表示用に 1 行・最大 80 文字程度のプレビュー文字列を作成
            const singleLine = log.text.replace(/\s+/g, ' ').trim();
            const preview =
              singleLine.length > 80
                ? `${singleLine.slice(0, 80)}…`
                : singleLine;
            return { ...log, displayText: preview };
          }),
        );
        if (settings.logs.length === 0) {
          setEditorValue(0, 'Type your message here.');
        }
        setLanguage(settings.language);
        setFontSize(settings.fontSize);
        // OS情報に基づいてコマンドキーを設定
        const commandKey = settings.osInfo === 'darwin' ? 'Cmd' : 'Ctrl';
        setCommandKey(commandKey);
        setOsInfo(settings.osInfo);
        const result = await checkForUpdates(settings.currentVersion);
        if (result) {
          setLatestVersion(result.latestVersion);
          setReleasePageUrl('https://jun-murakami.web.app/#aiBrowser');
          setIsChipVisible(true);
        }
        setTimeout(() => {
          monaco.editor.remeasureFonts(); // 一定時間後に呼び出す
        }, 500);
      })
      .catch((error) => {
        console.error(error);
      });

    // クリーンアップ
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      window.electron.removeScriptErrorListener();
    };
  }, [checkForUpdates, setDarkMode, setLogs, setEditorValue]);

  // テキストを送信
  const handleSendButtonClick = (sendToAll: boolean) => {
    const combinedEditorValue = getCombinedValue(editorIndex);
    if (combinedEditorValue.trim() === '') {
      toast('Failed to send. (Prompt is empty)');
      return;
    }

    if (sendToAll) {
      actions.sendMessageToAll(combinedEditorValue);
    } else if (activeTab) {
      actions.sendMessage(activeTab.id, combinedEditorValue);
    }

    const newLogs = addLog(combinedEditorValue);
    if (newLogs) {
      window.electron.sendLogsToMain(newLogs);
    }
    handleClearButtonClick();
  };

  // ログを保存
  const handleSaveButtonClick = () => {
    const combinedEditorValue = getCombinedValue(editorIndex);
    if (combinedEditorValue.trim() === '') {
      toast('Failed to save. (Prompt is empty)');
      return;
    }
    const newLogs = addLog(combinedEditorValue);
    if (newLogs) {
      window.electron.sendLogsToMain(newLogs);
      toast('Log saved.');
    }
  };

  // 選択されたログが変更されたらエディターに反映
  const handleSelectedLogChange = (selectedId: number) => {
    selectLog(selectedId);
    const selected = logs.find((log) => log.id === selectedId);
    if (selected) {
      setValuesFromLog(selected.text, editorIndex);
    }
  };

  // クリアボタンがクリックされたらエディターをクリア
  const handleClearButtonClick = () => {
    clearAllValues();
    clearSelection();
    toast('Editor cleared.');
  };

  // コピーボタンがクリックされたらエディターの内容をクリップボードにコピー
  const handleCopyButtonClick = () => {
    const combinedEditorValue = getCombinedValue(editorIndex);
    if (combinedEditorValue.trim() === '') {
      toast('Failed to copy. (Prompt is empty)');
      return;
    }
    navigator.clipboard.writeText(combinedEditorValue);
    toast('Copied to clipboard.');
  };

  // ログを削除（イベントハンドラー）
  const handleDeleteLog = (logId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    deleteLog(logId);
    if (selectedLog?.id === logId) {
      handleClearButtonClick();
    }
  };

  // チップがクリックされたときの処理
  const handleChipClick = () => {
    if (releasePageUrl) {
      window.electron.openExternalLink(releasePageUrl);
    }
  };

  // フォントサイズ変更の処理
  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    window.electron.sendFontSizeToMain(size);
  };

  // ダークモード切り替えの処理
  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
    window.electron.sendIsDarkModeToMain(!darkMode);
  };

  // 言語変更の処理
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    window.electron.sendLanguageToMain(newLanguage);
  };

  // グローバルショートカットの設定
  useGlobalShortcuts({
    sendButtonRef,
    saveButtonRef,
    copyButtonRef,
    clearButtonRef,
    newerLogButtonRef,
    olderLogButtonRef,
    sendButtonTouchRippleRef,
    copyButtonTouchRippleRef,
    clearButtonTouchRippleRef,
    saveButtonTouchRippleRef,
    newerLogButtonTouchRippleRef,
    olderLogButtonTouchRippleRef,
    osInfo,
  });

  return (
    <Box
      sx={{ height: '100vh', borderTop: 1, borderColor: theme.palette.divider }}
      component="main"
    >
      <Allotment ref={editorSplitRef}>
        <Allotment.Pane minSize={400} preferredSize={preferredSize}>
          <BrowserView
            ref={browserRef}
            tabs={tabs}
            activeTabId={activeTabId}
            isTerminalActive={isTerminalActive}
            visibleTabs={visibleTabs}
            isInitialized={isInitialized}
            onTabChange={handleTabChange}
            onToggleTabEnabled={handleToggleTabEnabled}
          />
        </Allotment.Pane>
        <Allotment.Pane minSize={500}>
          <EditorView
            ref={editorPaneRef}
            isChipVisible={isChipVisible}
            latestVersion={latestVersion}
            releasePageUrl={releasePageUrl}
            onChipClick={handleChipClick}
            onChipClose={() => setIsChipVisible(false)}
            editorIndex={editorIndex}
            language={language}
            fontSize={fontSize}
            darkMode={darkMode}
            commandKey={commandKey}
            isInitialized={isInitialized}
            activeTab={activeTab}
            isTerminalActive={isTerminalActive}
            logs={logs}
            selectedLog={selectedLog}
            editor1Value={getEditorValue(0)}
            editor2Value={getEditorValue(1)}
            editor3Value={getEditorValue(2)}
            editor4Value={getEditorValue(3)}
            editor5Value={getEditorValue(4)}
            onEditorTabChange={handleEditorTabChange}
            onLicenseClick={() => setIsLicenseDialogOpen(true)}
            onSelectLog={handleSelectedLogChange}
            onDeleteLog={handleDeleteLog}
            onNextLog={getNextLog}
            onPreviousLog={getPreviousLog}
            onLanguageChange={handleLanguageChange}
            onFontSizeChange={handleFontSizeChange}
            onDarkModeToggle={handleDarkModeToggle}
            onClearClick={handleClearButtonClick}
            onSaveClick={handleSaveButtonClick}
            onCopyClick={handleCopyButtonClick}
            onSendClick={handleSendButtonClick}
            setEditor1Value={(value) => setEditorValue(0, value)}
            setEditor2Value={(value) => setEditorValue(1, value)}
            setEditor3Value={(value) => setEditorValue(2, value)}
            setEditor4Value={(value) => setEditorValue(3, value)}
            setEditor5Value={(value) => setEditorValue(4, value)}
            sendButtonRef={sendButtonRef}
            copyButtonRef={copyButtonRef}
            clearButtonRef={clearButtonRef}
            saveButtonRef={saveButtonRef}
            newerLogButtonRef={newerLogButtonRef}
            olderLogButtonRef={olderLogButtonRef}
            sendButtonTouchRippleRef={sendButtonTouchRippleRef}
            copyButtonTouchRippleRef={copyButtonTouchRippleRef}
            clearButtonTouchRippleRef={clearButtonTouchRippleRef}
            saveButtonTouchRippleRef={saveButtonTouchRippleRef}
            newerLogButtonTouchRippleRef={newerLogButtonTouchRippleRef}
            olderLogButtonTouchRippleRef={olderLogButtonTouchRippleRef}
            browserWidth={browserWidth ?? null}
            browserHeight={browserHeight ?? null}
            osInfo={osInfo}
          />
          <LicenseDialog
            currentVersion={currentVersion}
            open={isLicenseDialogOpen}
            onClose={() => setIsLicenseDialogOpen(false)}
          />
        </Allotment.Pane>
      </Allotment>
    </Box>
  );
};
