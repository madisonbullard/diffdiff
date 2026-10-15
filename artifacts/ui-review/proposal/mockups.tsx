// Native OpenTUI mockups for docs/plans/menu-modal-unification.md.
// Renders proposed dialog layouts headlessly (real Yoga layout and native
// cell buffer) over the dimmed real app frame, then writes span JSON + text.
// Rasterize with: swift artifacts/ui-review/render.swift "$PWD/artifacts/ui-review/proposal"
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { testRender } from "@opentui/react/test-utils";
import { act, type ReactNode } from "react";
import {
  createTerminalUiTheme,
  getUiTheme,
  type UiTheme,
} from "../../../packages/tui/src/theme.ts";
import {
  ActionBar,
  Backdrop,
  Blank,
  BOLD,
  DialogPanel,
  GlobalFooter,
  ITALIC,
  Matched,
  QueryRow,
  type Rect,
  resolveRect,
  Row,
  Rule,
  Section,
  Status,
  dialogTokens,
  type DialogTokens,
  innerWidth,
  pad,
  padX,
  padY,
  truncate,
  width,
} from "./ui.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const root = dirname(fileURLToPath(import.meta.url));
const reviewRoot = join(root, "..");

interface Ctx {
  cols: number;
  rows: number;
  t: DialogTokens;
  theme: UiTheme;
}

interface Mockup {
  name: string;
  description: string;
  before?: string;
  badge: string;
  status: string;
  /** Modal dialogs dim the app; key menus are non-modal and leave it as is. */
  scrim?: boolean;
  render: (ctx: Ctx) => ReactNode;
}

const inner = (rect: Rect) => innerWidth(rect);
/** Rows the panel spends on its title row, action bar, and vertical padding. */
const chrome = (rect: Rect) => 2 + 2 * padY(rect);

// ---------------------------------------------------------------------------
// Picker family: command palette and keys reference share one frame.
// ---------------------------------------------------------------------------

interface PaletteItem {
  group?: string;
  title: string;
  detail?: string;
  key?: string;
  section: string;
  disabled?: string;
}

const PALETTE: PaletteItem[] = [
  {
    section: "Suggested",
    group: "Pull request",
    title: "Open PR checks",
    detail: "1 failing, 1 running",
    key: "space s",
  },
  {
    section: "Suggested",
    group: "Pull request",
    title: "Request reviewers",
    detail: "alex requested",
    key: "space w",
  },
  {
    section: "Suggested",
    group: "Review",
    title: "Submit review",
    detail: "1 pending comment",
    key: "A",
  },
  { section: "Review", title: "Mark file reviewed", detail: "src/review.ts", key: "x" },
  { section: "Review", title: "Next unreviewed file", key: "u" },
  { section: "Review", title: "Add review comment", detail: "src/review.ts:2", key: "a" },
  { section: "Review", title: "Collapse or expand file", key: "c" },
  {
    section: "Review",
    title: "Mark all files reviewed",
    disabled: "PR viewed state syncs one file at a time",
  },
  {
    section: "Review",
    title: "Clear review marks",
    disabled: "PR viewed state syncs one file at a time",
  },
  {
    section: "Pull request",
    title: "Merge pull request",
    detail: "squash · checks failing",
    key: "m",
  },
  { section: "Pull request", title: "Open conversation", detail: "1 comment", key: "t" },
  { section: "Pull request", title: "Convert to draft", key: "space D" },
  { section: "Pull request", title: "Open pull request list", key: "p" },
  { section: "Pull request", title: "Copy PR URL", key: "y" },
  { section: "Pull request", title: "Reply to thread", disabled: "Focus a review thread first" },
  { section: "View", title: "Switch split / unified", key: "v" },
  { section: "View", title: "Switch pane", key: "tab" },
  { section: "View", title: "Open file in editor", key: "e" },
  { section: "Comparison", title: "Compare branches or commits", key: "l" },
  { section: "Comparison", title: "Refresh comparison", key: "R" },
  { section: "App", title: "Keyboard shortcuts", key: "?" },
  { section: "App", title: "Session diagnostics", key: "d" },
  { section: "App", title: "Copy reopen command", key: "Y" },
  { section: "App", title: "Quit", key: "q" },
];

function PaletteRows({
  items,
  query,
  height,
  t,
  cells,
  flat,
}: {
  items: PaletteItem[];
  query: string;
  height: number;
  t: DialogTokens;
  cells: number;
  flat: boolean;
}) {
  const rows: ReactNode[] = [];
  let section = "";
  let index = 0;
  for (const item of items) {
    if (rows.length >= height) break;
    if (!flat && item.section !== section) {
      if (section !== "") rows.push(<Blank key={`gap:${item.section}`} />);
      if (rows.length >= height - 1) break;
      rows.push(<Section key={`s:${item.section}`} label={item.section} t={t} />);
      section = item.section;
    }
    const cursor = index === 0;
    const keyLabel = item.disabled != null ? "" : (item.key ?? "");
    const meta = flat ? `${item.group ?? item.section}${keyLabel ? "  " : ""}` : "";
    const rightWidth = width(meta) + width(keyLabel);
    const titleBudget = cells - 2 - rightWidth - 2;
    const titleText = truncate(item.title, titleBudget);
    const detailBudget = titleBudget - width(titleText) - 2;
    const detail = item.disabled ?? item.detail;
    rows.push(
      <Row
        key={`r:${item.title}`}
        cursor={cursor}
        t={t}
        right={
          <>
            {meta !== "" ? <span fg={t.subtle}>{meta}</span> : null}
            <span fg={t.key}>{keyLabel}</span>
          </>
        }
      >
        <Matched
          text={titleText}
          query={query}
          t={t}
          base={item.disabled != null ? t.muted : t.text}
        />
        {detail != null && detailBudget > 6 ? (
          <span
            fg={item.disabled != null ? t.subtle : t.muted}
            attributes={item.disabled != null ? ITALIC : 0}
          >{`  ${truncate(detail, detailBudget)}`}</span>
        ) : null}
      </Row>,
    );
    index += 1;
  }
  return <>{rows}</>;
}

