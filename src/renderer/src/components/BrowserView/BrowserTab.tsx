import { Box, Checkbox, CircularProgress, Tab } from '@mui/material';

import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';

interface BrowserTabProps {
  isEditingBrowserShow: boolean;
  enabled: boolean;
  setEnabledBrowsers: () => void;
  index: number;
  label: string;
  loading: boolean;
  onClick: (event: React.MouseEvent, index: number) => void;
  icon?: ComponentType<SvgIconProps> | null;
  tabId?: string;
  isTerminal?: boolean;
}

export const BrowserTab = ({
  isEditingBrowserShow,
  enabled,
  setEnabledBrowsers,
  index,
  label,
  loading,
  onClick,
  icon: IconComponent,
  isTerminal,
}: BrowserTabProps) => {
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setEnabledBrowsers();
  };

  const hasIcon = IconComponent !== null && IconComponent !== undefined;

  // ターミナルの番号を抽出（例: "Terminal1" → "1"）
  const terminalNumber = isTerminal ? label.replace(/[^0-9]/g, '') : '';

  const renderTabContent = () => {
    if (isEditingBrowserShow) {
      return (
        <>
          <Checkbox
            size="small"
            checked={enabled}
            onChange={handleCheckboxChange}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
          {hasIcon && IconComponent ? (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
              <IconComponent sx={{ fontSize: 18 }} />
              {isTerminal && terminalNumber && (
                <Box sx={{ ml: 0.5, fontSize: '14px', fontWeight: 600 }}>
                  {terminalNumber}
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ ml: 1 }}>{label}</Box>
          )}
        </>
      );
    }

    // 通常表示時
    if (hasIcon && IconComponent) {
      if (isTerminal && terminalNumber) {
        // ターミナルの場合: アイコン + 番号
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconComponent sx={{ fontSize: 18 }} />
            <Box sx={{ ml: 0.5, fontSize: '14px', fontWeight: 600 }}>
              {terminalNumber}
            </Box>
          </Box>
        );
      }
      // ブラウザの場合: アイコンのみ
      return <IconComponent sx={{ fontSize: 18 }} />;
    }

    return label;
  };

  return (
    <Tab
      label={
        <Box
          sx={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}
        >
          {renderTabContent()}
          {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
        </Box>
      }
      value={index}
      onClick={(event) => {
        onClick(event, index);
      }}
      sx={{
        p: 0,
        display: enabled || isEditingBrowserShow ? 'flex' : 'none',
        minWidth:
          hasIcon && !isEditingBrowserShow ? '64px !important' : undefined,
        width: hasIcon && !isEditingBrowserShow ? '64px !important' : undefined,
      }}
    />
  );
};

export default BrowserTab;
