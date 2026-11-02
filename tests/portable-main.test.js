const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function launch({ packaged = false, lock = true, fail = false, readOnly = false } = {}) {
  const calls = { paths: {}, loaded: false, quit: false, error: false };
  const app = {
    isPackaged: packaged,
    setPath: (name, value) => { calls.paths[name] = value; },
    requestSingleInstanceLock: () => lock,
    quit: () => { calls.quit = true; },
    on: () => {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/portable-main.js'), 'utf8'), {
    __dirname: path.resolve(__dirname, '../src'),
    process: { execPath: path.resolve('release/win-unpacked/nelumi.exe') },
    require(name) {
      if (name === 'electron') return { app, BrowserWindow: { getAllWindows: () => [] }, dialog: { showErrorBox: () => { calls.error = true; } } };
      if (name === 'node:fs') return {
        mkdirSync() { if (fail) throw new Error('read only'); },
        writeFileSync() { if (readOnly) throw new Error('EACCES: existing directory is not writable'); },
        unlinkSync() {}
      };
      if (name === 'node:path') return path;
      if (name === './main') { calls.loaded = true; return {}; }
      throw new Error(`Unexpected import: ${name}`);
    }
  });
  return calls;
}

test('portable profile stays alongside the executable, separate from upstream DeskCal', () => {
  const result = launch({ packaged: true });
  assert.equal(result.paths.userData, path.resolve('release/win-unpacked/data'));
  assert.equal(result.paths.sessionData, result.paths.userData);
  assert.equal(result.loaded, true);
});
test('development profile stays inside the D-drive project', () => {
  assert.equal(launch().paths.userData, path.resolve(__dirname, '../.profile'));
});
test('second launch does not open another writer', () => {
  const result = launch({ lock: false });
  assert.equal(result.loaded, false);
  assert.equal(result.quit, true);
});
test('unwritable portable folder reports an error without falling back to upstream data', () => {
  const result = launch({ fail: true });
  assert.equal(result.error, true);
  assert.equal(result.loaded, false);
  assert.equal(result.quit, true);
});
test('existing but unwritable data directory shows an error before loading main', () => {
  const result = launch({ readOnly: true });
  assert.equal(result.error, true);
  assert.equal(result.loaded, false);
  assert.equal(result.quit, true);
});
