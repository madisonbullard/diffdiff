import type { ReviewComposerHistoryOutcome } from "@madisonbullard/diffdiff-core";
import { clampIndex } from "../../view-model.ts";
import type { KeyboardInput } from "../../keyboard-input.ts";
import { dismissReviewComposerAutocomplete } from "./review-composer-state.ts";
import {
  appendReviewComposerHistoryEntry,
  clearReviewComposer,
  moveReviewComposerAutocompleteIndex,
  moveReviewComposerHistory,
  openReviewComposer,
  setReviewComposerAutocompleteIndex,
  updateReviewComposerInput,
} from "./review-composer-state.ts";
import { findLatestDismissedReviewComposerDraft } from "../../review/composer-history.ts";
import { formatMergeMessageBuffer, parseMergeMessageBuffer } from "../../review/merge-message.ts";
import { getReviewComposerHistoryScope, type ReviewComposerTarget } from "./review-composer.ts";
import { getReviewComposerModels, type ReviewComposerModels } from "./review-composer-models.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import {
  applyTextInputKey,
  backspaceTextInput,
  createTextInputState,
  insertTextInputNewline,
  isTextInputOnFirstLine,
  isTextInputOnLastLine,
  moveTextInputCursorDown,
  moveTextInputCursorUp,
} from "../text-input/input-state.ts";
import { insertReviewComposerAutocomplete } from "../../review/composer-autocomplete.ts";

interface CreateReviewInputControllersOptions {
  getSelectedFilePath: () => string | undefined;
  persistence: DiffdiffAppPersistence;
  props: Pick<DiffdiffAppProps, "appendReviewComposerHistory" | "openExternalEditor">;
  state: DiffdiffAppState;
}

export interface ReviewComposerController {
  acceptAutocomplete(): boolean;
  applyKey(key: KeyboardInput): boolean;
  backspace(): void;
  close(): boolean;
  dismissAutocomplete(): boolean;
  getModels(): ReviewComposerModels;
  insertNewline(): void;
  move(delta: number): void;
  open(target: ReviewComposerTarget, statusMessage: string): void;
  openExternalEditor(): Promise<void>;
  persistHistory(
    outcome: ReviewComposerHistoryOutcome,
    body: string,
    target: ReviewComposerTarget,
  ): Promise<void>;
  reset(): void;
}

export interface ReviewSubmissionController {
  applyKey(key: KeyboardInput): boolean;
  backspace(): void;
  close(): void;
  insertNewline(): void;
  move(delta: number): void;
  open(body: string): void;
  openExternalEditor(): Promise<void>;
  reset(): void;
}

export interface MergeMessageController {
  applyBodyKey(key: KeyboardInput): boolean;
  applyTitleKey(key: KeyboardInput): boolean;
  backspaceBody(): void;
  backspaceTitle(): void;
  close(): void;
  cycleField(): void;
  insertBodyNewline(): void;
  open(options: {
    body: string;
    defaultMethod?: import("@madisonbullard/diffdiff-core").GitHubMergeMethod;
    title: string;
  }): void;
  openExternalEditor(): Promise<void>;
  reset(): void;
}

export interface ReviewInputControllers {
  mergeMessage: MergeMessageController;
  reviewComposer: ReviewComposerController;
  reviewSubmission: ReviewSubmissionController;
}

export function createReviewInputControllers({
  getSelectedFilePath,
  persistence,
  props,
  state,
}: CreateReviewInputControllersOptions): ReviewInputControllers {
  return {
    mergeMessage: createMergeMessageController({ persistence, props, state }),
    reviewComposer: createReviewComposerController({
      getSelectedFilePath,
      persistence,
      props,
      state,
    }),
    reviewSubmission: createReviewSubmissionController({ persistence, props, state }),
  };
}

