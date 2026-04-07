import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { logDiffdiffError, logDiffdiffInfo } from "./logging.ts";

export const MAX_REVIEW_COMPOSER_HISTORY_ENTRIES = 50;

export type ReviewComposerHistoryOutcome = "dismissed" | "submitted";
export type ReviewComposerHistoryTargetKind =
  | "pull-request-comment-reply"
  | "review-thread"
  | "review-thread-reply";

export interface ReviewComposerHistoryTarget {
  key: string;
  kind: ReviewComposerHistoryTargetKind;
  path?: string;
  pullRequestNumber?: number;
}

export interface ReviewComposerHistoryEntry {
  body: string;
  createdAt: string;
  outcome: ReviewComposerHistoryOutcome;
  repositoryRootPath: string;
  target: ReviewComposerHistoryTarget;
}

export function getReviewComposerHistoryFilePath(homePath = homedir()): string {
  return join(homePath, ".diffdiff", "review-composer-history.jsonl");
}

export async function loadReviewComposerHistory(
  filePath = getReviewComposerHistoryFilePath(),
): Promise<ReviewComposerHistoryEntry[]> {
  try {
    const contents = await readFile(filePath, "utf8");
    const parsedLines = contents
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== "")
      .map(parseHistoryLine);
    const history = parsedLines
      .filter((entry): entry is ReviewComposerHistoryEntry => entry != null)
      .slice(-MAX_REVIEW_COMPOSER_HISTORY_ENTRIES);

    if (history.length !== parsedLines.length) {
      await writeHistoryFile(filePath, history);
    }

    logDiffdiffInfo("review-composer-history", "history_loaded", {
      entryCount: history.length,
      filePath,
    });

    return history;
  } catch {
    return [];
  }
}

export async function appendReviewComposerHistory(
  entry: ReviewComposerHistoryEntry,
  filePath = getReviewComposerHistoryFilePath(),
): Promise<void> {
  try {
    const history = await loadReviewComposerHistory(filePath);
    const nextHistory = [...history, entry].slice(-MAX_REVIEW_COMPOSER_HISTORY_ENTRIES);
    await writeHistoryFile(filePath, nextHistory);
    logDiffdiffInfo("review-composer-history", "history_saved", {
      entryCount: nextHistory.length,
      filePath,
      outcome: entry.outcome,
      repositoryRootPath: entry.repositoryRootPath,
      targetKey: entry.target.key,
      targetKind: entry.target.kind,
    });
  } catch (error) {
    logDiffdiffError("review-composer-history", "history_save_failed", error, {
      filePath,
      outcome: entry.outcome,
      repositoryRootPath: entry.repositoryRootPath,
      targetKey: entry.target.key,
      targetKind: entry.target.kind,
    });
    throw error;
  }
}

function parseHistoryLine(line: string): ReviewComposerHistoryEntry | null {
  try {
    const value = JSON.parse(line) as Partial<ReviewComposerHistoryEntry>;
    return isReviewComposerHistoryEntry(value) ? value : null;
  } catch {
    return null;
  }
}

function isReviewComposerHistoryEntry(
  value: Partial<ReviewComposerHistoryEntry> | undefined,
): value is ReviewComposerHistoryEntry {
  return (
    value != null &&
    typeof value.body === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.repositoryRootPath === "string" &&
    (value.outcome === "dismissed" || value.outcome === "submitted") &&
    value.target != null &&
    typeof value.target.key === "string" &&
    (value.target.kind === "pull-request-comment-reply" ||
      value.target.kind === "review-thread" ||
      value.target.kind === "review-thread-reply") &&
    (value.target.path == null || typeof value.target.path === "string") &&
    (value.target.pullRequestNumber == null || typeof value.target.pullRequestNumber === "number")
  );
}

async function writeHistoryFile(
  filePath: string,
  history: readonly ReviewComposerHistoryEntry[],
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    history.length === 0 ? "" : `${history.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
    "utf8",
  );
}