function Palette({ cols, rows, t }: Ctx, query = "") {
  const rect = resolveRect("picker", cols, rows);
  const items =
    query === ""
      ? PALETTE
      : PALETTE.filter(
          (item) =>
            item.section !== "Suggested" &&
            (item.title.toLowerCase().includes(query) ||
              item.section.toLowerCase().includes(query)),
        );
  const enabled = items
    .filter((item) => item.disabled == null)
    .concat(items.filter((item) => item.disabled != null));
  const bodyRows = rect.height - chrome(rect) - 1;
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Commands"
      tabs={[
        { label: "Commands", active: true },
        { label: "Keys", active: false },
      ]}
      position={`1/${enabled.length}`}
      actions={
        <ActionBar
          t={t}
          width={inner(rect)}
          hints={[
            { key: "enter", label: "run", primary: true },
            { key: "↑↓", label: "move" },
            { key: "tab", label: "keys" },
            { key: "ctrl+u", label: "clear" },
          ]}
        />
      }
    >
      <QueryRow
        query={query}
        placeholder="Search commands"
        t={t}
        cells={inner(rect)}
        right={query === "" ? `${enabled.length} commands` : `${enabled.length} matches`}
      />
      <PaletteRows
        items={enabled}
        query={query}
        height={bodyRows}
        t={t}
        cells={inner(rect)}
        flat={query !== ""}
      />
    </DialogPanel>
  );
}

const KEYS: { section: string; rows: [string, string][] }[] = [
  {
    section: "Diff pane · current",
    rows: [
      ["j k ↓ ↑", "Next / previous file"],
      ["] [", "Next / previous line or comment"],
      ["} {", "Grow selection down / up (shift+] [)"],
      ["i o", "Previous / next review thread"],
      ["a", "Comment on selected line"],
      ["x", "Mark file reviewed"],
      ["c z", "Collapse or expand file"],
      ["pgdn pgup ^d ^u", "Scroll page / half page"],
      ["gg ge", "First / last file (with count: 5gg)"],
      ["gn gp", "Next / previous hunk"],
    ],
  },
  {
    section: "Menus",
    rows: [
      ["space", "Open… (PR, review, checks, merge)"],
      ["ctrl+x", "Leader: every command, e.g. ctrl+x e"],
      ["g", "Go to…"],
      ["ctrl+p", "Commands"],
    ],
  },
  {
    section: "Anywhere",
    rows: [
      ["tab", "Switch file tree / diff"],
      ["v", "Split or unified diff"],
      ["R", "Refresh comparison"],
      ["q", "Quit"],
    ],
  },
];

function KeysView({ cols, rows, t }: Ctx) {
  const rect = resolveRect("picker", cols, rows);
  const keyWidth = 18;
  const bodyRows = rect.height - chrome(rect) - 1;
  const lines: ReactNode[] = [];
  let first = true;
  for (const section of KEYS) {
    if (lines.length >= bodyRows) break;
    if (!first) lines.push(<Blank key={`b:${section.section}`} />);
    first = false;
    lines.push(<Section key={section.section} label={section.section} t={t} />);
    for (const [keys, label] of section.rows) {
      if (lines.length >= bodyRows) break;
      const cursor = lines.length === 1;
      lines.push(
        <Row key={`${section.section}:${keys}`} cursor={cursor} t={t}>
          <span fg={t.key} attributes={BOLD}>
            {pad(keys, keyWidth)}
          </span>
          <span fg={t.text}>{truncate(label, inner(rect) - keyWidth - 4)}</span>
        </Row>,
      );
    }
  }
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Keys"
      tabs={[
        { label: "Commands", active: false },
        { label: "Keys", active: true },
      ]}
      position="diff pane"
      actions={
        <ActionBar
          t={t}
          width={inner(rect)}
          hints={[
            { key: "enter", label: "run", primary: true },
            { key: "↑↓", label: "move" },
            { key: "tab", label: "commands" },
          ]}
        />
      }
    >
      <QueryRow
        query=""
        placeholder="Search keys or actions"
        t={t}
        cells={inner(rect)}
        right="from your keymap"
      />
      {lines}
    </DialogPanel>
  );
}

// ---------------------------------------------------------------------------
// Key menus (which-key): bottom-right popover that never hides the diff.
// ---------------------------------------------------------------------------

function SpaceMenu({ cols, rows, t }: Ctx) {
  const groups: { label: string; items: [string, string][] }[] = [
    {
      label: "Pull request",
      items: [
        ["s", "Checks · 1 failing"],
        ["t", "Conversation"],
        ["w", "Request reviewers"],
        ["m", "Merge"],
        ["D", "Convert to draft"],
        ["p", "Pull request list"],
      ],
    },
    {
      label: "Review",
      items: [
        ["a", "Comment on line"],
        ["A", "Submit review"],
      ],
    },
    {
      label: "App",
      items: [
        ["l", "Compare"],
        ["d", "Diagnostics"],
        ["h", "Keys"],
        ["Y", "Copy reopen command"],
      ],
    },
  ];
  const twoColumns = cols >= 100;
  const keyColumn =
    Math.max(...groups.flatMap((group) => group.items.map(([key]) => width(key)))) + 2;
  const colWidth = 24;
  const menuWidth = Math.min(twoColumns ? colWidth * 2 + 2 + 4 : 34, cols - 4);
  const columns: (typeof groups)[] = twoColumns ? [[], []] : [[]];
  let heights = columns.map(() => 0);
  for (const group of groups) {
    const target = heights.indexOf(Math.min(...heights));
    columns[target]!.push(group);
    heights[target] =
      heights[target]! + group.items.length + 1 + (columns[target]!.length > 1 ? 1 : 0);
  }
  const bodyRows = Math.max(...heights);
  const height = bodyRows + 3;
  const rect: Rect = {
    left: cols - menuWidth - 2,
    top: rows - 2 - height,
    width: menuWidth,
    height,
    sheet: false,
  };
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="space"
      context="open"
      closeLabel="esc"
      zIndex={30}
      popover
    >
      <box flexDirection="row" gap={2}>
        {columns.map((column, columnIndex) => (
          <box
            key={columnIndex}
            flexDirection="column"
            width={twoColumns ? colWidth : menuWidth - 2 * padX(rect)}
          >
            {column.map((group, groupIndex) => (
              <box key={group.label} flexDirection="column">
                {groupIndex > 0 ? <Blank /> : null}
                <text height={1} fg={t.muted} attributes={BOLD}>
                  {group.label}
                </text>
                {group.items.map(([key, label]) => (
                  <text key={key} height={1} wrapMode="none">
                    <span fg={label.includes("n/a") ? t.subtle : t.key} attributes={BOLD}>
                      {pad(key, keyColumn)}
                    </span>
                    <span fg={label.includes("n/a") ? t.subtle : t.text}>
                      {truncate(
                        label,
                        (twoColumns ? colWidth : menuWidth - 2 * padX(rect)) - keyColumn,
                      )}
                    </span>
                  </text>
                ))}
              </box>
            ))}
          </box>
        ))}
      </box>
    </DialogPanel>
  );
}

