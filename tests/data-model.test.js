const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SCHEMA_VERSION,
  DEFAULT_CALENDAR_ID,
  normalizeEvent,
  normalizeEvents,
  normalizeCalendars,
  migrateData
} = require('../src/data-model');

const NOW = new Date('2026-07-29T08:00:00.000Z');

test('旧版数据自动迁移到当前结构且保留原日程', () => {
  const migrated = migrateData(
    {
      events: [
        {
          id: 'legacy-1',
          title: '旧日程',
          date: '2026-07-29',
          startTime: '09:00',
          endTime: '10:00',
          repeat: 'weekly',
          reminders: [10]
        }
      ],
      settings: { theme: 'dark' }
    },
    NOW
  );
  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.events.length, 1);
  assert.equal(migrated.events[0].recurrence.frequency, 'weekly');
  assert.equal(migrated.events[0].calendarId, DEFAULT_CALENDAR_ID);
  assert.equal(migrated.settings.theme, 'dark');
  assert.equal(migrated.settings.showLunar, true);
  assert.equal(migrated.settings.showOfficialHolidays, true);
  assert.equal(migrated.settings.highlightWeekends, true);
  assert.ok(migrated.calendars.some((calendar) => calendar.id === DEFAULT_CALENDAR_ID));
});

test('日历规范化会去重并确保默认个人日历存在', () => {
  const calendars = normalizeCalendars(
    [
      { id: 'work', name: '工作', color: '#123456', visible: true },
      { id: 'work', name: '重复工作', color: '#ffffff' },
      { id: '', name: '无效' }
    ],
    NOW
  );
  assert.equal(calendars.filter((calendar) => calendar.id === 'work').length, 1);
  assert.ok(calendars.some((calendar) => calendar.id === DEFAULT_CALENDAR_ID));
});

test('日程规范化会清理非法值并保留多个提醒', () => {
  const event = normalizeEvent(
    {
      id: 'event-1',
      title: '  项目复盘  ',
      date: '2026-07-29',
      startTime: '25:99',
      endTime: '10:00',
      reminders: [30, '10', 30, -1, 'bad'],
      recurrence: { frequency: 'daily', interval: 0, until: 'bad-date' },
      color: 'red'
    },
    NOW
  );
  assert.equal(event.title, '项目复盘');
  assert.equal(event.startTime, '09:00');
  assert.deepEqual(event.reminders, [10, 30]);
  assert.deepEqual(event.recurrence, {
    frequency: 'daily',
    interval: 1,
    until: null,
    count: null
  });
  assert.equal(event.color, '#6750e8');
});

test('无效日程和重复 ID 不会进入存储', () => {
  const events = normalizeEvents(
    [
      { id: 'same', title: '有效', date: '2026-07-29' },
      { id: 'same', title: '重复', date: '2026-07-30' },
      { id: 'invalid', title: '', date: '2026-07-29' },
      { id: 'bad-date', title: '坏日期', date: '2026-02-30' }
    ],
    NOW
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].title, '有效');
});

test('通知原文逐字保留，长笔记及原文往返迁移不丢失', () => {
  const sourceText = `  通知原文\n${'原'.repeat(49990)}\n `;
  const notes = '笔'.repeat(20000);
  const event = normalizeEvent({ title: '通知事项', date: '2026-10-23', sourceText, notes }, NOW);
  assert.equal(event.sourceText, sourceText);
  assert.equal(event.notes, notes);
  assert.equal(migrateData({ events: [event] }, NOW).events[0].sourceText, sourceText);
  assert.equal(migrateData({ events: [event] }, NOW).events[0].notes, notes);
  assert.equal(normalizeEvent({ title: '旧事项', date: '2026-10-23' }, NOW).sourceText, '');
});

test('笔记与原文超过各自上限时拒绝日程而不截断', () => {
  const base = { title: '通知事项', date: '2026-10-23' };
  assert.throws(() => normalizeEvent({ ...base, sourceText: '原'.repeat(50001) }, NOW), /原文.*50,?000/);
  assert.throws(() => normalizeEvent({ ...base, notes: '笔'.repeat(20001) }, NOW), /笔记.*20,?000/);
  assert.throws(() => normalizeEvent({ ...base, notes: ` ${'笔'.repeat(20000)}` }, NOW), /笔记.*20,?000/);
  assert.throws(() => migrateData({ events: [{ ...base, notes: '笔'.repeat(20001) }] }, NOW), RangeError);
  assert.equal(normalizeEvent({ ...base, sourceText: '原'.repeat(50000) }, NOW).sourceText.length, 50000);
});
