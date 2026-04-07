#!/usr/bin/env node

import path from "node:path";
import {
  DEFAULT_RELEASE_DIRECTORY,
  loadReleaseManifest,
  optionalStringArg,
  parseArgs,
  requireStringArg,
  resolveFromRepoRoot,
  run,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const tag = requireStringArg(args, "tag");
const repo = process.env.GITHUB_REPOSITORY ?? requireStringArg(args, "repo");
const directory = resolveFromRepoRoot(args.directory ?? DEFAULT_RELEASE_DIRECTORY);
const isPrerelease = optionalStringArg(args, "is-prerelease") === "true";
const manifest = loadReleaseManifest(directory);
const assets = manifest.packages.map((pkg) => path.join(directory, pkg.filename));

if (assets.length > 0) {
  run("gh", ["release", "upload", tag, ...assets, "--clobber", "--repo", repo], {
    env: { GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN },
  });
}

const editCommand = ["release", "edit", tag, "--draft=false", "--repo", repo];
if (!isPrerelease) {
  editCommand.push("--latest");
}

run("gh", editCommand, {
  env: { GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN },
});

process.stdout.write(`Finalized GitHub release ${tag}.\n`);
