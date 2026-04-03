import { runCommand } from "../command.ts";
import { DiffdiffError } from "../errors.ts";
import { logDiffdiffError, logDiffdiffInfo, logDiffdiffWarn } from "../logging.ts";
import type {
  ForgeRepository,
  GitHubPendingReview,
  GitHubPullRequestDetail,
  GitHubPullRequestMergeRequest,
  GitHubPullRequestMergeResult,
  GitHubRefCleanupCandidate,
  GitHubReviewLineAnchor,
  GitHubReviewSession,
  GitHubReviewSubmissionEvent,
  PullRequestInfo,
} from "../types/github.ts";
import type { GitHubApiClient, GitHubClientFactory } from "../types/providers.ts";
import type { ReviewSession, ReviewWarning } from "../types/session.ts";
import { OctokitGitHubClientFactory } from "./client.ts";
import { loadPullRequestDetail } from "./pull-request-detail.ts";
import {
  dedupeWarnings,
  findActivePullRequestCandidate,
  mapPullRequestSummary,
} from "./pull-request-mappers.ts";
import {
  buildCleanupCandidates,
  dedupeCleanupCandidates,
  refreshPostMergeRefs,
} from "./pull-request-refs.ts";
import type {
  GitHubCreateReviewResponse,
  GitHubGraphqlAddPullRequestReviewThreadResponse,
  GitHubMergeResponse,
  GitHubPullRequestListResponse,
} from "./pull-request-types.ts";

export class GitHubPullRequestService {
  constructor(
    private readonly clientFactory: GitHubClientFactory = new OctokitGitHubClientFactory(),
  ) {}

  async listOpenPullRequests(repository: ForgeRepository): Promise<PullRequestInfo[] | null> {
    const client = await this.clientFactory.create(repository);
    if (client == null) {
      logDiffdiffWarn("github", "list_open_pull_requests_skipped", {
        repository,
      });
      return null;
    }

    try {
      const pullRequests = (await client.paginate("GET /repos/{owner}/{repo}/pulls", {
        owner: repository.owner,
        repo: repository.repo,
        state: "open",
        per_page: 100,
      })) as GitHubPullRequestListResponse[];

      logDiffdiffInfo("github", "list_open_pull_requests_completed", {
        count: pullRequests.length,
        repository,
      });

      return pullRequests.map(mapPullRequestSummary);
    } catch (error) {
      logDiffdiffError("github", "list_open_pull_requests_failed", error, {
        repository,
      });
      return null;
    }
  }

  async attachReviewSession(session: ReviewSession): Promise<ReviewSession> {
    const candidate = findActivePullRequestCandidate(session);
    if (candidate == null) {
      logDiffdiffInfo("github", "attach_review_session_skipped", {
        reason: "no-active-pull-request-candidate",
      });
      return session;
    }

    const client = await this.clientFactory.create(candidate.repository);
    if (client == null) {
      logDiffdiffWarn("github", "attach_review_session_skipped", {
        repository: candidate.repository,
        reason: "github-client-unavailable",
      });
      return session;
    }

    try {
      const pullRequest = await loadPullRequestDetail(
        client,
        candidate.repository,
        candidate.pullRequest.number,
      );
      const githubSession: GitHubReviewSession = {
        auth: {
          host: candidate.repository.host,
          isAuthenticated: client.auth != null,
          tokenSource: client.auth?.tokenSource,
          configFilePath: client.auth?.configFilePath,
        },
        pullRequest,
        remoteName: candidate.remoteName,
        repository: candidate.repository,
        repositoryRootPath: session.repository.rootPath,
      };

      const pullRequestWarnings = await buildPullRequestWarnings(
        session,
        pullRequest,
        candidate.remoteName,
      );

      return {
        ...session,
        github: githubSession,
        warnings: dedupeWarnings([...session.warnings, ...pullRequestWarnings]),
      };
    } catch (error) {
      logDiffdiffError("github", "attach_review_session_failed", error, {
        pullRequestNumber: candidate.pullRequest.number,
        repository: candidate.repository,
      });
      return {
        ...session,
        warnings: dedupeWarnings([
          ...session.warnings,
          {
            code: "github-review-unavailable",
            message: `Unable to load GitHub review data for PR #${candidate.pullRequest.number}; diffdiff will continue with the local comparison.`,
          },
        ]),
      };
    }
  }

