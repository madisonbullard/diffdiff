import { useEffect, useMemo, useState } from "react";
import { TERMINAL_BLUR_EVENT, TERMINAL_FOCUS_EVENT } from "../app/shared/constants.ts";
import { getRelativeTimestampInfo } from "./formatting.ts";

interface TerminalEventSource {
  off: (event: string, handler: () => void) => unknown;
  on: (event: string, handler: () => void) => unknown;
}

export function useRelativeTimeClock({
  isActive,
  renderer,
  timestampFingerprint,
  timestamps,
}: {
  isActive: boolean;
  renderer: TerminalEventSource;
  timestampFingerprint: string;
  timestamps: readonly string[];
}): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const handleBlur = () => {
      setIsFocused(false);
    };

    const handleFocus = () => {
      setIsFocused(true);
      setNowMs(Date.now());
    };

    renderer.on(TERMINAL_BLUR_EVENT, handleBlur);
    renderer.on(TERMINAL_FOCUS_EVENT, handleFocus);

    return () => {
      renderer.off(TERMINAL_BLUR_EVENT, handleBlur);
      renderer.off(TERMINAL_FOCUS_EVENT, handleFocus);
    };
  }, [renderer]);

  useEffect(() => {
    if (!isActive || !isFocused) {
      return;
    }

    setNowMs(Date.now());
  }, [isActive, isFocused, timestampFingerprint]);

  const nextRefreshAt = useMemo(() => {
    if (!isActive || !isFocused) {
      return undefined;
    }

    let nextTimestampRefreshAt: number | undefined;
    for (const timestamp of timestamps) {
      const refreshAt = getRelativeTimestampInfo(timestamp, nowMs).nextRefreshAt;
      if (refreshAt == null) {
        continue;
      }

      nextTimestampRefreshAt =
        nextTimestampRefreshAt == null ? refreshAt : Math.min(nextTimestampRefreshAt, refreshAt);
    }

    return nextTimestampRefreshAt;
  }, [isActive, isFocused, nowMs, timestamps]);

  useEffect(() => {
    if (!isActive || !isFocused || nextRefreshAt == null) {
      return;
    }

    const timeoutId = setTimeout(
      () => {
        setNowMs(Date.now());
      },
      Math.max(nextRefreshAt - Date.now(), 0) + 1,
    );

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isActive, isFocused, nextRefreshAt]);

  return nowMs;
}
