# SDD ledger — plan: docs/superpowers/plans/2026-11-26-application-preload.md

Pre-flight: Task 2 consumes Preloader.restart/pause/resume/dispose and normalizeExtensions from Task 1; the interface signatures agree.

Ruling: Execute inline in the existing dev checkout and keep changes uncommitted — the user explicitly chose dev and a later PR.

Ruling: Use a small runtime minimatch dependency to interpret workspace exclusion patterns, including conditional sibling exclusions — consistent glob semantics avoid a custom partial parser. Dependency installation needed sandbox escalation for registry access and succeeded.

Task 1: complete — normalization, one representative per type, sequential queries, cache reuse, cancellation, quiet failures and foreground drain tested. Five new coordinator tests failed before the module existed, then passed.

Task 2: in progress — bounded local scanning and VS Code lifecycle integrated. Scanner tests failed before implementation; three integration regressions and a transport-drain regression failed before wiring the feature. npm test now passes 60 tests.

Final independent review: found one P1 packaging defect — node_modules/** excluded the new runtime dependency. Removed that exclusion so vsce includes only the production dependency closure. No other important correctness or concurrency findings.

Package verification: extracted VSIX 0.1.7 outside the repository, confirmed all six compiled modules and both Windows scripts match the workspace, verified settings/default lists and startup activation, and activated the extension against a mocked VS Code API. Runtime dependencies resolved within the package; development files were excluded. A first shell-embedded check hit PowerShell quoting behavior; replaced it with reusable test/verify-package.cjs, which passed.

Task 2: complete — npm test passes 60 tests; npm run package produced open-with-external-0.1.7.vsix (231,018 bytes). Live Extension Host/native-window checks remain manual. Changes remain uncommitted on dev.

Ruling: Put bounded VS Code search and exclusion handling in src/workspace.ts — keeps the coordinator independent of VS Code and gives scanner behavior focused tests.

Transport correction: on abort, wait for process close before rejecting discovery; this avoids starting the foreground query while the interrupted PowerShell process is still exiting.