  async startOrResumePendingReview(
    reviewSession: GitHubReviewSession,
  ): Promise<GitHubPendingReview> {
    const client = await this.requireClient(reviewSession);

    if (reviewSession.pullRequest.pendingReview != null) {
      logDiffdiffInfo("github", "pending_review_reused", {
        pullRequestNumber: reviewSession.pullRequest.number,
        reviewId: reviewSession.pullRequest.pendingReview.id,
      });
      return reviewSession.pullRequest.pendingReview;
    }

    const response = (await client.request(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      {
        owner: reviewSession.repository.owner,
        pull_number: reviewSession.pullRequest.number,
        repo: reviewSession.repository.repo,
      },
    )) as GitHubCreateReviewResponse;

    return {
      body: response.body ?? undefined,
      comments: [],
      id: response.id,
      nodeId: response.node_id,
    };
  }

  async addPendingReviewThread(
    reviewSession: GitHubReviewSession,
    anchor: GitHubReviewLineAnchor,
    body: string,
  ): Promise<GitHubPendingReview> {
    const client = await this.requireClient(reviewSession);
    const pendingReview = await this.startOrResumePendingReview(reviewSession);

    await client.graphql<GitHubGraphqlAddPullRequestReviewThreadResponse>(
      `
        mutation AddPullRequestReviewThread($input: AddPullRequestReviewThreadInput!) {
          addPullRequestReviewThread(input: $input) {
            thread {
              id
            }
          }
        }
      `,
      {
        input: {
          body,
          line: anchor.line,
          path: anchor.path,
          pullRequestId: reviewSession.pullRequest.nodeId,
          pullRequestReviewId: pendingReview.nodeId,
          side: anchor.side,
          startLine: anchor.startLine,
          startSide: anchor.startSide,
        },
      },
    );

    return pendingReview;
  }

  async replyToReviewComment(
    reviewSession: GitHubReviewSession,
    commentId: number,
    body: string,
  ): Promise<void> {
    const client = await this.requireClient(reviewSession);

    await client.request(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies",
      {
        body,
        comment_id: commentId,
        owner: reviewSession.repository.owner,
        pull_number: reviewSession.pullRequest.number,
        repo: reviewSession.repository.repo,
      },
    );
  }

