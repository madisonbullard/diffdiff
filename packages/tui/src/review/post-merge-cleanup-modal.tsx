import type {
  GitHubCleanupPreferences,
  GitHubRefCleanupCandidate,
} from "@madisonbullard/diffdiff-core";
import type { UiTheme } from "../theme.ts";
import { MODAL_OVERLAY, REVIEW_BORDER } from "./shared.tsx";

export function PostMergeCleanupModal({
  canApply,
  candidates,
  isSubmitting,
  selectedIndex,
  selection,
  theme,
}: {
  canApply: boolean;
  candidates: readonly GitHubRefCleanupCandidate[];
  isSubmitting: boolean;
  selectedIndex: number;
  selection: GitHubCleanupPreferences;
  theme: UiTheme;
}) {
  const localCandidate = candidates.find((candidate) => candidate.kind === "local-branch");
  const remoteCandidate = candidates.find((candidate) => candidate.kind === "remote-tracking");
  const entries = [
    {
      description:
        localCandidate == null
          ? "No matching local branch is available."
          : `Delete local branch ${localCandidate.ref} with a force delete if needed.`,
      isAvailable: localCandidate != null,
      isEnabled: selection.removeLocal,
      key: "removeLocal" as const,
      label:
        localCandidate == null ? "Local branch unavailable" : `Local branch ${localCandidate.ref}`,
    },
    {
      description:
        remoteCandidate == null
          ? "No matching remote-tracking ref is available."
          : `Delete remote-tracking ref ${remoteCandidate.ref} from this clone only.`,
      isAvailable: remoteCandidate != null,
      isEnabled: selection.removeRemote,
      key: "removeRemote" as const,
      label:
        remoteCandidate == null
          ? "Remote-tracking ref unavailable"
          : `Remote-tracking ref ${remoteCandidate.ref}`,
    },
  ];

  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={56}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width="92%"
        maxWidth={104}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              Post-Merge Cleanup
            </text>
            <text fg={theme.textMuted} wrapMode="word">
              The remote branch layout changed after the merge. Choose which stale refs to remove
              from this clone.
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" j/k "}
            </span>
            <span>{" move  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" space "}
            </span>
            <span>{" toggle  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" apply  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" skip"}</span>
          </text>
        </box>
        <box width="100%" flexDirection="column" gap={0}>
          {entries.map((entry, index) => {
            const isSelected = index === selectedIndex;
            return (
              <box
                key={entry.key}
                width="100%"
                border={["left"]}
                customBorderChars={REVIEW_BORDER}
                borderColor={isSelected ? theme.accent : theme.border}
                backgroundColor={isSelected ? theme.surfaceMuted : theme.surface}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
                flexDirection="column"
                gap={0}
              >
                <text fg={entry.isAvailable ? theme.text : theme.textMuted} wrapMode="none">
                  <span fg={isSelected ? theme.accent : theme.border}>
                    {isSelected ? "> " : "  "}
                  </span>
                  <span>{entry.isEnabled ? "[x] " : "[ ] "}</span>
                  <span>{entry.label}</span>
                </text>
                <text fg={theme.textMuted} wrapMode="word">
                  {entry.description}
                </text>
              </box>
            );
          })}
        </box>
        <text fg={canApply ? theme.textMuted : theme.warning} wrapMode="word">
          {isSubmitting
            ? "Removing selected refs..."
            : canApply
              ? "Enter applies the selected cleanup. Force-delete warnings apply to local branches."
              : "Choose at least one available ref to remove, or press esc to keep the current refs."}
        </text>
      </box>
    </box>
  );
}
