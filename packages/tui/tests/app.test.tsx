import {
  buildReviewedFileFingerprint,
  buildReviewSessionFingerprint,
  type GitHubDashboardPullRequest,
  type GitHubUserPreferences,
  type ReviewSessionFreshnessResult,
} from "@madisonbullard/diffdiff-core";
import * as diffdiffCore from "@madisonbullard/diffdiff-core";
import type { ComponentProps, ReactNode } from "react";
import type {
  ReactTestInstance,
  ReactTestRenderer,
  TestRendererOptions,
} from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { DiffdiffApp } from "../src/app/DiffdiffApp.tsx";
import { DiffScrollController } from "../src/app/layout/diff-scroll.ts";
import { FileCard } from "../src/components/file-card.tsx";
import { ReviewerPickerModal } from "../src/review/reviewer-picker-modal.tsx";
import { getUiTheme } from "../src/theme.ts";
import type { LaunchOptions, PreparedReviewFile, PreparedReviewSession } from "../src/types.ts";

interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
}

const selectionCopyState = vi.hoisted(() => ({
  copySelection: vi.fn(),
}));

const clipboardState = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(async () => true),
}));

const prepareReviewSessionState = vi.hoisted(() => ({
  hydratePreparedReviewFiles: vi.fn(async (files: PreparedReviewFile[]) => files),
}));

type MockRenderer = {
  root?: MockRenderer;
  keyInput?: MockRenderer;
  clearSelection: () => void;
  getSelection: () => null;
  on: (event: string, handler: (...args: unknown[]) => void) => MockRenderer;
  off: (event: string, handler: (...args: unknown[]) => void) => MockRenderer;
  emit: (event: string, ...args: unknown[]) => boolean;
  removeAllListeners: () => MockRenderer;
  resume: ReturnType<typeof vi.fn<() => void>>;
  suspend: ReturnType<typeof vi.fn<() => void>>;
};

const rendererState = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const renderer: MockRenderer = {
    clearSelection: () => undefined,
    getSelection: () => null,
    on(event, handler) {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(handler);
      listeners.set(event, eventListeners);
      return renderer;
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
      return renderer;
    },
    emit(event, ...args) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }

      return (listeners.get(event)?.size ?? 0) > 0;
    },
    removeAllListeners() {
      listeners.clear();
      return renderer;
    },
    resume: vi.fn(),
    suspend: vi.fn(),
  };

  renderer.root = renderer;
  renderer.keyInput = renderer;
  return { renderer };
});

const terminalDimensionsState = vi.hoisted(() => ({
  height: 40,
  width: 160,
}));

const registeredKeyboardHandlers = new Set<(key: KeyboardInput) => void>();
const renderedTrees = new Set<ReactTestRenderer>();

vi.mock("@opentui/react", () => {
  return {
    flushSync(callback: () => void) {
      callback();
    },
    useKeyboard(handler: (key: KeyboardInput) => void) {
      registeredKeyboardHandlers.add(handler);
    },
    useRenderer() {
      return rendererState.renderer;
    },
    useTerminalDimensions() {
      return terminalDimensionsState;
    },
  };
});

vi.mock("../src/selection-copy.ts", () => ({
  copySelection: selectionCopyState.copySelection,
}));

vi.mock("../src/clipboard.ts", () => ({
  copyTextToClipboard: clipboardState.copyTextToClipboard,
}));

vi.mock("../src/diff/prepare-review-session.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/diff/prepare-review-session.ts")>();

  return {
    ...actual,
    hydratePreparedReviewFiles: (...args: Parameters<typeof actual.hydratePreparedReviewFiles>) =>
      prepareReviewSessionState.hydratePreparedReviewFiles([...args[0]]),
  };
});

const theme = getUiTheme("pierre-dark");
const syntaxStyle = { kind: "syntax-style" } as unknown as import("@opentui/core").SyntaxStyle;
const BLINK_TEXT_ATTRIBUTE = 1 << 4;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  registeredKeyboardHandlers.clear();
  rendererState.renderer.removeAllListeners();
  terminalDimensionsState.width = 160;
  terminalDimensionsState.height = 40;
  selectionCopyState.copySelection.mockReset().mockReturnValue(false);
  clipboardState.copyTextToClipboard.mockReset().mockResolvedValue(true);
  prepareReviewSessionState.hydratePreparedReviewFiles
    .mockReset()
    .mockImplementation(async (files) => files);
  vi.spyOn(diffdiffCore, "loadReviewCache").mockResolvedValue(undefined);
  vi.spyOn(diffdiffCore, "saveDiffdiffPreferences").mockResolvedValue(undefined);
  vi.spyOn(diffdiffCore, "loadDiffdiffPreferences").mockResolvedValue(
    diffdiffCore.getDefaultDiffdiffPreferences(),
  );
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  act(() => {
    for (const tree of renderedTrees) tree.unmount();
  });
  renderedTrees.clear();
  registeredKeyboardHandlers.clear();
  vi.useRealTimers();
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
  vi.restoreAllMocks();
});

test.each([true, false])(
  "draft keybinding switches a PR from draft=%s and updates the palette",
  async (isDraft) => {
    const github = createGitHubReviewSession();
    github.pullRequest.isDraft = isDraft;
    github.pullRequest.merge.isDraft = isDraft;
    const setPullRequestDraft = vi.fn(async () => undefined);
    const refreshed = createPreparedSession({
      github: {
        ...github,
        pullRequest: {
          ...github.pullRequest,
          isDraft: !isDraft,
          merge: { ...github.pullRequest.merge, isDraft: !isDraft },
        },
      },
    });
    const tree = render(
      <DiffdiffApp
        {...createAppProps({
          initialSession: createPreparedSession({ github }),
          setPullRequestDraft,
          loadSession: async () => refreshed,
        })}
      />,
    );
    emitKey({ name: "space", sequence: " " });
    await emitAsyncKey({ name: "d", shift: true });
    expect(setPullRequestDraft).toHaveBeenCalledExactlyOnceWith(github, !isDraft);
    expect(getAppText(tree)).toContain(
      `Marked pull request as ${!isDraft ? "draft" : "ready for review"}.`,
    );
  },
);

test("draft toggle retains confirmed state after refresh failure and blocks repeat submissions", async () => {
  const pending = createDeferred<void>();
  const setPullRequestDraft = vi.fn(() => pending.promise);
  const tree = render(
    <DiffdiffApp
      {...createReviewerAppProps({
        setPullRequestDraft,
        loadSession: async () => {
          throw new Error("offline");
        },
      })}
    />,
  );
  emitKey({ name: "x", ctrl: true });
  emitKey({ name: "d", shift: true });
  emitKey({ name: "space", sequence: " " });
  emitKey({ name: "d", shift: true });
  expect(setPullRequestDraft).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve());
  expect(getAppText(tree)).toContain("Marked pull request as draft, but unable to refresh");
  emitKey({ name: "space", sequence: " " });
  emitKey({ name: "d", shift: true });
  expect(setPullRequestDraft).toHaveBeenLastCalledWith(expect.anything(), false);
});

test.each(["no-pr", "unauthenticated", "closed", "merged", "failure"])(
  "draft toggle handles %s without changing state",
  async (scenario) => {
    const github = createGitHubReviewSession();
    if (scenario === "unauthenticated") github.auth.isAuthenticated = false;
    if (scenario === "closed") github.pullRequest.state = "closed";
    if (scenario === "merged") github.pullRequest.isMerged = true;
    const setPullRequestDraft = vi.fn(async () => {
      throw new Error("403");
    });
    const tree = render(
      <DiffdiffApp
        {...createAppProps({
          initialSession: createPreparedSession({
            github: scenario === "no-pr" ? undefined : github,
          }),
          setPullRequestDraft,
        })}
      />,
    );
    emitKey({ name: "space", sequence: " " });
    await emitAsyncKey({ name: "d", shift: true });
    expect(setPullRequestDraft).toHaveBeenCalledTimes(scenario === "failure" ? 1 : 0);
    if (scenario === "failure")
      expect(getAppText(tree)).toContain("Unable to change pull request draft status");
  },
);

test("reviewer picker filters display names and usernames, retains hidden selections, and explicitly submits", async () => {
  const github = createGitHubReviewSession();
  github.pullRequest.reviewRequests = [
    { kind: "user", label: "existing" },
    { kind: "team", label: "owners" },
  ];
  const requestReviewers = vi.fn(async () => undefined);
  const refreshed = createPreparedSession({
    github: {
      ...github,
      pullRequest: {
        ...github.pullRequest,
        reviewRequests: [
          ...github.pullRequest.reviewRequests,
          { kind: "user", label: "alice" },
          { kind: "user", label: "bob" },
        ],
      },
    },
  });
  const tree = render(
    <DiffdiffApp
      {...createReviewerAppProps({
        initialSession: createPreparedSession({ github }),
        requestReviewers,
        loadSession: vi.fn(async () => refreshed),
      })}
    />,
  );
  emitKey({ name: "space", sequence: " " });
  expect(getAppText(tree)).toContain("Request reviewers");
  await emitAsyncKey({ name: "w" });
  expect(getAppText(tree)).toContain("Suggested · past commits and past reviews");
  emitText("ALICE");
  expect(getAppText(tree)).toContain("1 matching users");
  emitKey({ name: "return" });
  expect(requestReviewers).not.toHaveBeenCalled();
  for (let index = 0; index < 5; index++) emitKey({ name: "backspace" });
  emitText("Robert");
  expect(getAppText(tree)).toContain("1 matching users");
  emitKey({ name: "return" });
  expect(getAppText(tree)).toContain("2 selected");
  expect(tree.root.findByType(ReviewerPickerModal).props.picker.selected).toEqual(
    new Set(["alice", "bob"]),
  );
  await emitAsyncKey({ ctrl: true, name: "s" });
  expect(requestReviewers).toHaveBeenCalledExactlyOnceWith(github, ["alice", "bob"]);
  expect(tree.root.findAllByType(ReviewerPickerModal)).toHaveLength(0);
  expect(getAppText(tree)).toContain("Requested reviews from alice, bob.");
});

test("reviewer picker can be opened from the command palette and canceled without writes", async () => {
  const props = createReviewerAppProps();
  const tree = render(<DiffdiffApp {...props} />);
  emitKey({ ctrl: true, name: "p" });
  emitText("request reviewers");
  await emitAsyncKey({ name: "return" });
  expect(tree.root.findAllByType(ReviewerPickerModal)).toHaveLength(1);
  emitKey({ name: "return" });
  emitKey({ name: "escape" });
  expect(props.requestReviewers).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("No requests sent");
});

test("reviewer picker puts requested users first and selects the focused user in that order", async () => {
  const github = createGitHubReviewSession();
  github.pullRequest.reviewRequests = [
    { kind: "user", label: "EXISTING" },
    { kind: "user", label: "BOB" },
    { kind: "team", label: "alice" },
  ];
  const props = createReviewerAppProps({ initialSession: createPreparedSession({ github }) });
  const tree = render(<DiffdiffApp {...props} />);
  await openReviewerPicker();
  const modalText = () => getAppText(tree);
  const expectRequestedFirst = () => {
    const text = modalText();
    expect(text.indexOf("@bob")).toBeLessThan(text.indexOf("@existing"));
    expect(text.indexOf("@existing")).toBeLessThan(text.indexOf("@alice"));
  };
  expectRequestedFirst();
  emitKey({ name: "return" });
  expect(tree.root.findByType(ReviewerPickerModal).props.picker.selected.size).toBe(0);
  emitText("Robert");
  expect(modalText()).toContain("1 matching users");
  expect(modalText()).toContain("@bob");
  for (let index = 0; index < 6; index++) emitKey({ name: "backspace" });
  await emitAsyncKey({ ctrl: true, name: "r" });
  expectRequestedFirst();
  emitKey({ name: "down" });
  emitKey({ name: "return" });
  expect(tree.root.findByType(ReviewerPickerModal).props.picker.selected.size).toBe(0);
  emitKey({ name: "down" });
  emitKey({ name: "return" });
  expect(tree.root.findByType(ReviewerPickerModal).props.picker.selected).toEqual(
    new Set(["alice"]),
  );
  await emitAsyncKey({ ctrl: true, name: "s" });
  expect(props.requestReviewers).toHaveBeenCalledExactlyOnceWith(github, ["alice"]);
});

test("reviewer picker marks existing requests and does not select or resend them", async () => {
  const github = createGitHubReviewSession();
  github.pullRequest.reviewRequests = [{ kind: "user", label: "EXISTING" }];
  const props = createReviewerAppProps({ initialSession: createPreparedSession({ github }) });
  const tree = render(<DiffdiffApp {...props} />);
  await openReviewerPicker();
  emitText("existing");
  expect(getAppText(tree)).toContain("Requested");
  emitKey({ name: "return" });
  await emitAsyncKey({ ctrl: true, name: "s" });
  expect(tree.root.findByType(ReviewerPickerModal).props.picker.selected.size).toBe(0);
  expect(props.requestReviewers).not.toHaveBeenCalled();
});

test("reviewer picker handles no matches and treats shortcut letters and digits as filter text", async () => {
  const props = createReviewerAppProps();
  const tree = render(<DiffdiffApp {...props} />);
  await openReviewerPicker();
  emitText("qjkm123");
  expect(getAppText(tree)).toContain("No reviewers match this filter");
  expect(tree.root.findByType(ReviewerPickerModal).props.picker.input.value).toBe("qjkm123");
  await emitAsyncKey({ name: "return" });
  expect(props.requestReviewers).not.toHaveBeenCalled();
});

test("reviewer picker retains selection on mutation failure and can retry", async () => {
  const requestReviewers = vi
    .fn()
    .mockRejectedValueOnce(new Error("403 forbidden"))
    .mockResolvedValueOnce(undefined);
  const tree = render(<DiffdiffApp {...createReviewerAppProps({ requestReviewers })} />);
  await openReviewerPicker();
  emitKey({ name: "return" });
  await emitAsyncKey({ ctrl: true, name: "s" });
  expect(getAppText(tree)).toContain("Your selection is preserved");
  expect(tree.root.findByType(ReviewerPickerModal).props.picker.selected.size).toBe(1);
  await emitAsyncKey({ ctrl: true, name: "s" });
  expect(requestReviewers).toHaveBeenCalledTimes(2);
  expect(tree.root.findAllByType(ReviewerPickerModal)).toHaveLength(0);
});

test("reviewer picker blocks duplicate submissions but Esc backgrounds requests", async () => {
  const pending = createDeferred<void>();
  const requestReviewers = vi.fn(() => pending.promise);
  const tree = render(<DiffdiffApp {...createReviewerAppProps({ requestReviewers })} />);
  await openReviewerPicker();
  emitKey({ name: "return" });
  emitKey({ ctrl: true, name: "s" });
  emitKey({ ctrl: true, name: "s" });
  emitKey({ name: "escape" });
  expect(requestReviewers).toHaveBeenCalledTimes(1);
  expect(getAppText(tree)).toContain("Requesting reviewers in the background");
  expect(getAppText(tree)).not.toContain("Filter by name or username");
  await act(async () => pending.resolve());
});

test("reviewer picker retries failed candidate loads and explains unavailable suggestions", async () => {
  const listReviewerCandidates = vi
    .fn()
    .mockRejectedValueOnce(new Error("403 forbidden"))
    .mockResolvedValueOnce({ users: [{ login: "alice" }], recommendationsUnavailable: true });
  const tree = render(<DiffdiffApp {...createReviewerAppProps({ listReviewerCandidates })} />);
  await openReviewerPicker();
  expect(getAppText(tree)).toContain("Press ctrl+r to retry");
  await emitAsyncKey({ ctrl: true, name: "r" });
  expect(getAppText(tree)).toContain("GitHub suggestions unavailable");
  expect(getAppText(tree)).toContain("@alice");
});

test("reviewer picker ignores canceled candidate loads when reopened", async () => {
  const pending =
    createDeferred<import("@madisonbullard/diffdiff-core").GitHubReviewerCandidates>();
  const listReviewerCandidates = vi
    .fn()
    .mockImplementationOnce(() => pending.promise)
    .mockResolvedValueOnce({ users: [{ login: "new-user" }], recommendationsUnavailable: false });
  const tree = render(<DiffdiffApp {...createReviewerAppProps({ listReviewerCandidates })} />);
  await openReviewerPicker();
  emitKey({ name: "escape" });
  await openReviewerPicker();
  await act(async () =>
    pending.resolve({ users: [{ login: "old-user" }], recommendationsUnavailable: false }),
  );
  expect(getAppText(tree)).toContain("@new-user");
  expect(getAppText(tree)).not.toContain("@old-user");
});

test("confirmed reviewer requests survive a failed session refresh", async () => {
  const github = createGitHubReviewSession();
  github.pullRequest.reviewRequests = [{ kind: "team", label: "owners" }];
  const props = createReviewerAppProps({
    initialSession: createPreparedSession({ github }),
    loadSession: vi.fn(async () => {
      throw new Error("offline");
    }),
  });
  const tree = render(<DiffdiffApp {...props} />);
  await openReviewerPicker();
  emitKey({ name: "return" });
  await emitAsyncKey({ ctrl: true, name: "s" });
  expect(getAppText(tree)).toContain("Requested reviews, but unable to refresh");
  await openReviewerPicker();
  const modal = tree.root.findByType(ReviewerPickerModal);
  expect(modal.props.requests).toEqual([
    { kind: "team", label: "owners" },
    { kind: "user", label: "alice", url: undefined },
  ]);
  expect(getAppText(tree)).toContain("Requested");
});

