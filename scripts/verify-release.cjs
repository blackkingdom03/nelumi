const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const version = require('../package.json').version;
const folder = process.argv[2];
const expected = [
  ...['x64', 'arm64'].flatMap(arch => [`nelumi-${version}-windows-${arch}-setup.exe`, `nelumi-${version}-windows-${arch}.zip`, `nelumi-${version}-macos-${arch}.dmg`]),
  `nelumi-${version}-linux-x64.AppImage`, `nelumi-${version}-linux-x64.deb`
].sort();
assert.deepEqual(fs.readdirSync(folder).sort(), expected, 'Expected exactly eight device download packages');
for (const file of expected) assert.ok(fs.statSync(path.join(folder, file)).size > 30_000_000, `Package too small: ${file}`);
console.log('Verified eight release packages.');
