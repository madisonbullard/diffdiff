import { describe, expect, test, vi } from "vite-plus/test";
import type { GitHubMergeMethod } from "@madisonbullard/diffdiff-core";
import { createReviewComposerState } from "../src/app/review/review-composer-state.ts";
import { getReviewComposerModels } from "../src/app/review/review-composer-models.ts";
import {
  createReviewInputControllers,
  type ReviewInputControllers,
} from "../src/app/review/review-input-controllers.ts";
import { createTextInputState } from "../src/app/text-input/input-state.ts";

describe("review input controllers", () => {
  test("restores the latest dismissed draft when opening the same composer target", () => {
    const harness = createHarness();
    const target = createReviewThreadTarget();

    harness.state.reviewComposer.history = [
      {
        body: "Restored draft",
        createdAt: "2026-04-01T00:00:00.000Z",
        outcome: "dismissed",
        repositoryRootPath: "/tmp/diffdiff",
        target: {
          key: "review-thread:src/app.ts:12-12:RIGHT",
          kind: "review-thread",
          path: "src/app.ts",
          pullRequestNumber: 42,
        },
      },
    ];

    harness.controllers.reviewComposer.open(target, "Commenting on src/app.ts:12.");

    expect(harness.state.reviewComposer.input.value).toBe("Restored draft");
    expect(harness.statusMessage).toBe("Commenting on src/app.ts:12. Restored draft.");
  });

  test("accepts autocomplete through the review composer controller", () => {
    const harness = createHarness();

    harness.state.reviewComposer.target = createReviewThreadTarget();
    harness.state.reviewComposer.input = createTextInputState("Please check @app#12-18");

    expect(harness.controllers.reviewComposer.acceptAutocomplete()).toBe(true);
    expect(harness.state.reviewComposer.input.value).toBe("Please check `src/app.ts#12-18` ");
  });

  test("moves submit-review selection when the cursor is already on the boundary line", () => {
    const harness = createHarness();

    harness.state.reviewSubmissionEventIndex = 1;
    harness.state.reviewSubmissionInput = createTextInputState("Ship it");

    harness.controllers.reviewSubmission.move(1);

    expect(harness.state.reviewSubmissionEventIndex).toBe(2);
    expect(harness.state.reviewSubmissionInput.value).toBe("Ship it");
  });

  test("opens merge state through the merge controller and cycles fields", () => {
    const harness = createHarness();

    harness.controllers.mergeMessage.open({
      body: "Body",
      defaultMethod: "squash",
      title: "Title",
    });

    expect(harness.state.mergeCommitTitleInput.value).toBe("Title");
    expect(harness.state.mergeCommitMessageInput.value).toBe("Body");
    expect(harness.state.mergeMethod).toBe("squash");
    expect(harness.state.mergeModalField).toBe("title");

    harness.controllers.mergeMessage.cycleField();
    expect(harness.state.mergeModalField).toBe("body");

    harness.controllers.mergeMessage.cycleField();
    expect(harness.state.mergeModalField).toBe("method");
  });

  test("resets review and merge inputs through their controllers", () => {
    const harness = createHarness();

    harness.state.reviewComposer.target = createReviewThreadTarget();
    harness.state.reviewComposer.input = createTextInputState("Draft body");
    harness.state.mergeCommitTitleInput = createTextInputState("Title");
    harness.state.mergeCommitMessageInput = createTextInputState("Body");
    harness.state.mergeMethod = "merge";
    harness.state.mergeModalField = "body";
    harness.state.mergeConfirmOpen = true;

    harness.controllers.reviewComposer.reset();
    harness.controllers.mergeMessage.reset();

    expect(harness.state.reviewComposer.target).toBeNull();
    expect(harness.state.reviewComposer.input.value).toBe("");
    expect(harness.state.mergeCommitTitleInput.value).toBe("");
    expect(harness.state.mergeCommitMessageInput.value).toBe("");
    expect(harness.state.mergeMethod).toBeUndefined();
    expect(harness.state.mergeModalField).toBe("method");
    expect(harness.state.mergeConfirmOpen).toBe(false);
  });

  test("exposes the review composer input through the feature model surface", () => {
    const harness = createHarness();

    harness.state.reviewComposer.target = createReviewThreadTarget();
    harness.state.reviewComposer.input = createTextInputState("Needs a follow-up note");

    const models = getReviewComposerModels({
      reviewComposer: harness.state.reviewComposer,
      selectedPath: "src/app.ts",
      session: harness.state.session,
    });

    expect(models.inputSurface).toEqual({
      cursorOffset: "Needs a follow-up note".length,
      value: "Needs a follow-up note",
    });
  });
});

