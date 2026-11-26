# Open With External Application

A **VS Code extension for Windows**: right-click a file, choose **Open With External Application…**, and select an application from a searchable list.

## Install

1. Download `open-with-external-0.1.7.vsix`, or build it from source as described below.
2. In VS Code, open **Extensions** (`Ctrl+Shift+X`).
3. Open the **…** menu, select **Install from VSIX…**, and choose the package.
4. Reload the VS Code window if prompted.

You can also install from a terminal:

```powershell
code --install-extension .\open-with-external-0.1.7.vsix
```

The extension uses Windows PowerShell 5.1 and the Windows Shell APIs. You do not need Node.js or development tools to use the VSIX. Requires VS Code 1.96 or later; intended for Windows 10/11.

## Usage

- In the VS Code Explorer, right-click a **file** and select **Open With External Application…**.
- The command is also available in the editor and editor tab context menus.
- From the Command Palette (`Ctrl+Shift+P`), run **File: Open With External Application…** for the active file.
- Type an application name to filter the list, then press `Enter` to open it. Press `Esc` or click outside the picker to dismiss it without opening an application.
- **Choose Another Application in Windows…** opens the native Windows dialog.
- If no supported applications are found, the extension offers the native dialog.
- For unsaved changes, choose **Save and Open**, **Open Saved Version**, or cancel.
- The Windows dialog option remains available while you search, even if no application name matches.
- Cancel an application query from its progress notification. If another Open With operation is still active, a message explains how to finish or dismiss it.
- If the selected application fails to open the file, choose **Open With Windows…** to try another application.

The picker searches application names. It shows handler identities only when application names repeat, to help distinguish installations.

Extension labels and messages are in English. Application names and the native dialog use the language provided by Windows. The technical extension identifier remains `local-tools.abrir-com-externo`, and the command identifier remains `abrirComExterno.open` for compatibility.

## Settings

Open VS Code Settings (`Ctrl+,`) and search for `@ext:local-tools.abrir-com-externo`.

**Open With External: Cache Duration Minutes** (`openWithExternal.cacheDurationMinutes`) controls how long application lists are reused for each file extension. The default is **5 minutes**; set **0** to query Windows every time. You can also set it in `settings.json`:

```json
{
  "openWithExternal.cacheDurationMinutes": 5
}
```

The cache is kept only in memory for the current VS Code window. It is shared by files with the same extension, regardless of extension capitalization. Its lifetime starts when discovery finishes; using a cached list does not extend that lifetime. Changing the setting clears all cached lists immediately. Empty lists, errors, cancelled queries, and extensionless files are not cached.

Choose **Refresh Applications** in the picker to query Windows immediately for the current format. This action remains visible during search. A failed application launch or closing the native Windows chooser clears the cache for that format. Opening a selected application still goes through Windows; the cache speeds up discovery only.

### Background preloading

**Open With External: Preload Enabled** (`openWithExternal.preloadEnabled`) is on by default. After VS Code finishes starting, the extension searches local workspace folders for configured formats and preloads their application lists in the background. It also starts a new pass when workspace folders or relevant settings change.

**Open With External: Preload Extensions** (`openWithExternal.preloadExtensions`) is an editable list. Defaults cover documents, text and data, code and web pages, images, and diagrams:

```json
{
  "openWithExternal.preloadEnabled": true,
  "openWithExternal.preloadExtensions": [
    ".docx", ".xlsx", ".pptx", ".pdf", ".odt", ".ods", ".odp", ".rtf",
    ".md", ".txt", ".csv", ".json", ".xml", ".yaml", ".yml",
    ".py", ".html", ".css", ".js", ".ts",
    ".png", ".jpg", ".jpeg", ".svg", ".webp", ".drawio", ".bpmn"
  ]
}
```

Entries may include or omit the leading dot; capitalization is ignored. An empty list disables preloading. Turning **Preload Enabled** off or setting **Cache Duration Minutes** to `0` cancels pending work and prevents new preload queries. No preloading occurs without a local workspace folder or on unsupported operating systems.

Each pass requests at most **5,000 matching file paths across all local roots** and selects one accessible file per format. It respects `files.exclude` and `search.exclude`, including conditional sibling rules, and always skips `.git`, `node_modules`, `.venv`, `venv`, `dist`, and `build`. The result limit does not guarantee a fixed search duration in large workspaces. Formats outside the bounded search remain available through normal on-demand discovery.

Preloading reads filenames and file metadata, never file contents, and does not open or execute files. Queries run one at a time. Your Open With command interrupts and drains pending background work before proceeding; remaining formats can resume afterward. Background failures stay quiet and do not block on-demand discovery.

Preloaded results use the existing cache lifetime, starting when each query completes. There is no periodic refresh: a first use after expiry may query Windows again. Startup responsiveness and native discovery should be checked after installing the VSIX.

## Application discovery and DOCX filtering

The extension queries `SHAssocEnumHandlers` for the file extension using `ASSOC_FILTER_RECOMMENDED`, reads application names through `IAssocHandler`, and opens the file with the selected handler through `IDataObject`. Paths and handler IDs are sent as JSON through PowerShell's standard input, without interpolation into executable commands.

**A Windows recommendation does not prove format support.** Windows can recommend generic applications such as Notepad for a DOCX file even though they do not render a Word document correctly.

For **`.docx` files**, the extension therefore applies an additional conservative filter. It lists only recommended handlers whose executable matches a known document editor:

