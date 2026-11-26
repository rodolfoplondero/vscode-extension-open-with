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

---

## Doing

_Nothing here._

---

## Backlog

_Nothing here._

---

## Done

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
- **Deliverables:** [Approved design](docs/superpowers/specs/2026-11-26-application-preload-design.md), [Settings](README.md#background-preloading), [Installable VSIX](open-with-external-0.1.7.vsix)
- **Blocker:** —

**Subtasks**

- [x] OWE-004.1 Agree on scanning present formats and configurable enablement and extensions
- [x] OWE-004.2 Write the short design with defaults and background-work limits
- [x] OWE-004.3 Confirm the proposed design with the user
- [x] OWE-004.4 Implement and validate preloading after design approval
- [x] OWE-004.5 Compile and generate the installable VSIX

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
