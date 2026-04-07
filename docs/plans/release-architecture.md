# Release Architecture Plan

This plan captures which parts of `../opencode`'s release system are worth
porting into `diffdiff`, which parts are overkill for the current app, and the
order of work to adopt the useful pieces safely.

## Goal

Give `diffdiff` a repeatable release workflow for its publishable packages and
user-facing CLI without importing OpenCode's full distribution surface.

For `diffdiff`, the useful target is:

- publish a reusable `@madisonbullard/diffdiff-core` package
- publish a user-installable CLI package
- create a tagged GitHub release with release notes
- support both stable and preview release channels from the initial workflow

The current repository does not have any release automation yet. There are no
GitHub Actions workflows in this repo, the root package is private, and both
workspace packages still use `0.0.0` placeholder versions.

This section reflected the pre-implementation state. The first release workflow
has now been added in:

- `.github/workflows/release.yml`
- `tools/release/`
- `packages/core/package.json`
- `packages/tui/package.json`

## Current Decisions

These decisions have already been made for the first implementation pass:

- `@madisonbullard/diffdiff-core` should be public immediately
- preview releases should ship now, not later
- version-history behavior should follow OpenCode's model
- the public CLI package should be `@madisonbullard/diffdiff-tui`
- that package should install both `diffdiff` and `dfdf`

For `diffdiff`, that means:

- stable releases should create committed version bumps and git tags
- preview releases should use prerelease versions and npm prerelease tags
- preview releases do not need the same history shape as stable releases, which
  matches OpenCode's current pattern

The public CLI package should be `@madisonbullard/diffdiff-tui`; `diffdiff` and `dfdf` should
both remain bin aliases from that one package.

## What OpenCode Does Well

OpenCode's release workflow is centered on a small set of durable ideas, not on
any one distribution target.

### 1. One version source drives the whole release

- `../opencode/packages/script/src/index.ts`
  - computes channel, preview vs stable behavior, and final version
- `../opencode/script/version.ts`
  - turns that version into workflow outputs and creates the draft GitHub
    release early

This keeps every package, build artifact, and release tag aligned to the same
version decision.

### 2. The workflow is split into version, build, and publish phases

- `../opencode/.github/workflows/publish.yml`
  - `version` decides release metadata
  - build jobs create artifacts in parallel
  - `publish` consumes those artifacts and pushes to registries

That separation is the strongest part of the design. It keeps release logic
readable and makes failures easier to localize.

### 3. Package manifests are rewritten from a single release step

- `../opencode/script/publish.ts`
  - rewrites package versions in every `package.json`
  - builds release-only assets
  - delegates publishing to package-specific scripts

This matters because workspace packages otherwise drift, especially when one
package depends on another workspace package.

### 4. Package publishing is package-local, orchestration is repo-level

- `../opencode/packages/opencode/script/publish.ts`
- `../opencode/packages/sdk/js/script/publish.ts`
- `../opencode/packages/plugin/script/publish.ts`

The repo-level script decides the release. Each package script knows how to pack
and publish itself.

### 5. Preview channels are first-class

- `../opencode/packages/script/src/index.ts`
- `../opencode/.github/workflows/beta.yml`

OpenCode treats preview releases as a normal channel, not as a one-off manual
hack. That is worth keeping in mind even if `diffdiff` starts with stable-only
publishing.

## What Not To Copy Yet

Most of OpenCode's complexity comes from targets that `diffdiff` does not have.

Do not port these in the first cut:

- Windows signing and notarization
- Tauri or Electron desktop packaging
- Docker image publishing
- AUR and Homebrew automation
- branch automation like `beta.yml`
- separate workflows for unrelated surfaces like GitHub Actions or editor
  extensions

Those only make sense once `diffdiff` has more than npm package distribution.

## Current Diffdiff Gaps

Compared with OpenCode, `diffdiff` is missing the release control plane.

### Package state

- `package.json`
  - root is private and has no release scripts
