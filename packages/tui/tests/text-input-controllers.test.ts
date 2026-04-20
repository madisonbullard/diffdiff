import { describe, expect, test } from "vite-plus/test";
import { createAppTextInputControllers } from "../src/app/text-input/input-controllers.ts";
import { createTextInputState } from "../src/app/text-input/input-state.ts";

describe("app text input controllers", () => {
  test("resets the command index when command palette text changes", () => {
    const harness = createHarness();

    harness.state.commandIndex = 3;
    harness.controllers.commandPalette.applyKey({ name: "j", sequence: "j" });

    expect(harness.state.commandInput.value).toBe("j");
    expect(harness.state.commandIndex).toBe(0);
  });

  test("backspace updates pull request search and resets selection", () => {
    const harness = createHarness();

    harness.state.pullRequestListIndex = 4;
    harness.state.pullRequestSearchInput = createTextInputState("widgets");

    harness.controllers.pullRequestSearch.backspace();

    expect(harness.state.pullRequestSearchInput.value).toBe("widget");
    expect(harness.state.pullRequestListIndex).toBe(0);
  });

  test("search activation is decoupled from reset for commit search", () => {
    const harness = createHarness();

    harness.state.commitSearchInput = createTextInputState("abc");
    harness.controllers.commitSearch.activate();
    expect(harness.state.commitSearchActive).toBe(true);

    harness.controllers.commitSearch.deactivate();
    expect(harness.state.commitSearchActive).toBe(false);
    expect(harness.state.commitSearchInput.value).toBe("abc");

    harness.controllers.commitSearch.reset();
    expect(harness.state.commitSearchInput.value).toBe("");
    expect(harness.state.commitListIndex).toBe(0);
  });
});

function createHarness(): {
  controllers: ReturnType<typeof createAppTextInputControllers>;
  state: import("../src/app/state/use-app-state.ts").DiffdiffAppState;
} {
  const state = {
    commandIndex: 0,
    commandInput: createTextInputState(),
    commitListIndex: 0,
    commitSearchActive: false,
    commitSearchInput: createTextInputState(),
    pullRequestListIndex: 0,
    pullRequestSearchActive: false,
    pullRequestSearchInput: createTextInputState(),
    setCommandIndex: createSetter(
      () => state.commandIndex,
      (value) => {
        state.commandIndex = value;
      },
    ),
    setCommandInput: createSetter(
      () => state.commandInput,
      (value) => {
        state.commandInput = value;
      },
    ),
    setCommitListIndex: createSetter(
      () => state.commitListIndex,
      (value) => {
        state.commitListIndex = value;
      },
    ),
    setCommitSearchActive: createSetter(
      () => state.commitSearchActive,
      (value) => {
        state.commitSearchActive = value;
      },
    ),
    setCommitSearchInput: createSetter(
      () => state.commitSearchInput,
      (value) => {
        state.commitSearchInput = value;
      },
    ),
    setPullRequestListIndex: createSetter(
      () => state.pullRequestListIndex,
      (value) => {
        state.pullRequestListIndex = value;
      },
    ),
    setPullRequestSearchActive: createSetter(
      () => state.pullRequestSearchActive,
      (value) => {
        state.pullRequestSearchActive = value;
      },
    ),
    setPullRequestSearchInput: createSetter(
      () => state.pullRequestSearchInput,
      (value) => {
        state.pullRequestSearchInput = value;
      },
    ),
  } as unknown as import("../src/app/state/use-app-state.ts").DiffdiffAppState;

  return {
    controllers: createAppTextInputControllers(state),
    state,
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
