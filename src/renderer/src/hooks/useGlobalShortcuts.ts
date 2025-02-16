import { useEffect } from 'react';
import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';

interface UseGlobalShortcutsProps {
  sendButtonRef: React.RefObject<HTMLButtonElement | null>;
  saveButtonRef: React.RefObject<HTMLButtonElement | null>;
  copyButtonRef: React.RefObject<HTMLButtonElement | null>;
  clearButtonRef: React.RefObject<HTMLButtonElement | null>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  sendButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  copyButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  clearButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  saveButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  newerLogButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  olderLogButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  setBrowserIndexTimestamp: (timestamp: number) => void;
  osInfo: string;
}

export const useGlobalShortcuts = ({
  sendButtonRef,
  saveButtonRef,
  copyButtonRef,
  clearButtonRef,
  newerLogButtonRef,
  olderLogButtonRef,
  sendButtonTouchRippleRef,
  copyButtonTouchRippleRef,
  clearButtonTouchRippleRef,
  saveButtonTouchRippleRef,
  newerLogButtonTouchRippleRef,
  olderLogButtonTouchRippleRef,
  setBrowserIndexTimestamp,
  osInfo,
}: UseGlobalShortcutsProps) => {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // MonacoEditorにフォーカスがある場合は処理をスキップ
      const activeElement = document.activeElement;
      if (activeElement?.classList.contains('monaco-editor')) {
        return;
      }

      const isMac = osInfo === 'darwin';
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Send command (Cmd/Ctrl + Enter)
      if (cmdKey && e.key === 'Enter') {
        e.preventDefault();
        sendButtonRef.current?.focus();
        sendButtonTouchRippleRef.current?.start();
        sendButtonRef.current?.click();
        setTimeout(() => {
          sendButtonTouchRippleRef.current?.stop();
        }, 200);
      }

      // Save command (Cmd/Ctrl + S)
      if (cmdKey && e.key === 's') {
        e.preventDefault();
        saveButtonRef.current?.focus();
        saveButtonTouchRippleRef.current?.start();
        saveButtonRef.current?.click();
        setTimeout(() => {
          saveButtonTouchRippleRef.current?.stop();
        }, 200);
      }

      // Copy command (Cmd/Ctrl + Shift + C)
      if (cmdKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        copyButtonRef.current?.focus();
        copyButtonTouchRippleRef.current?.start();
        setTimeout(() => {
          copyButtonRef.current?.click();
          copyButtonTouchRippleRef.current?.stop();
        }, 200);
      }

      // Clear command (Cmd/Ctrl + Backspace)
      if (cmdKey && e.key === 'Backspace') {
        e.preventDefault();
        clearButtonRef.current?.focus();
        clearButtonTouchRippleRef.current?.start();
        setTimeout(() => {
          clearButtonRef.current?.click();
          clearButtonTouchRippleRef.current?.stop();
        }, 200);
      }

      // Tab switch command (Cmd/Ctrl + Tab or WinCtrl + Tab for Mac)
      if ((isMac ? e.ctrlKey : cmdKey) && e.key === 'Tab') {
        e.preventDefault();
        setBrowserIndexTimestamp(new Date().getTime());
      }

      // Log navigation commands (Cmd/Ctrl + Up/Down)
      if (cmdKey && e.key === 'ArrowUp') {
        e.preventDefault();
        newerLogButtonRef.current?.focus();
        newerLogButtonTouchRippleRef.current?.start();
        setTimeout(() => {
          newerLogButtonRef.current?.click();
          newerLogButtonTouchRippleRef.current?.stop();
        }, 200);
      }

      if (cmdKey && e.key === 'ArrowDown') {
        e.preventDefault();
        olderLogButtonRef.current?.focus();
        olderLogButtonTouchRippleRef.current?.start();
        setTimeout(() => {
          olderLogButtonRef.current?.click();
          olderLogButtonTouchRippleRef.current?.stop();
        }, 200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    sendButtonRef,
    saveButtonRef,
    copyButtonRef,
    clearButtonRef,
    newerLogButtonRef,
    olderLogButtonRef,
    sendButtonTouchRippleRef,
    copyButtonTouchRippleRef,
    clearButtonTouchRippleRef,
    saveButtonTouchRippleRef,
    newerLogButtonTouchRippleRef,
    olderLogButtonTouchRippleRef,
    setBrowserIndexTimestamp,
    osInfo,
  ]);
}; 