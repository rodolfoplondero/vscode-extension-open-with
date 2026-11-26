import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runOpenExternal, Choice, FileTarget, Host } from './command';
import { WindowsBridge } from './windows';
import { defaultPreloadExtensions, Preloader } from './preload';
import { scanWorkspace } from './workspace';

interface AppItem extends vscode.QuickPickItem { choice?: Choice }

export function activate(context: vscode.ExtensionContext): void {
  const bridge = new WindowsBridge(context.extensionPath, undefined, () =>
    vscode.workspace.getConfiguration('openWithExternal').get<number>('cacheDurationMinutes', 5));
  const preloader = new Preloader(scanWorkspace, bridge);
  const restartPreloading = () => {
    const config = vscode.workspace.getConfiguration('openWithExternal');
    const enabled = process.platform === 'win32' && config.get<boolean>('preloadEnabled', true)
      && config.get<number>('cacheDurationMinutes', 5) > 0
      && vscode.workspace.workspaceFolders?.some(folder => folder.uri.scheme === 'file');
    preloader.restart(enabled ? config.get<string[]>('preloadExtensions', defaultPreloadExtensions) : []);
  };
  context.subscriptions.push(preloader, vscode.workspace.onDidChangeWorkspaceFolders(restartPreloading));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('openWithExternal.cacheDurationMinutes')) bridge.clearCache();
    if (['openWithExternal', 'files.exclude', 'search.exclude'].some(key => event.affectsConfiguration(key))) restartPreloading();
  }));
  const host: Host = {
    platform: process.platform,
    activeFile: () => vscode.window.activeTextEditor?.document.uri,
    isFile: async filePath => (await fs.stat(filePath)).isFile(),
    prepareFile: async target => {
      const doc = vscode.workspace.textDocuments.find(document =>
        document.uri.scheme === target.scheme && document.uri.fsPath === target.fsPath);
      if (!doc?.isDirty) return true;
      const save = 'Save and Open';
      const disk = 'Open Saved Version';
      const choice = await vscode.window.showWarningMessage(
        'This file has unsaved changes. The external application will open the version on disk.',
        { modal: true }, save, disk);
      if (choice === save) {
        const saved = await doc.save();
        if (!saved) await vscode.window.showErrorMessage('The file was not saved. Opening was cancelled.');
        return saved;
      }
      return choice === disk;
    },
    pick: async (apps, filePath) => {
      const nameCounts = new Map<string, number>();
      for (const app of apps) {
        const name = app.name.toLocaleLowerCase();
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
      }
      const items: AppItem[] = apps.map(app => ({
        label: app.name,
        description: nameCounts.get(app.name.toLocaleLowerCase())! > 1 ? app.id : undefined,
        choice: { kind: 'app', app }
      }));
      items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
      items.push({ label: 'Refresh Applications', alwaysShow: true, choice: { kind: 'refresh' } });
      items.push({ label: 'Choose Another Application in Windows…', alwaysShow: true, choice: { kind: 'native' } });
      const chosen = await vscode.window.showQuickPick(items, {
        title: `Open ${path.win32.basename(filePath)} With…`,
        placeHolder: 'Search for and select an application',
        matchOnDescription: false, matchOnDetail: false, ignoreFocusOut: false
      });
      return chosen?.choice;
    },
    progress: async task => await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification, title: 'Querying Windows applications…', cancellable: true
    }, async (_progress, token) => {
      const controller = new AbortController();
      const subscription = token.onCancellationRequested(() => controller.abort());
      if (token.isCancellationRequested) controller.abort();
      try { return await task(controller.signal); }
      finally { subscription.dispose(); }
    }),
    offerNative: async message => {
      const action = 'Open With Windows…';
      return await vscode.window.showWarningMessage(message, action) === action;
    },
    error: async message => { await vscode.window.showErrorMessage(message); }
  };
  let running = false;
  context.subscriptions.push(vscode.commands.registerCommand('abrirComExterno.open', async (uri?: vscode.Uri) => {
    if (running) {
      await vscode.window.showInformationMessage(
        'An Open With operation is already in progress. Finish or dismiss the application picker or Windows dialog, or cancel the application query.');
      return;
    }
    running = true;
    try {
      await preloader.pause();
      await runOpenExternal(host, bridge, uri as FileTarget | undefined);
    } finally { running = false; preloader.resume(); }
  }));
  restartPreloading();
}
