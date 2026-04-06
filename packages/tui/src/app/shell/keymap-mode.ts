import { tintHex } from "../../components/shared.tsx";
import type { AppPane, ListModalView } from "../../types.ts";
import type { UiTheme } from "../../theme.ts";
import type { AppDialog } from "../dialogs/stack.ts";
import type { PrefixMenuConfig } from "../commands/prefix-menus.ts";

export type KeymapMode =
  | "clear-reviewed"
  | "diff"
  | "thread"
  | "diagnostics"
  | "tree"
  | "help"
  | "commands"
  | "pull-request-list"
  | "pull-request-search"
  | "compare-branches"
  | "compare-commits"
  | "commit-search"
  | "filters"
  | "comment"
  | "conversation"
  | "submit-review"
  | "merge-method"
  | "merge-title"
  | "merge-body"
  | "confirm-merge"
  | "cleanup";

interface KeymapModeBadge {
  bg: string;
  fg: string;
  label: string;
}

interface ResolveActiveKeymapModeOptions {
  activeDialog: AppDialog | null;
  activeListView: ListModalView;
  activePane: AppPane;
  commitSearchActive: boolean;
  hasSelectedReviewThread: boolean;
  mergeConfirmOpen: boolean;
  mergeModalField: "method" | "title" | "body";
  pullRequestSearchActive: boolean;
}

export function resolveActiveKeymapMode({
  activeDialog,
  activeListView,
  activePane,
  commitSearchActive,
  hasSelectedReviewThread,
  mergeConfirmOpen,
  mergeModalField,
  pullRequestSearchActive,
}: ResolveActiveKeymapModeOptions): KeymapMode {
  switch (activeDialog) {
    case "help":
      return "help";
    case "diagnostics":
      return "diagnostics";
    case "clear-reviewed":
      return "clear-reviewed";
    case "command-palette":
      return "commands";
    case "pull-request-list":
      return pullRequestSearchActive ? "pull-request-search" : "pull-request-list";
    case "branch":
      if (activeListView === "commit" && commitSearchActive) {
        return "commit-search";
      }

      return activeListView === "commit" ? "compare-commits" : "compare-branches";
    case "list-filter":
      return "filters";
    case "comment-composer":
      return "comment";
    case "comments":
      return "conversation";
    case "submit-review":
      return "submit-review";
    case "merge":
      if (mergeConfirmOpen) {
        return "confirm-merge";
      }

      if (mergeModalField === "method") {
        return "merge-method";
      }

      return mergeModalField === "title" ? "merge-title" : "merge-body";
    case "cleanup":
      return "cleanup";
    default:
      if (activePane === "tree") {
        return "tree";
      }

      if (hasSelectedReviewThread) {
        return "thread";
      }

      return "diff";
  }
}

export function keymapModeSuspendsGlobalKeybinds(mode: KeymapMode): boolean {
  return (
    mode === "clear-reviewed" ||
    mode === "commands" ||
    mode === "comment" ||
    mode === "submit-review" ||
    mode === "merge-method" ||
    mode === "merge-title" ||
    mode === "merge-body" ||
    mode === "confirm-merge" ||
    mode === "commit-search" ||
    mode === "pull-request-search"
  );
}

export function getPrefixModeBadge(prefixMenu: PrefixMenuConfig, theme: UiTheme): KeymapModeBadge {
  if (prefixMenu.prefix === "leader") {
    return {
      bg: theme.accent,
      fg: theme.inverseText,
      label: prefixMenu.badgeLabel,
    };
  }

  return {
    bg: tintHex(theme.surfaceMuted, theme.accent, 0.28),
    fg: theme.text,
    label: prefixMenu.badgeLabel,
  };
}

export function getKeymapModeBadge(mode: KeymapMode, theme: UiTheme): KeymapModeBadge {
  const navigationMode = (label: string): KeymapModeBadge => ({
    bg: tintHex(theme.surfaceMuted, theme.accent, 0.28),
    fg: theme.text,
    label,
  });

  const searchMode = (label: string): KeymapModeBadge => ({
    bg: tintHex(theme.surfaceMuted, theme.warning, 0.28),
    fg: theme.text,
    label,
  });

  const reviewThreadMode = (): KeymapModeBadge => ({
    bg: theme.commentBg,
    fg: theme.commentAnnotation,
    label: "THREAD",
  });

  const actionMode = (label: string): KeymapModeBadge => ({
    bg: tintHex(theme.surfaceMuted, theme.success, 0.28),
    fg: theme.text,
    label,
  });

  switch (mode) {
    case "clear-reviewed":
      return actionMode("CONFIRM");
    case "diff":
      return navigationMode("DIFF");
    case "thread":
      return reviewThreadMode();
    case "diagnostics":
      return navigationMode("DIAGNOSTICS");
    case "tree":
      return navigationMode("TREE");
    case "help":
      return navigationMode("HELP");
    case "commands":
      return searchMode("CMDS");
    case "pull-request-list":
      return navigationMode("PR LIST");
    case "pull-request-search":
      return searchMode("PR SEARCH");
    case "compare-branches":
      return navigationMode("BRANCHES");
    case "compare-commits":
      return navigationMode("COMMITS");
    case "commit-search":
      return searchMode("COMMIT SEARCH");
    case "filters":
      return searchMode("FILTERS");
    case "comment":
      return searchMode("COMMENT");
    case "conversation":
      return navigationMode("CONVO");
    case "submit-review":
      return searchMode("SUBMIT");
    case "merge-method":
      return actionMode("MERGE METHOD");
    case "merge-title":
      return actionMode("MERGE TITLE");
    case "merge-body":
      return actionMode("MERGE BODY");
    case "confirm-merge":
      return actionMode("CONFIRM");
    case "cleanup":
      return actionMode("CLEANUP");
  }
}
