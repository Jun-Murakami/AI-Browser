import { useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import '@xterm/xterm/css/xterm.css';

import { terminalService } from '../services/terminalService';

interface TerminalViewProps {
  terminalId: string;
  isVisible?: boolean;
}

export function TerminalView({
  terminalId,
  isVisible = false,
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // リサイズハンドラー
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = setTimeout(() => {
      terminalService.resize(terminalId);
    }, 100);
  }, [terminalId]);

  // ターミナルのアタッチ/デタッチ + リサイズ監視（一括セットアップ）
  const handleResizeRef = useRef(handleResize);
  handleResizeRef.current = handleResize;
  useEffect(() => {
    if (!isVisible || !terminalRef.current) return;

    const element = terminalRef.current;

    // DOMにアタッチ（遅延させて要素が完全にレンダリングされるのを待つ）
    const attachTimeout = setTimeout(() => {
      terminalService.attachToDOM(terminalId, element);
    }, 100);

    // リサイズ監視
    const onResize = () => handleResizeRef.current();
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(element);
    onResize();

    return () => {
      clearTimeout(attachTimeout);
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      terminalService.detachFromDOM(terminalId);
    };
  }, [terminalId, isVisible]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: 'background.default',
        color: 'text.primary',
        borderTop: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <Box
        ref={terminalRef}
        sx={{
          width: '100%',
          height: '100%',
          '& .xterm': {
            padding: 0,
            margin: 0,
          },
          '& .xterm-viewport': {
            textAlign: 'left',
          },
          '& .xterm-screen': {
            textAlign: 'left',
          },
        }}
      />
    </Box>
  );
}

// クリーンアップ関数をエクスポート
export function cleanupAllTerminals() {
  terminalService.cleanup();
}
