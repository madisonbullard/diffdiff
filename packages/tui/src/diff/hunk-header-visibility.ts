import type { FileDiffMetadata } from "@pierre/diffs";

export function shouldHideLeadingHunkHeader(
  hunkIndex: number,
  hunk: FileDiffMetadata["hunks"][number],
): boolean {
  if (hunkIndex !== 0 || hunk.collapsedBefore > 0) {
    return false;
  }

  const firstContent = hunk.hunkContent[0];
  if (firstContent == null || firstContent.type === "context") {
    return false;
  }

  return Math.max(hunk.deletionStart, hunk.additionStart) <= 1;
}
