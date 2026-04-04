# Review Composer And Input UX

## Summary

OpenCode's prompt input is much more advanced than diffdiff's current comment and merge composition flows. The strongest ideas worth stealing are external-editor composition, file reference assistance, and light draft history. Those map well onto review comments and merge text without requiring the rest of OpenCode's conversation model.

## Why This Is Worth Stealing

- Review comments and merge bodies are often longer than a small modal comfortably supports.
- File references are especially useful in code review.
- Draft recovery and history are common quality-of-life wins for review tools.

## Relevant OpenCode Research

- `../opencode/packages/opencode/src/cli/cmd/tui/component/prompt/autocomplete.tsx`
  File autocomplete, frecency ranking, and support for file references with line ranges.
- `../opencode/packages/opencode/src/cli/cmd/tui/component/prompt/history.tsx`
  Lightweight JSONL-backed prompt history with bounded retention.
- `../opencode/packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
  External-editor flow and reconciliation of non-text prompt parts after editing.

## Relevant Diffdiff Touchpoints

- `packages/tui/src/review/review-composer-modal.tsx`
- `packages/tui/src/review/submit-review-modal.tsx`
- `packages/tui/src/review/merge-pull-request-modal.tsx`
- `packages/tui/src/review/comments-modal.tsx`

## Good Fit Ideas To Steal

- External editor support for long review comments and merge body editing is the clearest direct fit.
- File reference autocomplete with optional line-range support is a strong review-specific enhancement.
- A small draft-history mechanism for comment composition could be useful if kept bounded and local.

## Cautions

- Diffdiff does not need OpenCode's whole prompt-part model.
- Keep any reference syntax review-oriented and easy to understand.
- Avoid turning comment composition into a general command shell unless that clearly serves review workflows.

## Current Diffdiff Reality

- `packages/tui/src/app/DiffdiffApp.tsx` owns `reviewComposerBody`, `reviewSubmissionBody`, `mergeCommitTitle`, and `mergeCommitMessage` directly.
- `handleCommentComposerKey`, `handleSubmitReviewModalKey`, and `handleMergeModalKey` each implement their own append, backspace, newline, and submit logic inline.
- `packages/tui/src/review/review-composer-modal.tsx`, `submit-review-modal.tsx`, and `merge-pull-request-modal.tsx` are display-only surfaces, so any richer behavior still needs to be orchestrated from the app layer.
- `packages/core/src/preferences.ts` currently persists only GitHub cleanup defaults, default merge method, and the key legend toggle, so draft recovery or history should not be stuffed into `preferences.json` by default.

## Proposed UX

- `ctrl+e` on any composition surface opens `$VISUAL` or `$EDITOR` with the current text.
- Comment composer and submit review open a body-only editor buffer.
- Merge opens a single buffer with the title on the first line, a blank line, then the body so the whole merge message can be edited coherently.
- Typing `@` in the comment composer opens a compact file-reference picker scoped to the current review session's changed files.
- Selecting a file reference inserts plain text such as `` `src/app.ts#12-18` `` rather than a hidden prompt token so the submitted GitHub comment stays readable everywhere.
- `up` and `down` in the comment composer cycle recent local drafts when autocomplete is closed.
- Reopening the same comment target restores the most recent dismissed draft automatically.

## Implementation Plan

1. Extract minimal composer helpers.

- Add a small helper module for review-composer state, token parsing, and target-specific draft keys.
- Keep `DiffdiffApp` as the orchestration point instead of introducing a general prompt-part architecture.
- Keep the modals mostly dumb and extend them only with extra footer text and any lightweight autocomplete display props they need.

2. Add external-editor infrastructure.

- Add a testable `openExternalEditor` utility that resolves `$VISUAL` then `$EDITOR`, writes a temp file, waits for the editor to exit, reads the result back, and removes the temp file.
- Keep the editor launcher outside the modal components so tests can inject a fake editor callback through `DiffdiffAppProps`.
- Surface launch failures through the existing status and error handling instead of silently swallowing them.
- Parse the merge editor buffer back into `title` and `body` with a git-commit-style split between the first line and the remaining body.

3. Add comment-specific file reference assistance.

- Trigger suggestions from a trailing `@query` token so the first cut works with diffdiff's current end-of-input editing model.
- Source candidates from `session.files` first, ranking the selected file, then other changed files in the current review.
- Support an optional `#start-end` suffix and preserve the typed line range when inserting the final reference.
- Insert plain text instead of hidden parts so comments remain understandable in GitHub, logs, and copied text.

4. Add local draft recovery and lightweight history.

- Store comment-composer history in a separate bounded JSONL file under `~/.diffdiff`, not inside `preferences.json`.
- Save enough metadata to filter drafts by repository and composer target, with PR number or file path when available.
- Auto-restore the newest dismissed draft for the same target when reopening the composer.
- Let `up` and `down` browse recent comment drafts only when the autocomplete picker is not active.
- Keep retention small, around 25 to 50 entries, and self-heal malformed history by rewriting only valid lines.

5. Extend submit-review and merge carefully.

- Reuse the same external-editor helper for `submit-review` and `merge`.
- Do not add history browsing or file-reference assistance to merge fields in the first pass.
- Keep the current submission semantics unchanged: `enter` still submits, `shift+enter` still inserts a newline, and `esc` still dismisses.

6. Verify and polish.

- Update the modal footers and status copy to advertise the new shortcuts and restore behavior.
- Add focused tests for editor launch, merge message splitting, autocomplete insertion, history restore, and composer-local key routing while autocomplete is open.
- If autocomplete needs stronger key isolation, implement that locally for the composer now and leave the generalized solution to `11-keybind-suspension-infrastructure.md`.

## Likely File Touchpoints

- `packages/tui/src/app/DiffdiffApp.tsx`
- `packages/tui/src/app/layout.tsx`
- `packages/tui/src/review/review-composer-modal.tsx`
- `packages/tui/src/review/submit-review-modal.tsx`
- `packages/tui/src/review/merge-pull-request-modal.tsx`
- likely new `packages/tui/src/review/composer-*.ts` helper files
- likely new `packages/core/src/editor.ts`
- likely new `packages/core/src/review-composer-history.ts`

## Acceptance Criteria

- `ctrl+e` works in comment composition, submit review, and merge composition.
- Comment composition can insert changed-file references with optional line ranges.
- Closing and reopening the same comment target restores the latest local draft.
- Comment draft history stays bounded and corruption-tolerant.
- Existing review submission and merge behavior remains intact outside the new UX improvements.
