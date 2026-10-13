import { logDiffdiffError } from "../logging.ts";
import { loadPullRequestChecks } from "./pull-request-checks.ts";
import { loadPullRequestThreadStates } from "./pull-request-thread-states.ts";
import {
  buildPullRequestOpinionatedReviewDigest,
  buildPullRequestRequestedReviewerDigest,
} from "../review-session-fingerprint.ts";
import type { PullRequestCoarseFingerprint, PullRequestFingerprint } from "../types/session.ts";
import type {
  ForgeRepository,
  GitHubMergeMethod,
  GitHubPullRequestChangedFilesByPath,
  GitHubPullRequestChecksSummary,
  GitHubPullRequestDetail,
} from "../types/github.ts";
import type { GitHubApiClient } from "../types/providers.ts";
import {
  buildConversationItems,
  buildMergeState,
  buildReviewGroups,
  buildReviewThreads,
  mapActor,
  mapIssueComment,
  mapPullRequestComment,
} from "./pull-request-mappers.ts";
import {
  loadPullRequestReviewSignals,
  type PullRequestReviewSignals,
} from "./pull-request-review-signals.ts";
import type {
  GitHubGraphqlPullRequestFilesResponse,
  GitHubIssueCommentResponse,
  GitHubPullRequestDetailResponse,
  GitHubReviewCommentResponse,
  GitHubReviewResponse,
} from "./pull-request-types.ts";

interface PullRequestSnapshot {
  checksSummary: GitHubPullRequestChecksSummary;
  pullRequestResponse: GitHubPullRequestDetailResponse;
}

export async function loadPullRequestDetail(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<GitHubPullRequestDetail> {
  const [
    { checksSummary, pullRequestResponse },
    reviewSignals,
    reviewsResponse,
    { commentsResponse, threadStates },
    { changedFiles, allowedMethods, autoMergeAllowed, autoMergeEnabled },
    issueCommentsResponse,
  ] = await Promise.all([
    loadPullRequestSnapshot(client, repository, pullRequestNumber),
    loadPullRequestReviewSignals(client, repository, pullRequestNumber),
    client.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
      owner: repository.owner,
      repo: repository.repo,
      pull_number: pullRequestNumber,
      per_page: 100,
    }) as Promise<GitHubReviewResponse[]>,
    (
      client.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/comments", {
        owner: repository.owner,
        repo: repository.repo,
        pull_number: pullRequestNumber,
        per_page: 100,
      }) as Promise<GitHubReviewCommentResponse[]>
    ).then(async (commentsResponse) => ({
      commentsResponse,
      threadStates:
        commentsResponse.length === 0
          ? new Map<string, boolean>()
          : await loadPullRequestThreadStates(client, repository, pullRequestNumber),
    })),
    loadPullRequestChangedFiles(client, repository, pullRequestNumber),
    client.paginate("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: repository.owner,
      repo: repository.repo,
      issue_number: pullRequestNumber,
      per_page: 100,
    }) as Promise<GitHubIssueCommentResponse[]>,
  ]);

  const comments = commentsResponse
    .map(mapPullRequestComment)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const conversationItems = buildConversationItems(
    reviewsResponse,
    comments,
    issueCommentsResponse.map(mapIssueComment),
  );
  const reviewGroups = buildReviewGroups(reviewsResponse, comments);
  const reviewThreads = buildReviewThreads(comments);
  for (const thread of reviewThreads) {
    thread.isResolved = threadStates.get(thread.id);
  }
  const pendingReviewGroup = reviewGroups.find((group) => group.state === "PENDING");
  const merge = buildMergeState(pullRequestResponse);
  merge.allowedMethods = allowedMethods;
  merge.autoMergeAllowed = autoMergeAllowed;
  merge.autoMergeEnabled = autoMergeEnabled;
  merge.canMerge = merge.canMerge && allowedMethods.length > 0;

  return {
    author: mapActor(pullRequestResponse.user),
    baseRefName: pullRequestResponse.base.ref,
    body: pullRequestResponse.body ?? undefined,
    checks: checksSummary,
    changedFileCount: pullRequestResponse.changed_files,
    changedFiles,
    commitCount: pullRequestResponse.commits,
    conversationItems,
    createdAt: pullRequestResponse.created_at,
    headRefName: pullRequestResponse.head.ref,
    headSha: pullRequestResponse.head.sha,
    isDraft: pullRequestResponse.draft,
    isMerged: pullRequestResponse.merged,
    issueCommentCount: pullRequestResponse.comments,
    latestOpinionatedReviews: reviewSignals.latestOpinionatedReviews,
    merge,
    nodeId: pullRequestResponse.node_id,
    number: pullRequestResponse.number,
    pendingReview:
      pendingReviewGroup == null
        ? undefined
        : {
            body: pendingReviewGroup.body,
            comments: pendingReviewGroup.comments,
            id: pendingReviewGroup.reviewId ?? pullRequestResponse.number,
            nodeId: pendingReviewGroup.reviewNodeId ?? pullRequestResponse.node_id,
          },
    reviewCommentCount: pullRequestResponse.review_comments,
    reviewDecision: reviewSignals.reviewDecision,
    reviewGroups,
    reviewRequests: reviewSignals.reviewRequests,
    reviewThreads,
    state: pullRequestResponse.state,
    title: pullRequestResponse.title,
    updatedAt: pullRequestResponse.updated_at,
    url: pullRequestResponse.html_url,
  };
}