test("a comparison switch invalidates pending reviewer discovery", async () => {
  const pending =
    createDeferred<import("@madisonbullard/diffdiff-core").GitHubReviewerCandidates>();
  const nextSession = createPreparedSession({
    github: createGitHubReviewSession({
      pullRequest: {
        ...createGitHubReviewSession().pullRequest,
        number: 43,
        url: "https://github.com/diffdiff/diffdiff/pull/43",
      },
    }),
  });
  const props = createReviewerAppProps({
    listReviewerCandidates: vi.fn(() => pending.promise),
    loadSession: vi.fn(async () => nextSession),
  });
  const tree = render(<DiffdiffApp {...props} />);
  await openReviewerPicker();
  emitKey({ name: "escape" });
  await emitAsyncKey({ shift: true, name: "r" });
  await act(async () =>
    pending.resolve({ users: [{ login: "stale-user" }], recommendationsUnavailable: false }),
  );
  expect(getAppText(tree)).toContain("PR #43");
  expect(tree.root.findAllByType(ReviewerPickerModal)).toHaveLength(0);
  expect(props.requestReviewers).not.toHaveBeenCalled();
});

test("reviewer picker is gated for non-PR, unauthenticated, and closed comparisons", async () => {
  for (const github of [
    undefined,
    createGitHubReviewSession({ auth: { host: "github.com", isAuthenticated: false } }),
    {
      ...createGitHubReviewSession(),
      pullRequest: { ...createGitHubReviewSession().pullRequest, state: "closed" as const },
    },
  ]) {
    const props = createReviewerAppProps({ initialSession: createPreparedSession({ github }) });
    const tree = render(<DiffdiffApp {...props} />);
    await openReviewerPicker();
    expect(tree.root.findAllByType(ReviewerPickerModal)).toHaveLength(0);
    expect(props.listReviewerCandidates).not.toHaveBeenCalled();
    act(() => tree.unmount());
    registeredKeyboardHandlers.clear();
  }
});

test("keeps the diff scrollbox unfocused so arrow keys are handled only by the keymap", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);

  emitKey({ name: "l" });
  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);

  emitKey({ name: "escape" });
  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);
});

test("opens the command palette with ctrl+p and runs the selected command", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "p" });

  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);
  expect(getAppText(tree)).toContain("Commands");

  emitText("list");
  emitKey({ name: "return" });

  expect(getAppText(tree)).toContain("Compare");
  expect(getAppText(tree)).toContain("Working tree");
});

test("keeps command-palette typing isolated from global shortcuts", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "p" });
  emitKey({ shift: true, name: "/", sequence: "?" });

  expect(getAppText(tree)).toContain("Commands");
  expect(getAppText(tree)).not.toContain("Keyboard Shortcuts");
  expect(getAppText(tree)).toContain('Filtering commands for "?".');
});

test("derives help labels from the resolved live keymap", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialUserKeymapConfig: {
          diff: {
            l: "no_op",
            z: "comparison.list",
          },
        },
      })}
    />,
  );

  emitKey({ shift: true, name: "/", sequence: "?" });

  expect(getAppText(tree)).toContain("Keys");
  expect(getAppText(tree)).toContain("z / ctrl+x l / space l");
});

test("opens help when opentui reports a raw question-mark key", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "?", sequence: "?" });

  expect(getAppText(tree)).toContain("Keys");
  expect(getAppText(tree)).toContain("Resolved bindings");
  expect(getAppText(tree)).not.toContain("Opened help.");
});

test("closing Keys leaves the last outcome unchanged", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "?", sequence: "?" });
  emitKey({ name: "escape" });
  expect(getAppText(tree)).toContain("Ready.");
  expect(getAppText(tree)).not.toContain("Search keys");
});

test("treats j as query text inside the command palette", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "p" });
  emitKey({ name: "j", sequence: "j" });

  expect(getAppText(tree)).toContain('Filtering commands for "j".');
});

test("supports command-style line jumps inside the command palette", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "p" });
  emitText("alpha");
  emitKey({ super: true, name: "left" });
  emitText("z");
  emitKey({ super: true, name: "right" });
  emitText("!");

  expect(getAppText(tree)).toContain('Filtering commands for "zalpha!".');
});

test("supports word jumps and mid-string backspace inside the command palette", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "p" });
  emitText("alpha beta");
  emitKey({ super: true, name: "left" });
  emitKey({ meta: true, name: "right" });
  emitText(" big");
  emitKey({ meta: true, name: "left" });
  emitKey({ name: "backspace" });

  expect(getAppText(tree)).toContain('Filtering commands for "alphabig beta".');
});

test("supports cmd+backspace line deletion inside the command palette", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "p" });
  emitText("alpha beta");
  emitKey({ super: true, name: "backspace" });

  expect(getAppText(tree)).toContain("Search commands");
  expect(getAppText(tree)).not.toContain('Filtering commands for "alpha beta".');
});

test("closes nested list filters back to the list modal", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "l" });
  emitKey({ name: "f", sequence: "f" });

  expect(getAppText(tree)).toContain("toggle");
  expect(getAppText(tree)).not.toContain(
    "Browse working tree changes, branches, and open pull requests.",
  );

  emitKey({ name: "escape" });

  expect(getAppText(tree)).not.toContain("Filters");
  expect(getAppText(tree)).toContain("Compare");
  expect(getAppText(tree)).toContain("Branches");
});

test("uses modifier shortcuts to enable and disable all list filters", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "l" });
  emitKey({ name: "f", sequence: "f" });
  emitKey({ shift: true, name: "space", sequence: " " });

  expect(getAppText(tree)).toContain("Enabled all list filters.");

  emitKey({ meta: true, name: "space", sequence: " " });

  expect(getAppText(tree)).toContain("Disabled all list filters.");
});

test("runs leader key commands with ctrl+x", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ ctrl: true, name: "x" });

  expect(getAppText(tree)).toContain("Leader mode active. Awaiting next key.");

  emitKey({ name: "l", sequence: "l" });

  expect(getAppText(tree)).toContain("Compare");
  expect(getAppText(tree)).toContain("Working tree");
});

test("jumps to a diff line with a count through the in-file prefix one-third down the viewport", () => {
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const fileCardYs = [0];
  let fileCardRefIndex = 0;
  let selectedRowRefIndex = 0;
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [
            createPreparedFile({
              lineNumberWidth: 2,
              sideBySideRows: [
                {
                  kind: "hunk",
                  segments: [{ text: "@@ -11 +11 @@" }],
                },
                {
                  kind: "line",
                  left: {
                    kind: "context",
                    lineNumber: 11,
                    segments: [{ text: "const target = 11;" }],
                  },
                  right: {
                    kind: "context",
                    lineNumber: 11,
                    segments: [{ text: "const target = 11;" }],
                  },
                },
              ],
              unifiedLines: [
                {
                  kind: "hunk",
                  segments: [{ text: "@@ -11 +11 @@" }],
                },
                {
                  kind: "context",
                  oldLineNumber: 11,
                  newLineNumber: 11,
                  segments: [{ text: "const target = 11;" }],
                },
              ],
            }),
          ],
        }),
      })}
    />,
    {
      createNodeMock(element) {
        const props =
          typeof element.props === "object" && element.props != null
            ? (element.props as {
                border?: unknown;
                flexDirection?: unknown;
                gap?: unknown;
                paddingLeft?: unknown;
                width?: unknown;
              })
            : undefined;

        if (element.type === "scrollbox") {
          const scrollbox = createMockScrollbox(false);
          scrollboxes.push(scrollbox);
          return scrollbox;
        }

        if (
          element.type === "box" &&
          Array.isArray(props?.border) &&
          props.border[0] === "left" &&
          props.paddingLeft === 2 &&
          props.flexDirection === "column" &&
          props.gap === 1
        ) {
          return { y: fileCardYs[fileCardRefIndex++] ?? 0 };
        }

        if (element.type === "box" && props?.flexDirection === "row" && props.width === "100%") {
          return { y: [42][selectedRowRefIndex++] ?? 42 };
        }

        if (element.type === "box") {
          return { y: 0 };
        }

        return null;
      },
    },
  );

  scrollboxes[1]?.scrollTo.mockClear();

  emitKey({ name: "1", sequence: "1" });
  emitKey({ name: "1", sequence: "1" });
  emitKey({ name: "s", sequence: "s" });

  expect(getAppText(tree)).toContain("In File mode active. Awaiting next key.");
  expect(getAppText(tree)).toContain("Jump to selected file line");

  emitKey({ name: "s", sequence: "s" });

  expect(getAppText(tree)).toContain("Jumped to src/app.ts:11.");
  // Native line-to-visual-row alignment is covered by the real-layout suite.
});

test("warns when an in-file line jump targets a line missing from the diff", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "1", sequence: "1" });
  emitKey({ name: "1", sequence: "1" });
  emitKey({ name: "s", sequence: "s" });
  emitKey({ name: "s", sequence: "s" });

  expect(getAppText(tree)).toContain("Line 11 is not present in src/app.ts.");
});

test("opens the focused file in the configured editor", async () => {
  const openFileInEditor = vi.fn(async () => undefined);
  const tree = render(<DiffdiffApp {...createAppProps({ openFileInEditor })} />);

  await act(async () => {
    emitKey({ name: "e", sequence: "e" });
    await Promise.resolve();
  });

  expect(openFileInEditor).toHaveBeenCalledWith("/tmp/diffdiff", "src/app.ts");
  expect(getAppText(tree)).toContain("Opened src/app.ts in the editor.");
});

test("surfaces editor launch failures", async () => {
  const openFileInEditor = vi.fn(async () => {
    throw new Error("Set $VISUAL or $EDITOR to open files in an editor.");
  });
  const tree = render(<DiffdiffApp {...createAppProps({ openFileInEditor })} />);

  await act(async () => {
    emitKey({ name: "e", sequence: "e" });
    await Promise.resolve();
  });

  expect(getAppText(tree)).toContain("Set $VISUAL or $EDITOR to open files in an editor.");
});

test("opens the modal picker with space and launches a modal with one key", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "space", sequence: " " });

  expect(getAppText(tree)).toContain("Modal Picker mode active. Awaiting next key.");
  expect(getAppText(tree)).toContain("Press a key to open a modal.");

  emitKey({ name: "l", sequence: "l" });

  expect(getAppText(tree)).toContain("Compare");
  expect(getAppText(tree)).toContain("Working tree");
  expect(getAppText(tree)).not.toContain("Press a key to open a modal.");
});

test("opens the goto picker with g and launches a jump with one key", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "g", sequence: "g" });

  expect(getAppText(tree)).toContain("Goto mode active. Awaiting next key.");
  expect(getAppText(tree)).toContain("Jump to first file");

  emitKey({ name: "e", sequence: "e" });

  expect(getAppText(tree)).toContain("Jumped to the last file.");
  expect(getAppText(tree)).not.toContain("Press a key to jump around the comparison.");
});

test("opens the GitHub PR list on launch when requested", async () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialOptions: {
          base: "origin/main",
          head: "feature/tui",
          initialListMode: "pull-requests",
        },
      })}
    />,
  );

  await act(async () => {
    await Promise.resolve();
  });

  expect(getAppText(tree)).toContain("GitHub PRs");
  expect(getAppText(tree)).toContain("diffdiff/diffdiff");
  expect(getAppText(tree)).toContain("Ship the PR dashboard");
  expect(getAppText(tree)).toContain("octocat");
});

test("opens the GitHub PR list with p", async () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  await emitAsyncKey({ name: "p", sequence: "p" });

  expect(getAppText(tree)).toContain("GitHub PRs");
  expect(getAppText(tree)).toContain("GitHub PRs");
  expect(getAppText(tree)).toContain("Ship the PR dashboard");
});

test("prefetches pull requests on startup", async () => {
  const listGitHubPullRequests = vi.fn(async () => createDashboardPullRequests());

  render(
    <DiffdiffApp
      {...createAppProps({
        listGitHubPullRequests,
      })}
    />,
  );

  await act(async () => {
    await Promise.resolve();
  });

  expect(listGitHubPullRequests).toHaveBeenCalledTimes(1);
});

test("opens the branch list on launch for an empty working tree", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialOptions: {
          base: "HEAD",
          head: "working tree",
        },
        initialSession: createPreparedSession({
          comparison: {
            base: "HEAD",
            baseSha: "1234567",
            head: "working tree",
            headSha: "1234567",
            mode: "working-tree",
            range: "HEAD...working tree",
            usesMergeBase: false,
          },
          commits: [],
          files: [],
          workingTreeSummary: {
            additions: 0,
            deletions: 0,
            filesChanged: 0,
          },
        }),
      })}
    />,
  );

  expect(getAppText(tree)).toContain("Ready.");
  expect(getAppText(tree)).toContain("Compare");
  expect(getAppText(tree)).toContain("Branches");
  expect(getAppText(tree)).toContain("Working tree");
});

test("prefetches branch comparison data on startup", async () => {
  const syncRemotes = vi.fn(async () => undefined);
  const loadComparisonBrowserData = vi.fn(async () => ({
    branches: {
      local: [
        {
          kind: "local" as const,
          name: "feature/dashboard",
          ref: "refs/heads/feature/dashboard",
          sha: "1234567",
          isCurrent: true,
          isDefault: false,
        },
      ],
      remote: [
        {
          kind: "remote" as const,
          name: "origin/feature/dashboard",
          ref: "refs/remotes/origin/feature/dashboard",
          sha: "89abcde",
          remoteName: "origin",
          isCurrent: false,
          isDefault: false,
          pullRequest: {
            number: 73,
            title: "Prefetch list metadata",
            url: "https://github.com/diffdiff/diffdiff/pull/73",
            headRefName: "feature/dashboard",
            baseRefName: "main",
          },
        },
      ],
    },
    commits: [
      {
        sha: "89abcdef01234567",
        shortSha: "89abcde",
        subject: "Prefetch branch list metadata",
        author: "Madison Bullard",
      },
    ],
    workingTreeSummary: {
      additions: 0,
      deletions: 0,
      filesChanged: 0,
    },
  }));
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialOptions: {},
        initialSession: createPreparedSession({
          comparison: {
            base: "HEAD",
            baseSha: "1234567",
            head: "working tree",
            headSha: "1234567",
            mode: "working-tree",
            range: "HEAD...working tree",
            usesMergeBase: false,
          },
          commits: [],
          files: [],
          branches: {
            local: [],
            remote: [],
          },
          workingTreeSummary: {
            additions: 0,
            deletions: 0,
            filesChanged: 0,
          },
        }),
        loadComparisonBrowserData,
        syncRemotes,
      })}
    />,
  );

  await act(async () => {
    await Promise.resolve();
  });

  expect(syncRemotes).toHaveBeenCalledWith("/tmp/diffdiff");
  expect(loadComparisonBrowserData).toHaveBeenCalledWith({});
  expect(getAppText(tree)).toContain("feature/dashboard");
  expect(getAppText(tree)).toContain("(#73)");
});

test("fuzzy searches and opens a selected GitHub pull request", async () => {
  const baseSession = createPreparedSession();
  const nextSession = createPreparedSession({
    comparison: {
      base: "origin/main",
      baseSha: "fedcba0",
      head: "origin/feature/pr-dashboard",
      headSha: "7654321",
      mode: "range",
      range: "origin/main...origin/feature/pr-dashboard",
      usesMergeBase: true,
    },
    github: {
      ...createGitHubReviewSession(),
      pullRequest: {
        ...createGitHubReviewSession()!.pullRequest,
        number: 52,
        title: "Ship the PR dashboard",
      },
    },
    repository: {
      ...baseSession.repository,
      name: "widgets",
      rootPath: "/tmp/widgets",
    },
  });
  const loadSession = vi.fn(async () => nextSession);
  const resolveLaunchTarget = vi.fn(async () => ({
    base: "origin/main",
    head: "origin/feature/pr-dashboard",
    repoPath: "/tmp/widgets",
  }));
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialOptions: {
          base: "origin/main",
          head: "feature/tui",
          initialListMode: "pull-requests",
        },
        loadSession,
        resolveLaunchTarget,
      })}
    />,
  );

  await act(async () => {
    await Promise.resolve();
  });

  emitKey({ name: "/", sequence: "/" });
  emitText("widg");
  await emitAsyncKey({ name: "return" });
  await emitAsyncKey({ name: "return" });

  expect(resolveLaunchTarget).toHaveBeenCalledWith(
    "acme/widgets/52",
    expect.objectContaining({ initialListMode: "pull-requests" }),
  );
  expect(loadSession).toHaveBeenLastCalledWith({
    base: "origin/main",
    head: "origin/feature/pr-dashboard",
    repoPath: "/tmp/widgets",
  });
  expect(getAppText(tree)).toContain("Opened acme/widgets#52.");
});

