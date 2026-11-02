const test=require('node:test'),assert=require('node:assert/strict');
const {migrateData,normalizeEvent}=require('../src/data-model');
const Upgrades=require('../src/title-upgrades');
const {TITLE_VERSION}=require('../src/notice-input');
const now=new Date('2026-10-22T06:00:00Z');
const source='各班负责人大家好：\n【讲座题目】城市治理与公共服务\n【时间】10月25日下午15:00';
const event={id:'legacy',title:'各班负责人大家好：',date:'2026-10-25',allDay:true,sourceText:source,notes:'我的准备材料',completed:true,createdAt:now.toISOString(),updatedAt:now.toISOString()};
test('legacy generated titles upgrade once, preserving all other event fields',()=>{
 const before=normalizeEvent(event,now),after=migrateData({events:[event]},now).events[0];
 assert.equal(after.title,'讲座：城市治理与公共服务');assert.equal(after.titleAutomation.version,TITLE_VERSION);
 const {title:a,titleAutomation:ma,...restA}=after,{title:b,...restB}=before;
 assert.deepEqual(restA,restB);
 const once=migrateData({events:[event]},now);assert.deepEqual(migrateData(once,now),once);
});
test('manual, deleted, and no-source titles are not rewritten',()=>{
 for(const extra of [{title:'我手动取的名字'},{deletedAt:now.toISOString()},{sourceText:''}]) {
  const result=migrateData({events:[{...event,...extra}]},now).events[0];assert.equal(result.title,extra.title||event.title);
 }
});
test('tracked generated titles update only when version is older and source/title unchanged',()=>{
 const first=migrateData({events:[event]},now).events[0];
 const old={...first,title:'旧自动标题',titleAutomation:{...first.titleAutomation,version:0,lastTitle:'旧自动标题'}};
 assert.equal(migrateData({events:[old]},now).events[0].title,'讲座：城市治理与公共服务');
 assert.equal(migrateData({events:[old]},now).events[0].titleAutomation.previousTitle,'旧自动标题');
 const edited=normalizeEvent({...old,title:'自定义会议'},now);
 assert.equal(migrateData({events:[edited]},now).events[0].title,'自定义会议');
 assert.equal(edited.titleAutomation.manual,true);
 assert.equal(migrateData({events:[{...old,sourceText:source+' 修改'}]},now).events[0].title,'旧自动标题');
 const future={...old,titleAutomation:{...old.titleAutomation,version:99}};
 assert.equal(migrateData({events:[future]},now).events[0].title,'旧自动标题');
});
test('date range endpoint names and recurrence/notes survive migration',()=>{
 const sourceText='主题：绿植共养活动\n10月22日-11月22日';
 const events=['开始','结束'].map((s,i)=>({...event,id:String(i),title:'绿植共养活动'+s,date:i?'2026-11-22':'2026-10-22',sourceText}));
 const result=migrateData({events},now);assert.deepEqual(result.events.map(e=>e.title),events.map(e=>e.title));
 assert.ok(result.events.every(e=>e.titleAutomation.version===TITLE_VERSION));
});
test('old range names upgrade with the correct endpoint suffix',()=>{
 const sourceText='工作安排如下\n活动时间：10月22日-11月22日\n请参加绿植共养活动。';
 const events=['开始','结束'].map((s,i)=>({...event,id:String(i),title:'工作安排如下'+s,date:i?'2026-11-22':'2026-10-22',sourceText}));
 assert.deepEqual(migrateData({events},now).events.map(e=>e.title),['参加绿植共养活动开始','参加绿植共养活动结束']);
});
test('explicit rename of an untracked source event establishes manual ownership',()=>{
 const previous={...event,title:'自定义名称'};
 const changed=normalizeEvent(event,now);
 changed.titleAutomation=Upgrades.preserveOwnership(previous,changed);
 assert.equal(changed.titleAutomation.manual,true);
 assert.equal(migrateData({events:[changed]},now).events[0].title,event.title);
});
