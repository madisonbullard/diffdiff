import type { ReactNode } from "react";
import type { PullRequestListItem } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import { KeyCap, ModalFrame, SPLIT_BORDER, selectItem, tintHex } from "./shared.tsx";

const PULL_REQUEST_LIST_MAX_VISIBLE = 10;
const PULL_REQUEST_LIST_CONTENT_WIDTH = 96;

export function PullRequestListModal({
  isLoading,
  pullRequests,
  reviewRequestedCount,
  searchActive,
  searchQuery,
  selectedIndex,
  theme,
}: {
  isLoading: boolean;
  pullRequests: readonly PullRequestListItem[];
  reviewRequestedCount: number;
  searchActive: boolean;
  searchQuery: string;
  selectedIndex: number;
  theme: UiTheme;
}) {
  const selectedPullRequest = selectItem(pullRequests, selectedIndex);

  return (
    <ModalFrame
      title="GitHub PRs"
      subtitle="Browse your open and review-requested pull requests across repositories."
      theme={theme}
      maxWidth={108}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.border}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={1}
      >
        <text fg={theme.textMuted} wrapMode="none">
          <span>{`${pullRequests.length}`}</span>
          <span>{" open / draft PRs"}</span>
          <span fg={theme.border}>{"  │  "}</span>
          <span>{`${reviewRequestedCount}`}</span>
          <span>{" review requested"}</span>
        </text>
      </box>

      <box width="100%" flexDirection="column" gap={0}>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={searchActive ? theme.borderActive : theme.border}
          backgroundColor={searchActive ? theme.surfaceMuted : theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={0}
          paddingBottom={0}
          flexDirection="row"
          gap={1}
        >
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={searchActive ? theme.accent : theme.textMuted}>/</span>
            <span fg={searchQuery !== "" ? theme.text : theme.textMuted}>
              {searchQuery !== "" ? searchQuery : searchActive ? "" : "search pull requests..."}
            </span>
            {searchActive ? <span fg={theme.accent}>_</span> : null}
          </text>
        </box>

        {pullRequests.length === 0 ? (
          <EmptyListNotice
            message={
              isLoading
                ? "Loading pull requests..."
                : searchQuery !== ""
                  ? "No pull requests match the current search."
                  : "No open authored or review-requested pull requests."
            }
            theme={theme}
          />
        ) : null}

        <box width="100%" flexDirection="column" gap={0}>
          {getPullRequestListWindow(pullRequests, selectedIndex).map(({ item, index }) => {
            const isSelected = index === selectedIndex;
            const pullRequest = item.pullRequest;
            const repoLabel = `${pullRequest.repository.owner}/${pullRequest.repository.repo}`;
            const authorLabel = pullRequest.author.login;
            const titleLabel = truncateTitle(
              pullRequest.title,
              Math.max(
                PULL_REQUEST_LIST_CONTENT_WIDTH - repoLabel.length - authorLabel.length - 6,
                12,
              ),
            );

            return (
              <ListRow key={item.key} isSelected={isSelected} theme={theme}>
                <text wrapMode="none">
                  <span fg={isSelected ? theme.accent : theme.warning}>{repoLabel}</span>
                  <span fg={theme.textMuted}>{"  │  "}</span>
                  <span fg={isSelected ? theme.text : theme.textMuted}>{titleLabel}</span>
                  <span fg={theme.textMuted}>{"  │  "}</span>
                  <span fg={theme.textMuted}>{authorLabel}</span>
                </text>
              </ListRow>
            );
          })}
        </box>
      </box>

      <box
        width="100%"
        border={["left"]}
        customBorderChars={SPLIT_BORDER}
        borderColor={theme.borderActive}
        backgroundColor={theme.surface}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        gap={1}
      >
        {selectedPullRequest != null ? (
          <>
            <text fg={theme.text}>{selectedPullRequest.pullRequest.title}</text>
            <text fg={theme.textMuted} wrapMode="none">
              <span>{`${selectedPullRequest.pullRequest.repository.owner}/${selectedPullRequest.pullRequest.repository.repo}`}</span>
              <span fg={theme.border}>{"  │  "}</span>
              <span>{selectedPullRequest.pullRequest.author.login}</span>
              {selectedPullRequest.pullRequest.isReviewRequested ? (
                <>
                  <span fg={theme.border}>{"  │  "}</span>
                  <span fg={theme.warning}>review requested</span>
                </>
              ) : null}
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <KeyCap label="enter" theme={theme} />
              <span>{" open  "}</span>
              <KeyCap label="/" theme={theme} />
              <span>{" search  "}</span>
              <KeyCap label="j / k" theme={theme} />
              <span>{" move"}</span>
            </text>
          </>
        ) : (
          <text fg={theme.textMuted}>
            {isLoading ? "Loading pull requests..." : "Nothing to show."}
          </text>
        )}
      </box>
    </ModalFrame>
  );
}

function getPullRequestListWindow(
  items: readonly PullRequestListItem[],
  selectedIndex: number,
): { item: PullRequestListItem; index: number }[] {
  if (items.length <= PULL_REQUEST_LIST_MAX_VISIBLE) {
    return items.map((item, index) => ({ item, index }));
  }

  let start = selectedIndex - Math.floor(PULL_REQUEST_LIST_MAX_VISIBLE / 2);
  start = Math.max(0, Math.min(start, items.length - PULL_REQUEST_LIST_MAX_VISIBLE));
  const end = start + PULL_REQUEST_LIST_MAX_VISIBLE;

  return items.slice(start, end).map((item, index) => ({ item, index: start + index }));
}

function ListRow({
  children,
  isSelected,
  theme,
}: {
  children: ReactNode;
  isSelected: boolean;
  theme: UiTheme;
}) {
  const accentColor = theme.accent;

  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={isSelected ? theme.borderActive : accentColor}
      backgroundColor={tintHex(theme.surface, accentColor, isSelected ? 0.24 : 0.14)}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      flexDirection="row"
      gap={1}
    >
      {children}
    </box>
  );
}

function EmptyListNotice({ message, theme }: { message: string; theme: UiTheme }) {
  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={theme.border}
      backgroundColor={theme.surface}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
    >
      <text fg={theme.textMuted}>{message}</text>
    </box>
  );
}

function truncateTitle(title: string, maxWidth: number): string {
  const normalizedTitle = title.replace(/\s+/gu, " ").trim();
  if (normalizedTitle.length <= maxWidth) {
    return normalizedTitle;
  }

  if (maxWidth <= 3) {
    return normalizedTitle.slice(0, maxWidth);
  }

  return `${normalizedTitle.slice(0, maxWidth - 3)}...`;
}
