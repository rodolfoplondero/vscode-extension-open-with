const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { WindowsBridge, createPowerShellRunner } = require('../dist/windows.js');

test('cache shares results by case-insensitive extension until the configured TTL expires', async () => {
  let now = 0, queries = 0;
  const bridge = new WindowsBridge('', async () => { queries++; return '[{"id":"C:\\\\WINWORD.EXE","name":"Word","recommended":true}]'; }, () => 5, () => now);
  await bridge.list('C:\\one.docx');
  now = 299999;
  await bridge.list('D:\\two.DOCX');
  assert.equal(queries, 1);
  now = 300000;
  await bridge.list('C:\\three.docx');
  assert.equal(queries, 2);
  await bridge.list('C:\\other.txt');
  assert.equal(queries, 3);
});

test('zero minutes disables cache; changing the interval changes expiry', async () => {
  let minutes = 0, queries = 0, now = 0;
  const bridge = new WindowsBridge('', async () => { queries++; return '[{"id":"editor","name":"Editor","recommended":true}]'; }, () => minutes, () => now);
  await bridge.list('a.txt'); await bridge.list('b.txt');
  assert.equal(queries, 2);
  minutes = 2;
  await bridge.list('a.txt'); await bridge.list('b.txt');
  assert.equal(queries, 3);
  minutes = 1; now = 60000;
  await bridge.list('a.txt');
  assert.equal(queries, 4);
});

test('empty lists, failed queries and extensionless files are not cached', async () => {
  let queries = 0;
  const bridge = new WindowsBridge('', async () => { queries++; if (queries === 1) throw new Error('blocked'); return '[]'; }, () => 5);
  await assert.rejects(bridge.list('a.txt'), /blocked/);
  await bridge.list('a.txt'); await bridge.list('b.txt');
  assert.equal(queries, 3);
  assert.equal(bridge.getCached('a.txt'), undefined);
  const extensionless = new WindowsBridge('', async () => '[{"id":"editor","name":"Editor","recommended":true}]', () => 5);
  await extensionless.list('README');
  assert.equal(extensionless.getCached('LICENSE'), undefined);
});

test('launch errors and manual invalidation clear only the relevant format; settings clear all', async () => {
  const bridge = new WindowsBridge('', async request => {
    if (request.action === 'open') throw new Error('removed');
    return '[{"id":"editor","name":"Editor","recommended":true}]';
  }, () => 5);
  await bridge.list('a.txt'); await bridge.list('a.pdf');
  await assert.rejects(bridge.open('a.txt', 'editor'), /removed/);
  assert.equal(bridge.getCached('a.txt'), undefined);
  assert.ok(bridge.getCached('a.pdf'));
  bridge.invalidate('other.PDF');
  assert.equal(bridge.getCached('a.pdf'), undefined);
  await bridge.list('a.txt');
  bridge.clearCache();
  assert.equal(bridge.getCached('a.txt'), undefined);
  await bridge.list('a.pdf');
  await bridge.native('a.pdf');
  assert.equal(bridge.getCached('a.pdf'), undefined);
});

test('discovery passes cancellation to the process and rejects on abort', async () => {
  const controller = new AbortController();
  const runner = createPowerShellRunner('/extension', (_exe, _args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    options.signal.addEventListener('abort', () => {
      child.emit('error', Object.assign(new Error('aborted'), { name: 'AbortError' }));
      setImmediate(() => child.emit('close', null, 'SIGTERM'));
    });
    child.stdin.on('finish', () => controller.abort());
    return child;
  });
  await assert.rejects(new WindowsBridge('', runner).list('C:\\file.txt', controller.signal), { name: 'AbortError' });
});

test('cancellation waits for process close before permitting another query', async () => {
  const controller = new AbortController();
  let child, settled = false;
  const runner = createPowerShellRunner('', (_exe, _args, options) => {
    child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    options.signal.addEventListener('abort', () => child.emit('error', Object.assign(new Error('aborted'), { name: 'AbortError' })));
    return child;
  });
  const pending = runner({ action: 'list', filePath: 'a.txt' }, controller.signal).finally(() => { settled = true; });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  child.emit('close', null, 'SIGTERM');
  await rejected;
});