// ---------------------------------------------------------------------------
// Reviewer picker: multi-select with requested users, suggestions, and errors.
// ---------------------------------------------------------------------------

function Reviewers({ cols, rows, t }: Ctx, error = false) {
  const rect = resolveRect("picker", cols, rows);
  const cells = inner(rect);
  const people: {
    name: string;
    login: string;
    note?: string;
    state: "requested" | "selected" | "none";
    section: string;
  }[] = [
    {
      section: "Requested",
      name: "Alex Rivera",
      login: "alex",
      note: "requested",
      state: "requested",
    },
    {
      section: "Suggested by GitHub",
      name: "Sam Chen",
      login: "sam",
      note: "past commits",
      state: "selected",
    },
    {
      section: "Suggested by GitHub",
      name: "Priya Natarajan-Okonkwo-Fitzgerald",
      login: "priya",
      note: "past reviews",
      state: "selected",
    },
    { section: "Everyone", name: "Jordan Lee", login: "jordan", state: "none" },
    { section: "Everyone", name: "李小龍 Bruce Lee 🐉", login: "bruce", state: "none" },
    ...Array.from({ length: 26 }, (_, index) => ({
      section: "Everyone",
      name: `Person ${index + 5}`,
      login: `user-${index + 5}`,
      state: "none" as const,
    })),
  ];
  const bodyRows = rect.height - chrome(rect) - 1 - (error ? 1 : 0) - 1 - 1;
  const lines: ReactNode[] = [];
  let section = "";
  let index = 0;
  for (const person of people) {
    if (lines.length >= bodyRows) break;
    if (person.section !== section) {
      if (section !== "") {
        lines.push(<Blank key={`b:${person.section}`} />);
        if (lines.length >= bodyRows) break;
      }
      lines.push(<Section key={person.section} label={person.section} t={t} />);
      section = person.section;
      if (lines.length >= bodyRows) break;
    }
    const cursor = index === 1;
    const mark = person.state === "requested" ? "✓" : person.state === "selected" ? "[x]" : "[ ]";
    const markColor =
      person.state === "requested" ? t.subtle : person.state === "selected" ? t.success : t.muted;
    const note = person.note ?? "";
    const nameBudget = cells - 2 - 4 - width(`@${person.login}`) - 3 - width(note) - 2;
    lines.push(
      <Row
        key={person.login}
        cursor={cursor}
        t={t}
        right={<span fg={person.state === "requested" ? t.subtle : t.muted}>{note}</span>}
      >
        <span fg={markColor} attributes={BOLD}>
          {pad(mark, 4)}
        </span>
        <span fg={person.state === "requested" ? t.muted : t.text}>
          {truncate(person.name, Math.max(8, nameBudget))}
        </span>
        <span fg={t.subtle}>{`  @${person.login}`}</span>
      </Row>,
    );
    index += 1;
  }
  const remaining = people.length - index;
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Request reviewers"
      context="#1 Improve the keyboard-driven review workflow"
      position="2/31 · 2 selected"
      status={
        error ? (
          <Status
            t={t}
            bleed={padX(rect)}
            tone="danger"
            glyph="✗"
            text={truncate(
              "Request failed: permission denied for @priya. Your selection is kept.",
              cells - 2,
            )}
          />
        ) : undefined
      }
      actions={
        <ActionBar
          t={t}
          width={inner(rect)}
          hints={[
            { key: "ctrl+s", label: error ? "retry 2" : "request 2", primary: true },
            { key: "enter", label: "toggle" },
            { key: "↑↓", label: "move" },
            { key: "ctrl+r", label: "reload" },
          ]}
        />
      }
    >
      <QueryRow
        query=""
        placeholder="Filter by name or @username"
        t={t}
        cells={cells}
        right="existing requests are kept"
      />
      <Rule t={t} />
      {lines}
      <text height={1} flexShrink={0} fg={t.subtle}>
        {remaining > 0 ? `  ↓ ${remaining} more` : ""}
      </text>
    </DialogPanel>
  );
}

// ---------------------------------------------------------------------------
// Compare: branches/commits tabs, inline facets instead of a nested dialog.
// ---------------------------------------------------------------------------

