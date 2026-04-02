import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ComparisonInfo } from "./types/session.ts";

export type DiffdiffLogLevel = "info" | "warn" | "error";

export interface DiffdiffLogSession {
  logFilePath: string;
  sessionFilePath: string;
  sessionId: string;
}

export interface StartDiffdiffLoggingOptions {
  command?: readonly string[];
  cwd?: string;
  logDirectoryPath?: string;
  sessionDirectoryPath?: string;
  sessionId?: string;
  verbose?: boolean;
}

export interface DiffdiffSessionActivity {
  activeOverlay?: string;
  comparison?: Pick<ComparisonInfo, "base" | "head" | "mode" | "range">;
  currentBranch?: string;
  endedAt?: string;
  lastErrorMessage?: string;
  repoPath?: string;
  repositoryName?: string;
  repositoryRootPath?: string;
  selectedFilePath?: string;
  statusMessage?: string;
}

export interface DiffdiffSessionRecord extends DiffdiffLogSession, DiffdiffSessionActivity {
  command: readonly string[];
  cwd: string;
  isActive: boolean;
  pid: number;
  startedAt: string;
  state: "active" | "ended" | "stale";
  updatedAt: string;
}

interface DiffdiffLogEntry {
  data?: unknown;
  error?: ReturnType<typeof serializeError>;
  event: string;
  level: DiffdiffLogLevel;
  scope: string;
  sequence: number;
  sessionId: string;
  timestamp: string;
}

const DEFAULT_LOG_DIRECTORY = join(homedir(), ".diffdiff", "logs");
const DEFAULT_SESSION_DIRECTORY = join(homedir(), ".diffdiff", "sessions");
const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|secret|token/iu;
const SESSION_FILE_PREFIX = "session-";
const SESSION_FILE_SUFFIX = ".json";
const MAX_SERIALIZATION_DEPTH = 8;
type DiffdiffSessionStringField = Exclude<keyof DiffdiffSessionActivity, "comparison">;

let activeLogSession: DiffdiffLogSession | undefined;
let activeSessionRecord: Omit<DiffdiffSessionRecord, "isActive" | "state"> | undefined;
let loggingEnabled = false;
let processHandlersInstalled = false;
let sequence = 0;
let verboseLoggingEnabled = false;
let writeQueue = Promise.resolve();

export async function startDiffdiffLogging(
  options: StartDiffdiffLoggingOptions = {},
): Promise<DiffdiffLogSession | undefined> {
  if (activeLogSession != null) {
    return activeLogSession;
  }

  const sessionId = options.sessionId ?? randomUUID();
  const logDirectoryPath = options.logDirectoryPath ?? DEFAULT_LOG_DIRECTORY;
  const sessionDirectoryPath = options.sessionDirectoryPath ?? DEFAULT_SESSION_DIRECTORY;
  const logFilePath = join(logDirectoryPath, `log-${sessionId}.jsonl`);
  const sessionFilePath = join(
    sessionDirectoryPath,
    `${SESSION_FILE_PREFIX}${sessionId}${SESSION_FILE_SUFFIX}`,
  );

  try {
    await mkdir(logDirectoryPath, { recursive: true });
    await mkdir(sessionDirectoryPath, { recursive: true });
  } catch {
    loggingEnabled = false;
    return undefined;
  }

  activeLogSession = {
    logFilePath,
    sessionFilePath,
    sessionId,
  };
  const startedAt = new Date().toISOString();
  verboseLoggingEnabled = options.verbose === true;
  activeSessionRecord = {
    command: [...(options.command ?? process.argv)],
    cwd: options.cwd ?? process.cwd(),
    logFilePath,
    pid: process.pid,
    repoPath: options.cwd ?? process.cwd(),
    sessionFilePath,
    sessionId,
    startedAt,
    statusMessage: "Launching diffdiff.",
    updatedAt: startedAt,
  };
  loggingEnabled = true;
  installProcessHandlers();
  await queueWrite(() => writeSessionRecord(activeSessionRecord!));

  logDiffdiffInfo("session", "session_started", {
    command: options.command ?? process.argv,
    cwd: options.cwd ?? process.cwd(),
    logFilePath,
    pid: process.pid,
    platform: process.platform,
    sessionFilePath,
    sessionId,
    version: process.version,
  });

  return activeLogSession;
}

