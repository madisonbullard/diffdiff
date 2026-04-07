#!/usr/bin/env node

import { parseArgs, requireStringArg, rewriteVersionedManifests } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const version = requireStringArg(args, "version");

rewriteVersionedManifests(version);
process.stdout.write(`Rewrote versioned manifests to ${version}.\n`);
