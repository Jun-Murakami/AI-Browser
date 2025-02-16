import { useEffect, useState, type RefObject } from 'react';

type UseWatchBoxHeightProps = {
  targetRef: RefObject<HTMLElement | null>;
};

export const useWatchBoxHeight = ({ targetRef }: UseWatchBoxHeightProps) => {
  const [isBoxReady, setIsBoxReady] = useState(false);

  useEffect(() => {
    if (!targetRef?.current) return;

    const observeBoxHeight = () => {
      if (!targetRef.current) return;
      const boxHeight = targetRef.current.getBoundingClientRect().height;
      if (boxHeight >= 10) {
        setIsBoxReady(true);
      }
    };

    const observer = new ResizeObserver(observeBoxHeight);
    observer.observe(targetRef.current);

    return () => {
      observer.disconnect();
    };
  }, [targetRef]);

  return isBoxReady;
};
