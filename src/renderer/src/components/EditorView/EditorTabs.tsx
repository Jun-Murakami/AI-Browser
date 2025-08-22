import { InfoOutlined } from '@mui/icons-material';
import { Box, IconButton, Tab, Tabs, Tooltip } from '@mui/material';
import { useTheme } from '@mui/system';

import {
  Split1Icon,
  Split2Icon,
  Split3Icon,
  Split4Icon,
  Split5Icon,
} from '../Icons';

interface EditorTabsProps {
  editorIndex: number;
  onTabChange: (event: React.SyntheticEvent, index: number) => void;
  onLicenseClick: () => void;
}

export function EditorTabs({
  editorIndex,
  onTabChange,
  onLicenseClick,
}: EditorTabsProps) {
  const theme = useTheme();

  const tabConfigs = [
    { id: 'split1', icon: Split1Icon },
    { id: 'split2', icon: Split2Icon },
    { id: 'split3', icon: Split3Icon },
    { id: 'split4', icon: Split4Icon },
    { id: 'split5', icon: Split5Icon },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: 1,
        borderColor: theme.palette.divider,
      }}
    >
      <Tabs value={editorIndex} onChange={onTabChange} sx={{ flex: 1 }}>
        {tabConfigs.map((config, index) => {
          const IconComponent = config.icon;
          return (
            <Tab
              key={config.id}
              value={index}
              icon={
                <IconComponent
                  sx={{
                    fontSize: 22,
                    color:
                      editorIndex !== index
                        ? theme.palette.action.disabled
                        : undefined,
                  }}
                />
              }
            />
          );
        })}
      </Tabs>
      <Tooltip title="License Information" placement="left" arrow>
        <IconButton
          onClick={onLicenseClick}
          size="small"
          sx={{ mr: 1, color: theme.palette.text.secondary }}
        >
          <InfoOutlined />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
