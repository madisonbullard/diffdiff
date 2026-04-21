import { describe, expect, test } from "vite-plus/test";
import { createDiffdiffDialogModels } from "../src/app/dialogs/dialog-models.ts";
import { createTextInputSurface } from "../src/text-input-surface.ts";

describe("dialog models", () => {
  test("packages modal input presentation into grouped feature models", () => {
    const commandBindingLabels = new Map([["system.help", "?"]]);
    const models = createDiffdiffDialogModels({
      activeListView: "commit",
      activePane: "diff",
      branchItems: [],
      branchListFilters: {
        localBranch: true,
        openPr: true,
        remoteBranch: true,
        workingTree: true,
      },
      branchListIndex: 1,
      canApplyCleanup: true,
      cleanupCandidateIndex: 2,
      cleanupCandidates: [],
      cleanupSelection: { removeLocal: true, removeRemote: false },
      commandPalette: {
        commandBindingLabels,
        filteredCommands: [],
        inputSurface: createTextInputSurface({ cursorOffset: 0, value: "" }),
        selectedIndex: 0,
      },
      commitListIndex: 3,
      commitSearchActive: true,
      commitSearchSurface: createTextInputSurface({ cursorOffset: 2, value: "ab" }),
      diagnosticErrorMessage: null,
      diagnosticEventIndex: 4,
      diagnosticEvents: [],
      diagnosticLogFilePath: "/tmp/diffdiff.log",
      draftPrCount: 5,
      filteredCommitItems: [],
      filteredPullRequests: [],
      filterIndex: 2,
      helpCommands: [],
      isDiagnosticsLoading: false,
      isPullRequestListLoading: true,
      isSubmittingReviewAction: true,
      localBranchCount: 6,
      mergeBodyScrollRef: { current: null },
      mergeBodySurface: createTextInputSurface({ cursorOffset: 4, value: "body" }),
      mergeConfirmOpen: true,
      mergeMethod: "squash",
      mergeModalField: "body",
      mergeTitleSurface: createTextInputSurface({ cursorOffset: 5, value: "title" }),
      openPrCount: 7,
      pullRequestConversationItemId: "comment-1",
      pullRequestListIndex: 8,
      pullRequestSearchActive: true,
      pullRequestSearchSurface: createTextInputSurface({ cursorOffset: 3, value: "prs" }),
      remoteBranchCount: 9,
      reviewComposerAutocompleteIndex: 1,
      reviewComposerModels: {
        autocomplete: { isVisible: false, options: [], query: "" },
        context: null,
        historyEntries: [],
        historyScope: null,
        inputSurface: createTextInputSurface({ cursorOffset: 7, value: "comment" }),
      },
      reviewedCount: 10,
      reviewRequestedPrCount: 11,
      reviewSubmissionEventIndex: 2,
      reviewSubmissionSurface: createTextInputSurface({ cursorOffset: 7, value: "summary" }),
      session: {
        comparison: { base: "origin/main", head: "feature/input", mode: "range" },
      } as import("../src/types.ts").PreparedReviewSession,
    });

    expect(models.branch.commitSearchSurface.value).toBe("ab");
    expect(models.pullRequestList.searchSurface.value).toBe("prs");
    expect(models.merge.titleSurface.value).toBe("title");
    expect(models.merge.bodySurface.value).toBe("body");
    expect(models.reviewSubmission.bodySurface.value).toBe("summary");
    expect(models.help.commandBindingLabels).toBe(commandBindingLabels);
    expect(models.pullRequestComments.selectedItemId).toBe("comment-1");
  });
});
