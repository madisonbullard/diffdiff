# UI review screenshot handoff

## Implemented application

`implemented/index.html` is the current real-application gallery: 51 captures at 120×40, 80×24,
and 58×16 (small-terminal fallbacks). It is separate from the approved `proposal/` mockups and
the original before-captures below. The generator isolates HOME and supplies offline GitHub data;
all write callbacks are disabled.

```bash
bun --preload ./packages/tui/visual/preload.ts artifacts/ui-review/implemented/capture.tsx
swift artifacts/ui-review/render.swift "$PWD/artifacts/ui-review/implemented/120x40"
swift artifacts/ui-review/render.swift "$PWD/artifacts/ui-review/implemented/80x24"
swift artifacts/ui-review/render.swift "$PWD/artifacts/ui-review/implemented/58x16"
vp fmt artifacts/ui-review/implemented
```

## Original audit evidence (before implementation)

Captured on 2026-10-14 from the pre-unification app using the real OpenTUI/React layout
and keyboard handlers. **60 PNGs: 30 views at 120×40 and 80×24 terminal cells.**

Open `index.html` for the side-by-side gallery. Each image has matching `.txt`
(searchable terminal output) and `.json` (native frame text/color spans) files.
`manifest.json` is the machine-readable inventory.

The original `capture.tsx` intentionally names retired dialogs; replay it only against the
pre-unification source (`cffc5cc`). Use `implemented/capture.tsx` with current source.

## Coverage

All 14 dialogs in `packages/tui/src/app/dialogs/stack.ts` are represented:

| Dialog            | Capture                                                   |
| ----------------- | --------------------------------------------------------- |
| branch            | 08 branches, 10 commits, 11 commit search                 |
| clear-reviewed    | 23 local reviewed-state confirmation                      |
| cleanup           | 28 post-merge cleanup                                     |
| command-palette   | 05 commands                                               |
| comment-composer  | 18 conversation reply, 19 inline comment, 20 thread reply |
| comments          | 17 PR conversation                                        |
| checks            | 16 checks and failure details                             |
| diagnostics       | 22 diagnostics                                            |
| pull-request-list | 12 PR list, 13 PR search                                  |
| reviewer-picker   | 14 picker, 15 selected reviewer                           |
| help              | 06 diff help, 07 tree help                                |
| list-filter       | 09 branch filters                                         |
| merge             | 24 merge, 26 auto-merge                                   |
| submit-review     | 21 review submission                                      |

Additional surfaces: 00 overview/application chrome, 01 Space menu,
02 Ctrl+X leader menu, 03 go-to menu, 04 in-file menu,
18b changed-file autocomplete, 25 merge confirmation, 27 auto-merge confirmation.

## Review brief for the next agent

Follow [the menu/modal unification handoff](../../docs/plans/menu-modal-unification-handoff.md)
for the full audit brief, unified high-density UX direction, modern interaction
capabilities to assess, architecture constraints, and required plan deliverables.
Review both terminal sizes and validate findings live. The next task is planning,
not application implementation.

Visible examples worth investigating: the compact auto-merge confirmation title
is clipped; several compact headers lose action hints; the overview banner title
and checks label meet without enough separation. Preserve those defects as
evidence rather than assuming they are image-generation problems. Validate
findings with the real TUI before implementing fixes.

## Proposal artifacts

- `proposal/index.html`: native OpenTUI mockups of the proposed dialog system next to these
  captures, with cell wireframes in `proposal/wireframes/`. See
  [the proposal](../../docs/plans/menu-modal-unification.md) for how to regenerate them.
- `live/run.sh <cols> <rows> <pr|pr-long|local>`: runs the real app in a real terminal (or `ht-mcp`)
  with synthetic GitHub data, an isolated HOME, and logged, failing write callbacks. Used for the
  live findings in the proposal.

## Capture method and limits

- The app is rendered headlessly through the existing real-layout visual harness,
  not recreated as HTML. PNGs rasterize the native renderer's colored spans using
  macOS Menlo at 16 pt and 22-pixel rows. These are frame captures, not OS window
  screenshots; terminal font metrics, cursor blink, and host window chrome may differ.
- Theme: `pierre-dark`. Standard and compact terminal sizes are included, not all
  themes or every loading/error/empty/data-length permutation.
- GitHub data is synthetic. No GitHub request, review, merge, or ref deletion is
  performed. Cleanup is reached through a mocked merge result.
- HOME is isolated in a temporary directory so preferences and review cache are
  not changed. Temporary fixture repositories are disposed after capture.
- The clear-reviewed modal uses a non-PR session because bulk clearing is
  deliberately unavailable for GitHub-backed reviewed state.
- Long temporary repository paths in the top banner are fixture artifacts;
  judge that header with this context. Other layout clipping is preserved.
- No application implementation was changed, and no review agent was launched.

## Regenerate (macOS, Bun, Swift, installed workspace dependencies)

From the repository root:

```sh
bun artifacts/ui-review/capture.tsx
swift artifacts/ui-review/render.swift "$PWD/artifacts/ui-review"
bun artifacts/ui-review/gallery.ts
```

Validation: the capture script asserts key visible screen identifiers;
`vp check` passed; `vp run test -r` passed all 501 unit tests.
