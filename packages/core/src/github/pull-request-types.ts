import type {
  GitHubPullRequestFileViewedState,
  GitHubPullRequestReviewDecision,
  GitHubPullRequestReviewState,
} from "../types/github.ts";

export interface GitHubUserResponse {
  login?: string;
  html_url?: string;
}

export interface GitHubPullRequestListResponse {
  number: number;
  title: string;
  html_url: string;
  created_at?: string;
  head: { ref: string };
  base: { ref: string };
}

export interface GitHubSearchIssuePullRequestResponse {
  draft?: boolean;
  html_url: string;
  number: number;
  repository_url: string;
  state: "open" | "closed";
  title: string;
  updated_at: string;
  user: GitHubUserResponse | null;
}

export interface GitHubPullRequestDetailResponse extends GitHubPullRequestListResponse {
  body: string | null;
  comments: number;
  commits: number;
  changed_files: number;
  state: "open" | "closed";
  updated_at: string;
  draft: boolean;
  merged: boolean;
  merged_at: string | null;
  mergeable: boolean | null;
  mergeable_state: string | null;
  node_id: string;
  review_comments: number;
  user: GitHubUserResponse | null;
  head: {
    ref: string;
    sha: string;
  };
}

export interface GitHubReviewResponse {
  id: number;
  node_id: string;
  state: string;
  body: string | null;
  html_url: string;
  submitted_at: string | null;
  user: GitHubUserResponse | null;
}

export interface GitHubReviewCommentResponse {
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

export interface GitHubIssueCommentResponse {
  id: number;
  node_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: GitHubUserResponse | null;
}

export interface GitHubCheckRunResponse {
  status: string;
  conclusion: string | null;
}

export interface GitHubCheckRunsResponse {
  check_runs?: GitHubCheckRunResponse[];
}

export interface GitHubCommitStatusResponse {
  state?: string;
}

export interface GitHubCreateReviewResponse {
  body: string | null;
  id: number;
  node_id: string;
}

export interface GitHubMergeResponse {
  message: string;
  merged: boolean;
  sha?: string;
}

export interface GitHubGraphqlAddPullRequestReviewThreadResponse {
  addPullRequestReviewThread?: {
    thread?: {
      id?: string;
    };
  };
}

export interface GitHubGraphqlPullRequestFilesResponse {
  repository?: {
    pullRequest?: {
      files?: {
        nodes?: Array<{
          path?: string | null;
          viewerViewedState?: GitHubPullRequestFileViewedState | null;
        } | null>;
        pageInfo?: {
          endCursor?: string | null;
          hasNextPage: boolean;
        } | null;
      } | null;
    } | null;
  } | null;
}

export interface GitHubGraphqlMarkFileAsViewedResponse {
  markFileAsViewed?: {
    clientMutationId?: string | null;
  };
}

export interface GitHubGraphqlUnmarkFileAsViewedResponse {
  unmarkFileAsViewed?: {
    clientMutationId?: string | null;
  };
}

export interface GitHubGraphqlPullRequestReviewSignalsResponse {
  repository?: {
    pullRequest?: {
      reviewDecision?: GitHubPullRequestReviewDecision | null;
      reviewRequests?: {
        nodes?: Array<{
          requestedReviewer?:
            | {
                __typename?: "Team";
                slug?: string | null;
                url?: string | null;
                organization?: { login?: string | null } | null;
              }
            | {
                __typename?: "User";
                login?: string | null;
                url?: string | null;
              }
            | null;
        } | null>;
        pageInfo?: {
          endCursor?: string | null;
          hasNextPage: boolean;
        } | null;
      } | null;
    } | null;
  } | null;
}

export interface GitHubGraphqlPullRequestLatestOpinionatedReviewsResponse {
  repository?: {
    pullRequest?: {
      latestOpinionatedReviews?: {
        nodes?: Array<{
          state?: GitHubPullRequestReviewState | null;
          updatedAt?: string | null;
          author?: {
            login?: string | null;
            url?: string | null;
          } | null;
        } | null>;
        pageInfo?: {
          endCursor?: string | null;
          hasNextPage: boolean;
        } | null;
      } | null;
    } | null;
  } | null;
}

export interface DeletedRemoteRef {
  branchName: string;
  remoteRef: string;
}
