const test=require('node:test'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const Notice=require(root+'/src/notice-input'),Core=require(root+'/src/calendar-core');
const BASE=new Date(2026,10,1,12);
const source=`📢【燃动卡路里｜校园卡路里打卡赛活动通知】
各位班级负责人：
大家好！为引导同学们走出宿舍、告别久坐，培养规律运动的健康习惯，校园运动协会联合开展【校园卡路里打卡赛】，具体安排通知如下：
🕐时间安排：
🔹报名时间：10 月 27 日 —10 月 29 日
🔹打卡活动时间：10 月 30 日 —11 月 12 日
💻参与形式：线上个人打卡
✅参与方式：加入活动通知群，填写群内报名表完成报名。详细打卡规则请加入报名群后查看。
🎁活动奖品福利：一等奖（3 名）：大容量运动包；二等奖（5 名）：便携蓝牙音箱；三等奖（8 名）：纪念帆布包。
请各班负责人及时将本通知、活动群二维码转发至班群，感谢大家的配合！`;
test('separates registration endpoints and bounded daily check-in, retains source',()=>{
 const r=Notice.parseNoticeDraft(source,BASE);assert.equal(r.ok,true,r.error);assert.equal(r.review,true);assert.equal(r.items.length,3);
 assert.deepEqual(r.items.map(e=>e.date),['2026-10-27','2026-10-29','2026-10-30']);
 assert.match(r.items[0].title,/报名开始$/);assert.match(r.items[1].title,/报名截止$/);
 const daily=r.items[2];assert.equal(daily.title,'校园卡路里打卡赛 · 每日打卡');
 assert.deepEqual(daily.recurrence,{frequency:'daily',interval:1,until:'2026-11-12',count:null});
 assert.ok(r.items.every(e=>e.sourceText===source && e.allDay && !e.location && e.reminders.length===0));
 let count=0;for(let d=new Date(2026,9,26,12);d<=new Date(2026,10,14,12);d.setDate(d.getDate()+1))if(Core.occursOn(daily,d))count++;
 assert.equal(count,14);assert.equal(Core.occursOn(daily,new Date(2026,9,29,12)),false);assert.equal(Core.occursOn(daily,new Date(2026,10,13,12)),false);
});
test('single check-in range and explicit daily action with timing and place',()=>{
 for(const text of ['读书打卡活动\n活动时间：11月1日至3日','活动名称：英语学习\n活动时间：11月1日—11月3日\n每天晚上20:00学习\n地点：图书馆']){
 const r=Notice.parseNoticeDraft(text,BASE);assert.equal(r.ok,true,r.error);assert.equal(r.review,true);assert.equal(r.items.length,1);assert.equal(r.items[0].recurrence.until,'2026-11-03');assert.equal(r.items[0].recurrence.frequency,'daily');
 if(text.includes('图书馆')){assert.equal(r.items[0].location,'图书馆');assert.equal(r.items[0].startTime,'20:00');}
 }
});
test('does not force daily for optional, negative, weekly or every-other-day check-in',()=>{
 for(const phrase of ['任选一天打卡','只需打卡一次','无需每天打卡','每周五打卡','每隔两天打卡','累计打卡3天即可','打卡频率待定']){
 const r=Notice.parseNoticeDraft('活动名称：运动打卡赛\n活动时间：11月1日至11月12日\n'+phrase,BASE);
 assert.equal(r.ok,true,r.error);assert.equal(r.review,true);assert.ok(r.items.every(e=>e.recurrence.frequency==='none'),phrase);assert.match(r.summary,/核对/);
 }
});
test('rejects invalid, ambiguous or extra ranges instead of losing dates',()=>{
 for(const text of ['运动打卡\n活动时间：2月30日至3月4日','运动打卡\n活动时间：12月30日至1月3日','运动打卡\n活动时间：11月1日至11月5日\n颁奖时间：11月9日','运动打卡\n报名时间：11月1日至11月3日\n其他安排：11月4日至11月6日']){
 assert.equal(Notice.parseNoticeDraft(text,BASE).ok,false,text);
 }
});
test('ordinary ranges and title migration path stay unchanged',()=>{
 const normal=Notice.parseNoticeDraft('活动名称：绿植共养活动\n活动时间：10月22日-11月22日',BASE);
 assert.equal(normal.review,false);assert.equal(normal.items.length,2);assert.ok(normal.items.every(e=>e.recurrence.frequency==='none'));
 assert.equal(Notice.TITLE_VERSION,2);
});
module.exports={source};

test('activity clock and reminders do not leak into registration',()=>{
 const r=Notice.parseNoticeDraft('活动名称：运动打卡\n报名时间：11月1日至11月2日\n打卡活动时间：11月3日至11月6日\n每天晚上20:00打卡，提前1小时提醒\n地点：体育馆',BASE);
 assert.equal(r.ok,true,r.error);assert.ok(r.items.slice(0,2).every(e=>e.allDay&&!e.startTime&&e.reminders.length===0&&!e.location));
 assert.equal(r.items[2].startTime,'20:00');assert.deepEqual(r.items[2].reminders,[60]);assert.equal(r.items[2].location,'体育馆');
});
