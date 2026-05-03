---
name: make-release
description: Make a WebCaster release. Use when asked to release, publish a release, cut a release, bump the version for release, update package.json and CHANGELOG.md for release, or run the GitHub Release workflow.
---

# Make Release

## Workflow

Use PowerShell commands from the repo root. Preserve user changes; stop and ask if unrelated dirty files would be included in the release commit.

1. Check state:
   - `git status --short --branch`
   - `gh auth status`
   - Confirm the current branch is the branch to release from.

2. Compute the next version from `package.json` and unreleased changelog notes.
   - If `## Unreleased` contains `### Added` or `### Changed`, bump minor. Example: `1.0.13` becomes `1.1.0`.
   - If `## Unreleased` only contains fixes, bump patch. Example: `1.0.13` becomes `1.0.14`.
   - Use the exact `package.json` version as the source of truth.

3. Update `package.json`.
   - Set `"version"` to the new version.
   - Preserve existing formatting where practical.

4. Update `CHANGELOG.md`.
   - Insert a fresh `## Unreleased` section above the new release.
   - Convert the previous unreleased notes into `## V<version>`.
   - Keep existing `### Added`, `### Changed`, and `### Fixed` entries under the release.
   - If there are no unreleased notes, stop and ask before releasing.

5. Validate:
   - `bun install`
   - `bunx tsc --noEmit`
   - Do not continue if validation fails.

6. Commit only release files:
   - `git add package.json CHANGELOG.md`
   - `git commit -m "Release v<version>"`

7. Push:
   - `git push origin HEAD`

8. Run the GitHub Release workflow:
   - `gh workflow run release.yml --ref <branch>`
   - Optionally watch it with `gh run watch`.

## Notes

- The workflow reads the release version from `package.json`.
- The workflow requires release notes under `## V<version>` or `## v<version>` in `CHANGELOG.md`.
- Use `gh run list --workflow release.yml --limit 1` if the dispatch succeeds but no URL is printed.
