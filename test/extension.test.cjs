const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function activate(t, overrides = {}, settings = {}) {
  const calls = { info: [], errors: [], pickers: [], lists: 0, disposed: 0, scans: 0, files: [], config: settings.config ?? {} };
  let command, onConfigurationChange, onFoldersChange, onTabsChange;
  const bridge = {
    getCached: () => undefined,
    list: async file => { calls.lists++; calls.files.push(file); return [
      { name: 'Editor', id: 'C:\\Tools\\Editor.exe', recommended: true },
      { name: 'Editor', id: 'D:\\Other\\Editor.exe', recommended: true },
      { name: 'Viewer', id: 'C:\\Viewer.exe', recommended: true }
    ]; },
    clearCache: () => { calls.clears = (calls.clears ?? 0) + 1; },
    open: async () => {}, native: async () => {}, ...overrides
  };
  const vscode = {
    CancellationTokenSource: class {
      token = { isCancellationRequested: false };
      cancel() { this.token.isCancellationRequested = true; }
      dispose() {}
    },
    RelativePattern: class { constructor(base, pattern) { this.base = base; this.pattern = pattern; } },
    QuickPickItemKind: { Separator: -1 }, ProgressLocation: { Notification: 15 },
    workspace: {
      textDocuments: [],
      workspaceFolders: settings.folders ?? [],
      findFiles: async (_include, _exclude, _limit, token) => { calls.scans++; return settings.find?.(token) ?? []; },
      getConfiguration: section => ({ get: (key, fallback) => section === 'openWithExternal'
        ? (key === 'cacheDurationMinutes' ? calls.minutes ?? calls.config[key] ?? fallback : calls.config[key] ?? fallback)
        : {} }),
      onDidChangeWorkspaceFolders: callback => { onFoldersChange = callback; return { dispose() {} }; },
      onDidChangeConfiguration: callback => { onConfigurationChange = callback; return { dispose() {} }; }
    },
    commands: { registerCommand: (id, callback) => { calls.commandId = id; command = callback; return { dispose() {} }; } },
    window: {
      createQuickPick: () => {
        const listeners = { accept: [], hide: [] };
        const picker = {
          items: [], activeItems: [], selectedItems: [], busy: false,
          onDidAccept: callback => { listeners.accept.push(callback); return { dispose() {} }; },
          onDidHide: callback => { listeners.hide.push(callback); return { dispose() {} }; },
          show() { calls.pickers.push(picker); },
          hide() { listeners.hide.forEach(callback => callback()); },
          accept(item) { picker.selectedItems = [item]; listeners.accept.forEach(callback => callback()); },
          dispose() { calls.disposed++; }
        };
        return picker;
      },
      showInformationMessage: async message => { calls.info.push(message); },
      showErrorMessage: async message => { calls.errors.push(message); },
      tabGroups: settings.tab === undefined ? undefined : {
        activeTabGroup: { activeTab: { input: settings.tab } },
        onDidChangeTabs: callback => { onTabsChange = callback; return { dispose() {} }; }
      }
    }
  };
  const originalLoad = Module._load;
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: settings.platform ?? 'win32' });
  t.after(() => Object.defineProperty(process, 'platform', platform));
  Module._load = function(id, parent, ...rest) {
    if (/[/\\](extension|workspace)\.js$/.test(parent?.filename ?? '')) {
      if (id === 'vscode') return vscode;
      if (id === './windows') return { WindowsBridge: class { constructor(_path, _runner, minutes) { calls.cacheMinutes = minutes; return bridge; } } };
      if (id === 'node:fs/promises') return { stat: async () => ({ isFile: () => true }) };
    }
    return originalLoad.call(this, id, parent, ...rest);
  };
  try {
    delete require.cache[require.resolve('../dist/extension.js')];
    delete require.cache[require.resolve('../dist/workspace.js')];
    const subscriptions = [];
    require('../dist/extension.js').activate({ extensionPath: '', subscriptions });
    t.after(() => subscriptions.forEach(subscription => subscription.dispose()));
  } finally { Module._load = originalLoad; }
  return { calls, run: () => command({ scheme: 'file', fsPath: 'C:\\report.txt' }), tabsChange: () => onTabsChange(),
    foldersChange: () => onFoldersChange(),
    configurationChange: relevant => onConfigurationChange({ affectsConfiguration: () => relevant }) };
}

test('English extension identity and command agree across manifest, menus and registration', t => {
  const manifest = require('../package.json');
  const { calls } = activate(t);
  assert.equal(manifest.publisher + '.' + manifest.name, 'rodolfoplondero.open-with-external');
  assert.equal(calls.commandId, 'openWithExternal.open');
  assert.equal(manifest.contributes.commands[0].command, calls.commandId);
  for (const menu of Object.values(manifest.contributes.menus)) {
    for (const item of menu) assert.equal(item.command, calls.commandId);
  }
});

