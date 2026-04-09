import { useEffect, useRef } from "react";

export function useStableInterval(callback: () => void, intervalMs: number | null): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (intervalMs == null) {
      return;
    }

    const intervalId = setInterval(() => {
      callbackRef.current();
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [intervalMs]);
}
