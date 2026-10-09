import type {
  GitHubPullRequestDetail,
  GitHubPullRequestCheck,
} from "@madisonbullard/diffdiff-core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef, type MutableRefObject } from "react";
import { KeyCap, ModalFrame, tintHex } from "../components/shared.tsx";
import type { UiTheme } from "../theme.ts";
import { clampIndex } from "../view-model.ts";

export function PullRequestChecksModal({
  pullRequest,
  selectedIndex,
  onSelect,
  detailScrollRef,
  theme,
}: {
  pullRequest: GitHubPullRequestDetail;
  selectedIndex: number;
  onSelect: (index: number) => void;
  detailScrollRef: MutableRefObject<ScrollBoxRenderable | null>;
  theme: UiTheme;
}) {
  const { height } = useTerminalDimensions();
  const listScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const checks = pullRequest.checks;
  const items = checks.items ?? [];
  const index = clampIndex(selectedIndex, items.length);
  const selected = items[index];
  // Dialogs occupy the body, below the four-row header and above the footer.
  const listHeight = Math.max(2, Math.min(10, Math.floor((height - 16) / 2)));

  useEffect(() => {
    const scroll = listScrollRef.current;
    if (scroll == null) return;
    if (index < scroll.scrollTop) scroll.scrollTo(index);
    else if (index >= scroll.scrollTop + listHeight) scroll.scrollTo(index - listHeight + 1);
  }, [index, items, listHeight]);
  useEffect(() => {
    detailScrollRef.current?.scrollTo(0);
  }, [selected?.id, detailScrollRef]);

  return (
    <ModalFrame
      title="PR Checks"
      subtitle={`#${pullRequest.number} · ${pullRequest.headSha.slice(0, 7)} · ${checks.unavailable ? "checks unavailable" : `${checks.failed} failed · ${checks.pending} pending · ${checks.successful} passed`}`}
      maxWidth={100}
      maxHeight="100%"
      theme={theme}
    >
      {items.length === 0 ? (
        <text fg={checks.unavailable ? theme.warning : theme.textMuted}>
          {checks.unavailable
            ? "Unable to load PR checks. Press r to retry."
            : checks.total > 0
              ? "Check details are unavailable. Press r to reload."
              : "No checks have run for this commit."}
        </text>
      ) : (
        <>
          <scrollbox
            ref={listScrollRef}
            height={Math.min(listHeight, items.length)}
            flexShrink={0}
            width="100%"
            viewportOptions={{ backgroundColor: theme.surface }}
            contentOptions={{ backgroundColor: theme.surface }}
            verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
          >
            {items.map((item, itemIndex) => (
              <box
                key={item.id}
                height={1}
                flexShrink={0}
                width="100%"
                backgroundColor={
                  index === itemIndex ? tintHex(theme.surface, theme.accent, 0.18) : theme.surface
                }
                onMouseUp={(event) => {
                  if (event.button === 0) {
                    event.stopPropagation();
                    onSelect(itemIndex);
                  }
                }}
              >
                <text wrapMode="none" fg={theme.text}>
                  <span fg={index === itemIndex ? theme.accent : theme.textMuted}>
                    {index === itemIndex ? "> " : "  "}
                  </span>
                  <span
                    fg={checkColor(item, theme)}
                  >{`${item.status.replaceAll("_", " ").padEnd(16)} `}</span>
                  <span>{item.name}</span>
                </text>
              </box>
            ))}
          </scrollbox>
          {selected != null ? (
            <box
              flexDirection="column"
              gap={0}
              width="100%"
              backgroundColor={theme.surface}
              paddingX={1}
              flexShrink={0}
            >
              <text fg={theme.text} wrapMode="none">
                <span fg={checkColor(selected, theme)}>{selected.name}</span>
              </text>
              <text
                fg={theme.textMuted}
                wrapMode="none"
              >{`${selected.provider ?? (selected.source === "commit-status" ? "Commit status" : "Check run")} · ${selected.status.replaceAll("_", " ")}`}</text>
              <scrollbox
                ref={detailScrollRef}
                height={listHeight}
                width="100%"
                viewportOptions={{ backgroundColor: theme.surface }}
                contentOptions={{ backgroundColor: theme.surface }}
              >
                <text fg={theme.text} wrapMode="word">
                  {selected.summary?.trim() || "No additional details provided."}
                </text>
                <text fg={theme.accent} wrapMode="word">
                  {selected.url ? (
                    <a href={selected.url}>{selected.url}</a>
                  ) : (
                    <span fg={theme.textMuted}>No details link available.</span>
                  )}
                </text>
              </scrollbox>
            </box>
          ) : null}
        </>
      )}
      <text fg={theme.textMuted} wrapMode="word" flexShrink={0}>
        <KeyCap label="j/k" theme={theme} />
        <span>{" move "}</span>
        <KeyCap label="pgup/pgdn" theme={theme} />
        <span>{" details "}</span>
        <KeyCap label="y" theme={theme} />
        <span>{" copy link "}</span>
        <KeyCap label="r" theme={theme} />
        <span>{" refresh "}</span>
        <KeyCap label="esc" theme={theme} />
        <span>{" close"}</span>
      </text>
    </ModalFrame>
  );
}

function checkColor(check: GitHubPullRequestCheck, theme: UiTheme): string {
  return check.state === "failure"
    ? theme.danger
    : check.state === "pending"
      ? theme.warning
      : check.state === "success"
        ? theme.success
        : theme.textMuted;
}
