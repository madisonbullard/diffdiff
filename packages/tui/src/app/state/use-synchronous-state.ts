import { useCallback, useRef, useState, type SetStateAction } from "react";

/** Event-time state stays current before React commits a terminal input burst. */
export function useSynchronousState<T>(initial: T | (() => T)) {
  const [value, render] = useState(initial);
  const ref = useRef(value);
  const set = useCallback((next: SetStateAction<T>) => {
    ref.current = typeof next === "function" ? (next as (current: T) => T)(ref.current) : next;
    render(ref.current);
  }, []);
  return [value, set, ref] as const;
}
