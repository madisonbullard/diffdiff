import { describe, expect, test } from "vite-plus/test";
import type { KeyTrieNode } from "../src/app/keymap/types.ts";
import * as A from "../src/app/keymap/actions.ts";
import { getPrefixMenuCommands, getPrefixMenuConfig } from "../src/app/commands/prefix-menus.ts";
import { MutableTrieNode } from "../src/app/keymap/trie.ts";
import type { KeymapMode } from "../src/app/shell/keymap-mode.ts";

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

  test("derives picker commands from the live prefix node", () => {
    const diff = new MutableTrieNode();
    const goto = diff.getOrCreateChild("g", { label: "Goto" });
    goto.setAction("x", A.SYSTEM_HELP);
    goto.setAction("y", A.GOTO_FIRST_FILE);
    goto.setAction("z", A.GOTO_FIRST_FILE);
    const keymaps = new Map<KeymapMode, KeyTrieNode>([["diff", diff.freeze()]]);

    expect(
      getPrefixMenuCommands(
        [
          {
            category: "System",
            run: () => undefined,
            title: "Open help",
            value: A.SYSTEM_HELP,
          },
        ],
        "g",
        keymaps,
        "diff",
      ),
    ).toEqual([
      {
        actionId: A.SYSTEM_HELP,
        enabled: true,
        label: "x",
        title: "Open help",
      },
      {
        actionId: A.GOTO_FIRST_FILE,
        enabled: true,
        label: "y / z",
        title: "Jump to first file",
      },
    ]);
  });

  test("uses app command metadata for shared modal picker entries", () => {
    const diff = new MutableTrieNode();
    diff.getOrCreateChild("space", { label: "Modal Picker" }).setAction("l", A.COMPARISON_LIST);
    const keymaps = new Map<KeymapMode, KeyTrieNode>([["diff", diff.freeze()]]);

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
        keymaps,
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
