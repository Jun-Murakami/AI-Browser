import { forwardRef } from 'react';
import { Box, CircularProgress } from '@mui/material';

import { TerminalView } from '../TerminalView';

import type { Tab } from '../../types/tab.types';

interface ContentAreaProps {
  isTerminalActive: boolean;
  activeTabId: string | null;
  tabs: Tab[];
  isDarkMode?: boolean;
}

export const ContentArea = forwardRef<HTMLDivElement, ContentAreaProps>(
  ({ isTerminalActive, activeTabId, tabs, isDarkMode = true }, ref) => {
    return (
      <Box
        sx={{
          // 親（BrowserView）を flex column にし、残り領域をここで受ける
          flex: 1,
          minHeight: 0,
          textAlign: isTerminalActive ? 'left' : 'center',
          position: 'relative',
          // この領域自体はスクロールさせず、子（xterm など）に任せる
          overflow: 'hidden',
          backgroundColor: 'background.default',
        }}
        ref={ref}
      >
        {/* ブラウザビュー表示エリア */}
        <Box
          sx={{ display: isTerminalActive ? 'none' : 'block', height: '100%' }}
        >
          <CircularProgress sx={{ mt: 'calc(50% + 50px)' }} />
        </Box>

        {/* ターミナルビューを常にレンダリングし、表示/非表示をCSSで制御 */}
        {tabs
          .filter((tab) => tab.type === 'terminal')
          .map((terminal) => (
            <Box
              key={terminal.id}
              sx={{
                display:
                  isTerminalActive && activeTabId === terminal.id
                    ? 'flex'
                    : 'none',
                height: '100%',
                width: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex:
                  isTerminalActive && activeTabId === terminal.id ? 1 : -1,
                overflow: 'hidden',
                backgroundColor: 'background.default',
              }}
            >
              <TerminalView
                terminalId={terminal.id}
                isVisible={isTerminalActive && activeTabId === terminal.id}
                isDarkMode={isDarkMode}
              />
            </Box>
          ))}
      </Box>
    );
  },
);

ContentArea.displayName = 'ContentArea';
