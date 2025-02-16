import { useEffect } from 'react';

interface UseGlobalShortcutsProps {
  sendButtonRef: React.RefObject<HTMLButtonElement | null>;
  saveButtonRef: React.RefObject<HTMLButtonElement | null>;
  copyButtonRef: React.RefObject<HTMLButtonElement | null>;
  clearButtonRef: React.RefObject<HTMLButtonElement | null>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement | null>;
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
        sendButtonRef.current?.click();
      }

      // Save command (Cmd/Ctrl + S)
      if (cmdKey && e.key === 's') {
        e.preventDefault();
        saveButtonRef.current?.click();
      }

      // Copy command (Cmd/Ctrl + Shift + C)
      if (cmdKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();  // イベントの伝播を停止
        setTimeout(() => {
          copyButtonRef.current?.click();
        }, 0);
      }

      // Clear command (Cmd/Ctrl + Backspace)
      if (cmdKey && e.key === 'Backspace') {
        e.preventDefault();
        clearButtonRef.current?.click();
      }

      // Tab switch command (Cmd/Ctrl + Tab or WinCtrl + Tab for Mac)
      if ((isMac ? e.ctrlKey : cmdKey) && e.key === 'Tab') {
        e.preventDefault();
        setBrowserIndexTimestamp(new Date().getTime());
      }

      // Log navigation commands (Cmd/Ctrl + Up/Down)
      if (cmdKey && e.key === 'ArrowUp') {
        e.preventDefault();
        newerLogButtonRef.current?.click();
      }

      if (cmdKey && e.key === 'ArrowDown') {
        e.preventDefault();
        olderLogButtonRef.current?.click();
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
    setBrowserIndexTimestamp,
    osInfo,
  ]);
}; 