function Compare({ cols, rows, t }: Ctx) {
  const rect = resolveRect("picker", cols, rows);
  const cells = inner(rect);
  const branches = [
    { name: "Working tree", marks: "", subject: "0 files changed", age: "", kind: "tree" },
    {
      name: "feature",
      marks: "HEAD",
      subject: "head commit for the review fixture",
      age: "2d",
      kind: "local",
    },
    { name: "main", marks: "BASE", subject: "base", age: "2d", kind: "local" },
    ...Array.from({ length: 40 }, (_, index) => ({
      name: `topic/${index}-a-very-long-branch-name-that-keeps-going-and-going`,
      marks: "",
      subject: "head commit for the review fixture",
      age: `${index + 3}d`,
      kind: "local",
    })),
  ];
  const bodyRows = rect.height - chrome(rect) - 2 - 1 - 2;
  const nameWidth = Math.min(44, Math.floor(cells * 0.46));
  const lines = branches.slice(0, bodyRows).map((branch, index) => {
    const cursor = index === 1;
    const glyph =
      branch.kind === "tree"
        ? "◇"
        : branch.marks === "HEAD"
          ? "●"
          : branch.marks === "BASE"
            ? "◆"
            : " ";
    const markColor =
      branch.marks === "HEAD" ? t.key : branch.marks === "BASE" ? t.warning : t.muted;
    const subjectBudget = cells - 2 - 2 - nameWidth - 6 - 4 - 1;
    return (
      <Row key={branch.name} cursor={cursor} t={t} right={<span fg={t.subtle}>{branch.age}</span>}>
        <span fg={markColor}>{`${glyph} `}</span>
        <span fg={t.text}>{pad(truncate(branch.name, nameWidth - 1), nameWidth)}</span>
        <span fg={markColor} attributes={BOLD}>
          {pad(branch.marks.toLowerCase(), 6)}
        </span>
        <span fg={t.muted}>{truncate(branch.subject, Math.max(0, subjectBudget))}</span>
      </Row>
    );
  });
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Compare"
      tabs={[
        { label: "Branches", active: true },
        { label: "Commits", active: false },
      ]}
      context="base main ← head feature"
      position="2/43"
      actions={
        <ActionBar
          t={t}
          width={inner(rect)}
          hints={[
            { key: "enter", label: "set head", primary: true },
            { key: "b", label: "set base", primary: true },
            { key: "w", label: "working tree" },
            { key: "f", label: "show" },
            { key: "tab", label: "commits" },
          ]}
        />
      }
    >
      <QueryRow
        query=""
        placeholder="Filter branches"
        t={t}
        cells={cells}
        focused={false}
        right="/ to filter"
      />
      <text height={1} wrapMode="none">
        <span fg={t.muted}>{"  Show  "}</span>
        <span fg={t.success}>{"● "}</span>
        <span fg={t.text}>{"Working tree  "}</span>
        <span fg={t.success}>{"● "}</span>
        <span fg={t.text}>{"Local 42  "}</span>
        <span fg={t.success}>{"● "}</span>
        <span fg={t.text}>{"Open PRs 0  "}</span>
        <span fg={t.subtle}>{"○ Remote 0"}</span>
      </text>
      <Rule t={t} />
      {lines}
      <Rule t={t} />
      <text height={1} wrapMode="none" fg={t.muted}>
        <span fg={t.text} attributes={BOLD}>
          feature
        </span>
        <span>
          {truncate(
            "  52eb733 · head of comparison · upstream none · 1 commit ahead of main",
            cells - 8,
          )}
        </span>
      </text>
    </DialogPanel>
  );
}

function PullRequests({ cols, rows, t }: Ctx) {
  const prs = [
    {
      number: 42,
      title: "Improve the keyboard-driven review workflow",
      repo: "example/repo",
      author: "alex",
      flags: "review requested",
      age: "2h",
      draft: false,
    },
    {
      number: 41,
      title: "Add clearer review status indicators",
      repo: "example/repo",
      author: "sam",
      flags: "draft",
      age: "1d",
      draft: true,
    },
    {
      number: 318,
      title: "Speed up startup by deferring branch summaries until the browser opens",
      repo: "example/tools",
      author: "you",
      flags: "yours",
      age: "3d",
      draft: false,
    },
    {
      number: 7,
      title: "Docs: explain reviewed state sync",
      repo: "example/docs",
      author: "jordan",
      flags: "review requested",
      age: "5d",
      draft: false,
    },
    ...Array.from({ length: 36 }, (_, index) => ({
      number: 300 - index,
      title: `Fixture pull request ${index + 5} with a title long enough to truncate`,
      repo: index % 3 === 0 ? "example/tools" : "example/repo",
      author: `user-${index + 5}`,
      flags: index % 4 === 0 ? "review requested" : "yours",
      age: `${index + 6}d`,
      draft: index % 9 === 0,
    })),
  ];
  // Content-fit: chrome, query row, rule, one row per PR, capped by the breakpoint.
  const rect = resolveRect("picker", cols, rows, { contentRows: 4 + 2 + prs.length });
  const cells = inner(rect);
  const visible = prs.slice(0, rect.height - chrome(rect) - 2);
  const drafts = prs.filter((pr) => pr.draft).length;
  const awaiting = prs.filter((pr) => pr.flags.includes("review requested")).length;
  const numberWidth = 6;
  const metaWidth = Math.min(36, Math.floor(cells * 0.4));
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Pull requests"
      context="open · authored by you or awaiting your review"
      position={`1/${prs.length}`}
      actions={
        <ActionBar
          t={t}
          width={cells}
          hints={[
            { key: "enter", label: "review", primary: true },
            { key: "↑↓", label: "move" },
            { key: "y", label: "copy URL" },
            { key: "F", label: "refresh" },
          ]}
        />
      }
    >
      <QueryRow
        query=""
        placeholder="Filter by title, repo, author, or #number"
        t={t}
        cells={cells}
        right={`${prs.length} open · ${drafts} drafts · ${awaiting} awaiting you`}
      />
      <Rule t={t} />
      {visible.map((pr, index) => {
        const meta = `${pr.repo} · ${pr.author} · ${pr.flags}`;
        const titleBudget = cells - 2 - numberWidth - 2 - metaWidth - 1 - 3;
        return (
          <Row
            key={pr.number}
            cursor={index === 0}
            t={t}
            right={<span fg={t.subtle}>{pr.age}</span>}
          >
            <span fg={t.muted}>{pad(`#${pr.number}`, numberWidth)}</span>
            <span fg={pr.draft ? t.muted : t.text}>
              {pad(truncate(pr.title, titleBudget), titleBudget)}
            </span>
            <span
              fg={pr.flags.includes("review requested") ? t.warning : t.subtle}
            >{`  ${pad(truncate(meta, metaWidth), metaWidth)}`}</span>
          </Row>
        );
      })}
    </DialogPanel>
  );
}