  async addPullRequestComment(reviewSession: GitHubReviewSession, body: string): Promise<void> {
    const client = await this.requireClient(reviewSession);

    await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      body,
      issue_number: reviewSession.pullRequest.number,
      owner: reviewSession.repository.owner,
      repo: reviewSession.repository.repo,
    });
  }

  async submitPendingReview(
    reviewSession: GitHubReviewSession,
    event: GitHubReviewSubmissionEvent,
    body?: string,
  ): Promise<void> {
    const client = await this.requireClient(reviewSession);
    const pendingReview = await this.startOrResumePendingReview(reviewSession);

    await client.request(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events",
      {
        body,
        event,
        owner: reviewSession.repository.owner,
        pull_number: reviewSession.pullRequest.number,
        repo: reviewSession.repository.repo,
        review_id: pendingReview.id,
      },
    );
  }

  async mergePullRequest(
    reviewSession: GitHubReviewSession,
    input: GitHubPullRequestMergeRequest,
  ): Promise<GitHubPullRequestMergeResult> {
    const client = await this.requireClient(reviewSession);
    const response = (await client.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
      commit_message: input.commitMessage,
      commit_title: input.commitTitle,
      merge_method: input.method,
      owner: reviewSession.repository.owner,
      pull_number: reviewSession.pullRequest.number,
      repo: reviewSession.repository.repo,
    })) as GitHubMergeResponse;

    if (!response.merged) {
      throw new DiffdiffError(
        response.message || `GitHub did not merge PR #${reviewSession.pullRequest.number}.`,
      );
    }

    const deletedRemoteRefs = await refreshPostMergeRefs(reviewSession);
    const cleanupCandidates = await buildCleanupCandidates(
      reviewSession.repositoryRootPath,
      input.comparison,
      deletedRemoteRefs,
    );

    logDiffdiffInfo("github", "pull_request_merged", {
      cleanupCandidateCount: cleanupCandidates.length,
      deletedRemoteRefs: deletedRemoteRefs.map((ref) => ref.remoteRef),
      mergeMethod: input.method,
      pullRequestNumber: reviewSession.pullRequest.number,
      sha: response.sha,
    });

    return {
      cleanupCandidates,
      deletedRemoteRefs: deletedRemoteRefs.map((ref) => ref.remoteRef),
      message: response.message,
      sha: response.sha,
    };
  }

  async removeCleanupRefs(
    repositoryRootPath: string,
    refs: readonly GitHubRefCleanupCandidate[],
  ): Promise<void> {
    for (const ref of dedupeCleanupCandidates(refs)) {
      if (ref.kind === "local-branch") {
        await runCommand("git", ["branch", "-D", ref.ref], {
          cwd: repositoryRootPath,
        });
        continue;
      }

      await runCommand("git", ["branch", "-dr", ref.ref], {
        cwd: repositoryRootPath,
      });
    }
  }

  private async requireClient(reviewSession: GitHubReviewSession): Promise<GitHubApiClient> {
    const client = await this.clientFactory.create(reviewSession.repository);

    if (client?.auth == null) {
      throw new DiffdiffError(
        "GitHub authentication is required for PR review actions. Run `diffdiff auth login --token-stdin` first.",
      );
    }

    return client;
  }
}

async function buildPullRequestWarnings(
  session: ReviewSession,
  pullRequest: GitHubPullRequestDetail,
  remoteName: string,
): Promise<ReviewWarning[]> {
  const warnings: ReviewWarning[] = [];
  const comparisonBaseMatches =
    session.comparison.base === pullRequest.baseRefName ||
    session.comparison.base.endsWith(`/${pullRequest.baseRefName}`);

  if (!comparisonBaseMatches) {
    warnings.push({
      code: "github-pr-base-mismatch",
      message: `Current comparison base (${session.comparison.base}) does not match the PR base (${pullRequest.baseRefName}); inline anchors may not line up exactly.`,
    });
  }

  const [hasLocalBaseRef, hasLocalHeadRef] = await Promise.all([
    hasRemoteTrackingRef(session.repository.rootPath, remoteName, pullRequest.baseRefName),
    hasRemoteTrackingRef(session.repository.rootPath, remoteName, pullRequest.headRefName),
  ]);

  if (!hasLocalBaseRef) {
    warnings.push({
      code: "github-pr-base-local-ref-missing",
      message: `PR base ref refs/remotes/${remoteName}/${pullRequest.baseRefName} is not available locally, so diffdiff cannot build the exact PR comparison from local refs only.`,
    });
  }

  if (!hasLocalHeadRef) {
    warnings.push({
      code: "github-pr-head-local-ref-missing",
      message: `PR head ref refs/remotes/${remoteName}/${pullRequest.headRefName} is not available locally, so diffdiff cannot build the exact PR comparison from local refs only.`,
    });
  }

  if (!hasLocalBaseRef || !hasLocalHeadRef) {
    warnings.push({
      code: "github-inline-anchoring-unavailable",
      message:
        "Inline comment anchoring is unavailable because diffdiff cannot build the exact PR comparison from local refs only.",
    });
  }

  return warnings;
}

async function hasRemoteTrackingRef(
  repositoryRootPath: string,
  remoteName: string,
  branchName: string,
): Promise<boolean> {
  try {
    await runCommand("git", ["rev-parse", "--verify", `refs/remotes/${remoteName}/${branchName}`], {
      cwd: repositoryRootPath,
    });
    return true;
  } catch {
    return false;
  }
}
