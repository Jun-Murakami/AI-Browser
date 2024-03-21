import { useEffect, useState } from 'react';

export const useWatchBoxHeight = (targetRef) => {
  const [isBoxReady, setIsBoxReady] = useState(false);

  useEffect(() => {
    if (!targetRef.current) return;

    const observeBoxHeight = () => {
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