function createReviewComposerController({
  getSelectedFilePath,
  persistence,
  props,
  state,
}: CreateReviewInputControllersOptions): ReviewComposerController {
  return {
    acceptAutocomplete,
    applyKey,
    backspace,
    close,
    dismissAutocomplete,
    getModels,
    insertNewline,
    move,
    open,
    openExternalEditor,
    persistHistory,
    reset,
  };

  function getModels(): ReviewComposerModels {
    return getReviewComposerModels({
      reviewComposer: state.reviewComposer,
      selectedPath: getSelectedFilePath(),
      session: state.session,
    });
  }

  function open(target: ReviewComposerTarget, statusMessage: string): void {
    const historyScope = getReviewComposerHistoryScope(state.session, target);
    const restoredDraft = findLatestDismissedReviewComposerDraft(
      state.reviewComposer.history,
      historyScope,
    )?.body;

    state.setReviewComposer((currentReviewComposer) =>
      openReviewComposer(currentReviewComposer, target, restoredDraft ?? ""),
    );
    state.setStatusMessage(
      restoredDraft == null ? statusMessage : `${statusMessage} Restored draft.`,
    );
  }

  function close(): boolean {
    const target = state.reviewComposer.target;
    const body = state.reviewComposer.input.value;

    reset();

    if (target != null && body.trim() !== "") {
      void persistHistory("dismissed", body, target).catch(() => undefined);
      return true;
    }

    return false;
  }

  function reset(): void {
    state.setReviewComposer((currentReviewComposer) => clearReviewComposer(currentReviewComposer));
  }

  function applyKey(key: KeyboardInput): boolean {
    let handled = false;

    state.setReviewComposer((currentReviewComposer) => {
      const result = applyTextInputKey(currentReviewComposer.input, key, {
        allowCtrlELineEnd: true,
        multiline: true,
      });
      handled = result.handled;
      return handled
        ? updateReviewComposerInput(currentReviewComposer, result.nextState)
        : currentReviewComposer;
    });

    return handled;
  }

  function backspace(): void {
    state.setReviewComposer((currentReviewComposer) =>
      updateReviewComposerInput(currentReviewComposer, (currentInput) =>
        backspaceTextInput(currentInput),
      ),
    );
  }

  function insertNewline(): void {
    state.setReviewComposer((currentReviewComposer) =>
      updateReviewComposerInput(currentReviewComposer, (currentInput) =>
        insertTextInputNewline(currentInput),
      ),
    );
  }

  function move(delta: number): void {
    const models = getModels();
    if (models.autocomplete.isVisible) {
      state.setReviewComposer((currentReviewComposer) =>
        setReviewComposerAutocompleteIndex(
          currentReviewComposer,
          moveReviewComposerAutocompleteIndex(
            currentReviewComposer.autocompleteIndex,
            models.autocomplete.options.length,
            delta,
          ),
        ),
      );
      return;
    }

    const currentInput = state.reviewComposer.input;
    if (delta < 0 ? isTextInputOnFirstLine(currentInput) : isTextInputOnLastLine(currentInput)) {
      state.setReviewComposer((currentReviewComposer) =>
        moveReviewComposerHistory(currentReviewComposer, models.historyEntries, delta),
      );
      return;
    }

    state.setReviewComposer((currentReviewComposer) =>
      updateReviewComposerInput(currentReviewComposer, (input) =>
        delta < 0 ? moveTextInputCursorUp(input) : moveTextInputCursorDown(input),
      ),
    );
  }

  function acceptAutocomplete(): boolean {
    const models = getModels();
    if (!models.autocomplete.isVisible) {
      return false;
    }

    const option =
      models.autocomplete.options[
        clampIndex(state.reviewComposer.autocompleteIndex, models.autocomplete.options.length)
      ];
    if (option == null) {
      return false;
    }

    state.setReviewComposer((currentReviewComposer) =>
      updateReviewComposerInput(currentReviewComposer, (currentInput) => {
        const nextAutocomplete = insertReviewComposerAutocomplete(
          currentInput.value,
          currentInput.cursorOffset,
          option,
        );

        return {
          ...currentInput,
          cursorOffset: nextAutocomplete.cursorOffset,
          preferredColumn: null,
          value: nextAutocomplete.body,
        };
      }),
    );
    return true;
  }

  function dismissAutocomplete(): boolean {
    const models = getModels();
    if (!models.autocomplete.isVisible) {
      return false;
    }

    state.setReviewComposer((currentReviewComposer) =>
      dismissReviewComposerAutocomplete(
        currentReviewComposer,
        models.autocomplete.tokenKey ?? null,
      ),
    );
    state.setStatusMessage("Dismissed file reference suggestions.");
    return true;
  }

  async function openExternalEditor(): Promise<void> {
    if (state.reviewComposer.target == null) {
      return;
    }

    try {
      const nextBody = await props.openExternalEditor(
        state.session.repository.rootPath,
        state.reviewComposer.input.value,
        {
          fileExtension: ".md",
          tempFileName: "REVIEW_COMMENT.md",
        },
      );
      state.setReviewComposer((currentReviewComposer) =>
        updateReviewComposerInput(currentReviewComposer, createTextInputState(nextBody)),
      );
      state.setStatusMessage("Updated comment draft from external editor.");
    } catch (error) {
      persistence.persistenceApi.handleAppError(error, "Unable to open the external editor.", {
        action: "open-review-composer-external-editor",
      });
    }
  }

  async function persistHistory(
    outcome: ReviewComposerHistoryOutcome,
    body: string,
    target: ReviewComposerTarget,
  ): Promise<void> {
    const scope = getReviewComposerHistoryScope(state.session, target);
    const entry = {
      body,
      createdAt: new Date().toISOString(),
      outcome,
      repositoryRootPath: scope.repositoryRootPath,
      target: {
        key: scope.targetKey,
        kind: scope.targetKind,
        path: scope.path,
        pullRequestNumber: scope.pullRequestNumber,
      },
    };

    state.setReviewComposer((currentReviewComposer) =>
      appendReviewComposerHistoryEntry(currentReviewComposer, entry),
    );
    await props.appendReviewComposerHistory?.(entry);
  }
}