| Application | Recognized executable |
| --- | --- |
| Microsoft Word | `WINWORD.EXE` |
| LibreOffice / Apache OpenOffice | `swriter.exe`, `soffice.exe` |
| WPS Writer | `wps.exe` |
| ONLYOFFICE Desktop Editors | `DesktopEditors.exe` |
| SoftMaker TextMaker | `textmaker.exe` |

This excludes Notepad, PowerShell, Visual Studio Code, ChatGPT, Visual Studio Version Selector, UiPath Studio, VLC, and other generic handlers from the DOCX picker, including handlers that Windows marks as recommended. Matching uses the executable name, not the application's localized display name. The same DOCX check runs before invoking a selected handler.

The DOCX list is intentionally conservative: an unrecognized document editor or a handler that exposes a different identity may be omitted. Use **Choose Another Application in Windows…** to select such an application manually. That explicit native choice is not restricted by the extension's DOCX list. Formatting fidelity depends on the chosen editor and document features; the filter does not inspect the document contents.

Other file types continue to use the recommended handlers registered by Windows, without an additional format-specific editor list. They do not have the stronger DOCX filter. Applications that do not register their formats may be absent. Extensionless files use the native dialog. Available applications depend on the current user's Windows associations. The extension does not change default associations.

## Limitations

- Only accessible local Windows files are supported. Remote files in WSL, SSH, containers, and virtual file systems are not supported.
- Folders and documents that have not been saved to disk are not accepted.
- Removing an application or changing associations while the picker is open may cause an error; run the command again.
- Corporate policies blocking PowerShell or `Add-Type` may prevent discovery and opening. The extension does not bypass Group Policy.
- A completed launch request means Windows accepted the request; the extension does not monitor the external application window or verify that the document rendered correctly.
- The extension makes no network requests and collects no telemetry. The selected application receives the file to open it.

## Development

Requires Node.js 22 or later and npm. Clone the repository or extract the source archive, open the project folder in VS Code, and run:

```sh
npm ci
npm test
npm run package
```

Press `F5` to launch an Extension Development Host. The compiled package is `open-with-external-0.1.7.vsix`. The extension has not been published to the VS Code Marketplace.

### Project structure

- `src/extension.ts`: menus, Quick Pick, and VS Code integration.
- `src/command.ts`: command flow, validation, and fallback.
- `src/windows.ts`: JSON transport and response validation.
- `src/compatibility.ts`: conservative DOCX editor filtering.
- `src/preload.ts`: sequential background work and foreground priority.
- `src/workspace.ts`: bounded workspace search and exclusions.
- `scripts/bridge.ps1`: PowerShell entry point.
- `scripts/Associations.cs`: Windows COM/Shell APIs.
- `test/`: automated command, transport, compatibility, and VS Code adapter tests with simulated operating-system and editor boundaries.

## Validation

### GitHub Actions

The **Test, package and release** workflow compiles and tests on Windows with Node.js 22 for pull requests, pushes to `main`, and manual runs. It builds a versioned VSIX, verifies its settings and activation against a mocked VS Code API in an isolated directory, and uploads the installable package as a workflow artifact for 14 days.

Pushing a tag such as `v0.1.8` runs the same checks and publishes a GitHub release with the VSIX attached. The tag must match the version in `package.json`; mismatches stop the workflow. Update the version and lockfile, commit the changes through the normal PR process, then tag the intended release commit and push the tag. Published assets are preserved on reruns. GitHub generates the release notes. This does not publish to the VS Code Marketplace or Open VSX.

The workflow uses the repository's automatic `GITHUB_TOKEN`; no personal access token is required. Build jobs have read-only repository access, and only the tag-triggered release job can write release metadata and assets. Existing release `v0.1.7` is left unchanged.

### Automated and manual checks

Automated checks run TypeScript compilation and tests on Windows, including background preloading, search exclusions, cancellation and foreground priority, cache expiration, refresh, settings changes, and simulated VS Code picker behavior. Earlier checks also compiled C# and called the extensionless-file bridge using PowerShell 7 on Linux. These checks **do not establish that native application discovery and launching work on Windows PowerShell 5.1**.

Before distributing the extension, verify on Windows 10/11:

- Install the VSIX and check menus and the Command Palette.
- Open `.txt`, `.png`, `.pdf`, and another format with multiple registered applications.
- Open a `.docx` file with Word and another supported office suite installed; verify that generic handlers are absent, including Notepad even when Windows recommends it.
- Try a DOCX file with no recognized editor installed and check the fallback message.
- Test traditional and Microsoft Store applications where available, both on first launch and while already running; verify asynchronous activation and DDE-based applications.
- Use paths containing spaces, accented characters, `&`, brackets, and apostrophes.
- Cancel the picker and native dialog without opening the file.
- Search for an unlisted application and check that the Windows dialog option remains visible.
- Cancel a pending application query, then invoke the command again.
- Invoke the command while a picker or Windows dialog is already open and check the explanatory message.
- Change Cache Duration Minutes in Settings; check repeated files of the same format, expiry, Refresh Applications, and disabling with 0.
- Open a local folder with several configured formats and check background preloading, exclusions, disabling, and an immediate foreground Open With request.
- Try an unknown format and an extensionless file.
- Verify saving changes, opening the saved disk version, and cancelling.
- Remove or change an association while the picker is open and check the error message.
- Check that folders and remote files are rejected.

MIT License.
