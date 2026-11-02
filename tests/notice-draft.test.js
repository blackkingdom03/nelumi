const test=require('node:test'),assert=require('node:assert/strict');
const Notice=require('../src/notice-input');
const Core=require('../src/calendar-core');
const {normalizeEvent}=require('../src/data-model');
const now=new Date(2026,9,23,12);
const draft=text=>Notice.parseNoticeDraft(text,now);

test('birthday prefill: annual rule, two offsets, place, full source',()=>{
  const text='每年11月8日小林生日，提前一周和一天提醒我，地点：海棠餐厅';
  const result=draft(text),item=result.items[0];
  assert.equal(result.ok,true);assert.equal(result.review,true);
  assert.equal(item.title,'小林生日');assert.equal(item.date,'2026-11-08');
  assert.equal(item.recurrence.frequency,'yearly');assert.equal(item.allDay,true);
  assert.deepEqual(item.reminders,[1440,10080]);assert.equal(item.location,'海棠餐厅');
  assert.equal(item.sourceText,text);assert.equal(item.category,'life');
});
test('explicit offsets and negations are preserved, uncertain fields stay empty',()=>{
  assert.deepEqual(draft('11月8日小林生日，提前1周提醒，提前1天提醒').items[0].reminders,[1440,10080]);
  assert.deepEqual(draft('11月8日小林生日，不要提前1周提醒，只提前1天提醒').items[0].reminders,[1440]);
  const item=draft('11月8日小林生日，不重复，不提醒，地点待定').items[0];
  assert.equal(item.recurrence.frequency,'none');assert.deepEqual(item.reminders,[]);assert.equal(item.location,'');
  assert.equal(draft('11月8日小林生日').items[0].recurrence.frequency,'none');
  assert.deepEqual(draft('11月8日小林生日，提前几天提醒').items[0].reminders,[]);
  assert.equal(draft('农历八月十五妈妈生日，每年提醒').items[0].date,'2026-09-25');
  assert.equal(draft('农历8月15日妈妈生日，每年提醒').items[0].recurrence.frequency,'yearly');
  assert.match(draft('农历8月15日妈妈生日，每年提醒').summary,/农历/);
});
test('reminder clock is separate from event clock, missing end is not invented',()=>{
  const a=draft('每年11月8日小林生日，提前1周、1天提醒，提醒时间：上午9点').items[0];
  assert.equal(a.allDay,true);assert.equal(a.allDayReminderTime,'09:00');
  const b=draft('11月8日15:00给小林过生日，提前1天提醒').items[0];
  assert.equal(b.startTime,'15:00');assert.equal(b.endTime,'');assert.equal(b.allDay,false);
  const c=draft('每周五下午3点开会，提前30分钟提醒');
  assert.equal(c.items[0].date,'2026-10-23');assert.equal(c.items[0].recurrence.frequency,'weekly');
});
test('ordinary notifications keep direct-entry and range endpoint behavior',()=>{
  assert.equal(draft('明天开会').review,false);
  assert.equal(draft('活动：10月23日-11月23日').review,false);
  const a=draft('活动：10月23日-11月23日，提前1天提醒');
  assert.equal(a.review,true);assert.deepEqual(a.items.map(x=>x.date),['2026-10-23','2026-11-23']);
  assert.ok(a.items.every(x=>x.recurrence.frequency==='none'));
});
test('review ambiguous dates/times and unsupported reminders rather than silently dropping them',()=>{
  const a=draft('11月8日或11月9日小林生日，每年重复，提前2周提醒');
  assert.equal(a.items.length,1);assert.equal(a.items[0].date,'');assert.deepEqual(a.items[0].reminders,[]);
  assert.match(a.summary,/一周|7天/);
  assert.equal(draft('2月30日小林生日').items[0].date,'');
  assert.equal(draft('11月8日3点小林生日').items[0].startTime,'');
  assert.equal(draft('小林生日').items[0].date,'2026-10-23');
  assert.equal(draft('').ok,false);
  assert.deepEqual(draft('11月8日小林生日，提前1周或1天提醒').items[0].reminders,[]);
  assert.equal(draft('11月8日小林生日，不要每年重复').items[0].recurrence.frequency,'none');
  assert.equal(draft('小林生日，每年11月8日，提前1周和1天的上午9点提醒').items[0].allDay,true);
  assert.equal(draft('每年11月8日小林生日\n地点：海棠餐厅，带上蛋糕').items[0].location,'海棠餐厅');
  assert.equal(draft('每年十一月八日小林生日').items[0].date,'2026-11-08');
  assert.equal(draft('小林生日，每年或每两年重复').items[0].recurrence.frequency,'none');
});
test('confirmed annual birthday persists and actually reminds across year boundary',()=>{
  const item=draft('每年1月3日小林生日，提前一周和一天提醒').items[0];
  const event=normalizeEvent({...item,id:'birthday',calendarId:'personal'},now);
  assert.deepEqual(event.reminders,[1440,10080]);
  assert.equal(Core.occursOn(event,Core.parseDate('2027-01-03')),true);
  const week=Core.remindersDue([event],new Date(2026,11,27,9,0,20));
  const day=Core.remindersDue([event],new Date(2027,0,2,9,0,20));
  assert.equal(week.length,1);assert.equal(week[0].minutes,10080);assert.equal(week[0].occurrenceKey,'2027-01-03');
  assert.equal(day.length,1);assert.equal(day[0].minutes,1440);
});