test('picker opens at once, keeps the Windows escape route visible and searches names only', async t => {
  const { calls, run } = activate(t);
  const done = run();
  await tick(); await tick();
  const picker = calls.pickers[0];
  const { items } = picker;
  assert.equal(items.at(-1).alwaysShow, true);
  assert.match(items.at(-1).label, /Windows/);
  assert.equal(picker.matchOnDescription, false);
  assert.equal(picker.matchOnDetail, false);
  assert.equal(items[2].description, undefined);
  assert.ok(items[0].description.includes('C:\\Tools'));
  assert.ok(items[1].description.includes('D:\\Other'));
  assert.ok(items.every(item => !item.detail));
  picker.hide();
  await done;
});

test('picker shows only the Windows option and a busy bar until the applications arrive', async t => {
  let finish;
  const { calls, run } = activate(t, { list: () => new Promise(resolve => { finish = resolve; }) });
  const done = run();
  await tick();
  const picker = calls.pickers[0];
  assert.equal(picker.busy, true);
  assert.deepEqual(picker.items.map(item => item.label), ['Choose Another Application in Windows\u2026']);
  finish([{ name: 'Editor', id: 'editor', recommended: true }]);
  await tick();
  assert.equal(picker.busy, false);
  assert.deepEqual(picker.items.map(item => item.label), ['Editor', '', 'Refresh Applications', 'Choose Another Application in Windows\u2026']);
  picker.hide();
  await done;
});

test('Refresh Applications keeps the picker open, shows the busy bar and replaces the list', async t => {
  let queries = 0, finish;
  const first = [{ name: 'Old', id: 'old', recommended: true }];
  const { calls, run } = activate(t, { list: (_file, _signal, force) => {
    queries++;
    return force ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(first);
  } });
  const done = run();
  await tick(); await tick();
  const picker = calls.pickers[0];
  picker.accept(picker.items.find(item => item.label === 'Refresh Applications'));
  await tick();
  assert.equal(picker.busy, true);
  assert.equal(calls.pickers.length, 1);
  finish([{ name: 'New', id: 'new', recommended: true }]);
  await tick();
  assert.equal(picker.busy, false);
  assert.equal(picker.items[0].label, 'New');
  assert.equal(queries, 2);
  picker.hide();
  await done;
});

const tick = () => new Promise(resolve => setImmediate(resolve));
const localFolder = { uri: { scheme: 'file', fsPath: 'C:\\project' } };

test('startup preloads only configured formats found in local workspace folders', async t => {
  const { calls } = activate(t, {}, {
    folders: [localFolder],
    find: () => ['report.DOCX', 'second.docx', 'file.pdf', 'ignore.zip'].map(name => ({ scheme: 'file', fsPath: 'C:\\project\\' + name }))
  });
  await tick(); await tick();
  assert.deepEqual(calls.files, ['C:\\project\\report.DOCX', 'C:\\project\\file.pdf']);
  assert.equal(calls.scans, 1);
  assert.equal(calls.pickers.length, 0);
  assert.equal(calls.info.length, 0);
  assert.equal(calls.errors.length, 0);
});

for (const [name, settings] of [
  ['disabled', { config: { preloadEnabled: false }, folders: [localFolder] }],
  ['zero cache duration', { config: { cacheDurationMinutes: 0 }, folders: [localFolder] }],
  ['empty extension list', { config: { preloadExtensions: [] }, folders: [localFolder] }],
  ['no folder', {}],
  ['remote folder', { folders: [{ uri: { scheme: 'vscode-remote', fsPath: '/remote' } }] }],
  ['non-Windows', { folders: [localFolder], platform: 'linux' }]
]) test(`startup skips preloading with ${name}`, async t => {
  const { calls } = activate(t, {}, settings);
  await tick(); await tick();
  assert.equal(calls.scans, 0);
  assert.equal(calls.lists, 0);
});

test('settings and workspace-folder changes restart preloading', async t => {
  const { calls, configurationChange, foldersChange } = activate(t, {}, {
    folders: [localFolder], config: { preloadEnabled: false },
    find: () => [{ scheme: 'file', fsPath: 'C:\\project\\one.PDF' }]
  });
  await tick(); assert.equal(calls.scans, 0);
  calls.config.preloadEnabled = true; calls.config.preloadExtensions = ['PDF'];
  configurationChange(true); await tick(); await tick();
  assert.equal(calls.scans, 1);
  foldersChange(); await tick(); await tick();
  assert.equal(calls.scans, 2);
});

test('foreground command interrupts preload before its own query', async t => {
  const events = [];
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const { calls, run } = activate(t, { list: async (file, signal) => {
    if (file.endsWith('report.txt')) { events.push('foreground'); return [{ name: 'Editor', id: 'editor', recommended: true }]; }
    events.push('background'); started();
    await new Promise((_resolve, reject) => signal.addEventListener('abort', async () => {
      await tick(); events.push('drained'); reject(signal.reason);
    }, { once: true }));
  } }, { folders: [localFolder], find: () => [{ scheme: 'file', fsPath: 'C:\\project\\one.pdf' }] });
  await tick();
  assert.ok(events.includes('background'));
  await ready;
  const done = run();
  for (let i = 0; i < 6; i++) await tick();
  calls.pickers[0].hide();
  await done;
  assert.deepEqual(events.slice(0, 3), ['background', 'drained', 'foreground']);
});

