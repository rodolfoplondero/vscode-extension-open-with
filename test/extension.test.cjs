const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function activate(t, overrides = {}, settings = {}) {
  const calls = { info: [], errors: [], picks: [], lists: 0, disposed: 0, scans: 0, files: [], config: settings.config ?? {} };
  let command, onCancel, onConfigurationChange, onFoldersChange;
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
      showQuickPick: async (items, options) => { calls.picks.push({ items, options }); },
      showInformationMessage: async message => { calls.info.push(message); },
      showErrorMessage: async message => { calls.errors.push(message); },
      withProgress: async (options, task) => {
        calls.progress = options;
        return task({}, { isCancellationRequested: false, onCancellationRequested: callback => {
          onCancel = callback; return { dispose: () => { calls.disposed++; } };
        } });
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
  return { calls, run: () => command({ scheme: 'file', fsPath: 'C:\\report.txt' }), cancel: () => onCancel(),
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

test('picker keeps the Windows escape route visible and searches names only', async t => {
  const { calls, run } = activate(t);
  await run();
  const { items, options } = calls.picks[0];
  assert.equal(items.at(-1).alwaysShow, true);
  assert.equal(options.matchOnDescription, false);
  assert.equal(options.matchOnDetail, false);
  assert.equal(items[2].description, undefined);
  assert.ok(items[0].description.includes('C:\\Tools'));
  assert.ok(items[1].description.includes('D:\\Other'));
  assert.ok(items.every(item => !item.detail));
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
  assert.equal(calls.picks.length, 0);
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
  const { run } = activate(t, { list: async (file, signal) => {
    if (file.endsWith('report.txt')) { events.push('foreground'); return [{ name: 'Editor', id: 'editor', recommended: true }]; }
    events.push('background'); started();
    await new Promise((_resolve, reject) => signal.addEventListener('abort', async () => {
      await tick(); events.push('drained'); reject(signal.reason);
    }, { once: true }));
  } }, { folders: [localFolder], find: () => [{ scheme: 'file', fsPath: 'C:\\project\\one.pdf' }] });
  await tick();
  assert.ok(events.includes('background'));
  await ready;
  await run();
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

test('busy command explains the pending operation and becomes available afterward', async t => {
  let finish;
  const { calls, run } = activate(t, { list: () => new Promise(resolve => { finish = resolve; }) });
  const first = run();
  await new Promise(resolve => setImmediate(resolve));
  await run();
  assert.match(calls.info[0], /already/);
  finish([{ name: 'Editor', id: 'editor', recommended: true }]);
  await first;
});

test('progress cancellation reaches discovery and releases the command guard', async t => {
  let attempts = 0;
  const { calls, run, cancel } = activate(t, { list: async (_file, signal) => {
    attempts++;
    if (attempts === 1) return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    return [{ name: 'Editor', id: 'editor', recommended: true }];
  } });
  const pending = run();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.progress.cancellable, true);
  cancel();
  await pending;
  await run();
  assert.equal(attempts, 2);
  assert.equal(calls.errors.length, 0);
  assert.equal(calls.disposed, 2);
});
