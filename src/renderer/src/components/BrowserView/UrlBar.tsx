import { ReplayOutlined } from '@mui/icons-material';
import {
  Box,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/system';

import { terminalService } from '../../services/terminalService';

interface UrlBarProps {
  browserUrl: string;
  isTerminalActive: boolean;
  activeTabId: string | null;
}

export function UrlBar({
  browserUrl,
  isTerminalActive,
  activeTabId,
}: UrlBarProps) {
  const theme = useTheme();

  const handleReloadCurrent = () => {
    if (isTerminalActive) {
      if (activeTabId) {
        void terminalService.reloadInstance(activeTabId);
      }
    } else {
      window.electron.reloadCurrentView();
    }
  };

  const handleReloadAll = () => {
    if (isTerminalActive) {
      terminalService.reloadAllInstances();
    } else {
      window.electron.reloadAllViews();
    }
  };

  const reloadCurrentDisabled = isTerminalActive && !activeTabId;

  return (
    <Box sx={{ height: 57 }}>
      <Box
        sx={{
          height: '100%',
          p: 1,
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'row',
        }}
      >
        <Tooltip title="Reload" placement="top" arrow>
          <span>
            <IconButton
              onClick={handleReloadCurrent}
              disabled={reloadCurrentDisabled}
            >
              <ReplayOutlined
                sx={{
                  transform: 'scaleX(-1)',
                  color: reloadCurrentDisabled
                    ? theme.palette.action.disabled
                    : theme.palette.text.secondary,
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Reload all tabs" placement="top" arrow>
          <span>
            <IconButton onClick={handleReloadAll} sx={{ mr: 1 }}>
              <ReplayOutlined
                sx={{
                  transform: 'scaleX(-1)',
                  color: theme.palette.text.secondary,
                }}
              />
              <Typography variant="subtitle2" sx={{ color: 'inherit' }}>
                all
              </Typography>
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          value={browserUrl}
          size="small"
          fullWidth
          sx={{
            '& fieldset': {
              borderColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.23) !important'
                  : 'rgba(0, 0, 0, 0.23) !important',
            },
            '& input': { color: theme.palette.text.secondary },
          }}
          disabled
        />
      </Box>
      <Divider />
    </Box>
  );
}
