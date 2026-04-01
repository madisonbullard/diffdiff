import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { DiffdiffPreferences, GitHubUserPreferences } from "./types.ts";
import { logDiffdiffError, logDiffdiffInfo } from "./logging.ts";

const PREFERENCES_VERSION = 1;

interface DiffdiffPreferencesRecord extends DiffdiffPreferences {
  version: number;
}

export function getDiffdiffPreferencesFilePath(homePath = homedir()): string {
  return join(homePath, ".diffdiff", "preferences.json");
}

export function getDefaultGitHubPreferences(): GitHubUserPreferences {
  return {
    cleanup: {
      removeLocal: true,
      removeRemote: false,
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
  const defaultPreferences = getDefaultDiffdiffPreferences();
  const defaultMergeMethod =
    github?.defaultMergeMethod === "merge" || github?.defaultMergeMethod === "squash"
      ? github.defaultMergeMethod
      : undefined;

  return {
    github: {
      cleanup: {
        removeLocal:
          typeof cleanup?.removeLocal === "boolean"
            ? cleanup.removeLocal
            : defaultPreferences.github.cleanup.removeLocal,
        removeRemote:
          typeof cleanup?.removeRemote === "boolean"
            ? cleanup.removeRemote
            : defaultPreferences.github.cleanup.removeRemote,
      },
      defaultMergeMethod,
    },
  };
}