test('discovery ignores a result arriving after cancellation', async () => {
  const controller = new AbortController();
  const bridge = new WindowsBridge('', async () => {
    controller.abort(); return '[{"id":"editor","name":"Editor","recommended":true}]';
  }, () => 5);
  await assert.rejects(bridge.list('C:\\file.txt', controller.signal), { name: 'AbortError' });
  assert.equal(bridge.getCached('C:\\file.txt'), undefined);
});

test('transports Unicode paths and metacharacters as JSON without a shell', async () => {
  let invocation, input = '';
  const fakeSpawn = (exe, args, options) => {
    invocation = { exe, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.stdin.on('data', chunk => { input += chunk; });
    child.stdin.on('finish', () => { child.stdout.write('\uFEFF[]'); child.emit('close', 0); });
    return child;
  };
  const filePath = 'C:\\My files\\café & $(calc); [test] "x".txt';
  const runner = createPowerShellRunner('C:\\Extension café', fakeSpawn);
  assert.equal(await runner({ action: 'list', filePath }), '[]');
  assert.deepEqual(JSON.parse(input), { action: 'list', filePath });
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.windowsHide, true);
  assert.ok(invocation.args.includes('-Sta'));
  assert.ok(!invocation.args.some(arg => arg.includes(filePath)));
});

test('lists only recommended applications and deduplicates IDs', async () => {
  const apps = [
    { id: 'b', name: 'Zeditor', recommended: false },
    { id: 'a', name: 'Editor', recommended: true },
    { id: 'a', name: 'Editor', recommended: true },
    { id: 'c', name: 'Editor', recommended: false }
  ];
  const bridge = new WindowsBridge('/extension', async () => JSON.stringify(apps));
  assert.deepEqual((await bridge.list('C:\\a.txt')).map(x => x.id), ['a']);
});

test('accepts empty lists and rejects invalid responses instead of hiding failures', async () => {
  assert.deepEqual(await new WindowsBridge('', async () => '[]').list('x'), []);
  for (const response of ['{}', 'null', 'oops', '[{"id":"x"}]']) {
    await assert.rejects(new WindowsBridge('', async () => response).list('x'), /response/i);
  }
});

test('sends handler IDs as data and distinguishes opening from the native dialog', async () => {
  const calls = [];
  const bridge = new WindowsBridge('', async request => { calls.push(request); return '{}'; });
  await bridge.open('C:\\file.txt', 'handler & special');
  await bridge.native('C:\\file.txt');
  assert.deepEqual(calls, [
    { action: 'open', filePath: 'C:\\file.txt', handlerId: 'handler & special' },
    { action: 'native', filePath: 'C:\\file.txt' }
  ]);
});

test('propagates PowerShell errors', async () => {
  const bridge = new WindowsBridge('', async () => { throw new Error('timeout'); });
  await assert.rejects(bridge.list('x'), /timeout/);
});

test('transport reports unavailable processes and exit codes with stderr', async () => {
  for (const mode of ['error', 'close']) {
    const runner = createPowerShellRunner('/extension', () => {
      const child = new EventEmitter();
      child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
      child.stdin.on('finish', () => {
        if (mode === 'error') child.emit('error', new Error('ENOENT'));
        else { child.stderr.write('handler removed'); child.emit('close', 1); }
      });
      return child;
    });
    await assert.rejects(runner({ action: 'list', filePath: 'x' }), mode === 'error' ? /ENOENT/ : /handler removed/);
  }
});

test('limits queries to 30 seconds and lets the native dialog wait for user input', async () => {
  const timeouts = [];
  const runner = createPowerShellRunner('/extension', (_exe, _args, options) => {
    timeouts.push(options.timeout);
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.stdin.on('finish', () => child.emit('close', 0));
    return child;
  });
  await runner({ action: 'list', filePath: 'x' });
  await runner({ action: 'open', filePath: 'x', handlerId: 'a' });
  await runner({ action: 'native', filePath: 'x' });
  assert.deepEqual(timeouts, [30000, 30000, 0]);
});

