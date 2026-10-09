import { DiffdiffError } from "../errors.ts";
import { logDiffdiffError } from "../logging.ts";
import type { GitHubApiClient } from "../types/providers.ts";
import type {
  GitHubReviewerCandidate,
  GitHubReviewerCandidates,
  GitHubReviewSession,
} from "../types/github.ts";

interface User {
  login: string;
  name: string | null;
  url: string;
}

interface UsersResponse {
  repository: {
    assignableUsers: {
      nodes: (User | null)[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
}

interface SuggestionsResponse {
  repository: {
    pullRequest: {
      suggestedReviewers: ({ isAuthor: boolean; isCommenter: boolean; reviewer: User } | null)[];
    } | null;
  } | null;
}

// Keep suggestions separate: an unavailable recommendation must not block manual selection.
export async function loadReviewerCandidates(
  client: GitHubApiClient,
  session: GitHubReviewSession,
): Promise<GitHubReviewerCandidates> {
  const parameters = { owner: session.repository.owner, repo: session.repository.repo };
  const [users, suggestions] = await Promise.all([
    loadUsers(client, parameters),
    client
      .graphql<SuggestionsResponse>(
        `query ReviewerSuggestions($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          suggestedReviewers { isAuthor isCommenter reviewer { login name url } }
        }
      }
    }`,
        { ...parameters, number: session.pullRequest.number },
      )
      .catch((error) => {
        logDiffdiffError("github", "reviewer_suggestions_failed", error, parameters);
        return null;
      }),
  ]);
  const byLogin = new Map(
    users
      .filter((user) => user.login.toLowerCase() !== session.pullRequest.author.login.toLowerCase())
      .map((user) => [user.login.toLowerCase(), user]),
  );
  const recommended: GitHubReviewerCandidate[] = [];
  for (const suggestion of suggestions?.repository?.pullRequest?.suggestedReviewers ?? []) {
    if (suggestion == null) continue;
    const login = suggestion.reviewer.login.toLowerCase();
    const user = byLogin.get(login);
    if (user == null) continue;
    recommended.push({
      ...user,
      recommendation: {
        basedOnCommits: suggestion.isAuthor,
        basedOnReviewComments: suggestion.isCommenter,
      },
    });
    byLogin.delete(login);
  }
  return {
    users: [
      ...recommended,
      ...[...byLogin.values()].sort((a, b) => a.login.localeCompare(b.login)),
    ],
    recommendationsUnavailable: suggestions?.repository?.pullRequest == null,
  };
}

async function loadUsers(
  client: GitHubApiClient,
  parameters: Record<string, string>,
): Promise<GitHubReviewerCandidate[]> {
  const users: GitHubReviewerCandidate[] = [];
  let cursor: string | null = null;
  const seenCursors = new Set<string>();
  do {
    const response: UsersResponse = await client.graphql<UsersResponse>(
      `query ReviewerCandidates($owner: String!, $repo: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        assignableUsers(first: 100, after: $cursor) {
          nodes { login name url }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
      { ...parameters, cursor },
    );
    if (response.repository == null)
      throw new DiffdiffError("Unable to load repository reviewers.");
    const page = response.repository.assignableUsers;
    for (const user of page.nodes) {
      if (user != null)
        users.push({ login: user.login, name: user.name ?? undefined, url: user.url });
    }
    if (!page.pageInfo.hasNextPage) break;
    if (page.pageInfo.endCursor == null || seenCursors.has(page.pageInfo.endCursor)) {
      throw new DiffdiffError("Unable to load the next page of repository reviewers.");
    }
    cursor = page.pageInfo.endCursor;
    seenCursors.add(cursor);
  } while (cursor != null);
  return users;
}