test("tab switches to the file tree and tree navigation opens files", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "tab", sequence: "\t" });

  expect(getTreeScrollbox(tree).props.focused).toBe(true);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);

  emitKey({ name: "j" });
  expect(getSelectedFileLabel(tree)).toContain("src/utils.ts");

  emitKey({ name: "right" });
  expect(getTreeScrollbox(tree).props.focused).toBe(false);
  expect(getDiffScrollbox(tree).props.focused).toBe(false);
});

test("requests the canonical file reveal for tree selection", () => {
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const fileCardYs = [0, 10];
  let fileCardRefIndex = 0;
  const reveal = vi.spyOn(DiffScrollController.prototype, "revealFile");
  render(<DiffdiffApp {...createAppProps()} />, {
    createNodeMock(element) {
      const props =
        typeof element.props === "object" && element.props != null
          ? (element.props as {
              border?: unknown;
              flexDirection?: unknown;
              gap?: unknown;
              paddingLeft?: unknown;
            })
          : undefined;

      if (element.type === "scrollbox") {
        const scrollbox = createMockScrollbox(false);
        scrollboxes.push(scrollbox);
        return scrollbox;
      }

      if (
        element.type === "box" &&
        Array.isArray(props?.border) &&
        props.border[0] === "left" &&
        props.paddingLeft === 2 &&
        props.flexDirection === "column" &&
        props.gap === 1
      ) {
        return { y: fileCardYs[fileCardRefIndex++] ?? 0 };
      }

      if (element.type === "box") {
        return { y: 0 };
      }

      return null;
    },
  });

  scrollboxes[1]?.scrollTo.mockClear();

  emitKey({ name: "tab", sequence: "\t" });
  emitKey({ name: "j" });

  expect(reveal).toHaveBeenLastCalledWith("src/utils.ts", undefined);
});

test("uses a compact file tree summary when the sidebar is narrow", () => {
  terminalDimensionsState.width = 80;
  const files = [
    createPreparedFile({ additions: 206, deletions: 1 }),
    createPreparedFile({ path: "src/components.tsx", additions: 104, deletions: 3 }),
    createPreparedFile({ path: "src/github-review.tsx", additions: 63, deletions: 35 }),
    createPreparedFile({ path: "src/view-model.ts", additions: 3, deletions: 3 }),
    createPreparedFile({
      path: "tests/__snapshots__/components.test.tsx.snap",
      additions: 219,
      deletions: 0,
    }),
    createPreparedFile({ path: "tests/app.test.tsx", additions: 137, deletions: 5 }),
    createPreparedFile({ path: "tests/components.test.tsx", additions: 41, deletions: 0 }),
    createPreparedFile({ path: "tests/view-model.test.ts", additions: 1, deletions: 0 }),
  ];
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ files }),
        initialReviewCache: {
          collapsedPaths: [],
          selectedFilePath: files[5]!.path,
          reviewedPaths: [files[0]!.path, files[5]!.path],
        },
      })}
    />,
  );

  expect(getAppText(tree)).toContain("2 /8 rev");
  expect(getAppText(tree)).toContain("+774 / -47");
  expect(getAppText(tree)).not.toContain("2 / 8 reviewed");
});

test("restores reviewed files by file fingerprint", () => {
  const initialSession = createPreparedSession({
    files: [
      createPreparedFile(),
      createPreparedFile({
        path: "src/utils.ts",
        patch: "diff --git a/src/utils.ts b/src/utils.ts\n+new",
      }),
    ],
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession,
        initialReviewCache: {
          collapsedPaths: [],
          reviewedFiles: [
            {
              fingerprint: buildReviewedFileFingerprint(initialSession.files[0]!),
              path: initialSession.files[0]!.path,
            },
            {
              fingerprint: "stale-reviewed-file",
              path: initialSession.files[1]!.path,
            },
          ],
          selectedFilePath: initialSession.files[0]!.path,
        },
      })}
    />,
  );

  expect(getAppText(tree)).toContain("1 / 2 reviewed");
  expect(getAppText(tree)).not.toContain("2 / 2 reviewed");
});

test("keeps background file selection stable when modal handlers rerender", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        listGitHubPullRequests: undefined,
        loadComparisonBrowserData: undefined,
      })}
    />,
  );

  expect(getSelectedFileLabel(tree)).toContain("src/app.ts");

  emitKey({ name: "l" });

  emitKey({ name: "j" });

  expect(getSelectedFileLabel(tree)).toContain("src/app.ts");
});

test("starts deleted file diffs collapsed", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [
            createPreparedFile({ path: "src/removed.ts", status: "deleted" }),
            createPreparedFile({ path: "src/app.ts" }),
          ],
        }),
      })}
    />,
  );

  const [deletedCard] = tree.root.findAllByType(FileCard);

  expect(deletedCard?.props.file.path).toBe("src/removed.ts");
  expect(deletedCard?.props.isCollapsed).toBe(true);
});

test("uses a compact header for the sticky diff card and removes top list padding", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  const [firstCard, secondCard] = tree.root.findAllByType(FileCard);
  const contentOptions = getDiffScrollbox(tree).props.contentOptions;

  expect(firstCard?.props.headerVariant).toBe("sticky-compact");
  expect(firstCard?.props.removeTopPadding).toBe(true);
  expect(secondCard?.props.headerVariant).toBeUndefined();
  expect(secondCard?.props.removeTopPadding).toBe(false);
  expect(contentOptions.paddingTop).toBeUndefined();
  expect(contentOptions.paddingLeft).toBe(1);
  expect(contentOptions.gap).toBe(1);
});

test("keeps non-first file headers expanded when selecting a later file", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  emitKey({ name: "j" });

  const [firstCard, secondCard] = tree.root.findAllByType(FileCard);

  expect(firstCard?.props.headerVariant).toBe("sticky-compact");
  expect(secondCard?.props.headerVariant).toBeUndefined();
});

test("uses the canonical file reveal after marking a file reviewed", () => {
  const reveal = vi.spyOn(DiffScrollController.prototype, "revealFile");
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const fileCardYs = [0, 10];
  let fileCardRefIndex = 0;
  const tree = render(<DiffdiffApp {...createAppProps()} />, {
    createNodeMock(element) {
      const props =
        typeof element.props === "object" && element.props != null
          ? (element.props as {
              border?: unknown;
              flexDirection?: unknown;
              gap?: unknown;
              paddingLeft?: unknown;
            })
          : undefined;

      if (element.type === "scrollbox") {
        const scrollbox = createMockScrollbox(false);
        scrollboxes.push(scrollbox);
        return scrollbox;
      }

      if (
        element.type === "box" &&
        Array.isArray(props?.border) &&
        props.border[0] === "left" &&
        props.paddingLeft === 2 &&
        props.flexDirection === "column" &&
        props.gap === 1
      ) {
        return { y: fileCardYs[fileCardRefIndex++] ?? 0 };
      }

      if (element.type === "box") {
        return { y: 0 };
      }

      return null;
    },
  });

  emitKey({ name: "r", sequence: "r" });

  expect(getAppText(tree)).toContain("Reviewed src/app.ts. Jumped to src/utils.ts.");
  expect(reveal).toHaveBeenLastCalledWith("src/utils.ts", undefined);
});

test("refreshes deferred file previews after collapsing a large file above them", async () => {
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const fileCardYs = [0, 80, 90, 100, 110, 120, 130, 140, 150];
  let fileCardRefIndex = 0;
  const files = Array.from({ length: 9 }, (_, index) => {
    const path = `src/file-${index + 1}.ts`;
    return createPreparedFile({
      additions: 1,
      deletions: 0,
      lineNumberWidth: 3,
      path,
      sideBySideRows: [
        {
          kind: "line",
          left: { kind: "empty", segments: [] },
          right: {
            kind: "addition",
            lineNumber: 1,
            segments: [{ text: `split:${path}`, fg: "#3fb950" }],
          },
        },
      ],
      unifiedLines: [
        {
          kind: "addition",
          newLineNumber: 1,
          segments: [{ text: `body:${path}`, fg: "#3fb950" }],
        },
      ],
    });
  });
  files[0] = createPreparedFile({
    additions: 200,
    deletions: 0,
    lineNumberWidth: 3,
    path: "src/file-1.ts",
    sideBySideRows: Array.from({ length: 200 }, (_, index) => ({
      kind: "line" as const,
      left: { kind: "empty" as const, segments: [] },
      right: {
        kind: "addition" as const,
        lineNumber: index + 1,
        segments: [{ text: `split:src/file-1.ts:${index + 1}`, fg: "#3fb950" }],
      },
    })),
    unifiedLines: Array.from({ length: 200 }, (_, index) => ({
      kind: "addition" as const,
      newLineNumber: index + 1,
      segments: [{ text: `body:src/file-1.ts:${index + 1}`, fg: "#3fb950" }],
    })),
  });

  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ files }),
        listGitHubPullRequests: undefined,
        loadComparisonBrowserData: undefined,
      })}
    />,
    {
      createNodeMock(element) {
        const props =
          typeof element.props === "object" && element.props != null
            ? (element.props as {
                border?: unknown;
                flexDirection?: unknown;
                gap?: unknown;
                paddingLeft?: unknown;
              })
            : undefined;

        if (element.type === "scrollbox") {
          const scrollbox = createMockScrollbox(false);
          scrollboxes.push(scrollbox);
          return scrollbox;
        }

        if (
          element.type === "box" &&
          Array.isArray(props?.border) &&
          props.border[0] === "left" &&
          props.paddingLeft === 2 &&
          props.flexDirection === "column" &&
          props.gap === 1
        ) {
          const fileIndex = fileCardRefIndex++;
          return {
            get y() {
              return fileCardYs[fileIndex] ?? 0;
            },
          };
        }

        if (element.type === "box") {
          return { y: 0 };
        }

        return null;
      },
    },
  );

  // Simulate the scroll bar emitting a change so viewport metrics are
  // established with a non-zero height. With file1 expanded the other
  // files are far below the viewport and their bodies are deferred.
  const firstScrollbox = scrollboxes[1]!;
  firstScrollbox.viewport = { height: 40 };
  firstScrollbox.height = 40;
  firstScrollbox.scrollTop = 0;
  firstScrollbox.emitScroll();

  // All file bodies are mounted; native OpenTUI culls off-screen cards.
  expect(getAppText(tree)).toContain("body:src/file-2.ts");

  // After collapsing file-1, the file cards shift up and file-2 moves
  // into the viewport. Simulate the new positions.
  fileCardYs.splice(0, fileCardYs.length, 0, 4, 14, 24, 34, 44, 54, 64, 74);

  emitKey({ ctrl: true, name: "x" });
  await emitAsyncKey({ name: "c", sequence: "c" });

  expect(getAppText(tree)).toContain("Collapsed src/file-1.ts.");
  expect(getAppText(tree)).toContain("body:src/file-2.ts");
});

test("refreshes the comparison with shift+r", async () => {
  const nextSession = createPreparedSession({
    files: [createPreparedFile({ path: "src/next.ts" })],
  });
  const loadSession = vi.fn(async () => nextSession);
  const syncRemotes = vi.fn(async () => undefined);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [createPreparedFile({ path: "src/current.ts" })],
        }),
        loadSession,
        syncRemotes,
      })}
    />,
  );

  await emitAsyncKey({ name: "r", sequence: "R", shift: true });

  expect(syncRemotes).toHaveBeenCalled();
  expect(loadSession).toHaveBeenCalled();
  expect(getAppText(tree)).toContain("Refreshed branches and GitHub data.");
  expect(getAppText(tree)).toContain("src/next.ts");
  expect(getAppText(tree)).not.toContain("src/current.ts");
});

test("falls back to the first file when the selected file disappears during refresh", async () => {
  const nextSession = createPreparedSession({
    files: [
      createPreparedFile({ path: "src/first.ts" }),
      createPreparedFile({ path: "src/second.ts" }),
    ],
  });
  const loadSession = vi.fn(async () => nextSession);
  const syncRemotes = vi.fn(async () => undefined);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [
            createPreparedFile({ path: "src/app.ts" }),
            createPreparedFile({ path: "src/utils.ts" }),
          ],
        }),
        loadSession,
        syncRemotes,
      })}
    />,
  );

  emitKey({ name: "j" });
  expect(getSelectedFileCard(tree).props.file.path).toBe("src/utils.ts");

  await emitAsyncKey({ name: "r", sequence: "R", shift: true });

  expect(getSelectedFileCard(tree).props.file.path).toBe("src/first.ts");
});

test("does not reuse the previous file offset when a branch switch restores a different cached file", async () => {
  const reveal = vi.spyOn(DiffScrollController.prototype, "revealFile");
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const fileCardYs = [10, 110, 15, 115];
  let fileCardRefIndex = 0;
  const nextSession = createPreparedSession({
    files: [
      createPreparedFile({ path: "src/app.ts" }),
      createPreparedFile({ path: "src/utils.ts" }),
    ],
  });
  const loadSession = vi.fn(async () => nextSession);
  vi.spyOn(diffdiffCore, "loadReviewCache").mockResolvedValue({
    collapsedPaths: [],
    reviewedFiles: [],
    selectedFilePath: nextSession.files[1]!.path,
  });

  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [
            createPreparedFile({ path: "src/app.ts" }),
            createPreparedFile({ path: "src/utils.ts" }),
          ],
        }),
        loadSession,
      })}
    />,
    {
      createNodeMock(element) {
        const props =
          typeof element.props === "object" && element.props != null
            ? (element.props as {
                border?: unknown;
                flexDirection?: unknown;
                gap?: unknown;
                paddingLeft?: unknown;
              })
            : undefined;

        if (element.type === "scrollbox") {
          const scrollbox = createMockScrollbox(false);
          scrollboxes.push(scrollbox);
          return scrollbox;
        }

        if (
          element.type === "box" &&
          Array.isArray(props?.border) &&
          props.border[0] === "left" &&
          props.paddingLeft === 2 &&
          props.flexDirection === "column" &&
          props.gap === 1
        ) {
          return { y: fileCardYs[fileCardRefIndex++] ?? 15 };
        }

        if (element.type === "box") {
          return { y: 0 };
        }

        return null;
      },
    },
  );

  scrollboxes[1]!.scrollTop = 50;

  emitKey({ name: "l", sequence: "l" });
  await emitAsyncKey({ name: "w", sequence: "w" });

  expect(getSelectedFileCard(tree).props.file.path).toBe("src/utils.ts");
  expect(reveal).toHaveBeenLastCalledWith("src/utils.ts", undefined);
});

test("does not render the removed key legend", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getAppText(tree)).toContain("? keys");
  expect(getAppText(tree)).not.toContain("show keys");
  expect(getAppText(tree)).not.toContain("j/k move");
});

test("footer advertises the command palette beside the keys hint only where it opens", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);
  const footerHints = () => getAppText(tree).match(/\?\s+keys\s+ctrl\+p\s+commands/u);

  expect(footerHints()).not.toBeNull();

  emitKey({ name: "tab" });
  expect(footerHints()).not.toBeNull();

  emitKey({ ctrl: true, name: "p" });
  expect(getAppText(tree)).toContain("Search commands");
  expect(getAppText(tree)).not.toContain("ctrl+p commands");
});

test("opens diagnostics with bare d", async () => {
  const loadSessionDiagnostics = vi.fn(async () => []);
  const tree = render(<DiffdiffApp {...createAppProps({ loadSessionDiagnostics })} />);

  emitKey({ name: "d", sequence: "d" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(loadSessionDiagnostics).toHaveBeenCalledWith("/Users/test/.diffdiff/logs/log-test.jsonl");
  expect(getAppText(tree)).toContain("Diagnostics");
  expect(getAppText(tree)).toContain("No session events have been recorded yet.");
});

test("requires confirmation before clearing all reviewed files with alt+r", () => {
  const files = [createPreparedFile(), createPreparedFile({ path: "src/utils.ts" })];
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ files }),
        initialReviewCache: {
          collapsedPaths: files.map((file) => file.path),
          selectedFilePath: files[0]!.path,
          reviewedPaths: files.map((file) => file.path),
        },
      })}
    />,
  );

  emitKey({ meta: true, name: "r", sequence: "r" });

  expect(getAppText(tree)).toContain("Clear Review Marks");
  expect(getAppText(tree)).toContain("Remove the reviewed state from 2 files?");
  expect(getAppText(tree)).toContain("2 / 2 reviewed");

  emitKey({ name: "return" });

  expect(getAppText(tree)).toContain("Cleared review marks from 2 files.");
  expect(getAppText(tree)).toContain("0 / 2 reviewed");
});

test("cancels clearing reviewed files from the confirmation modal", () => {
  const files = [createPreparedFile(), createPreparedFile({ path: "src/utils.ts" })];
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ files }),
        initialReviewCache: {
          collapsedPaths: files.map((file) => file.path),
          selectedFilePath: files[0]!.path,
          reviewedPaths: files.map((file) => file.path),
        },
      })}
    />,
  );

  emitKey({ meta: true, name: "r", sequence: "r" });
  emitKey({ name: "escape" });

  expect(getAppText(tree)).toContain("Canceled clearing review marks.");
  expect(getAppText(tree)).toContain("2 / 2 reviewed");
  expect(getAppText(tree)).not.toContain("Clear Review Marks");
});

