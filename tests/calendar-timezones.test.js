const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('date-only Chinese calendar labels remain on the same civil day in east and west timezones', () => {
  const source = `const C=require('./src/chinese-calendar');console.log(JSON.stringify([
    C.getDayInfo('2026-02-17').festival,
    C.getDayInfo('2026-07-29').lunarDayText,
    C.getDayInfo('2026-01-01').holiday?.badge,
    C.getDayInfo('2026-04-05').solarTerm
  ]));`;
  for (const TZ of ['Asia/Shanghai', 'UTC', 'America/Los_Angeles', 'Pacific/Honolulu']) {
    const result = execFileSync(process.execPath, ['-e', source], {
      cwd: path.resolve(__dirname, '..'), env: { ...process.env, TZ }, encoding: 'utf8'
    });
    assert.deepEqual(JSON.parse(result), ['春节', '十六', '休', '清明'], TZ);
  }
});
