const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeExtensions, Preloader } = require('../dist/preload.js');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('normalizes editable extensions and rejects glob or path entries', () => {
  assert.deepEqual(normalizeExtensions(['DOCX', '.docx', ' .PDF ', '', '*.py', '../txt', '.tar.gz', 'JSON', 42]), ['.docx', '.pdf', '.json']);
  assert.deepEqual(normalizeExtensions(null), []);
  assert.deepEqual(normalizeExtensions('docx'), []);
});

test('preloads one representative per type sequentially, skipping cached types', async () => {
  const calls = [];
  let active = 0, maximum = 0, scans = 0;
  const loader = new Preloader(async () => { scans++; return ['a.docx', 'b.DOCX', 'a.pdf', 'a.txt']; }, {
    getCached: file => file.endsWith('.txt') ? [{}] : undefined,
    list: async file => { active++; maximum = Math.max(maximum, active); await tick(); calls.push(file); active--; return []; }
  });
  loader.restart(['.docx', '.pdf', '.txt']);
  for (let i = 0; i < 6; i++) await tick();
  assert.deepEqual(calls, ['a.docx', 'a.pdf']);
  assert.equal(maximum, 1);
  assert.equal(scans, 1);
  loader.resume(); await tick();
  assert.equal(scans, 1, 'completed preload does not periodically refresh');
  loader.dispose();
});

test('foreground pause aborts and drains discovery; resume retries remaining types', async () => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const calls = [];
  let first = true, drained = false;
  const loader = new Preloader(async () => ['a.docx', 'a.pdf'], {
    getCached: () => undefined,
    list: async (file, signal) => {
      calls.push(file);
      if (!first) return [];
      first = false; started();
      await new Promise((_resolve, reject) => signal.addEventListener('abort', async () => {
        await tick(); drained = true; reject(signal.reason);
      }, { once: true }));
    }
  });
  loader.restart(['.docx', '.pdf']); await ready;
  await loader.pause();
  assert.equal(drained, true);
  assert.deepEqual(calls, ['a.docx']);
  loader.resume(); await tick(); await tick();
  assert.deepEqual(calls, ['a.docx', 'a.docx', 'a.pdf']);
  loader.dispose();
});

test('an obsolete scan cannot launch discovery after settings change or disposal', async () => {
  let finish;
  const calls = [];
  const loader = new Preloader(async () => new Promise(resolve => { finish = resolve; }), {
    getCached: () => undefined, list: async file => { calls.push(file); return []; }
  });
  loader.restart(['.docx']); await tick();
  loader.restart([]); finish(['a.docx']); await tick(); await tick();
  assert.deepEqual(calls, []);
  loader.restart(['.pdf']); await tick();
  loader.dispose(); finish(['a.pdf']); await tick(); await tick();
  assert.deepEqual(calls, []);
});

test('background failures are quiet and do not stop the next format', async () => {
  const calls = [];
  const loader = new Preloader(async () => ['a.pdf', 'a.txt'], {
    getCached: () => undefined,
    list: async file => { calls.push(file); throw new Error('policy blocked'); }
  });
  loader.restart(['.pdf', '.txt']); await tick(); await tick();
  assert.deepEqual(calls, ['a.pdf', 'a.txt']);
  loader.dispose();
});