function Conversation({ cols, rows, t }: Ctx) {
  const rect = resolveRect("inspector", cols, rows, { contentRows: rows < 30 ? undefined : 18 });
  const cells = inner(rect);
  const wide = !rect.sheet;
  const items = [
    {
      author: "alex",
      kind: "comment",
      age: "6h",
      body: "The keyboard shortcuts feel good. Please make destructive actions more explicit before merging.",
    },
    {
      author: "sam",
      kind: "changes requested",
      age: "5h",
      body: "Two inline comments on src/review.ts.",
    },
    {
      author: "you",
      kind: "comment",
      age: "1h",
      body: "> Please make destructive actions more explicit\n\nDone in the merge dialog — it now confirms inline.",
    },
  ];
  const listWidth = wide ? 44 : cells;
  const list = items.map((item, index) => (
    <Row key={index} cursor={index === 0} t={t} right={<span fg={t.subtle}>{item.age}</span>}>
      <span fg={t.text} attributes={BOLD}>
        {pad(item.author, 6)}
      </span>
      <span fg={item.kind === "changes requested" ? t.danger : t.muted}>
        {truncate(item.kind, listWidth - 14)}
      </span>
    </Row>
  ));
  const detail = (
    <box flexDirection="column" flexGrow={1}>
      <text height={1} wrapMode="none">
        <span fg={t.text} attributes={BOLD}>
          alex
        </span>
        <span fg={t.muted}>{"  commented 6 hours ago"}</span>
      </text>
      <Blank />
      <text fg={t.text} wrapMode="word">
        {items[0]!.body}
      </text>
    </box>
  );
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Conversation"
      context="#1 · 3 items · inline threads stay in the diff"
      position="1/3"
      actions={
        <ActionBar
          t={t}
          width={cells}
          hints={[
            { key: "r", label: "reply", primary: true },
            { key: "↑↓", label: "select" },
            { key: "y", label: "copy link" },
            { key: "pgup/pgdn", label: "scroll" },
          ]}
        />
      }
    >
      {wide ? (
        <box flexDirection="row" flexGrow={1} gap={1}>
          <box width={listWidth} flexDirection="column" flexShrink={0}>
            {list}
          </box>
          <box width={1} border={["left"]} borderColor={t.rule} />
          {detail}
        </box>
      ) : (
        <>
          {list}
          <Rule t={t} />
          {detail}
        </>
      )}
    </DialogPanel>
  );
}

// ---------------------------------------------------------------------------
// Inspector family: checks list + detail (side by side when wide).
// ---------------------------------------------------------------------------

function Checks({ cols, rows, t }: Ctx) {
  const rect = resolveRect("inspector", cols, rows, { contentRows: rows < 30 ? undefined : 16 });
  const cells = inner(rect);
  const wide = !rect.sheet;
  const checks = [
    {
      glyph: "✗",
      label: "failed",
      name: "Type checking",
      tone: t.danger,
      provider: "GitHub Actions",
    },
    {
      glyph: "◐",
      label: "running",
      name: "Build packages",
      tone: t.warning,
      provider: "GitHub Actions",
    },
    {
      glyph: "✓",
      label: "passed",
      name: "Unit tests",
      tone: t.success,
      provider: "GitHub Actions",
    },
  ];
  const listWidth = wide ? 40 : cells;
  const list = checks.map((check, index) => (
    <Row
      key={check.name}
      cursor={index === 0}
      t={t}
      right={<span fg={check.tone}>{check.label}</span>}
    >
      <span fg={check.tone} attributes={BOLD}>{`${check.glyph} `}</span>
      <span fg={t.text}>{truncate(check.name, listWidth - 14)}</span>
    </Row>
  ));
  const detail = (
    <box flexDirection="column" flexGrow={1}>
      <text height={1} wrapMode="none">
        <span fg={t.danger} attributes={BOLD}>
          {"✗ Type checking"}
        </span>
        <span fg={t.muted}>{"  failed · GitHub Actions · 4m 12s"}</span>
      </text>
      <Blank />
      <text fg={t.text} wrapMode="word">
        {
          "Type checking failed\n\nsrc/review.ts:3 — Expected a documented default.\nRun vp check before merging."
        }
      </text>
      <Blank />
      <text height={1} wrapMode="none" fg={t.key}>
        {truncate(
          "https://github.com/example/repo/actions/runs/1",
          wide ? cells - listWidth - 3 : cells,
        )}
      </text>
    </box>
  );
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Checks"
      context="#1 · 52eb733 · ✗ 1 failed  ◐ 1 running  ✓ 1 passed"
      position="1/3"
      actions={
        <ActionBar
          t={t}
          width={cells}
          hints={[
            { key: "y", label: "copy link", primary: true },
            { key: "↑↓", label: "select" },
            { key: "pgup/pgdn", label: "scroll details" },
            { key: "r", label: "refresh" },
          ]}
        />
      }
    >
      {wide ? (
        <box flexDirection="row" flexGrow={1} gap={1}>
          <box width={listWidth} flexDirection="column" flexShrink={0}>
            {list}
          </box>
          <box width={1} border={["left"]} borderColor={t.rule} />
          {detail}
        </box>
      ) : (
        <>
          {list}
          <Rule t={t} />
          {detail}
        </>
      )}
    </DialogPanel>
  );
}

// ---------------------------------------------------------------------------
// Form family: composer, submit review, merge (with inline confirmation).
// ---------------------------------------------------------------------------

function Composer({ cols, rows, t }: Ctx, state: "compose" | "autocomplete" | "submitting") {
  const rect = resolveRect("form", cols, rows, { contentRows: rows < 30 ? undefined : 16 });
  const cells = inner(rect);
  const submitting = state === "submitting";
  const lines =
    state === "autocomplete"
      ? [
          "Why does this default to true now? The old behaviour returned false",
          "for empty sessions — see @",
        ]
      : [
          "Why does this default to true now? The old behaviour returned false",
          "for empty sessions — see README.md before we merge.",
        ];
  const textColor = submitting ? t.muted : t.text;
  const editor = (
    <box flexDirection="column" flexGrow={1}>
      {lines.map((line, index) => (
        <text key={index} height={1} wrapMode="none" fg={textColor}>
          {line}
          {!submitting && index === lines.length - 1 ? (
            <span bg={t.key} fg={t.bg}>
              {" "}
            </span>
          ) : null}
        </text>
      ))}
    </box>
  );
  const popoverTop = rect.top + padY(rect) + 3 + lines.length;
  const popoverLeft = rect.left + padX(rect) + width(lines[lines.length - 1]!) - 2;
  return (
    <>
      <DialogPanel
        rect={rect}
        t={t}
        title="Comment"
        context="src/review.ts line 2 (removed) · pending review"
        tone={state === "autocomplete" ? "muted" : "focus"}
        status={
          submitting ? (
            <Status
              t={t}
              bleed={padX(rect)}
              tone="pending"
              glyph="◐"
              text="Adding comment to your pending review…"
            />
          ) : undefined
        }
        actions={
          <ActionBar
            t={t}
            width={cells}
            hints={
              state === "autocomplete"
                ? [
                    { key: "enter", label: "insert file", primary: true },
                    { key: "↑↓", label: "choose" },
                    { key: "esc", label: "dismiss" },
                  ]
                : submitting
                  ? [
                      { key: "esc", label: "close (keeps sending)", primary: true },
                      { key: "enter", label: "add comment", disabled: true },
                    ]
                  : [
                      { key: "enter", label: "add comment", primary: true },
                      { key: "alt+enter", label: "newline" },
                      { key: "@", label: "file" },
                      { key: "ctrl+x e", label: "$EDITOR" },
                    ]
            }
            right={state === "compose" ? [{ key: "↑", label: "drafts" }] : undefined}
          />
        }
      >
        <text height={1} wrapMode="none">
          <span fg={t.subtle}>{"  2 "}</span>
          <span fg={t.danger}>{"-   "}</span>
          <span fg={t.muted}>{"return false;"}</span>
        </text>
        <Rule t={t} />
        {editor}
      </DialogPanel>
      {state === "autocomplete" ? (
        <DialogPanel
          rect={{
            left: Math.min(popoverLeft, rect.left + rect.width - 38),
            top: popoverTop,
            width: 36,
            height: 5,
            sheet: false,
          }}
          t={t}
          title="@ file"
          closeLabel=""
          zIndex={30}
          raised
        >
          <Row cursor t={t} right={<span fg={t.subtle}>modified</span>}>
            <span fg={t.text}>README.md</span>
          </Row>
          <Row t={t} right={<span fg={t.subtle}>this file</span>}>
            <span fg={t.text}>src/review.ts</span>
          </Row>
        </DialogPanel>
      ) : null}
    </>
  );
}

