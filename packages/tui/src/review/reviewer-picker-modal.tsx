import type { GitHubPullRequestRequestedReviewer } from "@madisonbullard/diffdiff-core";
import type { UiTheme } from "../theme.ts";
import { useTerminalDimensions } from "@opentui/react";
import { createTextInputSurface } from "../text-input-surface.ts";
import { KeyCap, ModalFrame, SPLIT_BORDER, tintHex } from "../components/shared.tsx";
import { AsciiLoadingLabel } from "../components/ascii-loading-pane.tsx";
import { TextInputContent } from "../components/text-input-content.tsx";
import { clampIndex } from "../view-model.ts";
import {
  filterReviewerCandidates,
  getRequestedReviewerLogins,
  reviewerRecommendationLabel,
  type ReviewerPickerState,
} from "../app/review/reviewer-picker-state.ts";

export function ReviewerPickerModal({
  picker,
  requests,
  theme,
}: {
  picker: ReviewerPickerState;
  requests: readonly GitHubPullRequestRequestedReviewer[];
  theme: UiTheme;
}) {
  const users = filterReviewerCandidates(picker);
  const { height } = useTerminalDimensions();
  const compact = height < 30;
  const noticeRows =
    (picker.selected.size > 0 ? 3 : 0) +
    (picker.error != null ? 3 : 0) +
    (picker.recommendationsUnavailable ? 2 : 0);
  const visibleCount = Math.max(1, Math.min(8, Math.floor((height - 20 - noticeRows) / 2)));
  const index = clampIndex(picker.index, users.length);
  const start = Math.max(
    0,
    Math.min(index - Math.floor(visibleCount / 2), users.length - visibleCount),
  );
  const requested = getRequestedReviewerLogins(requests);
  const selected = [...picker.selected].join(", ");
  return (
    <ModalFrame
      title="Request reviewers"
      subtitle="Choose people to review this pull request. Existing requests are kept."
      maxWidth={84}
      maxHeight="100%"
      theme={theme}
      headerRight={
        picker.isSubmitting || picker.isLoading ? (
          <AsciiLoadingLabel
            color={theme.accent}
            message={picker.isSubmitting ? "Requesting" : "Loading"}
            theme={theme}
          />
        ) : undefined
      }
    >
      <box
        width="100%"
        flexDirection="column"
        backgroundColor={theme.surface}
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.borderActive}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={0}
        paddingBottom={1}
        gap={0}
        flexShrink={0}
      >
        <text height={1} fg={theme.textMuted}>
          Filter by name or username
        </text>
        <text height={1} fg={theme.text}>
          <TextInputContent
            cursorColor={theme.accent}
            cursorTextColor={theme.inverseText}
            showCursor={!picker.isSubmitting}
            surface={createTextInputSurface(picker.input)}
          />
        </text>
        <text
          height={1}
          fg={theme.textMuted}
        >{`${users.length} matching users · ${picker.selected.size} selected`}</text>
      </box>
      <box width="100%" flexDirection="column">
        {users.slice(start, start + visibleCount).map((user, offset) => {
          const login = user.login.toLowerCase();
          const alreadyRequested = requested.has(login);
          const focused = index === start + offset;
          const recommendation = reviewerRecommendationLabel(user);
          return (
            <box
              key={login}
              width="100%"
              flexDirection="column"
              border={["left"]}
              customBorderChars={SPLIT_BORDER}
              borderColor={focused ? theme.borderActive : theme.border}
              backgroundColor={focused ? tintHex(theme.surface, theme.accent, 0.24) : theme.surface}
              paddingLeft={2}
              paddingRight={2}
              flexShrink={0}
            >
              <text height={1} fg={alreadyRequested ? theme.textMuted : theme.text} wrapMode="none">
                <span fg={focused ? theme.accent : theme.textMuted}>
                  {alreadyRequested || picker.selected.has(login) ? "[x] " : "[ ] "}
                </span>
                <span>{user.name ? `${user.name} (@${user.login})` : `@${user.login}`}</span>
                {alreadyRequested ? <span fg={theme.success}>{" · Requested"}</span> : null}
              </text>
              {recommendation != null ? (
                <text height={1} fg={theme.warning} wrapMode="none">{`    ${recommendation}`}</text>
              ) : null}
            </box>
          );
        })}
        {users.length === 0 ? (
          <box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor={theme.surface}>
            <text fg={theme.textMuted}>
              {picker.isLoading
                ? "Loading reviewers..."
                : picker.error != null
                  ? "Reviewer list unavailable."
                  : picker.input.value.trim()
                    ? "No reviewers match this filter."
                    : "No eligible reviewers found."}
            </text>
          </box>
        ) : null}
      </box>
      <box
        width="100%"
        flexDirection="column"
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={compact ? 0 : 1}
        paddingBottom={1}
        gap={compact ? 0 : 1}
        flexShrink={0}
      >
        {selected !== "" ? (
          <text
            fg={theme.text}
            wrapMode="word"
            height={compact ? 1 : 2}
          >{`Selected: ${selected}`}</text>
        ) : null}
        {picker.error != null ? (
          <text height={2} fg={theme.danger}>
            {picker.error}
          </text>
        ) : null}
        {picker.recommendationsUnavailable ? (
          <text height={1} fg={theme.textMuted}>
            GitHub suggestions unavailable. You can still select reviewers.
          </text>
        ) : null}
        <text height={1} fg={theme.textMuted} wrapMode="word">
          <KeyCap label="↑ / ↓" theme={theme} />
          <span>{" move  "}</span>
          <KeyCap label="enter" theme={theme} />
          <span>{" select  "}</span>
          <KeyCap label="ctrl+s" theme={theme} />
          <span>{" request  "}</span>
          <KeyCap label="esc" theme={theme} />
          <span>{" cancel"}</span>
        </text>
        <text height={1} fg={theme.textMuted}>
          {picker.isSubmitting
            ? "Sending requests; please wait."
            : "Type to filter · ctrl+r reloads reviewers"}
        </text>
      </box>
    </ModalFrame>
  );
}
