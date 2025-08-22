import { Settings } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  IconButton,
  Tabs,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/system';

import BrowserTab from './BrowserTab';

import type { Tab as TabType } from '../../types/tab.types';

interface TabBarProps {
  isInitialized: boolean;
  visibleTabs: TabType[];
  activeTabId: string | null;
  isEditingBrowserShow: boolean;
  browserLoadings: boolean[];
  onTabChange: (event: React.SyntheticEvent, index: number) => void;
  onToggleEditMode: () => void;
  onToggleTabEnabled: (tabId: string) => void;
}

export function TabBar({
  isInitialized,
  visibleTabs,
  activeTabId,
  isEditingBrowserShow,
  browserLoadings,
  onTabChange,
  onToggleEditMode,
  onToggleTabEnabled,
}: TabBarProps) {
  const theme = useTheme();

  return (
    <Box
      aria-label="Browser tabs container"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      <Tooltip
        title="(Ctrl + Tab) to switch AI"
        placement="right"
        arrow
        slotProps={{
          popper: {
            modifiers: [
              {
                name: 'offset',
                options: {
                  offset: [0, 40],
                },
              },
            ],
          },
        }}
      >
        {isInitialized && visibleTabs.length > 0 ? (
          <Box sx={{ position: 'relative', width: 'calc(100% - 48px)' }}>
            <Tabs
              value={visibleTabs.findIndex((tab) => tab.id === activeTabId)}
              onChange={onTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: 1,
                borderColor: theme.palette.divider,
                '& .MuiTabs-scrollButtons': {
                  '&.Mui-disabled': {
                    opacity: 0.3,
                  },
                },
              }}
              key="browser-tabs"
            >
              {visibleTabs.map((tab, index) => (
                <BrowserTab
                  key={tab.id}
                  isEditingBrowserShow={isEditingBrowserShow}
                  enabled={tab.enabled !== false}
                  setEnabledBrowsers={() => onToggleTabEnabled(tab.id)}
                  index={index}
                  label={tab.label}
                  loading={
                    tab.type === 'browser' ? browserLoadings[index] : false
                  }
                  onClick={onTabChange}
                  icon={'IconComponent' in tab ? tab.IconComponent : null}
                  tabId={tab.id}
                  isTerminal={tab.type === 'terminal'}
                />
              ))}
            </Tabs>
          </Box>
        ) : (
          <Box
            sx={{
              borderBottom: 1,
              borderColor: theme.palette.divider,
              width: '100%',
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}
      </Tooltip>
      <Box>
        <Tooltip title="Edit tabs" placement="right" arrow>
          <IconButton
            onClick={onToggleEditMode}
            sx={{
              color: isEditingBrowserShow
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
            }}
          >
            <Settings />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
