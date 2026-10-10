import { createHash } from "node:crypto";
import type { GitHubPullRequestDetail } from "@madisonbullard/diffdiff-core";
import type { FileTreeFileNode } from "../../types.ts";

// Not a Git path: overview state must never reach GitHub's file-viewed API.
export const PR_OVERVIEW_PATH = "\u0000pr-overview";
export const PR_OVERVIEW_INDEX = -1;

export const PR_OVERVIEW_TREE_NODE: FileTreeFileNode = {
  kind: "file",
  path: PR_OVERVIEW_PATH,
  name: "PR overview",
  depth: 0,
  ancestorPaths: [],
  fileIndex: PR_OVERVIEW_INDEX,
  status: "modified",
  additions: 0,
  deletions: 0,
};

export function getOverviewStateKeys(pr: GitHubPullRequestDetail) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([pr.url, pr.title, pr.body ?? ""]))
    .digest("hex");
  return {
    reviewed: `pr-overview:${fingerprint}:reviewed`,
    collapsed: `pr-overview:${fingerprint}:collapsed`,
  };
}
