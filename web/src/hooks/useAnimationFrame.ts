import { useEffect, useRef } from 'react';

/** Calls `callback` every animation frame. Automatically cancels on unmount. */
export function useAnimationFrame(callback: (dt: number) => void): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    let rafId: number;
    let prev = performance.now();

    function loop(now: number) {
      const dt = now - prev;
      prev = now;
      cbRef.current(dt);
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);
}
