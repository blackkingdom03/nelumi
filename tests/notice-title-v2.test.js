const test=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const Notice=require('../src/notice-input');
const Upgrades=require('../src/title-upgrades');
const BASE=new Date(2026,9,27,12);
const report='@全体成员 大家早上好🌹十月下半月半月报可以开始填报啦！⚠️⚠️注意：地址如下https://example.org/user/web-v2/sso 密码就是统一认证平台自己设的密码，此次填报时间为10月25日—10月31日/崇拜/崇拜';

test('whole paragraph: object before action wins over URL/password instructions; range marks endpoints only',()=>{
 const r=Notice.parseQuickNotice(report,BASE);
 assert.equal(r.ok,true);
 assert.deepEqual(r.items.map(e=>[e.date,e.title]),[['2026-10-25','填报十月下半月半月报开始'],['2026-10-31','填报十月下半月半月报结束']]);
 assert.ok(r.items.every(e=>e.sourceText===report && e.allDay));
});

for(const [name,text,expected] of [
 ['greeting and task same sentence','各位同学大家好：请大家于10月28日前提交研究生奖学金申请材料，谢谢配合！','提交研究生奖学金申请材料'],
 ['core at end','为了做好本学期工作，前期已经充分沟通。请查看操作指南，登录地址：https://example.org/sso，密码为统一认证密码。请大家在10月28日前填报本学期实践周报。','填报本学期实践周报'],
 ['postposed action','各位同学，本学期助学金申请表可以开始填写了，10月28日前完成。','填写本学期助学金申请表'],
 ['submit preposed object','研究生奖学金申请材料请于10月28日前提交，逾期不再受理。','提交研究生奖学金申请材料'],
 ['no objects hallucinated','请大家明天完成设备检查，检查结果请发送到support@example.org，谢谢！','完成设备检查'],
 ['link before task','入口：https://example.org/form。请于10月28日缴纳考试报名费。','缴纳考试报名费'],
 ['explicit topic immune to support filter','主题：账户密码安全培训\n时间：10月28日15:00\n地点：一楼会议室\n请大家转发通知。','账户密码安全培训'],
 ['labelled task','任务：提交实验室安全检查表\n时间：10月28日\n注意：登录网址https://example.org','提交实验室安全检查表'],
 ['preserve source parentheses','12月2日准备（开题报告和PPT）','准备（开题报告和PPT）'],
 ['action with essential period','请于10月28日填报十月下半月半月报。','填报十月下半月半月报']
]) test(name,()=>assert.equal(Notice.parseNotice(text,BASE).title,expected));

test('network addresses cannot create dates or clock conflicts',()=>{
 const text='请明天15:00提交研究报告，入口https://example.org/2024/01/01/12:00，联系help@example.org。';
 const r=Notice.parseQuickNotice(text,BASE);assert.equal(r.ok,true);
 assert.deepEqual(r.items.map(e=>[e.date,e.startTime]),[['2026-10-28','15:00']]);
 assert.equal(r.items[0].sourceText,text);assert.equal(r.items[0].title,'提交研究报告');
});
test('instructions alone never become a URL or credentials title',()=>{
 assert.equal(Notice.parseNotice('注意：地址如下https://example.org。密码为统一认证密码。请各班负责人转发，谢谢。',BASE).title,'新日程');
});
test('long repeated supporting instructions do not outrank the one core task',()=>{
 const text='请10月28日提交年度考核表。'+('注意：登录地址https://example.org/sso，密码为统一认证密码。请查看填写说明。'.repeat(100));
 assert.equal(Notice.parseNotice(text,BASE).title,'提交年度考核表');
});
test('v1 tracked range titles upgrade idempotently and preserve every non-title field',()=>{
 const events=['开始','结束'].map((suffix,i)=>({id:String(i),title:'注意：地址如下https://example.org/user/web…'+suffix,date:i?'2026-10-31':'2026-10-25',sourceText:report,createdAt:BASE.toISOString(),notes:'我的笔记',reminders:[1440],completed:true,recurrence:{frequency:'none'},titleAutomation:{version:1,lastTitle:'注意：地址如下https://example.org/user/web…'+suffix,originalTitle:'原始自动标题',sourceHash:createHash('sha256').update(report).digest('hex'),manual:false}}));
 const upgraded=Upgrades.upgradeTitles(events);assert.equal(Notice.TITLE_VERSION,2);
 assert.deepEqual(upgraded.map(e=>e.title),['填报十月下半月半月报开始','填报十月下半月半月报结束']);
 for(let i=0;i<2;i++) {const {title,titleAutomation,...a}=upgraded[i],{title:b,titleAutomation:c,...d}=events[i];assert.deepEqual(a,d);}
 assert.deepEqual(Upgrades.upgradeTitles(upgraded),upgraded);
 for(const changed of [{...events[0],title:'自己定的标题'},{...events[0],sourceText:report+' 修改'},{...events[0],titleAutomation:{...events[0].titleAutomation,manual:true}}]) assert.deepEqual(Upgrades.upgradeTitles([changed]),[changed]);
});
