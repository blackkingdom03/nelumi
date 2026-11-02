const fs = require('node:fs');
const path = require('node:path');

function profilePath({ packaged, platform, executable, appData, sourceDir }) {
  if (!packaged) return path.resolve(sourceDir, '../.profile');
  // Preserve existing Windows portable/installer data. App bundles and AppImages
  // may be read-only; their profiles belong in the user's application data.
  return platform === 'win32'
    ? path.win32.join(path.win32.dirname(executable), 'data')
    : path.join(appData, 'nelumi');
}

function desktopExecArgument(value) {
  if (!value || /[\r\n\0]/.test(value)) throw new Error('启动路径无效');
  const quoted = value.replace(/%/g, '%%').replace(/[\\"`$]/g, '\\$&');
  return '"' + quoted.replace(/\\/g, '\\\\') + '"';
}

function setStartOnBoot(app, enabled, { platform = process.platform, env = process.env, executable = process.execPath } = {}) {
  if (platform !== 'linux') {
    const settings = { openAtLogin: Boolean(enabled) };
    if (platform === 'win32') {
      settings.path = executable;
      if (!app.isPackaged) settings.args = [app.getAppPath()];
    }
    app.setLoginItemSettings(settings);
    return;
  }
  const config = env.XDG_CONFIG_HOME && path.isAbsolute(env.XDG_CONFIG_HOME)
    ? env.XDG_CONFIG_HOME : path.join(app.getPath('home'), '.config');
  const file = path.join(config, 'autostart', 'nelumi.desktop');
  if (!enabled) {
    fs.rmSync(file, { force: true });
    return;
  }
  const launchPath = env.APPIMAGE || executable;
  if (launchPath.includes('=')) throw new Error('开机启动不支持路径中的等号，请移动程序后重试');
  const args = [launchPath, ...(!app.isPackaged ? [app.getAppPath()] : [])];
  const content = '[Desktop Entry]\nType=Application\nName=nelumi\nExec=' + args.map(desktopExecArgument).join(' ') + '\nTerminal=false\nX-GNOME-Autostart-enabled=true\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode: 0o600 });
}

module.exports = { profilePath, desktopExecArgument, setStartOnBoot };
