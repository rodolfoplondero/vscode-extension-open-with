# Application Preloading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Execute inline on dev; no commits or PR creation requested.

**Goal:** Preload application lists for configured formats present in local workspace folders without competing with explicit Open With requests.

**Architecture:** A testable Preloader coordinates cancellable scanning and sequential discovery through the existing WindowsBridge cache. The VS Code adapter provides bounded filename search, settings and lifecycle events. Foreground commands cancel and drain background work before using the same bridge, then allow remaining formats to resume.

**Tech Stack:** TypeScript, VS Code APIs, Node test runner, existing Windows PowerShell bridge.

**Spec:** docs/superpowers/specs/2026-11-26-application-preload-design.md (approved in chat).

## Global Constraints

- Branch dev; no commits on main and no public release.
- Default preloadEnabled true, editable default format list from the spec, existing cache lifetime unchanged.
- At most 5,000 matching paths per scan; local Windows folders only; no file contents read or application launch during preload.
- Respect configured exclusions and always omit .git, node_modules, .venv, venv, dist and build.
- Quiet failures, cancellation on obsolete work/disposal, foreground priority, no periodic cache refresh.

## Review Focus

- A settings or folder change during a slow search must not start obsolete discovery afterward.
- A foreground request during preload must wait for the interrupted query to settle before querying the bridge.
- Mixed-case extensions, duplicates and invalid entries must not create repeated or malformed searches.
- Conditional workspace exclusions and multiple roots must not leak excluded matches or exceed the aggregate limit.
- Cancelled discovery must not populate cache or produce an unhandled background rejection.

### Task 1: Preload coordinator and search settings

Files: create src/preload.ts and test/preload.test.cjs; modify package.json and src/windows.ts only if cancellation coordination requires it.

Interfaces: normalizeExtensions(values: readonly string[]): string[]; Preloader constructor(scan: (extensions: string[], signal: AbortSignal) => Promise<string[]>, bridge: Pick<WindowsBridge, 'list' | 'getCached'>); restart(extensions: string[]): void; pause(): Promise<void>; resume(): void; dispose(): void.

- [x] Write failing tests for normalization, distinct sequential types, representative accessibility, cancellation, no refresh loop, and pause/resume priority.
- [x] Run focused tests and inspect expected failures.
- [x] Implement bounded coordinator using a single background task and AbortController; scan adapter returns accessible matching paths.
- [x] Run focused tests and existing regressions.

### Task 2: VS Code integration and release artifact

Files: modify src/extension.ts, package.json, README.md, CHANGELOG.md, test/extension.test.cjs; update package-lock.json through npm version.

Interfaces: extension adapter supplies scan to Preloader using workspace.findFiles and applicable configuration exclusions; restart on relevant settings/folder events; await pause before running the command and resume afterward.

- [x] Write failing adapter tests for startup, disabled/zero/no-local-folder behavior, exclusions, aggregate bounds, folder and settings changes, and foreground interruption.
- [x] Implement onStartupFinished activation, settings schema, scan adapter and disposal subscriptions.
- [x] Run npm test; inspect complete failures if any.
- [x] Update README and changelog; bump to 0.1.7 without a git commit.
- [x] Build VSIX with npm run package; inspect metadata, compiled modules and packaged scripts.
- [x] Review diff and update TRACKER.md, design status and generated documentation previews.

Manual follow-up: install the VSIX and check actual Windows startup responsiveness and native application discovery; automated tests simulate those boundaries.
