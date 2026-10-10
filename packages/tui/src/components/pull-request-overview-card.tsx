import type { GitHubReviewSession } from "@madisonbullard/diffdiff-core";
import type { BoxRenderable, SyntaxStyle } from "@opentui/core";
import { useMarkdownClient } from "../review/markdown-runtime.ts";
import type { UiTheme } from "../theme.ts";
import { getCollapseToggleGlyph, SPLIT_BORDER } from "./shared.tsx";

export function PullRequestOverviewCard({
  github,
  isCollapsed,
  isReviewed,
  isSelected,
  syntaxStyle,
  theme,
  rootRef,
  onSelect,
  onToggleCollapsed,
  onToggleReviewed,
}: {
  github: GitHubReviewSession;
  isCollapsed: boolean;
  isReviewed: boolean;
  isSelected: boolean;
  syntaxStyle: SyntaxStyle;
  theme: UiTheme;
  rootRef: (node: BoxRenderable | null) => void;
  onSelect?: () => void;
  onToggleCollapsed?: () => void;
  onToggleReviewed?: () => void;
}) {
  const pr = github.pullRequest;
  // Keep the worker warm across collapse/expand; dispose when the PR card leaves.
  const markdownClient = useMarkdownClient(Boolean(pr.body?.trim()));
  const status = pr.isMerged
    ? "Merged"
    : pr.state === "closed"
      ? "Closed"
      : pr.isDraft
        ? "Draft"
        : "Open";
  return (
    <box
      ref={rootRef}
      width="100%"
      flexShrink={0}
      flexDirection="column"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={isSelected ? theme.borderActive : theme.border}
      backgroundColor={theme.surface}
      paddingX={2}
      paddingY={1}
      gap={1}
    >
      <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
        <text fg={theme.accent} onMouseDown={onToggleCollapsed}>
          {`${getCollapseToggleGlyph(isCollapsed)} PR overview`}
        </text>
        <text fg={isReviewed ? theme.success : theme.textMuted} onMouseDown={onToggleReviewed}>
          {isReviewed ? "✓ Reviewed" : "○ Mark reviewed"}
        </text>
      </box>
      <text fg={theme.text} onMouseDown={onSelect}>
        <strong>{pr.title}</strong>
      </text>
      {!isCollapsed ? (
        <>
          <text
            fg={theme.textMuted}
          >{`${github.repository.owner}/${github.repository.repo}  #${pr.number}  ·  ${status}  ·  @${pr.author.login}`}</text>
          <text fg={theme.textMuted}>
            <span fg={theme.accent}>{pr.headRefName}</span>
            {" → "}
            <span fg={theme.accent}>{pr.baseRefName}</span>
            {`  ·  ${pr.commitCount} commits  ·  ${pr.changedFileCount} files`}
          </text>
          <box
            border={["top"]}
            borderColor={theme.border}
            paddingTop={1}
            width="100%"
            flexDirection="column"
          >
            {pr.body?.trim() ? (
              markdownClient == null ? (
                <text fg={theme.text}>{pr.body}</text>
              ) : (
                <markdown
                  content={pr.body}
                  syntaxStyle={syntaxStyle}
                  treeSitterClient={markdownClient}
                  fg={theme.text}
                  conceal
                  streaming={false}
                />
              )
            ) : (
              <text fg={theme.textMuted}>No description provided.</text>
            )}
          </box>
          <text fg={theme.textMuted}>
            <a href={pr.url}>View pull request on GitHub ↗</a>
          </text>
        </>
      ) : null}
    </box>
  );
}