test("flushes reviewed state to the cache before quitting", async () => {
  const saveReviewCacheSpy = vi.spyOn(diffdiffCore, "saveReviewCache").mockResolvedValue(undefined);
  const onExit = vi.fn();
  const tree = render(<DiffdiffApp {...createAppProps({ onExit })} />);

  emitKey({ name: "x", sequence: "x" });

  await emitAsyncKey({ name: "q", sequence: "q" });

  expect(getAppText(tree)).toContain("1 / 2 reviewed");
  expect(saveReviewCacheSpy).toHaveBeenCalledWith(
    {
      repositoryRootPath: "/tmp/diffdiff",
      base: "origin/main",
      head: "feature/tui",
    },
    expect.objectContaining({
      reviewedFiles: [
        {
          fingerprint: buildReviewedFileFingerprint(createPreparedSession().files[0]!),
          path: "src/app.ts",
        },
      ],
    }),
  );
  expect(saveReviewCacheSpy.mock.invocationCallOrder[0]).toBeLessThan(
    onExit.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(onExit).toHaveBeenCalledTimes(1);
});

test("renders base and head as the header comparison tags", () => {
  const tree = render(<DiffdiffApp {...createAppProps()} />);
  const appText = getAppText(tree);

  expect(appText).toContain("base ← origin/main");
  expect(appText).toContain("head → feature/tui");
  expect(appText).toContain("diffdiff / diffdiff │ base ← origin/main head → feature/tui");
  expect(appText).not.toContain("branch range");
});

test("renders the current branch with the muted gray header badge", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: {
          ...createPreparedSession(),
          repository: {
            kind: "git",
            rootPath: "/tmp/diffdiff",
            name: "diffdiff",
            remotes: [{ name: "origin", fetchUrl: "git@github.com:diffdiff/diffdiff.git" }],
            currentBranch: "feature/current-branch",
            defaultBranch: "main",
          },
        },
      })}
    />,
  );

  const branchBadge = tree.root.find(
    (node) =>
      String(node.type) === "span" &&
      collectInstanceText(node).includes("feature/current-branch") &&
      node.props.bg != null,
  );

  expect(branchBadge.props.fg).toBe(theme.accent);
  expect(branchBadge.props.bg).toBe(theme.surfaceMuted);
});

test("does not duplicate the working tree label in the header", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          comparison: {
            base: "HEAD",
            head: "working tree",
            range: "HEAD...working tree",
            mode: "working-tree",
            usesMergeBase: false,
          },
        }),
      })}
    />,
  );

  expect(getAppText(tree)).toContain("base ← HEAD");
  expect(getAppText(tree)).toContain("head → working tree");
  expect(getAppText(tree).match(/working tree/gu) ?? []).toHaveLength(1);
});

test("shows a copy toast for five seconds after a successful copy", () => {
  vi.useFakeTimers();
  selectionCopyState.copySelection.mockImplementation(
    (_renderer: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
      return true;
    },
  );

  const tree = render(<DiffdiffApp {...createAppProps()} />);

  expect(getAppText(tree)).not.toContain("Copied to clipboard");

  act(() => {
    getRootBox(tree).props.onMouseUp?.();
  });

  expect(getAppText(tree)).toContain("Copied to clipboard");

  act(() => {
    vi.advanceTimersByTime(4999);
  });

  expect(getAppText(tree)).toContain("Copied to clipboard");

  act(() => {
    vi.advanceTimersByTime(1);
  });

  expect(getAppText(tree)).not.toContain("Copied to clipboard");
});

test("shows a persistent error toast until dismissed", async () => {
  const probeFreshness = vi.fn(async () => {
    throw new Error("Unable to refresh git state.");
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        probeFreshness,
      })}
    />,
  );

  await act(async () => {
    rendererState.renderer.emit("blur");
    rendererState.renderer.emit("focus");
  });

  expect(getAppText(tree)).toContain("Unable to refresh git state.");
  expect(getAppText(tree)).not.toContain("An error occurred, open diagnostics (D)");

  emitKey({ name: "j" });

  expect(getAppText(tree)).toContain("Unable to refresh git state.");

  emitKey({ name: "x", sequence: "x" });

  expect(getAppText(tree)).not.toContain("Unable to refresh git state.");
});

test("keeps the footer on the latest status after an error toast is shown", async () => {
  const refreshError = new Error(
    "Request failed due to following response errors:\n - Filepath must be part of pull request",
  );
  const syncRemotes = vi.fn(async () => {
    throw refreshError;
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        syncRemotes,
      })}
    />,
  );

  await emitAsyncKey({ name: "r", sequence: "R", shift: true });

  expect(getAppText(tree)).toContain("Request failed due to following response errors:");

  emitKey({ name: "?", sequence: "?" });
  emitKey({ name: "escape" });
  expect(getAppText(tree)).not.toContain("Search keys");
  expect(getAppText(tree)).toContain("Request failed due to following response errors:");
});

test("keeps errors in the footer until an open modal is dismissed", async () => {
  const probeFreshness = vi.fn(async () => {
    throw new Error("Unable to refresh git state.");
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        probeFreshness,
      })}
    />,
  );

  emitKey({ name: "l", sequence: "l" });

  await act(async () => {
    rendererState.renderer.emit("blur");
    rendererState.renderer.emit("focus");
  });

  expect(getAppText(tree)).toContain("Compare");
  expect(getAppText(tree)).toContain("✗ Unable to refresh git state.");
  expect(getAppText(tree)).not.toContain("esc / x  dismiss");
  emitKey({ name: "escape" });
  expect(getAppText(tree)).toContain("Unable to refresh git state.");
});

test("derives the diagnostics footer hint from the current keymap", async () => {
  const probeFreshness = vi.fn(async () => {
    throw new Error("Unable to refresh git state.");
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialUserKeymapConfig: {
          diff: {
            d: "no_op",
            z: "system.diagnostics",
          },
        },
        probeFreshness,
      })}
    />,
  );

  await act(async () => {
    rendererState.renderer.emit("blur");
    rendererState.renderer.emit("focus");
  });

  expect(getAppText(tree)).not.toContain("An error occurred, open diagnostics (Z)");
});

test("syncs remotes before checking for updates on terminal focus", async () => {
  const syncRemotes = vi.fn(async () => undefined);
  const probeFreshness = vi.fn(async () => ({
    comparisonSummary: undefined,
    hasComparisonUpdates: false,
    hasGitHubUpdates: false,
    nextBaseSha: "fedcba0",
    nextHeadSha: "1234567",
  }));

  render(
    <DiffdiffApp
      {...createAppProps({
        probeFreshness,
        syncRemotes,
      })}
    />,
  );

  await act(async () => {
    rendererState.renderer.emit("blur");
    rendererState.renderer.emit("focus");
  });

  expect(syncRemotes).toHaveBeenCalledWith("/tmp/diffdiff");
  expect(probeFreshness).toHaveBeenCalledTimes(1);
  expect(syncRemotes.mock.invocationCallOrder[0]).toBeLessThan(
    probeFreshness.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
});

test("logs a failed focus sync without an error toast and still checks for updates", async () => {
  const offlineError = new Error(
    "ssh: connect to host github.com port 22: Undefined error: 0\r\nfatal: Could not read from remote repository.",
  );
  const syncRemotes = vi.fn(async () => {
    throw offlineError;
  });
  const probeFreshness = vi.fn(async () => ({
    comparisonSummary: undefined,
    hasComparisonUpdates: false,
    hasGitHubUpdates: false,
  }));
  const logError = vi.spyOn(diffdiffCore, "logDiffdiffError");
  const tree = render(<DiffdiffApp {...createAppProps({ probeFreshness, syncRemotes })} />);

  await act(async () => {
    rendererState.renderer.emit("blur");
    rendererState.renderer.emit("focus");
  });

  expect(logError).toHaveBeenCalledWith(
    "app",
    "focus_remote_sync_failed",
    offlineError,
    expect.objectContaining({ action: "sync-remotes-on-focus" }),
  );
  expect(getAppText(tree)).not.toContain("Could not read from remote repository.");
  expect(probeFreshness).toHaveBeenCalledTimes(1);
});

test("starts commit browsing at the top of the commit list", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          commits: [
            {
              sha: "1111111111111111",
              shortSha: "1111111",
              subject: "Newest commit",
              author: "Top Author",
            },
            {
              sha: "2222222222222222",
              shortSha: "2222222",
              subject: "Older commit",
              author: "Bottom Author",
            },
          ],
        }),
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "tab", sequence: "\t" });

  expect(getAppText(tree)).toContain("Newest commit");
  expect(getAppText(tree)).toContain("Top Author");
  expect(getAppText(tree)).not.toContain("Bottom Author");
});

test("uses leader+j to move through commits while commit search stays focused", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          commits: [
            {
              sha: "1111111111111111",
              shortSha: "1111111",
              subject: "Newest commit",
              author: "Top Author",
            },
            {
              sha: "2222222222222222",
              shortSha: "2222222",
              subject: "Older commit",
              author: "Bottom Author",
            },
          ],
        }),
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "l" });
  emitKey({ name: "/", sequence: "/" });

  emitKey({ ctrl: true, name: "x" });
  emitKey({ name: "j", sequence: "j" });

  expect(getAppText(tree)).toContain("Bottom Author");
  expect(
    tree.root.findAll(
      (node) =>
        String(node.type) === "span" &&
        node.props.bg === theme.accent &&
        node.props.attributes === BLINK_TEXT_ATTRIBUTE,
    ),
  ).not.toHaveLength(0);
});

test("loads comparison browser data only when the branch list opens", async () => {
  const session = createPreparedSession();
  const loadComparisonBrowserData = vi.fn(async () => ({
    branches: session.branches,
    commits: session.commits,
    workingTreeSummary: session.workingTreeSummary,
  }));
  const syncRemotes = vi.fn(async () => undefined);
  render(<DiffdiffApp {...createAppProps({ loadComparisonBrowserData, syncRemotes })} />);
  expect(loadComparisonBrowserData).not.toHaveBeenCalled();
  expect(syncRemotes).not.toHaveBeenCalled();
  await emitAsyncKey({ name: "l" });
  expect(loadComparisonBrowserData).toHaveBeenCalledTimes(1);
  expect(syncRemotes).toHaveBeenCalledTimes(1);
});

test("shows an animated event log entry while loading a new base branch", async () => {
  vi.useFakeTimers();
  const nextSession = createPreparedSession({
    comparison: {
      base: "main",
      head: "feature/tui",
      range: "main...feature/tui",
      mode: "range",
      usesMergeBase: true,
    },
  });
  const deferredSession = createDeferred<PreparedReviewSession>();
  const loadSession = vi.fn(() => deferredSession.promise);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession(),
        loadSession,
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "j" });
  emitKey({ name: "b" });

  expect(loadSession).toHaveBeenCalledWith({
    base: "main",
    head: "feature/tui",
  });
  expect(getAppText(tree)).toContain("Updating base to main...");
  expect(getAppText(tree)).not.toContain("Loading...");
  const footerEventBox = tree.root.find(
    (node) =>
      String(node.type) === "box" &&
      node.props.flexGrow === 1 &&
      collectInstanceText(node).includes("Updating base to main..."),
  );

  expect(footerEventBox.props.flexDirection).toBe("row");
  expect(footerEventBox.props.justifyContent).toBe("flex-end");

  act(() => {
    vi.advanceTimersByTime(80);
  });

  expect(getAppText(tree)).toContain("Updating base to main...");

  deferredSession.resolve(nextSession);
  await act(async () => {
    await deferredSession.promise;
  });

  expect(getAppText(tree)).not.toContain("Updating base to main...");
});

test("shows a files changed header indicator until refresh reloads the session", async () => {
  vi.useFakeTimers();
  const nextSession = createPreparedSession({
    repository: {
      kind: "git",
      rootPath: "/tmp/diffdiff",
      name: "diffdiff",
      remotes: [{ name: "origin", fetchUrl: "git@github.com:diffdiff/diffdiff.git" }],
      currentBranch: "feature/fresh",
      defaultBranch: "main",
    },
    comparison: {
      base: "origin/main",
      baseSha: "fedcba9",
      head: "feature/tui",
      headSha: "1234567",
      range: "origin/main...feature/tui",
      mode: "range",
      usesMergeBase: true,
    },
    files: [createPreparedFile({ path: "src/fresh.ts" })],
    branches: {
      local: [
        {
          kind: "local",
          name: "feature/fresh",
          ref: "refs/heads/feature/fresh",
          sha: "1234abc",
          isCurrent: true,
          isDefault: false,
        },
        {
          kind: "local",
          name: "main",
          ref: "refs/heads/main",
          sha: "7654321",
          isCurrent: false,
          isDefault: true,
        },
      ],
      remote: [
        {
          kind: "remote",
          name: "origin/feature/fresh",
          ref: "refs/remotes/origin/feature/fresh",
          sha: "fedcba9",
          remoteName: "origin",
          isCurrent: false,
          isDefault: false,
        },
        {
          kind: "remote",
          name: "origin/main",
          ref: "refs/remotes/origin/main",
          sha: "fedcba0",
          remoteName: "origin",
          isCurrent: false,
          isDefault: true,
        },
      ],
    },
  });
  const probeFreshness = vi.fn(async () => ({
    comparisonSummary: {
      additions: 3,
      deletions: 1,
      filesChanged: 1,
    },
    hasComparisonUpdates: true,
    hasGitHubUpdates: false,
    nextBaseSha: "fedcba9",
    nextHeadSha: "1234567",
  }));
  const syncRemotes = vi.fn(async () => undefined);
  const loadComparisonBrowserData = vi.fn(async () => ({
    branches: createPreparedSession().branches,
    commits: createPreparedSession().commits,
    workingTreeSummary: createPreparedSession().workingTreeSummary,
  }));
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        loadComparisonBrowserData,
        loadSession,
        probeFreshness,
        syncRemotes,
      })}
    />,
  );

  expect(getAppText(tree)).not.toContain("1 file changed");

  await act(async () => {
    vi.advanceTimersByTime(5_000);
  });

  expect(probeFreshness).toHaveBeenCalledTimes(1);
  expect(syncRemotes).not.toHaveBeenCalled();
  expect(loadComparisonBrowserData).not.toHaveBeenCalled();
  expect(loadSession).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("1 file changed");
  expect(getAppText(tree)).toContain("feature/tui");
  expect(getAppText(tree)).not.toContain("feature/fresh");

  await act(async () => {
    vi.advanceTimersByTime(5_000);
  });

  expect(probeFreshness).toHaveBeenCalledTimes(2);
  expect(getAppText(tree)).toContain("1 file changed");

  await emitAsyncKey({ name: "r", sequence: "R", shift: true });

  expect(syncRemotes).toHaveBeenCalledWith("/tmp/diffdiff");
  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
  expect(getAppText(tree)).toContain("feature/fresh");
  expect(getAppText(tree)).not.toContain("1 file changed");
});

test("keeps a detected update visible while the remote cannot be reached", async () => {
  vi.useFakeTimers();
  const probeFreshness = vi.fn(
    async (): Promise<ReviewSessionFreshnessResult> => ({
      hasComparisonUpdates: false,
      hasGitHubUpdates: false,
    }),
  );
  probeFreshness
    .mockResolvedValueOnce({
      comparisonSummary: { additions: 3, deletions: 1, filesChanged: 1 },
      hasComparisonUpdates: true,
      hasGitHubUpdates: false,
    })
    .mockResolvedValueOnce({
      hasComparisonUpdates: false,
      hasGitHubUpdates: false,
      remoteUnreachable: true,
    });
  const tree = render(<DiffdiffApp {...createAppProps({ probeFreshness })} />);
  const poll = () =>
    act(async () => {
      vi.advanceTimersByTime(5_000);
    });

  await poll();
  expect(getAppText(tree)).toContain("1 file changed");

  await poll();
  expect(getAppText(tree)).toContain("1 file changed");
  expect(getAppText(tree)).not.toContain("up to date");

  await poll();
  expect(probeFreshness).toHaveBeenCalledTimes(3);
  expect(getAppText(tree)).toContain("Current comparison is up to date.");
  expect(getAppText(tree)).not.toContain("1 file changed");
});

test("still shows new PR activity while the remote cannot be reached", async () => {
  vi.useFakeTimers();
  const probeFreshness = vi.fn(
    async (): Promise<ReviewSessionFreshnessResult> => ({
      githubUpdateReasons: [{ actors: ["octocat"], code: "review-approved" }],
      hasComparisonUpdates: false,
      hasGitHubUpdates: true,
      remoteUnreachable: true,
    }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        probeFreshness,
      })}
    />,
  );

  await act(async () => {
    vi.advanceTimersByTime(5_000);
  });

  expect(tree.root.findAll((node) => node.props.label === "approved")).toHaveLength(1);
  expect(getAppText(tree)).toContain("Approved by octocat. Press Shift+R to refresh.");
});

