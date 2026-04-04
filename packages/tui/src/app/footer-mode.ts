import { tintHex } from "../components/shared.tsx";
import type { AppPane, ListModalView } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import type { AppDialog } from "./dialog-stack.ts";

export interface FooterModeBadge {
  bg: string;
  fg: string;
  label: string;
}

interface ResolveFooterModeBadgeOptions {
  activeDialog: AppDialog | null;
  activeListView: ListModalView;
  activePane: AppPane;
  commitSearchActive: boolean;
  hasSelectedReviewThread: boolean;
  leaderActive: boolean;
  mergeConfirmOpen: boolean;
  mergeModalField: "method" | "title" | "body";
  pullRequestSearchActive: boolean;
  theme: UiTheme;
}

export function resolveFooterModeBadge({
  activeDialog,
  activeListView,
  activePane,
  commitSearchActive,
  hasSelectedReviewThread,
  leaderActive,
  mergeConfirmOpen,
  mergeModalField,
  pullRequestSearchActive,
  theme,
}: ResolveFooterModeBadgeOptions): FooterModeBadge {
  if (leaderActive) {
    return {
      bg: theme.accent,
      fg: theme.inverseText,
      label: "LEADER",
    };
  }

  const navigationMode = (label: string): FooterModeBadge => ({
    bg: tintHex(theme.surfaceMuted, theme.accent, 0.28),
    fg: theme.text,
    label,
  });

  const searchMode = (label: string): FooterModeBadge => ({
    bg: tintHex(theme.surfaceMuted, theme.warning, 0.28),
    fg: theme.text,
    label,
  });

  const reviewThreadMode = (): FooterModeBadge => ({
    bg: theme.commentBg,
    fg: theme.commentAnnotation,
    label: "THREAD",
  });

  const actionMode = (label: string): FooterModeBadge => ({
    bg: tintHex(theme.surfaceMuted, theme.success, 0.28),
    fg: theme.text,
    label,
  });

  switch (activeDialog) {
    case "help":
      return navigationMode("HELP");
    case "command-palette":
      return searchMode("CMDS");
    case "pull-request-list":
      return pullRequestSearchActive ? searchMode("PR SEARCH") : navigationMode("PR LIST");
    case "branch":
      if (activeListView === "commit" && commitSearchActive) {
        return searchMode("COMMIT SEARCH");
      }

      return navigationMode(activeListView === "commit" ? "COMMITS" : "BRANCHES");
    case "list-filter":
      return searchMode("FILTERS");
    case "comment-composer":
      return searchMode("COMMENT");
    case "comments":
      return navigationMode("CONVO");
    case "submit-review":
      return searchMode("SUBMIT");
    case "merge":
      if (mergeConfirmOpen) {
        return actionMode("CONFIRM");
      }

      if (mergeModalField === "method") {
        return actionMode("MERGE METHOD");
      }

      return actionMode(mergeModalField === "title" ? "MERGE TITLE" : "MERGE BODY");
    case "cleanup":
      return actionMode("CLEANUP");
    default:
      if (activePane === "tree") {
        return navigationMode("TREE");
      }

      if (hasSelectedReviewThread) {
        return reviewThreadMode();
      }

      return navigationMode("DIFF");
  }
}
