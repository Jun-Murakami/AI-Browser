import { memo, useCallback, useRef } from 'react';

import { useEditorStore } from '../stores/useEditorStore';
import {
  MonacoEditor,
  type MonacoEditorHandle,
  type MonacoEditorProps,
} from './MonacoEditor';

interface ConnectedMonacoEditorProps
  extends Omit<MonacoEditorProps, 'value' | 'onChange' | 'ref'> {
  index: number;
  editorRef: React.RefObject<MonacoEditorHandle | null>;
}

/**
 * ストアの editorValues[index] だけを subscribe するラッパー。
 * 他のエディタの値が変わってもこのコンポーネントは再レンダリングされない。
 */
export const ConnectedMonacoEditor = memo(
  ({ index, editorRef, ...editorProps }: ConnectedMonacoEditorProps) => {
    const value = useEditorStore((s) => s.editorValues[index]);
    const setEditorValue = useEditorStore((s) => s.setEditorValue);

    const stableIndex = useRef(index);
    stableIndex.current = index;

    const handleChange = useCallback(
      (v: string | undefined) => {
        setEditorValue(stableIndex.current, v ?? '');
      },
      [setEditorValue],
    );

    return (
      <MonacoEditor
        {...editorProps}
        value={value}
        onChange={handleChange}
        ref={editorRef}
      />
    );
  },
);

ConnectedMonacoEditor.displayName = 'ConnectedMonacoEditor';
