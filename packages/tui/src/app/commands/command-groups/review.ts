import type { AppCommand, BuildAppCommandsOptions } from "../registry.ts";

export function buildReviewCommands({
  bulkReviewedActionsDisabledReason,
  canClearReviewed,
  canMoveToNextUnreviewed,
  clearReviewed,
  hasFiles,
  markAllReviewed,
  moveToNextUnreviewed,
  toggleCollapsedSelectedFile,
  toggleReviewedSelectedFile,
}: Pick<
  BuildAppCommandsOptions,
  | "bulkReviewedActionsDisabledReason"
  | "canClearReviewed"
  | "canMoveToNextUnreviewed"
  | "clearReviewed"
  | "hasFiles"
  | "markAllReviewed"
  | "moveToNextUnreviewed"
  | "toggleCollapsedSelectedFile"
  | "toggleReviewedSelectedFile"
>): AppCommand[] {
  return [
    {
      category: "Review",
      description: "Mark the selected file as reviewed or not reviewed.",
      disabledReason: hasFiles ? undefined : "No files are available to review.",
      enabled: hasFiles,
      keybindingContexts: ["diff"],
      suggested: true,
      title: "Toggle reviewed",
      value: "review.toggle-reviewed",
      run: () => toggleReviewedSelectedFile(),
    },
    {
      category: "Review",
      description: "Jump to the next file that is not marked reviewed.",
      disabledReason: !canMoveToNextUnreviewed
        ? hasFiles
          ? "All files are already reviewed."
          : "No files are available to review."
        : undefined,
      enabled: canMoveToNextUnreviewed,
      suggested: canMoveToNextUnreviewed,
      title: "Jump to next unreviewed file",
      value: "review.next-unreviewed",
      run: () => moveToNextUnreviewed(),
    },
    {
      category: "Review",
      description: "Mark every file in the current comparison as reviewed.",
      disabledReason:
        bulkReviewedActionsDisabledReason ??
        (hasFiles ? undefined : "No files are available to review."),
      enabled: bulkReviewedActionsDisabledReason == null && hasFiles,
      title: "Mark all reviewed",
      value: "review.mark-all-reviewed",
      run: () => markAllReviewed(),
    },
    {
      category: "Review",
      description: "Clear the reviewed state from every file in the current comparison.",
      disabledReason:
        bulkReviewedActionsDisabledReason ??
        (canClearReviewed ? undefined : "No files are marked reviewed."),
      enabled: bulkReviewedActionsDisabledReason == null && canClearReviewed,
      title: "Unmark all reviewed",
      value: "review.clear-reviewed",
      run: () => clearReviewed(),
    },
    {
      category: "Review",
      description: "Collapse or expand the selected file diff.",
      disabledReason: hasFiles ? undefined : "No files are available to review.",
      enabled: hasFiles,
      keybindingContexts: ["diff"],
      title: "Toggle collapsed",
      value: "review.toggle-collapsed",
      run: () => toggleCollapsedSelectedFile(),
    },
  ];
}
