import { logDiffdiffError } from "../logging.ts";
import type {
  ForgeRepository,
  GitHubPullRequestCheck,
  GitHubPullRequestChecksSummary,
} from "../types/github.ts";
import type { GitHubApiClient } from "../types/providers.ts";
import type {
  GitHubCheckRunResponse,
  GitHubCheckRunsResponse,
  GitHubCommitStatusResponse,
} from "./pull-request-types.ts";

const PRIORITY = { failure: 0, pending: 1, unknown: 2, success: 3 } as const;

// The banner and checks dialog share this snapshot, including legacy status contexts.
export async function loadPullRequestChecks(
  client: GitHubApiClient,
  repository: ForgeRepository,
  headSha: string,
  pullRequestNumber?: number,
): Promise<GitHubPullRequestChecksSummary> {
  const parameters = {
    owner: repository.owner,
    repo: repository.repo,
    ref: headSha,
    per_page: 100,
  };
  try {
    const [runs, status] = await Promise.all([
      loadRuns(client, parameters),
      loadStatuses(client, parameters),
    ]);
    const items: GitHubPullRequestCheck[] = runs.map((run, index) => ({
      id: `check:${run.id ?? index}`,
      name: run.name ?? "Unnamed check",
      source: "check-run",
      state: getRunState(run),
      status: run.status === "completed" ? (run.conclusion ?? "unknown") : run.status,
      provider: run.app?.name,
      summary: run.output?.summary ?? run.output?.title ?? undefined,
      url: run.details_url ?? run.html_url ?? undefined,
    }));
    // GitHub returns newest statuses first. Older attempts must not override the current result.
    const contexts = new Set<string>();
    for (const entry of status.statuses ?? []) {
      if (contexts.has(entry.context)) continue;
      contexts.add(entry.context);
      items.push({
        id: `status:${entry.id}`,
        name: entry.context,
        source: "commit-status",
        state:
          entry.state === "error"
            ? "failure"
            : entry.state === "success" || entry.state === "pending" || entry.state === "failure"
              ? entry.state
              : "unknown",
        status: entry.state,
        summary: entry.description ?? undefined,
        url: entry.target_url ?? undefined,
      });
    }
    items.sort((a, b) => PRIORITY[a.state] - PRIORITY[b.state] || a.name.localeCompare(b.name));
    const failed = items.filter((item) => item.state === "failure").length;
    const pending = items.filter((item) => item.state === "pending").length;
    const successful = items.filter((item) => item.state === "success").length;
    return {
      items,
      failed,
      pending,
      successful,
      total: items.length,
      state:
        failed > 0 || status.state === "failure" || status.state === "error"
          ? "failure"
          : pending > 0 || status.state === "pending"
            ? "pending"
            : items.some((item) => item.state === "unknown")
              ? "unknown"
              : successful > 0 || status.state === "success"
                ? "success"
                : "unknown",
    };
  } catch (error) {
    logDiffdiffError("github", "load_checks_summary_failed", error, {
      headSha,
      pullRequestNumber,
      repository,
    });
    return {
      items: [],
      unavailable: true,
      failed: 0,
      pending: 0,
      successful: 0,
      total: 0,
      state: "unknown",
    };
  }
}

function getRunState(run: GitHubCheckRunResponse): GitHubPullRequestCheck["state"] {
  if (run.status !== "completed") return "pending";
  if (["success", "neutral", "skipped"].includes(run.conclusion ?? "")) return "success";
  if (
    ["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"].includes(
      run.conclusion ?? "",
    )
  )
    return "failure";
  return "unknown";
}

async function loadRuns(
  client: GitHubApiClient,
  parameters: Record<string, unknown>,
): Promise<GitHubCheckRunResponse[]> {
  const runs: GitHubCheckRunResponse[] = [];
  for (let page = 1; ; page++) {
    const response = (await client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
      ...parameters,
      page,
    })) as GitHubCheckRunsResponse;
    const entries = response.check_runs ?? [];
    runs.push(...entries);
    if (
      entries.length < 100 ||
      (response.total_count != null && runs.length >= response.total_count)
    )
      return runs;
  }
}

async function loadStatuses(
  client: GitHubApiClient,
  parameters: Record<string, unknown>,
): Promise<GitHubCommitStatusResponse> {
  const statuses: NonNullable<GitHubCommitStatusResponse["statuses"]> = [];
  let state: string | undefined;
  for (let page = 1; ; page++) {
    const response = (await client.request("GET /repos/{owner}/{repo}/commits/{ref}/status", {
      ...parameters,
      page,
    })) as GitHubCommitStatusResponse;
    if (page === 1) state = response.state;
    const entries = response.statuses ?? [];
    statuses.push(...entries);
    if (entries.length < 100) return { state, statuses };
  }
}
