import { logDiffdiffError } from "../logging.ts";
import type { PullRequestFingerprint } from "../types/session.ts";
import type {
  ForgeRepository,
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
import type {
  GitHubCheckRunsResponse,
  GitHubCommitStatusResponse,
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
    reviewsResponse,
    commentsResponse,
    changedFiles,
    issueCommentsResponse,
  ] = await Promise.all([
    loadPullRequestSnapshot(client, repository, pullRequestNumber),
    client.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
      owner: repository.owner,
      repo: repository.repo,
      pull_number: pullRequestNumber,
      per_page: 100,
    }) as Promise<GitHubReviewResponse[]>,
    client.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/comments", {
      owner: repository.owner,
      repo: repository.repo,
      pull_number: pullRequestNumber,
      per_page: 100,
    }) as Promise<GitHubReviewCommentResponse[]>,
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
    issueCommentsResponse.map(mapIssueComment),
  );
  const reviewGroups = buildReviewGroups(reviewsResponse, comments);
  const reviewThreads = buildReviewThreads(comments);
  const pendingReviewGroup = reviewGroups.find((group) => group.state === "PENDING");
  const merge = buildMergeState(pullRequestResponse);

  return {
    author: mapActor(pullRequestResponse.user),
    baseRefName: pullRequestResponse.base.ref,
    body: pullRequestResponse.body ?? undefined,
    checks: checksSummary,
    changedFiles,
    conversationItems,
    createdAt: pullRequestResponse.created_at,
    headRefName: pullRequestResponse.head.ref,
    headSha: pullRequestResponse.head.sha,
    isDraft: pullRequestResponse.draft,
    isMerged: pullRequestResponse.merged,
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
    reviewGroups,
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
  return buildPullRequestFingerprintFromSnapshot(
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

    return {
      checksSummary: await loadChecksSummaryForHeadSha(
        client,
        repository,
        pullRequest.head.sha,
        pullRequestNumber,
      ),
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

function buildPullRequestFingerprintFromSnapshot({
  checksSummary,
  pullRequestResponse,
}: PullRequestSnapshot): PullRequestFingerprint {
  return {
    number: pullRequestResponse.number,
    headSha: pullRequestResponse.head.sha,
    checksState: checksSummary.state,
    state: pullRequestResponse.state,
    isDraft: pullRequestResponse.draft,
    isMerged: pullRequestResponse.merged,
    mergeableState: pullRequestResponse.mergeable_state ?? undefined,
    updatedAt: pullRequestResponse.updated_at,
  };
}

async function loadPullRequestChangedFiles(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<GitHubPullRequestChangedFilesByPath> {
  const changedFiles: GitHubPullRequestChangedFilesByPath = {};
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
            pullRequest(number: $pullRequestNumber) {
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
      return changedFiles;
    }

    after = filesConnection.pageInfo.endCursor;
  }
}

async function loadChecksSummaryForHeadSha(
  client: GitHubApiClient,
  repository: ForgeRepository,
  headSha: string,
  pullRequestNumber?: number,
): Promise<GitHubPullRequestChecksSummary> {
  try {
    const [checkRunsResponse, combinedStatusResponse] = await Promise.all([
      client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
        owner: repository.owner,
        repo: repository.repo,
        ref: headSha,
        per_page: 100,
      }) as Promise<GitHubCheckRunsResponse>,
      client.request("GET /repos/{owner}/{repo}/commits/{ref}/status", {
        owner: repository.owner,
        repo: repository.repo,
        ref: headSha,
      }) as Promise<GitHubCommitStatusResponse>,
    ]);

    const checkRuns = checkRunsResponse.check_runs ?? [];
    let successful = 0;
    let failed = 0;
    let pending = 0;

    for (const checkRun of checkRuns) {
      if (checkRun.status !== "completed") {
        pending += 1;
        continue;
      }

      if (checkRun.conclusion === "success" || checkRun.conclusion === "neutral") {
        successful += 1;
        continue;
      }

      failed += 1;
    }

    const combinedState = combinedStatusResponse.state;
    const state =
      failed > 0 || combinedState === "failure"
        ? "failure"
        : pending > 0 || combinedState === "pending"
          ? "pending"
          : successful > 0 || combinedState === "success"
            ? "success"
            : "unknown";

    return {
      failed,
      pending,
      state,
      successful,
      total: checkRuns.length,
    };
  } catch (error) {
    logDiffdiffError("github", "load_checks_summary_failed", error, {
      headSha,
      pullRequestNumber,
      repository,
    });
    return {
      failed: 0,
      pending: 0,
      state: "unknown",
      successful: 0,
      total: 0,
    };
  }
}