test('cache setting defaults to five minutes and changes clear cached applications', t => {
  const { calls, configurationChange } = activate(t);
  assert.equal(calls.cacheMinutes(), 5);
  calls.minutes = 0;
  assert.equal(calls.cacheMinutes(), 0);
  configurationChange(false);
  assert.equal(calls.clears, undefined);
  configurationChange(true);
  assert.equal(calls.clears, 1);
});

test('busy command explains the pending operation while the picker is open and becomes available afterward', async t => {
  const { calls, run } = activate(t);
  const first = run();
  await tick(); await tick();
  await run();
  assert.match(calls.info[0], /already/);
  calls.pickers[0].hide();
  await first;
  const second = run();
  await tick(); await tick();
  assert.equal(calls.info.length, 1);
  assert.equal(calls.pickers.length, 2);
  calls.pickers[1].hide();
  await second;
});

test('closing the picker while the query runs releases the command guard and keeps the query alive', async t => {
  let finish, signalSeen = 'unset';
  const { calls, run } = activate(t, { list: (_file, signal) => { signalSeen = signal; return new Promise(resolve => { finish = resolve; }); } });
  const first = run();
  await tick();
  calls.pickers[0].hide();
  await first;
  assert.equal(signalSeen, undefined);
  const second = run();
  await tick(); await tick();
  assert.equal(calls.info.length, 0);
  assert.equal(calls.pickers.length, 2);
  finish([{ name: 'Editor', id: 'editor', recommended: true }]);
  await tick();
  calls.pickers[1].hide();
  await second;
  assert.equal(calls.errors.length, 0);
});

const pdfTab = { uri: { scheme: 'file', fsPath: 'C:\\docs\\report.PDF' } };
const warmed = async (t, overrides, settings) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = activate(t, overrides, { tab: pdfTab, ...settings });
  result.tabsChange?.call();
  t.mock.timers.tick(300);
  await tick();
  return result;
};

test('the active tab format is warmed after a short pause, including non-text editors', async t => {
  const { calls, tabsChange } = await warmed(t);
  assert.deepEqual(calls.files, ['C:\\docs\\report.PDF']);
  tabsChange(); tabsChange();
  t.mock.timers.tick(299);
  assert.equal(calls.files.length, 1);
  t.mock.timers.tick(1);
  assert.equal(calls.files.length, 2, 'rapid tab changes produce one query');
});

for (const [name, overrides, settings] of [
  ['a fresh cached list', { getCached: () => [{}] }, {}],
  ['zero cache duration', {}, { config: { cacheDurationMinutes: 0 } }],
  ['preloading disabled', {}, { config: { preloadEnabled: false } }],
  ['a non-file tab', {}, { tab: { uri: { scheme: 'untitled', fsPath: 'Untitled-1.txt' } } }],
  ['an extensionless file', {}, { tab: { uri: { scheme: 'file', fsPath: 'C:\\docs\\LICENSE' } } }],
  ['a tab without a file', {}, { tab: {} }],
  ['non-Windows', {}, { platform: 'linux' }]
]) test(`tab warming is skipped for ${name}`, async t => {
  const { calls } = await warmed(t, overrides, settings);
  assert.equal(calls.lists, 0);
});

test('a failed warming query is silent', async t => {
  const { calls } = await warmed(t, { list: async () => { throw new Error('blocked'); } });
  assert.equal(calls.errors.length, 0);
  assert.equal(calls.info.length, 0);
});

test('tab warming is skipped for formats outside the configured list', async t => {
  const { calls } = await warmed(t, {}, { tab: { uri: { scheme: 'file', fsPath: 'C:\docs\archive.zip' } } });
  assert.equal(calls.lists, 0);
});

test('nothing is queried at startup when the window opens', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls } = activate(t, {}, { tab: pdfTab });
  t.mock.timers.tick(1000);
  await tick();
  assert.equal(calls.lists, 0);
});

test('Enter on the Windows option is ignored while loading with typed text, but works with an empty search', async t => {
  let finish;
  const { calls, run } = activate(t, { list: () => new Promise(resolve => { finish = resolve; }) });
  const done = run();
  await tick();
  const picker = calls.pickers[0];
  picker.value = 'word';
  picker.accept(picker.items[0]);
  await tick();
  assert.equal(calls.pickers.length, 1);
  picker.value = '';
  picker.accept(picker.items[0]);
  assert.equal(await done, undefined);
  finish([]);
});

test('a failed explicit refresh keeps the list and reports the failure', async t => {
  const { calls, run } = activate(t, { list: async (_file, _signal, force) => {
    if (force) throw new Error('policy blocked');
    return [{ name: 'Editor', id: 'editor', recommended: true }];
  } });
  const done = run();
  await tick(); await tick();
  const picker = calls.pickers[0];
  picker.accept(picker.items.find(item => item.label === 'Refresh Applications'));
  await tick(); await tick();
  assert.equal(picker.busy, false);
  assert.equal(picker.items[0].label, 'Editor');
  assert.match(calls.errors[0], /policy blocked/);
  picker.hide();
  await done;
});
