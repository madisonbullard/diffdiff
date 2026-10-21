import { expect, test } from "bun:test";
import { act } from "react";
import { launchApp } from "./harness/app-harness.tsx";
import { createFixtureRepo } from "./harness/fixture-repo.ts";

for (const [width, height] of [
  [120, 40],
  [80, 24],
]) {
  test(`error toast X dismisses through native mouse input at ${width}x${height}`, async () => {
    const repo = createFixtureRepo([{ path: "test.ts", after: "export const test = true;\n" }]);
    const app = await launchApp(repo, {
      width,
      height,
      props: {
        syncRemotes: async () => undefined,
        probeFreshness: async () => {
          throw new Error("Toast dismissal test");
        },
      },
    });
    try {
      await act(async () => {
        app.renderer.emit("blur");
        app.renderer.emit("focus");
      });
      await app.settle();
      const rows = app.frame().split("\n");
      const y = rows.findIndex((row) => row.includes("Error") && row.includes(" X "));
      expect(y >= 0).toBe(true);
      await app.click(rows[y]!.indexOf(" X ") + 1, y);
      expect(app.frame()).not.toContain("Error");
    } finally {
      app.destroy();
      repo.dispose();
    }
  });
}
