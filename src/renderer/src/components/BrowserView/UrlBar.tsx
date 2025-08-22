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

interface UrlBarProps {
  browserUrl: string;
  isTerminalActive: boolean;
}

export function UrlBar({ browserUrl, isTerminalActive }: UrlBarProps) {
  const theme = useTheme();

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
              onClick={() => window.electron.reloadCurrentView()}
              disabled={isTerminalActive}
            >
              <ReplayOutlined
                sx={{
                  transform: 'scaleX(-1)',
                  color: isTerminalActive
                    ? theme.palette.action.disabled
                    : theme.palette.text.secondary,
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Reload all tabs" placement="top" arrow>
          <span>
            <IconButton
              onClick={() => window.electron.reloadAllViews()}
              sx={{ mr: 1 }}
              disabled={isTerminalActive}
            >
              <ReplayOutlined
                sx={{
                  transform: 'scaleX(-1)',
                  color: isTerminalActive
                    ? theme.palette.action.disabled
                    : theme.palette.text.secondary,
                }}
              />
              <Typography
                variant="subtitle2"
                sx={{
                  color: isTerminalActive
                    ? theme.palette.action.disabled
                    : 'inherit',
                }}
              >
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
