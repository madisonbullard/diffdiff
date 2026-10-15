import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { runCommand } from "../src/command.ts";
import { GitHubPullRequestService } from "../src/github/pull-request-service.ts";

test("cleanup preserves checked-out, changed, and unmerged branch tips", async () => {
  const path = await mkdtemp(join(tmpdir(), "diffdiff-cleanup-"));
  const git = (...args: string[]) => runCommand("git", args, { cwd: path });
  try {
    await git("init", "-b", "main");
    await git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "base",
    );
    const base = (await git("rev-parse", "HEAD")).trim();
    await git("branch", "safe");
    await git("branch", "extra");
    await git("checkout", "extra");
    await git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "extra",
    );
    const extra = (await git("rev-parse", "HEAD")).trim();
    await git("checkout", "main");
    const service = new GitHubPullRequestService({ create: async () => null });
    await git("branch", "elsewhere", base);
    await git("worktree", "add", join(path, "other"), "elsewhere");
    await expect(
      service.removeCleanupRefs(path, [
        {
          kind: "local-branch",
          ref: "elsewhere",
          branchName: "elsewhere",
          expectedSha: base,
          mergedHeadSha: base,
        },
      ]),
    ).rejects.toThrow("checked out");
    await git("update-ref", "refs/remotes/origin/topic", extra);
    await expect(
      service.removeCleanupRefs(path, [
        { kind: "remote-tracking", ref: "origin/topic", branchName: "topic", expectedSha: base },
      ]),
    ).rejects.toThrow("changed");
    await expect(
      service.removeCleanupRefs(path, [
        {
          kind: "local-branch",
          ref: "main",
          branchName: "main",
          expectedSha: base,
          mergedHeadSha: base,
        },
      ]),
    ).rejects.toThrow();
    await expect(
      service.removeCleanupRefs(path, [
        {
          kind: "local-branch",
          ref: "extra",
          branchName: "extra",
          expectedSha: extra,
          mergedHeadSha: base,
        },
      ]),
    ).rejects.toThrow();
    await expect(
      service.removeCleanupRefs(path, [
        {
          kind: "local-branch",
          ref: "extra",
          branchName: "extra",
          expectedSha: base,
          mergedHeadSha: extra,
        },
      ]),
    ).rejects.toThrow();
    await service.removeCleanupRefs(path, [
      {
        kind: "local-branch",
        ref: "safe",
        branchName: "safe",
        expectedSha: base,
        mergedHeadSha: base,
      },
    ]);
    expect(await git("branch", "--list", "safe")).toBe("");
    expect(await git("branch", "--list", "extra")).toContain("extra");
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});