export function getDiffdiffLogSession(): DiffdiffLogSession | undefined {
  return activeLogSession;
}

export function isDiffdiffVerboseLoggingEnabled(): boolean {
  return verboseLoggingEnabled;
}

export function logDiffdiffInfo(scope: string, event: string, data?: unknown): void {
  queueLogEntry({
    data,
    event,
    level: "info",
    scope,
  });
}

export function logDiffdiffVerbose(scope: string, event: string, data?: unknown): void {
  if (!verboseLoggingEnabled) {
    return;
  }

  queueLogEntry({
    data,
    event,
    level: "info",
    scope,
  });
}

export function logDiffdiffWarn(scope: string, event: string, data?: unknown): void {
  queueLogEntry({
    data,
    event,
    level: "warn",
    scope,
  });
}

export function logDiffdiffError(
  scope: string,
  event: string,
  error: unknown,
  data?: unknown,
): void {
  queueLogEntry({
    data,
    error: serializeError(error),
    event,
    level: "error",
    scope,
  });
}

export async function flushDiffdiffLogs(): Promise<void> {
  await writeQueue;
}

export function updateDiffdiffSessionActivity(
  activity: Partial<DiffdiffSessionActivity>,
): Promise<void> {
  if (activeSessionRecord == null) {
    return Promise.resolve();
  }

  const nextRecord: Omit<DiffdiffSessionRecord, "isActive" | "state"> = {
    ...activeSessionRecord,
    updatedAt: new Date().toISOString(),
  };

  applyOptionalStringField(nextRecord, "activeOverlay", activity.activeOverlay);
  applyOptionalStringField(nextRecord, "currentBranch", activity.currentBranch);
  applyOptionalStringField(nextRecord, "endedAt", activity.endedAt);
  applyOptionalStringField(nextRecord, "lastErrorMessage", activity.lastErrorMessage);
  applyOptionalStringField(nextRecord, "repoPath", activity.repoPath);
  applyOptionalStringField(nextRecord, "repositoryName", activity.repositoryName);
  applyOptionalStringField(nextRecord, "repositoryRootPath", activity.repositoryRootPath);
  applyOptionalStringField(nextRecord, "selectedFilePath", activity.selectedFilePath);
  applyOptionalStringField(nextRecord, "statusMessage", activity.statusMessage);

  if (activity.comparison !== undefined) {
    if (activity.comparison == null) {
      delete nextRecord.comparison;
    } else {
      nextRecord.comparison = {
        base: activity.comparison.base,
        head: activity.comparison.head,
        mode: activity.comparison.mode,
        range: activity.comparison.range,
      };
    }
  }

  activeSessionRecord = nextRecord;
  return queueWrite(() => writeSessionRecord(nextRecord));
}

export function markDiffdiffSessionEnded(statusMessage = "Exited diffdiff."): Promise<void> {
  return updateDiffdiffSessionActivity({
    endedAt: new Date().toISOString(),
    statusMessage,
  });
}

export async function listDiffdiffSessions(
  options: {
    sessionDirectoryPath?: string;
  } = {},
): Promise<DiffdiffSessionRecord[]> {
  const sessionDirectoryPath = options.sessionDirectoryPath ?? DEFAULT_SESSION_DIRECTORY;
  const sessionFileNames = await listSessionFileNames(sessionDirectoryPath);
  const sessions = await Promise.all(
    sessionFileNames.map((fileName) =>
      readSessionRecord(join(sessionDirectoryPath, fileName)).catch(() => undefined),
    ),
  );

  return sessions
    .filter((session): session is DiffdiffSessionRecord => session != null)
    .sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
}

export async function removeDiffdiffSession(
  sessionId: string,
  options: {
    sessionDirectoryPath?: string;
  } = {},
): Promise<boolean> {
  const sessionDirectoryPath = options.sessionDirectoryPath ?? DEFAULT_SESSION_DIRECTORY;
  const sessionFilePath = join(
    sessionDirectoryPath,
    `${SESSION_FILE_PREFIX}${sessionId}${SESSION_FILE_SUFFIX}`,
  );
  const session = await readSessionRecord(sessionFilePath).catch(() => undefined);
  if (session == null) {
    return false;
  }

  await Promise.allSettled([
    rm(session.sessionFilePath, { force: true }),
    rm(session.logFilePath, { force: true }),
  ]);

  return true;
}

