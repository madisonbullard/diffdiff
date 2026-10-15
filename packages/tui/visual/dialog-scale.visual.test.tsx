import { expect, test } from "bun:test";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo, numberedLines } from "./harness/fixture-repo.ts";
import { githubReview } from "./harness/review-fixture.ts";
import type { PreparedReviewSession } from "../src/types.ts";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { CommandPaletteModal } from "../src/components/command-palette-modal.tsx";
import { DialogUiProvider } from "../src/components/dialog/context.tsx";
import { getDefaultKeymaps, buildReverseKeymaps } from "../src/app/keymap/index.ts";
import { getUiTheme } from "../src/theme.ts";
import type { Renderable } from "@opentui/core";

test("200 commands render only the viewport, with the last selection visible", async () => {
  const commands = Array.from({ length: 200 }, (_, i) => ({
    value: `command-${i}`,
    title: `Command ${i}`,
    category: "Actions",
  }));
  const setup = await testRender(
    <DialogUiProvider
      value={{
        mode: "commands",
        reverse: buildReverseKeymaps(getDefaultKeymaps()),
        run: () => undefined,
        newline: "legacy",
      }}
    >
      <CommandPaletteModal
        commands={commands}
        commandBindingLabels={new Map()}
        querySurface={{ value: "", cursorOffset: 0 }}
        selectedIndex={199}
        theme={getUiTheme("pierre-dark")}
      />
    </DialogUiProvider>,
    { width: 80, height: 24 },
  );
  try {
    await act(async () => {
      await setup.renderOnce();
    });
    expect(setup.captureCharFrame()).toContain("Command 199");
    expect(setup.captureCharFrame()).not.toContain("Command 0");
    const count = (node: Renderable): number =>
      1 + node.getChildren().reduce((total, child) => total + count(child), 0);
    expect(count(setup.renderer.root)).toBeLessThan(150);
  } finally {
    setup.renderer.destroy();
  }
});
test("large branch and reviewer lists keep renderables bounded and selections visible", async () => {
  const repo = createFixtureRepo([{ path: "a.ts", after: numberedLines("scale", 3) }]);
  const github = githubReview(repo.path, []);
  github.auth.isAuthenticated = true;
  let prepared!: PreparedReviewSession;
  const app = await launchApp(repo, {
    width: 80,
    height: 24,
    prepare: (session) =>
      (prepared = {
        ...session,
        github,
        branches: {
          local: Array.from({ length: 1000 }, (_, i) => ({
            name: `topic-${String(i).padStart(4, "0")}`,
            ref: `topic-${i}`,
            kind: "local" as const,
            sha: "a".repeat(40),
            isCurrent: false,
            isDefault: false,
          })),
          remote: [],
        },
      }),
    props: {
      loadComparisonBrowserData: async () => prepared,
      listReviewerCandidates: async () => ({
        users: Array.from({ length: 2000 }, (_, i) => ({ login: `person-${i}` })),
        recommendationsUnavailable: false,
      }),
    },
  });
  try {
    await app.press("l", "\x1b[F");
    expect(app.frame()).toContain("topic-0999");
    expect(app.renderableCount()).toBeLessThan(400);
    await app.press("\x1b");
    await app.waitFor(() => !app.frame().includes("Compare"));
    await app.press(" ", "w");
    expect(app.frame()).toContain("2000 matching users");
    expect(app.renderableCount()).toBeLessThan(400);
    await app.paste("person-1999");
    expect(app.frame()).toContain("@person-1999");
    expect(app.renderableCount()).toBeLessThan(400);
  } finally {
    app.destroy();
    repo.dispose();
  }
});
