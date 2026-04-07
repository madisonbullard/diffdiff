#!/usr/bin/env node

import {
  configureGitUser,
  gitHasTrackedChanges,
  gitRefName,
  gitTagExists,
  parseArgs,
  requireStringArg,
  rewriteVersionedManifests,
  run,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const version = requireStringArg(args, "version");
const tag = `v${version}`;
const branch = gitRefName();

if (branch.length === 0) {
  throw new Error("Unable to determine the current branch for the stable release push.");
}

configureGitUser();
rewriteVersionedManifests(version, { writeSnapshot: false });
run("vp", ["install"]);

const trackedPaths = [
  "package.json",
  "pnpm-lock.yaml",
  "packages/core/package.json",
  "packages/tui/package.json",
];

if (gitHasTrackedChanges(trackedPaths)) {
  run("git", ["add", ...trackedPaths]);
  run("git", ["commit", "-m", `release: v${version}`]);
}

const tagCommand = gitTagExists(tag) ? ["tag", "-f", tag] : ["tag", tag];
run("git", tagCommand);
run("git", ["push", "origin", `HEAD:${branch}`]);
run("git", ["push", "origin", `refs/tags/${tag}`, "--force"]);

process.stdout.write(`Committed and pushed stable release ${tag} on ${branch}.\n`);
