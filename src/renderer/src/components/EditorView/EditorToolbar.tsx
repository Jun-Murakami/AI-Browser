import { useEffect, useRef, useState } from 'react';
import { ContentPaste, MenuOpen, Save, Send } from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Popper,
  Select,
  SvgIcon,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/system';

import { BROWSERS } from '../../constants/browsers';
import { EraseIcon } from '../Icons';
import { BoilerplatePanel } from './BoilerplatePanel';
import { MaterialUISwitch } from './DarkModeSwitch';

import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';
import type { RefObject } from 'react';
import type { Tab } from '../../types/tab.types';

// 紙飛行機2つ重ねアイコン
function SendAllIcon(props: React.ComponentProps<typeof SvgIcon>) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* 背面の紙飛行機（少し左上にオフセット、薄め） */}
      <path
        d="M2.01 3L2 10l13 2-13 2 .01 7L23 12 2.01 3z"
        opacity="0.4"
        transform="translate(-2, -2) scale(0.85)"
      />
      {/* 前面の紙飛行機 */}
      <path
        d="M2.01 3L2 10l13 2-13 2 .01 7L23 12 2.01 3z"
        transform="translate(2, 2) scale(0.85)"
      />
    </SvgIcon>
  );
}

interface EditorToolbarProps {
  fontSize: number;
  darkMode: boolean;
  commandKey: string;
  isInitialized: boolean;
  activeTab: Tab | null;
  isTerminalActive: boolean;
  fontSizeOptions: number[];
  sendTargets: Record<string, boolean>;
  browserLoadings: Record<string, boolean>;
  onFontSizeChange: (size: number) => void;
  onDarkModeToggle: () => void;
  onClearClick: () => void;
  onSaveClick: () => void;
  onCopyClick: () => void;
  onSendClick: (sendToAll: boolean) => void;
  onToggleSendTarget: (tabId: string) => void;
  boilerplates: Record<string, string>;
  boilerplateBank: 'A' | 'B' | 'C' | 'D' | 'E';
  onBoilerplateBankChange: (bank: 'A' | 'B' | 'C' | 'D' | 'E') => void;
  isCtrlHeld: boolean;
  isAltHeld: boolean;
  activeArrowKey: 'up' | 'down' | 'left' | 'right' | 'enter' | null;
  onBoilerplateChange: (key: string, text: string) => void;
  onInsertBoilerplate: (key: string) => void;
  onSendArrowKey: (
    direction: 'up' | 'down' | 'left' | 'right' | 'enter',
  ) => void;
  onSendControlKey: (key: string) => void;
  clearButtonRef: RefObject<HTMLButtonElement | null>;
  saveButtonRef: RefObject<HTMLButtonElement | null>;
  copyButtonRef: RefObject<HTMLButtonElement | null>;
  sendButtonRef: RefObject<HTMLButtonElement | null>;
  clearButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  saveButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  copyButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  sendButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
}

// 一括送信対象から除外するタブID
const EXCLUDED_SEND_TARGET_IDS = new Set(['NANI']);

