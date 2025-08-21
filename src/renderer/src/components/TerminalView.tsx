import { useEffect, useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import '@xterm/xterm/css/xterm.css';
import { terminalService } from '../services/terminalService';

interface TerminalViewProps {
  terminalId: string;
}

export function TerminalView({ terminalId }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ターミナルのアタッチ/デタッチ
  useEffect(() => {
    console.log(`TerminalView useEffect called for ${terminalId}`);
    if (!terminalRef.current) {
      console.log(`terminalRef.current is null for ${terminalId}`);
      return;
    }

    // DOMにアタッチ
    terminalService.attachToDOM(terminalId, terminalRef.current);

    // クリーンアップ時はDOMからデタッチのみ（インスタンスは保持）
    return () => {
      console.log(`TerminalView cleanup called for ${terminalId}`);
      terminalService.detachFromDOM(terminalId);
    };
  }, [terminalId]);

  // リサイズハンドラー
  const handleResize = useCallback(() => {
    // 前回のタイマーをクリア
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    // デバウンス処理
    resizeTimeoutRef.current = setTimeout(() => {
      terminalService.resize(terminalId);
    }, 100);
  }, [terminalId]);

  // リサイズ監視
  useEffect(() => {
    if (!terminalRef.current) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    // 初回のリサイズを実行
    handleResize();

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1e1e1e',
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
            padding: '8px',
            textAlign: 'left',
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