import { runCommand } from "../command.ts";
import { DiffdiffError } from "../errors.ts";
import { logDiffdiffError, logDiffdiffInfo, logDiffdiffWarn } from "../logging.ts";
import type { PullRequestFingerprint } from "../types/session.ts";
import type {
  ForgeRepository,
  GitHubDashboardPullRequest,
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
import type { ReviewSession } from "../types/session.ts";
import { OctokitGitHubClientFactory } from "./client.ts";
import { loadPullRequestDetail, loadPullRequestFingerprint } from "./pull-request-detail.ts";
import {
  dedupeWarnings,
  findActivePullRequestCandidate,
  mapPullRequestSummary,
} from "./pull-request-mappers.ts";
import {
  buildPullRequestWarnings,
  upsertDashboardPullRequest,
} from "./pull-request-service-helpers.ts";
import { sortDashboardPullRequests } from "./repository-identity.ts";
import {
  buildCleanupCandidates,
  dedupeCleanupCandidates,
  refreshPostMergeRefs,
} from "./pull-request-refs.ts";
import type {
  GitHubCreateReviewResponse,
  GitHubGraphqlAddPullRequestReviewThreadResponse,
  GitHubGraphqlMarkFileAsViewedResponse,
  GitHubMergeResponse,
  GitHubPullRequestListResponse,
  GitHubSearchIssuePullRequestResponse,
  GitHubGraphqlUnmarkFileAsViewedResponse,
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

  async listDashboardPullRequests(host = "github.com"): Promise<GitHubDashboardPullRequest[]> {
    const client = await this.clientFactory.create({
      forge: "github",
      host,
      owner: "viewer",
      repo: "dashboard",
    });
    if (client?.auth == null) {
      throw new DiffdiffError(
        "GitHub auth is required. Run `diffdiff auth login --token-stdin` first.",
      );
    }

    try {
      const [authoredPullRequests, reviewRequestedPullRequests] = await Promise.all([
        client.paginate("GET /search/issues", {
          order: "desc",
          per_page: 100,
          q: "is:pr state:open archived:false author:@me",
          sort: "updated",
        }) as Promise<GitHubSearchIssuePullRequestResponse[]>,
        client.paginate("GET /search/issues", {
          order: "desc",
          per_page: 100,
          q: "is:pr state:open archived:false review-requested:@me",
          sort: "updated",
        }) as Promise<GitHubSearchIssuePullRequestResponse[]>,
      ]);

      const pullRequestsByKey = new Map<string, GitHubDashboardPullRequest>();

      for (const pullRequest of authoredPullRequests) {
        upsertDashboardPullRequest(pullRequestsByKey, pullRequest, host, {
          isAuthor: true,
          isReviewRequested: false,
        });
      }

      for (const pullRequest of reviewRequestedPullRequests) {
        upsertDashboardPullRequest(pullRequestsByKey, pullRequest, host, {
          isAuthor: false,
          isReviewRequested: true,
        });
      }

      const pullRequests = sortDashboardPullRequests([...pullRequestsByKey.values()]);

      logDiffdiffInfo("github", "list_dashboard_pull_requests_completed", {
        authoredCount: authoredPullRequests.length,
        count: pullRequests.length,
        host,
        reviewRequestedCount: reviewRequestedPullRequests.length,
      });

      return pullRequests;
    } catch (error) {
      logDiffdiffError("github", "list_dashboard_pull_requests_failed", error, {
        host,
      });
      throw error;
    }
  }

  async loadPullRequest(
    repository: ForgeRepository,
    pullRequestNumber: number,
  ): Promise<GitHubPullRequestDetail> {
    const client = await this.clientFactory.create(repository);
    if (client == null) {
      throw new DiffdiffError(
        `Unable to create a GitHub client for ${repository.owner}/${repository.repo}.`,
      );
    }

    return loadPullRequestDetail(client, repository, pullRequestNumber);
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

  async markFileAsViewed(reviewSession: GitHubReviewSession, path: string): Promise<void> {
    const client = await this.requireClient(reviewSession);

    await client.graphql<GitHubGraphqlMarkFileAsViewedResponse>(
      `
        mutation MarkFileAsViewed($input: MarkFileAsViewedInput!) {
          markFileAsViewed(input: $input) {
            clientMutationId
          }
        }
      `,
      {
        input: {
          path,
          pullRequestId: reviewSession.pullRequest.nodeId,
        },
      },
    );
    logDiffdiffInfo("github", "pull_request_file_marked_viewed", {
      path,
      pullRequestNumber: reviewSession.pullRequest.number,
      repository: reviewSession.repository,
    });
  }

  async unmarkFileAsViewed(reviewSession: GitHubReviewSession, path: string): Promise<void> {
    const client = await this.requireClient(reviewSession);

    await client.graphql<GitHubGraphqlUnmarkFileAsViewedResponse>(
      `
        mutation UnmarkFileAsViewed($input: UnmarkFileAsViewedInput!) {
          unmarkFileAsViewed(input: $input) {
            clientMutationId
          }
        }
      `,
      {
        input: {
          path,
          pullRequestId: reviewSession.pullRequest.nodeId,
        },
      },
    );
    logDiffdiffInfo("github", "pull_request_file_unmarked_viewed", {
      path,
      pullRequestNumber: reviewSession.pullRequest.number,
      repository: reviewSession.repository,
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

  async probePullRequestFingerprint(
    reviewSession: GitHubReviewSession,
  ): Promise<PullRequestFingerprint | undefined> {
    const client = await this.clientFactory.create(reviewSession.repository);
    if (client == null) {
      return undefined;
    }

    try {
      return await loadPullRequestFingerprint(
        client,
        reviewSession.repository,
        reviewSession.pullRequest.number,
      );
    } catch (error) {
      logDiffdiffError("github", "probe_pull_request_fingerprint_failed", error, {
        pullRequestNumber: reviewSession.pullRequest.number,
        repository: reviewSession.repository,
      });
      return undefined;
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
