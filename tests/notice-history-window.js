const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {app,BrowserWindow}=require('electron');
const profile=path.join(__dirname,'..',`.test-profile-history-${Date.now()}`);fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);app.setPath('sessionData',profile);
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1000,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
 await win.loadFile(path.join(root,'src/renderer/index.html'));win.webContents.setBackgroundThrottling(false);
 const js=code=>win.webContents.executeJavaScript(code);
 const until=async code=>{for(let i=0;i<100;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,20));}throw Error(code);};
 await until("typeof state!=='undefined' && state.settings.theme");
 assert.equal(await js("!!document.querySelector('#redoNoticeButton svg') && !!document.querySelector('#undoNoticeButton svg')"),true,'paired icons exist');
 const add=async(text,count)=>{await js(`document.querySelector('#noticeInput').value=${JSON.stringify(text)};document.querySelector('#noticeInput').dispatchEvent(new Event('input'));document.querySelector('#noticeForm').requestSubmit()`);await until(`activeEvents().length===${count} && !document.querySelector('#saveNoticeButton').disabled`);};
 const travel=async(button,count)=>{await js(`document.querySelector('#${button}NoticeButton').click()`);await until(`activeEvents().length===${count} && !document.querySelector('#saveNoticeButton').disabled`);};
 await add('主题：第一批\n2026年10月23日',1);
 const firstId=await js('activeEvents()[0].id');
 await add('主题：第二批\n2026年10月24日',2);
 await add('主题：第三批\n10月25日-10月26日',4);
 await travel('undo',2);await travel('undo',1);await travel('undo',0);
 assert.equal(await js("document.querySelector('#undoNoticeButton').disabled"),true);
 await travel('redo',1);assert.equal(await js('activeEvents()[0].id'),firstId,'redo retains original IDs');
 await travel('redo',2);await travel('redo',4);
 assert.equal(await js("document.querySelector('#redoNoticeButton').disabled"),true);
 await travel('undo',2);
 // Failure must leave the history cursor and domain data intact.
 await js("window.writer=window.deskcal.saveEvents;window.deskcal.saveEvents=async()=>{throw Error('测试写入失败')};document.querySelector('#redoNoticeButton').click()");
 await until("document.querySelector('#notebookStatus').textContent.includes('测试写入失败')");
 assert.equal(await js('activeEvents().length'),2);
 assert.equal(await js("JSON.parse(localStorage.getItem('nelumi-notebook-v1')).history.future.length"),1);
 await js('window.deskcal.saveEvents=window.writer;void 0');await travel('redo',4);
 await travel('undo',2);await add('主题：新的分支\n2026年10月27日',3);
 assert.equal(await js("document.querySelector('#redoNoticeButton').disabled"),true,'new submission discards forward branch');
 // A reload preserves history. Preview domain fixture is volatile, so restore only events.
 const events=await js('state.events');await win.reload();await until("typeof state!=='undefined' && state.settings.theme");
 await js(`state.events=${JSON.stringify(events)};render()`);await travel('undo',2);await travel('redo',3);
 await js("state.events.find(e=>!e.deletedAt && e.title==='新的分支').notes='后续修改';document.querySelector('#undoNoticeButton').click()");
 await until("document.querySelector('#notebookStatus').textContent.includes('修改')");
 assert.equal(await js('activeEvents().length'),3,'cannot undo edited events');
 // Existing single-undo data is migrated and becomes redoable.
 await js(`const s=JSON.parse(localStorage.getItem('nelumi-notebook-v1'));s.undo=s.history.past[0];delete s.history;localStorage.setItem('nelumi-notebook-v1',JSON.stringify(s));`);
 const legacyEvents=await js('state.events');await win.reload();await until("typeof state!=='undefined' && state.settings.theme");
 await js(`state.events=${JSON.stringify(legacyEvents)};render()`);await travel('undo',2);await travel('redo',3);
 assert.equal(await js("JSON.parse(localStorage.getItem('nelumi-notebook-v1')).history.past.length"),1);
 console.log('Notice history passed: 3-level undo/redo, grouped endpoints, stable IDs, failure/retry, branch clearing, reload, legacy history and edit protection.');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
