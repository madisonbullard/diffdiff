#!/usr/bin/env node

import { optionalStringArg, parseArgs, requireStringArg, run } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const tag = optionalStringArg(args, "tag") ?? `v${requireStringArg(args, "version")}`;
const repo = process.env.GITHUB_REPOSITORY ?? requireStringArg(args, "repo");
const title = optionalStringArg(args, "title") ?? tag;
const isPrerelease = optionalStringArg(args, "is-prerelease") === "true";
const target = process.env.GITHUB_SHA ?? process.env.GITHUB_REF_NAME;

const viewResult = run("gh", ["release", "view", tag, "--json", "url", "--repo", repo], {
  capture: true,
  check: false,
  env: { GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN },
});
if (viewResult.status === 0) {
  if (viewResult.stdout.trim().length > 0) {
    process.stdout.write(viewResult.stdout);
  }
  process.exit(0);
}

const command = [
  "release",
  "create",
  tag,
  "--draft",
  "--title",
  title,
  "--generate-notes",
  "--repo",
  repo,
];
if (target != null && target.length > 0) {
  command.push("--target", target);
}
if (isPrerelease) {
  command.push("--prerelease");
}

run("gh", command, {
  env: { GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN },
});
