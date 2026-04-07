import { describe, expect, test } from "vite-plus/test";
import { buildReverseKeymaps, getDefaultKeymaps } from "../src/app/keymap/index.ts";
import * as A from "../src/app/keymap/actions.ts";
import { getPrefixMenuCommands, getPrefixMenuConfig } from "../src/app/commands/prefix-menus.ts";

describe("prefix menus", () => {
  test("registers picker metadata for the shared command-picker prefixes", () => {
    expect(getPrefixMenuConfig("space")?.picker).toMatchObject({
      description: "Press a key to open a modal.",
      title: "Modal Picker",
    });
    expect(getPrefixMenuConfig("g")?.picker).toMatchObject({
      description: "Press a key to jump around the comparison.",
      title: "Goto",
    });
    expect(getPrefixMenuConfig("s")?.picker).toMatchObject({
      description: "Press a key to jump within the selected file.",
      title: "In File",
    });
  });

  test("builds goto picker commands from prefix metadata without app commands", () => {
    const reverseKeymaps = buildReverseKeymaps(getDefaultKeymaps());

    expect(getPrefixMenuCommands([], "g", reverseKeymaps, "diff")).toEqual([
      {
        actionId: A.GOTO_FIRST_FILE,
        enabled: true,
        label: "g",
        title: "Jump to first file",
      },
      {
        actionId: A.GOTO_LAST_FILE,
        enabled: true,
        label: "e",
        title: "Jump to last file",
      },
      {
        actionId: A.GOTO_WINDOW_TOP,
        enabled: true,
        label: "t",
        title: "Jump to top",
      },
      {
        actionId: A.GOTO_WINDOW_CENTER,
        enabled: true,
        label: "c",
        title: "Jump to center",
      },
      {
        actionId: A.GOTO_WINDOW_BOTTOM,
        enabled: true,
        label: "b",
        title: "Jump to bottom",
      },
      {
        actionId: A.GOTO_NEXT_HUNK,
        enabled: true,
        label: "n",
        title: "Jump to next hunk",
      },
      {
        actionId: A.GOTO_PREVIOUS_HUNK,
        enabled: true,
        label: "p",
        title: "Jump to previous hunk",
      },
      {
        actionId: A.GOTO_LAST_ACCESSED_FILE,
        enabled: true,
        label: "a",
        title: "Jump to alternate file",
      },
    ]);
  });

  test("uses app command metadata for shared modal picker entries", () => {
    const reverseKeymaps = buildReverseKeymaps(getDefaultKeymaps());

    expect(
      getPrefixMenuCommands(
        [
          {
            category: "Comparison",
            enabled: false,
            run: () => undefined,
            title: "Open comparison list",
            value: A.COMPARISON_LIST,
          },
        ],
        "space",
        reverseKeymaps,
        "diff",
      ),
    ).toContainEqual({
      actionId: A.COMPARISON_LIST,
      enabled: false,
      label: "l",
      title: "Open comparison list",
    });
  });
});
