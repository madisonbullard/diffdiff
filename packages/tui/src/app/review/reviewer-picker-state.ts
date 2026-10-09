import type {
  GitHubReviewerCandidate,
  GitHubPullRequestRequestedReviewer,
} from "@madisonbullard/diffdiff-core";
import { createTextInputState, type TextInputState } from "../text-input/input-state.ts";

export interface ReviewerPickerState {
  users: GitHubReviewerCandidate[];
  input: TextInputState;
  index: number;
  selected: Set<string>;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  recommendationsUnavailable: boolean;
}

export function createReviewerPickerState(): ReviewerPickerState {
  return {
    users: [],
    input: createTextInputState(),
    index: 0,
    selected: new Set(),
    isLoading: false,
    isSubmitting: false,
    error: null,
    recommendationsUnavailable: false,
  };
}

export function filterReviewerCandidates(picker: ReviewerPickerState): GitHubReviewerCandidate[] {
  const query = picker.input.value.trim().toLowerCase().replace(/^@/u, "");
  return picker.users.filter((user) =>
    `${user.login} ${user.name ?? ""}`.toLowerCase().includes(query),
  );
}

export function getRequestedReviewerLogins(
  requests: readonly GitHubPullRequestRequestedReviewer[],
): Set<string> {
  return new Set(
    requests
      .filter((request) => request.kind === "user")
      .map((request) => request.label.toLowerCase()),
  );
}

export function reviewerRecommendationLabel(user: GitHubReviewerCandidate): string | undefined {
  if (user.recommendation == null) return undefined;
  const reasons = [
    user.recommendation.basedOnCommits ? "past commits" : null,
    user.recommendation.basedOnReviewComments ? "past reviews" : null,
  ].filter(Boolean);
  return reasons.length > 0 ? `Suggested · ${reasons.join(" and ")}` : "Suggested by GitHub";
}
