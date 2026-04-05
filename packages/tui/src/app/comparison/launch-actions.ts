import { loadReviewCache, type BranchInfo } from "@diffdiff/core";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";

interface CreateLaunchActionsOptions {
  actions: {
    applyLoadedSession: (
      nextSession: import("../../types.ts").PreparedReviewSession,
      options?: {
        resetReviewState?: boolean;
        reviewCacheState?: import("@diffdiff/core").ReviewCacheState;
      },
    ) => void;
    beginSessionLoad: () => number;
    isLatestSessionLoad: (loadId: number) => boolean;
  };
  persistence: DiffdiffAppPersistence;
  props: Pick<DiffdiffAppProps, "loadSession" | "resolveLaunchTarget">;
  state: DiffdiffAppState;
}

export function createLaunchActions({
  actions,
  persistence,
  props,
  state,
}: CreateLaunchActionsOptions) {
  function toggleBranchFilter(key: keyof import("../../types.ts").BranchListFilters): void {
    state.setBranchListFilters((currentFilters) => {
      const nextFilters = { ...currentFilters, [key]: !currentFilters[key] };
      state.setStatusMessage(`${nextFilters[key] ? "Showing" : "Hiding"} ${key.toLowerCase()}.`);
      return nextFilters;
    });
  }

  async function loadSessionReviewCache(
    nextSession: import("../../types.ts").PreparedReviewSession,
  ): Promise<import("@diffdiff/core").ReviewCacheState | undefined> {
    return loadReviewCache({
      repositoryRootPath: nextSession.repository.rootPath,
      base: nextSession.comparison.base,
      head: nextSession.comparison.head,
    });
  }

  async function applyBranchSelection(target: "base" | "head", branch: BranchInfo): Promise<void> {
    const nextOptions = {
      ...state.startupOptions,
      [target]: branch.name,
    } satisfies import("../../types.ts").LaunchOptions;
    const shouldShowEventLogLoading = target === "base";
    state.setIsReloading(true);
    state.setStatusMessage(`Updating ${target} to ${branch.name}...`);
    if (shouldShowEventLogLoading) {
      state.setBaseBranchLoadingMessage(`Updating base to ${branch.name}...`);
    }

    const sessionLoadId = actions.beginSessionLoad();
    try {
      const nextSession = await props.loadSession(nextOptions);
      const reviewCacheState = await loadSessionReviewCache(nextSession);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession, { resetReviewState: true, reviewCacheState });
      state.setStartupOptions(nextOptions);
      state.setDialogStack([]);
      state.setStatusMessage(`Updated ${target} to ${branch.name}.`);
    } catch (error) {
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        persistence.persistenceApi.handleAppError(error, `Unable to update ${target}.`, {
          action: "apply-branch-selection",
          branch: branch.name,
          target,
        });
      }
    } finally {
      if (shouldShowEventLogLoading) {
        state.setBaseBranchLoadingMessage(null);
      }
      state.setIsReloading(false);
    }
  }

  async function applyCommitSelection(
    target: "base" | "head",
    sha: string,
    shortSha: string,
  ): Promise<void> {
    const nextOptions = {
      ...state.startupOptions,
      [target]: sha,
    } satisfies import("../../types.ts").LaunchOptions;
    state.setIsReloading(true);
    state.setStatusMessage(`Updating ${target} to commit ${shortSha}...`);
    const sessionLoadId = actions.beginSessionLoad();
    try {
      const nextSession = await props.loadSession(nextOptions);
      const reviewCacheState = await loadSessionReviewCache(nextSession);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession, { resetReviewState: true, reviewCacheState });
      state.setStartupOptions(nextOptions);
      state.setDialogStack([]);
      state.setStatusMessage(`Updated ${target} to commit ${shortSha}.`);
    } catch (error) {
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        persistence.persistenceApi.handleAppError(error, `Unable to update ${target}.`, {
          action: "apply-commit-selection",
          sha,
          shortSha,
          target,
        });
      }
    } finally {
      state.setIsReloading(false);
    }
  }

  async function applyWorkingTreeSelection(): Promise<void> {
    const { base: _base, head: _head, ...remainingOptions } = state.startupOptions;
    const nextOptions = { ...remainingOptions } satisfies import("../../types.ts").LaunchOptions;
    state.setIsReloading(true);
    state.setStatusMessage("Reviewing working tree changes against HEAD...");
    const sessionLoadId = actions.beginSessionLoad();
    try {
      const nextSession = await props.loadSession(nextOptions);
      const reviewCacheState = await loadSessionReviewCache(nextSession);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession, { resetReviewState: true, reviewCacheState });
      state.setStartupOptions(nextOptions);
      state.setDialogStack([]);
      state.setStatusMessage("Showing working tree changes against HEAD.");
    } catch (error) {
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        persistence.persistenceApi.handleAppError(error, "Unable to review working tree changes.", {
          action: "apply-working-tree-selection",
        });
      }
    } finally {
      state.setIsReloading(false);
    }
  }

  async function applyDashboardPullRequestSelection(
    pullRequest: import("@diffdiff/core").GitHubDashboardPullRequest,
  ): Promise<void> {
    if (props.resolveLaunchTarget == null) {
      persistence.persistenceApi.handleAppFailure("Unable to open the selected pull request.", {
        action: "apply-dashboard-pull-request-selection",
        reason: "missing-launch-target-resolver",
      });
      return;
    }

    const target = `${pullRequest.repository.owner}/${pullRequest.repository.repo}/${pullRequest.number}`;
    state.setIsReloading(true);
    state.setStatusMessage(
      `Opening ${pullRequest.repository.owner}/${pullRequest.repository.repo}#${pullRequest.number}...`,
    );
    const sessionLoadId = actions.beginSessionLoad();
    try {
      const nextOptions = await props.resolveLaunchTarget(target, state.startupOptions);
      const nextSession = await props.loadSession(nextOptions);
      const reviewCacheState = await loadSessionReviewCache(nextSession);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession, { resetReviewState: true, reviewCacheState });
      state.setStartupOptions(nextOptions);
      state.setDialogStack([]);
      state.setStatusMessage(
        `Opened ${pullRequest.repository.owner}/${pullRequest.repository.repo}#${pullRequest.number}.`,
      );
    } catch (error) {
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        persistence.persistenceApi.handleAppError(
          error,
          "Unable to open the selected pull request.",
          {
            action: "apply-dashboard-pull-request-selection",
            pullRequestNumber: pullRequest.number,
            repository: pullRequest.repository,
          },
        );
      }
    } finally {
      state.setIsReloading(false);
    }
  }

  async function applyPullRequestSelection(branch: BranchInfo): Promise<void> {
    if (branch.pullRequest == null) {
      return;
    }

    const baseRemoteBranch = state.comparisonBrowserData.branches.remote.find(
      (candidateBranch) =>
        candidateBranch.remoteName === branch.remoteName &&
        candidateBranch.name.endsWith(`/${branch.pullRequest!.baseRefName}`),
    );
    const baseLocalBranch = state.comparisonBrowserData.branches.local.find(
      (candidateBranch) => candidateBranch.name === branch.pullRequest?.baseRefName,
    );
    const nextOptions = {
      ...state.startupOptions,
      base: baseRemoteBranch?.name ?? baseLocalBranch?.name ?? branch.pullRequest.baseRefName,
      head: branch.name,
    } satisfies import("../../types.ts").LaunchOptions;

    state.setIsReloading(true);
    state.setStatusMessage(`Opening PR #${branch.pullRequest.number}...`);
    const sessionLoadId = actions.beginSessionLoad();
    try {
      const nextSession = await props.loadSession(nextOptions);
      const reviewCacheState = await loadSessionReviewCache(nextSession);
      if (!actions.isLatestSessionLoad(sessionLoadId)) {
        return;
      }
      actions.applyLoadedSession(nextSession, { resetReviewState: true, reviewCacheState });
      state.setStartupOptions(nextOptions);
      state.setDialogStack([]);
      state.setStatusMessage(`Opened PR #${branch.pullRequest.number}.`);
    } catch (error) {
      if (actions.isLatestSessionLoad(sessionLoadId)) {
        persistence.persistenceApi.handleAppError(
          error,
          "Unable to open the selected pull request.",
          {
            action: "apply-pull-request-selection",
            pullRequestNumber: branch.pullRequest.number,
          },
        );
      }
    } finally {
      state.setIsReloading(false);
    }
  }

  return {
    applyBranchSelection,
    applyCommitSelection,
    applyDashboardPullRequestSelection,
    applyPullRequestSelection,
    applyWorkingTreeSelection,
    toggleBranchFilter,
  };
}
