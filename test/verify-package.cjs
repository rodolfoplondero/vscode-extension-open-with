// Run against the extension/ directory extracted from a VSIX, outside the repo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(process.argv[2]);
const manifest = require(path.join(root, 'package.json'));
assert.equal(manifest.version, '0.1.7');
assert.equal(manifest.publisher + '.' + manifest.name, 'local-tools.abrir-com-externo');
assert.ok(manifest.activationEvents.includes('onStartupFinished'));
const settings = manifest.contributes.configuration.properties;
assert.equal(settings['openWithExternal.preloadEnabled'].default, true);
assert.equal(settings['openWithExternal.cacheDurationMinutes'].default, 5);
assert.deepEqual(settings['openWithExternal.preloadExtensions'].default,
  require(path.join(root, 'dist/preload.js')).defaultPreloadExtensions);
const packageRequire = Module.createRequire(path.join(root, 'dist/workspace.js'));
assert.ok(packageRequire.resolve('minimatch').startsWith(root + path.sep));
for (const name of ['test', 'docs', 'TRACKER.md', 'node_modules/typescript']) {
  assert.equal(fs.existsSync(path.join(root, name)), false, `Development file shipped: ${name}`);
}
const noOpSubscription = () => ({ dispose() {} });
const vscode = {
  workspace: {
    workspaceFolders: [],
    getConfiguration: () => ({ get: (key, fallback) => key === 'preloadEnabled' ? false : fallback }),
    onDidChangeWorkspaceFolders: noOpSubscription,
    onDidChangeConfiguration: noOpSubscription
  },
  commands: { registerCommand: noOpSubscription }, window: {}
};
const originalLoad = Module._load;
Module._load = function(id, parent, isMain) {
  if (id === 'vscode') return vscode;
  return originalLoad.call(this, id, parent, isMain);
};
try {
  const context = { extensionPath: root, subscriptions: [] };
  require(path.join(root, 'dist/extension.js')).activate(context);
  context.subscriptions.forEach(item => item.dispose());
} finally { Module._load = originalLoad; }
console.log('Isolated VSIX: settings verified; activation succeeded with mocked VS Code API; production dependencies resolved inside package.');
