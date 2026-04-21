import type { ReviewComposerHistoryEntry } from "@madisonbullard/diffdiff-core";
import {
  buildReviewComposerAutocompleteState,
  type ReviewComposerAutocompleteState,
} from "../../review/composer-autocomplete.ts";
import { getReviewComposerHistoryEntriesForBrowsing } from "../../review/composer-history.ts";
import { createTextInputSurface, type TextInputSurface } from "../../text-input-surface.ts";
import type { PreparedReviewSession } from "../../types.ts";
import {
  getReviewComposerContext,
  getReviewComposerHistoryScope,
  type ReviewComposerHistoryScope,
} from "./review-composer.ts";
import type { ReviewComposerUiState } from "./review-composer-state.ts";

export interface ReviewComposerModels {
  autocomplete: ReviewComposerAutocompleteState;
  context: ReturnType<typeof getReviewComposerContext> | null;
  historyEntries: readonly ReviewComposerHistoryEntry[];
  historyScope: ReviewComposerHistoryScope | null;
  inputSurface: TextInputSurface;
}

const EMPTY_AUTOCOMPLETE: ReviewComposerAutocompleteState = {
  isVisible: false,
  options: [],
  query: "",
};

export function getReviewComposerModels({
  reviewComposer,
  selectedPath,
  session,
}: {
  reviewComposer: ReviewComposerUiState;
  selectedPath?: string;
  session: PreparedReviewSession;
}): ReviewComposerModels {
  if (reviewComposer.target == null) {
    return {
      autocomplete: EMPTY_AUTOCOMPLETE,
      context: null,
      historyEntries: [],
      historyScope: null,
      inputSurface: createTextInputSurface(reviewComposer.input),
    };
  }

  const historyScope = getReviewComposerHistoryScope(session, reviewComposer.target);

  return {
    autocomplete: buildReviewComposerAutocompleteState({
      body: reviewComposer.input.value,
      cursorOffset: reviewComposer.input.cursorOffset,
      dismissedTokenKey: reviewComposer.dismissedAutocompleteTokenKey,
      paths: session.files.map((file) => file.path),
      selectedPath,
    }),
    context: getReviewComposerContext(reviewComposer.target),
    historyEntries: getReviewComposerHistoryEntriesForBrowsing(
      reviewComposer.history,
      historyScope,
    ),
    historyScope,
    inputSurface: createTextInputSurface(reviewComposer.input),
  };
}
