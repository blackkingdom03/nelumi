const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {app,BrowserWindow}=require('electron');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const profile=path.join(__dirname,'..','.test-profile-holiday-ui-'+Date.now());fs.mkdirSync(profile);app.setPath('userData',profile);app.setPath('sessionData',profile);
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1050,height:850,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false}});
 await win.loadFile(path.join(root,'src/renderer/index.html'));const js=s=>win.webContents.executeJavaScript(s);
 await js(`window.calls=[];window.deskcal.getHolidays=async(year)=>{calls.push(year);return {status:'unpublished',data:null}};document.querySelector('#navCalendar').click();document.querySelector('#navigationYear').value='2027';document.querySelector('#navigationYearForm').requestSubmit();`);
 for(let i=0;i<50;i++){if((await js(`document.querySelector('#yearDataNotice').textContent`)).includes('暂未提供'))break;await new Promise(r=>setTimeout(r,20));}
 assert.match(await js(`document.querySelector('#yearDataNotice').textContent`),/暂未提供/);
 assert.equal(await js(`document.querySelectorAll('.mini-holiday-badge').length`),0);
 assert.match(await js(`document.querySelector('[data-nav-date="2027-02-06"]').textContent`),/春节/);
 await js(`window.deskcal.getHolidays=async(year)=>({status:'pending-review',data:{year,papers:['https://www.gov.cn/zhengce/example.htm'],days:[{date:'2027-01-01',name:'元旦',isOffDay:true}]}});document.querySelector('[data-holiday-refresh="2027"]').click();`);
 for(let i=0;i<50;i++){if((await js(`document.querySelector('#yearDataNotice').textContent`)).includes('待逐项核验'))break;await new Promise(r=>setTimeout(r,20));}
 assert.match(await js(`document.querySelector('#yearDataNotice').textContent`),/待逐项核验/);
 assert.equal(await js(`document.querySelectorAll('.mini-holiday-badge').length`),0);
 await js(`document.querySelector('[data-nav-date="2027-01-01"]').click()`);
 assert.equal(await js(`ChineseCalendar.getDayInfo(state.selectedDate).holiday`),null);
 await js(`window.deskcal.getHolidays=async()=>({status:'error',data:null});document.querySelector('#settingsDialog [data-holiday-refresh]').click()`);
 for(let i=0;i<50;i++){if((await js(`document.querySelector('#settingsDialog [data-holiday-status]').textContent`)).includes('失败'))break;await new Promise(r=>setTimeout(r,20));}
 assert.match(await js(`document.querySelector('#settingsDialog [data-holiday-status]').textContent`),/失败.*保留/);
 assert.equal(await js(`ChineseCalendar.getDayInfo('2027-01-01').holiday`),null);
 assert.equal(await js(`ChineseCalendar.getDayInfo('2026-01-01').holiday.badge`),'休');
 assert.equal(await js(`ChineseCalendar.getDayInfo('2057-09-28T12:00:00').lunarDay`),1);
 assert.match(await js(`NelumiHolidayUpdates.message(2057)`),/一日预测误差/);
 assert.match(await js(`NelumiHolidayUpdates.message(1901)`),/月份待核/);
 assert.match(await js(`NelumiHolidayUpdates.message(2026)`),/已对照国务院公告/);
 assert.equal(await js(`state.events.length`),0);
 console.log('Holiday UI passed: unknown and pending years cannot show official badges; traditional festivals, authority overrides, uncertainty, network fallback, no event changes.');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
