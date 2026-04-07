import { expect, test, vi } from "vite-plus/test";
import { createViewActions } from "../src/app/shell/view-actions.ts";
import * as sessionReopenCommand from "../src/session-reopen-command.ts";

test("suspends and resumes the renderer around editor handoff", async () => {
  const suspend = vi.fn<() => void>();
  const resume = vi.fn<() => void>();
  const openFileInEditor = vi.fn<(repositoryRootPath: string, filePath: string) => Promise<void>>(
    async () => undefined,
  );
  const setStatusMessage = vi.fn<(message: string) => void>();
  const handleAppError = vi.fn<() => void>();

  const viewActions = createViewActions({
    derived: {
      selectedFilePath: "src/app.ts",
      selectedTreeNode: undefined,
    } as unknown as Parameters<typeof createViewActions>[0]["derived"],
    persistence: {
      persistenceApi: {
        handleAppError,
      },
    } as unknown as Parameters<typeof createViewActions>[0]["persistence"],
    props: {
      openFileInEditor,
    },
    state: {
      activePane: "diff",
      renderer: {
        resume,
        suspend,
      },
      session: {
        repository: {
          rootPath: "/tmp/diffdiff",
        },
      },
      setStatusMessage,
    } as unknown as Parameters<typeof createViewActions>[0]["state"],
  });

  await viewActions.openFocusedFileInEditor();

  expect(suspend).toHaveBeenCalledTimes(1);
  expect(openFileInEditor).toHaveBeenCalledWith("/tmp/diffdiff", "src/app.ts");
  expect(resume).toHaveBeenCalledTimes(1);
  expect(suspend.mock.invocationCallOrder[0]).toBeLessThan(
    openFileInEditor.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(openFileInEditor.mock.invocationCallOrder[0]).toBeLessThan(
    resume.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(setStatusMessage).toHaveBeenCalledWith("Opened src/app.ts in the editor.");
  expect(handleAppError).not.toHaveBeenCalled();
});

test("copies a reopen command for the current review session", async () => {
  const showToast = vi.fn<(message: string) => void>();
  const handleAppError = vi.fn<() => void>();
  const copySessionReopenCommand = vi
    .spyOn(sessionReopenCommand, "copySessionReopenCommand")
    .mockResolvedValue("osascript -e '...'");

  try {
    const viewActions = createViewActions({
      derived: {} as Parameters<typeof createViewActions>[0]["derived"],
      persistence: {
        persistenceApi: {
          handleAppError,
          showToast,
        },
      } as unknown as Parameters<typeof createViewActions>[0]["persistence"],
      props: {
        openFileInEditor: vi.fn(async () => undefined),
      },
      state: {
        session: {
          comparison: {
            base: "origin/main",
            head: "feature/review-window",
            mode: "range",
          },
          repository: {
            rootPath: "/tmp/diffdiff",
          },
        },
        startupOptions: {
          initialListMode: "pull-requests",
          verbose: true,
        },
      } as unknown as Parameters<typeof createViewActions>[0]["state"],
    });

    await viewActions.copyCurrentSessionReopenCommand();

    expect(copySessionReopenCommand).toHaveBeenCalledWith({
      comparison: {
        base: "origin/main",
        head: "feature/review-window",
        mode: "range",
      },
      initialListMode: "pull-requests",
      repositoryRootPath: "/tmp/diffdiff",
      verbose: true,
    });
    expect(showToast).toHaveBeenCalledWith("Copied reopen command to clipboard");
    expect(handleAppError).not.toHaveBeenCalled();
  } finally {
    copySessionReopenCommand.mockRestore();
  }
});
