import { runCommand } from "../command.ts";
import type {
  ForgeRepository,
  GitHubApiClient,
  GitHubClientFactory,
  GitHubPullRequestMergeRequest,
  GitHubPullRequestMergeResult,
  GitHubPendingReview,
  GitHubPullRequestChecksSummary,
  GitHubPullRequestComment,
  GitHubPullRequestDetail,
  GitHubPullRequestMergeState,
  GitHubPullRequestReviewGroup,
  GitHubPullRequestReviewThread,
  GitHubRefCleanupCandidate,
  GitHubReviewLineAnchor,
  GitHubReviewSession,
  GitHubReviewSubmissionEvent,
  PullRequestInfo,
  ReviewSession,
  ReviewWarning,
} from "../types.ts";
import { DiffdiffError } from "../errors.ts";
import { logDiffdiffError, logDiffdiffInfo, logDiffdiffWarn } from "../logging.ts";
import { OctokitGitHubClientFactory } from "./client.ts";

interface GitHubUserResponse {
  login?: string;
  html_url?: string;
}

interface GitHubPullRequestListResponse {
  number: number;
  title: string;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
}

interface GitHubPullRequestDetailResponse extends GitHubPullRequestListResponse {
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  merged_at: string | null;
  mergeable: boolean | null;
  mergeable_state: string | null;
  node_id: string;
  user: GitHubUserResponse | null;
  head: {
    ref: string;
    sha: string;
  };
}

interface GitHubReviewResponse {
  id: number;
  node_id: string;
  state: string;
  body: string | null;
  submitted_at: string | null;
  user: GitHubUserResponse | null;
}

interface GitHubReviewCommentResponse {
  id: number;
  node_id: string;
  body: string;
  path: string;
  line: number | null;
  original_line: number | null;
  side: "LEFT" | "RIGHT" | null;
  start_line: number | null;
  original_start_line: number | null;
  start_side: "LEFT" | "RIGHT" | null;
  diff_hunk: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  pull_request_review_id: number | null;
  in_reply_to_id: number | null;
  commit_id: string | null;
  original_commit_id: string | null;
  user: GitHubUserResponse | null;
}

interface GitHubCheckRunResponse {
  status: string;
  conclusion: string | null;
}

interface GitHubCheckRunsResponse {
  check_runs?: GitHubCheckRunResponse[];
}

interface GitHubCommitStatusResponse {
  state?: string;
}

interface GitHubCreateReviewResponse {
  body: string | null;
  id: number;
  node_id: string;
}

interface GitHubMergeResponse {
  message: string;
  merged: boolean;
  sha?: string;
}

interface GitHubGraphqlAddPullRequestReviewThreadResponse {
  addPullRequestReviewThread?: {
    thread?: {
      id?: string;
    };
  };
}