function SubmitReview({ cols, rows, t }: Ctx) {
  const rect = resolveRect("form", cols, rows, { contentRows: rows < 30 ? undefined : 18 });
  const cells = inner(rect);
  const events: [string, string, string][] = [
    ["Comment", "Feedback without approval", t.key],
    ["Approve", "Mark ready to merge", t.success],
    ["Request changes", "Block merging until resolved", t.danger],
  ];
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Submit review"
      context="#1 · 1 pending comment"
      actions={
        <ActionBar
          t={t}
          width={cells}
          hints={[
            { key: "enter", label: "approve", primary: true },
            { key: "↑↓", label: "choose" },
            { key: "tab", label: "summary" },
          ]}
        />
      }
    >
      {events.map(([label, detail, color], index) => (
        <Row
          key={label}
          cursor={index === 1}
          t={t}
          right={<span fg={t.subtle}>{truncate(detail, Math.max(0, cells - 28))}</span>}
        >
          <span fg={color} attributes={BOLD}>
            {index === 1 ? "● " : "○ "}
          </span>
          <span fg={t.text}>{label}</span>
        </Row>
      ))}
      <Rule t={t} />
      <text height={1} wrapMode="none" fg={t.subtle}>
        {"Summary (optional) — tab to edit"}
      </text>
      <text height={1} wrapMode="none" fg={t.muted}>
        {"Looks good once the default is documented."}
      </text>
    </DialogPanel>
  );
}

function Merge({ cols, rows, t }: Ctx, state: "form" | "confirm" | "auto") {
  const rect = resolveRect("form", cols, rows, { contentRows: rows < 30 ? undefined : 21 });
  const cells = inner(rect);
  const confirming = state !== "form" ? true : false;
  const auto = state === "auto";
  const locked = confirming;
  const label = (text: string) => <span fg={t.muted}>{pad(text, 9)}</span>;
  const fieldColor = locked ? t.muted : t.text;
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Merge #1"
      context="feature → main · Improve the keyboard-driven review workflow"
      tone={confirming ? "warning" : "focus"}
      status={
        confirming ? (
          <Status
            t={t}
            bleed={padX(rect)}
            tone="warning"
            glyph="▲"
            text={
              auto
                ? "Enable auto-merge (squash)? GitHub merges #1 once its requirements pass."
                : "Squash-merge #1 into main, then clean up local refs? 1 check is failing."
            }
          />
        ) : (
          <Status
            t={t}
            bleed={padX(rect)}
            tone="warning"
            glyph="▲"
            text="1 check failing · 1 running · review required"
          />
        )
      }
      actions={
        <ActionBar
          t={t}
          width={cells}
          hints={
            confirming
              ? [
                  {
                    key: "enter",
                    label: auto ? "enable auto-merge" : "confirm squash-merge",
                    primary: true,
                    tone: "warning",
                  },
                  { key: "esc", label: "back to edit" },
                ]
              : [
                  { key: "enter", label: "squash-merge…", primary: true },
                  { key: "tab", label: "next field" },
                  { key: "ctrl+g", label: "auto-merge" },
                  { key: "ctrl+x e", label: "editor" },
                ]
          }
        />
      }
    >
      <text height={1} wrapMode="none">
        {label("Method")}
        <span fg={locked ? t.muted : t.key} attributes={BOLD}>
          {"● "}
        </span>
        <span fg={fieldColor} attributes={BOLD}>
          {"Squash"}
        </span>
        <span fg={t.subtle}>{"   ○ Merge commit   (rebase is not supported by diffdiff)"}</span>
      </text>
      <box height={1} flexShrink={0} flexDirection="row">
        <text flexGrow={1} wrapMode="none">
          {label("Options")}
          <span fg={auto ? t.success : t.muted} attributes={BOLD}>
            {auto ? "[x] " : "[ ] "}
          </span>
          <span fg={auto ? t.text : t.muted}>{"Auto-merge when requirements pass"}</span>
        </text>
        <text flexShrink={0} wrapMode="none" fg={t.subtle}>
          {"ctrl+g"}
        </text>
      </box>
      <box height={1} flexShrink={0} flexDirection="row">
        <text flexGrow={1} wrapMode="none">
          {label("")}
          <span fg={auto ? t.subtle : locked ? t.muted : t.success} attributes={BOLD}>
            {auto ? "[–] " : "[x] "}
          </span>
          <span fg={auto ? t.subtle : fieldColor}>{"Clean up local refs after merge"}</span>
        </text>
        <text flexShrink={0} wrapMode="none" fg={t.subtle}>
          {auto ? "not with auto-merge" : "feature, origin/feature"}
        </text>
      </box>
      <Rule t={t} />
      <text height={1} wrapMode="none">
        {label("Title")}
        <span fg={fieldColor}>
          {truncate("Improve the keyboard-driven review workflow (#1)", cells - 10)}
        </span>
        {!locked ? (
          <span bg={t.key} fg={t.bg}>
            {" "}
          </span>
        ) : null}
      </text>
      <Blank />
      <text height={1} wrapMode="none">
        {label("Body")}
        <span fg={fieldColor}>{"## Summary"}</span>
      </text>
      <text height={1} wrapMode="none">
        {label("")}
        <span fg={fieldColor}>
          {"Make review navigation faster and keep actions discoverable."}
        </span>
      </text>
      <text height={1} wrapMode="none">
        {label("")}
        <span fg={fieldColor}>{"- Preserve keyboard-first interactions"}</span>
      </text>
      <text height={1} wrapMode="none">
        {label("")}
        <span fg={fieldColor}>{"- Clarify destructive actions"}</span>
      </text>
    </DialogPanel>
  );
}

