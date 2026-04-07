import type { ReviewComposerHistoryOutcome } from "@diffdiff/core";
import {
  appendReviewComposerHistoryEntry,
  clearReviewComposer,
  openReviewComposer,
} from "./review-composer-state.ts";
import { findLatestDismissedReviewComposerDraft } from "../../review/composer-history.ts";
import { formatMergeMessageBuffer, parseMergeMessageBuffer } from "../../review/merge-message.ts";
import { getReviewComposerHistoryScope, type ReviewComposerTarget } from "./review-composer.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";

interface CreateReviewComposerInteractionsOptions {
  persistence: DiffdiffAppPersistence;
  props: Pick<DiffdiffAppProps, "appendReviewComposerHistory" | "openExternalEditor">;
  state: DiffdiffAppState;
}

export function createReviewComposerInteractions({
  persistence,
  props,
  state,
}: CreateReviewComposerInteractionsOptions) {
  return {
    closeCommentComposer,
    openMergeModalInExternalEditor,
    openReviewComposerForTarget,
    openReviewComposerInExternalEditor,
    openSubmitReviewModalInExternalEditor,
    persistReviewComposerHistory,
    resetReviewComposer,
  };

  function openReviewComposerForTarget(target: ReviewComposerTarget, statusMessage: string): void {
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

  function resetReviewComposer(): void {
    state.setReviewComposer((currentReviewComposer) => clearReviewComposer(currentReviewComposer));
  }

  function closeCommentComposer(target: ReviewComposerTarget | null, body: string): boolean {
    resetReviewComposer();
    if (target != null && body.trim() !== "") {
      void persistReviewComposerHistory("dismissed", body, target).catch(() => undefined);
      return true;
    }

    return false;
  }

  async function openReviewComposerInExternalEditor(): Promise<void> {
    if (state.reviewComposer.target == null) {
      return;
    }

    try {
      const nextBody = await openExternalTextEditor({
        initialValue: state.reviewComposer.body,
        tempFileName: "REVIEW_COMMENT.md",
      });
      state.setReviewComposer((currentReviewComposer) => ({
        ...currentReviewComposer,
        autocompleteIndex: 0,
        body: nextBody,
        dismissedAutocompleteTokenKey: null,
        historyDraft: null,
        historyIndex: 0,
      }));
      state.setStatusMessage("Updated comment draft from external editor.");
    } catch (error) {
      handleExternalEditorError(error, "open-review-composer-external-editor");
    }
  }

  async function openSubmitReviewModalInExternalEditor(): Promise<void> {
    try {
      const nextBody = await openExternalTextEditor({
        initialValue: state.reviewSubmissionBody,
        tempFileName: "SUBMIT_REVIEW.md",
      });
      state.setReviewSubmissionBody(nextBody);
      state.setStatusMessage("Updated review summary from external editor.");
    } catch (error) {
      handleExternalEditorError(error, "open-submit-review-external-editor");
    }
  }

  async function openMergeModalInExternalEditor(): Promise<void> {
    try {
      const nextBuffer = await openExternalTextEditor({
        fileExtension: ".txt",
        initialValue: formatMergeMessageBuffer(state.mergeCommitTitle, state.mergeCommitMessage),
        tempFileName: "MERGE_MSG",
      });
      const nextMessage = parseMergeMessageBuffer(nextBuffer);
      state.setMergeCommitTitle(nextMessage.title);
      state.setMergeCommitMessage(nextMessage.body);
      state.setStatusMessage("Updated merge message from external editor.");
    } catch (error) {
      handleExternalEditorError(error, "open-merge-external-editor");
    }
  }

  async function persistReviewComposerHistory(
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

  function handleExternalEditorError(error: unknown, action: string): void {
    persistence.persistenceApi.handleAppError(error, "Unable to open the external editor.", {
      action,
    });
  }

  function openExternalTextEditor({
    fileExtension = ".md",
    initialValue,
    tempFileName,
  }: {
    fileExtension?: string;
    initialValue: string;
    tempFileName: string;
  }): Promise<string> {
    return props.openExternalEditor(state.session.repository.rootPath, initialValue, {
      fileExtension,
      tempFileName,
    });
  }
}
