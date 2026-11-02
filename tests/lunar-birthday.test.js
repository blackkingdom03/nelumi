const test=require('node:test'),assert=require('node:assert/strict');
const Lunar=require('../src/lunar-recurrence');
const Core=require('../src/calendar-core');
const Data=require('../src/data-model');
const Notice=require('../src/notice-input');
const rule={month:8,day:15,leap:false};
test('conversion round-trips every supported day against the saved original HKO daily tables',()=>{
  const fs=require('node:fs'),{parseHkoYear}=require('../scripts/calendar-audit-lib.cjs');
  let previous=null,checked=0;
  for(let year=1901;year<=2100;year++){
    const rows=parseHkoYear(fs.readFileSync(`audit/calendar-2026-10-22/hko/${year}.txt`,'utf8'),year,previous);
    previous=rows.at(-1);
    for(const row of rows){
      if(row.lunarYear<1901 || row.lunarYear>2099) continue;
      const rule={month:row.lunarMonth,day:row.lunarDay,leap:row.isLeapMonth};
      assert.equal(Lunar.toSolar(row.lunarYear,rule),row.date,row.date);
      assert.deepEqual(Lunar.fromSolar(row.date),{year:row.lunarYear,...rule},row.date);
      checked++;
    }
  }
  assert.ok(checked>72000);
});
test('HKO table conversion, Chinese year boundary, and invalid days',()=>{
  assert.equal(Lunar.toSolar(2026,rule),'2026-09-25');
  assert.equal(Lunar.toSolar(2027,rule),'2027-09-15');
  assert.equal(Lunar.toSolar(2026,{month:12,day:1,leap:false}),'2027-01-08');
  assert.equal(Lunar.toSolar(2026,{month:8,day:15,leap:true}),null);
  assert.equal(Lunar.toSolar(2100,rule),null);
  assert.equal(Lunar.toSolar(2026,{month:13,day:1}),null);
});
test('lunar birthday persists, marks actual annual date and reminds before it',()=>{
  const event=Data.normalizeEvent({id:'lunar',title:'妈妈生日',date:'2026-09-25',allDay:true,lunarDate:rule,recurrence:{frequency:'yearly'},reminders:[10080,1440]});
  assert.deepEqual(event.lunarDate,rule);
  assert.equal(Core.occursOn(event,Core.parseDate('2027-09-15')),true);
  assert.equal(Core.occursOn(event,Core.parseDate('2027-09-25')),false);
  assert.equal(Core.remindersDue([event],new Date(2027,8,8,9,0,20))[0]?.minutes,10080);
  assert.equal(Core.remindersDue([event],new Date(2027,8,14,9,0,20))[0]?.minutes,1440);
  assert.equal(Core.occursOn({...event,exceptions:['2027-09-15']},Core.parseDate('2027-09-15')),false);
  assert.equal(Core.occursOn({...event,recurrence:{frequency:'yearly',count:1}},Core.parseDate('2027-09-15')),false);
});
test('notice distinguishes lunar, solar, ambiguous and absent lunar dates',()=>{
  const parse=t=>Notice.parseNoticeDraft(t,new Date(2026,9,23,12));
  const a=parse('妈妈生日，每年农历八月十五，提前1周和1天提醒，地点：海棠餐厅').items[0];
  assert.equal(a.date,'2026-09-25');assert.deepEqual(a.lunarDate,rule);
  assert.equal(a.recurrence.frequency,'yearly');assert.equal(a.location,'海棠餐厅');
  assert.deepEqual(a.reminders,[1440,10080]);
  assert.equal(parse('阳历8月15日妈妈生日，每年提醒').items[0].lunarDate,undefined);
  assert.equal(parse('农历八月十五或八月十六妈妈生日，每年提醒').items[0].date,'');
  assert.equal(parse('农历生日，每年提醒').items[0].date,'');
  assert.equal(parse('农历八月十五或十六妈妈生日，每年提醒').items[0].date,'');
  assert.equal(parse('农历八月十五到十六生日聚会，每年提醒').items[0].date,'');
  assert.equal(parse('农历闰月八月十五生日，每年提醒').items[0].date,'');
});
test('invalid lunar data is rejected; moving just one occurrence leaves the series intact',()=>{
  const Planner=require('../src/planner-core');
  const event={id:'l',title:'生日',date:'2026-09-25',lunarDate:rule,recurrence:{frequency:'yearly'},reminders:[10080,1440],allDay:true};
  assert.throws(()=>Data.normalizeEvent({...event,date:'2026-08-15'}),/不对应/);
  assert.throws(()=>Data.normalizeEvent({...event,lunarDate:{month:13,day:2}}),/无效/);
  const {original,detached}=Planner.applyOccurrenceChange(event,'2027-09-15',{date:'2027-09-16'},'occurrence',()=> 'single');
  assert.deepEqual(original.lunarDate,rule);assert.equal(detached.lunarDate,null);
  assert.equal(Core.occursOn(Data.normalizeEvent(detached),Core.parseDate('2027-09-16')),true);
  assert.equal(Core.occursOn(original,Core.parseDate('2027-09-15')),false);
  const future=Planner.applyOccurrenceChange({...event,recurrence:{frequency:'yearly',count:3}},'2027-09-15',{notes:'新笔记'},'future',()=> 'future');
  assert.equal(future.detached.recurrence.count,2);
  assert.equal(Core.occursOn(future.detached,Core.parseDate('2028-10-03')),true);
  assert.equal(Core.occursOn(future.detached,Core.parseDate('2029-09-22')),false);
});
test('leap-month and short-month missing dates skip; occurrence count counts actual dates',()=>{
  const event={title:'生日',date:'2025-07-25',lunarDate:{month:6,day:1,leap:true},recurrence:{frequency:'yearly',count:2},allDay:true,reminders:[1440]};
  assert.equal(Core.occursOn(event,Core.parseDate('2026-07-14')),false);
  const next=Array.from({length:73},(_,i)=>2026+i).map(y=>Lunar.toSolar(y,event.lunarDate)).filter(Boolean);
  assert.equal(Core.occurrenceNumber(event,Core.parseDate(next[0])),2);
  assert.equal(Core.occursOn(event,Core.parseDate(next[1])),false);
  for(let year=2026;year<2030;year++)for(let month=1;month<=12;month++){
    const date=Lunar.toSolar(year,{month,day:30});
    if(!date){
      const d29=Lunar.toSolar(year,{month,day:29});
      assert.ok(d29);assert.notEqual(Lunar.fromSolar(Core.dateKey(Core.addDays(Core.parseDate(d29),1))).month,month);
    }
  }
});