function createReviewSubmissionController({
  persistence,
  props,
  state,
}: Omit<CreateReviewInputControllersOptions, "getSelectedFilePath">): ReviewSubmissionController {
  return {
    applyKey,
    backspace,
    close,
    insertNewline,
    move,
    open,
    openExternalEditor,
    reset,
  };

  function open(body: string): void {
    state.setReviewSubmissionInput(createTextInputState(body));
    state.setReviewSubmissionEventIndex(0);
  }

  function close(): void {
    reset();
  }

  function reset(): void {
    state.setReviewSubmissionInput(createTextInputState());
  }

  function applyKey(key: KeyboardInput): boolean {
    let handled = false;

    state.setReviewSubmissionInput((currentInput) => {
      const result = applyTextInputKey(currentInput, key, {
        allowCtrlELineEnd: true,
        multiline: true,
      });
      handled = result.handled;
      return result.nextState;
    });

    return handled;
  }

  function backspace(): void {
    state.setReviewSubmissionInput((currentInput) => backspaceTextInput(currentInput));
  }

  function insertNewline(): void {
    state.setReviewSubmissionInput((currentInput) => insertTextInputNewline(currentInput));
  }

  function move(delta: number): void {
    const currentInput = state.reviewSubmissionInput;
    if (delta < 0 ? isTextInputOnFirstLine(currentInput) : isTextInputOnLastLine(currentInput)) {
      state.setReviewSubmissionEventIndex((currentIndex) => clampIndex(currentIndex + delta, 3));
      return;
    }

    state.setReviewSubmissionInput((input) =>
      delta < 0 ? moveTextInputCursorUp(input) : moveTextInputCursorDown(input),
    );
  }

  async function openExternalEditor(): Promise<void> {
    try {
      const nextBody = await props.openExternalEditor(
        state.session.repository.rootPath,
        state.reviewSubmissionInput.value,
        {
          fileExtension: ".md",
          tempFileName: "SUBMIT_REVIEW.md",
        },
      );
      state.setReviewSubmissionInput(createTextInputState(nextBody));
      state.setStatusMessage("Updated review summary from external editor.");
    } catch (error) {
      persistence.persistenceApi.handleAppError(error, "Unable to open the external editor.", {
        action: "open-submit-review-external-editor",
      });
    }
  }
}

