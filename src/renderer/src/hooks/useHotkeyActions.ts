import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from '@tanstack/react-hotkeys';
import * as monaco from 'monaco-editor';

import type { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';

interface UseHotkeyActionsProps {
  osInfo: string;
  activeTab: { id: string } | null;
  isTerminalActive: boolean;
  visibleTabs: { id: string }[];
  activeTabId: string | null;
  selectTab: (tabId: string) => void;
  boilerplatesRef: React.RefObject<Record<string, string>>;
  boilerplateBankRef: React.RefObject<'A' | 'B' | 'C' | 'D' | 'E'>;
  switchBoilerplateBank: (direction: 'prev' | 'next') => void;
  lastFocusedEditorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>;
  sendButtonRef: React.RefObject<HTMLButtonElement | null>;
  copyButtonRef: React.RefObject<HTMLButtonElement | null>;
  clearButtonRef: React.RefObject<HTMLButtonElement | null>;
  saveButtonRef: React.RefObject<HTMLButtonElement | null>;
  newerLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  olderLogButtonRef: React.RefObject<HTMLButtonElement | null>;
  sendButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  copyButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  clearButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  saveButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  newerLogButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
  olderLogButtonTouchRippleRef: React.RefObject<TouchRippleActions | null>;
}

interface UseHotkeyActionsReturn {
  isCtrlHeld: boolean;
  isAltHeld: boolean;
  activeArrowKey:
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'enter'
    | 'backspace'
    | null;
  handleSendArrowKey: (
    direction: 'up' | 'down' | 'left' | 'right' | 'enter' | 'backspace',
  ) => void;
  handleSendControlKey: (key: string) => void;
  handleInsertBoilerplate: (key: string) => void;
}

export function useHotkeyActions({
  osInfo,
  activeTab,
  isTerminalActive,
  visibleTabs,
  activeTabId,
  selectTab,
  boilerplatesRef,
  boilerplateBankRef,
  switchBoilerplateBank,
  lastFocusedEditorRef,
  sendButtonRef,
  copyButtonRef,
  clearButtonRef,
  saveButtonRef,
  newerLogButtonRef,
  olderLogButtonRef,
  sendButtonTouchRippleRef,
  copyButtonTouchRippleRef,
  clearButtonTouchRippleRef,
  saveButtonTouchRippleRef,
  newerLogButtonTouchRippleRef,
  olderLogButtonTouchRippleRef,
}: UseHotkeyActionsProps): UseHotkeyActionsReturn {
  const [isCtrlHeld, setIsCtrlHeld] = useState(false);
  const [isAltHeld, setIsAltHeld] = useState(false);
  const [activeArrowKey, setActiveArrowKey] = useState<
    'up' | 'down' | 'left' | 'right' | 'enter' | 'backspace' | null
  >(null);
  const arrowKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 定型文をMonacoカーソル位置に挿入（ref の .current は呼び出し時に最新値を読む）
  const handleInsertBoilerplate = useCallback(
    (key: string) => {
      const text = boilerplatesRef.current[key];
      if (!text) return;
      const editors = monaco.editor.getEditors();
      const editor =
        editors.find((e) => e.hasTextFocus()) ||
        lastFocusedEditorRef.current ||
        editors[0];
      if (!editor) return;
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits('boilerplate', [
          { range: selection, text, forceMoveMarkers: true },
        ]);
      }
      editor.focus();
    },
    [boilerplatesRef.current, lastFocusedEditorRef.current],
  );

  // アクティブなタブ（ターミナル/ブラウザ）へキーを送出
  const handleSendArrowKey = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right' | 'enter' | 'backspace') => {
      if (!activeTab) return;
      if (isTerminalActive) {
        const TERMINAL_SEQUENCES: Record<string, string> = {
          up: '\x1b[A',
          down: '\x1b[B',
          right: '\x1b[C',
          left: '\x1b[D',
          enter: '\r',
          backspace: '\x7f',
        };
        window.api.sendTerminalInput(
          activeTab.id,
          TERMINAL_SEQUENCES[direction],
        );
      } else {
        const VIEW_KEYCODES: Record<string, string> = {
          up: 'Up',
          down: 'Down',
          left: 'Left',
          right: 'Right',
          enter: 'Return',
          backspace: 'Backspace',
        };
        window.electron.sendKeyToView(VIEW_KEYCODES[direction]);
      }
      // ハイライトフラッシュ
      if (arrowKeyTimerRef.current) clearTimeout(arrowKeyTimerRef.current);
      setActiveArrowKey(direction);
      arrowKeyTimerRef.current = setTimeout(() => {
        setActiveArrowKey(null);
        arrowKeyTimerRef.current = null;
      }, 150);
    },
    [isTerminalActive, activeTab],
  );

  // Ctrl+キーをアクティブなタブ/ターミナルへ送出
  const handleSendControlKey = useCallback(
    (key: string) => {
      if (!activeTab) return;
      if (isTerminalActive) {
        const charCode = key.toUpperCase().charCodeAt(0) - 64;
        window.api.sendTerminalInput(
          activeTab.id,
          String.fromCharCode(charCode),
        );
      } else {
        window.electron.sendKeyToView(key, ['control']);
      }
    },
    [isTerminalActive, activeTab],
  );

  // --- 修飾キー追跡 (Ctrl/Cmd 長押し、Alt 追跡、Ctrl+Alt+Arrow 送出) ---
  const ctrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCtrlHeldRef = useRef(false);
  const altKeyDownAtRef = useRef(0);
  const sendArrowKeyRef = useRef(handleSendArrowKey);
  sendArrowKeyRef.current = handleSendArrowKey;
  const modKey = osInfo === 'darwin' ? 'Meta' : 'Control';

  useEffect(() => {
    const clearModState = () => {
      if (ctrlTimerRef.current) {
        clearTimeout(ctrlTimerRef.current);
        ctrlTimerRef.current = null;
      }
      if (isCtrlHeldRef.current) {
        isCtrlHeldRef.current = false;
        setIsCtrlHeld(false);
      }
    };

    const startModTimer = () => {
      if (ctrlTimerRef.current) return;
      ctrlTimerRef.current = setTimeout(() => {
        isCtrlHeldRef.current = true;
        setIsCtrlHeld(true);
        ctrlTimerRef.current = null;
      }, 300);
    };

    // イベントオブジェクトの metaKey/ctrlKey で Mod の物理状態を確認する。
    // メインプロセスの before-input-event で preventDefault された後に
    // Mod keyup がレンダラーに届かないケースへのフォールバック。
    // keydown / keyup / mousedown いずれのイベントでも確認できる。
    const checkModPhysical = (e: KeyboardEvent | MouseEvent) => {
      if (!isCtrlHeldRef.current) return;
      const isModDown = osInfo === 'darwin' ? e.metaKey : e.ctrlKey;
      if (!isModDown) {
        clearModState();
      }
    };

    const KEY_MAP: Record<
      string,
      'up' | 'down' | 'left' | 'right' | 'enter' | 'backspace'
    > = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      Enter: 'enter',
      Backspace: 'backspace',
    };

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === modKey) {
        startModTimer();
      } else {
        // Mod 以外のキーが押された時に Mod の物理状態を確認
        checkModPhysical(e);
      }
      if (e.key === 'Alt' || e.key === 'AltGraph') {
        altKeyDownAtRef.current = Date.now();
        setIsAltHeld(true);
      }
      const isMod = osInfo === 'darwin' ? e.metaKey : e.ctrlKey;
      // テンキー + と JIS の ;/+ キーは hotkey 側で拾えない環境があるため
      // 物理キー code で next バンク切替を補完する
      if (isMod && (e.code === 'NumpadAdd' || e.code === 'Semicolon')) {
        e.preventDefault();
        e.stopPropagation();
        switchBoilerplateBank('next');
        return;
      }
      // Ctrl+Alt+Arrow/Enter/Backspace 送出
      if (isMod && e.altKey && KEY_MAP[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        sendArrowKeyRef.current(KEY_MAP[e.key]);
      }
    };

    const handleKeyUpCapture = (e: KeyboardEvent) => {
      if (e.key === modKey) {
        const isAltGrSynthetic = Date.now() - altKeyDownAtRef.current < 100;
        if (!isAltGrSynthetic) {
          clearModState();
        }
      }
      checkModPhysical(e);
      if (e.key === 'Alt' || e.key === 'AltGraph') {
        const isAltGrSynthetic = Date.now() - altKeyDownAtRef.current < 100;
        if (!isAltGrSynthetic) {
          setIsAltHeld(false);
        }
      }
    };

    // クリック時にも Mod の物理状態を確認する
    const handleMouseDownCapture = (e: MouseEvent) => {
      checkModPhysical(e);
    };

    const handleBlur = () => {
      clearModState();
      setIsAltHeld(false);
    };

    window.addEventListener('keydown', handleKeyDownCapture, true);
    window.addEventListener('keyup', handleKeyUpCapture, true);
    window.addEventListener('mousedown', handleMouseDownCapture, true);
    window.addEventListener('blur', handleBlur);

    // メインプロセスの before-input-event 経由で Mod keyUp を受け取る。
    // before-input-event の keyUp が発火するプラットフォームへの追加フォールバック。
    window.electron.onModKeyUp(() => {
      clearModState();
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, true);
      window.removeEventListener('keyup', handleKeyUpCapture, true);
      window.removeEventListener('mousedown', handleMouseDownCapture, true);
      window.removeEventListener('blur', handleBlur);
      window.electron.removeModKeyUpListener();
      if (ctrlTimerRef.current) {
        clearTimeout(ctrlTimerRef.current);
      }
    };
  }, [modKey, osInfo, switchBoilerplateBank]);

  // --- ボタンリップル付きトリガー ---
  const triggerButton = useCallback(
    (
      ref: React.RefObject<HTMLButtonElement | null>,
      ripple: React.RefObject<TouchRippleActions | null>,
    ) => {
      ref.current?.focus();
      ripple.current?.start();
      ref.current?.click();
      setTimeout(() => ripple.current?.stop(), 200);
    },
    [],
  );

  // --- Ctrl+Tab でタブ切替 ---
  const handleTabSwitch = useCallback(
    (direction: 'next' | 'prev') => {
      const currentIndex = visibleTabs.findIndex(
        (tab) => tab.id === activeTabId,
      );
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (direction === 'next') {
        nextIndex = (currentIndex + 1) % visibleTabs.length;
      } else {
        nextIndex =
          currentIndex === 0 ? visibleTabs.length - 1 : currentIndex - 1;
      }

      const nextTab = visibleTabs[nextIndex];
      if (nextTab) {
        selectTab(nextTab.id);
      }
    },
    [visibleTabs, activeTabId, selectTab],
  );

  // --- グローバルショートカット ---
  useHotkeys([
    {
      hotkey: 'Mod+Enter',
      callback: () => triggerButton(sendButtonRef, sendButtonTouchRippleRef),
    },
    {
      hotkey: 'Mod+S',
      callback: () => triggerButton(saveButtonRef, saveButtonTouchRippleRef),
    },
    {
      hotkey: 'Mod+Shift+C',
      callback: () => triggerButton(copyButtonRef, copyButtonTouchRippleRef),
    },
    {
      hotkey: 'Mod+Backspace',
      callback: () => triggerButton(clearButtonRef, clearButtonTouchRippleRef),
    },
    {
      hotkey: 'Mod+ArrowUp',
      callback: () =>
        triggerButton(newerLogButtonRef, newerLogButtonTouchRippleRef),
    },
    {
      hotkey: 'Mod+ArrowDown',
      callback: () =>
        triggerButton(olderLogButtonRef, olderLogButtonTouchRippleRef),
    },
    {
      hotkey: 'Mod+Tab',
      callback: () => handleTabSwitch('next'),
    },
    {
      hotkey: 'Mod+Shift+Tab',
      callback: () => handleTabSwitch('prev'),
    },
    {
      hotkey: { mod: true, key: '-' },
      callback: () => switchBoilerplateBank('prev'),
      options: { preventDefault: true },
    },
    {
      hotkey: { mod: true, key: '=' },
      callback: () => switchBoilerplateBank('next'),
      options: { preventDefault: true },
    },
    {
      hotkey: { mod: true, key: '+' },
      callback: () => switchBoilerplateBank('next'),
      options: { preventDefault: true },
    },
    ...(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const).map(
      (key) => ({
        hotkey: `Mod+${key}` as const,
        callback: () =>
          handleInsertBoilerplate(`${boilerplateBankRef.current}${key}`),
      }),
    ),
  ]);

  return {
    isCtrlHeld,
    isAltHeld,
    activeArrowKey,
    handleSendArrowKey,
    handleSendControlKey,
    handleInsertBoilerplate,
  };
}
