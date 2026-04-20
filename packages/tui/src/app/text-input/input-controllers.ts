import type { KeyboardInput } from "../../keyboard-input.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { applyTextInputKey, backspaceTextInput, createTextInputState } from "./input-state.ts";

export interface BasicTextInputController {
  applyKey(key: KeyboardInput): boolean;
  backspace(): void;
  reset(): void;
}

export interface SearchTextInputController extends BasicTextInputController {
  activate(): void;
  deactivate(): void;
}

export interface AppTextInputControllers {
  commandPalette: BasicTextInputController;
  commitSearch: SearchTextInputController;
  pullRequestSearch: SearchTextInputController;
}

type TextInputStateSetter = DiffdiffAppState["setCommandInput"];

export function createAppTextInputControllers(state: DiffdiffAppState): AppTextInputControllers {
  return {
    commandPalette: createManagedTextInputController({
      reset: () => {
        state.setCommandInput(createTextInputState());
        state.setCommandIndex(0);
      },
      setInput: state.setCommandInput,
      onTextChanged: () => {
        state.setCommandIndex(0);
      },
    }),
    commitSearch: createSearchTextInputController({
      activate: () => {
        state.setCommitSearchActive(true);
      },
      deactivate: () => {
        state.setCommitSearchActive(false);
      },
      reset: () => {
        state.setCommitSearchInput(createTextInputState());
        state.setCommitListIndex(0);
      },
      setInput: state.setCommitSearchInput,
      onTextChanged: () => {
        state.setCommitListIndex(0);
      },
    }),
    pullRequestSearch: createSearchTextInputController({
      activate: () => {
        state.setPullRequestSearchActive(true);
      },
      deactivate: () => {
        state.setPullRequestSearchActive(false);
      },
      reset: () => {
        state.setPullRequestSearchInput(createTextInputState());
        state.setPullRequestListIndex(0);
      },
      setInput: state.setPullRequestSearchInput,
      onTextChanged: () => {
        state.setPullRequestListIndex(0);
      },
    }),
  };
}

function createSearchTextInputController({
  activate,
  deactivate,
  onTextChanged,
  reset,
  setInput,
}: {
  activate: () => void;
  deactivate: () => void;
  onTextChanged: () => void;
  reset: () => void;
  setInput: TextInputStateSetter;
}): SearchTextInputController {
  const controller = createManagedTextInputController({
    onTextChanged,
    reset,
    setInput,
  });

  return {
    ...controller,
    activate,
    deactivate,
  };
}

function createManagedTextInputController({
  onTextChanged,
  reset,
  setInput,
}: {
  onTextChanged: () => void;
  reset: () => void;
  setInput: TextInputStateSetter;
}): BasicTextInputController {
  return {
    applyKey,
    backspace,
    reset,
  };

  function applyKey(key: KeyboardInput): boolean {
    let handled = false;
    let textChanged = false;

    setInput((currentInput) => {
      const result = applyTextInputKey(currentInput, key, { allowCtrlELineEnd: true });
      handled = result.handled;
      textChanged = result.nextState.value !== currentInput.value;
      return result.nextState;
    });

    if (textChanged) {
      onTextChanged();
    }

    return handled;
  }

  function backspace(): void {
    setInput((currentInput) => {
      const nextInput = backspaceTextInput(currentInput);
      if (nextInput.value !== currentInput.value) {
        onTextChanged();
      }
      return nextInput;
    });
  }
}