function createMergeMessageController({
  persistence,
  props,
  state,
}: Omit<CreateReviewInputControllersOptions, "getSelectedFilePath">): MergeMessageController {
  return {
    applyBodyKey,
    applyTitleKey,
    backspaceBody,
    backspaceTitle,
    close,
    cycleField,
    insertBodyNewline,
    open,
    openExternalEditor,
    reset,
  };

  function open({
    body,
    defaultMethod,
    title,
  }: {
    body: string;
    defaultMethod?: import("@madisonbullard/diffdiff-core").GitHubMergeMethod;
    title: string;
  }): void {
    state.setMergeCommitTitleInput(createTextInputState(title));
    state.setMergeCommitMessageInput(createTextInputState(body));
    state.setMergeMethod(defaultMethod);
    state.setMergeConfirmOpen(false);
    state.setMergeModalField(defaultMethod == null ? "method" : "title");
  }

  function close(): void {
    state.setMergeConfirmOpen(false);
  }

  function reset(): void {
    state.setMergeCommitTitleInput(createTextInputState());
    state.setMergeCommitMessageInput(createTextInputState());
    state.setMergeMethod(undefined);
    state.setMergeModalField("method");
    close();
  }

  function cycleField(): void {
    state.setMergeModalField((currentField) => {
      switch (currentField) {
        case "method":
          return "title";
        case "title":
          return "body";
        case "body":
          return "method";
      }
    });
  }

  function applyTitleKey(key: KeyboardInput): boolean {
    return applyMergeInputKey("title", key);
  }

  function applyBodyKey(key: KeyboardInput): boolean {
    return applyMergeInputKey("body", key, { multiline: true });
  }

  function backspaceTitle(): void {
    state.setMergeCommitTitleInput((currentInput) => backspaceTextInput(currentInput));
  }

  function backspaceBody(): void {
    state.setMergeCommitMessageInput((currentInput) => backspaceTextInput(currentInput));
  }

  function insertBodyNewline(): void {
    state.setMergeCommitMessageInput((currentInput) => insertTextInputNewline(currentInput));
  }

  async function openExternalEditor(): Promise<void> {
    try {
      const nextBuffer = await props.openExternalEditor(
        state.session.repository.rootPath,
        formatMergeMessageBuffer(
          state.mergeCommitTitleInput.value,
          state.mergeCommitMessageInput.value,
        ),
        {
          fileExtension: ".txt",
          tempFileName: "MERGE_MSG",
        },
      );
      const nextMessage = parseMergeMessageBuffer(nextBuffer);
      state.setMergeCommitTitleInput(createTextInputState(nextMessage.title));
      state.setMergeCommitMessageInput(createTextInputState(nextMessage.body));
      state.setStatusMessage("Updated merge message from external editor.");
    } catch (error) {
      persistence.persistenceApi.handleAppError(error, "Unable to open the external editor.", {
        action: "open-merge-external-editor",
      });
    }
  }

  function applyMergeInputKey(
    field: "title" | "body",
    key: KeyboardInput,
    options: { multiline?: boolean } = {},
  ): boolean {
    let handled = false;
    const setInput =
      field === "title" ? state.setMergeCommitTitleInput : state.setMergeCommitMessageInput;

    setInput((currentInput) => {
      const result = applyTextInputKey(currentInput, key, {
        allowCtrlELineEnd: true,
        multiline: options.multiline === true,
      });
      handled = result.handled;
      return result.nextState;
    });

    return handled;
  }
}