// ---------------------------------------------------------------------------
// Confirm family: clearing local review marks (post-merge cleanup is a merge option, D12).
// ---------------------------------------------------------------------------

function ClearReviewed({ cols, rows, t }: Ctx) {
  const rect = resolveRect("confirm", cols, rows, { contentRows: 7 });
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Clear review marks"
      tone="warning"
      actions={
        <ActionBar
          t={t}
          width={inner(rect)}
          hints={[
            { key: "enter", label: "clear 1 file", primary: true, tone: "warning" },
            { key: "esc", label: "cancel" },
          ]}
        />
      }
    >
      <text fg={t.text} wrapMode="word">
        {"1 reviewed file becomes unreviewed. Local only; the comparison stays open."}
      </text>
    </DialogPanel>
  );
}

function TooSmall({ cols, rows, t }: Ctx) {
  const rect: Rect = {
    left: 1,
    top: Math.max(0, Math.floor((rows - 9) / 2)),
    width: cols - 2,
    height: 9,
    sheet: false,
  };
  return (
    <DialogPanel
      rect={rect}
      t={t}
      title="Merge #1"
      tone="muted"
      actions={
        <ActionBar
          t={t}
          width={inner(rect)}
          hints={[{ key: "esc", label: "close", primary: true }]}
        />
      }
    >
      <text
        fg={t.text}
        wrapMode="word"
      >{`Merge needs at least 60×18 cells; this terminal is ${cols}×${rows}.`}</text>
      <text fg={t.muted} wrapMode="word">
        {"Enlarge the window or press ctrl+x e to edit the message in $EDITOR."}
      </text>
    </DialogPanel>
  );
}

// ---------------------------------------------------------------------------
// Catalog and capture.
// ---------------------------------------------------------------------------

const MOCKUPS: Mockup[] = [
  {
    name: "p01-commands",
    before: "05-command-palette",
    badge: "COMMANDS",
    status: "",
    description: "Picker · command palette, grouped, one row per command, primary key only",
    render: (c) => Palette(c),
  },
  {
    name: "p02-commands-filtered",
    before: "05-command-palette",
    badge: "COMMANDS",
    status: "",
    description: "Picker · filtered (flat list, match highlight, section as metadata)",
    render: (c) => Palette(c, "rev"),
  },
  {
    name: "p03-keys",
    before: "06-help-diff",
    badge: "KEYS",
    status: "",
    description:
      "Picker · Keys tab: searchable reference generated from the keymap, current pane first",
    render: KeysView,
  },
  {
    name: "p04-space-menu",
    before: "01-space-menu",
    badge: "SPACE",
    status: "",
    description:
      "Key menu · non-modal which-key popover, key-first, grouped; the app stays undimmed",
    scrim: false,
    render: SpaceMenu,
  },
  {
    name: "p06-reviewers",
    before: "15-reviewer-selected",
    badge: "REVIEWERS",
    status: "",
    description:
      "Picker · multi-select: requested ✓, chosen [x], cursor ›, sections, long + wide names",
    render: (c) => Reviewers(c),
  },
  {
    name: "p07-reviewers-error",
    before: "15-reviewer-selected",
    badge: "REVIEWERS",
    status: "",
    description: "Picker · inline failure keeps selection and offers retry",
    render: (c) => Reviewers(c, true),
  },
  {
    name: "p08-compare",
    before: "08-compare-branches",
    badge: "COMPARE",
    status: "",
    description:
      "Picker · branches tab, inline facets replace Filters (D3), enter sets head (D8), 43 branches windowed",
    render: Compare,
  },
  {
    name: "p08b-pull-requests",
    before: "12-pull-requests",
    badge: "PULL REQUESTS",
    status: "",
    description:
      "Picker · one dense row per PR with number, author, state, and age; 40 PRs windowed",
    render: PullRequests,
  },
  {
    name: "p09-checks",
    before: "16-checks",
    badge: "CHECKS",
    status: "",
    description: "Inspector · glyph + word status, list/detail side by side when wide",
    render: Checks,
  },
  {
    name: "p09b-conversation",
    before: "17-conversation",
    badge: "CONVERSATION",
    status: "",
    description: "Inspector · timeline list + readable detail; reply from the selected item",
    render: Conversation,
  },
  {
    name: "p10-comment",
    before: "19-inline-comment",
    badge: "COMMENT",
    status: "",
    description: "Form · composer: context line, editor gets the space, one action bar",
    render: (c) => Composer(c, "compose"),
  },
  {
    name: "p10b-comment-autocomplete",
    before: "18b-file-autocomplete",
    badge: "COMMENT",
    status: "",
    description:
      "Form · @file popover on a raised tint under the caret; it owns the keys and the bar",
    render: (c) => Composer(c, "autocomplete"),
  },
  {
    name: "p11-comment-submitting",
    before: "19-inline-comment",
    badge: "COMMENT",
    status: "",
    description:
      "Form · in-flight write: input paused, no duplicate submit, esc backgrounds the write (D9)",
    render: (c) => Composer(c, "submitting"),
  },
  {
    name: "p12-submit-review",
    before: "21-submit-review",
    badge: "SUBMIT",
    status: "",
    description: "Form · event radio with consequences, summary field",
    render: SubmitReview,
  },
  {
    name: "p13-merge",
    before: "24-merge",
    badge: "MERGE",
    status: "",
    description:
      "Form · method, auto-merge, remembered cleanup option (D12), title/body; hazards next to the action",
    render: (c) => Merge(c, "form"),
  },
  {
    name: "p14-merge-confirm",
    before: "25-confirm-merge",
    badge: "MERGE",
    status: "",
    description:
      "Form · inline two-step confirmation (D4): fields lock, ▲ title, warning band, warning primary",
    render: (c) => Merge(c, "confirm"),
  },
  {
    name: "p15-auto-merge-confirm",
    before: "27-confirm-auto-merge",
    badge: "MERGE",
    status: "",
    description: "Form · auto-merge confirmation names its own consequence, in full at 80×24",
    render: (c) => Merge(c, "auto"),
  },
  {
    name: "p17-clear-reviewed",
    before: "23-clear-reviewed",
    badge: "CONFIRM",
    status: "",
    description: "Confirm · small, named action and count",
    render: ClearReviewed,
  },
];