- `packages/core/package.json`
  - publishable shape exists, but version is `0.0.0`
- `packages/tui/package.json`
  - publishable shape exists, but version is `0.0.0`
  - depends on `@madisonbullard/diffdiff-core` via `workspace:*`

### Workflow state

- there is no `.github/workflows/` release pipeline
- there is no version computation or channel model
- there is no changelog or release-notes source of truth
- there is no package packing or publishing orchestration
- there is no explicit policy for preview tags like `next`

### Tooling implications

This repo uses Vite+ for install, verify, and build orchestration.

One release-specific exception is now intentional: tarball pack/publish inside
`tools/release/` use the workspace `pnpm` CLI directly because nested `vp pm`
invocations are not currently reliable when the release scripts themselves are
launched through `vp run`.

Useful commands already exist:

- `vp pm pack`
- `vp pm publish`
- `vp run build -r`
- `vp run test -r`
- `vp check`

That means the OpenCode architecture should be translated into a Vite+
release workflow, not copied literally.

## Recommended Target Architecture

Port the architecture pattern, not the entire OpenCode implementation.

### Release surfaces

First-cut release surfaces:

- `@madisonbullard/diffdiff-core` on npm
- a CLI package on npm that installs the `diffdiff` binary
- future client packages such as `@madisonbullard/diffdiff-web`
- a GitHub release tagged as `vX.Y.Z`

Recommended package decision before implementation:

- keep `@madisonbullard/diffdiff-core` as the reusable public package
- publish the user-facing CLI as `@madisonbullard/diffdiff-tui`
- expose both `diffdiff` and `dfdf` in the package `bin` map

Recommendation: keep `packages/tui` published as `@madisonbullard/diffdiff-tui`.

Why:

- `diffdiff` is the product name and CLI command
- `dfdf` works well as an ergonomic alias without creating a second package to
  version, document, and support
- scoped client packages create room for future siblings like `@madisonbullard/diffdiff-web`
- `packages/tui` is already the actual client boundary in the repo

This is now the implemented package shape.

### Release control module

Add a private workspace tool under `tools/release/` as the equivalent of
OpenCode's `@opencode-ai/script` package.

That tool should own:

- `resolveReleaseContext()`
  - inputs: explicit version override, bump type, release channel, current ref
  - outputs: version, tag, npm tag, prerelease flag
- `rewriteWorkspaceVersions()`
  - updates publishable package manifests to the release version
  - rewrites internal workspace references such as `@madisonbullard/diffdiff-core`
- `createDraftGitHubRelease()`
  - creates or updates a draft release before publish work starts
- `restoreManifests()`
  - if the workflow uses temporary manifest rewrites rather than committed
    version bumps

Keep this tool private to the repo. `diffdiff` does not need a published script
package.

### GitHub Actions shape

Add a single release workflow first.

Suggested jobs:

1. `version`
   - checkout with full tags
   - install dependencies using `voidzero-dev/setup-vp@v1`
   - compute version and channel from workflow inputs
   - create a draft GitHub release
   - output `version`, `tag`, `npm_tag`, and `is_prerelease`

2. `verify`
   - run `vp check`
   - run `vp run test -r`
   - run `vp run build -r`

3. `pack`
   - rewrite workspace package versions for the selected release
   - run `vp pm pack --recursive`
   - upload tarballs as workflow artifacts

4. `publish`
   - download tarballs
   - publish filtered workspace packages with `vp pm publish`
   - attach packed tarballs to the GitHub release
   - mark the draft release ready when publish succeeds

That is the OpenCode model reduced to the subset `diffdiff` actually needs.

### Versioning policy

Phase-1 policy:

- stable releases happen by manual `workflow_dispatch`
- input supports either `bump` (`major`, `minor`, `patch`) or explicit
  `version`
- stable releases publish with npm tag `latest`
- stable releases follow OpenCode's history model: rewrite manifests, commit the
  release version, tag `vX.Y.Z`, and publish from that release commit