function createHarness(): {
  controllers: ReviewInputControllers;
  state: import("../src/app/state/use-app-state.ts").DiffdiffAppState;
  statusMessage: string;
} {
  let statusMessage = "Ready.";

  const state = {
    mergeCommitMessageInput: createTextInputState(),
    mergeCommitTitleInput: createTextInputState(),
    mergeConfirmOpen: false,
    mergeMethod: undefined as GitHubMergeMethod | undefined,
    mergeModalField: "method" as "method" | "title" | "body",
    reviewComposer: createReviewComposerState(),
    reviewSubmissionEventIndex: 0,
    reviewSubmissionInput: createTextInputState(),
    session: {
      files: [{ path: "src/app.ts" }, { path: "src/utils.ts" }],
      github: { pullRequest: { number: 42 } },
      repository: { rootPath: "/tmp/diffdiff" },
    },
    setMergeCommitMessageInput: createSetter(
      () => state.mergeCommitMessageInput,
      (value) => {
        state.mergeCommitMessageInput = value;
      },
    ),
    setMergeCommitTitleInput: createSetter(
      () => state.mergeCommitTitleInput,
      (value) => {
        state.mergeCommitTitleInput = value;
      },
    ),
    setMergeConfirmOpen: createSetter(
      () => state.mergeConfirmOpen,
      (value) => {
        state.mergeConfirmOpen = value;
      },
    ),
    setMergeMethod: createSetter(
      () => state.mergeMethod,
      (value) => {
        state.mergeMethod = value;
      },
    ),
    setMergeModalField: createSetter(
      () => state.mergeModalField,
      (value) => {
        state.mergeModalField = value;
      },
    ),
    setReviewComposer: createSetter(
      () => state.reviewComposer,
      (value) => {
        state.reviewComposer = value;
      },
    ),
    setReviewSubmissionEventIndex: createSetter(
      () => state.reviewSubmissionEventIndex,
      (value) => {
        state.reviewSubmissionEventIndex = value;
      },
    ),
    setReviewSubmissionInput: createSetter(
      () => state.reviewSubmissionInput,
      (value) => {
        state.reviewSubmissionInput = value;
      },
    ),
    setStatusMessage: createSetter(
      () => statusMessage,
      (value) => {
        statusMessage = value;
      },
    ),
  } as unknown as import("../src/app/state/use-app-state.ts").DiffdiffAppState;

  const controllers = createReviewInputControllers({
    getSelectedFilePath: () => "src/app.ts",
    persistence: {
      persistenceApi: {
        handleAppError: vi.fn(),
      },
    } as unknown as import("../src/app/session/use-app-persistence.ts").DiffdiffAppPersistence,
    props: {
      appendReviewComposerHistory: vi.fn(async () => undefined),
      openExternalEditor: vi.fn(async (_repositoryRootPath, initialValue) => initialValue),
    },
    state,
  });

  return {
    controllers,
    state,
    get statusMessage() {
      return statusMessage;
    },
  };
}

function createSetter<T>(
  getValue: () => T,
  setValue: (value: T) => void,
): (updater: T | ((current: T) => T)) => void {
  return (updater) => {
    setValue(typeof updater === "function" ? (updater as (current: T) => T)(getValue()) : updater);
  };
}

function createReviewThreadTarget(): import("../src/app/review/review-composer.ts").ReviewComposerTarget {
  return {
    anchor: {
      line: 12,
      path: "src/app.ts",
      side: "RIGHT",
      snippet: "const count = 1",
      startLine: 12,
    },
    kind: "review-thread",
  } as import("../src/app/review/review-composer.ts").ReviewComposerTarget;
}