const SIZES: [number, number][] = [
  [120, 40],
  [80, 24],
];

const TERMINAL_THEME = createTerminalUiTheme(
  {
    defaultBackground: "#1e1e2e",
    defaultForeground: "#cdd6f4",
    palette: [
      "#45475a",
      "#f38ba8",
      "#a6e3a1",
      "#f9e2af",
      "#89b4fa",
      "#f5c2e7",
      "#94e2d5",
      "#bac2de",
      "#585b70",
      "#f38ba8",
      "#a6e3a1",
      "#f9e2af",
      "#89b4fa",
      "#f5c2e7",
      "#94e2d5",
      "#a6adc8",
    ],
  } as never,
  "dark",
);

const manifest: {
  name: string;
  size: string;
  theme: string;
  description: string;
  before?: string;
}[] = [];

async function capture(
  mockup: Mockup,
  cols: number,
  rows: number,
  themeName: string,
  theme: UiTheme,
  folder: string,
) {
  const t = dialogTokens(theme);
  const backdropPath = join(reviewRoot, `${cols}x${rows}`, "00-overview.txt");
  const backdrop = existsSync(backdropPath)
    ? readFileSync(backdropPath, "utf8").split("\n").slice(0, rows)
    : Array.from({ length: rows }, () => "");
  const setup = await testRender(
    <box
      width={cols}
      height={rows}
      backgroundColor={mockup.scrim === false ? t.appBg : t.backdropBg}
    >
      <Backdrop lines={backdrop} t={t} cols={cols} scrim={mockup.scrim ?? true} />
      {mockup.render({ cols, rows, t, theme })}
      <GlobalFooter
        badge={mockup.badge}
        status={mockup.status}
        cols={cols}
        rows={rows}
        t={t}
        right={mockup.badge === "SPACE" ? "waiting for key" : undefined}
      />
    </box>,
    { width: cols, height: rows },
  );
  await act(async () => {
    await setup.renderOnce();
  });
  await act(async () => {
    await setup.renderOnce();
  });
  const lines = setup.renderer.currentRenderBuffer.getSpanLines().map((line) =>
    line.spans.map((span) => ({
      text: span.text,
      width: span.width,
      attributes: span.attributes,
      fg: [span.fg.r, span.fg.g, span.fg.b, span.fg.a],
      bg: [span.bg.r, span.bg.g, span.bg.b, span.bg.a],
    })),
  );
  writeWireframe(
    lines,
    mockup.scrim === false ? t.appBg : t.backdropBg,
    join(root, "wireframes", folder === "pierre-dark" ? "" : folder, `${cols}x${rows}`),
    mockup.name,
  );
  const dir = join(root, folder, `${cols}x${rows}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${mockup.name}.json`),
    JSON.stringify({ width: cols, height: rows, lines }),
  );
  writeFileSync(join(dir, `${mockup.name}.txt`), setup.captureCharFrame());
  manifest.push({
    name: mockup.name,
    size: `${cols}x${rows}`,
    theme: themeName,
    description: mockup.description,
    before: mockup.before,
  });
  setup.renderer.destroy();
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Crop the dialog out of the frame: above the global footer row, cells whose
 * background is not the dimmed backdrop belong to dialogs and popovers.
 */
function writeWireframe(
  lines: { text: string; width: number; bg: number[] }[][],
  backdrop: string,
  dir: string,
  name: string,
) {
  const hex = (rgba: number[]) =>
    `#${rgba
      .slice(0, 3)
      .map((value) =>
        Math.round(value * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  const outside = backdrop.toLowerCase();
  const grid = lines.slice(0, -1).map((spans) => {
    const cells: { char: string; inside: boolean }[] = [];
    for (const span of spans) {
      const inside = hex(span.bg) !== outside && span.bg[3]! > 0;
      for (const { segment } of graphemes.segment(span.text)) {
        const cellsWide = Math.max(1, Bun.stringWidth(segment));
        cells.push({ char: segment, inside });
        for (let extra = 1; extra < cellsWide; extra += 1) cells.push({ char: "", inside });
      }
    }
    return cells;
  });
  let top = Infinity;
  let bottom = -1;
  let left = Infinity;
  let right = -1;
  grid.forEach((cells, row) =>
    cells.forEach((cell, col) => {
      if (!cell.inside) return;
      top = Math.min(top, row);
      bottom = Math.max(bottom, row);
      left = Math.min(left, col);
      right = Math.max(right, col);
    }),
  );
  if (bottom < 0) return;
  const text = grid
    .slice(top, bottom + 1)
    .map((cells) =>
      cells
        .slice(left, right + 1)
        .map((cell) => cell.char)
        .join("")
        .trimEnd(),
    )
    .join("\n");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.txt`), `${text}\n`);
}

const silence = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) return;
  silence(...args);
};

for (const [cols, rows] of SIZES) {
  for (const mockup of MOCKUPS)
    await capture(mockup, cols, rows, "pierre-dark", getUiTheme("pierre-dark"), "pierre-dark");
}
for (const mockup of MOCKUPS.filter((item) =>
  ["p01-commands", "p06-reviewers", "p13-merge", "p09-checks"].includes(item.name),
)) {
  await capture(mockup, 120, 40, "terminal (catppuccin palette)", TERMINAL_THEME, "terminal-theme");
}
await capture(
  {
    name: "p18-too-small",
    badge: "MERGE",
    status: "",
    description: "Fallback · below the minimum size the dialog explains itself instead of clipping",
    render: TooSmall,
  },
  58,
  16,
  "pierre-dark",
  getUiTheme("pierre-dark"),
  "pierre-dark",
);

writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Rendered ${manifest.length} mockups.`);
