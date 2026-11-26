# Application preloading from workspace file types

Date: 2026-11-26
Status: Approved by the user in chat; implemented in version 0.1.7
Branch: dev

## Intent

Reduce the wait for the first Open With request by discovering applications for common file types already present in local workspace folders. Reuse the existing session cache and its configured lifetime.

## Decisions from the conversation

- Scan the workspace and preload only configured file types actually found there.
- Include all proposed groups in the default extension list.
- Let the user edit the extension list and enable or disable preloading in VS Code Settings.
- Continue on dev; integration will be through a later PR. No commit is required for this design review.

## Approaches

1. Bounded workspace scan, followed by discovery for matching types. Selected by the user; avoids querying formats absent from the workspace, at the cost of a filename scan.
2. Preload every configured format without a scan. Simpler, but queries unused formats; not selected.

## Proposed settings

- `openWithExternal.preloadEnabled`: boolean, default `true` (proposed default).
- `openWithExternal.preloadExtensions`: editable list, default:
  `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.odt`, `.ods`, `.odp`, `.rtf`,
  `.md`, `.txt`, `.csv`, `.json`, `.xml`, `.yaml`, `.yml`,
  `.py`, `.html`, `.css`, `.js`, `.ts`,
  `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.drawio`, `.bpmn`.
- Keep `openWithExternal.cacheDurationMinutes` unchanged: default 5 minutes; 0 disables both caching and preloading.
- Normalize extensions without regard to capitalization; accept entries with or without the leading dot and deduplicate them. An empty list means no preloading.

## Proposed behavior and limits

- Activate after VS Code startup finishes. Run in the background on Windows for local workspace folders only, and repeat when workspace folders are added or relevant settings change.
- Inspect filenames only, never document contents, and never open or execute a discovered file.
- Examine at most 5,000 matching file paths across the workspace per pass (proposed limit). Types not found within this bounded result remain available through normal on-demand discovery.
- Respect applicable workspace exclusion settings and always skip common generated/dependency folders: `.git`, `node_modules`, `.venv`, `venv`, `dist`, and `build`.
- Select one accessible file per distinct configured extension and use it for application discovery. Multiple workspace roots share the same per-extension cache.
- Query one type at a time. Explicit Open With requests take priority; avoid concurrent duplicate discovery of the same type.
- Cancel obsolete work when disabled, workspace folders change, settings change, or the extension is disposed. No scan when no local folder is open.
- Background failures remain quiet and leave normal on-demand discovery available. Keep existing DOCX filtering and file validation.
- Cache only successful nonempty results. Keep the current fixed expiry from discovery completion; no periodic refresh or attempt to keep the cache permanently warm. The first use after expiry may query Windows again.
- Refresh Applications continues to force discovery. Preloading does not select an application, launch a file, change Windows defaults, or persist cache data.

## Validation and delivery

Test settings defaults, extension normalization, exclusions and bounds, distinct-type discovery, startup/folder-change triggers, cancellation, disabled/zero-cache behavior, errors, and command priority. Retain the existing regression suite. Build and inspect a new versioned VSIX for manual installation. Live startup impact and native Windows behavior require a manual smoke test; no speed claim is made before measurement.

This is a small extension of the current cache. Implementation details, including the exact scan API and coordination mechanism, remain with the implementer. Product code will follow approval of this short design.

## Delivery evidence

Implemented on dev with changes left uncommitted. TypeScript compilation and 60 automated tests passed. Version 0.1.7 VSIX includes the current modules and production dependencies; activation succeeded from an isolated extracted package with a mocked VS Code API. Actual Windows startup impact and native windows remain manual checks.
