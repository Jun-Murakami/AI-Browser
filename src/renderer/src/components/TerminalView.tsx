import { useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import '@xterm/xterm/css/xterm.css';

import { terminalService } from '../services/terminalService';

interface TerminalViewProps {
  terminalId: string;
  isVisible?: boolean;
  isDarkMode?: boolean;
}

export function TerminalView({
  terminalId,
  isVisible = false,
  isDarkMode = true,
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ダークモードが変更されたときにテーマを更新
  useEffect(() => {
    terminalService.setTheme(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // ターミナルのアタッチ/デタッチ
  useEffect(() => {
    // 表示されていない場合は何もしない
    if (!isVisible) {
      return;
    }

    if (!terminalRef.current) {
      // 要素が未マウントの場合は何もしない（ログ抑制）
      return;
    }

    // DOMにアタッチ（遅延させて要素が完全にレンダリングされるのを待つ）
    const timeoutId = setTimeout(() => {
      if (terminalRef.current) {
        terminalService.attachToDOM(terminalId, terminalRef.current);
      }
    }, 100);

    // クリーンアップ時はDOMからデタッチのみ（インスタンスは保持）
    return () => {
      clearTimeout(timeoutId);
      terminalService.detachFromDOM(terminalId);
    };
  }, [terminalId, isVisible]);

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
          // xterm 内部のスタイルに干渉しない
          '& .xterm': {
            padding: 1,
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
