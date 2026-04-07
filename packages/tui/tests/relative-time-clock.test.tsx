import type { ReactElement } from "react";
import type { ReactTestRendererNode } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { TERMINAL_BLUR_EVENT, TERMINAL_FOCUS_EVENT } from "../src/app/shared/constants.ts";
import { formatRelativeTimestamp } from "../src/review/formatting.ts";
import { useRelativeTimeClock } from "../src/review/use-relative-time-clock.ts";

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-07T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("refreshes relative timestamps at the next visible boundary", () => {
  const renderer = createRenderer();
  let tree: ReturnType<typeof create>;

  act(() => {
    tree = create(
      (
        <RelativeTimeProbe
          isActive={true}
          renderer={renderer}
          timestamps={["2026-04-07T11:59:01Z"]}
        />
      ) as ReactElement,
    );
  });

  expect(collectText(tree!.toJSON())).toBe("59 seconds ago");

  act(() => {
    vi.advanceTimersByTime(999);
  });
  expect(collectText(tree!.toJSON())).toBe("59 seconds ago");

  act(() => {
    vi.advanceTimersByTime(2);
  });
  expect(collectText(tree!.toJSON())).toBe("1 minute ago");
});

test("pauses while blurred and refreshes immediately on focus", () => {
  const renderer = createRenderer();
  let tree: ReturnType<typeof create>;

  act(() => {
    tree = create(
      (
        <RelativeTimeProbe
          isActive={true}
          renderer={renderer}
          timestamps={["2026-04-07T11:59:01Z"]}
        />
      ) as ReactElement,
    );
  });

  expect(collectText(tree!.toJSON())).toBe("59 seconds ago");

  act(() => {
    renderer.emit(TERMINAL_BLUR_EVENT);
    vi.advanceTimersByTime(1_000);
  });
  expect(collectText(tree!.toJSON())).toBe("59 seconds ago");

  act(() => {
    renderer.emit(TERMINAL_FOCUS_EVENT);
  });
  expect(collectText(tree!.toJSON())).toBe("1 minute ago");
});

function RelativeTimeProbe({
  isActive,
  renderer,
  timestamps,
}: {
  isActive: boolean;
  renderer: ReturnType<typeof createRenderer>;
  timestamps: readonly string[];
}) {
  const nowMs = useRelativeTimeClock({
    isActive,
    renderer,
    timestampFingerprint: timestamps.join("\u0000"),
    timestamps,
  });

  return <text>{formatRelativeTimestamp(timestamps[0] ?? "", nowMs)}</text>;
}

function collectText(node: ReactTestRendererNode | ReactTestRendererNode[] | null): string {
  if (node == null) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child) => collectText(child)).join("");
  }

  return collectText(node.children);
}

function createRenderer() {
  const listeners = new Map<string, Set<() => void>>();

  return {
    emit(event: string) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
    off(event: string, handler: () => void) {
      listeners.get(event)?.delete(handler);
    },
    on(event: string, handler: () => void) {
      const eventListeners = listeners.get(event) ?? new Set<() => void>();
      eventListeners.add(handler);
      listeners.set(event, eventListeners);
    },
  };
}
