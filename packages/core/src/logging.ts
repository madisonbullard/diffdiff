import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type DiffdiffLogLevel = "info" | "warn" | "error";

export interface DiffdiffLogSession {
  logFilePath: string;
  sessionId: string;
}

export interface StartDiffdiffLoggingOptions {
  command?: readonly string[];
  cwd?: string;
  logDirectoryPath?: string;
  sessionId?: string;
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
const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|secret|token/iu;
const MAX_SERIALIZATION_DEPTH = 8;

let activeLogSession: DiffdiffLogSession | undefined;
let loggingEnabled = false;
let processHandlersInstalled = false;
let sequence = 0;
let writeQueue = Promise.resolve();

export async function startDiffdiffLogging(
  options: StartDiffdiffLoggingOptions = {},
): Promise<DiffdiffLogSession | undefined> {
  if (activeLogSession != null) {
    return activeLogSession;
  }

  const sessionId = options.sessionId ?? randomUUID();
  const logDirectoryPath = options.logDirectoryPath ?? DEFAULT_LOG_DIRECTORY;
  const logFilePath = join(logDirectoryPath, `log-${sessionId}.jsonl`);

  try {
    await mkdir(logDirectoryPath, { recursive: true });
  } catch {
    loggingEnabled = false;
    return undefined;
  }

  activeLogSession = {
    logFilePath,
    sessionId,
  };
  loggingEnabled = true;
  installProcessHandlers();

  logDiffdiffInfo("session", "session_started", {
    command: options.command ?? process.argv,
    cwd: options.cwd ?? process.cwd(),
    logFilePath,
    pid: process.pid,
    platform: process.platform,
    sessionId,
    version: process.version,
  });

  return activeLogSession;
}

export function getDiffdiffLogSession(): DiffdiffLogSession | undefined {
  return activeLogSession;
}

export function logDiffdiffInfo(scope: string, event: string, data?: unknown): void {
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