export async function loadPullRequestFingerprint(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<PullRequestFingerprint> {
  const snapshot = await loadPullRequestSnapshot(client, repository, pullRequestNumber);
  return buildPullRequestFingerprintFromSnapshot(
    snapshot,
    await loadPullRequestReviewSignals(client, repository, pullRequestNumber),
  );
}

export async function loadPullRequestCoarseFingerprint(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<PullRequestCoarseFingerprint> {
  return buildPullRequestCoarseFingerprintFromSnapshot(
    await loadPullRequestSnapshot(client, repository, pullRequestNumber),
  );
}

async function loadPullRequestSnapshot(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<PullRequestSnapshot> {
  try {
    const pullRequest = (await client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: repository.owner,
      repo: repository.repo,
      pull_number: pullRequestNumber,
    })) as GitHubPullRequestDetailResponse;
    const checksSummary = await loadPullRequestChecks(
      client,
      repository,
      pullRequest.head.sha,
      pullRequestNumber,
    );

    return {
      checksSummary,
      pullRequestResponse: pullRequest,
    };
  } catch (error) {
    logDiffdiffError("github", "load_pull_request_snapshot_failed", error, {
      pullRequestNumber,
      repository,
    });
    throw error;
  }
}

function buildPullRequestFingerprintFromSnapshot(
  { checksSummary, pullRequestResponse }: PullRequestSnapshot,
  reviewSignals: PullRequestReviewSignals,
): PullRequestFingerprint {
  const latestOpinionatedReviews = reviewSignals.latestOpinionatedReviews.map((review) => ({
    author: review.author.login,
    state: review.state,
    updatedAt: review.updatedAt,
  }));
  const reviewRequests = reviewSignals.reviewRequests.map((reviewer) => ({
    kind: reviewer.kind,
    label: reviewer.label,
  }));

  return {
    ...buildPullRequestCoarseFingerprintFromSnapshot({ checksSummary, pullRequestResponse }),
    latestOpinionatedReviewDigest:
      buildPullRequestOpinionatedReviewDigest(latestOpinionatedReviews),
    latestOpinionatedReviews,
    reviewDecision: reviewSignals.reviewDecision,
    reviewRequestDigest: buildPullRequestRequestedReviewerDigest(reviewRequests),
    reviewRequests,
  };
}

function buildPullRequestCoarseFingerprintFromSnapshot({
  checksSummary,
  pullRequestResponse,
}: PullRequestSnapshot): PullRequestCoarseFingerprint {
  return {
    changedFileCount: pullRequestResponse.changed_files,
    checksState: checksSummary.state,
    commitCount: pullRequestResponse.commits,
    headSha: pullRequestResponse.head.sha,
    isDraft: pullRequestResponse.draft,
    isMerged: pullRequestResponse.merged,
    issueCommentCount: pullRequestResponse.comments,
    mergeableState: pullRequestResponse.mergeable_state ?? undefined,
    number: pullRequestResponse.number,
    reviewCommentCount: pullRequestResponse.review_comments,
    state: pullRequestResponse.state,
    updatedAt: pullRequestResponse.updated_at,
  };
}

async function loadPullRequestChangedFiles(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<{
  changedFiles: GitHubPullRequestChangedFilesByPath;
  allowedMethods: GitHubMergeMethod[];
  autoMergeAllowed: boolean;
  autoMergeEnabled: boolean;
}> {
  const changedFiles: GitHubPullRequestChangedFilesByPath = {};
  const allowedMethods: GitHubMergeMethod[] = [];
  let autoMergeAllowed = false;
  let autoMergeEnabled = false;
  let after: string | null = null;

  while (true) {
    const response: GitHubGraphqlPullRequestFilesResponse = await client.graphql(
      `
        query PullRequestChangedFiles(
          $owner: String!
          $repo: String!
          $pullRequestNumber: Int!
          $after: String
        ) {
          repository(owner: $owner, name: $repo) {
            mergeCommitAllowed
            autoMergeAllowed
            squashMergeAllowed
            pullRequest(number: $pullRequestNumber) {
              autoMergeRequest { enabledAt }
              files(first: 100, after: $after) {
                nodes {
                  path
                  viewerViewedState
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
    if (after == null) {
      autoMergeAllowed = response.repository?.autoMergeAllowed === true;
      autoMergeEnabled = response.repository?.pullRequest?.autoMergeRequest != null;
      if (response.repository?.mergeCommitAllowed === true) allowedMethods.push("merge");
      if (response.repository?.squashMergeAllowed === true) allowedMethods.push("squash");
    }
    const filesConnection:
      | NonNullable<
          NonNullable<
            NonNullable<GitHubGraphqlPullRequestFilesResponse["repository"]>["pullRequest"]
          >["files"]
        >
      | null
      | undefined = response.repository?.pullRequest?.files;

    for (const file of filesConnection?.nodes ?? []) {
      if (file?.path == null) {
        continue;
      }

      changedFiles[file.path] = {
        path: file.path,
        viewedState: file.viewerViewedState ?? "UNVIEWED",
      };
    }

    if (
      filesConnection?.pageInfo?.hasNextPage !== true ||
      filesConnection.pageInfo.endCursor == null
    ) {
      return { changedFiles, allowedMethods, autoMergeAllowed, autoMergeEnabled };
    }

    after = filesConnection.pageInfo.endCursor;
  }
}
