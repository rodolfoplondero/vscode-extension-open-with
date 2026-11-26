# Open With External Application – Activity Tracker

Code prefix: OWE
Timesheet: no
Last updated: 2026-11-26

---

## Summary

| Code | Name | Status | Progress | Blocker | Opened | Done | Updated |
|---|---|---|---|---|---|---|---|
| OWE-001 | Review extension usability | ✅ Done | ▓▓▓▓▓ 3/3 | — | 2026-11-26 | 2026-11-26 | 2026-11-26 |
| OWE-002 | Improve usability and package version 0.1.5 | ✅ Done | ▓▓▓▓▓ 5/5 | — | 2026-11-26 | 2026-11-26 | 2026-11-26 |
| OWE-003 | Add configurable application discovery cache | ✅ Done | ▓▓▓▓▓ 4/4 | — | 2026-11-26 | 2026-11-26 | 2026-11-26 |
| OWE-004 | Preload applications for common workspace formats | ✅ Done | ▓▓▓▓▓ 5/5 | — | 2026-11-26 | 2026-11-26 | 2026-11-26 |
| OWE-005 | Automate validation and GitHub releases | ✅ Done | ▓▓▓▓▓ 4/4 | — | 2026-11-26 | 2026-11-26 | 2026-11-26 |
| OWE-006 | Release 0.2.0 with new extension identity | ✅ Done | ▓▓▓▓▓ 4/4 | — | 2026-11-26 | 2026-11-26 | 2026-11-26 |
| OWE-007 | Publish 0.2.0 to Marketplace and Open VSX | ✅ Done | ▓▓▓▓▓ 2/2 | — | 2026-11-26 | 2026-11-26 | 2026-11-26 |

---

## Doing

### OWE-009 · Make the application list appear instantly

- **Status:** Doing
- **Opened:** 2026-11-26 · **Done:** —
- **Description:** Open the picker immediately and fill it as Windows answers, so a short wait for the application list never feels slow.
- **Done when:** The picker opens at once for any format, older lists show instantly and refresh in the background, and version 0.2.2 is packaged and verified.
- **Deliverables:** [CHANGELOG](CHANGELOG.md), [README](README.md)
- **Blocker:** —

**Subtasks**

- [x] OWE-009.1 Open the picker at once with a progress bar and share one query per format
- [x] OWE-009.2 Show the older list instantly after expiry and refresh it in the background
- [x] OWE-009.3 Refresh Applications updates the open picker
- [x] OWE-009.4 Warm the cache for the active tab's format
- [x] OWE-009.5 Update README, CHANGELOG and version 0.2.2; verify the VSIX
- [ ] OWE-009.6 Review, push, open the pull request and publish (In progress)

### OWE-008 · Add a demo GIF to the README

- **Status:** Doing
- **Opened:** 2026-11-26 · **Done:** —
- **Description:** Show how the extension is used in the README with one demo GIF recorded in VS Code.
- **Done when:** docs/media/demo.gif is committed and displays in the README on GitHub.
- **Deliverables:** [README](README.md), [Demo GIF](docs/media/demo.gif)
- **Blocker:** —

**Subtasks**

- [x] OWE-008.1 Add image sections and links to the README
- [x] OWE-008.2 Write the shot list and create sample files to record
- [x] OWE-008.3 Record the demo GIF and save it in docs/media
- [ ] OWE-008.4 Commit the GIF and check the README on GitHub (In progress)


---

## Backlog

_Nothing here._

---

## Open

_Nothing here._

---

## Done

### OWE-007 · Publish 0.2.0 to Marketplace and Open VSX