test("keeps the PR refresh badge visible after an auto-refresh probe until the session changes", async () => {
  vi.useFakeTimers();
  const probeFreshness = vi.fn(
    async (): Promise<ReviewSessionFreshnessResult> => ({
      comparisonSummary: undefined,
      githubUpdateReasons: [{ code: "new-commits", count: 1 }],
      hasComparisonUpdates: true,
      hasGitHubUpdates: true,
      nextBaseSha: "fedcba9",
      nextHeadSha: "7654321",
    }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadComparisonBrowserData: undefined,
        probeFreshness,
      })}
    />,
  );

  expect(tree.root.findAll((node) => node.props.label === "updates + PR")).toHaveLength(0);

  await act(async () => {
    vi.advanceTimersByTime(5_000);
    await Promise.resolve();
  });

  expect(probeFreshness).toHaveBeenCalledTimes(1);
  expect(tree.root.findAll((node) => node.props.label === "updates + PR")).toHaveLength(1);
});

test("shows specific PR approval refresh messaging", async () => {
  vi.useFakeTimers();
  const probeFreshness = vi.fn(
    async (): Promise<ReviewSessionFreshnessResult> => ({
      comparisonSummary: undefined,
      githubUpdateReasons: [{ actors: ["octocat"], code: "review-approved" }],
      hasComparisonUpdates: false,
      hasGitHubUpdates: true,
      nextBaseSha: "fedcba0",
      nextHeadSha: "1234567",
    }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        probeFreshness,
      })}
    />,
  );

  await act(async () => {
    vi.advanceTimersByTime(5_000);
    await Promise.resolve();
  });

  expect(tree.root.findAll((node) => node.props.label === "approved")).toHaveLength(1);
  expect(getAppText(tree)).toContain("Approved by octocat. Press Shift+R to refresh.");
});

test("derives refresh status messaging from the resolved live keymap", async () => {
  vi.useFakeTimers();
  const probeFreshness = vi.fn(
    async (): Promise<ReviewSessionFreshnessResult> => ({
      comparisonSummary: undefined,
      githubUpdateReasons: [{ actors: ["octocat"], code: "review-approved" }],
      hasComparisonUpdates: false,
      hasGitHubUpdates: true,
      nextBaseSha: "fedcba0",
      nextHeadSha: "1234567",
    }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        initialUserKeymapConfig: {
          diff: {
            "shift+r": "no_op",
            z: "comparison.refresh",
          },
        },
        probeFreshness,
      })}
    />,
  );

  await act(async () => {
    vi.advanceTimersByTime(5_000);
    await Promise.resolve();
  });

  expect(getAppText(tree)).toContain("Approved by octocat. Press Z to refresh.");
});

test("combines diff and PR refresh details in the status message", async () => {
  vi.useFakeTimers();
  const probeFreshness = vi.fn(
    async (): Promise<ReviewSessionFreshnessResult> => ({
      comparisonSummary: {
        additions: 3,
        deletions: 1,
        filesChanged: 1,
      },
      githubUpdateReasons: [{ code: "checks-changed", from: "pending", to: "success" }],
      hasComparisonUpdates: true,
      hasGitHubUpdates: true,
      nextBaseSha: "fedcba9",
      nextHeadSha: "1234567",
    }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        probeFreshness,
      })}
    />,
  );

  await act(async () => {
    vi.advanceTimersByTime(5_000);
    await Promise.resolve();
  });

  expect(tree.root.findAll((node) => node.props.label === "1 file changed + PR")).toHaveLength(1);
  expect(getAppText(tree)).toContain(
    "1 file changed. Checks changed from pending to success. Press Shift+R to refresh.",
  );
});

test("adds the refresh hint when an out-of-date branch selection cannot be opened", async () => {
  const loadSession = vi.fn(async (options: LaunchOptions) => {
    if (options.head === "origin/feature/tui") {
      throw new Error(
        "Unable to resolve head ref 'origin/feature/tui'. Remote branch 'origin/feature/tui' is no longer available locally or on remote 'origin'. If this comparison came from a pull request, the branch may have been deleted after the pull request was merged or closed.",
      );
    }

    return createPreparedSession();
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession(),
        loadSession,
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "k" });
  await emitAsyncKey({ name: "return" });

  expect(getAppText(tree)).toContain(
    "Unable to resolve head ref 'origin/feature/tui'. Press Shift+R to refresh and try again.",
  );
});

test("preserves the selected file scroll position when refreshing", async () => {
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const fileCardYs = [10, 110, 15, 115];
  let fileCardRefIndex = 0;
  const nextSession = createPreparedSession({ github: createGitHubReviewSession() });
  const syncRemotes = vi.fn(async () => undefined);
  const loadSession = vi.fn(async () => nextSession);

  render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        syncRemotes,
      })}
    />,
    {
      createNodeMock(element) {
        const props =
          typeof element.props === "object" && element.props != null
            ? (element.props as {
                border?: unknown;
                flexDirection?: unknown;
                gap?: unknown;
                paddingLeft?: unknown;
              })
            : undefined;

        if (element.type === "scrollbox") {
          const scrollbox = createMockScrollbox(false);
          scrollboxes.push(scrollbox);
          return scrollbox;
        }

        if (
          element.type === "box" &&
          Array.isArray(props?.border) &&
          props.border[0] === "left" &&
          props.paddingLeft === 2 &&
          props.flexDirection === "column" &&
          props.gap === 1
        ) {
          return { y: fileCardYs[fileCardRefIndex++] ?? 15 };
        }

        if (element.type === "box") {
          return { y: 0 };
        }

        return null;
      },
    },
  );

  scrollboxes[1]!.scrollTop = 50;

  await emitAsyncKey({ name: "r", sequence: "R", shift: true });

  expect(syncRemotes).toHaveBeenCalledWith("/tmp/diffdiff");
  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
  expect(scrollboxes[1]?.scrollTop).toBe(50);
});

test("preserves the selected file alignment when refreshing with zero relative scroll offset", async () => {
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const fileCardYs = [10, 110, 15, 115];
  let fileCardRefIndex = 0;
  const nextSession = createPreparedSession({ github: createGitHubReviewSession() });
  const syncRemotes = vi.fn(async () => undefined);
  const loadSession = vi.fn(async () => nextSession);

  render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        syncRemotes,
      })}
    />,
    {
      createNodeMock(element) {
        const props =
          typeof element.props === "object" && element.props != null
            ? (element.props as {
                border?: unknown;
                flexDirection?: unknown;
                gap?: unknown;
                paddingLeft?: unknown;
              })
            : undefined;

        if (element.type === "scrollbox") {
          const scrollbox = createMockScrollbox(false);
          scrollboxes.push(scrollbox);
          return scrollbox;
        }

        if (
          element.type === "box" &&
          Array.isArray(props?.border) &&
          props.border[0] === "left" &&
          props.paddingLeft === 2 &&
          props.flexDirection === "column" &&
          props.gap === 1
        ) {
          return { y: fileCardYs[fileCardRefIndex++] ?? 15 };
        }

        if (element.type === "box") {
          return { y: 0 };
        }

        return null;
      },
    },
  );

  scrollboxes[1]!.scrollTop = 10;

  await emitAsyncKey({ name: "r", sequence: "R", shift: true });

  expect(syncRemotes).toHaveBeenCalledWith("/tmp/diffdiff");
  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
  expect(scrollboxes[1]?.scrollTop).toBe(10);
});

test("auto-refreshes working tree sessions when local changes are detected", async () => {
  vi.useFakeTimers();
  const initialSession = createPreparedSession({
    comparison: {
      base: "HEAD",
      baseSha: "1234567",
      head: "working tree",
      headSha: "1234567",
      range: "HEAD...working tree",
      mode: "working-tree",
      usesMergeBase: false,
    },
    files: [createPreparedFile({ path: "src/old.ts" })],
    repository: {
      kind: "git",
      rootPath: "/tmp/diffdiff",
      name: "diffdiff",
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github.com:diffdiff/diffdiff.git",
          forge: {
            forge: "github",
            host: "github.com",
            owner: "diffdiff",
            repo: "diffdiff",
          },
        },
      ],
      currentForgeRepository: {
        forge: "github",
        host: "github.com",
        owner: "diffdiff",
        repo: "diffdiff",
      },
      currentBranch: "feature/tui",
      defaultBranch: "main",
    },
  });
  const nextSession = createPreparedSession({
    comparison: {
      base: "HEAD",
      baseSha: "89abcde",
      head: "working tree",
      headSha: "89abcde",
      range: "HEAD...working tree",
      mode: "working-tree",
      usesMergeBase: false,
    },
    files: [createPreparedFile({ path: "src/new.ts" })],
    repository: {
      kind: "git",
      rootPath: "/tmp/diffdiff",
      name: "diffdiff",
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github.com:diffdiff/diffdiff.git",
          forge: {
            forge: "github",
            host: "github.com",
            owner: "diffdiff",
            repo: "diffdiff",
          },
        },
      ],
      currentForgeRepository: {
        forge: "github",
        host: "github.com",
        owner: "diffdiff",
        repo: "diffdiff",
      },
      currentBranch: "feature/tui",
      defaultBranch: "main",
    },
  });
  const probeFreshness = vi.fn(async () => ({
    comparisonSummary: {
      additions: 1,
      deletions: 0,
      filesChanged: 1,
    },
    hasComparisonUpdates: true,
    hasGitHubUpdates: false,
    nextBaseSha: "89abcde",
    nextHeadSha: "89abcde",
  }));
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialOptions: {},
        initialSession,
        loadSession,
        probeFreshness,
      })}
    />,
  );

  expect(getAppText(tree)).toContain("src/old.ts");
  expect(getAppText(tree)).not.toContain("src/new.ts");

  await act(async () => {
    vi.advanceTimersByTime(5_000);
  });

  expect(probeFreshness).toHaveBeenCalledTimes(1);
  expect(loadSession).toHaveBeenCalledWith({});
  expect(getAppText(tree)).toContain("src/new.ts");
  expect(getAppText(tree)).not.toContain("src/old.ts");
  expect(getAppText(tree)).not.toContain("Press Shift+R to refresh.");
});

test("keeps reviewed files across refresh when their diffs are unchanged", async () => {
  const initialSession = createPreparedSession({
    files: [
      createPreparedFile({
        path: "src/app.ts",
        patch: "diff --git a/src/app.ts b/src/app.ts\napp",
      }),
      createPreparedFile({
        path: "src/utils.ts",
        patch: "diff --git a/src/utils.ts b/src/utils.ts\nold",
      }),
    ],
  });
  const nextSession = createPreparedSession({
    files: [
      createPreparedFile({
        path: "src/app.ts",
        patch: "diff --git a/src/app.ts b/src/app.ts\napp",
      }),
      createPreparedFile({
        path: "src/utils.ts",
        patch: "diff --git a/src/utils.ts b/src/utils.ts\nnew",
      }),
    ],
  });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession,
        loadSession,
        syncRemotes: vi.fn(async () => undefined),
      })}
    />,
  );

  emitKey({ name: "x", sequence: "x" });
  emitKey({ name: "x", sequence: "x" });
  expect(getAppText(tree)).toContain("2 / 2 reviewed");
  expect(getSelectedFileCard(tree).props.file.path).toBe("src/utils.ts");
  expect(getSelectedFileCard(tree).props.isCollapsed).toBe(true);

  await emitAsyncKey({ name: "r", sequence: "R", shift: true });

  expect(getAppText(tree)).toContain("1 / 2 reviewed");
  expect(getAppText(tree)).not.toContain("2 / 2 reviewed");
  expect(getSelectedFileCard(tree).props.file.path).toBe("src/utils.ts");
  expect(getSelectedFileCard(tree).props.isCollapsed).toBe(false);
});

test("uses GitHub viewed state instead of stale cached reviewed files for PR sessions", () => {
  const files = [createPreparedFile(), createPreparedFile({ path: "src/utils.ts" })];
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialReviewCache: {
          reviewedFiles: files.map((file) => ({
            fingerprint: buildReviewedFileFingerprint(file),
            path: file.path,
          })),
          collapsedPaths: [],
        },
        initialSession: createPreparedSession({
          files,
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession().pullRequest,
              changedFiles: createGitHubChangedFilesByPath({
                "src/app.ts": "VIEWED",
                "src/utils.ts": "UNVIEWED",
              }),
            },
          }),
        }),
      })}
    />,
  );

  expect(getAppText(tree)).toContain("1 / 2 reviewed");
  expect(getAppText(tree)).not.toContain("2 / 2 reviewed");
});

test("replaces local reviewed state with GitHub viewed state when refresh becomes PR-backed", async () => {
  const initialSession = createPreparedSession();
  const nextSession = createPreparedSession({
    github: createGitHubReviewSession({
      pullRequest: {
        ...createGitHubReviewSession().pullRequest,
        changedFiles: createGitHubChangedFilesByPath({
          "src/app.ts": "VIEWED",
          "src/utils.ts": "UNVIEWED",
        }),
      },
    }),
  });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession,
        loadSession,
        syncRemotes: vi.fn(async () => undefined),
      })}
    />,
  );

  emitKey({ name: "x", sequence: "x" });
  emitKey({ name: "x", sequence: "x" });
  expect(getAppText(tree)).toContain("2 / 2 reviewed");

  await emitAsyncKey({ name: "r", sequence: "R", shift: true });

  expect(getAppText(tree)).toContain("1 / 2 reviewed");
  expect(getAppText(tree)).not.toContain("2 / 2 reviewed");
});

test("reviews the PR overview locally, persists it, and never marks a GitHub file viewed", async () => {
  const saveCache = vi.spyOn(diffdiffCore, "saveReviewCache").mockResolvedValue(undefined);
  const markFileAsViewed = vi.fn(async () => undefined);
  const onExit = vi.fn();
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        markFileAsViewed,
        onExit,
      })}
    />,
  );
  expect(getAppText(tree)).toContain("PR overview");
  await emitAsyncKey({ name: "x", sequence: "x" });
  expect(getAppText(tree)).toContain("✓ Reviewed");
  expect(getAppText(tree)).toContain("0 / 2 reviewed");
  expect(markFileAsViewed).not.toHaveBeenCalled();
  await emitAsyncKey({ name: "q", sequence: "q" });
  expect(onExit).toHaveBeenCalled();
  const cache = saveCache.mock.calls.at(-1)?.[1];
  expect(
    Object.entries(cache?.commentCollapseStates ?? {}).filter(
      ([key, value]) => key.startsWith("pr-overview:") && value,
    ),
  ).toHaveLength(2);
  expect(cache?.reviewedFiles).toBeUndefined();
});

test("updates PR reviewed state through the GitHub viewed-file flow", async () => {
  const markFileAsViewed = vi.fn(async () => undefined);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession().pullRequest,
              changedFiles: createGitHubChangedFilesByPath({
                "src/app.ts": "UNVIEWED",
                "src/utils.ts": "UNVIEWED",
              }),
            },
          }),
        }),
        markFileAsViewed,
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  await emitAsyncKey({ name: "x", sequence: "x" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(markFileAsViewed).toHaveBeenCalledWith(expect.any(Object), "src/app.ts");
  expect(getAppText(tree)).toContain("1 / 2 reviewed");
  expect(getAppText(tree)).not.toContain("Reply to Thread");
});

test("optimistically updates and rolls back PR reviewed state", async () => {
  const deferredViewedState = createDeferred<void>();
  const markFileAsViewed = vi.fn(() => deferredViewedState.promise);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession().pullRequest,
              changedFiles: createGitHubChangedFilesByPath({
                "src/app.ts": "UNVIEWED",
                "src/utils.ts": "UNVIEWED",
              }),
            },
          }),
        }),
        markFileAsViewed,
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "x", sequence: "x" });

  expect(getAppText(tree)).toContain("1 / 2 reviewed");

  deferredViewedState.reject(new Error("boom"));
  await act(async () => {
    try {
      await deferredViewedState.promise;
    } catch {
      // expected test failure path
    }
  });

  expect(getAppText(tree)).toContain("0 / 2 reviewed");
});

test("stays in diff mode until an inline review thread is explicitly focused", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  expect(getAppText(tree)).toContain("DIFF");
  expect(getAppText(tree)).not.toContain("THREAD");

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "o", sequence: "o" });

  expect(getAppText(tree)).toContain("THREAD");
});

test("does not save reviewed files back into the cache for PR sessions", async () => {
  const saveReviewCacheSpy = vi.spyOn(diffdiffCore, "saveReviewCache").mockResolvedValue(undefined);
  const onExit = vi.fn();
  render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession().pullRequest,
              changedFiles: createGitHubChangedFilesByPath({
                "src/app.ts": "VIEWED",
                "src/utils.ts": "UNVIEWED",
              }),
            },
          }),
        }),
        onExit,
      })}
    />,
  );

  await emitAsyncKey({ ctrl: true, name: "x" });
  await emitAsyncKey({ name: "q", sequence: "q" });

  const githubSaveReviewCacheCall = saveReviewCacheSpy.mock.calls.find(
    ([key, value]) =>
      key.repositoryRootPath === "/tmp/diffdiff" &&
      key.base === "origin/main" &&
      key.head === "feature/tui" &&
      value.reviewedStateSource === "github",
  );

  expect(githubSaveReviewCacheCall?.[0]).toEqual({
    repositoryRootPath: "/tmp/diffdiff",
    base: "origin/main",
    head: "feature/tui",
  });
  expect(githubSaveReviewCacheCall?.[1]).toMatchObject({
    reviewedStateSource: "github",
  });
  expect(githubSaveReviewCacheCall?.[1]?.reviewedFiles).toBeUndefined();
  expect(onExit).toHaveBeenCalledTimes(1);
});

