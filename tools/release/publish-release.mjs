#!/usr/bin/env node

import path from "node:path";
import {
  DEFAULT_RELEASE_DIRECTORY,
  getPackageConfig,
  loadReleaseManifest,
  optionalStringArg,
  parseArgs,
  resolveBooleanArg,
  resolveFromRepoRoot,
  runShell,
  shellQuote,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const directory = resolveFromRepoRoot(args.directory ?? DEFAULT_RELEASE_DIRECTORY);
const npmTag = optionalStringArg(args, "tag") ?? "latest";
const dryRun = resolveBooleanArg(args, "dry-run", false);
const manifest = loadReleaseManifest(directory);

for (const pkg of manifest.packages) {
  const packageConfig = getPackageConfig(pkg.name);
  if (packageConfig == null) {
    throw new Error(`No package config found for ${pkg.name}.`);
  }

  const tarballPath = path.join(directory, pkg.filename);
  const command = [
    "pnpm publish",
    shellQuote(tarballPath),
    "--tag",
    shellQuote(npmTag),
    packageConfig.publishAccess === "public" ? "--access public" : "",
    "--no-git-checks",
    dryRun ? "--dry-run" : "",
  ]
    .filter(Boolean)
    .join(" ");

  runShell(command);
}

process.stdout.write(
  `${dryRun ? "Dry-run published" : "Published"} ${manifest.packages.length} package${manifest.packages.length === 1 ? "" : "s"} with npm tag ${npmTag}.\n`,
);
