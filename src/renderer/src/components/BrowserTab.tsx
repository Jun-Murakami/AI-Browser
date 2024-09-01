import React from 'react';
import { Box, Tab, Checkbox, CircularProgress } from '@mui/material';

interface BrowserTabProps {
  isEditingBrowserShow: boolean;
  enabled: boolean;
  setEnabledBrowsers: (callback: (prev: boolean[]) => boolean[]) => void;
  index: number;
  label: string;
  loading: boolean;
  onClick: (event: React.SyntheticEvent, index: number) => void;
}

export const BrowserTab: React.FC<BrowserTabProps> = ({
  isEditingBrowserShow,
  enabled,
  setEnabledBrowsers,
  index,
  label,
  loading,
  onClick,
}) => {
  return (
    <Tab
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
          {isEditingBrowserShow && (
            <Checkbox
              size='small'
              checked={enabled}
              onChange={(e) => {
                setEnabledBrowsers((prev) => {
                  const newEnabledBrowsers = [...prev];
                  newEnabledBrowsers[index] = e.target.checked;
                  window.electron.sendEnabledBrowsersToMain(newEnabledBrowsers);
                  return newEnabledBrowsers;
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          )}
          {label}
          {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
        </Box>
      }
      value={index}
      onClick={(event) => onClick(event, index)}
      sx={{ p: 0 }}
    />
  );
};

export default BrowserTab;
