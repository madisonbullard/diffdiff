import { readFile } from "node:fs/promises";

export type SessionDiagnosticLevel = "info" | "warn" | "error";

export interface SessionDiagnosticEvent {
  data?: unknown;
  detailText: string;
  error?: unknown;
  event: string;
  level: SessionDiagnosticLevel;
  scope: string;
  sequence: number;
  sessionId: string;
  summaryText: string;
  timestamp: string;
}

interface RawSessionDiagnosticEvent {
  data?: unknown;
  error?: unknown;
  event?: unknown;
  level?: unknown;
  scope?: unknown;
  sequence?: unknown;
  sessionId?: unknown;
  timestamp?: unknown;
}

export async function loadSessionDiagnosticEvents(
  logFilePath: string,
): Promise<SessionDiagnosticEvent[]> {
  const fileContents = await readFile(logFilePath, "utf8");
  const lines = fileContents.split(/\r?\n/gu);
  const events: SessionDiagnosticEvent[] = [];

  for (const [index, line] of lines.entries()) {
    const trimmedLine = line.trim();
    if (trimmedLine === "") {
      continue;
    }

    const parsedLine = JSON.parse(trimmedLine) as RawSessionDiagnosticEvent;
    const normalizedEvent = normalizeSessionDiagnosticEvent(parsedLine, index);
    events.push({
      ...normalizedEvent,
      detailText: JSON.stringify(normalizedEvent, null, 2),
      summaryText: summarizeSessionDiagnosticEvent(normalizedEvent),
    });
  }

  return events;
}

function normalizeSessionDiagnosticEvent(
  entry: RawSessionDiagnosticEvent,
  index: number,
): Omit<SessionDiagnosticEvent, "detailText" | "summaryText"> {
  return {
    data: entry.data,
    error: entry.error,
    event: getOptionalString(entry.event) ?? "unknown_event",
    level: normalizeLevel(entry.level),
    scope: getOptionalString(entry.scope) ?? "diagnostics",
    sequence: typeof entry.sequence === "number" ? entry.sequence : index,
    sessionId: getOptionalString(entry.sessionId) ?? "",
    timestamp: getOptionalString(entry.timestamp) ?? "",
  };
}

function summarizeSessionDiagnosticEvent(entry: {
  data?: unknown;
  error?: unknown;
  event: string;
  scope: string;
}): string {
  const segments = [
    getMessageText(entry.data),
    getMessageText(entry.error),
    summarizeValue(entry.data),
  ].filter((segment): segment is string => segment != null && segment.trim() !== "");

  return segments[0] ?? `${entry.scope}.${entry.event}`;
}

function summarizeValue(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean" || typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function getMessageText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (!isObject(value)) {
    return undefined;
  }

  return getOptionalString(value.message);
}

function normalizeLevel(value: unknown): SessionDiagnosticLevel {
  return value === "warn" || value === "error" ? value : "info";
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