test("shows PR bulk reviewed actions as disabled in the command palette", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession().pullRequest,
              changedFiles: createGitHubChangedFilesByPath({
                "src/app.ts": "VIEWED",
                "src/utils.ts": "UNVIEWED",
              }),
            },
          }),
        }),
      })}
    />,
  );

  emitKey({ ctrl: true, name: "p" });
  emitText("reviewed");

  expect(getAppText(tree)).toContain("Mark all reviewed");
  expect(getAppText(tree)).toContain("Unmark all reviewed");
  emitKey({ ctrl: true, name: "u" });
  emitText("Mark all reviewed");
  expect(getAppText(tree)).toContain(
    "GitHub PR reviewed state can only be updated one file at a time.",
  );
});

test("opens PR review mode from the list modal", () => {
  const loadSession = vi.fn(async () =>
    createPreparedSession({ github: createGitHubReviewSession() }),
  );
  render(
    <DiffdiffApp
      {...createAppProps({
        loadSession,
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "k" });
  emitKey({ name: "return" });

  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "origin/feature/tui",
  });
});

test("sets the selected branch as head on Enter", () => {
  const loadSession = vi.fn(async () => createPreparedSession());
  render(
    <DiffdiffApp
      {...createAppProps({
        loadSession,
      })}
    />,
  );

  emitKey({ name: "l" });
  emitKey({ name: "j" });
  emitKey({ name: "return" });

  expect(loadSession).toHaveBeenCalledWith(expect.objectContaining({ head: "main" }));
});

test("restores reviewed files from the cache when opening a branch review from the list modal", async () => {
  const nextSession = createPreparedSession();
  const loadSession = vi.fn(async () => nextSession);
  const loadReviewCacheSpy = vi.spyOn(diffdiffCore, "loadReviewCache").mockResolvedValue({
    reviewedFiles: [
      {
        fingerprint: buildReviewedFileFingerprint(nextSession.files[0]!),
        path: nextSession.files[0]!.path,
      },
    ],
    collapsedPaths: [],
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialOptions: {},
        initialSession: createPreparedSession({
          comparison: {
            base: "HEAD",
            baseSha: "1234567",
            head: "working tree",
            headSha: "1234567",
            mode: "working-tree",
            range: "HEAD...working tree",
            usesMergeBase: false,
          },
          commits: [],
          files: [],
          workingTreeSummary: {
            additions: 0,
            deletions: 0,
            filesChanged: 0,
          },
        }),
        loadSession,
      })}
    />,
  );

  emitKey({ name: "j" });
  emitKey({ name: "j" });
  await emitAsyncKey({ name: "h" });

  expect(loadSession).toHaveBeenCalledWith({ head: "feature/tui" });
  expect(loadReviewCacheSpy).toHaveBeenCalledWith({
    repositoryRootPath: "/tmp/diffdiff",
    base: "origin/main",
    head: "feature/tui",
  });
  expect(getAppText(tree)).toContain("1 / 2 reviewed");
});

test("shows outdated PR threads collapsed by default and expands them on click", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  expect(getAppText(tree)).toContain("#42");
  expect(getAppText(tree)).toContain("Build TUI reviewer");
  expect(getAppText(tree)).not.toContain("threads");
  expect(getAppText(tree)).toContain("Please rename this variable.");
  expect(getAppText(tree)).not.toContain("This thread is outdated.");
  expect(getAppText(tree)).toContain("outdated");

  const outdatedThreadHeader = tree.root.find(
    (node) =>
      String(node.type) === "box" &&
      typeof node.props.onMouseUp === "function" &&
      node.props.justifyContent === "space-between" &&
      collectInstanceText(node).includes("src/app.ts:1") &&
      collectInstanceText(node).includes("outdated"),
  );

  act(() => {
    outdatedThreadHeader.props.onMouseUp?.();
  });

  expect(getAppText(tree)).toContain("This thread is outdated.");
});

test("uses cached comment collapse state for PR review threads", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialReviewCache: {
          reviewedPaths: [],
          collapsedPaths: [],
          commentCollapseStates: {
            "thread:101": true,
            "thread:102": false,
          },
        },
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  expect(getAppText(tree)).not.toContain("Please rename this variable.");
  expect(getAppText(tree)).toContain("This thread is outdated.");
});

test("renders the PR banner flush with the header", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  const prBanner = tree.root.find(
    (node) =>
      String(node.type) === "box" &&
      collectInstanceText(node).includes("#42") &&
      collectInstanceText(node).includes("Build TUI reviewer") &&
      collectInstanceText(node).includes("merge ready") &&
      !collectInstanceText(node).includes("diffdiff"),
  );

  expect(prBanner.props.border).toBeUndefined();
  expect(prBanner.props.paddingLeft).toBeUndefined();
  expect(prBanner.props.paddingRight).toBeUndefined();
  expect(prBanner.props.paddingTop).toBeUndefined();
  expect(prBanner.props.paddingBottom).toBeUndefined();
  expect(prBanner.props.backgroundColor).toBeUndefined();
  expect(prBanner.props.flexDirection).toBe("row");
  expect(prBanner.findByProps({ id: "pr-checks-badge" }).props.onMouseUp).toBeTypeOf("function");
});

test("renders header warnings after the PR banner", () => {
  const warningMessage = "base commit differs from the PR base";
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession(),
          warnings: [{ code: "base-ref-mismatch", message: warningMessage }],
        }),
      })}
    />,
  );

  const header = tree.root.find(
    (node) =>
      String(node.type) === "box" &&
      node.props.backgroundColor === theme.chromeBackground &&
      node.props.paddingX === 2 &&
      node.props.flexDirection === "column",
  );
  const headerLines = header.children
    .filter((child): child is ReactTestInstance => typeof child !== "string")
    .map((child) => collectInstanceText(child))
    .filter((line) => line.length > 0);

  expect(headerLines).toHaveLength(3);
  expect(headerLines[1]).toContain("#42");
  expect(headerLines[1]).toContain("Build TUI reviewer");
  expect(headerLines[2]).toBe(`warning ${warningMessage}`);
});

test("uses the draft PR tag instead of a separate draft status", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession()!.pullRequest,
              isDraft: true,
              merge: {
                ...createGitHubReviewSession()!.pullRequest.merge,
                canMerge: false,
                isDraft: true,
                mergeableState: "blocked",
              },
            },
          }),
        }),
      })}
    />,
  );

  const draftTag = tree.root.find(
    (node) => String(node.type) === "span" && collectInstanceText(node).includes("DRAFT PR"),
  );

  expect(draftTag.props.bg).toBe(theme.warning);
  expect(getAppText(tree)).toContain("DRAFT PR");
  expect(getAppText(tree)).toContain("#42");
  expect(getAppText(tree)).not.toContain(" draft ");
  expect(getAppText(tree)).toContain("merge blocked");
});

test("shows a red closed PR tag", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession()!.pullRequest,
              state: "closed",
              merge: {
                ...createGitHubReviewSession()!.pullRequest.merge,
                canMerge: false,
                mergeableState: "blocked",
              },
            },
          }),
        }),
      })}
    />,
  );

  const closedTag = tree.root.find(
    (node) => String(node.type) === "span" && collectInstanceText(node).includes("CLOSED PR"),
  );

  expect(closedTag.props.bg).toBe(theme.danger);
  expect(getAppText(tree)).toContain("CLOSED PR");
  expect(getAppText(tree)).toContain("#42");
  expect(getAppText(tree)).toContain("closed");
});

test("opens the PR comments modal from review mode", () => {
  const pendingComment = "This pending review note should stay hidden.";
  const inlineReviewComment =
    "Configured tracing before importing FastAPI because ddtrace patches framework integrations at import time.";
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          github: createGitHubReviewSession({
            pullRequest: {
              ...createGitHubReviewSession()!.pullRequest,
              conversationItems: [
                ...createGitHubReviewSession()!.pullRequest.conversationItems,
                {
                  author: {
                    login: "madisonbullard",
                    url: "https://github.com/madisonbullard",
                  },
                  body: "",
                  createdAt: "2026-04-01T12:02:00Z",
                  id: "review:9011",
                  kind: "review",
                  reviewId: 9011,
                  reviewNodeId: "PRR_9011",
                  reviewState: "COMMENTED",
                  updatedAt: "2026-04-01T12:02:00Z",
                  url: "https://github.com/diffdiff/diffdiff/pull/42#pullrequestreview-9011",
                },
              ],
              pendingReview: {
                body: pendingComment,
                comments: [
                  {
                    author: {
                      login: "madisonbullard",
                      url: "https://github.com/madisonbullard",
                    },
                    body: pendingComment,
                    createdAt: "2026-04-01T12:02:00Z",
                    id: 102,
                    isOutdated: false,
                    nodeId: "PRRC_102",
                    path: "src/app.ts",
                    reviewId: 9010,
                    side: "RIGHT",
                    updatedAt: "2026-04-01T12:02:00Z",
                    url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r102",
                  },
                ],
                id: 9010,
                nodeId: "PRR_pending_9010",
              },
              reviewGroups: [
                ...createGitHubReviewSession()!.pullRequest.reviewGroups,
                {
                  author: {
                    login: "madisonbullard",
                    url: "https://github.com/madisonbullard",
                  },
                  body: inlineReviewComment,
                  comments: [
                    {
                      author: {
                        login: "madisonbullard",
                        url: "https://github.com/madisonbullard",
                      },
                      body: inlineReviewComment,
                      createdAt: "2026-04-01T12:02:00Z",
                      id: 104,
                      isOutdated: false,
                      line: 11,
                      nodeId: "PRRC_104",
                      path: "src/app.ts",
                      reviewId: 9011,
                      side: "RIGHT",
                      updatedAt: "2026-04-01T12:02:00Z",
                      url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r104",
                    },
                  ],
                  reviewId: 9011,
                  reviewNodeId: "PRR_9011",
                  state: "COMMENTED",
                  submittedAt: "2026-04-01T12:02:00Z",
                },
                {
                  author: {
                    login: "madisonbullard",
                    url: "https://github.com/madisonbullard",
                  },
                  body: pendingComment,
                  comments: [
                    {
                      author: {
                        login: "madisonbullard",
                        url: "https://github.com/madisonbullard",
                      },
                      body: pendingComment,
                      createdAt: "2026-04-01T12:02:00Z",
                      id: 102,
                      isOutdated: false,
                      nodeId: "PRRC_102",
                      path: "src/app.ts",
                      reviewId: 9010,
                      side: "RIGHT",
                      updatedAt: "2026-04-01T12:02:00Z",
                      url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r102",
                    },
                  ],
                  reviewId: 9010,
                  reviewNodeId: "PRR_pending_9010",
                  state: "PENDING",
                },
              ],
            },
          }),
        }),
      })}
    />,
  );

  expect(getAppText(tree)).not.toContain("Looks ready to merge.");

  emitKey({ name: "t" });

  expect(getAppText(tree)).toContain("PR Conversation");
  expect(getAppText(tree)).toContain("Looks ready to merge.");
  expect(getAppText(tree)).toContain("Can we tighten the rollout copy?");
  emitKey({ name: "end" });
  expect(getAppText(tree)).toContain(inlineReviewComment);
  expect(getAppText(tree)).not.toContain(pendingComment);
  expect(getAppText(tree)).not.toContain("pending");
});

test("copies the PR URL from review mode", async () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  emitKey({ name: "y", sequence: "y" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(clipboardState.copyTextToClipboard).toHaveBeenCalledWith(
    "https://github.com/diffdiff/diffdiff/pull/42",
  );
  expect(getAppText(tree)).toContain("Copied PR URL to clipboard");
});

test("cycles inline thread and comment focus, then copies the focused comment URL", async () => {
  render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "o", sequence: "o" });
  emitKey({ name: "]", sequence: "]" });
  emitKey({ name: "y", sequence: "y" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(clipboardState.copyTextToClipboard).toHaveBeenLastCalledWith(
    "https://github.com/diffdiff/diffdiff/pull/42#discussion_r103",
  );

  emitKey({ name: "o", sequence: "o" });
  emitKey({ name: "y", sequence: "y" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(clipboardState.copyTextToClipboard).toHaveBeenLastCalledWith(
    "https://github.com/diffdiff/diffdiff/pull/42#discussion_r102",
  );
});

test("replies to the root comment of the focused inline thread", async () => {
  const replyToReviewComment = vi.fn(async () => undefined);
  const nextSession = createPreparedSession({ github: createGitHubReviewSession() });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        replyToReviewComment,
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "o", sequence: "o" });
  emitKey({ name: "]", sequence: "]" });
  emitKey({ name: "r", sequence: "r" });

  expect(getAppText(tree)).toContain("Reply to Thread");
  expect(getAppText(tree)).toContain("I renamed it in the follow-up commit.");

  emitText("Thanks for the follow-up.");
  await emitAsyncKey({ name: "return" });

  expect(replyToReviewComment).toHaveBeenCalledWith(
    expect.objectContaining({ pullRequest: expect.objectContaining({ number: 42 }) }),
    101,
    "Thanks for the follow-up.",
  );
});

test("replies to a PR conversation item with a quoted top-level comment", async () => {
  const addPullRequestComment = vi.fn(async () => undefined);
  const nextSession = createPreparedSession({ github: createGitHubReviewSession() });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        addPullRequestComment,
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
      })}
    />,
  );

  emitKey({ ctrl: true, name: "x" });
  emitKey({ name: "t" });
  emitKey({ name: "y", sequence: "y" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(clipboardState.copyTextToClipboard).toHaveBeenLastCalledWith(
    "https://github.com/diffdiff/diffdiff/pull/42#issuecomment-501",
  );

  emitKey({ name: "r", sequence: "r" });
  expect(getAppText(tree)).toContain("Reply to PR Comment");
  expect(getAppText(tree)).toContain("Can we tighten the rollout copy?");

  emitText("We can tighten it before ship.");
  await emitAsyncKey({ name: "return" });

  expect(addPullRequestComment).toHaveBeenCalledTimes(1);
  const [reviewSession, body] = addPullRequestComment.mock.calls[0] as unknown as [unknown, string];

  expect(reviewSession).toEqual(
    expect.objectContaining({
      pullRequest: expect.objectContaining({ number: 42 }),
    }),
  );
  expect(body).toContain("Replying to octocat:");
  expect(body).toContain("> Can we tighten the rollout copy?");
  expect(body).toContain("We can tighten it before ship.");
});

test("closes a nested PR reply composer back to the conversation modal", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  emitKey({ ctrl: true, name: "x" });
  emitKey({ name: "t" });
  emitKey({ name: "r", sequence: "r" });

  expect(getAppText(tree)).toContain("Reply to PR Comment");
  expect(getAppText(tree)).not.toContain("PR Conversation");

  emitKey({ name: "escape" });

  expect(getAppText(tree)).not.toContain("Reply to PR Comment");
  expect(getAppText(tree)).toContain("PR Conversation");
  expect(getAppText(tree)).toContain("Can we tighten the rollout copy?");
});

test("opens the comment composer and submits a pending review thread", async () => {
  const addReviewThread = vi.fn(async () => undefined);
  const nextSession = createPreparedSession({ github: createGitHubReviewSession() });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        addReviewThread,
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "a" });

  expect(getAppText(tree)).toContain("Add Comment");
  expect(getAppText(tree)).toContain("const count = 0");

  emitText("Looks good");
  await emitAsyncKey({ name: "return" });

  expect(addReviewThread).toHaveBeenCalledWith(
    expect.objectContaining({ pullRequest: expect.objectContaining({ number: 42 }) }),
    expect.objectContaining({ line: 1, path: "src/app.ts", side: "LEFT" }),
    "Looks good",
  );
  expect(loadSession).toHaveBeenLastCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
});

test("shows an optimistic review thread while the session reload is pending", async () => {
  const deferredSession = createDeferred<PreparedReviewSession>();
  const addReviewThread = vi.fn(async () => undefined);
  const loadSession = vi.fn(() => deferredSession.promise);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        addReviewThread,
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "a" });
  emitText("Looks good");
  emitKey({ name: "return" });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
  expect(getSelectedFileCard(tree).props.reviewThreads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        comments: expect.arrayContaining([expect.objectContaining({ body: "Looks good" })]),
      }),
    ]),
  );

  deferredSession.resolve(createPreparedSession({ github: createGitHubReviewSession() }));
  await act(async () => {
    await deferredSession.promise;
  });

  expect(getAppText(tree)).toContain("Looks good");
});

test("opens the comment composer when only the raw patch is available", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({
          files: [
            createPreparedFile({
              patch: [
                "diff --git a/src/app.ts b/src/app.ts",
                "--- a/src/app.ts",
                "+++ b/src/app.ts",
                "@@ -1 +1 @@",
                "-const count = 0",
                "+const count = 1",
              ].join("\n"),
              sideBySideRows: [],
              unifiedLines: [],
            }),
          ],
          github: createGitHubReviewSession(),
        }),
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "a" });

  expect(getAppText(tree)).toContain("Add Comment");
  expect(getAppText(tree)).toContain("const count = 0");
});

