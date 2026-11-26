# Changelog

## 0.2.2 — 2026-11-26

- Open the application picker immediately with a progress bar instead of waiting for Windows.
- Show the previous application list at once after the cache duration passes, and refresh it in the background.
- Refresh Applications now updates the open picker instead of closing and reopening it.
- Keep a query running when the picker is closed so it still fills the cache; concurrent requests for one format share one query.
- Query the active tab's format in the background when switching tabs.

## 0.2.1 — 2026-11-26

- Add a 256×256 extension icon and reference it in the extension manifest.

## 0.2.0 — 2026-11-26

- Rename the extension identity to `rodolfoplondero.open-with-external` and its command to `openWithExternal.open` so current identifiers and settings instructions are in English.
- Credit the author in package metadata and prepare publication under the author's publisher namespace on Visual Studio Marketplace and Open VSX.
- Update menus, package metadata, tests, and the Settings search filter to the new identity.
- Require uninstalling the previous 0.1.x extension before installing this version. Existing `openWithExternal.*` settings remain compatible; custom command bindings must be updated.

## 0.1.7 — 2026-11-26

- Preload application lists after startup for configured formats present in local workspace folders.
- Add Preload Enabled and Preload Extensions settings with all common format groups enabled by default.
- Limit each search pass to 5,000 matching paths across local roots and respect workspace exclusions and common generated folders.
- Run background queries sequentially; give explicit Open With requests priority by cancelling and draining background work.
- Restart or cancel obsolete work when workspace folders or relevant settings change; keep background failures quiet.
- Reuse the existing cache lifetime without periodic refresh or file-content reads.

## 0.1.6 — 2026-11-26

- Cache discovered applications by file extension for a configurable number of minutes (default: 5; 0 disables).
- Add Cache Duration Minutes to the extension's VS Code settings.
- Add Refresh Applications to query Windows immediately from the picker.
- Clear cached lists on settings changes, failed launches, and after the native Windows dialog closes.
- Reuse only successful nonempty discovery results in the current window; preserve validation before each opening.

## 0.1.5 — 2026-11-26

- Keep the Windows application chooser available while filtering the picker.
- Allow cancelling application discovery and stop its PowerShell process.
- Explain when an Open With operation is already in progress.
- Offer the Windows dialog when a selected application fails to open a file.
- Search application names and show handler identities only for duplicate names.
- Explain when DOCX discovery finds no recognized editor.
- Add regression coverage for the VS Code adapter, cancellation, and recovery.
