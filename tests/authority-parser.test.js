const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {parseHkoYear}=require('../scripts/calendar-audit-lib.cjs');
test('authority parser covers every day, normalizes month/terms, rejects missing or duplicate rows',()=>{
 const text=fs.readFileSync('audit/calendar-2026-10-22/hko/1901.txt','utf8');const rows=parseHkoYear(text,1901);
 assert.equal(rows.length,365);assert.deepEqual(rows[0],{date:'1901-01-01',lunarMonth:11,lunarDay:11,isLeapMonth:false,lunarYear:1900,weekday:2,solarTerm:''});
 assert.equal(rows.find(r=>r.date==='1901-02-19').lunarMonth,1);assert.equal(rows.find(r=>r.date==='1901-02-19').lunarDay,1);
 const line=text.split(/\r?\n/).find(x=>x.startsWith('1901年01月02日'));
 assert.throws(()=>parseHkoYear(text.replace(line,''),1901));assert.throws(()=>parseHkoYear(text+'\n'+line,1901));
 assert.throws(()=>parseHkoYear(text.replace('星期二','星期三'),1901));
});
test('cross-year leap month is retained from the preceding authority table',()=>{
 const read=y=>fs.readFileSync(`audit/calendar-2026-10-22/hko/${y}.txt`,'utf8');
 const previous=parseHkoYear(read(2033),2033).at(-1);
 const rows=parseHkoYear(read(2034),2034,previous);
 assert.equal(rows[0].isLeapMonth,true);assert.equal(rows[0].lunarMonth,11);
 assert.equal(rows.find(r=>r.date==='2034-01-20').isLeapMonth,false);
});
