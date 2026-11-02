const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {app,BrowserWindow}=require('electron');
const profile=path.resolve(`.test-profile-search-${Date.now()}`);fs.mkdirSync(profile);
app.setPath('userData',profile);app.setPath('sessionData',profile);
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1000,height:800,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false}});
 await win.loadFile(path.join(path.resolve(process.argv[2]||'.'),'src/renderer/index.html'));
 const js=s=>win.webContents.executeJavaScript(s);
 assert.equal(await js(`!!document.getElementById('toolbarSearchButton')`),true,'search entry exists');
 await js(`state.calendars=[{id:'personal',name:'个人',visible:true},{id:'hidden',name:'隐藏',visible:false}];state.events=[
 {id:'old',title:'项目会议',date:'2025-04-12',calendarId:'personal',notes:'准备季度材料',sourceText:'',completed:true},
 {id:'future',title:'未来项目',date:'2028-06-03',calendarId:'personal',notes:'',sourceText:'长通知'.repeat(200)+'特殊关键词'},
 {id:'series',title:'例会',date:'2026-01-01',calendarId:'personal',location:'会议室',recurrence:{frequency:'weekly',interval:1}},
 {id:'hidden',title:'项目隐藏',date:'2026-01-01',calendarId:'hidden'},
 {id:'deleted',title:'项目删除',date:'2026-01-01',calendarId:'personal',deletedAt:'2026-01-02'},
 {id:'html',title:'<img src=x onerror=alert(1)>会议',date:'2026-04-01',calendarId:'personal'}];render();window.eventsBefore=JSON.stringify(state.events);document.getElementById('toolbarSearchButton').click();`);
 const input=async q=>js(`document.getElementById('toolbarSearchInput').value=${JSON.stringify(q)};document.getElementById('toolbarSearchInput').dispatchEvent(new Event('input',{bubbles:true}))`);
 assert.equal(await js(`document.activeElement.id`),'toolbarSearchInput');
 assert.equal(await js(`document.querySelector('#toolbarSearchButton').getBoundingClientRect().right <= document.querySelector('#calendarViewControl').getBoundingClientRect().left`),true);
 await input('项目');assert.deepEqual(await js(`Array.from(document.querySelectorAll('[data-search-event]'),b=>b.dataset.searchEvent)`),['old','future']);
 await input('季度材料');assert.equal(await js(`document.querySelector('[data-search-event]').dataset.searchEvent`),'old');
 await input('特殊关键词');assert.equal(await js(`document.querySelector('[data-search-event]').dataset.searchEvent`),'future');
 await js(`document.querySelector('#searchInput').value='特殊关键词';document.querySelector('#searchInput').dispatchEvent(new Event('input',{bubbles:true}))`);
 assert.equal(await js(`document.querySelector('.agenda-item').dataset.id`),'future');
 await input('<img');assert.equal(await js(`document.querySelector('#toolbarSearchResults img')`),null);
 assert.match(await js(`document.querySelector('[data-search-event]').textContent`),/<img/);
 await input('找不到任何事项');assert.match(await js(`document.querySelector('#toolbarSearchStatus').textContent`),/没有找到/);
 await input('  ');assert.equal(await js(`document.querySelectorAll('[data-search-event]').length`),0);
 await input('特殊关键词');
 await js(`document.querySelector('#toolbarSearchInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}))`);
 assert.equal(await js(`document.querySelector('#toolbarSearchPanel').matches(':popover-open')`),true,'IME Enter must not navigate');
 await js(`document.querySelector('[data-search-event]').click()`);
 assert.equal(await js(`state.selectedDate`),'2028-06-03');assert.equal(await js(`document.querySelector('#detailTitle').textContent`),'未来项目');
 assert.equal(await js(`document.querySelector('#toolbarSearchPanel').matches(':popover-open')`),false);
 await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true}));`);
 assert.equal(await js(`document.activeElement.id`),'toolbarSearchInput');
 await input('会议室');assert.match(await js(`document.querySelector('[data-search-event]').textContent`),/重复.*起始/);
 await js(`document.querySelector('[data-search-event]').focus();render()`);
 assert.equal(await js(`document.activeElement.dataset.searchEvent`),'series','async renders retain keyboard result focus');
 await js(`document.querySelector('#toolbarSearchInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
 assert.equal(await js(`document.querySelector('#toolbarSearchButton').getAttribute('aria-expanded')`),'false');
 await js(`document.querySelector('.workspace').scrollTop=0;document.querySelector('#toolbarSearchButton').click()`);
 const point=await js(`(()=>{const r=document.querySelector('#toolbarSearchButton').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});
 await new Promise(r=>setTimeout(r,50));
 assert.equal(await js(`document.querySelector('#toolbarSearchPanel').matches(':popover-open')`),false,'pointer click on trigger closes the popover');
 await js(`document.querySelector('#toolbarSearchButton').click();state.events.find(x=>x.id==='series').deletedAt='2026-01-02';render()`);
 assert.equal(await js(`document.querySelectorAll('[data-search-event]').length`),0,'open results refresh after deletion');
 await js(`delete state.events.find(x=>x.id==='series').deletedAt;render()`);
 assert.equal(await js(`JSON.stringify(state.events)===window.eventsBefore`),true,'search never mutates events');
 for(const theme of ['light','dark']){
  win.setSize(720,560);await js(`state.settings.theme=${JSON.stringify(theme)};render();window.dispatchEvent(new Event('resize'))`);
  const rect=await js(`(()=>{const r=document.querySelector('#toolbarSearchPanel').getBoundingClientRect();return {x:r.x,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight}})()`);
  assert.ok(rect.x>=0&&rect.right<=rect.w&&rect.bottom<=rect.h,JSON.stringify(rect));
 }
 console.log('Toolbar search passed: A icon, cross-year/notes/full-notice search, hidden/deleted exclusion, legacy agreement, safe text, IME, navigation/details, keyboard, live updates and narrow themes.');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
