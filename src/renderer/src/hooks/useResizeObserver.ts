import { useEffect, useRef, useState } from 'react';

interface UseResizeObserverOptions {
  onResize?: (size: { width: number; height: number }) => void;
}

export const useResizeObserver = <T extends HTMLElement>(
  options?: UseResizeObserverOptions,
) => {
  const [size, setSize] = useState<{ width?: number; height?: number }>({});
  const ref = useRef<T>(null);
  const onResizeRef = useRef(options?.onResize);
  onResizeRef.current = options?.onResize;

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
        onResizeRef.current?.({ width, height });
      }
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width: size.width, height: size.height };
};
