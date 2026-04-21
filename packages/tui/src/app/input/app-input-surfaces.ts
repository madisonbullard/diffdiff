import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { createTextInputSurface, type TextInputSurface } from "../../text-input-surface.ts";

export interface AppInputSurfaces {
  commandPalette: TextInputSurface;
  commitSearch: TextInputSurface;
  mergeBody: TextInputSurface;
  mergeTitle: TextInputSurface;
  pullRequestSearch: TextInputSurface;
  reviewSubmission: TextInputSurface;
}

export function createAppInputSurfaces(
  state: Pick<
    DiffdiffAppState,
    | "commandInput"
    | "commitSearchInput"
    | "mergeCommitMessageInput"
    | "mergeCommitTitleInput"
    | "pullRequestSearchInput"
    | "reviewSubmissionInput"
  >,
): AppInputSurfaces {
  return {
    commandPalette: createTextInputSurface(state.commandInput),
    commitSearch: createTextInputSurface(state.commitSearchInput),
    mergeBody: createTextInputSurface(state.mergeCommitMessageInput),
    mergeTitle: createTextInputSurface(state.mergeCommitTitleInput),
    pullRequestSearch: createTextInputSurface(state.pullRequestSearchInput),
    reviewSubmission: createTextInputSurface(state.reviewSubmissionInput),
  };
}
