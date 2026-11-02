const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// This edition owns its profile; it never reads or overwrites upstream DeskCal data.
const smokeTest = process.env.NELUMI_RELEASE_TEST === '1' && process.argv.includes('--nelumi-release-test');
const profile = smokeTest ? fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'nelumi-release-test-')) : require('./platform-support').profilePath({
  packaged: app.isPackaged, platform: process.platform,
  executable: process.execPath, appData: app.getPath('appData'), sourceDir: __dirname
});

let profileReady = false;
try {
  fs.mkdirSync(profile, { recursive: true });
  // mkdir succeeds for existing read-only directories; verify an actual write.
  const probe = path.join(profile, `.write-check-${process.pid}-${Date.now()}`);
  fs.writeFileSync(probe, '', { flag: 'wx' });
  fs.unlinkSync(probe);
  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
  profileReady = true;
} catch (error) {
  dialog.showErrorBox('nelumi 无法保存数据', `请检查以下数据目录的写入权限后再启动。\n${profile}\n${error.message}`);
  app.quit();
}

if (profileReady) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    if (smokeTest) require('./release-smoke').install(profile);
    require('./main');
  }
}