test("inserts file references into the comment composer autocomplete", () => {
  const addReviewThread = vi.fn(async () => undefined);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        addReviewThread,
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "a" });
  emitText("Please check @app#12-18");

  expect(getAppText(tree)).toContain("src/app.ts#12-18");

  emitKey({ name: "tab", sequence: "\t" });

  expect(addReviewThread).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("`src/app.ts#12-18`");
});

test("restores the latest dismissed draft when reopening the same comment target", async () => {
  const appendReviewComposerHistory = vi.fn(async () => undefined);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        appendReviewComposerHistory,
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "a" });
  emitText("Needs follow-up");
  emitKey({ name: "escape" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(appendReviewComposerHistory).toHaveBeenCalledWith(
    expect.objectContaining({ body: "Needs follow-up", outcome: "dismissed" }),
  );

  emitKey({ name: "a" });

  expect(getAppText(tree)).toContain("Needs follow-up");
  expect(getAppText(tree)).toContain("Restored comment draft.");
});

test("opens the external editor for comment composition", async () => {
  const openExternalEditor = vi.fn(async () => "Edited in vim");
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        openExternalEditor,
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "a" });
  emitKey({ ctrl: true, name: "x" });
  emitKey({ name: "e", sequence: "e" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(openExternalEditor).toHaveBeenCalledWith("/tmp/diffdiff", "", {
    fileExtension: ".md",
    tempFileName: "REVIEW_COMMENT.md",
  });
  expect(getAppText(tree)).toContain("Edited in vim");
});

test("uses ctrl+e for line-end editing in the comment composer", () => {
  const openExternalEditor = vi.fn(async () => "Edited in vim");
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        openExternalEditor,
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "a" });
  emitText("alpha");
  emitKey({ ctrl: true, name: "a" });
  emitText("z");
  emitKey({ ctrl: true, name: "e" });
  emitText("!");

  expect(openExternalEditor).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("zalpha!");
});

test("treats raw DEL input as backspace in the comment composer", () => {
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );

  emitKey({ name: "j", sequence: "j" });
  emitKey({ name: "a" });
  emitText("Ship it");
  emitKey({ name: "", sequence: "\x7f" });

  expect(getAppText(tree)).toContain("Ship i");
  expect(getAppText(tree)).not.toContain("Ship it");
});

test("opens the submit review modal and submits the pending review", async () => {
  const submitPendingReview = vi.fn(async () => undefined);
  const loadSession = vi.fn(async () =>
    createPreparedSession({ github: createGitHubReviewSession() }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        submitPendingReview,
      })}
    />,
  );

  emitKey({ name: "a", sequence: "A", shift: true });

  expect(getAppText(tree)).toContain("Submit Review");
  expect(getAppText(tree)).toContain("Comment");

  emitKey({ name: "down" });
  emitKey({ name: "tab" });
  emitText("Ship it");
  await emitAsyncKey({ name: "return" });

  expect(submitPendingReview).toHaveBeenCalledWith(
    expect.objectContaining({ pullRequest: expect.objectContaining({ number: 42 }) }),
    "APPROVE",
    "Ship it",
  );
});

test("opens the external editor for submit review", async () => {
  const openExternalEditor = vi.fn(async () => "Summary from editor");
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        openExternalEditor,
      })}
    />,
  );

  emitKey({ name: "a", sequence: "A", shift: true });
  emitKey({ ctrl: true, name: "x" });
  emitKey({ name: "e", sequence: "e" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(openExternalEditor).toHaveBeenCalledWith("/tmp/diffdiff", "", {
    fileExtension: ".md",
    tempFileName: "SUBMIT_REVIEW.md",
  });
  expect(getAppText(tree)).toContain("Summary from editor");
});

test("uses ctrl+e for line-end editing in submit review", () => {
  const openExternalEditor = vi.fn(async () => "Summary from editor");
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        openExternalEditor,
      })}
    />,
  );

  emitKey({ name: "a", sequence: "A", shift: true });
  emitKey({ name: "tab" });
  emitText("ship");
  emitKey({ ctrl: true, name: "a" });
  emitText("Please ");
  emitKey({ ctrl: true, name: "e" });
  emitText(" now");

  expect(openExternalEditor).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("Please ship now");
});

test("shows an optimistic submitted review while the session reload is pending", async () => {
  const deferredSession = createDeferred<PreparedReviewSession>();
  const submitPendingReview = vi.fn(async () => undefined);
  const loadSession = vi.fn(() => deferredSession.promise);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        submitPendingReview,
      })}
    />,
  );

  emitKey({ name: "a", sequence: "A", shift: true });
  emitKey({ name: "down" });
  emitKey({ name: "tab" });
  emitText("Ship it");
  emitKey({ name: "return" });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  emitKey({ name: "t" });

  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
  expect(getAppText(tree)).toContain("Ship it");

  deferredSession.resolve(createPreparedSession({ github: createGitHubReviewSession() }));
  await act(async () => {
    await deferredSession.promise;
  });

  expect(getAppText(tree)).toContain("Ship it");
});

test("remembering cleanup preserves saved key remaps", async () => {
  const keys = { diff: { z: "comparison.list" } };
  vi.mocked(diffdiffCore.loadDiffdiffPreferences).mockResolvedValue({
    ...diffdiffCore.getDefaultDiffdiffPreferences(),
    keys,
  });
  render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
  );
  emitKey({ name: "m" });
  await emitAsyncKey({ ctrl: true, name: "r" });
  expect(diffdiffCore.saveDiffdiffPreferences).toHaveBeenCalledWith(
    expect.objectContaining({ keys }),
  );
});

test("opens the merge modal and merges with the selected method", async () => {
  const mergePullRequestSpy = vi.fn();
  const mergePullRequest: NonNullable<DiffdiffAppProps["mergePullRequest"]> = async (
    reviewSession,
    input,
  ) => {
    mergePullRequestSpy(reviewSession, input);
    return {
      cleanupCandidates: [],
      deletedRemoteRefs: [],
      message: "Pull Request successfully merged",
      sha: "mergedsha",
    };
  };
  const nextSession = createPreparedSession({
    github: createGitHubReviewSession({
      pullRequest: {
        ...createGitHubReviewSession()!.pullRequest,
        isMerged: true,
        merge: {
          ...createGitHubReviewSession()!.pullRequest.merge,
          canMerge: false,
          isMerged: true,
          mergedAt: "2026-04-01T13:00:00Z",
        },
      },
    }),
  });
  const loadSession = vi.fn(async () => nextSession);
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        mergePullRequest,
      })}
    />,
  );

  emitKey({ name: "m" });

  expect(getAppText(tree)).toContain("Merge Pull Request");
  expect(getAppText(tree)).toContain("Adds PR review mode.");

  emitKey({ name: "j" });
  await emitAsyncKey({ name: "return" });

  expect(getAppText(tree)).toContain("Press Enter to merge now");

  await emitAsyncKey({ name: "return" });

  expect(mergePullRequestSpy).toHaveBeenCalledWith(
    expect.objectContaining({ pullRequest: expect.objectContaining({ number: 42 }) }),
    expect.objectContaining({
      commitMessage: "Adds PR review mode.",
      commitTitle: "Build TUI reviewer",
      method: "squash",
    }),
  );
  expect(loadSession).toHaveBeenLastCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
});

test("opens the external editor for merge composition", async () => {
  const openExternalEditor = vi.fn(async () => "Edited title\n\nEdited body");
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialGitHubPreferences: createGitHubPreferences({ defaultMergeMethod: "merge" }),
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        openExternalEditor,
      })}
    />,
  );

  emitKey({ name: "m" });
  emitKey({ ctrl: true, name: "x" });
  emitKey({ name: "e", sequence: "e" });
  await act(async () => {
    await Promise.resolve();
  });

  expect(openExternalEditor).toHaveBeenCalledWith(
    "/tmp/diffdiff",
    "Build TUI reviewer\n\nAdds PR review mode.",
    {
      fileExtension: ".txt",
      tempFileName: "MERGE_MSG",
    },
  );
  expect(getAppText(tree)).toContain("Edited title");
  expect(getAppText(tree)).toContain("Edited body");
});

test("closes a draft PR from the merge menu after explicit confirmation, keeping refs", async () => {
  const github = createGitHubReviewSession()!;
  github.pullRequest.isDraft = true;
  github.pullRequest.merge.allowedMethods = [];
  github.pullRequest.merge.canMerge = false;
  const closePullRequest = vi.fn(async () => {});
  const mergePullRequest = vi.fn();
  const removeCleanupRefs = vi.fn();
  const loadSession = vi.fn().mockRejectedValue(new Error("offline"));
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github }),
        closePullRequest,
        mergePullRequest,
        removeCleanupRefs,
        loadSession,
      })}
    />,
  );
  emitKey({ name: "m" });
  emitKey({ name: "j" });
  expect(getAppText(tree)).toContain("Close PR");
  expect(getAppText(tree)).not.toContain("Commit title");
  await emitAsyncKey({ name: "return" });
  expect(closePullRequest).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("without merging");
  emitKey({ name: "escape" });
  expect(closePullRequest).not.toHaveBeenCalled();
  await emitAsyncKey({ name: "return" });
  await emitAsyncKey({ name: "return" });
  expect(closePullRequest).toHaveBeenCalledExactlyOnceWith(github);
  expect(mergePullRequest).not.toHaveBeenCalled();
  expect(removeCleanupRefs).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("CLOSED PR");
  expect(getAppText(tree)).toContain("Closed the pull request, but unable to refresh");
});

test("enables auto-merge from the merge modal while checks block immediate merging", async () => {
  const github = createGitHubReviewSession()!;
  github.pullRequest.merge = {
    ...github.pullRequest.merge,
    canMerge: false,
    autoMergeAllowed: true,
  };
  const mergePullRequest = vi.fn(async () => ({
    autoMergeEnabled: true,
    cleanupCandidates: [],
    deletedRemoteRefs: [],
    message: "Auto-merge enabled.",
  }));
  const loadSession = vi.fn();
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github }),
        mergePullRequest,
        loadSession,
      })}
    />,
  );
  emitKey({ name: "m" });
  emitKey({ name: "j" });
  emitKey({ ctrl: true, name: "g" });
  expect(getAppText(tree)).toContain("[x] Auto-merge");
  await emitAsyncKey({ name: "return" });
  expect(getAppText(tree)).toContain("Enable Auto-Merge");
  await emitAsyncKey({ name: "return" });
  expect(mergePullRequest).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ autoMerge: true, method: "squash" }),
  );
  expect(loadSession).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("Auto-merge enabled.");
  emitKey({ name: "m" });
  expect(getAppText(tree)).toContain("Auto-merge is already enabled.");
});

test("auto-merge failures preserve the open PR and allow retry", async () => {
  const github = createGitHubReviewSession()!;
  github.pullRequest.merge.autoMergeAllowed = true;
  const mergePullRequest = vi
    .fn()
    .mockRejectedValueOnce(new Error("Permission denied"))
    .mockResolvedValueOnce({
      autoMergeEnabled: true,
      cleanupCandidates: [],
      deletedRemoteRefs: [],
      message: "Enabled",
    });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({ initialSession: createPreparedSession({ github }), mergePullRequest })}
    />,
  );
  emitKey({ name: "m" });
  emitKey({ name: "j" });
  emitKey({ ctrl: true, name: "g" });
  await emitAsyncKey({ name: "return" });
  await emitAsyncKey({ name: "return" });
  expect(getAppText(tree)).toContain("Enable Auto-Merge");
  expect(getAppText(tree)).toContain("Permission denied");
  expect(getAppText(tree)).toContain("[x] Auto-merge");
  await emitAsyncKey({ name: "return" });
  await emitAsyncKey({ name: "return" });
  expect(mergePullRequest).toHaveBeenCalledTimes(2);
  expect(getAppText(tree)).toContain("Auto-merge enabled.");
});

test("uses ctrl+e for line-end editing in merge title", () => {
  const openExternalEditor = vi.fn(async () => "Edited title\n\nEdited body");
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialGitHubPreferences: createGitHubPreferences({ defaultMergeMethod: "merge" }),
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        openExternalEditor,
      })}
    />,
  );

  emitKey({ name: "m" });
  emitKey({ ctrl: true, name: "a" });
  emitText("New ");
  emitKey({ ctrl: true, name: "e" });
  emitText("!");

  expect(openExternalEditor).not.toHaveBeenCalled();
  expect(getAppText(tree)).toContain("New Build TUI reviewer!");
});

test("shows an optimistic merged state while the session reload is pending", async () => {
  const deferredSession = createDeferred<PreparedReviewSession>();
  const loadSession = vi.fn(() => deferredSession.promise);
  const mergePullRequest: NonNullable<DiffdiffAppProps["mergePullRequest"]> = async () => ({
    cleanupCandidates: [],
    deletedRemoteRefs: [],
    message: "Pull Request successfully merged",
    sha: "mergedsha",
  });
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialGitHubPreferences: createGitHubPreferences({ defaultMergeMethod: "merge" }),
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        loadSession,
        mergePullRequest,
      })}
    />,
  );

  emitKey({ name: "m" });
  emitKey({ name: "return" });
  emitKey({ name: "return" });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(loadSession).toHaveBeenCalledWith({
    base: "origin/main",
    head: "feature/tui",
  });
  expect(getAppText(tree)).toContain("CLOSED PR");
  expect(getAppText(tree)).toContain("merged");

  deferredSession.resolve(
    createPreparedSession({
      github: createGitHubReviewSession({
        pullRequest: {
          ...createGitHubReviewSession().pullRequest,
          isMerged: true,
          merge: {
            ...createGitHubReviewSession().pullRequest.merge,
            canMerge: false,
            isMerged: true,
            mergedAt: "2026-04-01T13:00:00Z",
          },
          state: "closed",
        },
      }),
    }),
  );
  await act(async () => {
    await deferredSession.promise;
  });

  expect(getAppText(tree)).toContain("CLOSED PR");
  expect(getAppText(tree)).toContain("merged");
});

test("caps the merge body input height and scrolls to the cursor", () => {
  const scrollboxes: ReturnType<typeof createMockScrollbox>[] = [];
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
      })}
    />,
    {
      createNodeMock(element) {
        if (element.type === "scrollbox") {
          const scrollbox = createMockScrollbox(false);
          scrollboxes.push(scrollbox);
          return scrollbox;
        }

        return null;
      },
    },
  );

  emitKey({ name: "m" });
  emitKey({ name: "tab", sequence: "\t" });
  emitKey({ name: "tab", sequence: "\t" });

  const mergeBodyScrollbox = tree.root.findAll((node) => String(node.type) === "scrollbox")[3]!;
  expect(mergeBodyScrollbox.props.height).toBe("100%");
  expect(mergeBodyScrollbox.parent?.props.height).toBeGreaterThan(8);
  expect(scrollboxes.some((scrollbox) => scrollbox.scrollTo.mock.calls.length > 0)).toBe(true);
});

test("applies remembered cleanup after merge without opening another dialog", async () => {
  const mergePullRequestSpy = vi.fn();
  const mergePullRequest: NonNullable<DiffdiffAppProps["mergePullRequest"]> = async (
    reviewSession,
    input,
  ) => {
    mergePullRequestSpy(reviewSession, input);
    return {
      cleanupCandidates: [
        { branchName: "feature/tui", kind: "local-branch", ref: "feature/tui" },
        { branchName: "feature/tui", kind: "remote-tracking", ref: "origin/feature/tui" },
      ],
      deletedRemoteRefs: ["origin/feature/tui"],
      message: "Pull Request successfully merged",
      sha: "mergedsha",
    };
  };
  const removeCleanupRefsSpy = vi.fn();
  const removeCleanupRefs: NonNullable<DiffdiffAppProps["removeCleanupRefs"]> = async (
    repositoryRootPath,
    refs,
  ) => {
    removeCleanupRefsSpy(repositoryRootPath, refs);
  };
  const loadSession = vi.fn(async () =>
    createPreparedSession({
      github: createGitHubReviewSession({
        pullRequest: {
          ...createGitHubReviewSession()!.pullRequest,
          isMerged: true,
          merge: {
            ...createGitHubReviewSession()!.pullRequest.merge,
            canMerge: false,
            isMerged: true,
            mergedAt: "2026-04-01T13:00:00Z",
          },
        },
      }),
    }),
  );
  const tree = render(
    <DiffdiffApp
      {...createAppProps({
        initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
        initialGitHubPreferences: createGitHubPreferences({
          cleanup: {
            removeLocal: true,
            removeRemote: false,
          },
          defaultMergeMethod: "merge",
        }),
        loadSession,
        mergePullRequest,
        removeCleanupRefs,
      })}
    />,
  );

  emitKey({ name: "m" });
  await emitAsyncKey({ name: "return" });

  expect(getAppText(tree)).toContain("Press Enter to merge now");

  await emitAsyncKey({ name: "return" });

  expect(getAppText(tree)).not.toContain("Post-Merge Cleanup");
  expect(getAppText(tree)).not.toContain("Merge Pull Request");
  expect(getAppText(tree)).toContain("2 refs removed");
  expect(removeCleanupRefsSpy).toHaveBeenCalledWith("/tmp/diffdiff", [
    { branchName: "feature/tui", kind: "local-branch", ref: "feature/tui" },
  ]);
  expect(removeCleanupRefsSpy).toHaveBeenCalledWith("/tmp/diffdiff", [
    { branchName: "feature/tui", kind: "remote-tracking", ref: "origin/feature/tui" },
  ]);
});

