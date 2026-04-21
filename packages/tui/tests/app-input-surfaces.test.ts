import { describe, expect, test } from "vite-plus/test";
import { createAppInputSurfaces } from "../src/app/input/app-input-surfaces.ts";
import { createTextInputState } from "../src/app/text-input/input-state.ts";

describe("app input surfaces", () => {
  test("projects app text inputs into view-facing surfaces", () => {
    const surfaces = createAppInputSurfaces({
      commandInput: createTextInputState("command"),
      commitSearchInput: createTextInputState("commit"),
      mergeCommitMessageInput: createTextInputState("body"),
      mergeCommitTitleInput: createTextInputState("title"),
      pullRequestSearchInput: createTextInputState("pull request"),
      reviewSubmissionInput: createTextInputState("summary"),
    } as import("../src/app/state/use-app-state.ts").DiffdiffAppState);

    expect(surfaces).toEqual({
      commandPalette: { cursorOffset: 7, value: "command" },
      commitSearch: { cursorOffset: 6, value: "commit" },
      mergeBody: { cursorOffset: 4, value: "body" },
      mergeTitle: { cursorOffset: 5, value: "title" },
      pullRequestSearch: { cursorOffset: 12, value: "pull request" },
      reviewSubmission: { cursorOffset: 7, value: "summary" },
    });
  });
});