Phase-2 policy:

- preview releases publish with npm tag `next`
- preview versions use a deterministic prerelease format such as
  `0.0.0-next.YYYYMMDDHHmm`
- preview releases produce GitHub prereleases instead of full releases
- preview releases follow OpenCode's lighter model: use temporary prerelease
  manifest rewrites for the publish flow instead of committing every preview
  version bump back to the repository

This mirrors OpenCode's channel model without forcing branch automation on day
one.

### Release notes

Do not copy OpenCode's AI-driven changelog generation in the first cut.

Start with one of these, in order of preference:

1. `gh release create --generate-notes` for automatic GitHub notes
2. optional checked-in `UPCOMING_CHANGELOG.md` consumed by the release script
3. manual notes passed through workflow input for exceptional releases

Recommendation: start with generated GitHub notes, then add a curated
`UPCOMING_CHANGELOG.md` only when release quality needs tighter editorial
control.

## Implementation Plan

### Phase 1. Define the publish surface

1. Publish the CLI as `@madisonbullard/diffdiff-tui` and expose both `diffdiff` and `dfdf`
   binaries from that package.
2. Add `publishConfig` for any scoped public packages.
3. Keep `packages/tui` as the implementation directory for the public
   `@madisonbullard/diffdiff-tui` package.

Exit criteria:

- the repo has a clear answer to `npm install -g @madisonbullard/diffdiff-tui`
- the installed package exposes both `diffdiff` and `dfdf`
- the set of packages that should publish is explicit

### Phase 2. Add repo-local release tooling

1. Create `tools/release/` with plain Node ESM scripts or a private workspace
   package.
2. Implement version resolution and npm-tag resolution.
3. Implement temporary manifest rewriting for release builds.
4. Implement release-note generation and draft GitHub release creation.

Exit criteria:

- a local dry run can compute a version and rewrite package manifests
- internal workspace deps no longer rely on raw `workspace:*` at publish time

### Phase 3. Add stable GitHub Actions release workflow

1. Create `.github/workflows/release.yml`.
2. Use `voidzero-dev/setup-vp@v1` for install and cache setup.
3. Add `version`, `verify`, `pack`, and `publish` jobs.
4. Publish to npm with `vp pm publish`.
5. Attach tarballs to the GitHub release for traceability.

Exit criteria:

- one manual workflow can publish all selected packages end to end
- failed verification stops publishing
- successful publish creates a non-draft GitHub release

### Phase 4. Add preview releases

1. Introduce a `next` channel in the release tool.
2. Publish preview packages with npm tag `next`.
3. Mark preview GitHub releases as prereleases.
4. Decide whether previews are manual-only or tied to a branch.

Exit criteria:

- stable and preview releases can coexist without version collisions
- consumers can opt into preview builds explicitly

### Phase 5. Evaluate non-npm distribution only if needed

Candidates for later work:

- standalone binaries
- OS package managers
- signed artifacts

Do this only after the npm and GitHub release path is reliable.

## Suggested First Implementation Slice

The first implementation slice landed as:

1. lock the CLI package to `@madisonbullard/diffdiff-tui` and add the `dfdf` alias
2. add `tools/release/resolve-release-context.mjs`
3. add `tools/release/rewrite-manifests.mjs`
4. add `.github/workflows/release.yml` with `workflow_dispatch` inputs for both
   stable and preview releases
5. publish `@madisonbullard/diffdiff-core` and the CLI package from tarballs

That gets `diffdiff` to a real release workflow while staying much smaller than
OpenCode's current system.

## Validation Checklist

When implementing this plan, verify all of the following:

- `vp check`, `vp run test -r`, and `vp run build -r` run before publish
- packed tarballs contain the selected release version, not `0.0.0`
- packed tarballs do not contain unresolved `workspace:*` dependencies
- the published CLI installs working `diffdiff` and `dfdf` binaries
- the GitHub release tag, package versions, and npm dist-tag all match
