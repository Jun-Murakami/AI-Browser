import { Clear, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/system';

import { useResizeObserver } from '../../hooks/useResizeObserver';

import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';
import type { RefObject } from 'react';
import type { Log } from '../../types/log.types';

interface LogSelectorProps {
  logs: Log[];
  selectedLog: Log | null;
  commandKey: string;
  onSelectLog: (logId: number) => void;
  onDeleteLog: (logId: number, event: React.MouseEvent) => void;
  onNextLog: () => void;
  onPreviousLog: () => void;
  language: string;
  supportedLanguages: Array<{ id: string; aliases?: string[] }>;
  onLanguageChange: (language: string) => void;
  newerLogButtonRef?: RefObject<HTMLButtonElement | null>;
  olderLogButtonRef?: RefObject<HTMLButtonElement | null>;
  newerLogButtonTouchRippleRef?: RefObject<TouchRippleActions | null>;
  olderLogButtonTouchRippleRef?: RefObject<TouchRippleActions | null>;
}

export function LogSelector({
  logs,
  selectedLog,
  commandKey,
  onSelectLog,
  onDeleteLog,
  onNextLog,
  onPreviousLog,
  language,
  supportedLanguages,
  onLanguageChange,
  newerLogButtonRef,
  olderLogButtonRef,
  newerLogButtonTouchRippleRef,
  olderLogButtonTouchRippleRef,
}: LogSelectorProps) {
  const theme = useTheme();
  const { ref: promptHistoryRef, width: promptHistoryWidth } =
    useResizeObserver<HTMLSelectElement>();

  return (
    <Box sx={{ w: '100%', p: 1 }}>
      <FormControl sx={{ width: 'calc(100% - 202px)' }}>
        <InputLabel size="small" sx={{ fontSize: 14 }}>
          Logs
        </InputLabel>
        <Select
          ref={promptHistoryRef}
          label="Logs"
          value={selectedLog ? selectedLog.id : ''}
          onChange={(e) => {
            const logId = e.target.value as number;
            if (logId) {
              onSelectLog(logId);
            }
          }}
          size="small"
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
            <MenuItem
              key={log.id}
              value={log.id}
              sx={{
                width: promptHistoryWidth,
                position: 'relative',
                '&:hover .delete-button': {
                  opacity: 1,
                },
              }}
            >
              <Typography
                noWrap
                sx={{ width: `calc(${promptHistoryWidth}px - 40px)` }}
                variant="body2"
              >
                {log.displayText}
              </Typography>
              <IconButton
                className="delete-button"
                size="small"
                onClick={(e) => onDeleteLog(log.id, e)}
                sx={{
                  position: 'absolute',
                  right: 8,
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.error.main,
                  },
                }}
              >
                <Clear fontSize="small" />
              </IconButton>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Tooltip title={`Newer log (${commandKey} + ↑)`} arrow>
        <span>
          <IconButton
            ref={newerLogButtonRef}
            touchRippleRef={newerLogButtonTouchRippleRef}
            size="small"
            sx={{ width: 22, ml: 0.5 }}
            disabled={
              selectedLog === logs[0] || !selectedLog || logs.length === 0
            }
            onClick={onNextLog}
          >
            <KeyboardArrowUp />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={`Older log (${commandKey} + ↓)`} arrow>
        <span>
          <IconButton
            ref={olderLogButtonRef}
            touchRippleRef={olderLogButtonTouchRippleRef}
            size="small"
            sx={{ width: 22, mr: 0.5 }}
            disabled={selectedLog === logs[logs.length - 1]}
            onClick={onPreviousLog}
          >
            <KeyboardArrowDown />
          </IconButton>
        </span>
      </Tooltip>

      <FormControl>
        <InputLabel size="small" sx={{ fontSize: 14 }}>
          Syntax highlighting
        </InputLabel>
        <Select
          label="Syntax highlighting"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          size="small"
          sx={{
            right: 0,
            width: 150,
          }}
          MenuProps={{
            PaperProps: { sx: { maxHeight: '50vh' } },
          }}
        >
          {supportedLanguages.map((lang) => (
            <MenuItem key={lang.id} value={lang.id}>
              <Typography noWrap variant="body2">
                {lang.aliases?.[0] || lang.id}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
