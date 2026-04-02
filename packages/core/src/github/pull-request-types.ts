export interface GitHubUserResponse {
  login?: string;
  html_url?: string;
}

export interface GitHubPullRequestListResponse {
  number: number;
  title: string;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
}

export interface GitHubPullRequestDetailResponse extends GitHubPullRequestListResponse {
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

export interface GitHubReviewResponse {
  id: number;
  node_id: string;
  state: string;
  body: string | null;
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

export interface DeletedRemoteRef {
  branchName: string;
  remoteRef: string;
}
