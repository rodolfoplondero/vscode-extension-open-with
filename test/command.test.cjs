const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runOpenExternal } = require('../dist/command.js');
const target = { scheme: 'file', fsPath: 'C:\\My files\\café.txt' };
const app = { id: 'app-id', name: 'Editor', recommended: true };
const tick = () => new Promise(resolve => setImmediate(resolve));
// The fake picker answers after the query settles: `choose(session)` returns a Choice, 'refresh', or undefined.
function setup(overrides = {}, bridgeOverrides = {}, choose = session => ({ kind: 'app', app: session.apps[0] })) {
  const calls = [];
  const sessions = [];
  const host = {
    platform: 'win32', activeFile: () => target,
    isFile: async () => true, prepareFile: async () => true,
    openPicker: (file, apps, busy, onRefresh) => {
      let resolve;
      const result = new Promise(r => { resolve = r; });
      const session = {
        file, apps, busy, onRefresh, result, hidden: false, resolve,
        setApps(next) { this.apps = next; calls.push(['apps', next]); },
        setBusy(value) { this.busy = value; },
        hide() { this.hidden = true; resolve(undefined); }
      };
      sessions.push(session);
      calls.push(['picker', apps, busy]);
      tick().then(() => tick()).then(async () => {
        if (session.hidden) return;
        while (!session.hidden) {
          const choice = await choose(session);
          if (choice !== 'refresh') { resolve(choice); return; }
          session.onRefresh();
          await tick(); await tick();
        }
      });
      return session;
    },
    offerNative: async message => { calls.push(['offer', message]); return true; },
    error: async message => { calls.push(['error', message]); },
    ...overrides
  };
  const bridge = {
    list: async (file, _signal, force) => { calls.push(['list', file, force]); return [app]; },
    open: async (...args) => { calls.push(['open', ...args]); },
    native: async file => { calls.push(['native', file]); }, ...bridgeOverrides
  };
  return { host, bridge, calls, sessions };
}
test('uses the active file and opens the selected application by ID', async () => {
  const { host, bridge, calls } = setup();
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.deepEqual(calls.at(-1), ['open', target.fsPath, app.id]);
});
test('the context menu file takes priority over the active file', async () => {
  const { host, bridge, calls } = setup();
  const selected = { scheme: 'file', fsPath: 'C:\\other.pdf' };
  await runOpenExternal(host, bridge, selected);
  assert.deepEqual(calls.find(c => c[0] === 'list'), ['list', selected.fsPath, false]);
});
test('cancelling Quick Pick or saving does not open anything', async () => {
  for (const [overrides, choose] of [[{}, () => undefined], [{ prepareFile: async () => false }, undefined]]) {
    const { host, bridge, calls } = setup(overrides, {}, choose);
    assert.equal(await runOpenExternal(host, bridge), 'cancelled');
    assert.ok(!calls.some(c => ['open', 'native'].includes(c[0])));
  }
});
test('rejects unsupported platforms, remote files, untitled documents, folders, and missing files', async () => {
  for (const [overrides, file, status] of [
    [{ platform: 'linux' }, target, 'unsupported'],
    [{}, { scheme: 'vscode-remote', fsPath: '/remote/a.txt' }, 'invalid'],
    [{}, { scheme: 'untitled', fsPath: 'Untitled-1' }, 'invalid'],
    [{ isFile: async () => false }, target, 'invalid'],
    [{ activeFile: () => undefined }, undefined, 'invalid']
  ]) {
    const { host, bridge, calls } = setup(overrides);
    assert.equal(await runOpenExternal(host, bridge, file), status);
    assert.equal(calls.filter(c => ['list', 'open', 'native', 'picker'].includes(c[0])).length, 0);
    assert.ok(calls.some(c => c[0] === 'error'));
  }
});
test('offers the native dialog when no supported applications exist, including extensionless files', async () => {
  const { host, bridge, calls, sessions } = setup({}, { list: async () => [] });
  assert.equal(await runOpenExternal(host, bridge, { scheme: 'file', fsPath: 'C:\\README' }), 'opened');
  assert.deepEqual(calls.at(-1), ['native', 'C:\\README']);
  assert.equal(sessions[0].hidden, true);
});
test('declining the native dialog does not open anything', async () => {
  const { host, bridge, calls } = setup({ offerNative: async () => false }, { list: async () => [] });
  assert.equal(await runOpenExternal(host, bridge), 'cancelled');
  assert.ok(!calls.some(c => c[0] === 'native'));
});
test('discovery failure offers a fallback and preserves the cause in the message', async () => {
  const { host, bridge, calls } = setup({}, { list: async () => { throw new Error('policy blocked'); } });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.ok(calls.some(c => c[0] === 'offer' && c[1].includes('policy blocked')));
});
test('selecting the native option in the list opens the dialog', async () => {
  const { host, bridge, calls } = setup({}, {}, () => ({ kind: 'native' }));
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.deepEqual(calls.at(-1), ['native', target.fsPath]);
});
test('native dialog launch errors are displayed without reporting success', async () => {
  for (const bridgeOverrides of [
    { open: async () => { throw new Error('handler removed'); }, native: async () => { throw new Error('dialog failed'); } },
    { list: async () => [], native: async () => { throw new Error('dialog failed'); } }
  ]) {
    const { host, bridge, calls } = setup({}, bridgeOverrides);
    assert.equal(await runOpenExternal(host, bridge), 'failed');
    assert.equal(calls.at(-1)[0], 'error');
  }
});
test('an inaccessible file displays an error', async () => {
  const { host, bridge, calls } = setup({ isFile: async () => { throw new Error('EACCES'); } });
  assert.equal(await runOpenExternal(host, bridge), 'failed');
  assert.ok(calls.at(-1)[1].includes('EACCES'));
});