type DiffdiffAppProps = ComponentProps<typeof DiffdiffApp>;

function createReviewerAppProps(overrides: Partial<DiffdiffAppProps> = {}): DiffdiffAppProps {
  return createAppProps({
    initialSession: createPreparedSession({ github: createGitHubReviewSession() }),
    listReviewerCandidates: vi.fn(async () => ({
      recommendationsUnavailable: false,
      users: [
        {
          login: "alice",
          name: "Alice",
          recommendation: { basedOnCommits: true, basedOnReviewComments: true },
        },
        { login: "bob", name: "Robert" },
        { login: "existing" },
      ],
    })),
    requestReviewers: vi.fn(async () => undefined),
    ...overrides,
  });
}

async function openReviewerPicker(): Promise<void> {
  emitKey({ name: "space", sequence: " " });
  await emitAsyncKey({ name: "w" });
}

function createAppProps(overrides: Partial<DiffdiffAppProps> = {}): DiffdiffAppProps {
  const initialOptions =
    overrides.initialOptions ??
    ({
      base: "origin/main",
      head: "feature/tui",
    } satisfies LaunchOptions);
  const initialSession = overrides.initialSession ?? createPreparedSession();

  return {
    addPullRequestComment: vi.fn(async () => undefined),
    appendReviewComposerHistory: vi.fn(async () => undefined),
    addReviewThread: vi.fn(async () => undefined),
    initialGitHubPreferences: createGitHubPreferences(),
    isGitHubAuthenticated: true,
    initialOptions,
    initialSession,
    listGitHubPullRequests: vi.fn(async () => createDashboardPullRequests()),
    loadReviewComposerHistory: vi.fn(async () => []),
    loadComparisonBrowserData: vi.fn(async () => ({
      branches: initialSession.branches,
      commits: initialSession.commits,
      workingTreeSummary: initialSession.workingTreeSummary,
    })),
    loadSession: vi.fn(async () => initialSession),
    logFilePath: "/Users/test/.diffdiff/logs/log-test.jsonl",
    markFileAsViewed: vi.fn(async () => undefined),
    mergePullRequest: async () => ({
      cleanupCandidates: [],
      deletedRemoteRefs: [],
      message: "Pull Request successfully merged",
      sha: "mergedsha",
    }),
    onExit: vi.fn(),
    openExternalEditor: vi.fn(async (_repositoryRootPath, initialValue) => initialValue),
    openFileInEditor: vi.fn(async () => undefined),
    resolveLaunchTarget: vi.fn(async (_target, options) => options),
    replyToReviewComment: vi.fn(async () => undefined),
    removeCleanupRefs: async () => undefined,
    submitPendingReview: vi.fn(async () => undefined),
    syncRemotes: vi.fn(async () => undefined),
    syntaxStyle,
    theme,
    unmarkFileAsViewed: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createGitHubChangedFilesByPath(
  viewedStatesByPath: Record<string, "VIEWED" | "UNVIEWED" | "DISMISSED">,
) {
  return Object.fromEntries(
    Object.entries(viewedStatesByPath).map(([path, viewedState]) => [path, { path, viewedState }]),
  );
}

function createGitHubPreferences(
  overrides: Partial<GitHubUserPreferences> = {},
): GitHubUserPreferences {
  return {
    cleanup: {
      removeLocal: true,
      removeRemote: false,
      ...overrides.cleanup,
    },
    defaultMergeMethod: overrides.defaultMergeMethod,
  };
}

function createDashboardPullRequests(): GitHubDashboardPullRequest[] {
  return [
    {
      author: { login: "madison", url: "https://github.com/madison" },
      isAuthor: true,
      isDraft: false,
      isReviewRequested: false,
      number: 42,
      repository: {
        forge: "github",
        host: "github.com",
        owner: "diffdiff",
        repo: "diffdiff",
      },
      title: "Ship the PR dashboard",
      updatedAt: "2026-04-03T14:00:00Z",
      url: "https://github.com/diffdiff/diffdiff/pull/42",
    },
    {
      author: { login: "octocat", url: "https://github.com/octocat" },
      isAuthor: false,
      isDraft: true,
      isReviewRequested: true,
      number: 52,
      repository: {
        forge: "github",
        host: "github.com",
        owner: "acme",
        repo: "widgets",
      },
      title: "Widget review request for dashboard follow-up",
      updatedAt: "2026-04-03T15:00:00Z",
      url: "https://github.com/acme/widgets/pull/52",
    },
  ];
}

function createPreparedSession(
  overrides: Partial<PreparedReviewSession> = {},
): PreparedReviewSession {
  const session: PreparedReviewSession = {
    repository: {
      kind: "git",
      rootPath: "/tmp/diffdiff",
      name: "diffdiff",
      remotes: [{ name: "origin", fetchUrl: "git@github.com:diffdiff/diffdiff.git" }],
      currentBranch: "feature/tui",
      defaultBranch: "main",
    },
    comparison: {
      base: "origin/main",
      baseSha: "fedcba0",
      head: "feature/tui",
      headSha: "1234567",
      range: "origin/main...feature/tui",
      mode: "range",
      usesMergeBase: true,
    },
    files: [createPreparedFile(), createPreparedFile({ path: "src/utils.ts" })],
    branches: {
      local: [
        {
          kind: "local",
          name: "feature/tui",
          ref: "refs/heads/feature/tui",
          sha: "1234567",
          isCurrent: true,
          isDefault: false,
        },
        {
          kind: "local",
          name: "main",
          ref: "refs/heads/main",
          sha: "7654321",
          isCurrent: false,
          isDefault: true,
        },
      ],
      remote: [
        {
          kind: "remote",
          name: "origin/feature/tui",
          ref: "refs/remotes/origin/feature/tui",
          sha: "abcdef0",
          remoteName: "origin",
          isCurrent: false,
          isDefault: false,
          pullRequest: {
            number: 42,
            title: "Build TUI reviewer",
            url: "https://github.com/diffdiff/diffdiff/pull/42",
            headRefName: "feature/tui",
            baseRefName: "main",
          },
        },
        {
          kind: "remote",
          name: "origin/main",
          ref: "refs/remotes/origin/main",
          sha: "fedcba0",
          remoteName: "origin",
          isCurrent: false,
          isDefault: true,
        },
      ],
    },
    commits: [
      {
        sha: "1234567890abcdef",
        shortSha: "1234567",
        subject: "Revamp the list modal",
        author: "Madison Bullard",
      },
    ],
    workingTreeSummary: {
      filesChanged: 3,
      additions: 12,
      deletions: 4,
    },
    renderFingerprint: {
      baseRef: "origin/main",
      headRef: "feature/tui",
      comparisonMode: "range",
      baseSha: "fedcba0",
      headSha: "1234567",
      fileCount: 2,
      patchDigest: "placeholder",
    },
    warnings: [],
    themeName: "pierre-dark",
    ...overrides,
  };

  return {
    ...session,
    renderFingerprint: overrides.renderFingerprint ?? buildReviewSessionFingerprint(session),
  };
}

function createGitHubReviewSession(
  overrides: Partial<NonNullable<PreparedReviewSession["github"]>> = {},
): NonNullable<PreparedReviewSession["github"]> {
  return {
    auth: {
      host: "github.com",
      isAuthenticated: true,
      tokenSource: "config",
    },
    pullRequest: {
      author: {
        login: "madison",
        url: "https://github.com/madison",
      },
      baseRefName: "main",
      body: "Adds PR review mode.",
      checks: {
        failed: 0,
        pending: 0,
        state: "success",
        successful: 1,
        total: 1,
      },
      changedFileCount: 2,
      changedFiles: createGitHubChangedFilesByPath({
        "src/app.ts": "UNVIEWED",
        "src/utils.ts": "UNVIEWED",
      }),
      commitCount: 1,
      conversationItems: [
        {
          author: {
            login: "octocat",
            url: "https://github.com/octocat",
          },
          body: "Can we tighten the rollout copy?",
          createdAt: "2026-04-01T11:58:00Z",
          id: "pull-request-comment:501",
          kind: "pull-request-comment",
          updatedAt: "2026-04-01T11:58:00Z",
          url: "https://github.com/diffdiff/diffdiff/pull/42#issuecomment-501",
        },
        {
          author: {
            login: "octocat",
            url: "https://github.com/octocat",
          },
          body: "Looks ready to merge.",
          createdAt: "2026-04-01T12:00:00Z",
          id: "review:700",
          kind: "review",
          reviewId: 700,
          reviewNodeId: "PRR_700",
          reviewState: "APPROVED",
          updatedAt: "2026-04-01T12:00:00Z",
          url: "https://github.com/diffdiff/diffdiff/pull/42#pullrequestreview-700",
        },
      ],
      headRefName: "feature/tui",
      headSha: "headsha",
      isDraft: false,
      isMerged: false,
      issueCommentCount: 1,
      latestOpinionatedReviews: [
        {
          author: {
            login: "octocat",
            url: "https://github.com/octocat",
          },
          state: "APPROVED",
          updatedAt: "2026-04-01T12:00:00Z",
        },
      ],
      merge: {
        canMerge: true,
        allowedMethods: ["merge", "squash"],
        isDraft: false,
        isMerged: false,
        mergeable: true,
        mergeableState: "clean",
      },
      nodeId: "PR_node_42",
      number: 42,
      pendingReview: {
        body: "",
        comments: [],
        id: 9010,
        nodeId: "PRR_pending_9010",
      },
      reviewCommentCount: 2,
      reviewDecision: "APPROVED",
      reviewGroups: [
        {
          author: {
            login: "octocat",
            url: "https://github.com/octocat",
          },
          body: "Looks ready to merge.",
          comments: [
            {
              author: {
                login: "octocat",
                url: "https://github.com/octocat",
              },
              body: "Please rename this variable.",
              createdAt: "2026-04-01T12:01:00Z",
              id: 101,
              isOutdated: false,
              line: 1,
              nodeId: "PRRC_101",
              path: "src/app.ts",
              reviewId: 700,
              side: "RIGHT",
              updatedAt: "2026-04-01T12:01:00Z",
              url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r101",
            },
          ],
          reviewId: 700,
          reviewNodeId: "PRR_700",
          state: "APPROVED",
          submittedAt: "2026-04-01T12:00:00Z",
        },
      ],
      reviewRequests: [],
      reviewThreads: [
        {
          comments: [
            {
              author: {
                login: "octocat",
                url: "https://github.com/octocat",
              },
              body: "Please rename this variable.",
              createdAt: "2026-04-01T12:01:00Z",
              id: 101,
              isOutdated: false,
              line: 1,
              nodeId: "PRRC_101",
              path: "src/app.ts",
              reviewId: 700,
              side: "RIGHT",
              updatedAt: "2026-04-01T12:01:00Z",
              url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r101",
            },
            {
              author: {
                login: "madison",
                url: "https://github.com/madison",
              },
              body: "I renamed it in the follow-up commit.",
              createdAt: "2026-04-01T12:02:00Z",
              id: 103,
              isOutdated: false,
              line: 1,
              nodeId: "PRRC_103",
              path: "src/app.ts",
              replyToId: 101,
              reviewId: 700,
              side: "RIGHT",
              updatedAt: "2026-04-01T12:02:00Z",
              url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r103",
            },
          ],
          id: "101",
          isOutdated: false,
          line: 1,
          path: "src/app.ts",
          reviewId: 700,
          side: "RIGHT",
        },
        {
          comments: [
            {
              author: {
                login: "review-bot",
                url: "https://github.com/review-bot",
              },
              body: "This thread is outdated.",
              createdAt: "2026-04-01T12:03:00Z",
              id: 102,
              isOutdated: true,
              nodeId: "PRRC_102",
              originalLine: 1,
              path: "src/app.ts",
              reviewId: 701,
              side: "RIGHT",
              updatedAt: "2026-04-01T12:03:00Z",
              url: "https://github.com/diffdiff/diffdiff/pull/42#discussion_r102",
            },
          ],
          id: "102",
          isOutdated: true,
          originalLine: 1,
          path: "src/app.ts",
          reviewId: 701,
          side: "RIGHT",
        },
      ],
      state: "open",
      updatedAt: "2026-04-01T12:03:00Z",
      title: "Build TUI reviewer",
      url: "https://github.com/diffdiff/diffdiff/pull/42",
    },
    remoteName: "origin",
    repository: {
      forge: "github",
      host: "github.com",
      owner: "diffdiff",
      repo: "diffdiff",
    },
    repositoryRootPath: "/tmp/diffdiff",
    ...overrides,
  };
}

function createPreparedFile(overrides: Partial<PreparedReviewFile> = {}): PreparedReviewFile {
  return {
    additions: 3,
    deletions: 1,
    diff: undefined,
    isBinary: false,
    lineNumberWidth: 2,
    patch: "diff --git a/src/app.ts b/src/app.ts",
    path: "src/app.ts",
    renderError: undefined,
    sideBySideRows: [
      {
        kind: "hunk",
        segments: [{ text: "@@ -1,2 +1,3 @@" }],
      },
      {
        kind: "line",
        left: {
          kind: "deletion",
          lineNumber: 1,
          segments: [{ text: "const count = 0", fg: "#ff7b72" }],
        },
        right: {
          kind: "addition",
          lineNumber: 1,
          segments: [{ text: "const count = 1", fg: "#3fb950" }],
        },
      },
    ],
    status: "modified",
    unifiedLines: [
      {
        kind: "hunk",
        segments: [{ text: "@@ -1,2 +1,3 @@" }],
      },
      {
        kind: "deletion",
        oldLineNumber: 1,
        segments: [{ text: "const count = 0", fg: "#ff7b72" }],
      },
      {
        kind: "addition",
        newLineNumber: 1,
        segments: [{ text: "const count = 1", fg: "#3fb950" }],
      },
    ],
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function emitKey(key: KeyboardInput): void {
  act(() => {
    for (const handler of Array.from(registeredKeyboardHandlers)) {
      handler(key);
    }
  });
}

async function emitAsyncKey(key: KeyboardInput): Promise<void> {
  await act(async () => {
    for (const handler of Array.from(registeredKeyboardHandlers)) {
      handler(key);
    }
  });
}

function emitText(value: string): void {
  for (const character of value) {
    emitKey({ name: character, sequence: character });
  }
}

function getTreeScrollbox(tree: ReactTestRenderer) {
  return tree.root.findAll((node) => String(node.type) === "scrollbox")[0]!;
}

function getDiffScrollbox(tree: ReactTestRenderer) {
  return tree.root.findAll((node) => String(node.type) === "scrollbox")[1]!;
}

function getRootBox(tree: ReactTestRenderer) {
  return tree.root.find((node) => String(node.type) === "box");
}

function getSelectedFileLabel(tree: ReactTestRenderer): string {
  return getAppText(tree);
}

function getSelectedFileCard(tree: ReactTestRenderer): ReactTestInstance {
  const selectedCard = tree.root
    .findAllByType(FileCard)
    .find((node) => node.props.isSelected === true);

  if (selectedCard == null) {
    throw new Error("Expected a selected file card.");
  }

  return selectedCard;
}

function getAppText(tree: ReactTestRenderer): string {
  return collectText(tree.toJSON());
}

function render(node: ReactNode, options: Partial<TestRendererOptions> = {}): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  const rendererOptions: TestRendererOptions | undefined =
    options.createNodeMock == null ? undefined : { createNodeMock: options.createNodeMock };

  act(() => {
    tree = create(node as never, rendererOptions);
  });
  renderedTrees.add(tree!);
  return tree!;
}

function createMockScrollbox(visible: boolean) {
  const listeners = new Set<() => void>();
  const scrollbox = {
    content: { y: 0 },
    emitScroll: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    height: 20,
    scrollTop: 0,
    scrollTo: vi.fn(({ y }: { x: number; y: number }) => {
      scrollbox.scrollTop = y;
    }),
    viewport: { height: 20 },
    verticalScrollBar: {
      visible,
      on: vi.fn((event: string, listener: () => void) => {
        if (event === "change") {
          listeners.add(listener);
        }
      }),
      off: vi.fn((event: string, listener: () => void) => {
        if (event === "change") {
          listeners.delete(listener);
        }
      }),
    },
  };

  return scrollbox;
}

function collectInstanceText(node: ReactTestInstance): string {
  return normalizeWhitespace(
    node.children
      .map((child) => (typeof child === "string" ? child : collectInstanceText(child)))
      .join(" "),
  );
}

function collectText(node: unknown): string {
  if (node == null) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child) => collectText(child)).join(" ");
  }

  if (typeof node === "object" && "children" in node) {
    const children = (node as { children?: unknown[] }).children;
    const content = (node as { props?: { content?: unknown } }).props?.content;
    return normalizeWhitespace(
      [
        typeof content === "string" ? content : "",
        children?.map((child) => collectText(child)).join(" ") ?? "",
      ].join(" "),
    );
  }

  return "";
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
