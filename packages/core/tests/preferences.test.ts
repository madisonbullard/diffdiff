import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  getDefaultDiffdiffPreferences,
  getDiffdiffPreferencesFilePath,
  loadDiffdiffPreferences,
  saveDiffdiffPreferences,
} from "../src/preferences.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("diffdiff preferences", () => {
  test("migrates cleanup flags to one remembered afterMerge option", async () => {
    const home = await mkdtemp(join(tmpdir(), "diffdiff-preferences-"));
    temporaryDirectories.push(home);
    const path = join(home, "prefs.json");
    for (const [removeLocal, removeRemote, expected] of [
      [false, false, false],
      [true, false, true],
      [false, true, true],
    ]) {
      await writeFile(path, JSON.stringify({ github: { cleanup: { removeLocal, removeRemote } } }));
      expect((await loadDiffdiffPreferences(path)).github.cleanup.afterMerge).toBe(expected);
    }
    await writeFile(
      path,
      JSON.stringify({ github: { cleanup: { afterMerge: false, removeLocal: true } } }),
    );
    expect((await loadDiffdiffPreferences(path)).github.cleanup).toEqual({ afterMerge: false });
    await writeFile(path, JSON.stringify({ github: { cleanup: {} } }));
    expect((await loadDiffdiffPreferences(path)).github.cleanup).toEqual({ afterMerge: true });
  });
  test("returns the default preferences when no file exists", async () => {
    const homePath = await mkdtemp(join(tmpdir(), "diffdiff-preferences-"));
    temporaryDirectories.push(homePath);

    const preferences = await loadDiffdiffPreferences(getDiffdiffPreferencesFilePath(homePath));

    expect(preferences).toEqual(getDefaultDiffdiffPreferences());
  });

  test("saves and loads merge defaults and cleanup defaults", async () => {
    const homePath = await mkdtemp(join(tmpdir(), "diffdiff-preferences-"));
    temporaryDirectories.push(homePath);
    const filePath = getDiffdiffPreferencesFilePath(homePath);

    await saveDiffdiffPreferences(
      {
        github: {
          cleanup: {
            removeLocal: false,
            removeRemote: true,
          },
          defaultMergeMethod: "squash",
        },
      },
      filePath,
    );

    const preferences = await loadDiffdiffPreferences(filePath);

    expect(preferences).toEqual({
      github: {
        cleanup: {
          afterMerge: true,
        },
        defaultMergeMethod: "squash",
      },
    });
  });

  test("ignores legacy ui settings when loading older preference files", async () => {
    const homePath = await mkdtemp(join(tmpdir(), "diffdiff-preferences-"));
    temporaryDirectories.push(homePath);
    const filePath = getDiffdiffPreferencesFilePath(homePath);

    await mkdir(dirname(filePath), { recursive: true });

    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          github: {
            cleanup: {
              removeLocal: false,
              removeRemote: true,
            },
          },
          ui: {
            showKeyLegend: false,
          },
          version: 1,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const preferences = await loadDiffdiffPreferences(filePath);

    expect(preferences).toEqual({
      github: {
        cleanup: {
          afterMerge: true,
        },
        defaultMergeMethod: undefined,
      },
    });
  });

  test("writes preferences to ~/.diffdiff/preferences.json-compatible JSON", async () => {
    const homePath = await mkdtemp(join(tmpdir(), "diffdiff-preferences-"));
    temporaryDirectories.push(homePath);
    const filePath = getDiffdiffPreferencesFilePath(homePath);

    await saveDiffdiffPreferences(
      {
        github: {
          cleanup: {
            removeLocal: true,
            removeRemote: false,
          },
          defaultMergeMethod: "merge",
        },
      },
      filePath,
    );

    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents);

    expect(parsed).toMatchObject({
      github: {
        cleanup: {
          afterMerge: true,
        },
        defaultMergeMethod: "merge",
      },
      version: 1,
    });
    expect(parsed.github.cleanup).not.toHaveProperty("removeLocal");
    expect(parsed.github.cleanup).not.toHaveProperty("removeRemote");
  });
});
