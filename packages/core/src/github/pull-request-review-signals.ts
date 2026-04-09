import type {
  ForgeRepository,
  GitHubPullRequestLatestOpinionatedReview,
  GitHubPullRequestRequestedReviewer,
  GitHubPullRequestReviewDecision,
  GitHubPullRequestReviewState,
} from "../types/github.ts";
import type { GitHubApiClient } from "../types/providers.ts";
import type {
  GitHubGraphqlPullRequestLatestOpinionatedReviewsResponse,
  GitHubGraphqlPullRequestReviewSignalsResponse,
} from "./pull-request-types.ts";

export interface PullRequestReviewSignals {
  latestOpinionatedReviews: GitHubPullRequestLatestOpinionatedReview[];
  reviewDecision?: GitHubPullRequestReviewDecision;
  reviewRequests: GitHubPullRequestRequestedReviewer[];
}

export async function loadPullRequestReviewSignals(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<PullRequestReviewSignals> {
  const [reviewDecisionWithRequests, latestOpinionatedReviews] = await Promise.all([
    loadPullRequestReviewDecisionAndRequests(client, repository, pullRequestNumber),
    loadPullRequestLatestOpinionatedReviews(client, repository, pullRequestNumber),
  ]);

  return {
    latestOpinionatedReviews,
    reviewDecision: reviewDecisionWithRequests.reviewDecision,
    reviewRequests: reviewDecisionWithRequests.reviewRequests,
  };
}

async function loadPullRequestReviewDecisionAndRequests(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<{
  reviewDecision?: GitHubPullRequestReviewDecision;
  reviewRequests: GitHubPullRequestRequestedReviewer[];
}> {
  const reviewRequests: GitHubPullRequestRequestedReviewer[] = [];
  let after: string | null = null;
  let reviewDecision: GitHubPullRequestReviewDecision | undefined;

  while (true) {
    const response: GitHubGraphqlPullRequestReviewSignalsResponse = await client.graphql(
      `
        query PullRequestReviewSignals(
          $owner: String!
          $repo: String!
          $pullRequestNumber: Int!
          $after: String
        ) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $pullRequestNumber) {
              reviewDecision
              reviewRequests(first: 100, after: $after) {
                nodes {
                  requestedReviewer {
                    __typename
                    ... on User {
                      login
                      url
                    }
                    ... on Team {
                      slug
                      url
                      organization {
                        login
                      }
                    }
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        }
      `,
      {
        after,
        owner: repository.owner,
        pullRequestNumber,
        repo: repository.repo,
      },
    );
    const pullRequest = response.repository?.pullRequest;
    reviewDecision ??= pullRequest?.reviewDecision ?? undefined;
    const reviewRequestsConnection = pullRequest?.reviewRequests;

    for (const node of reviewRequestsConnection?.nodes ?? []) {
      const requestedReviewer = node?.requestedReviewer;
      if (requestedReviewer?.__typename === "User" && requestedReviewer.login != null) {
        reviewRequests.push({
          kind: "user",
          label: requestedReviewer.login,
          url: requestedReviewer.url ?? undefined,
        });
        continue;
      }

      if (requestedReviewer?.__typename === "Team" && requestedReviewer.slug != null) {
        const organizationLogin = requestedReviewer.organization?.login;
        reviewRequests.push({
          kind: "team",
          label:
            organizationLogin == null
              ? requestedReviewer.slug
              : `${organizationLogin}/${requestedReviewer.slug}`,
          url: requestedReviewer.url ?? undefined,
        });
      }
    }

    if (
      reviewRequestsConnection?.pageInfo?.hasNextPage !== true ||
      reviewRequestsConnection.pageInfo.endCursor == null
    ) {
      return {
        reviewDecision,
        reviewRequests: dedupeRequestedReviewers(reviewRequests),
      };
    }

    after = reviewRequestsConnection.pageInfo.endCursor;
  }
}

async function loadPullRequestLatestOpinionatedReviews(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<GitHubPullRequestLatestOpinionatedReview[]> {
  const reviews: GitHubPullRequestLatestOpinionatedReview[] = [];
  let after: string | null = null;

  while (true) {
    const response: GitHubGraphqlPullRequestLatestOpinionatedReviewsResponse = await client.graphql(
      `
        query PullRequestLatestOpinionatedReviews(
          $owner: String!
          $repo: String!
          $pullRequestNumber: Int!
          $after: String
        ) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $pullRequestNumber) {
              latestOpinionatedReviews(first: 100, after: $after) {
                nodes {
                  state
                  updatedAt
                  author {
                    login
                    url
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        }
      `,
      {
        after,
        owner: repository.owner,
        pullRequestNumber,
        repo: repository.repo,
      },
    );
    const latestOpinionatedReviewsConnection =
      response.repository?.pullRequest?.latestOpinionatedReviews;

    for (const node of latestOpinionatedReviewsConnection?.nodes ?? []) {
      if (
        node?.author?.login == null ||
        node.state == null ||
        node.updatedAt == null ||
        !isGitHubPullRequestReviewState(node.state)
      ) {
        continue;
      }

      reviews.push({
        author: {
          login: node.author.login,
          url: node.author.url ?? undefined,
        },
        state: node.state,
        updatedAt: node.updatedAt,
      });
    }

    if (
      latestOpinionatedReviewsConnection?.pageInfo?.hasNextPage !== true ||
      latestOpinionatedReviewsConnection.pageInfo.endCursor == null
    ) {
      return dedupeLatestOpinionatedReviews(reviews);
    }

    after = latestOpinionatedReviewsConnection.pageInfo.endCursor;
  }
}

function dedupeRequestedReviewers(
  reviewRequests: readonly GitHubPullRequestRequestedReviewer[],
): GitHubPullRequestRequestedReviewer[] {
  return [...new Map(reviewRequests.map((reviewer) => [reviewer.label, reviewer])).values()].sort(
    (left, right) => left.label.localeCompare(right.label),
  );
}

function dedupeLatestOpinionatedReviews(
  reviews: readonly GitHubPullRequestLatestOpinionatedReview[],
): GitHubPullRequestLatestOpinionatedReview[] {
  return [...new Map(reviews.map((review) => [review.author.login, review])).values()].sort(
    (left, right) => {
      const loginResult = left.author.login.localeCompare(right.author.login);
      if (loginResult !== 0) {
        return loginResult;
      }

      return left.updatedAt.localeCompare(right.updatedAt);
    },
  );
}

function isGitHubPullRequestReviewState(value: string): value is GitHubPullRequestReviewState {
  return (
    value === "APPROVED" ||
    value === "CHANGES_REQUESTED" ||
    value === "COMMENTED" ||
    value === "DISMISSED"
  );
}
