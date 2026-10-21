# Menu and modal unification: audit and proposal

**Date:** 2026-10-14  
**Status:** implemented after approval of all twelve decisions (§9.3); verified 2026-10-15.
The implementation and verification are complete; audit and design evidence are retained below.
**Brief:** [menu-modal-unification-handoff.md](menu-modal-unification-handoff.md)  
**Evidence:** [implemented application](../../artifacts/ui-review/implemented/index.html) (51 frames) ·
[original audit captures](../../artifacts/ui-review/index.html) (60 frames) ·
[proposed mockups](../../artifacts/ui-review/proposal/index.html) (19 native OpenTUI mockups, two
sizes, two themes) · [cell wireframes](../../artifacts/ui-review/proposal/wireframes/) ·
[live fixture launcher](../../artifacts/ui-review/live/run.sh)

## The proposal in one screen

Every dialog in diffdiff should read the same way, top to bottom:

```text
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   dimmed app (scrim)
░                                                                    ░   no border: the fill is the edge
░  Title  context                                     position  esc  ░   what this is, where you are
░  › query or first field                              count / hint  ░   one input row (pickers only)
░    body: rows, fields, or details — every remaining row            ░   content gets the space
░  ▲ status: pending, failure + recovery, or hazard (when any)       ░   full-width tone band
░  enter primary action  key action  key action                      ░   one action bar, from the keymap
░                                                                    ░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

One panel, five bodies: **key menu**, **picker**, **inspector**, **form**, **confirm**. The panel has
no border (D1): its fill, one step above the dimmed app, is the edge, and tone (warning, danger) lives
in a `▲` before the title and a full-width status band. A floating panel spends 4 rows on chrome
(title row, action bar, one padding row above and below); below 30 rows it becomes a sheet that covers
the app header and spends 2. The current shells spend 10–16 rows on titles, subtitles, nested cards,
padding, and instruction paragraphs around their content. At 80×24 the reviewer picker shows 1–2
people today and 13 in the proposal; the command palette shows no legible command today and 13.

Before the redesign, five behaviors need red-green fixes regardless of visual direction, because
they lose data or fire unintended actions (all reproduced in a real PTY, §2.3–2.4):

1. Two quick Enters send **two** comments, two review submissions, or two merge requests.
2. Keys typed right after opening a dialog run **background** commands (`a` then `nice` toggled a
   thread, collapsed a file, and opened the editor instead of typing).
3. **Paste is dropped** in every text input.
4. **Tab submits** a comment.
5. The advertised `ctrl+j` newline does nothing in terminals without the kitty keyboard protocol,
   where `shift+enter` is indistinguishable from Enter (submit).

A sixth, found in source and not reproduced: a write that finishes after its dialog was closed acts
on whatever is on screen. A late merge opens cleanup over it, and a late comment closes and clears the
composer you opened since, then offers the sent text again as a draft (I-27). Decision D9 makes these
paths common, so slice 0a fixes them, and D12 removes the cleanup dialog altogether.

## 1. Executive diagnosis

The surfaces were built one feature at a time, each with its own shell, hint strings, and row
budget. The result is not 14 styling problems; it is six systemic causes.

| #   | Systemic cause                                                                                                                                                                                                                                                                                                                                                  | Representative evidence                                                                                                                                                                                            | Consequence                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **No layout contract.** Content is placed in flex columns that may shrink below their text, with no scroll or windowing. Fixed window constants ignore the terminal (7 commits, 10 PRs, `(height−20)/2` reviewers).                                                                                                                                             | Palette rows overdraw each other at both sizes (`05-command-palette`); branch list with 42 branches shows an arbitrary subset and hides the cursor (live); autocomplete rows collapse into one line (`80x24/18b`). | Unreadable or unreachable content at exactly the sizes people use; wasted space on large terminals (`17-conversation` is ~90% empty). |
| C2  | **Header rows make title, subtitle, and hint trains compete for one width.** `justifyContent: space-between`, no shrink priority, primary action listed last.                                                                                                                                                                                                   | `Confirm Auto-Mer`, `Clear Review Mar`, `Commentmontsrc/review.t`; composer hints cut to `enter submi`, merge/submit hide Enter at 80×24.                                                                          | The one thing the user must know—what Enter does—is the first thing removed.                                                          |
| C3  | **Instructions instead of affordances.** Subtitle + header hints + footer paragraph + status narration + mode badge restate each other.                                                                                                                                                                                                                         | Composer explains itself four times yet never shows submit at 80×24; palette describes filtering three times; status says `Opened list modal.`                                                                     | Low information per row; the important line is lost among restatements.                                                               |
| C4  | **Boxes within boxes.** Every region is a card (left bar + 2 padding rows + gap). In terminal-derived themes `surface`, `modalBg`, and `chromeBackground` are the same color (`theme.ts` `createTerminalUiTheme`), so cards become noise bars.                                                                                                                  | Diagnostics nests six cards; the reviewer picker spends 7 of its 17 compact rows on padding and gaps.                                                                                                              | Density collapses at 80×24 and structure is invisible in real terminal themes.                                                        |
| C5  | **Two sources of truth for keys and state words.** All 15 dialog components hard-code at least some key labels (`leader+e`, `ctrl+e line end`, `esc / q`, `cmd+enter`); palette/help print every alias (`l / ctrl+x l / space l`); focused native scrollboxes handle `j/k/↑/↓/pgup/pgdn` outside the keymap. State is color-only (`completed` in red vs green). | `16-checks`, `06-help-diff`, `18-pr-comment`; help scrolls on `j` even though the help keymap has no navigation.                                                                                                   | Remapped keys lie, help omits 28 of the 58 pane actions, status is unreadable without color.                                          |
| C6  | **Input routing and writes depend on React render timing.** The keymap mode comes from rendered state; four of six mutations lack a synchronous in-flight guard (merge's guard reads stale React state).                                                                                                                                                        | Live: burst input misrouted; duplicate `addReviewThread`, `submitPendingReview`, `mergePullRequest`.                                                                                                               | Data integrity and safety, not polish.                                                                                                |

### Remove, simplify, share, retain, differ

| Decision                   | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Remove**                 | Explanatory subtitles (10 of 13; data-bearing context moves to the title row), header hint trains (9), footer instruction paragraphs (5), about 25 bordered cards, double-spaced help rows, multi-alias binding labels, command ids in the palette footer, the nested **Filters** dialog, the stacked **Confirm Merge** dialog, the post-merge **Cleanup** dialog (D12), status narration of opens/closes, `Modal Picker`/`List`/`CONVO`/`CMDS` naming, global error toasts over dialogs. |
| **Simplify**               | One title row, one optional input row, one status slot, one action bar; one row per list item; rules instead of cards; no frame borders (D1); content-fit heights with fixed top anchoring.                                                                                                                                                                                                                                                                                               |
| **Share**                  | `DialogPanel`, `ListView` (windowed, sections, cursor reveal, mouse, empty/no-match/loading/error), `QueryRow`, `StatusLine`, `ActionBar` (labels derived from the live keymap), state glyphs, display-width text utilities, geometry resolver, write guard, synchronous mode store, paste routing.                                                                                                                                                                                       |
| **Retain**                 | Dialog stack and parent restoration, the trie keymap and user overrides, composer drafts/history/`@file`/external editor, reviewer ordering and additive requests, selection surviving filters, allowed-method gating, auto-merge semantics, cleanup semantics (chosen up front in the merge form, D12), checks snapshot without extra requests, PR overview semantics.                                                                                                                   |
| **Deliberately different** | Key menus are non-modal popovers (no scrim, bottom-right); `ctrl+x` shows none (D6). File autocomplete anchors to the caret on a raised tint. Confirmations are small, centered, and float at every size. Inspectors go side-by-side only when wide. Merge confirmation uses the warning tone.                                                                                                                                                                                            |

## 2. Audit

### 2.1 Verification levels and severity

- **L** live PTY: real stdin parser and modifiers via `ht-mcp` and the fixture launcher (§2.4).
- **H** headless real-layout frame (the capture harness, `artifacts/ui-review/<size>/<view>`).
- **S** source reading with the line cited. **U** unverified hypothesis, flagged as such.
- **S1** data integrity or unusable surface · **S2** major task friction or misleading safety copy ·
  **S3** density/consistency · **S4** polish.

### 2.2 Surface and state matrix

Families are the proposed ones. "Missing" lists states that exist in code but have no capture or test.

| Surface (dialog id)                   | Family                            | Shell today                              | Captured (H) / live (L)                            | Missing evidence                       | Issues                   |
| ------------------------------------- | --------------------------------- | ---------------------------------------- | -------------------------------------------------- | -------------------------------------- | ------------------------ |
| Space menu                            | Key menu                          | `PrefixPickerOverlay`                    | normal H, L                                        | disabled-only, unbound key status      | I-21                     |
| Ctrl+X leader                         | none by decision (D6)             | none (status text only)                  | H, L (no menu, 2 s timeout)                        | —                                      | I-14                     |
| `g` / `s` menus                       | Key menu                          | `PrefixPickerOverlay`                    | H                                                  | count prefix (`5gg`) display           | I-21                     |
| Commands (`command-palette`)          | Picker                            | `ModalFrame` + 3 cards                   | empty H/L (overlap), filtered L (OK at 1 result)   | no-match, disabled-only                | I-6, I-12, I-20, I-22    |
| Help (`help`)                         | Picker (Keys tab)                 | `ModalFrame` + cards + focused scrollbox | diff/tree H, scroll L                              | remapped keys                          | I-12, I-13, I-15         |
| Compare (`branch`)                    | Picker                            | `ModalFrame` + 3 cards                   | branches/commits/search H, 42 branches L           | loading browser data, empty filters    | I-7, I-9, I-11, I-19     |
| Filters (`list-filter`)               | removed → facet row               | `ModalFrame`                             | H                                                  | —                                      | I-19, I-20               |
| Pull requests (`pull-request-list`)   | Picker                            | `ModalFrame` + 3 cards                   | list/search H                                      | loading, error, >10 PRs                | I-9, I-20                |
| Reviewers (`reviewer-picker`)         | Picker (multi)                    | `ModalFrame` + cards                     | picker/selected H, paste L, failure in visual test | loading, submitting                    | I-3, I-9, I-11           |
| `@file` autocomplete                  | Picker (popover)                  | inline box in composer                   | H (overlap at 80×24)                               | no matches                             | I-6                      |
| Checks (`checks`)                     | Inspector                         | `ModalFrame`                             | H, L                                               | unavailable, none, long summary        | I-11, I-9                |
| Conversation (`comments`)             | Inspector                         | hand-rolled overlay                      | H, L                                               | ≥2 long items (selection vs scroll, U) | I-15, I-20               |
| Diagnostics (`diagnostics`)           | Inspector                         | `ModalFrame` + 6 cards                   | H                                                  | loading, error, empty                  | I-6, I-15, I-20          |
| Comment composer ×3 targets           | Form                              | hand-rolled overlay                      | H (3 targets), Tab/paste/burst/dup/failure L       | long body, resize while typing         | I-1–I-5, I-8, I-16, I-17 |
| Submit review (`submit-review`)       | Form                              | hand-rolled overlay                      | H, dup/failure L                                   | long summary                           | I-1, I-8, I-17, I-18     |
| Merge (`merge`)                       | Form                              | hand-rolled overlay                      | form/auto H, dup/failure L                         | blocked reasons, submitting            | I-1, I-8, I-10, I-18     |
| Merge confirm (inside `merge`)        | becomes inline state              | `ModalFrame` over form                   | H (80×24 clip)                                     | —                                      | I-8, I-10                |
| Cleanup (`cleanup`)                   | becomes a merge-form option (D12) | hand-rolled overlay                      | H                                                  | applying, failure                      | I-1 (S), I-8, I-27       |
| Clear review marks (`clear-reviewed`) | Confirm                           | `ModalFrame`                             | H (non-PR only)                                    | —                                      | I-8                      |
| Error toast                           | becomes status slot               | absolute toast                           | L (over composer, submit, merge)                   | —                                      | I-16                     |

### 2.3 Issue register

| ID   | Sev | Ver  | Surface · state · evidence                                                                                       | Problem → impact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Likely source                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Scope            |
| ---- | --- | ---- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| I-1  | S1  | L    | Composer, submit review, merge confirm · rapid `Enter Enter`                                                     | One burst produced two `addReviewThread`, two `submitPendingReview`, two `mergePullRequest` calls with identical input → duplicate GitHub comments/reviews, error after a successful merge. Cleanup has the same gap (S).                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `github-mutation-actions.ts` `submitCommentComposer`/`submitReviewFromModal`/`applyCleanupSelection` have no guard; `submitMergeFromModal` checks React state that is stale within a burst. Reviewer requests and draft toggle already use ref guards (`reviewerPickerAsyncRef`, `draftToggleInFlightRef`).                                                                                                                                                       | Systemic         |
| I-2  | S1  | L    | Any dialog-opening key followed by typing in the same input chunk                                                | `a` + `nice` opened the composer but `i`, `c`, `e` ran diff commands (focus thread, collapse, open editor). By the same path a fast `q` would quit (inferred). More likely over SSH/tmux and with key repeat. Violates "no input leaking to the background".                                                                                                                                                                                                                                                                                                                                                                                                                                           | `app-controller.tsx` derives `activeKeymapMode` with `useMemo` from rendered state; `use-main-keyboard.ts` routes with that closure until the next commit.                                                                                                                                                                                                                                                                                                        | Systemic         |
| I-3  | S2  | L    | Palette filter, reviewer filter, composer · bracketed paste                                                      | Pasted text never appears; OpenTUI emits `paste` events (the native layer enables `?2004h`) and nothing subscribes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No `paste` listener in `packages/tui/src`.                                                                                                                                                                                                                                                                                                                                                                                                                        | Systemic         |
| I-4  | S2  | L    | Composer · Tab                                                                                                   | Tab (no autocomplete open) submits the comment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `defaults.ts` comment mode binds `tab` → `LIST_ACCEPT`; `modal-action-dispatch.ts` `acceptReviewComposerSelection` falls through to submit.                                                                                                                                                                                                                                                                                                                       | Local            |
| I-5  | S2  | L    | Composer, submit review, merge body · newline keys                                                               | In a legacy terminal `ctrl+j` arrives as `linefeed` and is ignored; `shift+enter` is plain Enter (submits); only `alt+enter` works. Hints also offer `cmd+enter`, which most terminals never send.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `input-state.ts` handles `ctrl+j` only as a ctrl-modified key; no `linefeed` mapping; `text-input-hints.ts`.                                                                                                                                                                                                                                                                                                                                                      | Systemic         |
| I-6  | S1  | H, L | Palette (both sizes), autocomplete (80×24), diagnostics header                                                   | Title/description/rows overdraw each other (`Browseotherworkingstree…`, `>nREADME.mdw.ts…`, `/fixture/session.jsonlSession log`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `command-palette-modal.tsx` renders every command in a non-scrolling box; the composer stacks unbounded rows; diagnostics' fixed-height header cards squeeze two text lines into one; flex children shrink below text height.                                                                                                                                                                                                                                     | Systemic (C1)    |
| I-7  | S2  | L    | Compare · 42 branches at 80×24                                                                                   | Visible rows are an arbitrary subset; moving the cursor changes only the detail strip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `branch-list-view.tsx` `BranchListView` renders all items without windowing.                                                                                                                                                                                                                                                                                                                                                                                      | Systemic (C1)    |
| I-8  | S2  | H    | Composer/submit/merge/cleanup headers                                                                            | Primary action hidden or cut (`enter submi`, cleanup shows `enter` with no label, merge/submit lose Enter at 80×24); title overlaps subtitle at 80×24.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Hand-rolled header rows in `review/*-modal.tsx`; `ModalFrame` header without shrink priority.                                                                                                                                                                                                                                                                                                                                                                     | Systemic (C2)    |
| I-9  | S2  | H    | Reviewers 80×24 (1–2 people), commits (7), PRs (10), checks detail (4 rows at 80×24), help (4 bindings at 80×24) | Fixed or formula-based windows ignore available rows; content squeezed while chrome stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `reviewer-picker-modal.tsx:32`, `branch-list-view.tsx:14`, `pull-request-list-modal.tsx:10`, `checks-modal.tsx:32`, `help-modal.tsx` `gap={1}`.                                                                                                                                                                                                                                                                                                                   | Systemic (C1)    |
| I-10 | S2  | H, S | Merge confirm · auto-merge                                                                                       | Footer says `Press enter again to confirm the squash merge.` while enabling auto-merge; the dialog asks you to "review the method, title, and body in the background form" while covering it; check failures are not shown in the merge dialog at all.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `controller-helpers.ts:33`; `merge-confirm-modal.tsx`; `merge-pull-request-modal.tsx`.                                                                                                                                                                                                                                                                                                                                                                            | Local            |
| I-11 | S2  | H, S | Checks list, reviewer marks, branch cursor, merge methods                                                        | State conveyed by color alone (`completed` red vs green), requested and chosen reviewers both `[x]`, cursor is a slightly stronger tint than HEAD/BASE rows, `default selection` means "current".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `checks-modal.tsx:93`, `reviewer-picker-modal.tsx:108`, `branch-list-view.tsx` `ListRow`, `merge-pull-request-modal.tsx:132`.                                                                                                                                                                                                                                                                                                                                     | Systemic (C5)    |
| I-12 | S2  | S    | All 15 dialog components; worst in composer, submit, merge, merge confirm, cleanup, conversation                 | Hard-coded key strings diverge from configurable bindings (`leader+e`, `esc / q`, `ctrl+g`). Palette/help derive labels but print all aliases.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Inline spans in each modal; `command-list.tsx` `CommandBindingLabel`.                                                                                                                                                                                                                                                                                                                                                                                             | Systemic (C5)    |
| I-13 | S3  | S, L | Help                                                                                                             | Lists the 32 commands but omits 28 of the 58 actions bound in the diff, thread, and tree panes (all navigation: `j/k`, `[ ]`, `shift+[ ]`, `g`/`s` prefixes, page and half-page scrolling, tree moves, counts); shows `unbound` rows; ignores availability; claims "All keyboard shortcuts".                                                                                                                                                                                                                                                                                                                                                                                                           | `dialog-models.ts` help uses commands only.                                                                                                                                                                                                                                                                                                                                                                                                                       | Local            |
| I-14 | S3  | L    | Ctrl+X                                                                                                           | No menu, only `Leader mode active. Awaiting next key.`, then a 2 s timeout; the leader holds the largest command set. **Closed by D6:** no menu; the footer names the state and `ctrl+x ?` (already bound to help) opens the Keys tab with a leader section.                                                                                                                                                                                                                                                                                                                                                                                                                                           | `prefix-menus.ts` leader has no `picker`.                                                                                                                                                                                                                                                                                                                                                                                                                         | Local            |
| I-15 | S2  | L, S | Help, conversation, diagnostics                                                                                  | Focused native scrollboxes consume `j/k/↑/↓/pgup/pgdn/home/end` outside the trie: remaps are ignored; in conversation/diagnostics the keymap moves the selection while the scrollbox scrolls independently (U for drift with long items).                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `scrollbox focused={true}` in `help-modal.tsx`, `comments-modal.tsx`, `diagnostics-modal.tsx`; OpenTUI `ScrollBox.handleKeyPress`.                                                                                                                                                                                                                                                                                                                                | Systemic (C5)    |
| I-16 | S2  | L    | Composer, submit, merge · failure                                                                                | Errors render as a global `Error` toast over the dialog's hints; it persists across dialogs and is dismissible only from a pane (`esc`/`x`). Only the reviewer picker (mutation errors) and diagnostics (load errors) show errors inline.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `use-app-persistence.ts` `showErrorToast`; `use-main-keyboard.ts:177`.                                                                                                                                                                                                                                                                                                                                                                                            | Systemic         |
| I-17 | S3  | L    | Composer · while submitting                                                                                      | Editing continues during the write; text typed after Enter is silently discarded on success (submitted `h`, dialog showed `hi there`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No input lock while `isSubmittingReviewAction`.                                                                                                                                                                                                                                                                                                                                                                                                                   | Systemic         |
| I-18 | S3  | S    | Submit review, merge · esc/reopen                                                                                | Submit summary is cleared on Esc; merge title/body reset on every open; composer drafts persist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `review-input-controllers.ts` `close()`/`open()`.                                                                                                                                                                                                                                                                                                                                                                                                                 | Inconsistent     |
| I-19 | S3  | H    | Compare + Filters                                                                                                | A nested dialog toggles four booleans already shown as chips; counts and chips repeat the same information on one row; Enter does nothing on branch rows; the list title is `List`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `branch-modal.tsx`, `list-filter-modal.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                      | Local            |
| I-20 | S3  | H    | Palette, PR list, diagnostics, conversation, reviewers                                                           | Card padding, redundant subtitles, duplicate labels (`Most recent first` and `Newest first`), the PR list omits the PR number, conversation uses 92% height for one item.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | All shells.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Systemic (C3/C4) |
| I-21 | S3  | H    | Status line, badges, palette footer                                                                              | `Opened list modal.`, `Closed list filters.` (stale on the next screen), `Modal Picker`, `CONVO`, `CMDS`, `comparison.list`, `leader+j/k move while typing`, `1 commits`, `1 matching users`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status setters across `modal-action-dispatch.ts`; `prefixes.ts:16`.                                                                                                                                                                                                                                                                                                                                                                                               | Systemic (copy)  |
| I-22 | S3  | L    | Palette and other centered dialogs                                                                               | Vertical centering re-centers as content changes (palette jumped from row 5 to row 13 while filtering).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `ModalFrame` `justifyContent="center"`.                                                                                                                                                                                                                                                                                                                                                                                                                           | Systemic         |
| I-23 | S3  | S    | Footer                                                                                                           | `? help` stays visible in text modes where `?` types; modal hints and the footer duplicate each other.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `app-footer.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Local            |
| I-24 | S3  | S    | Code                                                                                                             | Two shells (`ModalFrame` for 9 dialogs plus the nested merge confirmation, 5 hand-rolled overlays) with duplicated `MODAL_OVERLAY`/`REVIEW_BORDER`, three copies of `ListRow`/`EmptyListNotice`/border chars, merge eligibility computed in three places.                                                                                                                                                                                                                                                                                                                                                                                                                                              | `components/shared.tsx`, `review/shared.tsx`, `branch-list-view.tsx`, `pull-request-list-modal.tsx`, `comments-modal.tsx`, `dialog-router.tsx:163`, `controller-helpers.ts`, `modal-action-dispatch.ts` `MERGE_TOGGLE_AUTO`.                                                                                                                                                                                                                                      | Systemic         |
| I-25 | S3  | S    | Text editing                                                                                                     | Emoji and other multi-unit graphemes cannot be typed (`sequence.length === 1`); cursor/backspace/truncation work in UTF-16 units (`.length`), not graphemes or cells.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `input-state.ts:354`, `app/shared/text.ts`, `pull-request-list-modal.tsx:279`.                                                                                                                                                                                                                                                                                                                                                                                    | Systemic         |
| I-26 | S4  | H    | Banner at 80×24                                                                                                  | `…review wor1 check failed`: PR title and checks label meet without separator. Outside dialog scope; listed because dialogs inherit header pressure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `review/banner.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                              | Local            |
| I-27 | S1  | S    | Merge, composer · `esc` while the write runs                                                                     | Nothing but the reviewer picker blocks `esc` during a write, and completions act on whatever is open. A late merge that finds stale refs opens cleanup with `replace: true`, replacing the top dialog (a composer with unsent text), or with `clear: true` when the reload fails, dropping the whole stack; in a pane, a stray Enter applies the cleanup selection (a forced local branch delete when selected). A late comment closes whichever composer is on top and resets the shared composer state, discarding a second comment in progress, and because `esc` saved the sent body as a dismissed draft, reopening that line restores text that was already posted. D9 makes these paths common. | `modal-action-dispatch.ts` `closeMergeModal` and `review-input-controllers.ts` `close()` have no pending check; `github-mutation-actions.ts` `submitMergeFromModal` opens cleanup with `replace: true` or `clear: true`, and `submitCommentComposer` closes `comment-composer` and calls `reviewComposer.reset()`; `composer-history.ts` `findLatestDismissedReviewComposerDraft` ignores later submissions; stack entries carry only a dialog type (`stack.ts`). | Systemic         |

**Not defects (evidence hygiene):** thin vertical seams in all PNGs come from `render.swift`
filling fractional-width cells; garbled CJK in an `ht` session is an emulator artifact (OpenTUI's
buffer measures `李小龍` as 6 cells correctly). One real width hazard was found while prototyping:
OpenTUI 0.1.92 measures `⚠` (U+26A0) as 2 cells while `Bun.stringWidth` and most terminals use 1, so
it must not appear in chrome (§3.5).

### 2.4 Reproducing the live findings

`artifacts/ui-review/live/run.sh <cols> <rows> <pr|pr-long|local>` runs the real `DiffdiffApp` in a real
renderer with synthetic GitHub data, an isolated `HOME`, and write callbacks that log to
`$TMPDIR/diffdiff-live-writes.log` and then fail. Keypresses (including `paste` events) are logged to
`$TMPDIR/diffdiff-live-keys.log`. `pr-long` adds 40 branches, 40 PRs, and 30 reviewers with long and
wide names.

| Finding   | Steps (80×24 `pr` unless noted)                                                                      | Observed                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| I-1       | `j ] a`, type text, `Enter Enter` in one burst; `A`, `Enter Enter`; `m`, `Enter`, then `Enter Enter` | two identical write log lines per surface                             |
| I-2       | `a` immediately followed by `nice`                                                                   | composer opens with no text; status `Focused thread…`; file collapsed |
| I-3       | `ctrl+p` or `space w`, send `ESC[200~check ESC[201~`                                                 | `PASTE` logged; filter unchanged                                      |
| I-4 / I-5 | in the composer: `Tab`; `ctrl+j`; `alt+enter`                                                        | Tab submits; `linefeed` ignored; `alt+enter` inserts a newline        |
| I-7       | `pr-long`, `l`, then `j` repeatedly                                                                  | list never scrolls; detail strip changes                              |

`ht-mcp` quirks that cost time: `send_keys` is written to the PTY only when the next MCP call arrives
(follow each send with a cheap call such as `ht_list_sessions`), and an `Escape` followed quickly by
another key is parsed as `alt+<key>`; pause between them.

### 2.5 Workflow challenges

- **Merge is two steps behind a covering dialog.** Keep the deliberate second Enter, but confirm in
  place (D4): the form locks, the title gains `▲`, the status row becomes a warning band that names
  the consequence, and the action bar becomes `enter confirm squash-merge · esc back to edit`. Same
  for auto-merge, with its different consequence. Cleanup moves into the form as a remembered option
  (D12), so nothing opens after the merge.
- **Submit review hides the event switch inside the text field.** Up/down change the event only at
  the first or last line of the summary. Make the event a radio list with its own focus; Tab moves to
  the summary.
- **Compare uses a nested dialog for four toggles** and Enter is meaningless on branch rows. Replace
  Filters with an inline facet row (D3); Enter sets the head on branch and working-tree rows and `b`
  still sets the base (D8); Enter on PR rows still opens the PR review.
- **Three ways to run every command** (direct key, `space`, `ctrl+x`) are shown everywhere. Keep the
  bindings; show only the primary one in palette/action bars; show the full set in Keys and in the
  `space`, `g`, and `s` menus. `ctrl+x` keeps showing no menu (D6).
- **A slow write should not trap the user.** `esc` closes the dialog while the write continues (D9);
  the outcome lands in the status line, a failure names how to reopen the kept work, and the write
  guard keeps a reopened dialog from sending twice (§5).
- **Confirmations are proportionate today** (merge, auto-merge, bulk clear) and should stay that way:
  no new confirmations for submit review or draft toggles. Cleanup stops being a confirmation and
  becomes a choice made in the merge form (D12).

## 3. Unified UX specification

### 3.1 Families

| Family        | Purpose                        | Members                                                                                                                     | Distinctive body                                                                                          |
| ------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Key menu**  | Next-key menus                 | `space`, `g`, `s` (`ctrl+x` shows none, D6)                                                                                 | Non-modal popover, bottom-right above the footer, key-first rows, groups, two columns when ≥ 12 items fit |
| **Picker**    | Choose one or several items    | Commands + Keys (tabs), pull requests, compare (branches/commits tabs + facets), reviewers (multi), `@file` (caret popover) | Query row, windowed list, sections, optional one-row detail strip                                         |
| **Inspector** | Read a list of records         | Checks, conversation, diagnostics                                                                                           | List + scrollable detail; side-by-side when wide, stacked when compact                                    |
| **Form**      | Compose and submit             | Comment (3 targets), submit review, merge                                                                                   | Context line, fields, editor gets remaining rows, inline confirmation                                     |
| **Confirm**   | Approve a consequential action | Clear review marks (post-merge cleanup is a merge option, D12)                                                              | Small, centered, warning tone, named verb and count                                                       |

### 3.2 Anatomy and slots

| Slot       | Rows                         | Content                                         | Rules                                                                                                                                         |
| ---------- | ---------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Padding    | 1 above, 1 below (sheets: 0) | panel fill                                      | Floating panels pad 1 row and 2 columns; sheets pad 1 column only                                                                             |
| Title row  | 1                            | `Title [tabs] context        position  esc`     | Title ≤ 24 cells, bold, never truncated; context truncates first with `…`; position (`2/31`, `2 selected`) and a clickable `esc` on the right |
| Query row  | 0–1                          | `› query▌` + right hint/count                   | Pickers only; the caret and typed text never truncate; the right hint is dropped first                                                        |
| Body       | rest                         | rows, fields, details                           | One row per item; rules (`─`) between regions, never cards; at most one blank row between groups                                              |
| Status     | 0–1                          | `◐ pending`, `✗ failure · recovery`, `▲ hazard` | Shown only when non-empty; steals a body row, never moves the panel; warning and danger paint the row as a band across the full panel width   |
| Action bar | 1                            | `enter primary  key label  key label`           | Labels from the live keymap; primary first and bold; drop lowest priority first; cancel lives in the title row                                |

Chrome is 4 rows for a floating panel (title row, action bar, two padding rows) and 2 for a sheet,
plus the query and status rows when used. There is no border (D1): the panel's fill separates it from
the dimmed app (§3.5). Tone has two carriers, a `▲` before the title and the full-width status band,
and the primary action label takes the same color. Only the top dialog renders, as today, so two
panels of the same fill never overlap; the one nested surface, the `@file` popover, owns the keys, sits
on a raised tint, and fills the action bar with its keys while the parent's title dims.

### 3.3 Geometry and breakpoints

All rectangles come from one pure resolver, unit-tested like `hunk`'s `resolveModalGeometry` and
`ghui`'s `computeModalLayouts`.

| Mode      | Condition                                                                               | Rectangle                                                                                                                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regular   | `cols ≥ 100` and `rows ≥ 30`                                                            | Width per family (picker ≤ 92, inspector ≤ 118, form ≤ 96, confirm ≤ 64, key menu ≤ 58); top-anchored one row below the app header so it never jumps; height fits content at open time up to `rows − top − 2`, then stays fixed while filtering |
| Sheet     | otherwise                                                                               | Full width, covers the app header, ends above the global footer (`rows − 1` tall), no padding rows and 1-column sides; the title row carries the PR/comparison context the dialog needs                                                         |
| Confirm   | any                                                                                     | A floating panel at every size (never a sheet), centered, content height, ≤ 64 wide                                                                                                                                                             |
| Popover   | key menu, `@file`                                                                       | Key menu bottom-right above the footer; `@file` below the caret line, flipped above when it would cross the panel's bottom edge                                                                                                                 |
| Too small | below family minimum (picker 40×10, key menu 30×8, inspector/form 60×18, confirm 40×10) | A fallback naming the needed size and an escape route (`p18-too-small`); never clipped actionable content. Confirmations reserve enough room for the complete warning at narrow widths.                                                         |

Inspectors switch to side-by-side at `cols ≥ 100` (list 40 cells, detail the rest); below that the
list takes at most a third of the body, then a rule, then details.

### 3.4 Density rules

1. One row per list item. Secondary text sits on the same row, muted, and truncates first.
2. No subtitles. A context string belongs in the title row only when it carries data.
3. No instructions in the body. Keys live in the action bar; rare keys live in the Keys tab.
4. No cards. Use one rule between regions and at most one blank row between groups.
5. Counts, positions, and selection counts live in the title row, not in body rows.
6. A list that overflows says so (`↓ N more`, or the `n/total` position in the title row) and keeps
   the cursor visible.
7. The body never shrinks below its minimum; below the family minimum, show the fallback.

### 3.5 Tokens and state vocabulary

Tokens derive from the existing `UiTheme` (no new palette). A borderless panel (D1) has only its fill
for an edge, and terminal-derived themes make `modalBg`, `surface`, and `chromeBackground` the same
gray, so the fills are derived rather than used as-is:

- `panel`: dark themes mix `modalBg` 45% toward `border`; light themes keep `modalBg`.
- `scrim`, behind modal dialogs only: the app background mixed 40% (dark) or 15% (light) toward
  black, with the app's text faded to match (OpenCode uses black at 150/255). A transparent app
  background resolves to the terminal background queried at startup.
- `popover`, for key menus, which have no scrim: `panel` in dark themes; in light themes the app
  background mixed 55% toward `border`.
- `raised` (`@file` inside a dialog): `panel` mixed 8% toward `text`.
- `warningBand`, `dangerBand`: `panel` mixed 16% toward `warning`, `danger`.
- `text`, `muted = textMuted`, `subtle = mix(textMuted, panel, .4)`, `key = accent`,
  `cursorBg = mix(panel, accent, .2)`, `rule = mix(border, panel, .3)`, `warning`, `danger`, `success`.

A contrast test gates every built-in theme and sampled terminal palettes: a panel against what is
behind it (the scrim, or the live app for key menus) ≥ 1.25:1, the cursor row against the panel ≥
1.15:1, text ≥ 4.5:1 and muted ≥ 3:1 where the palette allows. The gate compares unrounded ratios.
Measured with the mockup tokens (`proposal/ui.tsx` `dialogTokens`), rounded down:

| Theme                      | Panel : scrim | Key menu : app | Text  | Muted | Cursor row |
| -------------------------- | ------------- | -------------- | ----- | ----- | ---------- |
| pierre-dark                | 1.39          | 1.32           | 11.9  | 5.4   | 1.66       |
| pierre-light               | 1.54          | 1.27           | 16.4  | 4.9   | 1.33       |
| terminal, Catppuccin Mocha | 1.76          | 1.55           | 7.2   | 4.4   | 1.58       |
| terminal, black and white  | 1.35          | 1.35           | 15.5  | 7.4   | 1.23       |
| terminal, Solarized Light  | 1.31          | 1.29           | 3.8 ¹ | 7.5   | 1.20       |

¹ The palette's own foreground on its own background. One gap remains: in Solarized Light a sheet's
fill equals `chromeBackground`, so the sheet's action bar meets the global footer with no edge
(1.00:1); slice 1 must separate them.

| Meaning                             | Glyph + word                                        | Color                              | Never                            |
| ----------------------------------- | --------------------------------------------------- | ---------------------------------- | -------------------------------- |
| Cursor (where Enter acts)           | `›` in the gutter + `cursorBg` row                  | key                                | color only                       |
| Chosen (multi-select)               | `[x]` / `[ ]`                                       | success / muted                    | same mark as "already requested" |
| Already applied, not selectable     | `✓` + word (`requested`)                            | subtle                             | `[x]`                            |
| Radio value                         | `●` / `○`                                           | key / muted                        | "default selection"              |
| Failed / running / passed / skipped | `✗ failed` · `◐ running` · `✓ passed` · `– skipped` | danger / warning / success / muted | status word alone (`completed`)  |
| Hazard / consequence                | `▲` + sentence, in a warning band                   | warning                            | `⚠` (width disagreement)         |
| Pending                             | `◐` + present-tense verb                            | key                                | silent pending                   |
| Head / base / current               | `●` head, `◆` base, `◇` working tree + words        | key / warning / muted              | tint alone                       |
| Truncation                          | `…`                                                 | inherited                          | `...`                            |

Every chrome glyph must measure 1 cell in both OpenTUI and `Bun.stringWidth`; a unit test enforces
it (the probe found `⚠` = 2 in OpenTUI, 1 in Bun). User content (names, titles) may be wide;
truncation uses display width by grapheme.

### 3.6 Action and hint hierarchy

- Each dialog mode declares action specs: `{ actionId, label, priority, tone, when }`. The bar asks
  the reverse keymap (`getActionBindingSequences`) for the **primary** binding of each action in that
  mode — the shortest sequence, preferring a direct key, then `space`, then `ctrl+x` — so remapped
  keys show their real label; unbound actions disappear from the bar.
- Priority: primary (never dropped) → frequent → occasional. Cancel (`esc`) is always in the title
  row. When a label must shrink, drop the hint before shortening the primary label.
- Primary labels name the consequence and count: `request 2`, `confirm squash-merge`,
  `enable auto-merge`, `add comment`, `clear 1 file`.
- In text-entry modes the bar shows the newline key the terminal can actually send: `shift+enter`
  when the kitty keyboard protocol is active (`renderer.capabilities.kitty_keyboard`), otherwise
  `alt+enter` (and `ctrl+j` once `linefeed` maps to newline).
- `?` opens Keys only in modes where `?` is not text; the global footer stops advertising `? help`
  in text modes.
- Outside dialogs the global footer shows `? keys` and `ctrl+p commands` beside the mode badge,
  each with the action's primary binding in that mode. The Keys and Commands tabs show `tab`
  to the other tab instead (`app-footer.tsx` `getFooterHints`).

### 3.7 Navigation and focus

| Key                      | Meaning in every dialog                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `↑ ↓`                    | Move the cursor (lists) or the caret (multi-line text). `j k` too when the dialog has no text input.                                                                     |
| `ctrl+n ctrl+p`          | Move the list cursor while a text field has focus; `ctrl+x j/k` keeps working too (D7).                                                                                  |
| `pgup pgdn` · `home end` | Page / jump the focused list or detail pane (keymap actions, not native scrollbox handlers).                                                                             |
| `tab shift+tab`          | Next / previous region or field. Never submits. Switches tabs in tabbed pickers.                                                                                         |
| `enter`                  | Activate the cursor item (pickers), submit (forms), confirm (confirm/inline confirm).                                                                                    |
| `space`                  | Toggle the cursor item in non-text multi-select lists (merge options, facets). Text pickers toggle with `enter`.                                                         |
| `esc`                    | Dismiss the innermost layer: popover → inline confirmation → dialog. Never discards typed text silently. During a write it closes the dialog without cancelling it (D9). |
| Mouse                    | Click selects a row; a second click activates; wheel scrolls; clicking an action-bar hint runs it; clicking `esc` closes. Keyboard stays sufficient.                     |

Without borders, focus is the caret or the cursor row (`›` on `cursorBg`); a popover that owns the
keys sits on the raised tint and its keys fill the action bar. Opening a dialog switches the keymap
mode synchronously, so type-ahead lands in the dialog.

### 3.8 Truncation and scrolling

- Titles: never truncated. Context: end-truncated. Paths: middle-truncated (`src/…/review.ts`).
  Branch names and PR titles: end-truncated. Right-aligned metadata (age, keys) is never truncated;
  descriptions yield first.
- The full value of a truncated cursor row appears in the picker's detail strip (one row) or the
  inspector detail.
- Lists window around the cursor (keep 2 rows of context when moving); filtering resets the cursor
  to the first match but keeps the multi-selection.
- Detail panes scroll with `pgup/pgdn` and the wheel; the scroll position resets when the record
  changes.

### 3.9 Copy rules

- Titles are task nouns: `Commands`, `Keys`, `Compare`, `Pull requests`, `Request reviewers`,
  `Checks`, `Conversation`, `Diagnostics`, `Comment`, `Submit review`, `Merge #1`,
  `Clear review marks`.
- The status line reports outcomes (`Requested review from 2 people`, `Merged #1 (squash)`), not
  navigation (`Opened…`, `Closed…`; D10). Pluralize correctly.
- Errors say what failed, what was kept, and how to retry, with the retry as the primary action:
  `Request failed: permission denied for @priya. Your selection is kept.` · `ctrl+s retry 2`.
- Outcomes of a write whose dialog was closed name their object and the way back:
  `Added comment on src/review.ts:2` · `Comment not added: … Press a on src/review.ts:2 to reopen it.`
- Mode badges use plain words: `COMMANDS`, `KEYS`, `COMPARE`, `REVIEWERS`, `CHECKS`, `COMMENT`, `MERGE`.

### 3.10 Terminal capabilities and fallbacks

| Capability                 | Where it matters                               | Fallback                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kitty keyboard protocol    | `shift+enter` newline, `ctrl+…` disambiguation | Detect via `renderer.capabilities`; show and accept `alt+enter`/`ctrl+j` (`linefeed`). Document tmux `extended-keys`.                                                                                 |
| Bracketed paste (`?2004h`) | All text inputs                                | Handle `paste` events; normalize CRLF; single-line inputs join lines with spaces; never treat pasted newlines as submit. Without bracketed paste, input arrives as keys (OpenTUI default enables it). |
| Hyperlinks (OSC 8)         | Checks and conversation links                  | Keep printing the URL as text; `y` copies.                                                                                                                                                            |
| Clipboard                  | `y` copy actions                               | `clipboardy` locally; follow-up OSC 52 when remote (SSH) or when `clipboardy` fails.                                                                                                                  |
| Mouse                      | Rows, action bar, `esc`                        | Keyboard is complete; mouse is additive.                                                                                                                                                              |
| Unicode width              | Chrome glyphs, names                           | Chrome glyph test (§3.5); user content truncated by graphemes; ambiguous-width terminals already affect the app's box drawing — documented, not solved.                                               |
| Low color / `NO_COLOR`     | Status, cursor                                 | Glyphs and words carry meaning; color only reinforces.                                                                                                                                                |
| Screen readers             | All                                            | The text grid is plain, labels are words, but OpenTUI redraws diffs and exposes no accessibility tree. Documented limitation.                                                                         |

## 4. Concrete layouts

Rendered with the real OpenTUI/Yoga layout by `artifacts/ui-review/proposal/mockups.tsx` over the
dimmed real app frame (PNG pairs in [the gallery](../../artifacts/ui-review/proposal/index.html), all
cell text in `proposal/wireframes/`). The mockups prove geometry and hierarchy, not final copy. Panels
have no border, so below `░` marks the dimmed app around a floating panel, and sheets fill the screen
above the global footer. Fills, tints, and tone bands show only in the PNGs.

### 4.1 Picker — Commands at 80×24 (sheet, `p01`)

```text
  Commands  Keys                                                      1/24  esc
 › Search commands                                                  24 commands
   Suggested
 › Open PR checks  1 failing, 1 running                                 space s
   Request reviewers  alex requested                                    space w
   Submit review  1 pending comment                                           A

   Review
   Mark file reviewed  src/review.ts                                          x
   Next unreviewed file                                                       u
   Add review comment  src/review.ts:2                                        a
   Collapse or expand file                                                    c

   Pull request
   Merge pull request  squash · checks failing                                m
   Open conversation  1 comment                                               t
   Convert to draft                                                     space D
   Open pull request list                                                     p
   Copy PR URL                                                                y

   View
   Switch split / unified                                                     v
 enter run  ↑↓ move  tab keys  ctrl+u clear
```

Filtering flattens the list, highlights matches, and moves the group name to the right
(`p02`). Disabled commands sort last with their reason in italics. Keys (`p03`, D5) is the same
picker: key-first rows generated from the resolved keymap, current pane first, searchable.

### 4.2 Picker — reviewers at 120×40 (floating panel, `p06`; failure in `p07`)

```text
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░                                                                                            ░
░  Request reviewers  #1 Improve the keyboard-driven review workfl…  2/31 · 2 selected  esc  ░
░  › Filter by name or @username                                 existing requests are kept  ░
░  ────────────────────────────────────────────────────────────────────────────────────────  ░
░    Requested                                                                               ░
░    ✓   Alex Rivera  @alex                                                       requested  ░
░                                                                                            ░
░    Suggested by GitHub                                                                     ░
░  › [x] Sam Chen  @sam                                                        past commits  ░
░    [x] Priya Natarajan-Okonkwo-Fitzgerald  @priya                            past reviews  ░
░                                                                                            ░
░    Everyone                                                                                ░
░    [ ] Jordan Lee  @jordan                                                                 ░
░    [ ] 李小龍 Bruce Lee 🐉  @bruce                                                         ░
░    [ ] Person 5  @user-5                                                                   ░
░    … 15 more people …                                                                      ░
░    [ ] Person 21  @user-21                                                                 ░
░    ↓ 9 more                                                                                ░
░  ctrl+s request 2  enter toggle  ↑↓ move  ctrl+r reload                                    ░
░                                                                                            ░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

In `p07` the failure takes the status row as a danger band (`✗ Request failed: permission denied for
@priya. Your selection is kept.`) and the primary becomes `ctrl+s retry 2`. Row metadata in mockups is
limited to fields core already loads (requested reviewers carry no timestamp; dashboard PRs carry no
check state). Compare (`p08`) uses the same body with tabs, an inline facet row instead of the Filters
dialog (D3), head/base/working-tree glyphs separate from the cursor, a one-row detail strip, and
`enter set head  b set base` in the bar (D8). Pull requests (`p08b`) put number, title, repository,
author, state, and age on one row.

### 4.3 Key menu — `space` at 80×24 and 120×40 (`p04`)

```text
  space  open                esc        space  open                                    esc
  Pull request                          Pull request              Review
  s  Checks · 1 failing                 s  Checks · 1 failing     a  Comment on line
  t  Conversation                       t  Conversation           A  Submit review
  w  Request reviewers                  w  Request reviewers
  m  Merge                              m  Merge                  App
  D  Convert to draft                   D  Convert to draft       l  Compare
  p  Pull request list                  p  Pull request list      d  Diagnostics
                                                                  h  Keys
  Review                                                          Y  Copy reopen command
  a  Comment on line
  A  Submit review

  App
  l  Compare
  d  Diagnostics
  h  Keys
  Y  Copy reopen command
```

The popover is non-modal: the app behind it stays undimmed, so the menu is a reminder, not an
interruption. From 100 columns the groups flow into two columns. `ctrl+x` never shows a menu (D6): the
footer reads `CTRL+X waiting for key` as it does for `space`, the next key runs its command or the 2 s
timeout cancels as today, and `ctrl+x ?` opens the Keys tab, which lists leader bindings in their own
section.

### 4.4 Inspector — checks at 80×24 and 120×40 (`p09`; conversation `p09b`)

```text
 Checks  #1 · 52eb733 · ✗ 1 failed  ◐ 1 running  ✓ 1 passed            1/3  esc
 › ✗ Type checking                                                       failed
   ◐ Build packages                                                     running
   ✓ Unit tests                                                          passed
 ──────────────────────────────────────────────────────────────────────────────
 ✗ Type checking  failed · GitHub Actions · 4m 12s

 Type checking failed

 src/review.ts:3 — Expected a documented default.
 Run vp check before merging.

 https://github.com/example/repo/actions/runs/1
 … 9 more rows for long summaries …
 y copy link  ↑↓ select  pgup/pgdn scroll details  r refresh

░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░                                                                                                                ░
░  Checks  #1 · 52eb733 · ✗ 1 failed  ◐ 1 running  ✓ 1 passed                                          1/3  esc  ░
░  › ✗ Type checking                 failed │ ✗ Type checking  failed · GitHub Actions · 4m 12s                  ░
░    ◐ Build packages               running │                                                                    ░
░    ✓ Unit tests                    passed │ Type checking failed                                               ░
░                                           │                                                                    ░
░                                           │ src/review.ts:3 — Expected a documented default.                   ░
░                                           │ Run vp check before merging.                                       ░
░                                           │                                                                    ░
░                                           │ https://github.com/example/repo/actions/runs/1                     ░
░                                           │                                                                    ░
░                                           │                                                                    ░
░                                           │                                                                    ░
░                                           │                                                                    ░
░  y copy link  ↑↓ select  pgup/pgdn scroll details  r refresh                                                   ░
░                                                                                                                ░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

At 120×40 the inspector is content-fit (16 rows) and grows to the available height for long
summaries. `4m 12s` is illustrative; durations appear only if core already has them.

### 4.5 Form — merge with inline confirmation at 80×24 (`p13`, `p14`, `p15`)

```text
 ▲ Merge #1  feature → main · Improve the keyboard-driven review workflow   esc
 Method   ● Squash   ○ Merge commit   (rebase is not supported by diffdiff)
 Options  [ ] Auto-merge when requirements pass                          ctrl+g
          [x] Clean up local refs after merge           feature, origin/feature
 ──────────────────────────────────────────────────────────────────────────────
 Title    Improve the keyboard-driven review workflow (#1)

 Body     ## Summary
          Make review navigation faster and keep actions discoverable.
          - Preserve keyboard-first interactions
          - Clarify destructive actions
          … 10 more editor rows …
 ▲ Squash-merge #1 into main, then clean up local refs? 1 check is failing.
 enter confirm squash-merge  esc back to edit
```

Before the first Enter the status row is a warning band built from data already loaded
(`▲ 1 check failing · 1 running · review required`) and the bar reads `enter squash-merge…`,
`tab next field`, `ctrl+g auto-merge`, `ctrl+x e editor`. The options row holds auto-merge and the
cleanup choice (D12): `Clean up local refs after merge` starts checked, remembers your last choice,
names the refs it would remove, and is unavailable with auto-merge because GitHub merges later. Tab
reaches the options and space toggles them. In the confirmation state (D4) the fields lock and dim,
the title gains `▲`, the band names the consequence, cleanup included, and the primary label turns
warning. Auto-merge names its own consequence, in full even at 80×24 (`Enable auto-merge (squash)?
GitHub merges #1 once its requirements pass.`). Review state comes from the loaded `reviewDecision`
(`review required`); approval counts are not loaded and are not shown.

### 4.6 Form — comment with `@file` at 120×40 (`p10`, `p10b`; submitting `p11`)

```text
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░                                                                                                ░
░  Comment  src/review.ts line 2 (removed) · pending review                                 esc  ░
░    2 -   return false;                                                                         ░
░  ────────────────────────────────────────────────────────────────────────────────────────────  ░
░  Why does this default to true now? The old behaviour returned false                           ░
░  for empty sessions — see @                                                                    ░
░                                                                                                ░
░                            @ file                                                              ░
░                            › README.md             modified                                    ░
░                              src/review.ts        this file                                    ░
░                                                                                                ░
░                                                                                                ░
░                                                                                                ░
░                                                                                                ░
░  enter insert file  ↑↓ choose  esc dismiss                                                     ░
░                                                                                                ░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

The `@file` popover sits on a raised tint under the caret; while it is open, its keys fill the bar and
the composer's title dims. While composing, the bar reads `enter add comment`, `alt+enter newline`,
`@ file`, `ctrl+x e $EDITOR`, with `↑ drafts` on the right. While submitting (`p11`) the status row
reads `◐ Adding comment to your pending review…`, the text dims and takes no input, Enter does
nothing, and the bar offers `esc close (keeps sending)` (D9, §5). Submit review (`p12`) puts the three
events in a radio list with their consequences; Tab moves to the summary.

### 4.7 Confirm — clear review marks at 80×24 (`p17`)

```text
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░                                                                ░
░  ▲ Clear review marks                                     esc  ░
░  1 reviewed file becomes unreviewed. Local only; the           ░
░  comparison stays open.                                        ░
░                                                                ░
░  enter clear 1 file  esc cancel                                ░
░                                                                ░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

Confirmations float at every size and keep one blank row above the action bar. Post-merge cleanup is
no longer a dialog; it is a merge option (D12, §4.5).

### 4.8 Row budgets, before and after

Counted from the current captures and the proposal wireframes. The mockups use larger synthetic
lists (31 reviewers, 43 branches, 40 PRs) so capacity is visible; the current captures' limits come
from window constants, not from a shortage of data, except where noted. Floating panels at 120×40
spend one more chrome row than a bordered frame would; sheets at 80×24 spend one fewer.

| Surface                | Measure                             | 80×24 now                   | 80×24 proposed | 120×40 now                | 120×40 proposed      |
| ---------------------- | ----------------------------------- | --------------------------- | -------------- | ------------------------- | -------------------- |
| Commands               | legible commands                    | 0 (6 overlapped)            | 13             | 0 (22 overlapped)         | 18                   |
| Keys / help            | bindings                            | 4                           | 15             | 10                        | 18 (all; filterable) |
| Reviewers              | people                              | 1–2 (fixture has 3)         | 13             | 3 of 3 (cap 8)            | 22                   |
| Reviewers              | rows showing people / dialog rows   | 3 of 17                     | 13 of 23       | 4 of 20                   | 22 of 34             |
| Compare (43 branches)  | branch rows, cursor visible         | 8, cursor hidden (L)        | 16             | unbounded until overlap   | 25                   |
| Pull requests (40)     | rows                                | ≤ 10 (constant)             | 19             | ≤ 10                      | 28                   |
| Checks                 | detail rows                         | 4                           | 17             | 10                        | 12, up to 30         |
| Comment                | editor rows                         | 6 (box grows without limit) | 19             | 6                         | 10                   |
| Merge                  | body rows                           | 8 (fixed scrollbox)         | 14             | 8                         | 10                   |
| Primary action visible | composer / submit / merge / cleanup | no / no / no / unlabeled    | yes ×3 ¹       | no / no / yes / unlabeled | yes ×3 ¹             |

¹ Cleanup is no longer a dialog; it is a merge option (D12).

## 5. Interaction contracts

| Family    | Open / initial focus                                                               | Navigate / edit                                                 | Activate vs submit                                                                                         | Cancel / back                                                                                                                                                            | Parent restore                                                    | Pending / error                                                                                                           | Preserved                                                                                  |
| --------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Key menu  | Prefix key (`space`, `g`, `s`); no focus change; `ctrl+x` shows no menu (D6)       | Next key only                                                   | The bound key runs its action                                                                              | `esc` cancels; unbound key cancels with `No command on space x`                                                                                                          | Returns to the pane; restores blurred focus (existing controller) | —                                                                                                                         | Pane state                                                                                 |
| Picker    | Query row focused (Compare: list focused, `/` focuses the filter)                  | Typing filters live; `↑↓`/`ctrl+n/p` move; `pgup/pgdn/home/end` | `enter` activates the cursor row (Compare: sets head, D8); multi-select: `enter` toggles, `ctrl+s` commits | `esc` closes and resets the query (unchanged); popover `esc` returns to the editor                                                                                       | Dialog stack unchanged (`restore-parent` rules in `stack.ts`)     | Status slot: `◐ Loading…`, `✗ … · ctrl+r retry`; list keeps last good data; reviewer requests follow the write rule below | Query, cursor, multi-selection through filtering and resize                                |
| Inspector | List focused, first record (failed checks first)                                   | `↑↓` select; `pgup/pgdn` scroll detail; `tab` focuses detail    | `y` copy, `r` reply (conversation), `r` refresh (checks)                                                   | `esc` closes; reply composer `esc` returns here with selection kept                                                                                                      | Composer completes or dismisses back to the inspector             | Status slot for refresh and copy results                                                                                  | Selection, detail scroll per record                                                        |
| Form      | First field: editor (comment), event list (submit review), title or method (merge) | Text editing per §3.7; `tab` between fields                     | `enter` submits (comment, review) or enters the inline confirmation (merge)                                | `esc` leaves; comment saves a draft (exists); submit-review summary and merge edits kept for the session (new); during a write `esc` closes and the write continues (D9) | `complete`/`dismiss` exits as today                               | Write rule below; while open, failures show in the status slot with retry                                                 | Body, fields, method, auto-merge choice; the cleanup option persists across sessions (D12) |
| Confirm   | Primary action focused                                                             | —                                                               | `enter` performs the named action                                                                          | `esc` = cancel                                                                                                                                                           | Closes (unchanged)                                                | — (local and instant)                                                                                                     | —                                                                                          |

**Writes in flight (D9).** One rule for comment, submit review, merge with its cleanup, auto-merge,
reviewer requests, and draft toggle:

1. Enter starts the write through the write guard. Inputs pause (text dims, Enter is inert) and the
   status row shows `◐ <verb>…`.
2. `esc` closes the dialog and the write continues. The guard is per surface: until the write
   settles, that surface's Enter stays inert and its status row says what is still sending, even
   after the dialog is closed and reopened.
3. Each write carries an operation token bound to its dialog instance, PR, and target. Only the
   owner may close or reset dialog state, so a comment that lands after you opened a composer for
   another line leaves that composer alone. A completion whose dialog is gone reports in the status
   line and never opens, replaces, or closes another dialog (I-27).
4. Success after close reports the outcome (`Added comment on src/review.ts:2`,
   `Merged #1 (squash)`). Nothing opens after a merge: cleanup follows the merge form's option (D12)
   and acts only when GitHub deleted the head branch. It removes the stale remote-tracking ref and the
   local branch, but keeps the local branch when it is checked out or its tip is not contained in the
   merged head commit, and says why (`Kept local feature: 2 commits are not in #1.`).
5. Failure after close raises an error notification, naming what failed and how to reopen
   (`Comment not added: … Press a on src/review.ts:2 to reopen it.`), and never covers a dialog:
   while one is open the footer carries a one-line `✗` summary, and the error appears once none is.
   The work is kept: the comment body as that line's draft (the existing dismissed-draft restore),
   the review event, summary, and merge fields for the session, and the reviewer selection until a
   request succeeds.
6. A success consumes the draft it sent: reopening the line restores a dismissed draft only when it
   is newer than the line's last submission, so posted text never comes back as a draft.

**Intentional changes:** Tab no longer submits; `ctrl+n/p` joins `ctrl+x j/k` for moving a list
while typing, and both stay (D7); Filters becomes a facet row (D3); merge confirmation becomes inline
(D4); Help becomes the Keys tab (D5); Enter sets the head on branch rows (D8); `esc` closes a dialog
while its write continues (D9), where the reviewer picker blocks `esc` today, as
`gh-integration.md` documents; status narration of opens and closes disappears (D10); Submit review
opens on the event list (D11); post-merge cleanup becomes a remembered merge option instead of a
dialog (D12); dialogs cover the app header below 30 rows (D2).

## 6. Simplification architecture

### 6.1 Presentational primitives (`packages/tui/src/components/dialog/`)

| Module                                               | Replaces                                                                                                     | Notes                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometry.ts`                                        | `width="92%"`/`maxWidth` props, `terminalWidth` math in diagnostics, window constants                        | Pure `resolveDialogRect(family, cols, rows, { headerRows, contentRows })`; unit tests per breakpoint                                        |
| `panel.tsx` (`DialogPanel`)                          | `ModalFrame`, 5 hand-rolled overlays, `MODAL_OVERLAY`/`REVIEW_BORDER` duplicates                             | Borderless panel (D1): title row with title/tabs/context/position/esc, padding by breakpoint, tone marker and full-width status band, slots |
| `list-view.tsx`                                      | Palette/help/prefix rows, `CommandListItem/Row`, 3 `ListRow`/`EmptyListNotice` copies, manual windows        | Windowed rendering (only visible rows mount), sections, cursor reveal, mouse, empty/no-match/loading/error states                           |
| `query-row.tsx`, `status-line.tsx`, `action-bar.tsx` | `TextInputContent` call sites with ad hoc prompts, toasts in dialogs, `KeyCap` trains, `text-input-hints.ts` | Action bar consumes action specs + reverse keymap                                                                                           |
| `key-menu.tsx`                                       | `prefix-picker-overlay.tsx`                                                                                  | Groups and columns for `space`, `g`, `s`                                                                                                    |
| `glyphs.ts`, `tokens.ts`, `text.ts`                  | color-only states, `tintHex` call sites, `.length` truncation                                                | Panel, scrim, popover, raised, and band tokens with contrast floors (§3.5); display-width utilities by grapheme; chrome glyph test          |

Dialog components stay display-only and receive view models; they never import actions.

### 6.2 Behavior and domain (stays in `app/`, not in components)

| Change                  | Where                                                                                                                                                                                                                                                                                                                       | Why                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Synchronous keymap mode | `use-main-keyboard.ts` commits each native keypress/paste through OpenTUI React's public `flushSync`; no second mode store. `use-synchronous-state.ts` keeps the dialog stack ref current for async ownership checks                                                                                                        | I-2; one source for "where keys go"                             |
| One write guard         | `app/review/write-guard.ts` (`runExclusive(key, fn)`), adopted by comment, review, merge, cleanup, reviewers, draft; each write holds an operation token (dialog instance, PR, target), and only the owner may touch dialog state                                                                                           | I-1, I-27, D9; codifies the existing ref-guard pattern          |
| Paste routing           | `use-main-keyboard.ts` subscribes once to `renderer.keyInput` `paste`, dispatches to the active text controller                                                                                                                                                                                                             | I-3                                                             |
| Keymap fixes            | `defaults.ts`: drop `tab` → `LIST_ACCEPT` outside autocomplete; map `linefeed` → `TEXT_NEWLINE`; add `ctrl+n/p`; keymap scroll actions for help/conversation/diagnostics instead of focused native scrollboxes                                                                                                              | I-4, I-5, I-15                                                  |
| Action metadata         | `app/keymap/action-meta.ts`: title, group, short help for all 97 actions (absorbs `ACTION_DISPLAY_TITLES` and command titles)                                                                                                                                                                                               | Keys tab, key menus, palette, action bars share labels          |
| Merge eligibility       | One `getMergeEligibility(pr, { autoMerge, method })` used by the router, `openMergeConfirmDialog`, and `MERGE_TOGGLE_AUTO`                                                                                                                                                                                                  | I-24; removes triplicated rules                                 |
| Merge cleanup option    | Merge form options row; core `preferences.ts` stores one remembered `cleanup.afterMerge` (default on; existing `removeLocal`/`removeRemote` migrate as their OR); after a merge, `removeCleanupRefs` skips a checked-out local branch and one whose tip is not an ancestor of the merged `headSha`                          | D12, I-27; deleting a branch by default must never lose commits |
| Inline status           | Dialog-scoped status/error state; the global toast remains for pane-level events and never covers a dialog (a background failure uses a footer `✗` summary while a dialog is open). Error notifications expire five seconds after each occurrence; pane toasts also have a clickable X, with `esc`/`x` dismissal preserved. | I-16, D9                                                        |

`packages/core` changes only for the cleanup option (D12: the preference and the local-branch safety
check) and possibly to expose eligibility helpers if a non-TUI client would need them. No new network calls: hazard lines and counts use data the session already holds.

### 6.3 Retirement and compatibility

Deleted: `ModalFrame`, `components/command-list.tsx`, `components/branch-list-view.tsx` (labels moved
to `branch-labels.ts`), `components/help-modal.tsx`, `components/list-filter-modal.tsx`,
`review/merge-confirm-modal.tsx`, `review/post-merge-cleanup-modal.tsx`, and static input hints. The
cleanup stack id, mode, actions, selection state, and updater are deleted too. Prefix popovers were
rewritten in place. `KeyCap` and review border utilities remain only where the main review panes
still use them, not as a second dialog system. Internal `help`/`list-filter` names remain compatibility
aliases for Keys/facet focus so existing keymaps and parent restoration continue to work.

## 7. Rollout slices

### Implementation record

- **0a, first safety pass:** synchronous write claims now cover comment, review, merge, cleanup,
  reviewers, and draft toggles. Inputs pause during writes, with Esc still available. Reviewer
  requests can be backgrounded and reopened without a second send. Comment/review/merge completions
  check their originating stack entry before closing/resetting a dialog. A backgrounded merge never
  opens cleanup over another dialog. Mutation-triggered reloads cannot supersede a newer refresh.
  Successfully submitted comment snapshots no longer restore as dismissed drafts. Errors stay in the
  footer while an unrelated dialog is open; owned failures use the form's status band. Background
  errors name the PR and resolved reopen binding. Review/merge drafts are scoped to repository and
  PR for the session and consumed only after confirmation.
- **0b:** the public OpenTUI React `flushSync` API commits each keyboard event before the parser
  delivers the next. Real burst tests prove `a` + `nice` + Enter submits `nice`, not diff commands.
  This replaces the proposed second mode store: the existing React state remains authoritative.
- **0c, editing portion:** bracketed paste routes to all seven text modes, normalizes CRLF, preserves
  newlines in multiline fields and joins them in filters/title fields. Typing, horizontal/vertical
  movement, word deletion, backspace, delete, and the block caret respect grapheme boundaries.
  Shared truncation now uses terminal-cell widths without splitting graphemes; paths retain both ends.
- **0d:** Tab only accepts file completions; without one it does nothing. Legacy `linefeed`
  (Ctrl+J) maps to newline in multiline fields. Auto-merge's confirmation status names auto-merge.
- **0e:** the remembered `cleanup.afterMerge` checkbox is part of the merge form. Default on;
  legacy flags migrate with OR, and new saves write only the single option. Auto-merge disables it.
  Cleanup runs only for the deleted PR head, revalidates tip SHAs, preserves branches checked out
  in any worktree and commits outside the merged PR head, and reports partial failures without
  suggesting another merge. A confirmed merge remains confirmed if local ref refresh fails.
- **1–2:** `components/dialog/` owns geometry, accessible tokens, cell-aware labels, bounded rows,
  detail/editor viewports, and resolved action bars. Compact sheets cover the header and preserve
  the global footer; small terminals show a non-actionable fallback. Key menus remain non-modal,
  key-first popovers; Ctrl+X never opens one. Solarized Light-style footer equality is resolved.
- **3:** Commands and Keys are two searchable tabs. `?` opens Keys; `ctrl+x ?` opens the leader
  section. Both navigation aliases remain available. The old Help renderer is deleted.
- **4:** Compare, PRs, and reviewers use the shared windowed list. Compare's facets stay inline and
  `/` filters branches or commits. Enter activates the row (including head selection). PRs start
  in their query field. Reviewers separate cursor and checked/requested state, support direct
  checkbox clicks, and retain failed selections.
- **5:** checks, conversation, and diagnostics share the list/detail inspector, including compact
  stacking, Tab detail focus, page scrolling, and per-record detail scroll positions.
- **6:** all write forms use bounded editors and status slots. The `@file` popover is caret-anchored;
  Tab inserts only a completion. Submit review starts on events, with Tab to the summary. Merge's
  warning confirmation is an inline state of the same panel, not a second overlay. Clear-review
  remains a floating confirmation with an explicit amber action and consequence.
- **7:** retired Help, Filters, merge-confirm, and cleanup renderers, old command/branch row wrappers,
  `ModalFrame`, and static input-hint paragraphs are deleted. The cleanup stack id, mode, actions,
  selection state, and persistence updater are gone. Open/close narration is removed at its call sites.
  Existing `help` and `list-filter` configuration/stack names remain internal compatibility aliases
  for the Keys tab and inline facet focus; they do not render separate windows.

Actual application evidence is in `artifacts/ui-review/implemented/`: 51 native captures at 120×40,
80×24, and 58×16, with an HTML gallery, text, span JSON, PNGs, and an isolated offline generator.
`proposal/` remains the approved design reference and the original captures remain untouched.

Tests live at the approved boundaries: the real-layout app harness (keyboard bursts, paste,
callback counts, visible state), and the public text-input/history helpers. Live fixture checks
use only mocked GitHub writes, never real comments, reviews, merges, or ref deletions.

Verification includes rectangle/overlap checks at 80×24, 120×40, 160×48, and 58×16, resize round trips,
remapped/clickable action bars, Unicode/paste, background errors, draft restoration, and large fixtures
(1,000 branches and 2,000 reviewers). Native live checks use only disabled write callbacks. Final
suite counts and benchmark results are recorded with the completion report.

Final verification: `vp run ready` passes formatting/lint/types, **516 unit tests** (119 core +
397 TUI), **102 native visual tests**, both builds, and the bundled syntax-worker smoke test. The
240-file navigation benchmark has zero extra frames, a worst first-frame p95 of **22 ms**, and
3,151 renderables at launch and maximum. These are measured results, not a baseline speedup claim.
Live 80×24 PTY verification confirms burst routing, Tab, legacy Ctrl+J, multiline/emoji paste,
exactly one comment callback per double Enter, inline merge confirmation, the remembered cleanup
toggle, and background errors remaining in the footer instead of covering another form.

A persistence regression found during verification is also fixed: saving a GitHub preference now
preserves saved key overrides and serializes writes. App unit tests stub preference I/O (the visual
preload already isolates HOME), rather than writing to the real preferences path.

### Original rollout slices (implemented)

This table records the original sequencing and acceptance criteria. The rollout was implemented
and verified as one integrated change; see Git history for its integration into `main`.

| Slice                                 | Scope                          | Main files                                                                                                                                                         | Depends on | Acceptance tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Risks · rollback               |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **0a** writes                         | I-1, I-17, I-27, D9            | `github-mutation-actions.ts`, `reviewer-picker-actions.ts`, `modal-action-dispatch.ts`, `review-input-controllers.ts`, `composer-history.ts`, new `write-guard.ts` | —          | Red-green: burst `Enter Enter` → exactly one call for comment, review, merge, cleanup, reviewers; inputs pause while pending; `esc` closes and the write still lands once; reopening while pending cannot resend; comment A → `esc` → composer B → A succeeds or fails: B keeps its text and is not covered; background success then reopen restores no sent text; a merge completing after close opens, replaces, and clears no dialog (also on the reload-failure path); a failure after close keeps the draft; live ht repeat; `gh-integration.md` reviewer-picker semantics updated | Medium (every write) · revert  |
| **0b** synchronous mode               | I-2                            | `app-controller.tsx`, `use-main-keyboard.ts`, dialog open/close helpers                                                                                            | —          | Red-green: `a` + `nice` in one burst inserts `nice`, runs no diff action; `t`+`r` replies; nested restore still correct                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Medium (central path) · revert |
| **0c** paste + graphemes              | I-3, I-25                      | `use-main-keyboard.ts`, text controllers, `input-state.ts`, `app/shared/text.ts`                                                                                   | 0b         | Paste into palette, reviewers, PR search, commit search, composer, merge body; CRLF and multi-line rules; typing, moving over, and deleting emoji and CJK by grapheme; display-width truncation                                                                                                                                                                                                                                                                                                                                                                                         | Low · revert                   |
| **0d** newline/Tab/copy               | I-4, I-5, I-10 copy            | `defaults.ts`, `input-state.ts`, `controller-helpers.ts`                                                                                                           | —          | Tab never submits; `linefeed` inserts newline; auto-merge status names auto-merge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Low · revert                   |
| **0e** cleanup option                 | D12, I-27 (cleanup)            | `merge-pull-request-modal.tsx`, `github-mutation-actions.ts`, core `preferences.ts` and `pull-request-service.ts`; deletes `post-merge-cleanup-modal.tsx`          | 0a         | The option starts checked, persists, and migrates old preferences; unavailable with auto-merge; foreground and backgrounded merges clean up with no dialog; a checked-out branch or one with commits beyond the merged head is kept, with a status message; nothing is removed when GitHub kept the branch; live ht                                                                                                                                                                                                                                                                     | Medium (deletes refs) · revert |
| **1** foundation                      | primitives without UI change   | `components/dialog/*`, `action-meta.ts`                                                                                                                            | —          | Geometry table tests; hint labels equal reverse-keymap primaries for every spec (with a user override fixture); glyph width test; contrast floors (§3.5) for built-in themes and sampled terminal palettes, including the Solarized Light sheet/footer edge                                                                                                                                                                                                                                                                                                                             | None (unused)                  |
| **2** vertical slice: Commands + Keys | I-6, I-12, I-13, I-22          | palette, help models, router                                                                                                                                       | 1          | 80×24/120×40/160×48; 200 commands; no-match; disabled reasons; resize while filtering; no text overflow (§9.1); live ht                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Medium · revert slice          |
| **3** key menus + footer              | I-21, I-23 (I-14 closed by D6) | `prefix-menus.ts`, `key-menu.tsx`, panel, `app-footer.tsx`                                                                                                         | 1          | `ctrl+x` shows no menu (regression test); `ctrl+x ?` opens Keys at the leader section; unbound/disabled keys; labels follow remaps; footer hides `? help` in text modes                                                                                                                                                                                                                                                                                                                                                                                                                 | Low                            |
| **4** pickers                         | I-7, I-9, I-11, I-19           | PR list, reviewers, compare, autocomplete                                                                                                                          | 2          | 1,000 branches, 2,000 reviewers bounded renderables; facets (D3); selection survives filtering; Enter sets head on branch and working-tree rows (D8)                                                                                                                                                                                                                                                                                                                                                                                                                                    | Medium                         |
| **5** inspectors                      | I-15, I-20                     | checks, conversation, diagnostics                                                                                                                                  | 1          | Side-by-side ≥ 100 cols; long summaries scroll; keymap-driven scroll; no native focus handling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Low                            |
| **6** forms + confirms                | I-8, I-10, I-16, I-18          | composer, submit review, merge, clear                                                                                                                              | 0a–0e, 1   | Inline confirm with warning band (D4); merge options row (D12); Submit review opens on the event list (D11); hazard band; inline errors with retry while open; drafts kept; 80×24 primary action visible                                                                                                                                                                                                                                                                                                                                                                                | Medium (merge safety)          |
| **7** cleanup + docs                  | I-24                           | deletions (§6.3), `capture.tsx`, docs                                                                                                                              | 2–6        | `vp check`, all tests, visual suite, refreshed captures; README/ARCHITECTURE/gh-integration updated; todo 11 superseded                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Low                            |

## 8. Modern-UX capability assessment and backlog

Status: **S** supported · **I** inconsistent · **M** missing. Recommendation: **B** baseline (in the
slices above) · **F** follow-up · **N** not justified now.

| Area          | Capability                                                                                                       | Now                                                                | Rec                                                | Rationale / cost                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Search        | Live filtering                                                                                                   | I (palette, PRs, commits, reviewers; not branches, keys)           | B                                                  | Same `QueryRow` everywhere a list can exceed one screen                                  |
| Search        | Fuzzy match + highlights                                                                                         | I                                                                  | B                                                  | One scorer (palette's) with match ranges for highlighting                                |
| Search        | Result counts, no-results state                                                                                  | I                                                                  | B                                                  | Position/count in the title row; empty state names the filter and `ctrl+u`               |
| Search        | Synonyms (`keywords`)                                                                                            | I                                                                  | F                                                  | Audit keywords per command once titles settle                                            |
| Search        | Recency ranking                                                                                                  | M                                                                  | F                                                  | OpenCode-style frecency for Commands; small local store                                  |
| Discovery     | Complete key reference                                                                                           | M                                                                  | B                                                  | Keys tab from the keymap (D5); `ctrl+x` shows no menu (D6) and `ctrl+x ?` opens Keys     |
| Navigation    | Tab/Shift+Tab, arrows, j/k, page, home/end                                                                       | I                                                                  | B                                                  | Table §3.7                                                                               |
| Navigation    | Cursor reveal in long lists                                                                                      | I                                                                  | B                                                  | `ListView` windowing                                                                     |
| Navigation    | Focus restoration, no background leaks                                                                           | I (stack ok, leaks)                                                | B                                                  | Slice 0b                                                                                 |
| Editing       | Paste                                                                                                            | M                                                                  | B                                                  | Slice 0c                                                                                 |
| Editing       | Reliable newline vs submit                                                                                       | I                                                                  | B                                                  | Capability-aware keys; Tab never submits                                                 |
| Editing       | Grapheme-safe caret, delete, typing emoji                                                                        | M                                                                  | B                                                  | `Intl.Segmenter`; accept multi-unit printable sequences                                  |
| Editing       | Soft-wrap-aware ↑↓ in long paragraphs                                                                            | M                                                                  | F                                                  | Needs wrapped-line mapping; history recall currently triggers on logical first/last line |
| Editing       | External editor, `@file`, drafts                                                                                 | S (comment) / I (review, merge)                                    | B for session drafts; F for persisted merge drafts |                                                                                          |
| Selection     | Multi-select counts, survives filtering                                                                          | S (reviewers)                                                      | B                                                  | Shared marks and counts                                                                  |
| Selection     | Highlight vs choice distinct                                                                                     | I                                                                  | B                                                  | Glyph vocabulary                                                                         |
| Feedback      | Loading, pending, failure inline with retry                                                                      | I                                                                  | B                                                  | Status slot; dialog-scoped errors                                                        |
| Feedback      | Duplicate-submit guards                                                                                          | I                                                                  | B                                                  | Slice 0a                                                                                 |
| Safety        | Named action, consequence near action                                                                            | I                                                                  | B                                                  | Labels and hazard line from loaded data                                                  |
| Safety        | One rule for in-flight writes: no duplicates, inputs pause, `esc` backgrounds (D9), completions never take focus | I (reviewers block `esc`; a late merge can replace another dialog) | B                                                  | Slice 0a                                                                                 |
| Safety        | Undo                                                                                                             | M                                                                  | N                                                  | GitHub writes are not undoable; local bulk clear could be, but not now                   |
| Inspection    | Copy URL, OSC 8 links                                                                                            | S                                                                  | B                                                  | Keep; unify `y`                                                                          |
| Inspection    | Open in browser                                                                                                  | M                                                                  | F                                                  | New command; needs platform opener                                                       |
| Inspection    | Full value of truncated rows                                                                                     | M                                                                  | B                                                  | Detail strip/inspector                                                                   |
| Pointer       | Click rows/hints/esc, wheel                                                                                      | I (checks, tree, banner)                                           | B                                                  | `ListView` and `ActionBar`                                                               |
| Pointer       | Hover highlight                                                                                                  | M                                                                  | F                                                  | Terminal support varies                                                                  |
| Accessibility | Non-color status, contrast, plain-text legibility                                                                | M                                                                  | B                                                  | Glyph words; contrast tests; text snapshots                                              |
| Accessibility | Screen reader semantics                                                                                          | M                                                                  | N                                                  | Not available in OpenTUI; document                                                       |
| Performance   | Bounded rendering at scale                                                                                       | I                                                                  | B                                                  | Windowed lists; bench like `navigation.bench.tsx`                                        |
| Performance   | New dependencies                                                                                                 | —                                                                  | N                                                  | `Bun.stringWidth` + `Intl.Segmenter`; no width package                                   |
| Platform      | OSC 52 clipboard over SSH                                                                                        | M                                                                  | F                                                  | Fallback when `clipboardy` fails                                                         |
| Platform      | Resizable/draggable dialogs, animations                                                                          | M                                                                  | N                                                  | Cost without review value                                                                |

## 9. Verification and open decisions

### 9.1 Measurable acceptance criteria

1. **No overflow:** a harness helper walks the rendered tree and fails if any text renderable's
   wrapped line count exceeds its laid-out height or two text rects overlap inside a dialog. Run it for
   every surface at 80×24, 120×40, 160×48 and with long data (`pr-long` equivalents).
2. **Readable essentials:** at each size, the frame text contains the title, the primary action label,
   and `esc`; critical labels and hazard sentences are never truncated (assert exact substrings).
3. **Row budgets (targets, met by the mockups):** at 80×24 the picker list region is ≥ 17 rows,
   reviewers show ≥ 12 people, compare ≥ 15 branches, inspector detail ≥ 12 rows, the comment
   editor ≥ 15 rows, and the merge body ≥ 10 rows.
4. **Binding truth:** every action-bar label equals the primary reverse-keymap binding for its action
   in that mode, with a user override fixture proving remaps flow through; no hard-coded key strings
   remain in `components/dialog` or `review/*` (lint-able grep test).
5. **Typing stays text:** `j`, `k`, `q`, `?`, `space` typed in every text mode insert characters.
6. **Focus vs selection:** span snapshots show the cursor row has `cursorBg` and `›`; chosen items
   show `[x]`/`✓` regardless of cursor.
7. **Routing:** burst input (`press` without settling between keys) after each opening key lands in the
   new mode; nested dismissal (autocomplete → composer → conversation) restores parents and selection.
8. **Writes:** burst `Enter Enter` produces exactly one write per surface; inputs pause while pending;
   `esc` closes without cancelling; reopening while pending cannot send again; a completion after
   close opens, replaces, and resets no other dialog; a success consumes its draft; a failure keeps
   the work (open: inline retry; closed: a five-second error naming the reopen key that never covers
   a dialog).
9. **Paste:** single-line and multi-line paste, CRLF normalization, emoji graphemes.
10. **Resize:** open each dialog at 120×40, resize to 80×24 and back; query, selection, draft, and scroll
    survive; no overflow.
11. **Performance:** 200 commands, 1,000 branches, 2,000 reviewers: renderable count bounded by
    visible rows; keystroke-to-frame within the existing navigation bench envelope; no startup change
    (`tools/benchmark-startup.py`).
12. **Contrast:** the floors in §3.5 hold for every built-in theme and the sampled terminal palettes.
13. **Gates:** `vp check`, `vp run test -r`, `vp run build -r`, `vp run test:visual` in
    `packages/tui`, refreshed `artifacts/ui-review` captures and governing docs. Live `ht` verification
    for every bug fixed (red-green first).

Baseline confirmed today: `vp check` passes; 501 unit tests pass (116 core, 385 TUI); build passes.

### 9.2 Risks

- **Central input path (0b).** Mode resolution touches every key; land it alone with burst tests and
  live verification.
- **Borderless edges (D1).** A panel's edge is only a fill difference. Palettes that collapse fills
  (terminal themes, and light themes for key menus) are the risk; the contrast floors gate them.
- **Background writes (D9).** Allowing `esc` mid-write makes late completions common, so the scoped
  completion rule (§5) lands in slice 0a, before any redesign.
- **OpenTUI 0.1.92 limits.** Width disagreements exist (`⚠`); `paddingLeft` on a `<text>` node makes
  right-aligned text end one column short (use margins); headless `mockInput` normalizes keys
  differently from real terminals (`?`, `linefeed`), so live checks stay mandatory.
- **Muscle memory.** Tab, Filters, help, and post-merge cleanup move or change (`ctrl+x j/k` stays,
  D7); the Keys tab and status line should mention moved keys once.
- **Scope creep.** Open-in-browser, frecency, OSC 52, and persisted merge drafts stay out of the
  baseline.

### 9.3 Decisions

Madison settled all twelve on 2026-10-14; each answer is also in the project's Plannotator decision
log.

| #   | Question                   | Decision                                                                                                                                             | Effect on this plan                                                        |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| D1  | Frame style                | **Borderless tinted panel** (OpenCode style); the recommendation was a rounded border                                                                | §3.2 anatomy, §3.5 derived fills and contrast floors, every mockup redrawn |
| D2  | Compact sheets             | **Cover the app header below 30 rows** (recommended)                                                                                                 | §3.3                                                                       |
| D3  | Filters                    | **Inline facet row in Compare, `f` to toggle** (recommended)                                                                                         | §4.2, slice 4                                                              |
| D4  | Merge confirmation         | **Inline two-step state** (recommended); the warning band and `▲` replace the warning border                                                         | §2.5, §4.5, slice 6                                                        |
| D5  | Help                       | **Keys tab in the Commands picker; `?` opens it** (recommended)                                                                                      | §4.1, slice 2                                                              |
| D6  | Leader menu                | **Never show**; the recommendation was a menu after 400 ms                                                                                           | I-14 closed, §4.3, slice 3                                                 |
| D7  | List movement while typing | **`ctrl+n/ctrl+p` and `ctrl+x j/k` both, permanently**; the recommendation was to retire `ctrl+x j/k` after one release                              | §3.7                                                                       |
| D8  | Enter on a branch row      | **Set head; `b` still sets base** (recommended)                                                                                                      | §4.2, slice 4                                                              |
| D9  | Writes in flight           | **`esc` closes the dialog and the write continues**; the recommendation was to lock the dialog                                                       | §5 write rule, I-27, slice 0a                                              |
| D10 | Status narration           | **Remove `Opened…/Closed…`; report outcomes only** (recommended)                                                                                     | §3.9                                                                       |
| D11 | Submit review focus        | **Start on the event list** (recommended)                                                                                                            | §5, slice 6                                                                |
| D12 | Cleanup after a merge      | **A checkbox in the merge form, checked by default and remembered**; no dialog after the merge. Her own option; the recommendation was Commands only | §4.5, §5, §6.2, slice 0e                                                   |

## Appendix: evidence and regeneration

- Current captures: `bun artifacts/ui-review/capture.tsx`, then `render.swift` and `gallery.ts` (see
  `artifacts/ui-review/README.md`).
- Proposal mockups: from `artifacts/ui-review/proposal/`, run `bun mockups.tsx` (it also writes the
  cell wireframes), then `swift ../render.swift "$PWD/pierre-dark"` and `"$PWD/terminal-theme"`,
  `bun gallery.ts`, and `vp fmt .`. The folder's `node_modules` symlink points at `packages/tui/node_modules` for bare imports.
- Inspiration reviewed: OpenCode `packages/tui/src/ui/dialog*.tsx` and `component/prompt/autocomplete.tsx`
  (borderless panel over a black scrim, title + esc header, solid cursor bar, top anchoring,
  footer actions, caret popover), `ghui`
  (measured modal rectangles, junction dividers, `›`/`✓` focus-vs-choice, small-terminal fallback
  tests), `hunk` (shared confirm/action row, measured help columns, grapheme-aware fitting), Helix
  and which-key (key-first prefix menus).
