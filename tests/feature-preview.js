// In-memory visual inspection only: never writes captured pixels to disk.
const path=require('node:path');
const fs=require('node:fs');
const {app,BrowserWindow}=require('electron');
const profile=path.join(__dirname,'..',`.test-profile-feature-preview-${Date.now()}`);
fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);app.setPath('sessionData',profile);
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1050,height:900,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false}});
  await win.loadFile(path.join(__dirname,'..','src/renderer/index.html'));
  const js=code=>win.webContents.executeJavaScript(code);
  await js(`state.settings.theme='light';state.viewDate=new Date(2026,9,1);state.selectedDate='2026-10-23';state.events=[{id:'preview',title:'项目进度会议',date:'2026-10-23',allDay:false,startTime:'15:00',endTime:'16:00',calendarId:'personal',color:'#6750e8',category:'work',location:'三楼会议室',notes:'准备本周进度表。\\n会后整理待跟进事项。',sourceText:'通知：10月23日（周五）15:00—16:00在三楼会议室召开项目进度会议。\\n请各位带上本周进度表，提前十分钟到场。',recurrence:{frequency:'none'}}];render();NelumiNotebook.showEvent('preview','2026-10-23');document.querySelector('.workspace').scrollTop=0;new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  console.log('PREVIEW_LIGHT:'+(await win.webContents.capturePage()).toDataURL());
  await js(`state.settings.theme='dark';render();document.querySelector('#eventDetailPane').scrollIntoView({block:'end'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  console.log('PREVIEW_DARK:'+(await win.webContents.capturePage()).toDataURL());
  await js(`state.settings.theme='light';render();document.querySelector('#navCalendar').click();document.querySelector('#navigationYear').value='2026';document.querySelector('#navigationYearForm').requestSubmit();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  console.log('PREVIEW_YEAR:'+(await win.webContents.capturePage()).toDataURL());
}).then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)});
