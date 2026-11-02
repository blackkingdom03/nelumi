const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/chinese-calendar');
const sample=()=>({year:2027,papers:['https://www.gov.cn/zhengce/example.htm'],days:[{date:'2027-01-01',name:'元旦',isOffDay:true},{date:'2027-01-02',name:'元旦',isOffDay:true},{date:'2027-01-03',name:'元旦',isOffDay:false}]});
test('future lunar calendar works without inventing official days',()=>{
 assert.equal(C.getDayInfo('2027-02-06').festival,'春节');
 assert.equal(C.getDayInfo('2028-01-26').festival,'春节');
 assert.equal(C.getDayInfo('2027-02-06').holiday,null);
 const {Solar}=require('lunar-javascript');let found=0;
 for(let i=0;i<365;i++){const d=new Date(2028,0,1+i,12),l=Solar.fromYmd(d.getFullYear(),d.getMonth()+1,d.getDate()).getLunar();if(l.getMonth()===-5&&l.getDay()===5){found++;assert.equal(C.getDayInfo(d).traditionalFestival,'');}}
 assert.equal(found,1,'2028 leap fifth month must not repeat Dragon Boat Festival');
});
test('downloaded schedules validate dates and sources before replacing cache',()=>{
 const s=C.parseHolidayData(sample(),2027);assert.equal(s.days['2027-01-02'].total,2);assert.equal(s.days['2027-01-03'].badge,'班');
 assert.equal(C.parseHolidayData({year:2027,papers:[],days:[]},2027),null);
 for(const mutate of [x=>x.year=2028,x=>x.papers=['https://evil.gov.cn.example/a'],x=>x.days[0].date='2027-02-30',x=>x.days.push(x.days[0]),x=>x.days[0].isOffDay='false']){const x=sample();mutate(x);assert.throws(()=>C.parseHolidayData(x,2027));}
 C.getDayInfo('2027-01-01');C.installHolidayData(sample());assert.equal(C.getDayInfo('2027-01-01').holiday,null);
 C.installHolidayData({year:2027,papers:[],days:[]});assert.equal(C.getDayInfo('2026-01-01').holiday.badge,'休','unverified or empty replies must not change known dates');
});