export function EditorToolbar({
  fontSize,
  darkMode,
  commandKey,
  isInitialized,
  activeTab,
  isTerminalActive,
  fontSizeOptions,
  sendTargets,
  browserLoadings,
  onFontSizeChange,
  onDarkModeToggle,
  onClearClick,
  onSaveClick,
  onCopyClick,
  onSendClick,
  onToggleSendTarget,
  boilerplates,
  boilerplateBank,
  onBoilerplateBankChange,
  isCtrlHeld,
  isAltHeld,
  activeArrowKey,
  onBoilerplateChange,
  onInsertBoilerplate,
  onSendArrowKey,
  onSendControlKey,
  clearButtonRef,
  saveButtonRef,
  copyButtonRef,
  sendButtonRef,
  clearButtonTouchRippleRef,
  saveButtonTouchRippleRef,
  copyButtonTouchRippleRef,
  sendButtonTouchRippleRef,
}: EditorToolbarProps) {
  const theme = useTheme();
  const [popperOpen, setPopperOpen] = useState(false);
  const [boilerplateClickOpen, setBoilerplateClickOpen] = useState(false);
  const sendAllButtonRef = useRef<HTMLButtonElement>(null);
  const boilerplateButtonRef = useRef<HTMLButtonElement>(null);
  const boilerplatePaperRef = useRef<HTMLDivElement>(null);

  // ポップアップ外クリックで閉じる
  useEffect(() => {
    if (!boilerplateClickOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        boilerplatePaperRef.current?.contains(target) ||
        boilerplateButtonRef.current?.contains(target)
      ) {
        return;
      }
      setBoilerplateClickOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [boilerplateClickOpen]);
  const popperTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (popperTimeoutRef.current) {
      clearTimeout(popperTimeoutRef.current);
      popperTimeoutRef.current = null;
    }
    setPopperOpen(true);
  };

  const handleMouseLeave = () => {
    popperTimeoutRef.current = setTimeout(() => {
      setPopperOpen(false);
    }, 200);
  };

  const isBoilerplateOpen = isCtrlHeld || boilerplateClickOpen;

  // 一括送信対象のブラウザタブ（ターミナルとNANIを除外）
  const sendTargetBrowsers = BROWSERS.filter(
    (b) => !EXCLUDED_SEND_TARGET_IDS.has(b.id),
  );

  // チェックされている送信対象の数
  const checkedCount = sendTargetBrowsers.filter(
    (b) => sendTargets[b.id] !== false,
  ).length;

  // チェックされた送信対象のうち、まだ読み込み中のものがあるか
  const isAnyTargetLoading = sendTargetBrowsers.some(
    (b) => sendTargets[b.id] !== false && browserLoadings[b.id],
  );

  return (
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
          <InputLabel size="small" sx={{ fontSize: 15 }}>
            Font size
          </InputLabel>
          <Select
            label="Font size"
            value={fontSize}
            onChange={(e) => onFontSizeChange(e.target.value as number)}
            size="small"
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
                <Typography variant="body2">{size}</Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <MaterialUISwitch checked={darkMode} onChange={onDarkModeToggle} />
        <Tooltip title={`Clear (${commandKey} + Backspace)`} arrow>
          <Button
            ref={clearButtonRef}
            touchRippleRef={clearButtonTouchRippleRef}
            variant="outlined"
            size="small"
            sx={{ ml: 1 }}
            startIcon={<EraseIcon />}
            onClick={onClearClick}
          >
            Clear
          </Button>
        </Tooltip>
      </Box>
      <Box>
        <Tooltip title={`Boilerplate (${commandKey} + *)`} arrow>
          <IconButton
            ref={boilerplateButtonRef}
            color="primary"
            size="small"
            onClick={() => setBoilerplateClickOpen((prev) => !prev)}
          >
            <MenuOpen />
          </IconButton>
        </Tooltip>
        <Popper
          open={isBoilerplateOpen}
          anchorEl={boilerplateButtonRef.current}
          placement="top"
          sx={{ zIndex: 9999 }}
        >
          <Paper
            ref={boilerplatePaperRef}
            elevation={8}
            sx={{
              p: 1.5,
              mb: 1,
              maxHeight: '60vh',
              overflowY: 'auto',
              width: 360,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <BoilerplatePanel
              commandKey={commandKey}
              boilerplates={boilerplates}
              boilerplateBank={boilerplateBank}
              isTerminalActive={isTerminalActive}
              isAltHeld={isAltHeld}
              activeArrowKey={activeArrowKey}
              onBoilerplateBankChange={onBoilerplateBankChange}
              onBoilerplateChange={onBoilerplateChange}
              onInsertBoilerplate={onInsertBoilerplate}
              onClosePanel={() => setBoilerplateClickOpen(false)}
              onSendArrowKey={onSendArrowKey}
              onSendControlKey={onSendControlKey}
            />
          </Paper>
        </Popper>
        <Tooltip title={`Save log (${commandKey} + S)`} arrow>
          <IconButton
            ref={saveButtonRef}
            touchRippleRef={saveButtonTouchRippleRef}
            color="primary"
            size="small"
            onClick={onSaveClick}
          >
            <Save />
          </IconButton>
        </Tooltip>
        <Tooltip title={`Copy to clipboard (${commandKey} + Shift + C)`} arrow>
          <IconButton
            ref={copyButtonRef}
            touchRippleRef={copyButtonTouchRippleRef}
            color="primary"
            size="small"
            sx={{ mr: 1 }}
            onClick={onCopyClick}
          >
            <ContentPaste />
          </IconButton>
        </Tooltip>
        {isInitialized && activeTab ? (
          <>
            <Tooltip
              title={`Send to ${activeTab.label} (${commandKey} + Enter)`}
              arrow
            >
              <Button
                ref={sendButtonRef}
                touchRippleRef={sendButtonTouchRippleRef}
                variant="contained"
                sx={{ width: 100, mr: 1 }}
                startIcon={<Send sx={{ mr: -0.5 }} />}
                onClick={() => onSendClick(false)}
              >
                {activeTab.label}
              </Button>
            </Tooltip>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: hover container for popper */}
            <span
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <Button
                ref={sendAllButtonRef}
                variant="contained"
                sx={{ width: 40, mr: 1 }}
                startIcon={
                  isAnyTargetLoading ? (
                    <CircularProgress
                      size={18}
                      color="inherit"
                      sx={{ mr: -0.5 }}
                    />
                  ) : (
                    <SendAllIcon sx={{ mr: -0.5 }} />
                  )
                }
                onClick={() => onSendClick(true)}
                disabled={
                  isTerminalActive || checkedCount === 0 || isAnyTargetLoading
                }
              >
                {isAnyTargetLoading ? '' : checkedCount}
              </Button>
              <Popper
                open={popperOpen && !isTerminalActive}
                anchorEl={sendAllButtonRef.current}
                placement="top-end"
                sx={{ zIndex: 1300 }}
              >
                <Paper
                  elevation={8}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    maxHeight: '60vh',
                    overflowY: 'auto',
                  }}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 'bold',
                      display: 'block',
                      mb: 0.5,
                      px: 1,
                    }}
                  >
                    Send targets
                  </Typography>
                  {sendTargetBrowsers.map((browser) => (
                    <FormControlLabel
                      key={browser.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={sendTargets[browser.id] !== false}
                          onChange={() => onToggleSendTarget(browser.id)}
                        />
                      }
                      label={
                        <Typography variant="body2">{browser.label}</Typography>
                      }
                      sx={{
                        display: 'flex',
                        mx: 0,
                        '& .MuiFormControlLabel-label': { fontSize: '0.85rem' },
                      }}
                    />
                  ))}
                </Paper>
              </Popper>
            </span>
          </>
        ) : (
          <>
            <Button
              ref={sendButtonRef}
              variant="contained"
              sx={{ width: 100, mr: 1 }}
              startIcon={<Send sx={{ mr: -0.5 }} />}
              disabled
            >
              Send
            </Button>
            <Button
              variant="contained"
              sx={{ width: 40, mr: 1 }}
              startIcon={<SendAllIcon sx={{ mr: -0.5 }} />}
              disabled
            >
              0
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
