#!/usr/bin/env node

import path from "node:path";
import {
  DEFAULT_RELEASE_DIRECTORY,
  PUBLISHABLE_PACKAGES,
  parseArgs,
  packPackage,
  requireStringArg,
  resetDirectory,
  resolveFromRepoRoot,
  rewriteVersionedManifests,
  run,
  writeReleaseManifest,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const version = requireStringArg(args, "version");
const directory = resolveFromRepoRoot(args["pack-destination"] ?? DEFAULT_RELEASE_DIRECTORY);

rewriteVersionedManifests(version);
run("vp", ["run", "build", "-r"]);
resetDirectory(directory);

const packages = PUBLISHABLE_PACKAGES.map((pkg) => packPackage(pkg, directory));
const releaseManifest = {
  version,
  packages: packages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version,
    filename: pkg.filename,
    publishAccess: pkg.publishAccess,
  })),
};

writeReleaseManifest(directory, releaseManifest);

process.stdout.write(
  `${JSON.stringify(
    {
      ...releaseManifest,
      directory: path.relative(process.cwd(), directory) || ".",
    },
    null,
    2,
  )}\n`,
);
