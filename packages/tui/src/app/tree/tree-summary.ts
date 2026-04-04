export function getTreeSummaryLabels({
  additions,
  deletions,
  reviewedCount,
  sidebarWidth,
  totalFiles,
}: {
  additions: number;
  deletions: number;
  reviewedCount: number;
  sidebarWidth: number;
  totalFiles: number;
}) {
  const contentWidth = Math.max(sidebarWidth - 6, 0);
  const variants = [
    {
      reviewed: `${reviewedCount} / ${totalFiles} reviewed`,
      diffAdditions: `+${additions}`,
      diffSeparator: " / ",
      diffDeletions: `-${deletions}`,
    },
    {
      reviewed: `${reviewedCount}/${totalFiles} rev`,
      diffAdditions: `+${additions}`,
      diffSeparator: "/",
      diffDeletions: `-${deletions}`,
    },
    {
      reviewed: `${reviewedCount}/${totalFiles}`,
      diffAdditions: `+${additions}`,
      diffSeparator: "/",
      diffDeletions: `-${deletions}`,
    },
  ];

  return (
    variants.find(
      ({ reviewed, diffAdditions, diffSeparator, diffDeletions }) =>
        reviewed.length + diffAdditions.length + diffSeparator.length + diffDeletions.length + 1 <=
        contentWidth,
    ) ?? variants[variants.length - 1]!
  );
}
