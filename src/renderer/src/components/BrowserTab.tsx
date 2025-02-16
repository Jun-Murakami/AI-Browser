import { Box, Tab, Checkbox, CircularProgress } from '@mui/material';
import { ChatGPTIcon, GeminiIcon, ClaudeIcon, DeepSeekIcon, AIStudioIcon } from './Icons';

interface BrowserTabProps {
  isEditingBrowserShow: boolean;
  enabled: boolean;
  setEnabledBrowsers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  index: number;
  label: string;
  loading: boolean;
  onClick: (event: React.MouseEvent, index: number) => void;
}

export const BrowserTab = ({
  isEditingBrowserShow,
  enabled,
  setEnabledBrowsers,
  index,
  label,
  loading,
  onClick,
}: BrowserTabProps) => {
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnabledBrowsers((prev) => {
      const newEnabledBrowsers = { ...prev };
      newEnabledBrowsers[label.toUpperCase()] = e.target.checked;
      
      // 全てのブラウザが無効になることを防ぐ
      if (Object.values(newEnabledBrowsers).every((enabled) => !enabled)) {
        newEnabledBrowsers[label.toUpperCase()] = true;
      }
      
      // boolean[]に変換してメインプロセスに送信
      const enabledArray = Object.values(newEnabledBrowsers);
      window.electron.sendEnabledBrowsersToMain(enabledArray);
      
      return newEnabledBrowsers;
    });
  };

  const isIconOnly = ['ChatGPT', 'Gemini', 'AIStudio', 'Claude', 'DeepSeek'].includes(label);

  const renderTabContent = () => {
    if (isEditingBrowserShow) {
      return (
        <>
          <Checkbox
            size='small'
            checked={enabled}
            onChange={handleCheckboxChange}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
          {label === 'ChatGPT' ? (
            <ChatGPTIcon sx={{ fontSize: 18 }} />
          ) : label === 'Gemini' ? (
            <GeminiIcon sx={{ fontSize: 18 }} />
          ) : label === 'AIStudio' ? (
            <AIStudioIcon sx={{ fontSize: 18 }} />
          ) : label === 'Claude' ? (
            <ClaudeIcon sx={{ fontSize: 18 }} />
          ) : label === 'DeepSeek' ? (
            <DeepSeekIcon sx={{ fontSize: 20 }} />
          ) : (
            label
          )}
        </>
      );
    }

    // アイコンのみ表示するタブの場合
    if (label === 'ChatGPT') {
      return <ChatGPTIcon sx={{ fontSize: 18 }} />;
    }
    if (label === 'Gemini') {
      return <GeminiIcon sx={{ fontSize: 18 }} />;
    }
    if (label === 'AIStudio') {
      return <AIStudioIcon sx={{ fontSize: 18 }} />;
    }
    if (label === 'Claude') {
      return <ClaudeIcon sx={{ fontSize: 18 }} />;
    }
    if (label === 'DeepSeek') {
      return <DeepSeekIcon sx={{ fontSize: 20 }} />;
    }

    // その他のタブは通常通りラベルを表示
    return label;
  };

  return (
    <Tab
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
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
        minWidth: isIconOnly ? '64px !important' : undefined,
        width: isIconOnly ? '64px !important' : undefined,
      }}
    />
  );
};

export default BrowserTab;
