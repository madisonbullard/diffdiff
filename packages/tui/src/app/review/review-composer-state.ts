import type { ReviewComposerHistoryEntry } from "@diffdiff/core";
import { MAX_REVIEW_COMPOSER_HISTORY_ENTRIES } from "@diffdiff/core";
import { clampIndex } from "../../view-model.ts";
import type { ReviewComposerTarget } from "./review-composer.ts";

export interface ReviewComposerUiState {
  autocompleteIndex: number;
  body: string;
  dismissedAutocompleteTokenKey: string | null;
  history: ReviewComposerHistoryEntry[];
  historyDraft: string | null;
  historyIndex: number;
  target: ReviewComposerTarget | null;
}

export function createReviewComposerState(): ReviewComposerUiState {
  return {
    autocompleteIndex: 0,
    body: "",
    dismissedAutocompleteTokenKey: null,
    history: [],
    historyDraft: null,
    historyIndex: 0,
    target: null,
  };
}

export function clearReviewComposer(state: ReviewComposerUiState): ReviewComposerUiState {
  return {
    ...resetReviewComposerTransientState(state),
    body: "",
    target: null,
  };
}

export function openReviewComposer(
  state: ReviewComposerUiState,
  target: ReviewComposerTarget,
  body: string,
): ReviewComposerUiState {
  return {
    ...resetReviewComposerTransientState(state),
    body,
    target,
  };
}

export function updateReviewComposerBody(
  state: ReviewComposerUiState,
  updater: string | ((currentBody: string) => string),
): ReviewComposerUiState {
  const nextBody = typeof updater === "function" ? updater(state.body) : updater;
  return {
    ...resetReviewComposerTransientState(state),
    body: nextBody,
  };
}

export function dismissReviewComposerAutocomplete(
  state: ReviewComposerUiState,
  tokenKey: string | null,
): ReviewComposerUiState {
  return {
    ...state,
    dismissedAutocompleteTokenKey: tokenKey,
  };
}

export function setReviewComposerAutocompleteIndex(
  state: ReviewComposerUiState,
  nextIndex: number,
): ReviewComposerUiState {
  return {
    ...state,
    autocompleteIndex: nextIndex,
  };
}

export function moveReviewComposerHistory(
  state: ReviewComposerUiState,
  entries: readonly ReviewComposerHistoryEntry[],
  delta: number,
): ReviewComposerUiState {
  if (entries.length === 0) {
    return state;
  }

  const nextIndex = clampIndex(state.historyIndex + delta, entries.length + 1);
  if (nextIndex === state.historyIndex) {
    return state;
  }

  const nextDraft = state.historyIndex === 0 ? state.body : state.historyDraft;
  return {
    ...state,
    autocompleteIndex: 0,
    body: nextIndex === 0 ? (nextDraft ?? "") : (entries[nextIndex - 1]?.body ?? ""),
    dismissedAutocompleteTokenKey: null,
    historyDraft: nextDraft,
    historyIndex: nextIndex,
  };
}

export function moveReviewComposerAutocompleteIndex(
  currentIndex: number,
  optionCount: number,
  delta: number,
): number {
  if (optionCount === 0) {
    return currentIndex;
  }

  let nextIndex = currentIndex + delta;
  if (nextIndex < 0) {
    nextIndex = optionCount - 1;
  }
  if (nextIndex >= optionCount) {
    nextIndex = 0;
  }
  return nextIndex;
}

export function appendReviewComposerHistoryEntry(
  state: ReviewComposerUiState,
  entry: ReviewComposerHistoryEntry,
): ReviewComposerUiState {
  return {
    ...state,
    history: mergeReviewComposerHistory(state.history, [entry]),
  };
}

export function loadReviewComposerHistoryEntries(
  state: ReviewComposerUiState,
  loadedHistory: readonly ReviewComposerHistoryEntry[],
): ReviewComposerUiState {
  const mergedHistory = mergeReviewComposerHistory(state.history, loadedHistory);
  return areReviewComposerHistoriesEqual(state.history, mergedHistory)
    ? state
    : {
        ...state,
        history: mergedHistory,
      };
}

function resetReviewComposerTransientState(
  state: ReviewComposerUiState,
): Pick<
  ReviewComposerUiState,
  | "autocompleteIndex"
  | "dismissedAutocompleteTokenKey"
  | "history"
  | "historyDraft"
  | "historyIndex"
  | "target"
> {
  return {
    autocompleteIndex: 0,
    dismissedAutocompleteTokenKey: null,
    history: state.history,
    historyDraft: null,
    historyIndex: 0,
    target: state.target,
  };
}

function mergeReviewComposerHistory(
  currentHistory: readonly ReviewComposerHistoryEntry[],
  loadedHistory: readonly ReviewComposerHistoryEntry[],
): ReviewComposerHistoryEntry[] {
  const merged = [...currentHistory, ...loadedHistory];
  const deduped = new Map<string, ReviewComposerHistoryEntry>();
  for (const entry of merged) {
    deduped.set(
      `${entry.createdAt}\0${entry.repositoryRootPath}\0${entry.target.key}\0${entry.outcome}\0${entry.body}`,
      entry,
    );
  }

  return [...deduped.values()]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-MAX_REVIEW_COMPOSER_HISTORY_ENTRIES);
}

function areReviewComposerHistoriesEqual(
  left: readonly ReviewComposerHistoryEntry[],
  right: readonly ReviewComposerHistoryEntry[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => {
    const other = right[index];
    return (
      other != null &&
      entry.body === other.body &&
      entry.createdAt === other.createdAt &&
      entry.outcome === other.outcome &&
      entry.repositoryRootPath === other.repositoryRootPath &&
      entry.target.key === other.target.key &&
      entry.target.kind === other.target.kind &&
      entry.target.path === other.target.path &&
      entry.target.pullRequestNumber === other.target.pullRequestNumber
    );
  });
}