test('a process terminated by timeout produces a clear error', async () => {
  const runner = createPowerShellRunner('/extension', () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.stdin.on('finish', () => child.emit('close', null, 'SIGTERM'));
    return child;
  });
  await assert.rejects(runner({ action: 'list', filePath: 'x' }), /30 seconds/);
});

test('oversized responses terminate the process and are rejected', async () => {
  let killed = false;
  const runner = createPowerShellRunner('/extension', () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => { killed = true; return true; };
    child.stdin.on('finish', () => child.stdout.write('a'.repeat(4 * 1024 * 1024 + 1)));
    return child;
  });
  await assert.rejects(runner({ action: 'list', filePath: 'x' }), /limit/);
  assert.equal(killed, true);
});


test('nonrecommended generic programs are not listed as supported', async () => {
  const bridge = new WindowsBridge('', async () => JSON.stringify([
    { id: 'generic.exe', name: 'Generic application', recommended: false }
  ]));
  assert.deepEqual(await bridge.list('C:\\image.png'), []);
});

test('DOCX excludes generic programs even when Windows recommends them', async () => {
  const apps = [
    { id: 'C:\\Windows\\notepad.exe', name: 'Notepad', recommended: true },
    { id: 'C:\\Office\\WINWORD.EXE', name: 'Word', recommended: true },
    { id: 'C:\\Apps\\Code.exe', name: 'Visual Studio Code', recommended: true },
    { id: 'C:\\PowerShell\\pwsh.exe', name: 'PowerShell 7', recommended: true },
    { id: 'ChatGPT', name: 'ChatGPT', recommended: true },
    { id: 'C:\\Apps\\VSLauncher.exe', name: 'Microsoft Visual Studio Version Selector', recommended: true },
    { id: 'C:\\Apps\\UiPath.Studio.exe', name: 'UiPath Studio', recommended: true },
    { id: 'C:\\Apps\\vlc.exe', name: 'VLC media player', recommended: true },
    { id: 'C:\\LibreOffice\\program\\soffice.exe', name: 'LibreOffice', recommended: true }
  ];
  const bridge = new WindowsBridge('', async () => JSON.stringify(apps));
  assert.deepEqual((await bridge.list('C:\\REPORT.DOCX')).map(app => app.name).sort(), ['LibreOffice', 'Word']);
});

test('DOCX without a recognized document editor produces an empty list', async () => {
  const bridge = new WindowsBridge('', async () => JSON.stringify([
    { id: 'C:\\Windows\\notepad.exe', name: 'Word', recommended: true }
  ]));
  assert.deepEqual(await bridge.list('C:\\report.docx'), []);
});

test('DOCX recognizes supported office suites by executable identity', async () => {
  const ids = ['WINWORD.EXE', 'swriter.exe', 'soffice.exe', 'wps.exe', 'DesktopEditors.exe', 'textmaker.exe'];
  const bridge = new WindowsBridge('', async () => JSON.stringify(ids.map(id => ({
    id: `C:\\Apps\\${id}`, name: id, recommended: true
  }))));
  assert.equal((await bridge.list('C:\\report.docx')).length, ids.length);
});

test('DOCX rejects direct opening with a generic handler before launching it', async () => {
  let launched = false;
  const bridge = new WindowsBridge('', async () => { launched = true; return '{}'; });
  await assert.rejects(bridge.open('C:\\report.docx', 'C:\\Windows\\notepad.exe'), /DOCX/);
  assert.equal(launched, false);
});

test('other file types retain their registered recommended handlers', async () => {
  const app = { id: 'C:\\Windows\\notepad.exe', name: 'Notepad', recommended: true };
  const bridge = new WindowsBridge('', async () => JSON.stringify([app]));
  assert.deepEqual(await bridge.list('C:\\notes.txt'), [app]);
});

