import { expect, test, vi } from "vite-plus/test";
import { GitHubPullRequestService } from "../src/github/pull-request-service.ts";
import type { GitHubApiClient } from "../src/types/providers.ts";
import type { GitHubReviewSession } from "../src/types/github.ts";

const repository = { forge: "github", host: "github.com", owner: "owner", repo: "repo" };

test.each([true, false])(
  "sets PR draft status to %s using the corresponding GraphQL mutation",
  async (isDraft) => {
    const { service, session, graphql } = fixture();
    const mutation = isDraft ? "convertPullRequestToDraft" : "markPullRequestReadyForReview";
    graphql.mockResolvedValueOnce({ [mutation]: { pullRequest: { isDraft } } });
    await service.setPullRequestDraft(session, isDraft);
    expect(graphql).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(mutation), {
      pullRequestId: "PR_42",
    });
  },
);

test("draft changes reject closed/merged PRs, unauthenticated clients, unconfirmed responses and API failures", async () => {
  const { service, session, client, graphql } = fixture();
  session.pullRequest.state = "closed";
  await expect(service.setPullRequestDraft(session, true)).rejects.toThrow("open pull request");
  session.pullRequest.state = "open";
  session.pullRequest.isMerged = true;
  await expect(service.setPullRequestDraft(session, true)).rejects.toThrow("open pull request");
  expect(graphql).not.toHaveBeenCalled();
  session.pullRequest.isMerged = false;
  client.auth = undefined;
  await expect(service.setPullRequestDraft(session, true)).rejects.toThrow("authentication");
  client.auth = { host: "github.com", token: "test-token", tokenSource: "env" };
  await expect(service.setPullRequestDraft(session, true)).rejects.toThrow("did not confirm");
  graphql.mockRejectedValueOnce(new Error("403 forbidden"));
  await expect(service.setPullRequestDraft(session, true)).rejects.toThrow("403");
});
const user = (login: string, name: string | null = null) => ({
  login,
  name,
  url: `https://github.com/${login}`,
});
const page = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) => ({
  repository: { assignableUsers: { nodes, pageInfo: { hasNextPage, endCursor } } },
});

function fixture() {
  const graphql = vi.fn(
    async (_query: string, _parameters: Record<string, unknown>): Promise<unknown> => page([]),
  );
  const request = vi.fn(async () => undefined);
  const client: GitHubApiClient = {
    auth: { host: "github.com", token: "test-token", tokenSource: "env" },
    graphql: graphql as GitHubApiClient["graphql"],
    request,
    paginate: vi.fn(async () => []),
  };
  const service = new GitHubPullRequestService({ create: async () => client });
  const session: GitHubReviewSession = {
    auth: { host: "github.com", isAuthenticated: true },
    repository,
    remoteName: "origin",
    repositoryRootPath: "/test",
    pullRequest: {
      author: { login: "author" },
      baseRefName: "main",
      headRefName: "feature",
      headSha: "sha",
      number: 42,
      nodeId: "PR_42",
      url: "https://github.com/owner/repo/pull/42",
      title: "PR",
      changedFileCount: 0,
      changedFiles: {},
      commitCount: 0,
      conversationItems: [],
      checks: { state: "unknown", total: 0, successful: 0, failed: 0, pending: 0 },
      isDraft: false,
      isMerged: false,
      issueCommentCount: 0,
      latestOpinionatedReviews: [],
      merge: { canMerge: true, isDraft: false, isMerged: false },
      reviewCommentCount: 0,
      reviewGroups: [],
      reviewRequests: [
        { kind: "team", label: "team" },
        { kind: "user", label: "existing" },
      ],
      reviewThreads: [],
      state: "open",
      updatedAt: "2026-10-09T00:00:00Z",
    },
  };
  return { client, graphql, request, service, session };
}

