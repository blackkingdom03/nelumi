const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {app,BrowserWindow}=require('electron');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const Model=require(path.join(root,'src/data-model.js'));
const profile=path.join(__dirname,'..',`.test-profile-upgrade-${Date.now()}`);
fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);app.setPath('sessionData',profile);
for(const method of ['show','showInactive','focus','moveTop']) BrowserWindow.prototype[method]=function(){};
const original={...structuredClone(Model.DEFAULT_DATA),events:[{id:'legacy',title:'各班负责人大家好：',date:'2026-10-25',allDay:true,sourceText:'各班负责人大家好：\n【讲座题目】城市治理与公共服务\n时间：10月25日下午15:00',notes:'保留笔记',createdAt:'2026-10-22T06:00:00Z',updatedAt:'2026-10-22T06:00:00Z'}]};
fs.writeFileSync(path.join(profile,'deskcal-data.json'),JSON.stringify(original));
require(path.join(root,'src/main.js'));
const read=()=>JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json')));
app.whenReady().then(async()=>{
 for(let i=0;i<100;i++){
  const win=BrowserWindow.getAllWindows()[0];
  if(win && await win.webContents.executeJavaScript("typeof state!=='undefined' && state.events.length===1").catch(()=>false)) break;
  await new Promise(r=>setTimeout(r,50));
 }
 const win=BrowserWindow.getAllWindows()[0];
 assert.equal(read().events[0].title,'讲座：城市治理与公共服务');
 assert.equal(read().events[0].notes,'保留笔记');
 const backups=fs.readdirSync(profile).filter(p=>p.includes('.before-title-upgrade-'));
 assert.equal(backups.length,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,backups[0]))),original);
 await win.webContents.executeJavaScript(`state.events[0].title='我的手动标题'; window.deskcal.saveEvents(state.events)`);
 assert.equal(read().events[0].titleAutomation.manual,true);
 await win.webContents.executeJavaScript(`state.events[0].title='讲座：城市治理与公共服务'; window.deskcal.saveEvents(state.events)`);
 assert.equal(read().events[0].titleAutomation.manual,true,'manual ownership remains sticky even when stale renderer metadata is saved');
 assert.deepEqual(Model.migrateData(read()).events,read().events,'later reads do not alter manual title');
 console.log('Native migration passed: backed-up original, upgraded persisted title, retained notes and sticky manual edits.');
 app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
