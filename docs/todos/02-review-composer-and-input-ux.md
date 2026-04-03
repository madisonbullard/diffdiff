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
