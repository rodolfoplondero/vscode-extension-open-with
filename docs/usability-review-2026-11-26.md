# Usability review — Open With External Application

Reviewed: 2026-11-26 · Version: 0.1.4

The extension has a short main workflow, clear entry points in the Explorer and editor, a save-before-opening prompt, and a native Windows fallback. The most useful improvements address search recovery, waiting states, and launch failures.

This is a source and automated-test review. No VS Code Extension Development Host or native Windows application launch was exercised. The recommendations below distinguish source findings from proposed enhancements.

## Findings, in recommended order

### 1. Keep the Windows fallback available during search

Priority: P2 · Source: `src/extension.ts:38–44`

The native fallback is a normal Quick Pick item. Searching for an application that is absent from the list also filters out “Choose Another Application in Windows…” unless its text matches the query. This hides the escape route precisely when users need another application.

Set `alwaysShow: true` on the fallback item. Verify that searching for an unlisted editor still leaves the fallback visible and selectable with the keyboard.

### 2. Explain busy states and allow cancellation of discovery

Priority: P2 · Sources: `src/extension.ts:47–61`, `src/windows.ts:20`

Discovery shows a non-cancellable notification and can take up to 30 seconds. Every command invoked during an existing operation returns silently. The native dialog has no timeout, so this guard lasts until the dialog closes. A user who returns to VS Code and invokes the command again receives no explanation.

Add cancellation for discovery and propagate it to the child process. When an operation is already active, show a short explanation, including a reminder to finish or close the Windows dialog when appropriate. Retain the concurrency guard and avoid imposing a timeout on a dialog awaiting user input.

Verify cancelling discovery, retrying afterward, and invoking the command while the native dialog is open. Native focus behavior needs a live Windows check.

### 3. Offer recovery after an application fails to open

Priority: P2 · Source: `src/command.ts:50–55`

Discovery failures offer the Windows dialog, but launch failures only display an error. If an association changes while the picker is open, the user must start again and rediscover the workflow.

Offer “Choose Another Application…” or “Try Again” after a failed launch. Keep the file target, retain diagnostic details, and require an explicit choice before attempting another launch.

Verify with a removed handler, an application launch error, and cancellation of the recovery prompt.

### 4. Simplify picker rows and improve search relevance

Priority: P3 · Sources: `src/extension.ts:32–43`, `src/windows.ts:68–71`

Every listed application is recommended, so “Recommended by Windows” repeats on every row. Raw handler IDs appear as details and participate in searching; a query can therefore match a technical path rather than the application name. IDs can still be useful to distinguish duplicate names.

Lead with the application name, show a readable publisher or executable name only where needed, and keep full handler details available for diagnostics. Prefer name-based matching. Verify duplicate display names, long installation paths, and keyboard navigation.

### 5. Explain why a DOCX editor may be missing

Priority: P3 · Sources: `src/command.ts:43–45`, `src/compatibility.ts:6–17`

The DOCX allowlist deliberately omits unknown editors. The generic “No supported applications were found” message can imply that no capable editor is installed, although one may simply be unrecognized. The README explains this distinction, but the prompt does not.

Use wording such as “No recognized DOCX editors were found. Choose an application using Windows.” Preserve the conservative filter and the explicit native choice.

Verify empty lists for DOCX and other formats separately.

## Optional enhancements

- Remember the last successfully used application per file extension and place it first. Label it “Last used”; do not change Windows defaults. Revalidate that the handler is still available.
- Add a separate “Open with Last Used Application” command that users can bind to a shortcut. Keep the existing picker command predictable.
- Consider multi-file opening only after deciding how mixed file types and partial failures should behave. The current command callback accepts one URI and does not implement batch processing.
- Measure discovery time on Windows before adding caching. Every request starts PowerShell and loads C# through `Add-Type`; this is a potential source of delay, not a measured performance result. If caching proves useful, provide refresh and invalidate stale handlers.

## Validation

`npm test` passed: TypeScript compilation and 25 tests, zero failures. Dependencies were installed with `npm ci --ignore-scripts --no-audit --no-fund`.

Existing tests cover validation, cancellation in the command abstraction, fallback selection, handler filtering, transport errors, and timeouts. They do not cover actual Quick Pick filtering, focus behavior, save-prompt buttons, or the native Windows application lifecycle. Add targeted adapter or Extension Host coverage when changing those flows, and perform a Windows smoke test before Marketplace release.

Application code and package metadata were not changed during this review.

## Marketplace preparation

The manifest currently uses publisher `local-tools`. Confirm ownership or replace it with the registered publisher ID before packaging. A different publisher changes the full extension identifier.

For a first release, create a publisher in the Marketplace management portal, build the VSIX with `npm run package`, and upload it manually. A repository URL, icon, screenshots, keywords, and a changelog would improve the listing; the missing repository URL is not itself a publication blocker.

For subsequent automated releases, prefer Trusted Publishing with GitHub Actions. Review the installed vsce version against the current publishing requirements before configuring it.

Official guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

No Marketplace upload or public release was performed.

## Implementation follow-up — version 0.1.5

All five findings were addressed after the user requested the adjustments and an installable VSIX. The fallback item stays visible during search; discovery accepts cancellation through an AbortSignal; concurrent commands explain the pending operation; launch failures offer the native dialog; and the picker and empty-list messages were simplified. Duplicate application names retain handler identities to distinguish installations. Optional enhancements remain deferred.

Nine new regression tests failed before implementation and passed afterward. Final validation: TypeScript compilation and all 34 tests passed; `npm run package` generated `open-with-external-0.1.5.vsix`. Archive inspection confirmed the version, unchanged extension identifier, all four current compiled modules, both Windows scripts, and exclusion of development tracking and test files. Live Extension Host and native Windows window behavior still require manual validation.

## Cache follow-up — version 0.1.6

The user requested a configurable discovery cache. Version 0.1.6 adds `openWithExternal.cacheDurationMinutes` (default 5, 0 disables), per-extension session reuse, a Refresh Applications picker action, and invalidation on setting changes, launch errors and completion of the native dialog. Cache hits skip discovery progress. Empty results, failures and cancelled queries are not cached. This addresses the caching enhancement above; no timing benchmark or live window validation was performed.

Work continued on the user-requested `dev` branch, with no commits. Compilation and all 41 tests passed. The generated VSIX was inspected to verify its settings schema, version and current compiled modules and Windows scripts.
