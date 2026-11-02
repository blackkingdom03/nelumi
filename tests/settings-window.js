const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const profile = path.join(__dirname, '..', `.test-profile-settings-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setPath('sessionData', profile);
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
const ignoreMouse = new WeakMap();
const nativeIgnoreMouse = BrowserWindow.prototype.setIgnoreMouseEvents;
BrowserWindow.prototype.setIgnoreMouseEvents = function (ignore, options) {
  ignoreMouse.set(this, ignore);
  return nativeIgnoreMouse.call(this, ignore, options);
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await wait(50); }
  throw new Error(`Timed out: ${label}`);
}
try {
  require(path.resolve(process.argv[2] || path.join(__dirname, '..'), 'src', 'main.js'));
} catch (error) {
  console.error(error);
  app.exit(1);
}
app.whenReady().then(async () => {
  await until(() => BrowserWindow.getAllWindows()[0]?.webContents.getURL(), 'calendar loads');
  const calendar = BrowserWindow.getAllWindows()[0];
  calendar.webContents.setBackgroundThrottling(false);
  const js = async code => {try {return await calendar.webContents.executeJavaScript(code);} catch(error) {throw new Error(`${error.message}\nRenderer expression: ${code}`);}};
  await until(async () => js(`typeof state !== 'undefined' && state.settings.opacity !== undefined`), 'calendar state');
  await js(`document.querySelector('#settingsButton').click()`);
  assert.equal(await js(`document.querySelector('#settingsDialog').matches(':modal')`), false, 'settings must not darken or block the calendar');
  assert.equal(BrowserWindow.getAllWindows().length, 1, 'popover uses the existing calendar state');
  assert.ok(await js(`document.querySelector('#settingsDialog').getBoundingClientRect().width <= 350`), 'compact reference-style panel');
  const savedOpacity = JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).settings.opacity;
  await js(`const range=document.querySelector('#opacityRange'); range.value='61'; range.dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await js(`document.documentElement.style.getPropertyValue('--surface-opacity')`), '0.61');
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).settings.opacity, savedOpacity, 'preview does not write disk');
  await js(`document.querySelector('#opacityRange').dispatchEvent(new Event('change',{bubbles:true}))`);
  await until(()=>JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).settings.opacity===.61,'opacity committed');
  await js(`document.querySelector('#themeControl [data-theme="default"]').click()`);
  await until(async()=>js(`document.documentElement.dataset.theme==='light'`),'theme updated');
  assert.equal(await js(`document.querySelector('#clickThroughToggle')`), null, 'removed mouse-through setting');
  for (const [theme, palette] of [['nord','A'],['sage','B'],['lavender','C'],['graphite','D']]) {
    await js(`document.querySelector('#themeControl [data-theme="${theme}"]').click()`);
    await until(async()=>js(`document.documentElement.dataset.palette==='${palette}'`), `palette ${palette} applied`);
    assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).settings.theme, theme);
    assert.equal(await js(`document.querySelectorAll('#themeControl [aria-pressed="true"]').length`), 1);
    assert.equal(await js(`getComputedStyle(document.documentElement).getPropertyValue('--surface-opacity').trim()`), '0.61', 'palette preserves opacity');
  }
  calendar.webContents.reload();
  await until(async()=>js(`document.documentElement.dataset.palette==='D'`), 'saved theme restored on reload');
  await js(`openSettings()`);
  assert.deepEqual(await js(`Array.from(document.querySelectorAll('#themeControl button')).map(b=>b.textContent.trim())`), ['默认配色','海盐蓝','抹茶绿','藤萝紫','曜石黑']);
  for (const theme of ['system','dark','light','default']) {
    await js(`updateSettings({theme:'${theme}'})`);
    await until(async()=>js(`document.documentElement.dataset.theme==='light' && !document.documentElement.dataset.palette`), 'default and legacy preferences restore original light palette');
    assert.equal(await js(`document.querySelector('#themeControl [data-theme="default"]').getAttribute('aria-pressed')`), 'true');
  }
  await js(`updateSettings({theme:'graphite'});`);
  await js(`document.querySelector('#themeControl [data-theme="default"]').click()`);
  assert.equal(await js(`document.documentElement.dataset.palette`), undefined, 'default button clears custom styling');
  const beforeBounds=calendar.getBounds();
  const drag=await js(`(() => { const r=document.querySelector('#settingsDragHandle').getBoundingClientRect(); const p=document.querySelector('#settingsDialog').getBoundingClientRect(); return {x:Math.round(r.left+30),y:Math.round(r.top+15),left:p.left,top:p.top}; })()`);
  calendar.webContents.sendInputEvent({type:'mouseDown',x:drag.x,y:drag.y,button:'left',clickCount:1});
  calendar.webContents.sendInputEvent({type:'mouseMove',x:drag.x-150,y:drag.y+50});
  calendar.webContents.sendInputEvent({type:'mouseUp',x:drag.x-150,y:drag.y+50,button:'left',clickCount:1});
  await wait(100);
  const moved=await js(`(() => {const r=document.querySelector('#settingsDialog').getBoundingClientRect();return {left:r.left,top:r.top};})()`);
  assert.ok(moved.left<drag.left-100,'drag moves the card left');
  assert.deepEqual(calendar.getBounds(),beforeBounds,'drag does not move calendar window');
  await js(`document.querySelector('#settingsDragHandle').focus()`);
  calendar.webContents.sendInputEvent({type:'keyDown',keyCode:'Home'});
  calendar.webContents.sendInputEvent({type:'keyUp',keyCode:'Home'});
  await js(`const cell=document.querySelector('.day-cell'); cell.click()`);
  assert.equal(await js(`document.querySelector('#settingsDialog').open`),true,'calendar remains usable while settings is open');
  await js(`updateSettings({clickThrough:!state.settings.clickThrough})`);
  await until(()=>JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).settings.clickThrough===true,'click-through saved');
  assert.equal(ignoreMouse.get(calendar),false,'open settings must remain clickable');
  await js(`openRecycleBin()`);
  await wait(100);
  assert.equal(ignoreMouse.get(calendar),false,'recycle bin must remain clickable with click-through enabled');
  await js(`document.querySelector('#recycleBinDialog').close()`);
  assert.equal(await js(`document.querySelector('#settingsDialog').open`),true,'return from recycle bin to usable settings');
  await js(`document.querySelector('[data-close-dialog="settingsDialog"]').click()`);
  await until(()=>ignoreMouse.get(calendar),'click-through resumes after closing settings');
  await js(`document.querySelector('#settingsButton').click()`);
  await until(()=>!ignoreMouse.get(calendar),'reopening settings suspends click-through');
  await js(`updateSettings({clickThrough:!state.settings.clickThrough})`);
  await until(()=>JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).settings.clickThrough===false,'click-through disabled');
  await js(`openEventDialog(null,'2027-05-01')`);
  assert.equal(await js(`document.querySelector('#eventDialog').matches(':modal')`),false,'event editor must not obscure the calendar');
  assert.ok(await js(`document.querySelector('#eventDialog').getBoundingClientRect().width<=380`),'compact event editor');
  await js(`document.querySelector('#eventTitle').value='保留草稿'; openEventDialog(null,'2027-05-02')`);
  assert.equal(await js(`document.querySelector('#eventTitle').value`),'保留草稿','opening another date must not discard a draft');
  const eventDrag=await js(`(() => {const r=document.querySelector('#eventDragHandle').getBoundingClientRect();return {x:Math.round(r.left+30),y:Math.round(r.top+15)};})()`);
  calendar.webContents.sendInputEvent({type:'mouseDown',x:eventDrag.x,y:eventDrag.y,button:'left',clickCount:1});
  calendar.webContents.sendInputEvent({type:'mouseMove',x:eventDrag.x-100,y:eventDrag.y+20});
  calendar.webContents.sendInputEvent({type:'mouseUp',x:eventDrag.x-100,y:eventDrag.y+20,button:'left',clickCount:1});
  await wait(100);
  assert.ok(await js(`document.querySelector('#eventDragHandle').getBoundingClientRect().left < ${eventDrag.x-80}`),'event card drags independently');
  await js(`updateSettings({clickThrough:!state.settings.clickThrough}); document.querySelector('#settingsDialog').close()`);
  await wait(100);
  assert.equal(ignoreMouse.get(calendar),false,'event editor retains click-through protection after settings closes');
  await js(`document.querySelector('#eventDialog').close()`);
  await until(()=>ignoreMouse.get(calendar),'closing last card restores click-through');
  await js(`openSettings(); updateSettings({clickThrough:!state.settings.clickThrough}); openEventDialog(null,'2027-05-01'); document.querySelector('#eventTitle').value='小卡片保存测试'; document.querySelector('#eventForm').requestSubmit()`);
  await until(()=>JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).events.some(e=>e.title==='小卡片保存测试'),'event saved');
  for(const zoom of [1,1.25]) {
    calendar.setSize(720,520); calendar.webContents.setZoomFactor(zoom); await wait(200);
    for (const theme of ['nord','sage','lavender','graphite']) {
      await js(`updateSettings({theme:'${theme}'})`);
      const fit = await js(`(() => {const p=document.querySelector('#settingsDialog'), c=document.querySelector('.theme-grid'); return {overflow:p.scrollWidth-p.clientWidth,columns:getComputedStyle(c).gridTemplateColumns.split(' ').length};})()`);
      assert.ok(fit.overflow<=0 && fit.columns===2, `${theme} theme cards fit at zoom ${zoom}`);
      assert.equal(await js(`getComputedStyle(document.querySelector('.agenda-panel')).gridTemplateColumns.split(' ').length`), 1, 'memo stacks in narrow windows');
    }
    await js(`document.querySelectorAll('#settingsDialog details').forEach(d=>d.open=true)`);
    await js(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const layout = await js(`(() => {const p=document.querySelector('#settingsDialog'); const b=document.querySelector('#exportButton'); b.scrollIntoView({block:'nearest'}); const r=p.getBoundingClientRect(),s=b.getBoundingClientRect(); return {panel:r.toJSON(),button:s.toJSON(),width:innerWidth,height:innerHeight,overflow:p.scrollWidth-p.clientWidth};})()`);
    assert.ok(layout.panel.left>=0&&layout.panel.right<=layout.width&&layout.panel.top>=0&&layout.panel.bottom<=layout.height&&layout.overflow<=0&&layout.button.bottom<=layout.height&&layout.button.right<=layout.width,`all controls reachable at small size: ${JSON.stringify(layout)}`);
    await js(`openEventDialog(null,'2027-05-01'); document.querySelector('#eventRepeat').value='weekly'; toggleRecurrenceFields(); new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    const editor = await js(`(() => {const p=document.querySelector('#eventDialog'); const b=p.querySelector('[type="submit"]'); b.scrollIntoView({block:'nearest'}); const r=p.getBoundingClientRect(),s=b.getBoundingClientRect(); return {panel:r.toJSON(),button:s.toJSON(),width:innerWidth,height:innerHeight,overflow:p.scrollWidth-p.clientWidth};})()`);
    assert.ok(editor.panel.left>=0&&editor.panel.right<=editor.width&&editor.panel.top>=0&&editor.panel.bottom<=editor.height&&editor.overflow<=0&&editor.button.bottom<=editor.height,`event controls reachable: ${JSON.stringify(editor)}`);
    await js(`document.querySelector('#eventDialog').close()`);
  }
  if(process.argv.includes('--preview')) {
    calendar.setSize(1000,760); calendar.webContents.setZoomFactor(1); await wait(300);
    await js(`document.querySelectorAll('#settingsDialog details').forEach(d=>d.open=false); document.querySelector('#settingsDialog').scrollTop=0; document.querySelector('.workspace').scrollTop=0; positionSettingsPanel(true); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    if(process.argv.includes('--event-preview')) await js(`document.querySelector('#settingsDialog').close(); openEventDialog(); document.querySelector('#eventDialog').scrollTop=0; positionFloatingPanel(document.querySelector('#eventDialog'),true); new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    console.log('PREVIEW_IMAGE:'+(await calendar.webContents.capturePage()).toDataURL());
  }
  await js(`document.querySelector('#settingsDialog').close(); document.querySelector('#noticeTab').click(); document.querySelector('#noticeInput').value='主题：本地持久化测试\\n时间：2026年11月12日'; document.querySelector('#noticeInput').dispatchEvent(new Event('input')); document.querySelector('#noticeForm').requestSubmit()`);
  await until(()=>JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).events.some(e=>e.title==='本地持久化测试' && e.sourceText.includes('11月12日')),'notice source persisted through real IPC');
  await js(`(async()=>{state.settings=await window.deskcal.updateSettings({clickThrough:true}); document.querySelector('#detailNotes').focus(); document.querySelector('#detailNotes').value='实际保存的笔记'; document.querySelector('#detailNotes').dispatchEvent(new Event('input')); document.querySelector('#detailNotes').blur();})()`);
  await until(()=>!ignoreMouse.get(calendar),'notebook draft suspends click-through');
  const originalRename=fs.renameSync;
  fs.renameSync=function(from,to){if(to===path.join(profile,'deskcal-data.json')) throw new Error('TEST_DISK_FAILURE');return originalRename.apply(this,arguments);};
  try {
    await js(`document.querySelector('#saveNotesButton').click()`);
    await until(async()=>js(`document.querySelector('#notebookStatus').textContent.includes('TEST_DISK_FAILURE')`),'failed native persistence surfaced');
    assert.equal(await js(`window.deskcal.getState().then(s=>s.events.find(e=>e.title==='本地持久化测试').notes)`),'','native memory rollback');
    assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).events.find(e=>e.title==='本地持久化测试').notes,'','disk remains intact');
  } finally {fs.renameSync=originalRename;}
  await js(`document.querySelector('#saveNotesButton').click()`);
  await until(()=>JSON.parse(fs.readFileSync(path.join(profile,'deskcal-data.json'))).events.some(e=>e.notes==='实际保存的笔记'),'native retry succeeds');
  await until(()=>ignoreMouse.get(calendar),'saved notebook releases click-through');
  console.log('Settings and event cards passed: no backdrop, pointer drag, draft protection, saving, click-through recovery, small-window controls.');
}).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1);});

