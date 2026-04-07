import { expect, test, vi } from "vite-plus/test";
import { createViewActions } from "../src/app/shell/view-actions.ts";

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
