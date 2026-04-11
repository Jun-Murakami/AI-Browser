import { useCallback, useEffect, useRef, useState } from 'react';
import { Allotment, type AllotmentHandle } from 'allotment';
import 'allotment/dist/style.css';
import { Box } from '@mui/material';
import { useTheme } from '@mui/system';
import * as monaco from 'monaco-editor';
import { toast } from 'sonner';

import { useCheckForUpdates } from '../hooks/useCheckForUpdates';
import { useHotkeyActions } from '../hooks/useHotkeyActions';
import { useLogManager } from '../hooks/useLogManager';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { useTabManager } from '../hooks/useTabManager';
import { terminalService } from '../services/terminalService';
import { useEditorStore } from '../stores/useEditorStore';
import { BrowserView } from './BrowserView';
import { EditorView } from './EditorView';
import { LicenseDialog } from './EditorView/LicenseDialog';
import { cleanupAllTerminals } from './TerminalView';
import { UpdateDialog } from './UpdateDialog';

import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';
import type { MonacoEditorsHandle } from './MonacoEditors';

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
    sendTargets,
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

  // エディタ値管理システム（Zustand ストア）
  const setEditorValue = useEditorStore((s) => s.setEditorValue);
  const getCombinedValue = useEditorStore((s) => s.getCombinedValue);
  const clearAllValues = useEditorStore((s) => s.clearAllValues);
  const setValuesFromLog = useEditorStore((s) => s.setValuesFromLog);

  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    releasePageUrl: string;
    releaseBody: string;
    releaseAssets: { name: string; browserDownloadUrl: string; size: number }[];
  } | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editorIndex, setEditorIndex] = useState(0);
  const [language, setLanguage] = useState('plaintext');
  const [fontSize, setFontSize] = useState(15);
  const [preferredSize, setPreferredSize] = useState(500);
  const [commandKey, setCommandKey] = useState('Ctrl');
  const [osInfo, setOsInfo] = useState('');
  const [isChipVisible, setIsChipVisible] = useState(false);
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [boilerplates, setBoilerplates] = useState<Record<string, string>>({});
  const [boilerplateBank, setBoilerplateBank] = useState<
    'A' | 'B' | 'C' | 'D' | 'E'
  >('A');
  const boilerplateBankRef = useRef<'A' | 'B' | 'C' | 'D' | 'E'>('A');
  const boilerplatesRef = useRef<Record<string, string>>({});
  const lastFocusedEditorRef =
    useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const checkForUpdates = useCheckForUpdates();

  const theme = useTheme();

  const { ref: browserRef } = useResizeObserver<HTMLDivElement>({
    onResize: ({ width, height }) => {
      window.electron.sendBrowserSizeToMain({ width, height });
      editorsRef.current?.layoutAll();
    },
  });

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
  const editorsRef = useRef<MonacoEditorsHandle>(null);

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

  // 一括送信対象の切り替え
  const handleToggleSendTarget = useCallback(
    (tabId: string) => {
      actions.toggleSendTarget(tabId);
    },
    [actions],
  );

  // タブの並び順を変更
  const handleTabReorder = useCallback(
    (tabId: string, newOrder: number) => {
      actions.reorderTab(tabId, newOrder);
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

    // Mod+Minus/Plus によるバンク切替（メインプロセスからのIPC）
    const BANKS: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
    window.electron.onSwitchBoilerplateBank((direction) => {
      const cur = BANKS.indexOf(boilerplateBankRef.current);
      const next =
        direction === 'prev'
          ? (cur - 1 + BANKS.length) % BANKS.length
          : (cur + 1) % BANKS.length;
      setBoilerplateBank(BANKS[next]);
      boilerplateBankRef.current = BANKS[next];
      window.electron.saveBoilerplateBankToMain(BANKS[next]);
    });

    window.electron
      .getInitialSettings()
      .then(async (settings) => {
        setCurrentVersion(settings.currentVersion);
        // タブの初期化はuseTabManagerで処理される
        setDarkMode(settings.isDarkMode);
        terminalService.setTheme(settings.isDarkMode ? 'dark' : 'light');
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
          editorsRef.current?.setEditorValue(0, 'Type your message here.');
        }
        setLanguage(settings.language);
        setFontSize(settings.fontSize);
        editorsRef.current?.syncSettings({
          darkMode: settings.isDarkMode,
          language: settings.language,
          fontSize: settings.fontSize,
        });
        if (settings.boilerplates) {
          setBoilerplates(settings.boilerplates);
          boilerplatesRef.current = settings.boilerplates;
        }
        if (settings.boilerplateBank) {
          setBoilerplateBank(settings.boilerplateBank);
          boilerplateBankRef.current = settings.boilerplateBank;
        }
        // OS情報に基づいてコマンドキーを設定
        const commandKey = settings.osInfo === 'darwin' ? 'Cmd' : 'Ctrl';
        setCommandKey(commandKey);
        setOsInfo(settings.osInfo);
        terminalService.setPlatform(settings.osInfo);
        const result = await checkForUpdates(settings.currentVersion);
        if (result) {
          setUpdateInfo(result);
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
      window.electron.removeSwitchBoilerplateBankListener();
    };
  }, [checkForUpdates, setDarkMode, setLogs, setEditorValue]);

  // テキストを送信
  const handleSendButtonClick = (sendToAll: boolean) => {
    const combinedEditorValue = getCombinedValue(editorIndex);
    const isEmpty = combinedEditorValue.trim() === '';

    // ターミナルアクティブ時は空でもEnterのみ送信を許可
    if (isEmpty && isTerminalActive && !sendToAll && activeTab) {
      actions.sendMessage(activeTab.id, '');
      handleSendArrowKey('enter');
      return;
    }

    if (isEmpty) {
      toast('Failed to send. (Prompt is empty)');
      return;
    }

    if (sendToAll) {
      actions.sendMessageToAll(combinedEditorValue);
    } else if (activeTab) {
      actions.sendMessage(activeTab.id, combinedEditorValue);
    }
    handleSendArrowKey('enter');

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
      const values = setValuesFromLog(selected.text, editorIndex);
      editorsRef.current?.setAllValues(values);
    }
  };

  // 次のログに移動
  const handleNextLog = () => {
    getNextLog();
    // 新しく選択されたログを取得してエディターに反映
    if (selectedLog) {
      const index = logs.indexOf(selectedLog);
      if (index > 0) {
        const nextLog = logs[index - 1];
        const values = setValuesFromLog(nextLog.text, editorIndex);
        editorsRef.current?.setAllValues(values);
      }
    } else if (logs.length > 0) {
      const values = setValuesFromLog(logs[0].text, editorIndex);
      editorsRef.current?.setAllValues(values);
    }
  };

  // 前のログに移動
  const handlePreviousLog = () => {
    getPreviousLog();
    // 新しく選択されたログを取得してエディターに反映
    if (selectedLog) {
      const index = logs.indexOf(selectedLog);
      if (index < logs.length - 1) {
        const prevLog = logs[index + 1];
        const values = setValuesFromLog(prevLog.text, editorIndex);
        editorsRef.current?.setAllValues(values);
      }
    } else if (logs.length > 0) {
      const values = setValuesFromLog(logs[0].text, editorIndex);
      editorsRef.current?.setAllValues(values);
    }
  };

  // クリアボタンがクリックされたらエディターをクリア
  const handleClearButtonClick = () => {
    const values = clearAllValues();
    editorsRef.current?.setAllValues(values);
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
    setIsUpdateDialogOpen(true);
  };

  // フォントサイズ変更の処理
  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    window.electron.sendFontSizeToMain(size);
    editorsRef.current?.syncSettings({ darkMode, language, fontSize: size });
  };

  // ダークモード切り替えの処理
  const handleDarkModeToggle = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    window.electron.sendIsDarkModeToMain(newDarkMode);
    editorsRef.current?.syncSettings({
      darkMode: newDarkMode,
      language,
      fontSize,
    });
    terminalService.setTheme(newDarkMode ? 'dark' : 'light');
  };

  // 言語変更の処理
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    window.electron.sendLanguageToMain(newLanguage);
    editorsRef.current?.syncSettings({
      darkMode,
      language: newLanguage,
      fontSize,
    });
  };

  // refを常に最新に保つ
  boilerplatesRef.current = boilerplates;
  boilerplateBankRef.current = boilerplateBank;

  // バンク変更ハンドラ
  const handleBoilerplateBankChange = useCallback(
    (bank: 'A' | 'B' | 'C' | 'D' | 'E') => {
      setBoilerplateBank(bank);
      boilerplateBankRef.current = bank;
      window.electron.saveBoilerplateBankToMain(bank);
    },
    [],
  );

  // 定型文の変更ハンドラ
  const handleBoilerplateChange = useCallback((key: string, text: string) => {
    setBoilerplates((prev) => {
      const next = { ...prev, [key]: text };
      boilerplatesRef.current = next;
      window.electron.saveBoilerplatesToMain(next);
      return next;
    });
  }, []);

  // ホットキー・修飾キー追跡・キー送出
  const {
    isCtrlHeld,
    isAltHeld,
    activeArrowKey,
    handleSendArrowKey,
    handleSendControlKey,
    handleInsertBoilerplate,
  } = useHotkeyActions({
    osInfo,
    activeTab,
    isTerminalActive,
    visibleTabs,
    activeTabId,
    selectTab: actions.selectTab,
    boilerplatesRef,
    boilerplateBankRef,
    lastFocusedEditorRef,
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
  });

  return (
    <Box
      sx={{ height: '100vh', borderTop: 1, borderColor: theme.palette.divider }}
      component="main"
    >
      <Allotment ref={editorSplitRef}>
        <Allotment.Pane minSize={370} preferredSize={preferredSize}>
          <BrowserView
            ref={browserRef}
            tabs={tabs}
            activeTabId={activeTabId}
            isTerminalActive={isTerminalActive}
            visibleTabs={visibleTabs}
            isInitialized={isInitialized}
            onTabChange={handleTabChange}
            onToggleTabEnabled={handleToggleTabEnabled}
            onTabReorder={handleTabReorder}
          />
        </Allotment.Pane>
        <Allotment.Pane minSize={530}>
          <EditorView
            ref={editorPaneRef}
            isChipVisible={isChipVisible}
            latestVersion={updateInfo?.latestVersion ?? null}
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
            onEditorTabChange={handleEditorTabChange}
            onLicenseClick={() => setIsLicenseDialogOpen(true)}
            onSelectLog={handleSelectedLogChange}
            onDeleteLog={handleDeleteLog}
            onNextLog={handleNextLog}
            onPreviousLog={handlePreviousLog}
            onLanguageChange={handleLanguageChange}
            onFontSizeChange={handleFontSizeChange}
            onDarkModeToggle={handleDarkModeToggle}
            onClearClick={handleClearButtonClick}
            onSaveClick={handleSaveButtonClick}
            onCopyClick={handleCopyButtonClick}
            onSendClick={handleSendButtonClick}
            sendTargets={sendTargets}
            onToggleSendTarget={handleToggleSendTarget}
            boilerplates={boilerplates}
            boilerplateBank={boilerplateBank}
            onBoilerplateBankChange={handleBoilerplateBankChange}
            isCtrlHeld={isCtrlHeld}
            isAltHeld={isAltHeld}
            activeArrowKey={activeArrowKey}
            onBoilerplateChange={handleBoilerplateChange}
            onInsertBoilerplate={handleInsertBoilerplate}
            onSendArrowKey={handleSendArrowKey}
            onSendControlKey={handleSendControlKey}
            lastFocusedEditorRef={lastFocusedEditorRef}
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
            editorsRef={editorsRef}
            osInfo={osInfo}
          />
          <LicenseDialog
            currentVersion={currentVersion}
            open={isLicenseDialogOpen}
            onClose={() => setIsLicenseDialogOpen(false)}
          />
          <UpdateDialog
            open={isUpdateDialogOpen}
            onClose={() => setIsUpdateDialogOpen(false)}
            latestVersion={updateInfo?.latestVersion ?? ''}
            releaseBody={updateInfo?.releaseBody ?? ''}
            releaseAssets={updateInfo?.releaseAssets ?? []}
            releasePageUrl={updateInfo?.releasePageUrl ?? ''}
            osInfo={osInfo}
          />
        </Allotment.Pane>
      </Allotment>
    </Box>
  );
};
