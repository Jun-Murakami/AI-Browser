import { useState, useRef, useEffect } from 'react';

export const useResizeObserver = <T extends HTMLElement>() => {
  const [size, setSize] = useState<{ width?: number; height?: number }>({});
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width: size.width, height: size.height };
};