interface DeletedRemoteRef {
  branchName: string;
  remoteRef: string;
}

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
      const pullRequest = await this.loadPullRequestDetail(
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

      return {
        ...session,
        github: githubSession,
        warnings: dedupeWarnings([
          ...session.warnings,
          ...buildPullRequestWarnings(session, pullRequest),
        ]),
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

    const deletedRemoteRefs = await this.refreshPostMergeRefs(reviewSession);
    const cleanupCandidates = await this.buildCleanupCandidates(
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

  private async loadPullRequestDetail(
    client: GitHubApiClient,
    repository: ForgeRepository,
    pullRequestNumber: number,
  ): Promise<GitHubPullRequestDetail> {
    const [pullRequestResponse, reviewsResponse, commentsResponse, checksSummary] =
      await Promise.all([
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
        this.loadChecksSummary(client, repository, pullRequestNumber),
      ]);

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

  private async loadChecksSummary(
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

  private async refreshPostMergeRefs(
    reviewSession: GitHubReviewSession,
  ): Promise<DeletedRemoteRef[]> {
    const refsToRefresh = dedupeDeletedRemoteRefs([
      {
        branchName: reviewSession.pullRequest.baseRefName,
        remoteRef: `${reviewSession.remoteName}/${reviewSession.pullRequest.baseRefName}`,
      },
      {
        branchName: reviewSession.pullRequest.headRefName,
        remoteRef: `${reviewSession.remoteName}/${reviewSession.pullRequest.headRefName}`,
      },
    ]);
    const deletedRemoteRefs: DeletedRemoteRef[] = [];

    for (const ref of refsToRefresh) {
      const existedLocally = await this.hasRef(
        reviewSession.repositoryRootPath,
        `refs/remotes/${ref.remoteRef}`,
      );
      const existsOnRemote = await this.remoteBranchExists(
        reviewSession.repositoryRootPath,
        reviewSession.remoteName,
        ref.branchName,
      );

      if (existsOnRemote) {
        await this.fetchRemoteBranch(
          reviewSession.repositoryRootPath,
          reviewSession.remoteName,
          ref.branchName,
        );
        continue;
      }

      if (existedLocally) {
        deletedRemoteRefs.push(ref);
      }
    }

    return deletedRemoteRefs;
  }

  private async buildCleanupCandidates(
    repositoryRootPath: string,
    comparison: GitHubPullRequestMergeRequest["comparison"],
    deletedRemoteRefs: readonly DeletedRemoteRef[],
  ): Promise<GitHubRefCleanupCandidate[]> {
    const cleanupCandidates: GitHubRefCleanupCandidate[] = [];

    for (const ref of deletedRemoteRefs) {
      if (!matchesDeletedRemoteRef(comparison, ref.remoteRef, ref.branchName)) {
        continue;
      }

      if (await this.hasRef(repositoryRootPath, `refs/heads/${ref.branchName}`)) {
        cleanupCandidates.push({
          branchName: ref.branchName,
          kind: "local-branch",
          ref: ref.branchName,
        });
      }

      if (await this.hasRef(repositoryRootPath, `refs/remotes/${ref.remoteRef}`)) {
        cleanupCandidates.push({
          branchName: ref.branchName,
          kind: "remote-tracking",
          ref: ref.remoteRef,
        });
      }
    }

    return dedupeCleanupCandidates(cleanupCandidates).sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "local-branch" ? -1 : 1;
      }

      return left.ref.localeCompare(right.ref);
    });
  }

  private async hasRef(repositoryRootPath: string, ref: string): Promise<boolean> {
    try {
      await runCommand("git", ["rev-parse", "--verify", ref], {
        cwd: repositoryRootPath,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async remoteBranchExists(
    repositoryRootPath: string,
    remoteName: string,
    branchName: string,
  ): Promise<boolean> {
    const stdout = await runCommand(
      "git",
      ["ls-remote", "--heads", remoteName, `refs/heads/${branchName}`],
      {
        allowedExitCodes: [2],
        cwd: repositoryRootPath,
      },
    );

    return stdout.trim() !== "";
  }

  private async fetchRemoteBranch(
    repositoryRootPath: string,
    remoteName: string,
    branchName: string,
  ): Promise<void> {
    await runCommand(
      "git",
      ["fetch", remoteName, `refs/heads/${branchName}:refs/remotes/${remoteName}/${branchName}`],
      {
        cwd: repositoryRootPath,
      },
    );
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

function matchesDeletedRemoteRef(
  comparison: GitHubPullRequestMergeRequest["comparison"],
  remoteRef: string,
  branchName: string,
): boolean {
  return [comparison.base, comparison.head].some(
    (comparisonRef) => comparisonRef === remoteRef || comparisonRef === branchName,
  );
}

function dedupeDeletedRemoteRefs(refs: readonly DeletedRemoteRef[]): DeletedRemoteRef[] {
  const seenRefs = new Set<string>();

  return refs.filter((ref) => {
    if (seenRefs.has(ref.remoteRef)) {
      return false;
    }

    seenRefs.add(ref.remoteRef);
    return true;
  });
}

function dedupeCleanupCandidates(
  refs: readonly GitHubRefCleanupCandidate[],
): GitHubRefCleanupCandidate[] {
  const seenRefs = new Set<string>();

  return refs.filter((ref) => {
    const key = `${ref.kind}:${ref.ref}`;
    if (seenRefs.has(key)) {
      return false;
    }

    seenRefs.add(key);
    return true;
  });
}

function buildReviewThreads(
  comments: readonly GitHubPullRequestComment[],
): GitHubPullRequestReviewThread[] {
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
  const threads = new Map<string, GitHubPullRequestReviewThread>();

  for (const comment of comments) {
    const rootComment = findRootComment(comment, commentsById);
    const threadId = String(rootComment.id);
    const existingThread = threads.get(threadId);

    if (existingThread == null) {
      threads.set(threadId, {
        comments: [comment],
        id: threadId,
        isOutdated: rootComment.isOutdated,
        line: rootComment.line,
        originalLine: rootComment.originalLine,
        path: rootComment.path,
        reviewId: rootComment.reviewId,
        side: rootComment.side,
        startLine: rootComment.startLine,
        startSide: rootComment.startSide,
      });
      continue;
    }

    existingThread.comments.push(comment);
    existingThread.isOutdated = existingThread.isOutdated || comment.isOutdated;
  }

  return [...threads.values()].map((thread) => ({
    ...thread,
    comments: [...thread.comments].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
  }));
}

function buildReviewGroups(
  reviews: readonly GitHubReviewResponse[],
  comments: readonly GitHubPullRequestComment[],
): GitHubPullRequestReviewGroup[] {
  const commentsByReviewId = new Map<number, GitHubPullRequestComment[]>();

  for (const comment of comments) {
    if (comment.reviewId == null) {
      continue;
    }

    const reviewComments = commentsByReviewId.get(comment.reviewId) ?? [];
    reviewComments.push(comment);
    commentsByReviewId.set(comment.reviewId, reviewComments);
  }

  const groups = reviews.map((review) => ({
    author: mapActor(review.user),
    body: review.body ?? undefined,
    comments: [...(commentsByReviewId.get(review.id) ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
    reviewId: review.id,
    reviewNodeId: review.node_id,
    state: review.state,
    submittedAt: review.submitted_at ?? undefined,
  }));

  return groups.sort((left, right) => {
    const leftDate = left.submittedAt ?? left.comments[0]?.createdAt ?? "";
    const rightDate = right.submittedAt ?? right.comments[0]?.createdAt ?? "";
    return leftDate.localeCompare(rightDate);
  });
}

function buildMergeState(
  pullRequest: GitHubPullRequestDetailResponse,
): GitHubPullRequestMergeState {
  return {
    canMerge:
      pullRequest.state === "open" &&
      pullRequest.draft === false &&
      pullRequest.merged === false &&
      pullRequest.mergeable === true,
    isDraft: pullRequest.draft,
    isMerged: pullRequest.merged,
    mergeable: pullRequest.mergeable ?? undefined,
    mergeableState: pullRequest.mergeable_state ?? undefined,
    mergedAt: pullRequest.merged_at ?? undefined,
  };
}

function buildPullRequestWarnings(
  session: ReviewSession,
  pullRequest: GitHubPullRequestDetail,
): ReviewWarning[] {
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

  const changedPaths = new Set(session.files.map((file) => file.path));
  if (pullRequest.reviewThreads.some((thread) => !changedPaths.has(thread.path))) {
    warnings.push({
      code: "github-inline-thread-unavailable",
      message:
        "Some GitHub review threads target paths that are not present in the local comparison, so they will remain available in the comments timeline only.",
    });
  }

  return warnings;
}

function findActivePullRequestCandidate(session: ReviewSession): {
  pullRequest: PullRequestInfo;
  remoteName: string;
  repository: ForgeRepository;
} | null {
  if (session.comparison.mode !== "range") {
    return null;
  }

  for (const branch of session.branches.remote) {
    if (branch.pullRequest == null || branch.remoteName == null) {
      continue;
    }

    const headMatches =
      session.comparison.head === branch.name ||
      session.comparison.head === branch.pullRequest.headRefName ||
      session.comparison.head === session.repository.currentBranch;

    if (!headMatches) {
      continue;
    }

    const remote = session.repository.remotes.find(
      (candidateRemote) => candidateRemote.name === branch.remoteName,
    );
    if (remote?.forge == null) {
      continue;
    }

    return {
      pullRequest: branch.pullRequest,
      remoteName: branch.remoteName,
      repository: remote.forge,
    };
  }

  return null;
}

function mapPullRequestSummary(pullRequest: GitHubPullRequestListResponse): PullRequestInfo {
  return {
    baseRefName: pullRequest.base.ref,
    headRefName: pullRequest.head.ref,
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.html_url,
  };
}

function mapPullRequestComment(comment: GitHubReviewCommentResponse): GitHubPullRequestComment {
  return {
    author: mapActor(comment.user),
    body: comment.body,
    commitId: comment.commit_id ?? undefined,
    createdAt: comment.created_at,
    diffHunk: comment.diff_hunk ?? undefined,
    id: comment.id,
    isOutdated: comment.line == null && comment.original_line != null,
    line: comment.line ?? undefined,
    nodeId: comment.node_id,
    originalCommitId: comment.original_commit_id ?? undefined,
    originalLine: comment.original_line ?? undefined,
    path: comment.path,
    replyToId: comment.in_reply_to_id ?? undefined,
    reviewId: comment.pull_request_review_id ?? undefined,
    side: comment.side ?? "RIGHT",
    startLine: comment.start_line ?? undefined,
    startSide: comment.start_side ?? undefined,
    updatedAt: comment.updated_at,
    url: comment.html_url,
  };
}

function mapActor(user: GitHubUserResponse | null | undefined) {
  return {
    login: user?.login ?? "unknown",
    url: user?.html_url ?? undefined,
  };
}

function findRootComment(
  comment: GitHubPullRequestComment,
  commentsById: ReadonlyMap<number, GitHubPullRequestComment>,
): GitHubPullRequestComment {
  let currentComment = comment;

  while (currentComment.replyToId != null) {
    const parentComment = commentsById.get(currentComment.replyToId);
    if (parentComment == null) {
      break;
    }

    currentComment = parentComment;
  }

  return currentComment;
}

function dedupeWarnings(warnings: readonly ReviewWarning[]): ReviewWarning[] {
  const seenWarnings = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seenWarnings.has(key)) {
      return false;
    }

    seenWarnings.add(key);
    return true;
  });
}
