import type { DiffdiffAppProps } from "../state/app-props.ts";
import { logDiffdiffError } from "@madisonbullard/diffdiff-core";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import { formatActionBindings } from "../keymap/display.ts";
import { closeDialog, openDialog } from "../dialogs/stack.ts";
import { clampIndex } from "../../view-model.ts";
import {
  createReviewerPickerState,
  filterReviewerCandidates,
  getRequestedReviewerLogins,
} from "./reviewer-picker-state.ts";

export function createReviewerPickerActions({
  state,
  props,
  persistence,
  actions,
}: {
  state: DiffdiffAppState;
  props: Pick<DiffdiffAppProps, "listReviewerCandidates" | "requestReviewers" | "loadSession">;
  persistence: DiffdiffAppPersistence;
  actions: {
    beginSessionLoad: () => number;
    isLatestSessionLoad: (id: number) => boolean;
    applyLoadedSession: (session: import("../../types.ts").PreparedReviewSession) => void;
  };
}) {
  function openReviewerPicker(): void {
    const github = state.session.github;
    if (github == null || !github.auth.isAuthenticated) {
      state.setStatusMessage(
        github == null
          ? "Open a GitHub pull request first."
          : "GitHub auth is required. Run `diffdiff auth login --token-stdin` first.",
      );
      return;
    }
    if (github.pullRequest.state !== "open" || github.pullRequest.isMerged) {
      state.setStatusMessage("Reviewers can only be requested for an open pull request.");
      return;
    }
    if (
      state.reviewerPickerAsyncRef.current.submitting ||
      (state.reviewerPicker.error != null && state.reviewerPicker.selected.size > 0)
    ) {
      state.setDialogStack((stack) => openDialog(stack, "reviewer-picker"));
      return;
    }
    state.setReviewerPicker(createReviewerPickerState());
    state.setDialogStack((stack) => openDialog(stack, "reviewer-picker"));
    state.setStatusMessage("Select reviewers, then press ctrl+s to request reviews.");
    void refreshReviewerCandidates();
  }

  function closeReviewerPicker(): void {
    if (state.reviewerPickerAsyncRef.current.submitting) {
      state.setDialogStack((stack) => closeDialog(stack, "reviewer-picker"));
      state.setStatusMessage("Requesting reviewers in the background...");
      return;
    }
    state.reviewerPickerAsyncRef.current.loadId += 1;
    state.setDialogStack((stack) => closeDialog(stack, "reviewer-picker"));
    if (state.reviewerPicker.error == null) state.setReviewerPicker(createReviewerPickerState());
    state.setStatusMessage("Canceled reviewer selection. No requests sent.");
  }

  async function refreshReviewerCandidates(): Promise<void> {
    const github = state.session.github;
    if (github == null || state.reviewerPickerAsyncRef.current.submitting) return;
    const loadId = ++state.reviewerPickerAsyncRef.current.loadId;
    state.setReviewerPicker((picker) => ({ ...picker, isLoading: true, error: null }));
    try {
      if (props.listReviewerCandidates == null) throw new Error("Reviewer loading is unavailable.");
      const result = await props.listReviewerCandidates(github);
      if (state.reviewerPickerAsyncRef.current.loadId !== loadId) return;
      state.setReviewerPicker((picker) => ({
        ...picker,
        ...result,
        isLoading: false,
        index: 0,
        selected: new Set(
          [...picker.selected].filter((login) =>
            result.users.some((user) => user.login.toLowerCase() === login),
          ),
        ),
      }));
    } catch (error) {
      if (state.reviewerPickerAsyncRef.current.loadId !== loadId) return;
      state.setReviewerPicker((picker) => ({
        ...picker,
        isLoading: false,
        error: "Unable to load reviewers. Press ctrl+r to retry.",
      }));
      // Errors already live in the picker; a bottom toast would obscure its controls.
      logDiffdiffError("app", "reviewer_candidates_failed", error, {
        action: "list-reviewer-candidates",
      });
      state.setStatusMessage("Unable to load reviewers. Press ctrl+r to retry.");
    }
  }

  function moveReviewerSelection(delta: number): void {
    state.setReviewerPicker((picker) => ({
      ...picker,
      index: clampIndex(
        picker.index + delta,
        filterReviewerCandidates(picker, state.session.github?.pullRequest.reviewRequests ?? [])
          .length,
      ),
    }));
  }

  function toggleReviewerSelection(index = state.reviewerPicker.index): void {
    if (state.reviewerPicker.isLoading || state.reviewerPickerAsyncRef.current.submitting) return;
    const users = filterReviewerCandidates(
      state.reviewerPicker,
      state.session.github?.pullRequest.reviewRequests ?? [],
    );
    const user = users[clampIndex(index, users.length)];
    if (user == null) return;
    const login = user.login.toLowerCase();
    if (
      getRequestedReviewerLogins(state.session.github?.pullRequest.reviewRequests ?? []).has(login)
    )
      return;
    state.setReviewerPicker((picker) => {
      const selected = new Set(picker.selected);
      if (selected.has(login)) selected.delete(login);
      else selected.add(login);
      return { ...picker, index: clampIndex(index, users.length), selected };
    });
  }

  async function submitReviewerRequests(): Promise<void> {
    const github = state.session.github;
    const picker = state.reviewerPicker;
    if (
      github == null ||
      !github.auth.isAuthenticated ||
      github.pullRequest.state !== "open" ||
      github.pullRequest.isMerged ||
      props.requestReviewers == null ||
      picker.isLoading ||
      picker.selected.size === 0 ||
      state.reviewerPickerAsyncRef.current.submitting ||
      state.isSubmittingReviewAction
    )
      return;
    const requested = getRequestedReviewerLogins(github.pullRequest.reviewRequests);
    const users = picker.users.filter(
      (user) =>
        picker.selected.has(user.login.toLowerCase()) && !requested.has(user.login.toLowerCase()),
    );
    if (users.length === 0) return;
    const release = state.writeGuard.acquire("reviewers");
    if (release == null) return;
    const token = state.reviewerPickerAsyncRef.current.loadId;
    const owner = state.dialogStackRef.current.at(-1);
    const sessionLoadId = actions.beginSessionLoad();
    state.reviewerPickerAsyncRef.current.submitting = true;
    state.setReviewerPicker((current) => ({ ...current, isSubmitting: true, error: null }));
    state.setIsSubmittingReviewAction(true);
    let sent = false;
    try {
      await props.requestReviewers(
        github,
        users.map((user) => user.login),
      );
      sent = true;
      if (state.reviewerPickerAsyncRef.current.loadId !== token) return;
      // Keep the confirmed requests visible even if the authoritative refresh fails.
      state.setSession((session) => {
        const current = session.github;
        if (current == null || current.pullRequest.url !== github.pullRequest.url) return session;
        const existing = getRequestedReviewerLogins(current.pullRequest.reviewRequests);
        const added = users
          .filter((user) => !existing.has(user.login.toLowerCase()))
          .map((user) => ({ kind: "user" as const, label: user.login, url: user.url }));
        return {
          ...session,
          github: {
            ...current,
            pullRequest: {
              ...current.pullRequest,
              reviewRequests: [...current.pullRequest.reviewRequests, ...added],
            },
          },
        };
      });
      if (state.dialogStackRef.current.at(-1) === owner) {
        state.setDialogStack((stack) => closeDialog(stack, "reviewer-picker", "complete"));
      }
      state.setReviewerPicker((current) => ({ ...current, selected: new Set() }));
      state.setStatusMessage(
        `Requested reviews from ${users.map((user) => user.login).join(", ")}.`,
      );
      if (!actions.isLatestSessionLoad(sessionLoadId)) return;
      const next = await props.loadSession(state.startupOptions);
      if (actions.isLatestSessionLoad(sessionLoadId)) actions.applyLoadedSession(next);
    } catch (error) {
      if (state.reviewerPickerAsyncRef.current.loadId !== token) {
        if (!sent)
          persistence.persistenceApi.handleAppError(
            error,
            "Unable to request reviewers.",
            { action: "request-reviewers", pullRequestNumber: github.pullRequest.number },
            {
              dialogOwner: owner,
              displayMessage: `PR #${github.pullRequest.number}: reviewer request failed. Reopen reviewers from Commands to retry.`,
            },
          );
        return;
      }
      if (sent && !actions.isLatestSessionLoad(sessionLoadId)) return;
      if (!sent) {
        const retry = formatActionBindings(state.reverseKeymaps, "reviewers.submit", [
          "reviewer-picker",
        ])?.split(" / ")[0];
        const message = `Unable to request reviewers. Your selection is preserved${retry ? `; ${retry} retries` : ""}.`;
        state.setReviewerPicker((current) => ({
          ...current,
          error: message,
        }));
        persistence.persistenceApi.handleAppError(
          error,
          message,
          { action: "request-reviewers" },
          { dialogOwner: owner, displayMessage: message },
        );
        return;
      }
      persistence.persistenceApi.handleAppError(
        error,
        "Requested reviews, but unable to refresh the session.",
        { action: "request-reviewers" },
        { displayMessage: "Requested reviews, but unable to refresh the session." },
      );
    } finally {
      if (state.reviewerPickerAsyncRef.current.loadId === token) {
        state.reviewerPickerAsyncRef.current.submitting = false;
        state.setReviewerPicker((current) => ({ ...current, isSubmitting: false }));
      }
      release();
      state.setIsSubmittingReviewAction(state.writeGuard.hasPending());
    }
  }

  return {
    closeReviewerPicker,
    moveReviewerSelection,
    openReviewerPicker,
    refreshReviewerCandidates,
    submitReviewerRequests,
    toggleReviewerSelection,
  };
}
