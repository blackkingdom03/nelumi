const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const arch = process.argv[2] || process.arch;
let executable;
if (process.platform === 'win32') executable = path.resolve('release', arch === 'x64' ? 'win-unpacked' : `win-${arch}-unpacked`, 'nelumi.exe');
else if (process.platform === 'darwin') executable = path.resolve('release', arch === 'x64' ? 'mac' : `mac-${arch}`, 'nelumi.app/Contents/MacOS/nelumi');
else executable = path.resolve('release/linux-unpacked/nelumi');
if (!fs.existsSync(executable)) throw Error(`Missing packaged executable: ${executable}`);
const env = { ...process.env, NELUMI_RELEASE_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(executable, ['--nelumi-release-test', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], {
  env,
  encoding: 'utf8', timeout: 150000, windowsHide: true, maxBuffer: 4 * 1024 * 1024
});
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
if (result.status !== 0 || !result.stdout.includes('NELUMI_RELEASE_TEST_OK')) process.exit(1);
