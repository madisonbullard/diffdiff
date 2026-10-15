import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
  DiffdiffPreferences,
  GitHubUserPreferences,
  GitHubCleanupPreferences,
} from "./types/github.ts";
import { logDiffdiffError, logDiffdiffInfo } from "./logging.ts";

const PREFERENCES_VERSION = 1;

interface DiffdiffPreferencesRecord extends DiffdiffPreferences {
  keys?: Record<string, Record<string, unknown>>;
  version: number;
}

export function getDiffdiffPreferencesFilePath(homePath = homedir()): string {
  return join(homePath, ".diffdiff", "preferences.json");
}

export function getDefaultGitHubPreferences(): GitHubUserPreferences {
  return {
    cleanup: {
      afterMerge: true,
    },
  };
}

export function getDefaultDiffdiffPreferences(): DiffdiffPreferences {
  return {
    github: getDefaultGitHubPreferences(),
  };
}

export async function loadDiffdiffPreferences(
  filePath = getDiffdiffPreferencesFilePath(),
): Promise<DiffdiffPreferences> {
  try {
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents) as Partial<DiffdiffPreferencesRecord>;
    const normalized = normalizePreferences(parsed);

    if (normalized == null) {
      logDiffdiffInfo("preferences", "preferences_ignored", {
        filePath,
      });
      return getDefaultDiffdiffPreferences();
    }

    logDiffdiffInfo("preferences", "preferences_loaded", {
      filePath,
      hasDefaultMergeMethod: normalized.github.defaultMergeMethod != null,
    });

    return normalized;
  } catch {
    return getDefaultDiffdiffPreferences();
  }
}

export async function saveDiffdiffPreferences(
  preferences: DiffdiffPreferences,
  filePath = getDiffdiffPreferencesFilePath(),
): Promise<void> {
  const normalized = normalizePreferences({
    version: PREFERENCES_VERSION,
    ...preferences,
  });
  const nextPreferences = normalized ?? getDefaultDiffdiffPreferences();
  const record: DiffdiffPreferencesRecord = {
    ...nextPreferences,
    version: PREFERENCES_VERSION,
  };

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    logDiffdiffInfo("preferences", "preferences_saved", {
      filePath,
      hasDefaultMergeMethod: nextPreferences.github.defaultMergeMethod != null,
    });
  } catch (error) {
    logDiffdiffError("preferences", "preferences_save_failed", error, {
      filePath,
    });
    throw error;
  }
}

function normalizePreferences(
  record: Partial<DiffdiffPreferencesRecord>,
): DiffdiffPreferences | undefined {
  if (record.version != null && record.version !== PREFERENCES_VERSION) {
    return undefined;
  }

  const github = record.github;
  const cleanup = github?.cleanup;
  const defaultMergeMethod =
    github?.defaultMergeMethod === "merge" || github?.defaultMergeMethod === "squash"
      ? github.defaultMergeMethod
      : undefined;

  const keys =
    record.keys != null && typeof record.keys === "object" && !Array.isArray(record.keys)
      ? (record.keys as Record<string, Record<string, unknown>>)
      : undefined;

  return {
    github: {
      cleanup: {
        afterMerge: getCleanupAfterMerge(cleanup),
      },
      defaultMergeMethod,
    },
    keys,
  };
}

export function getCleanupAfterMerge(cleanup?: GitHubCleanupPreferences): boolean {
  if (typeof cleanup?.afterMerge === "boolean") return cleanup.afterMerge;
  if (typeof cleanup?.removeLocal === "boolean" || typeof cleanup?.removeRemote === "boolean")
    return Boolean(cleanup.removeLocal || cleanup.removeRemote);
  return true;
}
