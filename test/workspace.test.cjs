const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const file = fsPath => ({ scheme: 'file', fsPath });
function scanner(t, roots, find, options = {}) {
  const calls = [];
  class TokenSource {
    token = { isCancellationRequested: false };
    cancel() { this.token.isCancellationRequested = true; }
    dispose() {}
  }
  const vscode = {
    CancellationTokenSource: TokenSource,
    RelativePattern: class { constructor(base, pattern) { this.base = base; this.pattern = pattern; } },
    workspace: {
      workspaceFolders: roots.map(uri => ({ uri })),
      getConfiguration: section => ({ get: () => options[section] ?? {} }),
      findFiles: async (include, exclude, limit, token) => {
        calls.push({ include, exclude, limit, token });
        return find(include.base.uri.fsPath, token);
      }
    }
  };
  const originalLoad = Module._load;
  Module._load = function(id, parent, ...rest) {
    if (parent?.filename.endsWith('workspace.js')) {
      if (id === 'vscode') return vscode;
      if (id === 'node:fs/promises') return { stat: async target => {
        if ((options.missing ?? []).includes(target)) throw new Error('not accessible');
        return { isFile: () => !target.endsWith('folder.pdf') };
      } };
    }
    return originalLoad.call(this, id, parent, ...rest);
  };
  let scan;
  try {
    delete require.cache[require.resolve('../dist/workspace.js')];
    scan = require('../dist/workspace.js').scanWorkspace;
  } finally { Module._load = originalLoad; }
  return { scan, calls };
}

test('scan respects exclusions, case, inaccessible files and conditional sibling rules', async t => {
  const root = 'C:\\project';
  const files = ['node_modules\\a.json', '.git\\a.txt', 'dist\\a.pdf', 'generated\\a.pdf',
    'hidden.txt', 'side.js', 'missing.pdf', 'folder.pdf', 'Report.DOCX', 'other.docx', 'good.pdf', 'plain.txt'];
  const { scan, calls } = scanner(t, [file(root)], async () => files.map(name => file(root + '\\' + name)), {
    files: { '**/hidden.txt': true, '**/*.js': { when: '$(basename).ts' } },
    search: { '**/generated/**': true },
    missing: [root + '\\missing.pdf']
  });
  assert.deepEqual(await scan(['.json', '.txt', '.pdf', '.docx', '.js'], new AbortController().signal),
    ['C:\\project\\Report.DOCX', 'C:\\project\\good.pdf', 'C:\\project\\plain.txt']);
  assert.match(calls[0].exclude, /node_modules/);
  assert.match(calls[0].exclude, /generated/);
  assert.equal(calls[0].limit, 5000);
});

test('conditional exclusions keep a file when its sibling is absent', async t => {
  const { scan } = scanner(t, [file('C:\\p')], async () => [file('C:\\p\\a.js')], {
    files: { '**/*.js': { when: '$(basename).ts' } }, missing: ['C:\\p\\a.ts']
  });
  assert.deepEqual(await scan(['.js'], new AbortController().signal), ['C:\\p\\a.js']);
});

test('scan uses one aggregate limit across local roots and skips remote folders', async t => {
  const remote = { scheme: 'vscode-remote', fsPath: '/remote' };
  const { scan, calls } = scanner(t, [remote, file('C:\\a'), file('D:\\b'), file('E:\\c')], async root =>
    Array.from({ length: root === 'C:\\a' ? 4999 : 1 }, (_, i) => file(root + '\\' + i + '.txt')));
  await scan(['.txt', '.pdf'], new AbortController().signal);
  assert.deepEqual(calls.map(call => call.limit), [5000, 1]);
});

test('cancelled search cancels the VS Code token and discards late results', async t => {
  const controller = new AbortController();
  const { scan, calls } = scanner(t, [file('C:\\p')], async (_root, token) => {
    controller.abort(); assert.equal(token.isCancellationRequested, true);
    return [file('C:\\p\\a.txt')];
  });
  await assert.rejects(scan(['.txt'], controller.signal), { name: 'AbortError' });
  assert.equal(calls.length, 1);
});