- **Status:** Done
- **Opened:** 2026-11-26 · **Done:** 2026-11-26
- **Description:** Publish the verified VSIX to Visual Studio Marketplace and Open VSX after the store accounts are configured.
- **Done when:** The extension is visible and installable in both stores.
- **Deliverables:** [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=rodolfoplondero.open-with-external), [Open VSX listing](https://open-vsx.org/extension/rodolfoplondero/open-with-external)
- **Blocker:** —

**Subtasks**

- [x] OWE-007.1 Configure Marketplace publisher and Trusted Publishing policy
- [x] OWE-007.2 Configure Open VSX account, token and namespace, then publish both stores

---

### OWE-006 · Release 0.2.0 with new extension identity

- **Status:** Done
- **Opened:** 2026-11-26 · **Done:** 2026-11-26
- **Description:** Commit the identity rename, merge to main and tag v0.2.0 so the GitHub release publishes the verified VSIX.
- **Done when:** The v0.2.0 tag builds in GitHub Actions and the release assets contain the VSIX.
- **Deliverables:** [PR](https://github.com/rodolfoplondero/vscode-extension-open-with/pull/2), [GitHub release](https://github.com/rodolfoplondero/vscode-extension-open-with/releases/tag/v0.2.0)
- **Blocker:** —

**Subtasks**

- [x] OWE-006.1 Commit the 0.2.0 identity rename on dev and run the test suite
- [x] OWE-006.2 Push dev, open the pull request to main and merge it
- [x] OWE-006.3 Tag v0.2.0 on the merge commit and push the tag
- [x] OWE-006.4 Confirm the GitHub Actions release publishes the VSIX

---

### OWE-001 · Review extension usability

- **Status:** Done
- **Opened:** 2026-11-26 · **Done:** 2026-11-26
- **Description:** Review the opening workflow and recommend practical usability improvements.
- **Done when:** Findings are linked to source behavior, prioritized, and accompanied by validation limits.
- **Deliverables:** [Usability review](docs/usability-review-2026-11-26.md)
- **Blocker:** —

**Subtasks**

- [x] OWE-001.1 Review commands, picker, validation, and Windows fallback
- [x] OWE-001.2 Run the existing automated checks
- [x] OWE-001.3 Document findings and recommended improvements

---

### OWE-002 · Improve usability and package version 0.1.5

- **Status:** Done
- **Opened:** 2026-11-26 · **Done:** 2026-11-26
- **Description:** Apply the five review findings and build an extension package for manual installation.
- **Done when:** Regression tests pass and the versioned VSIX contains the current compiled modules and Windows scripts.
- **Deliverables:** [Changes](CHANGELOG.md), [Installable VSIX](open-with-external-0.1.5.vsix)
- **Blocker:** —

**Subtasks**

- [x] OWE-002.1 Keep the Windows fallback visible and simplify picker rows
- [x] OWE-002.2 Add discovery cancellation and busy-operation guidance
- [x] OWE-002.3 Add launch recovery and clarify missing DOCX editor messages
- [x] OWE-002.4 Pass 34 regression tests and compile version 0.1.5
- [x] OWE-002.5 Generate the VSIX and verify its packaged contents

---

### OWE-003 · Add configurable application discovery cache

- **Status:** Done
- **Opened:** 2026-11-26 · **Done:** 2026-11-26
- **Description:** Reuse discovered applications by file extension for a user-configurable interval and provide manual refresh.
- **Done when:** Settings, expiry, disabling, refresh and invalidation pass tests, and a current VSIX is available on dev.
- **Deliverables:** [Settings guide](README.md#settings), [Changes](CHANGELOG.md), [Installable VSIX](open-with-external-0.1.6.vsix)
- **Blocker:** —

**Subtasks**

- [x] OWE-003.1 Create and switch to dev without committing on main
- [x] OWE-003.2 Add cache duration setting with default 5 minutes and 0 to disable
- [x] OWE-003.3 Implement per-extension reuse, expiry, refresh and invalidation
- [x] OWE-003.4 Pass 41 tests and generate verified version 0.1.6 VSIX

### OWE-004 · Preload applications for common workspace formats

- **Status:** Done
- **Opened:** 2026-11-26 · **Done:** 2026-11-26
- **Description:** Add configurable background preloading for common file formats present in local workspace folders.
- **Done when:** The design is approved, implementation checks pass, and a current VSIX is available for manual installation.
- **Deliverables:** [Approved design](docs/superpowers/specs/2026-11-26-application-preload-design.md), [Settings](README.md#background-preloading), [GitHub release](https://github.com/rodolfoplondero/vscode-extension-open-with/releases/tag/v0.1.7), [Release notes](docs/releases/v0.1.7.md), [PR](https://github.com/rodolfoplondero/vscode-extension-open-with/pull/1)
- **Blocker:** —

**Subtasks**

- [x] OWE-004.1 Agree on scanning present formats and configurable enablement and extensions
- [x] OWE-004.2 Write the short design with defaults and background-work limits
- [x] OWE-004.3 Confirm the proposed design with the user
- [x] OWE-004.4 Implement and validate preloading after design approval
- [x] OWE-004.5 Compile and generate the installable VSIX

### OWE-005 · Automate validation and GitHub releases

- **Status:** Done
- **Opened:** 2026-11-26 · **Done:** 2026-11-26
- **Description:** Run Windows tests and package verification for pull requests and publish the VSIX for matching version tags.
- **Done when:** The workflow is reviewed, local checks pass, and the PR build succeeds in GitHub Actions.
- **Deliverables:** [Workflow](.github/workflows/ci-release.yml), [Workflow guide](README.md#github-actions), [Successful Windows CI run](https://github.com/rodolfoplondero/vscode-extension-open-with/actions/runs/45857309230)
- **Blocker:** —

**Subtasks**

- [x] OWE-005.1 Configure PR validation, versioned artifacts and tag-triggered releases
- [x] OWE-005.2 Validate YAML, matching and mismatched tags, and isolated package activation
- [x] OWE-005.3 Pass all 60 tests and complete independent workflow review
- [x] OWE-005.4 Publish the workflow on dev and verify its GitHub Actions run

---

## Activity log

- 2026-11-26 · OWE-001 · Opened · Started the extension usability review.
- 2026-11-26 · OWE-001 · Done · Documented five findings; compilation and all 25 tests passed.
- 2026-11-26 · OWE-002 · Opened · Applied the reviewed usability improvements and prepared a manual installation package.
- 2026-11-26 · OWE-002 · Done · All 34 tests passed; version 0.1.5 VSIX contents and identity verified.
- 2026-11-26 · OWE-003 · Opened · Continued on dev and added configurable caching with manual refresh.
- 2026-11-26 · OWE-003 · Done · All 41 tests passed; version 0.1.6 package settings and compiled modules verified.
- 2026-11-26 · OWE-004 · Opened · Selected workspace scanning and prepared configurable preloading design for review.
- 2026-11-26 · OWE-004 · Progress · User approved the design; implemented background scanning and foreground priority on dev.
- 2026-11-26 · OWE-004 · Done · All 60 tests passed; version 0.1.7 package and isolated simulated activation verified.
- 2026-11-26 · OWE-004 · Progress · Revalidated all 60 tests and prepared the dev changes for commit and pull request.
- 2026-11-26 · OWE-004 · Progress · Opened PR 1 and published release v0.1.7 with a verified VSIX from dev; main unchanged.
- 2026-11-26 · OWE-005 · Opened · Configured PR builds and tag releases; local validation and workflow review passed.
- 2026-11-26 · OWE-005 · Done · GitHub Actions passed Windows tests, VSIX verification and artifact upload; release skipped on PR.
- 2026-11-26 · OWE-006 · Opened · Committed the 0.2.0 identity rename on dev; 61 tests passed.
- 2026-11-26 · OWE-006 · Done · PR 2 merged, tag v0.2.0 pushed; GitHub release published the verified VSIX.
- 2026-11-26 · OWE-007 · Opened · Store publication pending Marketplace and Open VSX account setup.
- 2026-11-26 · OWE-008 · Opened · README now links screenshots and GIFs; shot list and sample files ready for recording.
- 2026-11-26 · OWE-008 · Progress · Scope reduced to one demo GIF; extra screenshots removed from the README.
- 2026-11-26 · OWE-007 · Done · Marketplace and Open VSX jobs succeeded; 0.2.1 published to both stores and PUBLISH_TO_STORES=true enables automatic store publication on future tags.
- 2026-11-26 · OWE-009 · Opened · Agreed a design to show the list instantly; picker, stale list, refresh and tab warming built.
- 2026-11-26 · OWE-009 · Progress · All 81 tests passed; 0.2.2 VSIX built and verified in isolation; awaiting review and push.
