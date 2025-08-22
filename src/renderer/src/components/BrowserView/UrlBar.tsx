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
}

export function UrlBar({ browserUrl }: UrlBarProps) {
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
          <IconButton onClick={() => window.electron.reloadCurrentView()}>
            <ReplayOutlined
              sx={{
                transform: 'scaleX(-1)',
                color: theme.palette.text.secondary,
              }}
            />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reload all tabs" placement="top" arrow>
          <IconButton
            onClick={() => window.electron.reloadAllViews()}
            sx={{ mr: 1 }}
          >
            <ReplayOutlined
              sx={{
                transform: 'scaleX(-1)',
                color: theme.palette.text.secondary,
              }}
            />
            <Typography variant="subtitle2">all</Typography>
          </IconButton>
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
