import type { GitHubPullRequestDetail } from "@madisonbullard/diffdiff-core";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { MutableRefObject } from "react";
import type { UiTheme } from "../theme.ts";
import { DialogInspector } from "../components/dialog/inspector.tsx";
import { DialogList, DialogRow } from "../components/dialog/list-view.tsx";
import * as A from "../app/keymap/actions.ts";
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
  const checks = pullRequest.checks;
  const items = checks.items ?? [];
  const selected = items[selectedIndex];
  return (
    <DialogInspector
      title="PR Checks"
      context={`#${pullRequest.number} · ${checks.failed} failed · ${checks.pending} pending · ${checks.successful} passed`}
      theme={theme}
      detailScrollRef={detailScrollRef}
      detailKey={selected?.id}
      status={checks.unavailable ? "Unable to load PR checks. Refresh to retry." : undefined}
      actions={[
        { action: A.LIST_MOVE_DOWN, label: "move" },
        { action: A.CHECKS_COPY_URL, label: "copy link" },
        { action: A.COMPARISON_REFRESH, label: "refresh", primary: true },
      ]}
      list={(width, height) => (
        <DialogList
          items={items}
          index={selectedIndex}
          height={height}
          theme={theme}
          empty="No checks have run for this commit."
          onMove={(delta) =>
            onSelect(Math.max(0, Math.min(items.length - 1, selectedIndex + delta)))
          }
          render={(item, i) => (
            <DialogRow
              selected={i === selectedIndex}
              label={`${item.state === "success" ? "✓" : item.state === "failure" ? "✗" : "◐"} ${item.name}`}
              right={item.status.replaceAll("_", " ")}
              width={width}
              theme={theme}
              onSelect={() => onSelect(i)}
            />
          )}
        />
      )}
      detail={
        <>
          <text fg={theme.text} attributes={1} wrapMode="word">
            {selected?.name ?? "No check selected"}
          </text>
          <text fg={theme.textMuted}>
            {selected
              ? `${selected.provider ?? (selected.source === "commit-status" ? "Commit status" : "Check run")} · ${selected.status.replaceAll("_", " ")}`
              : ""}
          </text>
          <text fg={theme.text} wrapMode="word">
            {selected?.summary?.trim() || "No additional details provided."}
          </text>
          <text fg={theme.accent} wrapMode="word">
            {selected?.url ? (
              <a href={selected.url}>{selected.url}</a>
            ) : (
              "No details link available."
            )}
          </text>
        </>
      }
    />
  );
}
