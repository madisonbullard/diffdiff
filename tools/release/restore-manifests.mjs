#!/usr/bin/env node

import { restoreManifestSnapshot } from "./lib.mjs";

restoreManifestSnapshot();
process.stdout.write("Restored versioned manifests from snapshot.\n");