test('launch failure offers the native dialog for the same file', async () => {
  const { host, bridge, calls } = setup({}, { open: async () => { throw new Error('handler removed'); } });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.ok(calls.some(c => c[0] === 'offer' && c[1].includes('handler removed')));
  assert.deepEqual(calls.at(-1), ['native', target.fsPath]);
});

test('declining recovery after a launch failure opens nothing else', async () => {
  const { host, bridge, calls } = setup({ offerNative: async () => false }, {
    open: async () => { throw new Error('handler removed'); }
  });
  assert.equal(await runOpenExternal(host, bridge), 'cancelled');
  assert.ok(!calls.some(c => c[0] === 'native' || c[0] === 'error'));
});

test('DOCX empty list explains recognition rather than claiming no editor exists', async () => {
  const { host, bridge, calls } = setup({}, { list: async () => [] });
  await runOpenExternal(host, bridge, { scheme: 'file', fsPath: 'C:\\report.DOCX' });
  assert.match(calls.find(c => c[0] === 'offer')[1], /No recognized DOCX editors/);
});

test('the picker opens at once, busy and empty, when nothing is cached, then receives the applications', async () => {
  let finish;
  const { host, bridge, calls, sessions } = setup({}, { list: () => new Promise(resolve => { finish = resolve; }) },
    async session => { finish([app]); await tick(); return { kind: 'app', app: session.apps[0] }; });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.deepEqual(calls[0], ['picker', [], true]);
  assert.equal(sessions[0].busy, false);
  assert.deepEqual(calls.at(-1), ['open', target.fsPath, app.id]);
});

test('a fresh cached list opens the picker ready, without querying Windows', async () => {
  const { host, bridge, calls } = setup({}, {
    peek: () => ({ apps: [app], stale: false }), list: async () => { throw new Error('unexpected query'); }
  });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.deepEqual(calls[0], ['picker', [app], false]);
  assert.ok(!calls.some(c => c[0] === 'list'));
});

test('a stale list shows at once and is replaced when the background refresh arrives', async () => {
  const fresh = { id: 'new-id', name: 'New Editor', recommended: true };
  const { host, bridge, calls, sessions } = setup({}, {
    peek: () => ({ apps: [app], stale: true }), list: async () => [fresh]
  }, async () => { await tick(); return { kind: 'native' }; });
  await runOpenExternal(host, bridge);
  assert.deepEqual(calls[0], ['picker', [app], true]);
  assert.deepEqual(sessions[0].apps, [fresh]);
  assert.equal(sessions[0].busy, false);
});

test('a failed or empty background refresh keeps the stale list without messages', async () => {
  for (const list of [async () => { throw new Error('timeout'); }, async () => []]) {
    const { host, bridge, calls, sessions } = setup({}, { peek: () => ({ apps: [app], stale: true }), list });
    assert.equal(await runOpenExternal(host, bridge), 'opened');
    assert.deepEqual(sessions[0].apps, [app]);
    assert.equal(sessions[0].hidden, false);
    assert.ok(!calls.some(c => c[0] === 'offer' || c[0] === 'error'));
  }
});

test('closing the picker leaves the query running and never reports a late result', async () => {
  let finish, signalSeen = 'unset';
  const { host, bridge, calls } = setup({}, { list: (_file, signal) => { signalSeen = signal; return new Promise(resolve => { finish = resolve; }); } },
    () => undefined);
  assert.equal(await runOpenExternal(host, bridge), 'cancelled');
  assert.equal(signalSeen, undefined, 'foreground discovery passes no signal so the query keeps running');
  finish([app]);
  await tick();
  assert.ok(!calls.some(c => c[0] === 'apps' || c[0] === 'offer' || c[0] === 'error'));
});

test('refresh queries Windows again in the same picker without repeating the save prompt', async () => {
  const fresh = { id: 'fresh-id', name: 'Fresh', recommended: true };
  let saves = 0, refreshed = false;
  const { host, bridge, calls, sessions } = setup({ prepareFile: async () => { saves++; return true; } }, {
    peek: () => ({ apps: [app], stale: false }),
    list: async (file, _signal, force) => { calls.push(['list', file, force]); return [fresh]; }
  }, async session => {
    if (!refreshed) { refreshed = true; return 'refresh'; }
    return { kind: 'app', app: session.apps[0] };
  });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.equal(saves, 1);
  assert.equal(sessions.length, 1);
  assert.deepEqual(calls.filter(c => c[0] === 'list'), [['list', target.fsPath, true]]);
});
