const test = require('node:test');
const assert = require('node:assert/strict');
const { getDayInfo, getHolidaySchedule } = require('../src/chinese-calendar');

// Independently transcribed from 国办发明电〔2025〕7号:
// https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202511/t20251104_4258838.html
const holidays = [
  '01-01','01-02','01-03',
  '02-15','02-16','02-17','02-18','02-19','02-20','02-21','02-22','02-23',
  '04-04','04-05','04-06',
  '05-01','05-02','05-03','05-04','05-05',
  '06-19','06-20','06-21',
  '09-25','09-26','09-27',
  '10-01','10-02','10-03','10-04','10-05','10-06','10-07'
];
const workdays = ['01-04','02-14','02-28','05-09','09-20','10-10'];

test('all 365 days match the official 2026 Chinese holiday and makeup-workday table', () => {
  assert.equal(holidays.length, 33);
  assert.equal(workdays.length, 6);
  const expected = new Map([
    ...holidays.map(date => [`2026-${date}`, 'holiday']),
    ...workdays.map(date => [`2026-${date}`, 'workday'])
  ]);
  assert.equal(Object.keys(getHolidaySchedule(2026).days).length, 39);
  const date = new Date(2026, 0, 1, 12);
  let count = 0;
  while (date.getFullYear() === 2026) {
    const key = `2026-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const info = getDayInfo(date);
    assert.equal(info.holiday?.type, expected.get(key), key);
    if (expected.get(key) === 'holiday') {
      assert.equal(info.holiday.badge, '休', key);
      assert.equal(info.isRestDay, true, key);
    } else if (expected.get(key) === 'workday') {
      assert.equal(info.holiday.badge, '班', key);
      assert.equal(info.isRestDay, false, key);
    }
    date.setDate(date.getDate() + 1);
    count++;
  }
  assert.equal(count, 365);
});

test('future-year lunar dates work without inventing an official holiday schedule', () => {
  assert.equal(getHolidaySchedule(2027), null);
  assert.ok(getDayInfo(new Date(2027, 1, 6, 12)).lunarDayText);
});
