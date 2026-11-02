const test = require('node:test');
const assert = require('node:assert/strict');
const { occursOn, parseDate, dateKey, addDays } = require('../src/calendar-core');
const {
  shiftTimeRange,
  timeRangesOverlap,
  conflictsForCandidate,
  applyOccurrenceChange
} = require('../src/planner-core');

test('时间段相交检测允许首尾相接但阻止重叠', () => {
  assert.equal(
    timeRangesOverlap(
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '09:30', endTime: '10:30' }
    ),
    true
  );
  assert.equal(
    timeRangesOverlap(
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '10:00', endTime: '11:00' }
    ),
    false
  );
});

test('全天日程不参与时间冲突', () => {
  assert.equal(
    timeRangesOverlap(
      { allDay: true, startTime: '', endTime: '' },
      { startTime: '09:00', endTime: '10:00' }
    ),
    false
  );
});

test('冲突检测支持重复日程并排除自身', () => {
  const events = [
    {
      id: 'weekly',
      date: '2026-07-29',
      startTime: '10:00',
      endTime: '11:00',
      recurrence: { frequency: 'weekly', interval: 1 }
    }
  ];
  const candidate = {
    id: 'candidate',
    date: '2026-08-05',
    startTime: '10:30',
    endTime: '11:30'
  };
  assert.equal(conflictsForCandidate(candidate, events, candidate.date).length, 1);
  assert.equal(conflictsForCandidate(candidate, events, candidate.date, 'weekly').length, 0);
});

test('时间位移保留时长并限制在当天', () => {
  assert.deepEqual(shiftTimeRange('09:00', '10:30', 30), {
    startTime: '09:30',
    endTime: '11:00'
  });
  assert.deepEqual(shiftTimeRange('23:00', '23:45', 120), {
    startTime: '23:14',
    endTime: '23:59'
  });
});

test('仅修改本次会生成独立日程并在原系列增加例外', () => {
  const event = {
    id: 'series',
    title: '周会',
    date: '2026-07-29',
    recurrence: { frequency: 'weekly', interval: 1, until: null, count: null },
    exceptions: []
  };
  const result = applyOccurrenceChange(
    event,
    '2026-08-05',
    { title: '临时周会', startTime: '11:00' },
    'occurrence',
    () => 'detached',
    new Date('2026-07-29T08:00:00.000Z')
  );
  assert.deepEqual(result.original.exceptions, ['2026-08-05']);
  assert.equal(result.detached.id, 'detached');
  assert.equal(result.detached.date, '2026-08-05');
  assert.equal(result.detached.recurrence.frequency, 'none');
});

test('修改本次及以后会截断原系列并创建新系列', () => {
  const event = {
    id: 'series',
    title: '周会',
    date: '2026-07-29',
    recurrence: { frequency: 'weekly', interval: 1, until: null, count: null },
    exceptions: []
  };
  const result = applyOccurrenceChange(
    event,
    '2026-08-12',
    { startTime: '14:00', endTime: '15:00' },
    'future',
    () => 'future-series'
  );
  assert.equal(result.original.recurrence.until, '2026-08-11');
  assert.equal(result.detached.id, 'future-series');
  assert.equal(result.detached.date, '2026-08-12');
  assert.equal(result.detached.recurrence.frequency, 'weekly');
});

for (const fixture of [
  { frequency: 'daily', interval: 1, count: 3, split: '2026-10-24', remaining: 2, exceptions: [] },
  { frequency: 'daily', interval: 2, count: 4, split: '2026-10-27', remaining: 2, exceptions: ['2026-10-25'] },
  { frequency: 'weekly', interval: 2, count: 4, split: '2026-11-06', remaining: 3, exceptions: ['2026-11-20'] }
]) {
  test(`修改有限重复日程的以后笔记保留原发生日期：${fixture.frequency}/${fixture.interval}`, () => {
    const event = {
      id: 'finite-series', title: '会议', date: '2026-10-23', notes: '旧笔记', sourceText: '原通知',
      startTime: '09:00', endTime: '10:00', reminders: [10], exceptions: fixture.exceptions,
      recurrence: { frequency: fixture.frequency, interval: fixture.interval, count: fixture.count, until: null }
    };
    const result = applyOccurrenceChange(event, fixture.split,
      { notes: '以后使用新笔记', sourceText: '原通知\n补充通知' }, 'future', () => 'split');
    assert.equal(result.detached.recurrence.count, fixture.remaining);
    const dates = Array.from({ length: 100 }, (_, offset) => addDays(parseDate(event.date), offset));
    const previousDates = dates.filter(date => occursOn(event, date)).map(dateKey);
    const currentDates = dates.filter(date => occursOn(result.original, date) || occursOn(result.detached, date)).map(dateKey);
    assert.deepEqual(currentDates, previousDates, 'metadata edits must neither remove occurrences nor extend the recurrence');
    for (const date of dates.filter(date => occursOn(event, date))) {
      const occurrence = dateKey(date) < fixture.split ? result.original : result.detached;
      assert.equal(occurrence.notes, dateKey(date) < fixture.split ? '旧笔记' : '以后使用新笔记');
      assert.equal(occurrence.sourceText, dateKey(date) < fixture.split ? '原通知' : '原通知\n补充通知');
      assert.equal(occurrence.startTime, event.startTime);
      assert.equal(occurrence.endTime, event.endTime);
      assert.deepEqual(occurrence.reminders, event.reminders);
    }
  });
}

test('未来拆分保留未改变的完整重复设置中的剩余次数，并允许显式修改次数', () => {
  const event = { id: 'weekly', date: '2026-10-23', recurrence: { frequency: 'weekly', interval: 2, count: 4 } };
  const same = applyOccurrenceChange(event, '2026-11-06', { notes: '新笔记', recurrence: { ...event.recurrence } }, 'future', () => 'same');
  assert.equal(same.detached.recurrence.count, 3);
  const changed = applyOccurrenceChange(event, '2026-11-06', { recurrence: { ...event.recurrence, count: 2 } }, 'future', () => 'changed');
  assert.equal(changed.detached.recurrence.count, 2);
  assert.equal(occursOn(changed.detached, parseDate('2026-11-20')), true);
  assert.equal(occursOn(changed.detached, parseDate('2026-12-04')), false);
});