export async function removeAllDiffdiffSessions(
  options: {
    sessionDirectoryPath?: string;
  } = {},
): Promise<number> {
  const sessions = await listDiffdiffSessions(options);
  await Promise.all(sessions.map((session) => removeDiffdiffSession(session.sessionId, options)));
  return sessions.length;
}

function installProcessHandlers(): void {
  if (processHandlersInstalled) {
    return;
  }

  processHandlersInstalled = true;
  process.on("uncaughtExceptionMonitor", (error, origin) => {
    logDiffdiffError("process", "uncaught_exception", error, { origin });
  });
  process.on("unhandledRejection", (reason) => {
    logDiffdiffError("process", "unhandled_rejection", reason);
  });
}

function queueLogEntry(input: {
  data?: unknown;
  error?: ReturnType<typeof serializeError>;
  event: string;
  level: DiffdiffLogLevel;
  scope: string;
}): void {
  if (!loggingEnabled || activeLogSession == null) {
    return;
  }

  const entry: DiffdiffLogEntry = {
    data: sanitizeForLog(input.data),
    error: input.error,
    event: input.event,
    level: input.level,
    scope: input.scope,
    sequence: sequence,
    sessionId: activeLogSession.sessionId,
    timestamp: new Date().toISOString(),
  };
  sequence += 1;

  const session = activeLogSession;
  if (session == null) {
    return;
  }

  const serializedEntry = `${JSON.stringify(entry)}\n`;
  writeQueue = writeQueue
    .then(() => appendFile(session.logFilePath, serializedEntry, "utf8"))
    .catch(() => undefined);
}

function applyOptionalStringField(
  record: Partial<DiffdiffSessionActivity>,
  key: DiffdiffSessionStringField,
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }

  if (value === "") {
    delete record[key];
    return;
  }

  record[key] = value;
}

async function listSessionFileNames(sessionDirectoryPath: string): Promise<string[]> {
  try {
    const fileNames = await readdir(sessionDirectoryPath);
    return fileNames.filter(
      (fileName) =>
        fileName.startsWith(SESSION_FILE_PREFIX) && fileName.endsWith(SESSION_FILE_SUFFIX),
    );
  } catch {
    return [];
  }
}

async function readSessionRecord(sessionFilePath: string): Promise<DiffdiffSessionRecord> {
  const fileContents = await readFile(sessionFilePath, "utf8");
  const storedRecord = JSON.parse(fileContents) as Omit<
    DiffdiffSessionRecord,
    "isActive" | "state"
  >;
  const isActive = storedRecord.endedAt == null && isProcessActive(storedRecord.pid);
  const state = storedRecord.endedAt != null ? "ended" : isActive ? "active" : "stale";

  return {
    ...storedRecord,
    isActive,
    state,
  };
}

function isProcessActive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function queueWrite(task: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(task).catch(() => undefined);
  return writeQueue;
}

async function writeSessionRecord(
  sessionRecord: Omit<DiffdiffSessionRecord, "isActive" | "state">,
): Promise<void> {
  await writeFile(
    sessionRecord.sessionFilePath,
    `${JSON.stringify(sessionRecord, null, 2)}\n`,
    "utf8",
  );
}

function sanitizeForLog(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (depth >= MAX_SERIALIZATION_DEPTH) {
    return "[MaxDepth]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const entries = Object.entries(value);
    const sanitizedObject = Object.fromEntries(
      entries.map(([key, entryValue]) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          return [key, "[REDACTED]"];
        }

        return [key, sanitizeForLog(entryValue, depth + 1, seen)];
      }),
    );

    seen.delete(value);
    return sanitizedObject;
  }

  return Object.prototype.toString.call(value);
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return sanitizeForLog({
      cause: error.cause,
      message: error.message,
      name: error.name,
      stack: error.stack,
    }) as {
      cause?: unknown;
      message?: string;
      name?: string;
      stack?: string;
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
    raw: sanitizeForLog(error),
  };
}
