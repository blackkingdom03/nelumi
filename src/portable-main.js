const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// This edition owns its profile; it never reads or overwrites upstream DeskCal data.
const profile = app.isPackaged
  ? path.join(path.dirname(process.execPath), 'data')
  : path.resolve(__dirname, '../.profile');

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
  dialog.showErrorBox('nelumi 无法保存数据', `请将整个程序文件夹放到可写目录后再启动。\n${profile}\n${error.message}`);
  app.quit();
}

if (profileReady) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    require('./main');
  }
}
