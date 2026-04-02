import { logDiffdiffError } from "../logging.ts";
import type {
  ForgeRepository,
  GitHubPullRequestChecksSummary,
  GitHubPullRequestDetail,
} from "../types/github.ts";
import type { GitHubApiClient } from "../types/providers.ts";
import {
  buildMergeState,
  buildReviewGroups,
  buildReviewThreads,
  mapActor,
  mapPullRequestComment,
} from "./pull-request-mappers.ts";
import type {
  GitHubCheckRunsResponse,
  GitHubCommitStatusResponse,
  GitHubPullRequestDetailResponse,
  GitHubReviewCommentResponse,
  GitHubReviewResponse,
} from "./pull-request-types.ts";

export async function loadPullRequestDetail(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<GitHubPullRequestDetail> {
  const [pullRequestResponse, reviewsResponse, commentsResponse, checksSummary] = await Promise.all(
    [
      client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner: repository.owner,
        repo: repository.repo,
        pull_number: pullRequestNumber,
      }) as Promise<GitHubPullRequestDetailResponse>,
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
      loadChecksSummary(client, repository, pullRequestNumber),
    ],
  );

  const comments = commentsResponse
    .map(mapPullRequestComment)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const reviewGroups = buildReviewGroups(reviewsResponse, comments);
  const reviewThreads = buildReviewThreads(comments);
  const pendingReviewGroup = reviewGroups.find((group) => group.state === "PENDING");
  const merge = buildMergeState(pullRequestResponse);

  return {
    author: mapActor(pullRequestResponse.user),
    baseRefName: pullRequestResponse.base.ref,
    body: pullRequestResponse.body ?? undefined,
    checks: checksSummary,
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
    url: pullRequestResponse.html_url,
  };
}

async function loadChecksSummary(
  client: GitHubApiClient,
  repository: ForgeRepository,
  pullRequestNumber: number,
): Promise<GitHubPullRequestChecksSummary> {
  try {
    const pullRequest = (await client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: repository.owner,
      repo: repository.repo,
      pull_number: pullRequestNumber,
    })) as GitHubPullRequestDetailResponse;

    const [checkRunsResponse, combinedStatusResponse] = await Promise.all([
      client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
        owner: repository.owner,
        repo: repository.repo,
        ref: pullRequest.head.sha,
        per_page: 100,
      }) as Promise<GitHubCheckRunsResponse>,
      client.request("GET /repos/{owner}/{repo}/commits/{ref}/status", {
        owner: repository.owner,
        repo: repository.repo,
        ref: pullRequest.head.sha,
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
