import { ContentPaste, Save, Send } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/system';

import { EraseIcon } from '../Icons';
import { MaterialUISwitch } from './DarkModeSwitch';

import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';
import type { RefObject } from 'react';
import type { Tab } from '../../types/tab.types';

interface EditorToolbarProps {
  fontSize: number;
  darkMode: boolean;
  commandKey: string;
  isInitialized: boolean;
  activeTab: Tab | null;
  isTerminalActive: boolean;
  fontSizeOptions: number[];
  onFontSizeChange: (size: number) => void;
  onDarkModeToggle: () => void;
  onClearClick: () => void;
  onSaveClick: () => void;
  onCopyClick: () => void;
  onSendClick: (sendToAll: boolean) => void;
  clearButtonRef: RefObject<HTMLButtonElement | null>;
  saveButtonRef: RefObject<HTMLButtonElement | null>;
  copyButtonRef: RefObject<HTMLButtonElement | null>;
  sendButtonRef: RefObject<HTMLButtonElement | null>;
  clearButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  saveButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  copyButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
  sendButtonTouchRippleRef: RefObject<TouchRippleActions | null>;
}

export function EditorToolbar({
  fontSize,
  darkMode,
  commandKey,
  isInitialized,
  activeTab,
  isTerminalActive,
  fontSizeOptions,
  onFontSizeChange,
  onDarkModeToggle,
  onClearClick,
  onSaveClick,
  onCopyClick,
  onSendClick,
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
            <Tooltip
              title={
                isTerminalActive
                  ? 'All button is disabled for terminal tabs'
                  : 'Send to all browser tabs'
              }
              arrow
            >
              <span>
                <Button
                  variant="contained"
                  sx={{ width: 40, mr: 1 }}
                  startIcon={<Send sx={{ mr: -0.5 }} />}
                  onClick={() => onSendClick(true)}
                  disabled={isTerminalActive}
                >
                  All
                </Button>
              </span>
            </Tooltip>
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
              startIcon={<Send sx={{ mr: -0.5 }} />}
              disabled
            >
              All
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
