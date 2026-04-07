#!/usr/bin/env node

import { optionalStringArg, parseArgs, resolveReleaseContext, writeGithubOutputs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));

const context = await resolveReleaseContext({
  channel: optionalStringArg(args, "channel"),
  bump: optionalStringArg(args, "bump"),
  version: optionalStringArg(args, "version"),
});

writeGithubOutputs({
  channel: context.channel,
  version: context.version,
  tag: context.tag,
  npm_tag: context.npmTag,
  is_preview: context.isPreview,
  is_prerelease: context.isPrerelease,
});

process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