test('peek returns an expired list marked stale; getCached returns only fresh lists', async () => {
  let now = 0;
  const bridge = new WindowsBridge('', async () => '[{"id":"editor","name":"Editor","recommended":true}]', () => 5, () => now);
  assert.equal(bridge.peek('a.txt'), undefined);
  await bridge.list('a.txt');
  assert.equal(bridge.peek('A.TXT').stale, false);
  now = 300000;
  assert.equal(bridge.peek('b.txt').stale, true);
  assert.equal(bridge.peek('b.txt').apps[0].name, 'Editor');
  assert.equal(bridge.getCached('b.txt'), undefined);
  bridge.invalidate('b.txt');
  assert.equal(bridge.peek('b.txt'), undefined);
});

test('zero minutes keeps no list, fresh or stale', async () => {
  const bridge = new WindowsBridge('', async () => '[{"id":"editor","name":"Editor","recommended":true}]', () => 0);
  await bridge.list('a.txt');
  assert.equal(bridge.peek('a.txt'), undefined);
});

test('force queries again even when the list is fresh', async () => {
  let queries = 0;
  const bridge = new WindowsBridge('', async () => { queries++; return '[{"id":"editor","name":"Editor","recommended":true}]'; }, () => 5);
  await bridge.list('a.txt'); await bridge.list('a.txt');
  assert.equal(queries, 1);
  await bridge.list('a.txt', undefined, true);
  assert.equal(queries, 2);
});

test('concurrent calls for one format share a single Windows query', async () => {
  let queries = 0, finish;
  const bridge = new WindowsBridge('', () => { queries++; return new Promise(resolve => { finish = resolve; }); }, () => 0);
  const first = bridge.list('a.txt'), second = bridge.list('B.TXT');
  finish('[{"id":"editor","name":"Editor","recommended":true}]');
  assert.deepEqual((await first).map(a => a.id), (await second).map(a => a.id));
  assert.equal(queries, 1);
});

test('an aborting caller rejects at once; the query continues while another caller waits without a signal', async () => {
  let finish, processSignal;
  const bridge = new WindowsBridge('', (_request, signal) => { processSignal = signal; return new Promise(resolve => { finish = resolve; }); }, () => 5);
  const controller = new AbortController();
  const aborting = bridge.list('a.txt', controller.signal);
  const keeping = bridge.list('a.txt');
  controller.abort();
  await assert.rejects(aborting, { name: 'AbortError' });
  assert.equal(processSignal.aborted, false);
  finish('[{"id":"editor","name":"Editor","recommended":true}]');
  assert.equal((await keeping).length, 1);
  assert.equal(bridge.getCached('a.txt').length, 1);
});

test('the query stops once every caller with a signal has aborted and the next call starts a new query', async () => {
  let queries = 0, processSignal;
  const bridge = new WindowsBridge('', (_request, signal) => { queries++; processSignal = signal; return new Promise(() => {}); }, () => 5);
  const controller = new AbortController();
  const pending = bridge.list('a.txt', controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(processSignal.aborted, true);
  bridge.list('a.txt').catch(() => {});
  assert.equal(queries, 2);
});

test('a forced refresh starts a new query instead of joining one that started earlier', async () => {
  let queries = 0;
  const finishers = [];
  const bridge = new WindowsBridge('', () => { queries++; return new Promise(resolve => finishers.push(resolve)); }, () => 5);
  const older = bridge.list('a.txt');
  const refreshed = bridge.list('a.txt', undefined, true);
  assert.equal(queries, 2);
  finishers[0]('[{"id":"old","name":"Old","recommended":true}]');
  finishers[1]('[{"id":"new","name":"New","recommended":true}]');
  assert.equal((await older)[0].id, 'old');
  assert.equal((await refreshed)[0].id, 'new');
  assert.equal(bridge.getCached('a.txt')[0].id, 'new');
});

test('a query finishing after invalidate or clearCache does not refill the cache', async () => {
  for (const reset of [bridge => bridge.invalidate('a.txt'), bridge => bridge.clearCache()]) {
    let finish;
    const bridge = new WindowsBridge('', () => new Promise(resolve => { finish = resolve; }), () => 5);
    const pending = bridge.list('a.txt');
    reset(bridge);
    finish('[{"id":"editor","name":"Editor","recommended":true}]');
    await pending;
    assert.equal(bridge.peek('a.txt'), undefined);
  }
});
