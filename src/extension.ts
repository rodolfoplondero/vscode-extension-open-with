import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runOpenExternal, Choice, FileTarget, Host, PickerSession } from './command';
import type { App } from './windows';
import { WindowsBridge } from './windows';
import { defaultPreloadExtensions, Preloader } from './preload';
import { scanWorkspace } from './workspace';

interface AppItem extends vscode.QuickPickItem { choice?: Choice | { kind: 'refresh' } }

function buildItems(apps: App[]): AppItem[] {
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
  if (apps.length > 0) {
    items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
    items.push({ label: 'Refresh Applications', alwaysShow: true, choice: { kind: 'refresh' } });
  }
  items.push({ label: 'Choose Another Application in Windows…', alwaysShow: true, choice: { kind: 'native' } });
  return items;
}

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
  const warmingEnabled = () => {
    const config = vscode.workspace.getConfiguration('openWithExternal');
    return process.platform === 'win32' && config.get<boolean>('preloadEnabled', true)
      && config.get<number>('cacheDurationMinutes', 5) > 0;
  };
  // Query the active tab's format ahead of time so the picker usually finds a fresh list.
  const warmActiveTab = () => {
    if (!warmingEnabled()) return;
    const input = vscode.window.tabGroups?.activeTabGroup?.activeTab?.input as { uri?: vscode.Uri } | undefined;
    const uri = input?.uri;
    if (uri?.scheme !== 'file' || !path.win32.extname(uri.fsPath) || bridge.getCached(uri.fsPath)) return;
    bridge.list(uri.fsPath).catch(() => { /* Warming is best effort and never shows an error. */ });
  };
  let warmTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleWarming = () => {
    clearTimeout(warmTimer);
    warmTimer = setTimeout(warmActiveTab, 300);
  };
  const tabSubscription = vscode.window.tabGroups?.onDidChangeTabs(scheduleWarming);
  context.subscriptions.push({ dispose: () => { clearTimeout(warmTimer); tabSubscription?.dispose(); } });
  scheduleWarming();
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
    openPicker: (filePath, initialApps, busy, onRefresh) => {
      const picker = vscode.window.createQuickPick<AppItem>();
      picker.title = `Open ${path.win32.basename(filePath)} With…`;
      picker.placeholder = 'Search for and select an application';
      picker.matchOnDescription = false;
      picker.matchOnDetail = false;
      picker.ignoreFocusOut = false;
      picker.busy = busy;
      const render = (apps: App[]) => {
        const activeId = (picker.activeItems[0]?.choice as Choice | undefined)?.kind === 'app'
          ? (picker.activeItems[0].choice as { app: App }).app.id : undefined;
        const items = buildItems(apps);
        picker.items = items;
        const active = items.find(item => item.choice?.kind === 'app' && item.choice.app.id === activeId);
        if (active) picker.activeItems = [active];
      };
      render(initialApps);
      const result = new Promise<Choice | undefined>(resolve => {
        picker.onDidAccept(() => {
          const choice = (picker.selectedItems[0] ?? picker.activeItems[0])?.choice;
          if (!choice) return;
          if (choice.kind === 'refresh') { onRefresh(); return; }
          resolve(choice);
          picker.hide();
        });
        picker.onDidHide(() => { resolve(undefined); picker.dispose(); });
      });
      picker.show();
      const session: PickerSession = {
        result,
        setApps: render,
        setBusy: value => { picker.busy = value; },
        hide: () => picker.hide()
      };
      return session;
    },
    offerNative: async message => {
      const action = 'Open With Windows…';
      return await vscode.window.showWarningMessage(message, action) === action;
    },
    error: async message => { await vscode.window.showErrorMessage(message); }
  };
  let running = false;
  context.subscriptions.push(vscode.commands.registerCommand('openWithExternal.open', async (uri?: vscode.Uri) => {
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
