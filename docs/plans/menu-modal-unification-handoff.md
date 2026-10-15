# Menu and modal UX unification: next-agent handoff

**Date:** 2026-10-14  
**Status:** archived audit/planning brief. The user subsequently approved the completed proposal
and authorized the entire implementation; this original scope is historical, not a current blocker.  
**Next deliverable:** an evidence-backed proposal for a unified terminal UX — delivered as
[menu-modal-unification.md](menu-modal-unification.md) (decisions recorded 2026-10-14).

## Mission and authority

The user considers the current menus/modals poorly designed and wants rigorous
scrutiny followed by a plan to unify them into a **simple, clean,
high-information-density layout with the benefits of modern UX**.

Do not independently beautify each screen or wrap the existing inconsistency in
a new border. Identify the common interaction model, eliminate redundant chrome
and guidance, and propose a small reusable system that makes every workflow
easier to scan and operate. Density means useful information per row, not tiny
text, unexplained symbols, squeezed labels, or hidden safety information.

This handoff authorizes investigation and planning, **not implementation,
commits, pushes, GitHub mutations, or a broad feature expansion**. Present the
plan for review before changing app behavior. Separate requirements below from
your proposed decisions and optional enhancements; do not call a proposal approved.

## Start here

1. Read `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, and `docs/README.md`.
2. Open [the screenshot gallery](../../artifacts/ui-review/index.html) and
   [capture inventory and caveats](../../artifacts/ui-review/README.md).
3. Review **all 30 views in both sizes**, including nested confirmations and
   autocomplete. Do not extrapolate from the reviewer picker alone.
4. Inspect the sources below and reproduce representative issues in a live
   terminal with `ht-mcp`. Classify screenshot evidence versus live verification.
5. Produce the audit and design/rollout plan specified under Deliverables.

### Existing evidence

- `artifacts/ui-review/120x40/`: standard terminal captures.
- `artifacts/ui-review/80x24/`: compact terminal captures.
- `artifacts/ui-review/manifest.json`: 60 captures, 30 named views.
- Each view has PNG, searchable text, and native text/color span JSON.
- `artifacts/ui-review/capture.tsx`, `render.swift`, `gallery.ts`: regeneration.
- `artifacts/ui-review.zip`: original shareable capture bundle; this handoff is
  maintained separately in `docs/plans/`.

These are real OpenTUI/React layout frames rasterized with Menlo, not OS window
screenshots. Synthetic GitHub data and an isolated HOME prevent real writes and
preference changes. Only `pierre-dark` and two sizes were captured; loading,
errors, empty states, other themes, long lists, and terminal input differences
still need scrutiny. Temporary repository names/paths exaggerate header pressure.

Observed leads, **not a complete verified defect list**:

- `80x24/27-confirm-auto-merge.png`: confirmation title and hints clip.
- `80x24/18-pr-comment.png`: composer context and shortcut text compete for space.
- `120x40/18b-file-autocomplete.png`: the composer has multiple nested content
  bands and lengthy hint text; assess density and hierarchy, not just clipping.
- `80x24/00-overview.png`: PR title and checks label meet without clear separation.
- Compare 05 palette, 08 comparison browser, 14 reviewer picker, 16 checks,
  21 submit review, and 24 merge for inconsistent chrome and information budgets.

The capture task changed no application implementation. At capture completion,
`vp check` and all 501 unit tests passed. Confirm current repository state rather
than treating this baseline as a promise about later work.

## Source map and architectural constraints

| Concern                                         | Sources                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| All 14 dialogs and parent restoration           | `packages/tui/src/app/dialogs/stack.ts`, `dialog-router.tsx`                                                    |
| Dialog models and state                         | `packages/tui/src/app/dialogs/dialog-models.ts`, `use-dialog-models.ts`                                         |
| Existing shared frame, keycaps, border, overlay | `packages/tui/src/components/shared.tsx`                                                                        |
| Duplicated review overlay/border constants      | `packages/tui/src/review/shared.tsx`                                                                            |
| General menus, lists, help, diagnostics         | `packages/tui/src/components/*modal.tsx`, `prefix-picker-overlay.tsx`                                           |
| Review, merge, checks, cleanup, composer        | `packages/tui/src/review/*modal.tsx`                                                                            |
| Mode resolution and focus context               | `packages/tui/src/app/shell/keymap-mode.ts`                                                                     |
| Actual bindings and derived labels              | `packages/tui/src/app/keymap/`, `packages/tui/src/app/commands/`                                                |
| Editing and hints                               | `packages/tui/src/components/text-input-content.tsx`, `text-input-hints.ts`, `packages/tui/src/app/text-input/` |
| Theme and tokens                                | `packages/tui/src/theme.ts`                                                                                     |
| Real-layout testing                             | `packages/tui/visual/harness/`, `packages/tui/visual/*.visual.test.tsx`                                         |
| Product semantics to preserve                   | `docs/plans/gh-integration.md`                                                                                  |

Verify paths and trace actual ownership before selecting abstractions. In
particular, an existing `ModalFrame` is available, but several review dialogs
render their own shells. Investigate why; do not blindly force every surface into
the current frame. Consolidate duplicated presentation, not domain-specific rules.

- Keep reusable repository/GitHub operations in `packages/core`; presentation and
  interaction stay in `packages/tui/src/app` and TUI components.
- Use the existing trie-based keymap runtime. Never create bespoke modal key
  handlers or a second source of truth for shortcuts.
- Preserve configurable bindings, context-sensitive commands, dialog parent
  restoration, typed input, selection, drafts, and scroll position where appropriate.
- Preserve authentication/eligibility gates, allowed merge methods, duplicate-write
  prevention, retry semantics, requested-reviewer ordering and additive selection.
- Auto-merge is not immediate merge and must not trigger cleanup. Ref cleanup
  deletes local/remote-tracking refs, not remote branches on GitHub.
- GitHub viewed state cannot be bulk-cleared like local reviewed state. Preserve
  that distinction. No new network calls merely to draw the new shell.

## Target design direction

Treat the following as the design brief. The agent must turn it into explicit,
testable layout and behavior decisions, including measured terminal-cell budgets.

### One grammar, a few purposeful variants

Recommend a small set of families: command/prefix menu, searchable picker,
list/detail inspector, form/composer, and destructive confirmation. Unify shell,
spacing, typography, focus, status, and action placement; allow body structure to
fit the task. One universal configurable mega-component is not the goal.

Evaluate this baseline rather than copying it unquestioningly:

```text
Title · compact context/count                       close/help
Search or essential controls, when applicable
─────────────────────────────────────────────────────────────
Scrollable content: list, details, form, or editor
Inline validation/status near the affected content
─────────────────────────────────────────────────────────────
Primary action / selected count     navigation · cancel · help
```

- Title/context must not fight shortcuts for the same width. Avoid long horizontal
  hint trains, repeated introductions, excessive blank rows, and boxes within boxes.
- Reserve predictable space for primary actions and cancellation. Scroll the body,
  not the only explanation of what Enter will do.
- Put frequent actions in the compact footer; put uncommon shortcuts in contextual
  help. Use progressive disclosure without hiding required actions or hazards.
- Compact mode should simplify/reflow before clipping. Specify width/height bounds,
  minimum supported dimensions, list/detail stacking, truncation priorities, and
  an explicit too-small fallback. Never truncate a critical action into ambiguity.
- In long lists, retain useful counts, selected state, and visible navigation;
  selection and cursor are different concepts and must remain distinguishable.
- Use semantic theme tokens and restrained borders. Focus, selected, checked,
  disabled, warning, failure, and success must not rely on color alone.

### Modern UX capabilities to assess and prioritize

For each capability, mark **already supported / inconsistent / missing**, then
recommend **baseline / follow-up / not justified**, with rationale and cost.
Modern UX does not mean importing a web-app feature checklist into a terminal.

| Area                 | Required assessment                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search and discovery | Live filtering, fuzzy matching where useful, query clearing, visible result counts, useful no-results state, command synonyms, shortcut discovery                                           |
| Navigation and focus | Predictable Tab/Shift+Tab, arrows and contextual j/k, Home/End/Page keys, selected-row reveal, initial focus, focus restoration, no input leaking to the background                         |
| Editing              | Reliable multiline/newline versus submit behavior, paste, Unicode/display-width correctness, caret/selection, external editor, file autocomplete, history/drafts and cancellation semantics |
| Selection            | Multi-select when justified, selected counts, selection surviving filtering, already-requested/disabled items with reasons, clear distinction between highlight and choice                  |
| Feedback             | Loading/refreshing, empty/unavailable, inline validation, pending/success/failure, recoverable errors that preserve work, appropriate retry and duplicate-submit guards                     |
| Safety               | Named action and target, consequences near the action, explicit confirmation only where risk warrants it, cancellation rules during writes, undo only where genuinely supported             |
| Inspection           | Copy/open actions, links with keyboard fallback, long details/Markdown scrolling, visible truncation and a way to inspect full values                                                       |
| Pointer parity       | Clicking actionable items, wheel scrolling, hover/focus affordances when the terminal supports them; keyboard remains sufficient and primary                                                |
| Accessibility        | Readable contrast, non-color status labels, text scaling via host terminal, plain-text legibility, discoverable focus and shortcuts; document terminal/assistive-tech limitations honestly  |
| Performance          | Responsive filtering/navigation at large item counts, bounded layout work, no refresh storms, no startup regression, no unnecessary new dependencies                                        |

Explicitly examine terminal limitations: Shift+Enter/modified keys may differ by
terminal; hover/tooltips, clipboard, hyperlinks, mouse capture, and assistive
technology are not uniformly available. Provide graceful fallbacks, not promises
the renderer cannot fulfill. Do not implement undo, permissions, rerunning checks,
or new GitHub actions as incidental UI work.

## Audit method

Build a complete surface/state matrix using the screenshot inventory and current
dialog router, including parent/child flows, menu dismissal, autocomplete, and
confirmation overlays. Include normal, no data, no matches, unavailable, loading,
failure/retry, disabled, submitting, and success states **where applicable**.

For each issue record: surface/state, screenshot and terminal dimensions,
observed problem, user impact, likely source, live verification status, severity,
and whether it is a systemic layout problem or a local exception. Separate
workflow failures from subjective styling preferences. Challenge the workflows
themselves: unnecessary steps, conflicting Enter behavior, repeated hints,
obscure mode switches, invisible focus, and excessive confirmations.

Evaluate at 80×24 and 120×40, at least one wider/taller size, and below the chosen
minimum. Stress long titles/usernames/paths, wide Unicode, pasted multiline text,
large datasets, filtering selected items away, resizes while typing, nested
dismissal, failing async operations, and rapid repeat submissions. Use fixture
callbacks, not real PR mutations. Expand the capture harness if evidence is missing.

## Deliverables and stopping point

Write a proposal in `docs/plans/menu-modal-unification.md`, linked from the docs
index. Reference this handoff and the evidence; avoid copying the whole brief.
The proposal must contain:

1. **Executive diagnosis:** the systemic causes and what should be removed,
   simplified, shared, retained, or deliberately different.
2. **Complete audit matrix:** every menu/modal and material state, prioritized
   issues with evidence and reproducible steps. Flag unverified hypotheses.
3. **Unified UX specification:** families, shared slots/tokens, density rules,
   sizing/breakpoints, navigation/focus, action/hint hierarchy, state vocabulary,
   truncation/scroll behavior, and terminal fallbacks.
4. **Concrete layouts:** terminal-cell wireframes for each family at both target
   sizes, plus representative proposed native-rendered mockups if feasible without
   changing production behavior. Compare before/after content-row budgets. An HTML
   mockup alone is not proof that the OpenTUI layout fits.
5. **Interaction contracts:** opening/focus, navigation/editing, activation versus
   submission, cancellation, parent restoration, pending/error handling, and
   preservation of draft/query/selection for each family. Call out intentional changes.
6. **Simplification architecture:** what extends/replaces `ModalFrame`, shared
   action/hint primitives, token ownership, and concrete duplication to remove;
   distinguish presentational helpers from domain orchestration.
7. **Small rollout slices:** a representative vertical slice first, then families
   and exceptions. Each slice names files, dependencies, acceptance tests,
   regression risks, and a rollback strategy. Avoid a big-bang rewrite.
8. **Modern-UX backlog:** baseline versus worthwhile follow-ups versus rejected
   ideas, ordered by user value and complexity, not cosmetic novelty.
9. **Verification and open decisions:** measurable acceptance criteria, test
   coverage, risks, genuine questions for the user, and a recommended choice for
   each trade-off. Ask only questions the code/evidence cannot answer.

Stop after presenting the plan and unresolved decisions. Do not create Linear
issues, delegate implementation, or start changing application code without a
new request. No review agent has been launched as part of this handoff.

## Acceptance bar for the eventual implementation

The plan must define how to prove these outcomes, not just promise them:

- Every surface belongs to a documented family or has a justified exception.
- At supported sizes, title, primary action, essential status, and cancel path are
  readable; critical labels do not clip/overlap and content remains reachable.
- The compact layout has explicit row budgets; useful content density improves
  without dropping task-critical context or relying on memorized keys.
- Displayed binding labels agree with configured runtime bindings. Typed j/k/q
  stay text in editors and search fields unless an explicit mode says otherwise.
- Focus and selection are visibly distinct; opening/dismissing nested surfaces
  does not lose context or activate background commands.
- Errors preserve work and provide actionable recovery; repeat activation cannot
  duplicate writes. Safety/permissions and existing domain semantics remain intact.
- Real-layout tests cover compact and standard geometry, scroll reachability,
  focus/navigation, long content, resize, nested dismissal, and async error states.
- For bugs, add a failing regression test before the fix, then verify live with
  `ht-mcp`. Text snapshots alone do not prove color, overlap, or focus correctness.
- Run `vp check`, `vp run test -r`, `vp run build -r`, and the TUI visual suite
  (`vp run test:visual` from `packages/tui`); refresh the screenshot evidence and
  governing docs as behavior changes. Account for performance regressions.

## Suggested next-agent prompt

> Read `docs/plans/menu-modal-unification-handoff.md`. Audit all captured menus,
> modals, nested states, and their implementation. Reproduce representative defects
> safely, then propose one coherent, simple, clean, high-information-density
> terminal UX with modern interaction affordances. Deliver the evidence-backed
> specification, wireframes, architecture/simplification plan, prioritized rollout,
> and acceptance tests in `docs/plans/menu-modal-unification.md`. Distinguish
> baseline requirements from optional enhancements. Do not implement yet.
