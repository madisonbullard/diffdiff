import type { BranchListItem } from "../types.ts";
import { getRemoteShortName, shortSha } from "./shared.tsx";
export function getBranchListItemTitle(item: BranchListItem): string {
  if (item.kind === "working-tree") return "Working tree";
  if (item.kind === "open-pr" && item.branch?.pullRequest)
    return `${item.branch.pullRequest.title} (#${item.branch.pullRequest.number})`;
  if (!item.branch) return "Nothing selected";
  return item.branch.kind === "remote" ? getRemoteShortName(item.branch) : item.branch.name;
}
export function getBranchListItemMeta(item: BranchListItem, base: string, head: string): string {
  if (item.kind === "working-tree")
    return `Compares the working tree against ${head === "working tree" ? base : "HEAD"}.`;
  if (!item.branch) return "Nothing to show.";
  const details = [`sha ${shortSha(item.branch.sha)}`];
  if (item.branch.upstream) details.push(`upstream ${item.branch.upstream}`);
  if (item.branch.summary) details.push(`diff vs ${item.branch.summary.comparedTo}`);
  if (item.branch.name === base) details.push("selected as base");
  if (item.branch.name === head) details.push("selected as head");
  return details.join("  │  ");
}
