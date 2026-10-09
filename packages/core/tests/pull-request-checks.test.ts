import { expect, test, vi } from "vite-plus/test";
import { loadPullRequestChecks } from "../src/github/pull-request-checks.ts";
import type { ForgeRepository } from "../src/types/github.ts";
import type { GitHubApiClient } from "../src/types/providers.ts";

const repository: ForgeRepository = {
  forge: "github",
  host: "github.com",
  owner: "owner",
  repo: "repo",
};
function client(request: GitHubApiClient["request"]): GitHubApiClient {
  return { request, graphql: vi.fn(), paginate: vi.fn() };
}

test("checks snapshot includes named checks, providers, output and legacy statuses; failures come first", async () => {
  const request = vi.fn(async (route: string) =>
    route.endsWith("/check-runs")
      ? {
          check_runs: [
            {
              id: 1,
              name: "Build",
              status: "completed",
              conclusion: "success",
              app: { name: "GitHub Actions" },
            },
            {
              id: 2,
              name: "Tests",
              status: "completed",
              conclusion: "failure",
              details_url: "https://example.com/tests",
              output: { summary: "Three tests failed" },
            },
            { id: 3, name: "Deploy", status: "queued", conclusion: null },
          ],
        }
      : {
          state: "failure",
          statuses: [
            {
              id: 4,
              context: "CircleCI",
              state: "error",
              description: "Build error",
              target_url: "https://example.com/ci",
            },
            { id: 5, context: "CircleCI", state: "success" },
            { id: 6, context: "Coverage", state: "success" },
          ],
        },
  );
  const checks = await loadPullRequestChecks(client(request), repository, "sha");
  expect(checks).toMatchObject({
    state: "failure",
    total: 5,
    failed: 2,
    pending: 1,
    successful: 2,
  });
  expect(checks.items?.map((item) => item.name)).toEqual([
    "CircleCI",
    "Tests",
    "Deploy",
    "Build",
    "Coverage",
  ]);
  expect(checks.items?.[0]).toMatchObject({
    state: "failure",
    source: "commit-status",
    summary: "Build error",
    url: "https://example.com/ci",
  });
  expect(checks.items?.[1]).toMatchObject({
    summary: "Three tests failed",
    url: "https://example.com/tests",
  });
  expect(checks.items?.[3]?.provider).toBe("GitHub Actions");
  expect(request).toHaveBeenCalledTimes(2);
});

test.each(["success", "neutral", "skipped"])("%s is a passing conclusion", async (conclusion) => {
  const checks = await loadPullRequestChecks(
    client(async (route) =>
      route.endsWith("/check-runs")
        ? {
            check_runs: [{ id: 1, name: "Check", status: "completed", conclusion }],
          }
        : { state: "pending", statuses: [] },
    ),
    repository,
    "sha",
  );
  expect(checks.successful).toBe(1);
  expect(checks.failed).toBe(0);
  expect(checks.items?.[0]?.status).toBe(conclusion);
});

test.each(["failure", "cancelled", "timed_out", "action_required", "startup_failure"])(
  "%s remains visible as a failed check",
  async (conclusion) => {
    const checks = await loadPullRequestChecks(
      client(async (route) =>
        route.endsWith("/check-runs")
          ? {
              check_runs: [{ id: 1, name: "Check", status: "completed", conclusion }],
            }
          : {},
      ),
      repository,
      "sha",
    );
    expect(checks.failed).toBe(1);
    expect(checks.state).toBe("failure");
  },
);

test("paginates both check runs and statuses for the exact head commit", async () => {
  const request = vi.fn(async (route: string, parameters: Record<string, unknown>) => {
    const offset = parameters.page === 1 ? 0 : 100;
    const entries = Array.from({ length: offset === 0 ? 100 : 1 }, (_, index) => ({
      id: offset + index,
      name: `Check-${offset + index}`,
      context: `Status-${offset + index}`,
      status: "completed",
      conclusion: "success",
      state: "success",
    }));
    return route.endsWith("/check-runs")
      ? { check_runs: entries, total_count: 101 }
      : { state: "success", statuses: entries };
  });
  const checks = await loadPullRequestChecks(client(request), repository, "head-sha");
  expect(checks.total).toBe(202);
  expect(checks.successful).toBe(202);
  expect(request).toHaveBeenCalledTimes(4);
  for (const [, parameters] of request.mock.calls)
    expect(parameters).toMatchObject({
      ref: "head-sha",
      owner: "owner",
      repo: "repo",
      per_page: 100,
    });
});

test("an API failure is distinguished from a commit with no checks", async () => {
  const failed = await loadPullRequestChecks(
    client(async () => {
      throw new Error("offline");
    }),
    repository,
    "sha",
  );
  expect(failed).toMatchObject({ unavailable: true, state: "unknown", total: 0, items: [] });
  const empty = await loadPullRequestChecks(
    client(async () => ({})),
    repository,
    "sha",
  );
  expect(empty).toMatchObject({ state: "unknown", total: 0, items: [] });
  expect(empty.unavailable).toBeUndefined();
});

test("an incomplete completed result is unknown, not a failure or an all-passing result", async () => {
  const checks = await loadPullRequestChecks(
    client(async (route) =>
      route.endsWith("/check-runs")
        ? {
            check_runs: [{ id: 1, name: "No conclusion", status: "completed", conclusion: null }],
          }
        : { state: "success", statuses: [] },
    ),
    repository,
    "sha",
  );
  expect(checks).toMatchObject({ state: "unknown", failed: 0, successful: 0, total: 1 });
  expect(checks.items?.[0]).toMatchObject({ state: "unknown", status: "unknown" });
});
