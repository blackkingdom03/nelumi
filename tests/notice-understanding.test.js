const test=require('node:test'),assert=require('node:assert/strict');
const {parseNotice,parseQuickNotice}=require('../src/notice-input');
const BASE=new Date(2026,9,22,12);
test('line-wrapped date and time ranges retain their endpoints',()=>{
 const clock=parseQuickNotice('主题：项目评审\n时间：10月25日下午15:00-\n17:00\n地点：会议室',BASE);
 assert.equal(clock.items[0].endTime,'17:00');
 const dates=parseQuickNotice('活动名称：绿植共养活动\n活动时间：10月22日-\n11月22日',BASE);
 assert.deepEqual(dates.items.map(e=>[e.date,e.title]),[['2026-10-22','绿植共养活动开始'],['2026-11-22','绿植共养活动结束']]);
});
test('date-only fields do not hide times or invalid clocks on following lines',()=>{
 const prefix='主题：项目评审\n日期：10月25日\n';
 const result=parseQuickNotice(prefix+'下午15:00-16:00开会',BASE);
 assert.equal(result.ok,true);assert.equal(result.items[0].allDay,false);
 assert.equal(result.items[0].startTime,'15:00');assert.equal(result.items[0].endTime,'16:00');
 assert.equal(parseQuickNotice(prefix+'下午25:00开始',BASE).ok,false);
});
test('下午15:00 and afternoon 24-hour range are accepted without changing the date',()=>{
 const r=parseQuickNotice('【讲座题目】\n城市治理与社会服务\n📌【地点】大学报告厅\n⏰【时间】10月25日（周日）下午15:00',BASE);
 assert.equal(r.ok,true);assert.equal(r.items[0].date,'2026-10-25');assert.equal(r.items[0].startTime,'15:00');
 assert.equal(r.items[0].location,'大学报告厅');
 assert.equal(parseQuickNotice('10月25日下午15:00-16:00开会',BASE).items[0].endTime,'16:00');
 for(const bad of ['上午15:00','下午25:00','晚上12点']) assert.equal(parseQuickNotice('明天'+bad+'开会',BASE).ok,false,bad);
});
test('title uses labelled topic deep inside a full notice, including emoji and newlines',()=>{
 const text='各班负责人大家好：\n青年教师论文工作坊即将开展，具体信息如下。\n【时间】10月25日下午15:00\n【地点】大学报告厅\n📢【讲座题目】\n从劳动到“被看见”：内容生产者的主体性与数字自我\n【主讲人】某某教授，副院长，博士生导师。\n注：计入学术考勤，请各班负责人转发。谢谢大家！';
 const r=parseQuickNotice(text,BASE);
 assert.equal(r.ok,true);assert.match(r.items[0].title,/从劳动到“被看见”/);
 assert.match(r.items[0].title,/讲座/);assert.doesNotMatch(r.items[0].title,/负责人|即将|考勤/);
 assert.ok(r.items[0].title.length<=40);assert.equal(r.items[0].sourceText,text);
});
test('background history is not the event: activity name and submission deadline take precedence',()=>{
 const text='各位负责人：大家好！90年前的今天，艰苦卓绝的长征胜利结束。为纪念长征胜利，学院特此举办“AI绘长征・赓续新征程”——创意作品征集大赛。参赛者使用AI工具创作作品。\n📌主题一：重走长征路\n⏰ 截稿时间：10月31日20:00\n参赛方式：将作品和报名表发送至指定邮箱。\n奖项设置：一等奖和二等奖。辛苦各班转发。';
 const r=parseQuickNotice(text,BASE);
 assert.equal(r.ok,true);assert.equal(r.items.length,1);assert.equal(r.items[0].date,'2026-10-31');
 assert.match(r.items[0].title,/AI绘长征/);assert.match(r.items[0].title,/截止/);assert.doesNotMatch(r.items[0].title,/90年前|大家好|主题一/);
});
test('full paragraph selects action and object rather than greeting or background',()=>{
 const text='各位同学大家好。为了让大家更好地了解本年度培养安排，前期已经进行了充分沟通。\n请同学们于10月28日前提交研究生奖学金申请材料，纸质材料交到办公室。\n申请材料包含成绩单和科研成果证明。感谢配合。';
 const r=parseQuickNotice(text,BASE);
 assert.equal(r.ok,true);assert.match(r.items[0].title,/提交.*奖学金申请材料/);assert.doesNotMatch(r.items[0].title,/培养安排|负责人|感谢/);
});
test('unnamed activity still chooses its action from later text and remains local',()=>{
 const r=parseNotice('大家好！这个月大家都很忙，辛苦了。\n请各位于明天下午3点在三楼会议室参加项目进度评审会议，并提前准备汇报材料。\n本次项目进度评审重点检查交付情况。谢谢大家！',BASE);
 assert.match(r.title,/项目进度评审/);assert.doesNotMatch(r.title,/大家好|很忙/);
});
test('range endpoint names retain the distilled activity title and no intermediate days',()=>{
 const r=parseQuickNotice('各位同学大家好！“共育新绿”绿植共养活动开始啦！\n活动时间：10月22日-11月22日\n活动形式：照料绿植并记录。奖品丰富。',BASE);
 assert.deepEqual(r.items.map(x=>x.title),['共育新绿绿植共养活动开始','共育新绿绿植共养活动结束']);
 assert.deepEqual(r.items.map(x=>x.date),['2026-10-22','2026-11-22']);
});
