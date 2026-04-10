import { forwardRef } from 'react';
import { Box, CircularProgress } from '@mui/material';

import { TerminalView } from '../TerminalView';

import type { Tab } from '../../types/tab.types';

interface ContentAreaProps {
  isTerminalActive: boolean;
  activeTabId: string | null;
  tabs: Tab[];
}

export const ContentArea = forwardRef<HTMLDivElement, ContentAreaProps>(
  ({ isTerminalActive, activeTabId, tabs }, ref) => {
    return (
      <Box
        sx={{
          height: 'calc(100% - 100px)',
          textAlign: isTerminalActive ? 'left' : 'center',
          position: 'relative',
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
              }}
            >
              <TerminalView
                terminalId={terminal.id}
                isVisible={isTerminalActive && activeTabId === terminal.id}
              />
            </Box>
          ))}
      </Box>
    );
  },
);

ContentArea.displayName = 'ContentArea';
