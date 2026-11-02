const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');
const profile = path.join(__dirname, '..', '.test-profile-navigation');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setPath('sessionData', profile);

async function run() {
  const win = new BrowserWindow({ show: false, frame: false, width: 920, height: 760,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  win.webContents.on('console-message', (details) => { if (details.level >= 2) console.error('Renderer:', details.message); });
  const js = async source => {
    try { return await win.webContents.executeJavaScript(source); }
    catch (error) { throw new Error(`${error.message}\nRenderer expression: ${source}`); }
  };
  await win.loadFile(path.join(path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..')), 'src', 'renderer', 'index.html'));
  await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  // Optional module-only mode while the parent change is still integrating script tags.
  if (process.argv.includes('--isolate-navigation') && !await js('!!window.NelumiNavigation')) {
    await win.webContents.insertCSS(fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'navigation.css'), 'utf8'));
    await js(fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'navigation.js'), 'utf8'));
    await js('window.NelumiNavigation.init(); window.originalRenderForNavigationTest=render; render=()=>{window.originalRenderForNavigationTest(); window.NelumiNavigation.render();}; render()');
  }
  assert.equal(await js('!!document.querySelector("#navCalendar")'), true, 'calendar sidebar must be integrated');
  await js('document.querySelector("#navCalendar").click()');
  assert.equal(await js('document.querySelectorAll("[data-nav-year]").length'), 12);
  const first = await js('Number(document.querySelector("[data-nav-year]").dataset.navYear)');
  await js('document.querySelector("#nextYears").click()');
  assert.equal(await js('Number(document.querySelector("[data-nav-year]").dataset.navYear)'), first + 12);
  await js('document.querySelector("#previousYears").click()');
  assert.equal(await js('Number(document.querySelector("[data-nav-year]").dataset.navYear)'), first);
  const openYear = year => js(`document.querySelector('#navigationYear').value='${year}'; document.querySelector('#navigationYearForm').requestSubmit()`);
  await openYear(2028);
  assert.equal(await js('document.querySelectorAll(".mini-month").length'), 12);
  assert.equal(await js('document.querySelectorAll("[data-nav-date]").length'), 366);
  assert.match(await js('document.querySelector("#yearDataNotice").textContent'), /官方放假补班尚未核验，不显示休\/班/);
  assert.equal(await js('document.querySelectorAll(".mini-holiday-badge").length'), 0);
  await js('document.querySelector("[data-nav-date=\\"2028-02-29\\"]").click()');
  assert.deepEqual(await js('({date:state.selectedDate,month:state.viewDate.getMonth(),mode:state.viewMode,hidden:document.querySelector("#yearBrowser").hidden})'), {date:'2028-02-29',month:1,mode:'month',hidden:true});
  await js('state.searchQuery="old"; state.filter="completed"; document.querySelector("#searchInput").value="old"; document.querySelector("#navHome").click()');
  assert.deepEqual(await js('({today:state.selectedDate===dateKey(new Date()),month:state.viewDate.getMonth()===new Date().getMonth(),query:state.searchQuery,filter:state.filter,input:document.querySelector("#searchInput").value,active:document.querySelector(".filter-pill.active").dataset.filter})'), {today:true,month:true,query:'',filter:'all',input:'',active:'all'});
  await js('document.querySelector("#navCalendar").click()');
  await openYear(2026);
  assert.equal(await js('document.querySelector("[data-nav-date=\\"2026-10-01\\"] .mini-holiday-badge").textContent'), '休');
  assert.equal(await js('document.querySelector("[data-nav-date=\\"2026-10-10\\"] .mini-holiday-badge").textContent'), '班');
  await js('document.querySelector("[data-nav-month=\\"2026-10-01\\"]").click()');
  assert.equal(await js('state.selectedDate'), '2026-10-01');
  await js('document.querySelector("#navCalendar").click()');
  await openYear(2026);
  await js('state.settings.showOfficialHolidays=false; render()');
  assert.equal(await js('document.querySelectorAll(".mini-holiday-badge").length'), 0);
  await js('state.settings.showOfficialHolidays=true; render()');
  await openYear(2080);
  await js('document.querySelector("#backToYears").click(); document.querySelector("#nextYears").click(); document.querySelector("#previousYears").click()');
  assert.equal(await js('Number(document.querySelector("[data-nav-year]").dataset.navYear)'), 2080, 'end-of-range page navigation must be reversible');
  await openYear(2100);
  assert.equal(await js('document.querySelectorAll("[data-nav-date]").length'), 365);
  await js('document.querySelector("#backToYears").click()');
  await openYear(1900);
  assert.equal(await js('document.querySelectorAll("[data-nav-date]").length'), 365);
  const layout = [];
  for (const zoom of [1, 1.25]) {
    win.setSize(720, 520);
    win.webContents.setZoomFactor(zoom);
    await new Promise(resolve => setTimeout(resolve, 150));
    for (const theme of ['light','dark']) {
      const result = await js(`(() => {
        state.settings.theme='${theme}'; applyTheme();
        const workspace=document.querySelector('.workspace');
        const nav=document.querySelector('.app-navigation').getBoundingClientRect();
        const month=document.querySelector('.mini-month').getBoundingClientRect();
        const icon=getComputedStyle(document.querySelector('#navHome svg'));
        const last=document.querySelector('[data-nav-date="1900-12-31"]');
        last.scrollIntoView({block:'center'}); const r=last.getBoundingClientRect();
        return {noOverflow:workspace.scrollWidth<=workspace.clientWidth,navWidth:nav.width,monthFits:month.left>=0&&month.right<=innerWidth,reachable:r.bottom<=innerHeight&&r.top>=0,iconFill:icon.fill,iconStroke:icon.stroke,iconWidth:icon.width};
      })()`);
      assert.equal(result.noOverflow, true); assert.ok(Math.abs(result.navWidth - 44) < .01);
      assert.equal(result.monthFits,true); assert.equal(result.reachable,true);
      assert.notEqual(result.iconFill, 'none'); assert.equal(result.iconStroke, 'none'); assert.equal(result.iconWidth, '16px');
      layout.push({zoom,theme,...result});
    }
  }
  console.log('Navigation passed:', JSON.stringify(layout));
  win.destroy();
}
app.whenReady().then(run).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });

