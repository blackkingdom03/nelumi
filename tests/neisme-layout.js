const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');
// Real renderer + its in-memory preview adapter: never reads/writes the user's schedules.
const profile = path.join(__dirname, '..', '.test-profile-layout');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setPath('sessionData', profile);
async function run() {
  const win = new BrowserWindow({ show: false, frame: false, width: 920, height: 760,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  const js = (source) => win.webContents.executeJavaScript(source);
  await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  await js(`new Promise(resolve => setTimeout(resolve, 100))`);
  await js(`state.viewDate=new Date(2026,9,1,12); state.selectedDate='2026-10-01';
    state.events=[{id:'layout-daily',title:'测试日程标题',date:'2026-01-01',allDay:true,calendarId:'personal',repeat:'daily',completed:false}]; render();`);
  const results = [];
  for (const [width, height, zoom] of [[920,760,1], [720,520,1], [920,760,1.25], [720,520,1.25], [1100,800,1.5], [1360,900,2]]) {
    win.setSize(width, height);
    win.webContents.setZoomFactor(zoom);
    for (let attempt=0; attempt<30; attempt++) {
      if(await js(`Math.abs(innerWidth-${width/zoom})<=1 && Math.abs(innerHeight-${height/zoom})<=1`)) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    for (const theme of ['default', 'nord', 'sage', 'lavender', 'graphite']) {
      for (const view of ['month', 'week']) {
        const result = await js(`(async () => {
          state.settings.theme = '${theme}'; state.settings.opacity = .55; applyTheme();
          document.querySelector('#calendarViewControl [data-view="${view}"]').click();
          void document.body.offsetWidth;
          const box = s => document.querySelector(s).getBoundingClientRect();
          const calendar = box('.calendar-panel'), agenda = box('.agenda-panel');
          const viewportWidth = innerWidth;
          const cells = [...document.querySelectorAll('.day-cell')];
          const clippedLabels = [...document.querySelectorAll('.chinese-day-label')].filter(el => {
            const style=getComputedStyle(el);
            return el.clientHeight + .5 < parseFloat(style.lineHeight) || el.scrollHeight > el.clientHeight;
          }).map(el=>({text:el.textContent,height:el.clientHeight,lineHeight:getComputedStyle(el).lineHeight}));
          const contained = cells.every(el => {const r=el.getBoundingClientRect(); return r.width > 40 && r.height >= 40 && r.left >= 0 && r.right <= viewportWidth;});
          const monthPreviews=[...document.querySelectorAll('.month-event-preview')];
          const monthTitlesFit=monthPreviews.every(el=>{
            const cell=el.closest('.day-cell'); const r=el.getBoundingClientRect(), c=cell.getBoundingClientRect();
            return r.bottom<=c.bottom-parseFloat(getComputedStyle(cell).paddingBottom)-1+.5 && r.top>=cell.querySelector('.chinese-day-label').getBoundingClientRect().bottom && el.scrollHeight<=el.clientHeight;
          });
          const reach = s => { const el=document.querySelector(s); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth; };
          const controls = ['#settingsButton','#addEventButton','#searchInput','#quickAddButton','#calendarStrip'].every(reach);
          document.querySelector('#settingsButton').click();
          document.querySelectorAll('#settingsDialog details').forEach(el=>el.open=true);
          const modal=box('#settingsDialog');
          const settingsFits=modal.top>=0 && modal.bottom<=innerHeight && modal.left>=0 && modal.right<=innerWidth;
          const settingsScrolls=document.querySelector('#settingsDialog').scrollHeight>document.querySelector('#settingsDialog').clientHeight;
          document.querySelector('#settingsDialog').close();
          document.querySelectorAll('#settingsDialog details').forEach(el=>el.open=false);
          document.querySelector('#addEventButton').click();
          const editorOpen=document.querySelector('#eventDialog').open;
          const editorSaveReachable=reach('#eventForm button[type="submit"]');
          document.querySelector('#eventDialog').close();
          const shell=document.querySelector('.app-shell');
          const lowAlpha=getComputedStyle(shell).backgroundColor;
          const textColor=getComputedStyle(document.querySelector('#monthTitle')).color;
          state.settings.opacity=1; applyTheme();
          const fullAlpha=getComputedStyle(shell).backgroundColor;
          const textUnchanged=textColor===getComputedStyle(document.querySelector('#monthTitle')).color && getComputedStyle(shell).opacity==='1';
          return {clippedLabels,viewportWidth:innerWidth,viewportHeight:innerHeight, below:agenda.top>=calendar.bottom-1, cells:cells.length,monthTitleCount:monthPreviews.length,minCellHeight:Math.min(...cells.map(el=>el.getBoundingClientRect().height)), contained,monthTitlesFit, controls,settingsFits,settingsScrolls,editorOpen,editorSaveReachable,
            opacityChanges:lowAlpha!==fullAlpha,textUnchanged, chinese:[...document.querySelectorAll('.chinese-day-label')].every(el=>el.textContent.trim()),
            noHorizontalOverflow:document.querySelector('.workspace').scrollWidth<=document.querySelector('.workspace').clientWidth };
        })()`);
        const name=`${width}x${height}@${zoom} ${theme} ${view}`;
        assert.deepEqual(result.clippedLabels, [], `${name}: lunar and solar-term lines must not be vertically clipped`);
        assert.ok(Math.abs(result.viewportWidth-width/zoom)<=1 && Math.abs(result.viewportHeight-height/zoom)<=1,`${name}: requested viewport/zoom must settle, got ${result.viewportWidth}x${result.viewportHeight}`);
        assert.equal(result.below,true,`${name}: agenda must be below calendar`);
        assert.equal(result.cells,view==='month'?42:7,`${name}: original grid size`);
        assert.equal(result.monthTitleCount,view==='month'?42:0,`${name}: fixture must exercise every month cell`);
        for (const key of ['contained','monthTitlesFit','controls','settingsFits','settingsScrolls','editorOpen','editorSaveReachable','opacityChanges','textUnchanged','chinese','noHorizontalOverflow']) assert.equal(result[key],true,`${name}: ${key}`);
        results.push({name,minCellHeight:result.minCellHeight});
      }
    }
  }
  // Exercise actual scrollable event content and preserved holiday labels.
  const overflow = await js(`(() => {
    state.viewDate=new Date(2026,9,1,12); state.selectedDate='2026-10-01'; state.viewMode='month';
    state.events=Array.from({length:24},(_,i)=>({id:'layout-'+i,title:'布局测试 '+i,date:'2026-10-01',allDay:true,calendarId:'personal',category:'work',repeat:'none',completed:false}));
    render();
    const list=document.querySelector('#agendaList'); list.scrollTop=list.scrollHeight;
    return {scrolls:list.scrollHeight>list.clientHeight && list.scrollTop>0, holiday:document.querySelector('[data-date="2026-10-01"] .day-badge')?.textContent,
      workday:document.querySelector('[data-date="2026-10-10"] .day-badge')?.textContent, items:list.querySelectorAll('.agenda-item').length,
      monthTitle:document.querySelector('[data-date="2026-10-01"] .month-event-preview')?.textContent,
      more:document.querySelector('[data-date="2026-10-01"] .day-count')?.textContent};
  })()`);
  assert.equal(overflow.scrolls,true,'full agenda must scroll');
  assert.equal(overflow.holiday,'休'); assert.equal(overflow.workday,'班'); assert.equal(overflow.items,24);
  assert.match(overflow.monthTitle,/布局测试/); assert.equal(overflow.more,'24');
  console.log('Neisme layout passed:', JSON.stringify({cases:results,overflow}));
  if (process.env.DESKCAL_LAYOUT_PREVIEW === '1' || process.argv.includes('--preview')) {
    win.setSize(920,760); win.webContents.setZoomFactor(1);
    await new Promise(resolve=>setTimeout(resolve,200));
    await js(`state.settings.theme='light'; state.settings.opacity=.86; render(); document.querySelector('.workspace').scrollTop=0; document.querySelector('#agendaList').scrollTop=0; new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    console.log('Preview metrics:', await js(`({width:innerWidth,height:innerHeight,calendar:document.querySelector('.calendar-panel').clientHeight,agenda:document.querySelector('.agenda-panel').clientHeight,scrollHeight:document.querySelector('.workspace').scrollHeight})`));
    // Emit pixels to the calling tool only. No screenshot file is written.
    const capture=await win.webContents.capturePage();
    console.log('PREVIEW_IMAGE:'+capture.toDataURL());
  }
  win.destroy();
}
app.whenReady().then(run).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1);});

