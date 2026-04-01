import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
          removeLocal: false,
          removeRemote: true,
        },
        defaultMergeMethod: "squash",
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
          removeLocal: true,
          removeRemote: false,
        },
        defaultMergeMethod: "merge",
      },
      version: 1,
    });
  });
});
