import React, { useState, useRef, useEffect } from 'react';
import useResizeObserver from 'use-resize-observer';
import { Allotment, AllotmentHandle } from 'allotment';
import 'allotment/dist/style.css';
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
} from '@mui/material';
import { useTheme } from '@mui/system';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SendIcon from '@mui/icons-material/Send';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { supportedLanguages } from '../utils/supportedLanguages';
import { MonacoEditors } from './MonacoEditors';
import { MaterialUISwitch } from './DarkModeSwitch';

interface HomePageProps {
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
}

interface Log {
  id: number;
  text: string;
}

export const HomePage = ({ darkMode, setDarkMode }: HomePageProps) => {
  const [browserIndex, setBrowserIndex] = useState(4);
  const [editorIndex, setEditorIndex] = useState(0);
  const [language, setLanguage] = useState('text');
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

  const theme = useTheme();

  const browserRef = useRef<HTMLDivElement>(null);
  const promptHistoryRef = useRef<HTMLSelectElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const newerLogButtonRef = useRef<HTMLButtonElement>(null);
  const olderLogButtonRef = useRef<HTMLButtonElement>(null);
  const editorSplitRef = useRef<AllotmentHandle>(null!);

  const { width: browserWidth, height: browserHeight } = useResizeObserver<HTMLDivElement>({ ref: browserRef });
  const { width: promptHistoryWidth } = useResizeObserver<HTMLSelectElement>({ ref: promptHistoryRef });

  useEffect(() => {
    if (!browserWidth || !browserHeight) {
      return;
    }
    window.electron.sendBrowserSizeToMain({ width: browserWidth, height: browserHeight });
  }, [browserWidth, browserHeight]);

  const handleBrowserTabChange = (_: React.SyntheticEvent, index: number) => {
    setBrowserIndex(index);
    window.electron.sendBrowserTabIndexToMain(index);
  };

  const handleEditorTabChange = (_: React.SyntheticEvent, index: number) => {
    setEditorIndex(index);
    window.electron.sendEditorModeToMain(index);
  };

  useEffect(() => {
    if (browserIndex < 3) {
      const newBrowserIndex = browserIndex + 1;
      setBrowserIndex(newBrowserIndex);
      window.electron.sendBrowserTabIndexToMain(newBrowserIndex);
    } else {
      setBrowserIndex(0);
      window.electron.sendBrowserTabIndexToMain(0);
    }
  }, [browserIndexTimestamp]);

  useEffect(() => {
    window.electron
      .getInitialSettings()
      .then((settings) => {
        setDarkMode(settings.isDarkMode);
        setEditorIndex(settings.editorMode);
        setPreferredSize(settings.browserWidth);
        setTimeout(() => {
          editorSplitRef.current.reset();
          setLogs(settings.logs);
          if (settings.logs.length === 0) {
            setEditor1Value('Type your message here.');
          }
          setLanguage(settings.language);
          // OS情報に基づいてコマンドキーを設定
          const commandKey = settings.osInfo === 'darwin' ? 'Cmd' : 'Ctrl';
          setCommandKey(commandKey);
        }, 100);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

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
    if (logs.length >= 50) {
      const newLogs = logs.slice(0, 49);
      setLogs([newLog, ...newLogs]);
      setSelectedLog(null);
      return [newLog, ...newLogs];
    } else {
      setLogs([newLog, ...logs]);
      setSelectedLog(null);
      return [newLog, ...logs];
    }
  };

  const handleSendButtonClick = () => {
    const combinedEditorValue = getCombinedEditorValue();
    if (combinedEditorValue.trim() === '') {
      return;
    }
    window.electron.sendTextToMain(combinedEditorValue);
    const newLogs = addLog(combinedEditorValue);
    if (newLogs) {
      window.electron.sendLogsToMain(newLogs);
    }
    handleClearButtonClick();
  };

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

  const handleClearButtonClick = () => {
    setEditor1Value('');
    setEditor2Value('');
    setEditor3Value('');
    setEditor4Value('');
    setEditor5Value('');
    setSelectedLog(null);
  };

  const handleCopyButtonClick = () => {
    const combinedEditorValue = getCombinedEditorValue();
    navigator.clipboard.writeText(combinedEditorValue);
  };

  return (
    <Box sx={{ height: '100vh', borderTop: 1, borderColor: theme.palette.divider }}>
      <Allotment ref={editorSplitRef}>
        <Allotment.Pane minSize={400} preferredSize={preferredSize}>
          <Box sx={{ height: '100%' }}>
            <Tooltip title={`(Shift + Tab) to switch AI`} placement='right' arrow>
              <Tabs
                value={browserIndex}
                onChange={handleBrowserTabChange}
                sx={{ borderBottom: 1, borderColor: theme.palette.divider }}
                key='browser-tabs'
              >
                <Tab label='ChatGPT' value={0} />
                <Tab label='Gemini' value={1} />
                <Tab label='Claude' value={2} />
                <Tab label='Phind' value={3} />
              </Tabs>
            </Tooltip>
            <Box sx={{ height: 'calc(100% - 50px)', textAlign: 'center' }} ref={browserRef}>
              <Box sx={{ height: '100%' }}>
                <CircularProgress sx={{ mt: 'calc(50% + 50px)' }} />
              </Box>
            </Box>
          </Box>
        </Allotment.Pane>
        <Allotment.Pane minSize={500}>
          <Box sx={{ height: '100%' }}>
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
                    <KeyboardArrowUpIcon />
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
                    <KeyboardArrowDownIcon />
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
              newerLogButtonRef={newerLogButtonRef}
              olderLogButtonRef={olderLogButtonRef}
              setBrowserIndexTimestamp={setBrowserIndexTimestamp}
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
              <Box>
                <MaterialUISwitch
                  checked={darkMode}
                  onChange={() => {
                    setDarkMode(!darkMode);
                    window.electron.sendIsDarkModeToMain(!darkMode);
                  }}
                />
                <Tooltip title={`(${commandKey} + Backspace)`} arrow>
                  <Button
                    ref={clearButtonRef}
                    variant='outlined'
                    size='small'
                    sx={{ textTransform: 'none', ml: 0 }}
                    startIcon={<EraseIcon />}
                    onClick={handleClearButtonClick}
                  >
                    Clear
                  </Button>
                </Tooltip>
              </Box>
              <Box>
                <Tooltip title={`(${commandKey} + Shift + C)`} arrow>
                  <Button
                    ref={copyButtonRef}
                    variant='outlined'
                    size='small'
                    sx={{ textTransform: 'none', mr: 1 }}
                    startIcon={<ContentPasteIcon />}
                    onClick={handleCopyButtonClick}
                  >
                    Copy
                  </Button>
                </Tooltip>
                <Tooltip title={`(${commandKey} + Enter)`} arrow>
                  <Button
                    ref={sendButtonRef}
                    variant='contained'
                    sx={{ width: 180, textTransform: 'none', mr: 1 }}
                    startIcon={<SendIcon />}
                    onClick={handleSendButtonClick}
                  >
                    Send to{' '}
                    {browserIndex === 0 ? 'ChatGPT' : browserIndex === 1 ? 'Gemini' : browserIndex === 2 ? 'Claude' : 'Phind'}
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
