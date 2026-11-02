const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { profilePath, desktopExecArgument, setStartOnBoot } = require('../src/platform-support');

test('packaged profiles preserve Windows data and stay outside read-only app bundles', () => {
  assert.equal(profilePath({ packaged: true, platform: 'win32', executable: 'D:\\Apps\\nelumi\\nelumi.exe' }), 'D:\\Apps\\nelumi\\data');
  for (const platform of ['darwin', 'linux']) {
    assert.equal(profilePath({ packaged: true, platform, appData: '/user/config', executable: '/read-only/nelumi' }), path.join('/user/config', 'nelumi'));
  }
  assert.equal(profilePath({ packaged: false, sourceDir: __dirname }), path.resolve(__dirname, '../.profile'));
});

test('Linux autostart uses the durable AppImage path and removes only its own entry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nelumi-autostart-'));
  try {
    const app = { isPackaged: true, getPath: () => dir };
    const options = { platform: 'linux', executable: '/tmp/.mount/run', env: { XDG_CONFIG_HOME: dir, APPIMAGE: '/home/test/My Calendar.AppImage' } };
    setStartOnBoot(app, true, options);
    const file = path.join(dir, 'autostart', 'nelumi.desktop');
    assert.match(fs.readFileSync(file, 'utf8'), /Exec="\/home\/test\/My Calendar.AppImage"\n/);
    const other = path.join(dir, 'autostart', 'other.desktop');
    fs.writeFileSync(other, 'keep');
    setStartOnBoot(app, false, options);
    assert.equal(fs.existsSync(file), false);
    assert.equal(fs.readFileSync(other, 'utf8'), 'keep');
    assert.throws(() => desktopExecArgument('a\nExec=bad'));
    assert.equal(desktopExecArgument('/tmp/100%'), '"/tmp/100%%"');
    assert.equal(desktopExecArgument('/tmp/$x'), '"/tmp/\\\\$x"');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('native login settings use only options supported by each platform', () => {
  let result;
  const app = { isPackaged: false, getAppPath: () => '/source', setLoginItemSettings: value => { result = value; } };
  setStartOnBoot(app, true, { platform: 'darwin' });
  assert.deepEqual(result, { openAtLogin: true });
  setStartOnBoot(app, true, { platform: 'win32', executable: 'electron.exe' });
  assert.deepEqual(result, { openAtLogin: true, path: 'electron.exe', args: ['/source'] });
});
