import React, { useState, useRef, useEffect } from 'react';
import { Allotment, AllotmentHandle } from 'allotment';
import 'allotment/dist/style.css';
import { toast } from 'sonner';
import { EraseIcon, Split1Icon, Split2Icon, Split3Icon, Split4Icon, Split5Icon } from './Icons';
import {
  Box,
  Tab,
  Tabs,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Button,
  Tooltip,
  Typography,
  Chip,
  TextField,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/system';
import * as monaco from 'monaco-editor';
import { KeyboardArrowUp, KeyboardArrowDown, Send, ContentPaste, ReplayOutlined, Settings, Save } from '@mui/icons-material';
import { supportedLanguages } from '../utils/supportedLanguages';
import { MonacoEditors } from './MonacoEditors';
import { MaterialUISwitch } from './DarkModeSwitch';
import { useCheckForUpdates } from '../utils/useCheckForUpdates';
import BrowserTab from './BrowserTab';

// カスタムフックを追加
const useResizeObserver = <T extends HTMLElement>() => {
  const [size, setSize] = useState<{ width?: number; height?: number }>({});
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width: size.width, height: size.height };
};

interface HomePageProps {
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
}

interface Log {
  id: number;
  text: string;
}

export const HomePage = ({ darkMode, setDarkMode }: HomePageProps) => {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releasePageUrl, setReleasePageUrl] = useState<string | null>(null);
  const [browserIndex, setBrowserIndex] = useState(8);
  const [browserUrls, setBrowserUrls] = useState<string[]>([]);
  const [browserLoadings, setBrowserLoadings] = useState<boolean[]>([true, true, true, true, true, true, true, true, true]);
  const [enabledBrowsers, setEnabledBrowsers] = useState<boolean[]>([true, true, true, true, true, true, true, true, true]);
  const [isEditingBrowserShow, setIsEditingBrowserShow] = useState(false);
  const [editorIndex, setEditorIndex] = useState(0);
  const [language, setLanguage] = useState('text');
  const [fontSize, setFontSize] = useState(15);
  const [logs, setLogs] = useState<Log[]>([]);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [editor1Value, setEditor1Value] = useState('');
  const [editor2Value, setEditor2Value] = useState('');
  const [editor3Value, setEditor3Value] = useState('');
  const [editor4Value, setEditor4Value] = useState('');
  const [editor5Value, setEditor5Value] = useState('');
  const [browserIndexTimestamp, setBrowserIndexTimestamp] = useState(new Date().getTime());
  const [preferredSize, setPreferredSize] = useState(500);
  const [commandKey, setCommandKey] = useState('Ctrl');
  const [osInfo, setOsInfo] = useState('');
  const [isChipVisible, setIsChipVisible] = useState(false);

  const checkForUpdates = useCheckForUpdates();

  const theme = useTheme();

  const { ref: browserRef, width: browserWidth, height: browserHeight } = useResizeObserver<HTMLDivElement>();
  const { ref: promptHistoryRef, width: promptHistoryWidth } = useResizeObserver<HTMLSelectElement>();

  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const newerLogButtonRef = useRef<HTMLButtonElement>(null);
  const olderLogButtonRef = useRef<HTMLButtonElement>(null);
  const editorSplitRef = useRef<AllotmentHandle>(null!);

  // ブラウザのサイズが変更されたらメインプロセスに通知
  useEffect(() => {
    if (!browserWidth || !browserHeight) {
      return;
    }
    window.electron.sendBrowserSizeToMain({ width: browserWidth, height: browserHeight });
  }, [browserWidth, browserHeight]);

  // ブラウザタブが切り替わったらメインプロセスに通知
  const handleBrowserTabChange = (_: React.SyntheticEvent, index: number) => {
    setBrowserIndex(index);
    window.electron.sendBrowserTabIndexToMain(index);
  };

  // エディタのタブが切り替わったらメインプロセスに通知
  const handleEditorTabChange = (_: React.SyntheticEvent, index: number) => {
    setEditorIndex(index);
    window.electron.sendEditorModeToMain(index);
  };

  // ブラウザタブが切り替わったらメインプロセスに通知(Monaco Editorコマンド由来)
  useEffect(() => {
    let newBrowserIndex = browserIndex + 1;
    while (!enabledBrowsers[newBrowserIndex]) {
      newBrowserIndex = newBrowserIndex + 1;
      if (newBrowserIndex > enabledBrowsers.filter((enabled) => enabled).length + 1) {
        newBrowserIndex = 0;
      }
    }
    setBrowserIndex(newBrowserIndex);
    window.electron.sendBrowserTabIndexToMain(newBrowserIndex);
  }, [browserIndexTimestamp]);

  // 初期設定を取得
  useEffect(() => {
    window.electron
      .getInitialSettings()
      .then(async (settings) => {
        setDarkMode(settings.isDarkMode);
        setEnabledBrowsers(settings.enabledBrowsers);
        setEditorIndex(settings.editorMode);
        setPreferredSize(settings.browserWidth);
        setTimeout(() => {
          editorSplitRef.current.reset();
        }, 100);
        setLogs(settings.logs);
        if (settings.logs.length === 0) {
          setEditor1Value('Type your message here.');
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

    // ブラウザのURLを監視
    window.electron.onUpdateUrls((newUrls) => {
      setBrowserUrls(newUrls);
    });

    // ローディング状態を監視
    window.electron.onUpdateLoadingStatus((status) => {
      setBrowserLoadings((prev) => {
        const newLoadings = [...prev];
        newLoadings[status.index] = status.isLoading;
        return newLoadings;
      });
    });

    // クリーンアップ
    return () => {
      window.electron.removeUpdateUrlsListener();
      window.electron.removeUpdateLoadingStatusListener();
    };
  }, []);

  // エディターテキストを結合して取得
  const getCombinedEditorValue = () => {
    const divider = '\n----\n';
    let combinedValue = '';
    if (editorIndex === 0) {
      combinedValue = editor1Value;
    } else if (editorIndex === 1) {
      combinedValue = editor1Value + divider + editor2Value;
    } else if (editorIndex === 2) {
      combinedValue = editor1Value + divider + editor2Value + divider + editor3Value;
    } else if (editorIndex === 3) {
      combinedValue = editor1Value + divider + editor2Value + divider + editor3Value + divider + editor4Value;
    } else {
      combinedValue =
        editor1Value + divider + editor2Value + divider + editor3Value + divider + editor4Value + divider + editor5Value;
    }
    // 空白のある行があればディバイダ―ごと削除
    combinedValue = combinedValue
      .split(divider)
      .filter((line) => line.trim() !== '')
      .join(divider);
    // 末尾のディバイダーを削除
    combinedValue = combinedValue.replace(new RegExp(`${divider}$`), '');
    return combinedValue;
  };

  // ログを追加
  const addLog = (text: string) => {
    // 現在の最新のログID＋１を新しいログのIDとしたログを作成
    const newLog: Log = {
      id: logs.length > 0 ? logs[0].id + 1 : 1,
      text,
    };

    //最後のログと同じ内容の場合は追加しない
    if (logs.length > 0 && logs[0].text === text) {
      return;
    }

    // ログが500件を超えたら古いログを削除
    if (logs.length >= 500) {
      const newLogs = logs.slice(0, 499);
      setLogs([newLog, ...newLogs]);
      setSelectedLog(null);
      return [newLog, ...newLogs];
    } else {
      setLogs([newLog, ...logs]);
      setSelectedLog(null);
      return [newLog, ...logs];
    }
  };

  // テキストを送信
  const handleSendButtonClick = (sendToAll: boolean) => {
    const combinedEditorValue = getCombinedEditorValue();
    if (combinedEditorValue.trim() === '') {
      return;
    }

    window.electron.sendTextToMain(combinedEditorValue, sendToAll);
    const newLogs = addLog(combinedEditorValue);
    if (newLogs) {
      window.electron.sendLogsToMain(newLogs);
    }
    handleClearButtonClick();
  };

  // ログを保存
  const handleSaveButtonClick = () => {
    const combinedEditorValue = getCombinedEditorValue();
    const newLogs = addLog(combinedEditorValue);
    if (newLogs) {
      window.electron.sendLogsToMain(newLogs);
      toast('Log saved.');
    }
  };

  // 選択されたログが変更されたらエディターに反映
  const handleSelectedLogChange = (selectedText: string) => {
    const selected = logs.find((log) => log.text === selectedText);

    if (selected) {
      setSelectedLog(selected);
      const parts = selectedText.split('\n----\n');

      switch (editorIndex) {
        case 0:
          setEditor1Value(selectedText);
          setEditor2Value('');
          setEditor3Value('');
          setEditor4Value('');
          setEditor5Value('');
          break;
        case 1:
          setEditor1Value(parts[0] || '');
          setEditor2Value(parts.slice(1).join('\n----\n') || '');
          setEditor3Value('');
          setEditor4Value('');
          setEditor5Value('');
          break;
        case 2:
          setEditor1Value(parts[0] || '');
          setEditor2Value(parts[1] || '');
          setEditor3Value(parts.slice(2).join('\n----\n') || '');
          setEditor4Value('');
          setEditor5Value('');
          break;
        case 3:
          setEditor1Value(parts[0] || '');
          setEditor2Value(parts[1] || '');
          setEditor3Value(parts[2] || '');
          setEditor4Value(parts.slice(3).join('\n----\n') || '');
          setEditor5Value('');
          break;
        case 4:
          setEditor1Value(parts[0] || '');
          setEditor2Value(parts[1] || '');
          setEditor3Value(parts[2] || '');
          setEditor4Value(parts[3] || '');
          setEditor5Value(parts.slice(4).join('\n----\n') || '');
          break;
        default:
          break;
      }
    }
  };

  // 前のログを選択
  const handlePrevLogButtonClick = () => {
    if (selectedLog) {
      const index = logs.indexOf(selectedLog);
      if (index < logs.length - 1) {
        handleSelectedLogChange(logs[index + 1].text);
      }
    } else {
      handleSelectedLogChange(logs[0].text);
    }
  };

  // 次のログを選択
  const handleNextLogButtonClick = () => {
    if (selectedLog) {
      const index = logs.indexOf(selectedLog);
      if (index > 0) {
        handleSelectedLogChange(logs[index - 1].text);
      }
    } else {
      handleSelectedLogChange(logs[0].text);
    }
  };

  // クリアボタンがクリックされたらエディターをクリア
  const handleClearButtonClick = () => {
    setEditor1Value('');
    setEditor2Value('');
    setEditor3Value('');
    setEditor4Value('');
    setEditor5Value('');
    setSelectedLog(null);
  };

  // コピーボタンがクリックされたらエディターの内容をクリップボードにコピー
  const handleCopyButtonClick = () => {
    const combinedEditorValue = getCombinedEditorValue();
    if (combinedEditorValue.trim() === '') {
      return;
    }
    navigator.clipboard.writeText(combinedEditorValue);
    toast('Copied to clipboard.');
  };

  const browserTabs = [
    { label: 'ChatGPT', index: 0 },
    { label: 'Gemini', index: 1 },
    { label: 'Claude', index: 2 },
    { label: 'Phind', index: 3 },
    { label: 'Perplexity', index: 4 },
    { label: 'Genspark', index: 5 },
    //{ label: 'AI Studio', index: 6 },
    { label: 'Felo', index: 6 },
    { label: 'JENOVA', index: 7 },
    { label: 'Cody', index: 8 },
  ];

  const fontSizeOptions = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

  return (
    <Box sx={{ height: '100vh', borderTop: 1, borderColor: theme.palette.divider }} component='main'>
      <Allotment ref={editorSplitRef}>
        <Allotment.Pane minSize={400} preferredSize={preferredSize}>
          <Box sx={{ height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tooltip title={`(Ctrl + Tab) to switch AI`} placement='right' arrow>
                <Tabs
                  value={browserIndex}
                  onChange={handleBrowserTabChange}
                  sx={{ borderBottom: 1, borderColor: theme.palette.divider }}
                  key='browser-tabs'
                >
                  {browserTabs.map(({ label, index }) => (
                    <BrowserTab
                      key={index}
                      isEditingBrowserShow={isEditingBrowserShow}
                      enabled={enabledBrowsers[index]}
                      setEnabledBrowsers={setEnabledBrowsers}
                      index={index}
                      label={label}
                      loading={browserLoadings[index]}
                      onClick={handleBrowserTabChange}
                    />
                  ))}
                </Tabs>
              </Tooltip>
              <Box>
                <Tooltip title={`Edit tabs`} placement='right' arrow>
                  <IconButton
                    onClick={() => setIsEditingBrowserShow(!isEditingBrowserShow)}
                    sx={{ color: isEditingBrowserShow ? theme.palette.primary.main : theme.palette.text.secondary }}
                  >
                    <Settings />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Box sx={{ height: 57 }}>
              <Box sx={{ height: '100%', p: 1, display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
                <Tooltip title='Reload' placement='top' arrow>
                  <IconButton onClick={() => window.electron.reloadCurrentView()}>
                    <ReplayOutlined sx={{ transform: 'scaleX(-1)', color: theme.palette.text.secondary }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title='Reload all tabs' placement='top' arrow>
                  <IconButton onClick={() => window.electron.reloadAllViews()} sx={{ mr: 1 }}>
                    <ReplayOutlined sx={{ transform: 'scaleX(-1)', color: theme.palette.text.secondary }} />
                    <Typography variant='subtitle2'>all</Typography>
                  </IconButton>
                </Tooltip>
                <TextField
                  value={browserUrls[browserIndex] || ''}
                  size='small'
                  fullWidth
                  sx={{
                    '& fieldset': {
                      borderColor:
                        theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23) !important' : 'rgba(0, 0, 0, 0.23) !important',
                    },
                    '& input': { color: theme.palette.text.secondary },
                  }}
                  disabled
                />
              </Box>
              <Divider />
            </Box>

            <Box sx={{ height: 'calc(100% - 100px)', textAlign: 'center' }} ref={browserRef}>
              <Box sx={{ height: '100%' }}>
                <CircularProgress sx={{ mt: 'calc(50% + 50px)' }} />
              </Box>
            </Box>
          </Box>
        </Allotment.Pane>
        <Allotment.Pane minSize={500}>
          <Box sx={{ height: '100%' }}>
            {isChipVisible && (
              <Chip
                label={`Update? v${latestVersion}`}
                color='primary'
                onClick={() => {
                  if (releasePageUrl) {
                    window.electron.openExternalLink(releasePageUrl);
                  }
                }}
                onDelete={() => setIsChipVisible(false)}
                sx={{ position: 'absolute', top: 0, right: 0, m: 1, zIndex: 1000 }}
              />
            )}
            <Tabs
              value={editorIndex}
              onChange={handleEditorTabChange}
              sx={{ borderBottom: 1, borderColor: theme.palette.divider }}
            >
              <Tab
                value={0}
                icon={<Split1Icon sx={{ fontSize: 22, color: editorIndex !== 0 ? theme.palette.action.disabled : undefined }} />}
              />
              <Tab
                value={1}
                icon={<Split2Icon sx={{ fontSize: 22, color: editorIndex !== 1 ? theme.palette.action.disabled : undefined }} />}
              />
              <Tab
                value={2}
                icon={<Split3Icon sx={{ fontSize: 22, color: editorIndex !== 2 ? theme.palette.action.disabled : undefined }} />}
              />
              <Tab
                value={3}
                icon={<Split4Icon sx={{ fontSize: 22, color: editorIndex !== 3 ? theme.palette.action.disabled : undefined }} />}
              />
              <Tab
                value={4}
                icon={<Split5Icon sx={{ fontSize: 22, color: editorIndex !== 4 ? theme.palette.action.disabled : undefined }} />}
              />
            </Tabs>
            <Box sx={{ w: '100%', p: 1 }}>
              <FormControl sx={{ width: 'calc(100% - 202px)' }}>
                <InputLabel size='small' sx={{ fontSize: 14 }}>
                  Logs
                </InputLabel>
                <Select
                  ref={promptHistoryRef}
                  label='Logs'
                  value={selectedLog ? selectedLog.text : ''}
                  onChange={(e) => {
                    handleSelectedLogChange(e.target.value);
                  }}
                  size='small'
                  sx={{
                    width: '100%',
                    '& .MuiListItemText-root': {
                      overflow: 'hidden',
                    },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { maxHeight: '30vh' } },
                  }}
                >
                  {logs.map((log) => (
                    <MenuItem key={log.id} value={log.text} sx={{ width: promptHistoryWidth }}>
                      <Typography noWrap sx={{ width: `calc(${promptHistoryWidth} - 10px` }} variant='body2'>
                        {log.text}
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Tooltip title={`Newer log (${commandKey} + ↑)`} arrow>
                <span>
                  <IconButton
                    ref={newerLogButtonRef}
                    size='small'
                    sx={{ width: 22, ml: 0.5 }}
                    disabled={selectedLog === logs[0] || !selectedLog || logs.length === 0}
                    onClick={handleNextLogButtonClick}
                  >
                    <KeyboardArrowUp />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={`Older log (${commandKey} + ↓)`} arrow>
                <span>
                  <IconButton
                    ref={olderLogButtonRef}
                    size='small'
                    sx={{ width: 22, mr: 0.5 }}
                    disabled={selectedLog === logs[logs.length - 1]}
                    onClick={handlePrevLogButtonClick}
                  >
                    <KeyboardArrowDown />
                  </IconButton>
                </span>
              </Tooltip>

              <FormControl>
                <InputLabel size='small' sx={{ fontSize: 14 }}>
                  Syntax highlighting
                </InputLabel>
                <Select
                  label='Syntax highlighting'
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    window.electron.sendLanguageToMain(e.target.value);
                  }}
                  size='small'
                  sx={{
                    right: 0,
                    width: 150,
                  }}
                  MenuProps={{
                    PaperProps: { sx: { maxHeight: '50vh' } },
                  }}
                >
                  {supportedLanguages.map((language) => (
                    <MenuItem key={language.id} value={language.name}>
                      <Typography noWrap variant='body2'>
                        {language.name}
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

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
              setBrowserIndexTimestamp={setBrowserIndexTimestamp}
              browserWidth={browserWidth}
              browserHeight={browserHeight}
              osInfo={osInfo}
            />

            <Box
              sx={{
                height: '50px',
                borderTop: 1,
                borderColor: theme.palette.divider,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControl>
                  <InputLabel size='small' sx={{ fontSize: 15 }}>
                    Font size
                  </InputLabel>
                  <Select
                    label='Font size'
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(e.target.value as number);
                      window.electron.sendFontSizeToMain(e.target.value as number);
                    }}
                    size='small'
                    sx={{
                      width: 80,
                      mx: 1,
                    }}
                    MenuProps={{
                      PaperProps: { sx: { maxHeight: '30vh' } },
                    }}
                  >
                    {fontSizeOptions.map((size) => (
                      <MenuItem key={size} value={size}>
                        <Typography variant='body2'>{size}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <MaterialUISwitch
                  checked={darkMode}
                  onChange={() => {
                    setDarkMode(!darkMode);
                    window.electron.sendIsDarkModeToMain(!darkMode);
                  }}
                />
                <Tooltip title={`Clear (${commandKey} + Backspace)`} arrow>
                  <Button
                    ref={clearButtonRef}
                    variant='outlined'
                    size='small'
                    sx={{ ml: 1 }}
                    startIcon={<EraseIcon />}
                    onClick={handleClearButtonClick}
                  >
                    Clear
                  </Button>
                </Tooltip>
              </Box>
              <Box>
                <Tooltip title={`Save log (${commandKey} + S)`} arrow>
                  <IconButton ref={saveButtonRef} color='primary' size='small' onClick={handleSaveButtonClick}>
                    <Save />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Copy to clipboard (${commandKey} + Shift + C)`} arrow>
                  <IconButton ref={copyButtonRef} color='primary' size='small' sx={{ mr: 1 }} onClick={handleCopyButtonClick}>
                    <ContentPaste />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Send to ${browserTabs[browserIndex].label} (${commandKey} + Enter)`} arrow>
                  <Button
                    ref={sendButtonRef}
                    variant='contained'
                    sx={{ width: 100, mr: 1 }}
                    startIcon={<Send sx={{ mr: -0.5 }} />}
                    onClick={() => handleSendButtonClick(false)}
                  >
                    {browserTabs[browserIndex].label}
                  </Button>
                </Tooltip>
                <Tooltip title={`Send to all tabs`} arrow>
                  <Button
                    variant='contained'
                    sx={{ width: 40, mr: 1 }}
                    startIcon={<Send sx={{ mr: -0.5 }} />}
                    onClick={() => handleSendButtonClick(true)}
                  >
                    All
                  </Button>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        </Allotment.Pane>
      </Allotment>
    </Box>
  );
};
