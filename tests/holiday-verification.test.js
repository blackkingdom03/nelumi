const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/chinese-calendar');
test('only independently audited exact holiday data can become formal days',()=>{
 const candidate={year:2027,papers:['https://www.gov.cn/zhengce/example.htm'],days:[{date:'2027-01-01',name:'元旦',isOffDay:true}],verified:true};
 assert.equal(C.verifyHolidayData(candidate).status,'pending-review');assert.equal(C.installHolidayData(candidate),null);assert.equal(C.getHolidaySchedule(2027),null);
 const known=C.getHolidaySchedule(2026);const matching={year:2026,papers:[C.HOLIDAY_SOURCE_2026],days:Object.values(known.days).map(d=>({date:d.date,name:d.name,isOffDay:d.type==='holiday'}))};
 assert.equal(C.verifyHolidayData(matching).status,'verified');
 const corrupt=structuredClone(matching);corrupt.days[0].isOffDay=false;assert.equal(C.verifyHolidayData(corrupt).status,'conflict');assert.equal(C.installHolidayData(corrupt),null);assert.equal(C.getDayInfo('2026-01-01').holiday.badge,'休');
});
