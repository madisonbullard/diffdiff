import { createContext, useContext, type ReactNode } from "react";
import type { UiTheme } from "../theme.ts";
import { formatRelativeTimestamp } from "./formatting.ts";

const ReviewRelativeTimeContext = createContext<number | undefined>(undefined);

export function ReviewRelativeTimeProvider({
  children,
  nowMs,
}: {
  children: ReactNode;
  nowMs?: number;
}) {
  return (
    <ReviewRelativeTimeContext.Provider value={nowMs}>
      {children}
    </ReviewRelativeTimeContext.Provider>
  );
}

export function CommentTimestamp({ theme, value }: { theme: UiTheme; value: string }) {
  const nowMs = useContext(ReviewRelativeTimeContext);

  return <span fg={theme.textMuted}>{formatRelativeTimestamp(value, nowMs)}</span>;
}

export function ReviewMetaSeparator({ theme }: { theme: UiTheme }) {
  return <span fg={theme.border}>{"  │  "}</span>;
}
