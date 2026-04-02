import type { GitHubMergeMethod, GitHubPullRequestDetail } from "@diffdiff/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { Ref } from "react";
import type { UiTheme } from "../theme.ts";
import { formatMergeMethod, getMergeBlockedReason } from "./formatting.ts";
import { MODAL_OVERLAY, REVIEW_BORDER } from "./shared.tsx";

const MERGE_METHODS: readonly GitHubMergeMethod[] = ["merge", "squash"];
const MERGE_BODY_MAX_HEIGHT = 8;

export function MergePullRequestModal({
  body,
  bodyScrollRef,
  canSubmit,
  field,
  isSubmitting,
  method,
  pullRequest,
  theme,
  title,
}: {
  body: string;
  bodyScrollRef?: Ref<ScrollBoxRenderable | null>;
  canSubmit: boolean;
  field: "method" | "title" | "body";
  isSubmitting: boolean;
  method?: GitHubMergeMethod;
  pullRequest: GitHubPullRequestDetail;
  theme: UiTheme;
  title: string;
}) {
  const mergeBlockedReason = getMergeBlockedReason(pullRequest);

  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={55}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width="92%"
        maxWidth={108}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
          <box flexDirection="column">
            <text fg={theme.accent} wrapMode="none">
              Merge Pull Request
            </text>
            <text
              fg={theme.textMuted}
              wrapMode="none"
            >{`PR #${pullRequest.number} • ${pullRequest.title}`}</text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" tab "}
            </span>
            <span>{" next field  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" enter "}
            </span>
            <span>{" merge  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" shift+enter "}
            </span>
            <span>{" newline  "}</span>
            <span fg={theme.accent} bg={theme.surfaceMuted}>
              {" esc "}
            </span>
            <span>{" close"}</span>
          </text>
        </box>
        <box width="100%" flexDirection="column" gap={0}>
          {MERGE_METHODS.map((mergeMethod) => {
            const isFocused = field === "method" && mergeMethod === (method ?? MERGE_METHODS[0]);
            const isSelected = mergeMethod === method;
            const accent = mergeMethod === "merge" ? theme.accent : theme.success;

            return (
              <box
                key={mergeMethod}
                width="100%"
                border={["left"]}
                customBorderChars={REVIEW_BORDER}
                borderColor={isFocused ? accent : theme.border}
                backgroundColor={isFocused ? theme.surfaceMuted : theme.surface}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
              >
                <text fg={isFocused ? theme.text : theme.textMuted} wrapMode="none">
                  <span fg={accent}>{isFocused ? "> " : "  "}</span>
                  <span>{formatMergeMethod(mergeMethod)}</span>
                  <span fg={theme.border}>{"  │  "}</span>
                  <span fg={isSelected ? accent : theme.textMuted}>
                    {isSelected ? "default selection" : "available"}
                  </span>
                </text>
              </box>
            );
          })}
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={field === "title" ? theme.borderActive : theme.border}
          backgroundColor={field === "title" ? theme.surfaceMuted : theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
        >
          <text fg={theme.text} wrapMode="word">
            <span fg={theme.textMuted}>{"Title: "}</span>
            {title !== "" ? title : ""}
            {field === "title" ? <span fg={theme.accent}>_</span> : null}
          </text>
        </box>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={REVIEW_BORDER}
          borderColor={field === "body" ? theme.borderActive : theme.border}
          backgroundColor={field === "body" ? theme.surfaceMuted : theme.surface}
          paddingLeft={2}
          paddingRight={0}
          paddingTop={1}
          paddingBottom={1}
          minHeight={6}
          flexDirection="column"
          gap={0}
        >
          <text fg={theme.textMuted} wrapMode="none">
            Body:
          </text>
          <scrollbox
            ref={bodyScrollRef}
            width="100%"
            height={MERGE_BODY_MAX_HEIGHT}
            focused={field === "body"}
            viewportOptions={{
              backgroundColor: field === "body" ? theme.surfaceMuted : theme.surface,
            }}
            contentOptions={{
              backgroundColor: field === "body" ? theme.surfaceMuted : theme.surface,
            }}
            verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
          >
            <text fg={theme.text} wrapMode="word">
              {body !== "" ? body : ""}
              {field === "body" ? <span fg={theme.accent}>_</span> : null}
            </text>
          </scrollbox>
        </box>
        <text fg={canSubmit ? theme.textMuted : theme.warning} wrapMode="word">
          {isSubmitting
            ? "Merging pull request and refreshing local refs..."
            : canSubmit
              ? "Edit the merge title/body, then press enter to merge."
              : mergeBlockedReason}
        </text>
      </box>
    </box>
  );
}
