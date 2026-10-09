import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The app persists review caches, preferences, and logs under the home
// directory. Point HOME at a throwaway directory before any module captures it.
process.env.HOME = mkdtempSync(join(tmpdir(), "diffdiff-visual-home-"));