test("loads every candidate page and puts eligible GitHub recommendations first", async () => {
  const { graphql, service, session } = fixture();
  graphql.mockImplementation(async (query, parameters) => {
    if (query.includes("ReviewerSuggestions"))
      return {
        repository: {
          pullRequest: {
            suggestedReviewers: [
              { reviewer: user("zara"), isAuthor: true, isCommenter: true },
              { reviewer: user("outsider"), isAuthor: true, isCommenter: false },
              { reviewer: user("author"), isAuthor: true, isCommenter: false },
              null,
              { reviewer: user("ZARA"), isAuthor: false, isCommenter: false },
            ],
          },
        },
      };
    return parameters.cursor == null
      ? page([user("bob", "Robert"), user("AUTHOR"), null], true, "next")
      : page([user("zara", "Zara"), user("alice"), user("bob")]);
  });
  const result = await service.listReviewerCandidates(session);
  expect(result).toEqual({
    recommendationsUnavailable: false,
    users: [
      {
        ...user("zara", "Zara"),
        recommendation: { basedOnCommits: true, basedOnReviewComments: true },
      },
      { ...user("alice"), name: undefined },
      { ...user("bob"), name: undefined },
    ],
  });
  expect(graphql).toHaveBeenCalledWith(expect.stringContaining("assignableUsers(first: 100"), {
    owner: "owner",
    repo: "repo",
    cursor: "next",
  });
});

test("recommendation failure does not block manual reviewer selection", async () => {
  const { graphql, service, session } = fixture();
  graphql.mockImplementation(async (query) => {
    if (query.includes("ReviewerSuggestions")) throw new Error("Not supported");
    return page([user("bob", "Robert")]);
  });
  await expect(service.listReviewerCandidates(session)).resolves.toEqual({
    recommendationsUnavailable: true,
    users: [user("bob", "Robert")],
  });
});

test("candidate failures are surfaced instead of presenting an empty successful list", async () => {
  const { graphql, service, session } = fixture();
  graphql.mockRejectedValue(new Error("Access denied"));
  await expect(service.listReviewerCandidates(session)).rejects.toThrow("Access denied");
});

test("rejects a broken pagination cursor instead of looping or silently truncating", async () => {
  const { graphql, service, session } = fixture();
  graphql.mockResolvedValue(page([], true, null));
  await expect(service.listReviewerCandidates(session)).rejects.toThrow("next page");
});

test("detects multi-page cursor cycles", async () => {
  const { graphql, service, session } = fixture();
  graphql.mockImplementation(async (_query, parameters) =>
    page([], true, parameters.cursor === "a" ? "b" : "a"),
  );
  await expect(service.listReviewerCandidates(session)).rejects.toThrow("next page");
});

test("requests only new reviewers, deduplicates logins, and leaves team requests intact", async () => {
  const { request, service, session } = fixture();
  await service.requestReviewers(session, [" existing ", "Alice", "alice", "", "bob"]);
  expect(request).toHaveBeenCalledExactlyOnceWith(
    "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
    {
      owner: "owner",
      repo: "repo",
      pull_number: 42,
      reviewers: ["alice", "bob"],
    },
  );
  expect(session.pullRequest.reviewRequests).toEqual([
    { kind: "team", label: "team" },
    { kind: "user", label: "existing" },
  ]);
});

test("does not send empty or already-requested reviewer batches", async () => {
  const { request, service, session } = fixture();
  await service.requestReviewers(session, []);
  await service.requestReviewers(session, ["EXISTING", " "]);
  expect(request).not.toHaveBeenCalled();
});

test("rejects self-review requests and requests on closed or merged PRs", async () => {
  const { request, service, session } = fixture();
  await expect(service.requestReviewers(session, ["AUTHOR"])).rejects.toThrow("author");
  session.pullRequest.state = "closed";
  await expect(service.requestReviewers(session, ["bob"])).rejects.toThrow("open pull request");
  session.pullRequest.state = "open";
  session.pullRequest.isMerged = true;
  await expect(service.requestReviewers(session, ["bob"])).rejects.toThrow("open pull request");
  expect(request).not.toHaveBeenCalled();
});

test("both reviewer operations require authentication", async () => {
  const { client, request, graphql, service, session } = fixture();
  client.auth = undefined;
  await expect(service.listReviewerCandidates(session)).rejects.toThrow("authentication");
  await expect(service.requestReviewers(session, ["bob"])).rejects.toThrow("authentication");
  expect(request).not.toHaveBeenCalled();
  expect(graphql).not.toHaveBeenCalled();
});

test("propagates request permission and validation failures", async () => {
  const { request, service, session } = fixture();
  request.mockRejectedValue(new Error("422: reviewer is not a collaborator"));
  await expect(service.requestReviewers(session, ["bob"])).rejects.toThrow("422");
});
