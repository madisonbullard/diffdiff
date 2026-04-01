import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vite-plus/test";
import {
  flushDiffdiffLogs,
  listDiffdiffSessions,
  markDiffdiffSessionEnded,
  removeDiffdiffSession,
  startDiffdiffLogging,
  updateDiffdiffSessionActivity,
} from "../src/index.ts";

const temporaryDirectories: string[] = [];

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("diffdiff session logging", () => {
  test("tracks active session metadata and supports removal", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "diffdiff-logging-"));
    temporaryDirectories.push(rootDirectory);
    const logDirectoryPath = join(rootDirectory, "logs");
    const sessionDirectoryPath = join(rootDirectory, "sessions");

    await startDiffdiffLogging({
      command: ["diffdiff"],
      cwd: "/tmp/repo",
      logDirectoryPath,
      sessionDirectoryPath,
      sessionId: "session-a",
    });
    await updateDiffdiffSessionActivity({
      comparison: {
        base: "origin/main",
        head: "feature/ui",
        mode: "range",
        range: "origin/main...feature/ui",
      },
      currentBranch: "feature/ui",
      repositoryName: "diffdiff",
      repositoryRootPath: "/tmp/repo",
      selectedFilePath: "src/app.ts",
      statusMessage: "Reviewing src/app.ts.",
    });
    await flushDiffdiffLogs();

    const activeSessions = await listDiffdiffSessions({ sessionDirectoryPath });

    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0]).toMatchObject({
      comparison: {
        base: "origin/main",
        head: "feature/ui",
      },
      currentBranch: "feature/ui",
      isActive: true,
      logFilePath: join(logDirectoryPath, "log-session-a.jsonl"),
      repositoryName: "diffdiff",
      selectedFilePath: "src/app.ts",
      sessionId: "session-a",
      state: "active",
      statusMessage: "Reviewing src/app.ts.",
    });

    await markDiffdiffSessionEnded();
    await flushDiffdiffLogs();

    const endedSessions = await listDiffdiffSessions({ sessionDirectoryPath });
    expect(endedSessions[0]).toMatchObject({
      isActive: false,
      state: "ended",
      statusMessage: "Exited diffdiff.",
    });

    await expect(removeDiffdiffSession("session-a", { sessionDirectoryPath })).resolves.toBe(true);
    await expect(listDiffdiffSessions({ sessionDirectoryPath })).resolves.toEqual([]);
  });
});
