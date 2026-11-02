const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/chinese-calendar');
test('authority dates replace mismatched library dates and derived festivals stay consistent',()=>{
 assert.equal(C.getDayInfo('1979-01-20T12:00:00').solarTerm,'');
 assert.equal(C.getDayInfo('1979-01-21T12:00:00').solarTerm,'大寒');
 const first=C.getDayInfo('2057-09-28T12:00:00');
 assert.equal(first.lunarMonth,9);assert.equal(first.lunarDay,1);assert.equal(first.lunarText,'九月');
 assert.equal(C.getDayInfo('2057-10-06T12:00:00').traditionalFestival,'重阳节');
 assert.equal(C.getDayInfo('2057-10-07T12:00:00').traditionalFestival,'');
 assert.match(first.calendarVerification.note,/一日/);
 assert.equal(C.getDayInfo('2034-01-01T12:00:00').isLeapMonth,true);
});
test('verification scope does not overclaim first incomplete month or outside authority range',()=>{
 assert.equal(C.getDayInfo('1901-01-01T12:00:00').calendarVerification.status,'partial');
 assert.equal(C.getDayInfo('1901-01-20T12:00:00').calendarVerification.status,'table-checked');
 assert.equal(C.getDayInfo('1900-01-01T12:00:00').calendarVerification.status,'calculated');
 assert.equal(C.getDayInfo('2026-02-16T12:00:00').traditionalFestival,'除夕');
});
