import { DiffdiffError } from "../errors.ts";
import type { ChangedFile, ChangeSummary } from "../types.ts";

const FIELD_SEPARATOR = "\u0000";

interface StatusEntry {
  status: string;
  path: string;
  originalPath?: string;
}

export function summarizeChangedFiles(files: readonly ChangedFile[]): ChangeSummary {
  return files.reduce<ChangeSummary>(
    (summary, file) => ({
      filesChanged: summary.filesChanged + 1,
      additions: summary.additions + file.additions,
      deletions: summary.deletions + file.deletions,
    }),
    {
      filesChanged: 0,
      additions: 0,
      deletions: 0,
    },
  );
}

export function parseNumstatSummary(stdout: string): ChangeSummary {
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .reduce<ChangeSummary>(
      (summary, line) => {
        const [additions, deletions] = line.split("\t", 3);

        return {
          filesChanged: summary.filesChanged + 1,
          additions:
            summary.additions +
            (additions != null && additions !== "-" ? Number.parseInt(additions, 10) : 0),
          deletions:
            summary.deletions +
            (deletions != null && deletions !== "-" ? Number.parseInt(deletions, 10) : 0),
        };
      },
      {
        filesChanged: 0,
        additions: 0,
        deletions: 0,
      },
    );
}

export function parsePorcelainStatusEntries(stdout: string): StatusEntry[] {
  const entries: StatusEntry[] = [];
  let offset = 0;

  while (offset < stdout.length) {
    const status = stdout.slice(offset, offset + 2);
    if (status.length < 2) {
      break;
    }

    offset += 3;
    const pathEnd = stdout.indexOf(FIELD_SEPARATOR, offset);
    if (pathEnd === -1) {
      break;
    }

    const firstPath = stdout.slice(offset, pathEnd);
    offset = pathEnd + 1;

    if (status.startsWith("R") || status.startsWith("C")) {
      const renamedPathEnd = stdout.indexOf(FIELD_SEPARATOR, offset);
      if (renamedPathEnd === -1) {
        break;
      }

      entries.push({
        status,
        path: stdout.slice(offset, renamedPathEnd),
        originalPath: firstPath,
      });
      offset = renamedPathEnd + 1;
      continue;
    }

    entries.push({ status, path: firstPath });
  }

  return entries;
}

export function splitPatchIntoFiles(patch: string): string[] {
  const matches = [...patch.matchAll(/^diff --git .*$/gmu)];
  if (matches.length === 0) {
    return [];
  }

  const sections: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const nextMatch = matches[index + 1];
    const end = nextMatch?.index ?? patch.length;
    sections.push(trimPatchSection(patch.slice(start, end)));
  }

  return sections;
}

// Preserve diff content lines that are a single space, which represent blank context lines.
function trimPatchSection(section: string): string {
  return section.replace(/[\r\n]+$/u, "");
}

export function parseChangedFilePatch(patch: string): ChangedFile {
  const lines = patch.split(/\r?\n/u);
  const header = lines[0] ?? "";
  const headerMatch = /^diff --git a\/(.+) b\/(.+)$/u.exec(header);

  const renameFrom = findPatchValue(lines, "rename from ");
  const renameTo = findPatchValue(lines, "rename to ");
  const isAdded = lines.some((line) => line.startsWith("new file mode "));
  const isDeleted = lines.some((line) => line.startsWith("deleted file mode "));
  const isBinary = lines.some((line) => line.startsWith("Binary files "));
  const path = renameTo ?? headerMatch?.[2];
  const previousPath = renameFrom ?? (renameTo != null ? headerMatch?.[1] : undefined);

  if (path == null) {
    throw new DiffdiffError("Unable to parse git diff output for changed files.");
  }

  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      continue;
    }

    if (line.startsWith("+")) {
      additions += 1;
      continue;
    }

    if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return {
    path,
    previousPath,
    status:
      renameFrom != null && renameTo != null
        ? "renamed"
        : isAdded
          ? "added"
          : isDeleted
            ? "deleted"
            : "modified",
    additions,
    deletions,
    isBinary,
    patch,
  };
}

function findPatchValue(lines: readonly string[], prefix: string): string | undefined {
  return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length);
}
