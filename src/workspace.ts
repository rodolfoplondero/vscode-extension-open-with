import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { minimatch } from 'minimatch';
import { normalizeExtensions } from './preload';

const skippedFolders = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build']);
type Exclusion = boolean | { when: string };

/** Bounded filename search, with per-root settings and no document reads. */
export async function scanWorkspace(values: string[], signal: AbortSignal): Promise<string[]> {
  signal.throwIfAborted();
  const extensions = normalizeExtensions(values);
  if (extensions.length === 0) return [];
  const suffixes = extensions.map(extension => extension.slice(1).replace(/[a-z]/g, letter => `[${letter}${letter.toUpperCase()}]`));
  const include = suffixes.length === 1 ? `**/*.${suffixes[0]}` : `**/*.{${suffixes.join(',')}}`;
  const representatives = new Map<string, string>();
  const tokens = new vscode.CancellationTokenSource();
  const cancel = () => tokens.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  let examined = 0;
  try {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      if (folder.uri.scheme !== 'file' || examined >= 5000) continue;
      signal.throwIfAborted();
      const exclusions = ['files', 'search'].flatMap(section => Object.entries(
        vscode.workspace.getConfiguration(section, folder.uri).get<Record<string, Exclusion>>('exclude', {})
      ));
      const excludedPatterns = ['**/{.git,node_modules,.venv,venv,dist,build}/**',
        ...exclusions.filter(([, value]) => value === true).map(([pattern]) => pattern)];
      const exclude = excludedPatterns.length === 1 ? excludedPatterns[0] : `{${excludedPatterns.join(',')}}`;
      let files: vscode.Uri[];
      try {
        files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, include), exclude, 5000 - examined, tokens.token);
      } catch (error) {
        signal.throwIfAborted();
        continue; // An inaccessible workspace root does not block other roots.
      }
      signal.throwIfAborted();
      const remaining = files.slice(0, 5000 - examined);
      examined += remaining.length;
      for (const file of remaining) {
        signal.throwIfAborted();
        if (file.scheme !== 'file') continue;
        const extension = path.win32.extname(file.fsPath).toLowerCase();
        if (!extensions.includes(extension) || representatives.has(extension)) continue;
        const relative = path.win32.relative(folder.uri.fsPath, file.fsPath).replace(/\\/g, '/');
        if (relative.startsWith('../') || path.win32.isAbsolute(relative) || relative.split('/').some(part => skippedFolders.has(part.toLowerCase()))) continue;
        let excluded = false;
        const components = relative.split('/');
        for (const [pattern, value] of exclusions) {
          if (!value) continue;
          // Matching ancestors also handles an excluded directory's children.
          const matched = components.map((_, index) => components.slice(0, index + 1).join('/'))
            .find(candidate => minimatch(candidate, pattern, { dot: true, nocase: true }));
          if (!matched) continue;
          if (value === true) { excluded = true; break; }
          if (typeof value.when !== 'string') continue;
          const candidate = path.win32.join(folder.uri.fsPath, matched);
          const basename = path.win32.basename(candidate, path.win32.extname(candidate));
          const sibling = path.win32.join(path.win32.dirname(candidate), value.when.replace(/\$\(basename\)/g, basename));
          try { await fs.stat(sibling); excluded = true; break; } catch { /* No matching sibling. */ }
        }
        if (excluded) continue;
        try {
          if ((await fs.stat(file.fsPath)).isFile()) representatives.set(extension, file.fsPath);
        } catch { /* Try another accessible file of this type. */ }
        if (representatives.size === extensions.length) break;
      }
      if (representatives.size === extensions.length) break;
    }
    signal.throwIfAborted();
    return [...representatives.values()];
  } finally {
    signal.removeEventListener('abort', cancel);
    tokens.dispose();
  }
}
