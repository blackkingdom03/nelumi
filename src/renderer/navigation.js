(() => {
  'use strict';
  // Original Bootstrap Icons v1.10.5 paths, MIT. See THIRD_PARTY_NOTICES.md.
  const house = '<path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.707 1.5ZM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5 5 5Z"/>';
  const calendar = '<path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z"/><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>';
  const icon = paths => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true">${paths}</svg>`;
  const MIN_YEAR = 1900, MAX_YEAR = 2100, LAST_PAGE = 2092;
  let page = 'home', year = new Date().getFullYear(), firstYear = 2020, drilldown = false;
  let browser, workspace, returnButton;
  const boundedYear = value => Math.min(MAX_YEAR, Math.max(MIN_YEAR, value));
  const yearPage = value => MIN_YEAR + Math.floor((boundedYear(value) - MIN_YEAR) / 12) * 12;
  const text = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

  function clearFilters() {
    state.searchQuery = '';
    state.filter = 'all';
    $('#searchInput').value = '';
    document.querySelectorAll('.filter-pill').forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
  }

  function selectDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    const date = parseDate(key);
    if (dateKey(date) !== key || date.getFullYear() < MIN_YEAR || date.getFullYear() > MAX_YEAR) return;
    year = date.getFullYear();
    page = 'home';
    drilldown = true;
    state.selectedDate = key;
    state.viewDate = startOfMonth(date);
    state.viewMode = 'month';
    clearFilters();
    render();
    workspace.scrollTop = 0;
    returnButton.focus({ preventScroll: true });
  }

  function showHome() {
    page = 'home';
    drilldown = false;
    state.viewMode = 'month';
    state.selectedDate = dateKey(new Date());
    state.viewDate = startOfMonth(new Date());
    clearFilters();
    render();
    workspace.scrollTop = 0;
  }

  function changePage(next, focusId) {
    page = next;
    renderNavigation();
    workspace.scrollTop = 0;
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  }

  function yearForm() {
    return `<form id="navigationYearForm" class="navigation-year-form"><label for="navigationYear">跳至年份</label><input id="navigationYear" name="year" type="number" min="${MIN_YEAR}" max="${MAX_YEAR}" step="1" value="${year}" required aria-describedby="navigationYearRange"><button type="submit">查看</button><span id="navigationYearRange">1900—2100 年</span></form>`;
  }

  function miniature(month) {
    const start = new Date(year, month, 1, 12);
    const blanks = (start.getDay() + 6) % 7;
    const last = new Date(year, month + 1, 0, 12).getDate();
    let days = '<span aria-hidden="true"></span>'.repeat(blanks);
    for (let day = 1; day <= last; day += 1) {
      const date = new Date(year, month, day, 12);
      const key = dateKey(date), info = ChineseCalendar.getDayInfo(date);
      const holiday = state.settings.showOfficialHolidays !== false && state.settings.showHolidayBadges !== false ? info.holiday : null;
      const labels = [state.settings.showLunar !== false ? info.fullLunarText : '',
        state.settings.showTraditionalFestivals !== false ? info.festival : '',
        state.settings.showSolarTerms !== false ? info.solarTerm : '',
        holiday ? `${holiday.name} ${holiday.type === 'workday' ? '调休上班' : '官方假期'}` : ''].filter(Boolean);
      const detail = labels.join(' · ');
      const smallLabel = (state.settings.showTraditionalFestivals !== false && info.festival) ||
        (state.settings.showSolarTerms !== false && info.solarTerm) || '';
      days += `<button type="button" data-nav-date="${key}" class="mini-day${key === dateKey(new Date()) ? ' today' : ''}${key === state.selectedDate ? ' selected' : ''}" title="${text(detail)}" aria-label="${year}年${month + 1}月${day}日 ${text(detail)}"><span>${day}</span>${holiday ? `<small class="mini-holiday-badge ${holiday.type}">${holiday.badge}</small>` : ''}${smallLabel ? `<small class="mini-day-label">${text(smallLabel)}</small>` : ''}</button>`;
    }
    return `<section class="mini-month" aria-label="${month + 1}月"><h3><button type="button" data-nav-month="${dateKey(start)}" aria-label="打开${year}年${month + 1}月月历">${month + 1}月</button></h3><div class="mini-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(day => `<span>${day}</span>`).join('')}</div><div class="mini-days">${days}</div></section>`;
  }

  function renderNavigation() {
    if (!browser) return;
    const browsing = page !== 'home';
    workspace.classList.toggle('year-browser-open', browsing);
    browser.hidden = !browsing;
    returnButton.hidden = browsing || !drilldown;
    returnButton.textContent = `← 返回 ${year} 年总览`;
    $('#navHome').setAttribute('aria-current', !browsing && !drilldown ? 'page' : 'false');
    $('#navCalendar').setAttribute('aria-current', browsing || drilldown ? 'page' : 'false');
    if (!browsing) return;
    if (page === 'years') {
      browser.innerHTML = `<div class="year-browser-heading"><h2 id="yearBrowserTitle" tabindex="-1">选择年份</h2><button type="button" data-nav-home>返回主页</button></div>${yearForm()}<div class="year-page-controls"><button type="button" id="previousYears" ${firstYear <= MIN_YEAR ? 'disabled' : ''} aria-label="前十二年">←</button><span aria-live="polite">${firstYear}—${Math.min(MAX_YEAR, firstYear + 11)}</span><button type="button" id="nextYears" ${firstYear + 11 >= MAX_YEAR ? 'disabled' : ''} aria-label="后十二年">→</button></div><div class="year-choice-grid">${Array.from({length:Math.min(12, MAX_YEAR - firstYear + 1)}, (_, i) => `<button type="button" data-nav-year="${firstYear + i}" ${firstYear + i === year ? 'aria-current="date"' : ''}>${firstYear + i}</button>`).join('')}</div>`;
    } else {
      browser.innerHTML = `<div class="year-browser-heading"><h2 id="yearBrowserTitle" tabindex="-1">${year} 年总览</h2><button type="button" id="backToYears">返回年份选择</button></div>${yearForm()}<div class="holiday-update-row"><p id="yearDataNotice" class="year-data-notice" data-holiday-status="${year}" role="status">${text(window.NelumiHolidayUpdates.message(year))}</p><button type="button" class="text-button" data-holiday-refresh="${year}">更新节假日</button></div><div class="year-months-grid">${Array.from({length:12}, (_, month) => miniature(month)).join('')}</div>`;
      window.NelumiHolidayUpdates.ensure(year);
      window.NelumiHolidayUpdates.paint();
    }
  }

  function init() {
    if (browser) return;
    workspace = $('.workspace');
    const navigation = document.createElement('nav');
    navigation.className = 'app-navigation';
    navigation.setAttribute('aria-label', '主导航');
    navigation.innerHTML = `<button type="button" id="navHome" title="主页" aria-label="主页">${icon(house)}</button><button type="button" id="navCalendar" title="日历" aria-label="日历">${icon(calendar)}</button>`;
    workspace.before(navigation);
    browser = document.createElement('section');
    browser.id = 'yearBrowser';
    browser.className = 'year-browser';
    browser.hidden = true;
    browser.setAttribute('aria-labelledby', 'yearBrowserTitle');
    workspace.append(browser);
    returnButton = document.createElement('button');
    returnButton.id = 'navBackToYear';
    returnButton.type = 'button';
    returnButton.className = 'navigation-return';
    returnButton.hidden = true;
    workspace.prepend(returnButton);
    returnButton.addEventListener('click', () => changePage('months', 'yearBrowserTitle'));
    $('#navHome').addEventListener('click', showHome);
    $('#navCalendar').addEventListener('click', () => {
      year = boundedYear(state.viewDate.getFullYear());
      firstYear = yearPage(year);
      changePage('years', 'yearBrowserTitle');
    });
    browser.addEventListener('submit', event => {
      if (event.target.id !== 'navigationYearForm') return;
      event.preventDefault();
      const input = $('#navigationYear'), value = Number(input.value);
      if (!input.checkValidity() || !Number.isInteger(value) || value < MIN_YEAR || value > MAX_YEAR) { input.reportValidity(); return; }
      year = value;
      firstYear = yearPage(year);
      changePage('months', 'yearBrowserTitle');
    });
    browser.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.hasAttribute('data-nav-home')) { showHome(); $('#navHome').focus(); }
      else if (button.dataset.navYear) { year = Number(button.dataset.navYear); changePage('months', 'yearBrowserTitle'); }
      else if (button.dataset.navDate || button.dataset.navMonth) selectDate(button.dataset.navDate || button.dataset.navMonth);
      else if (button.id === 'backToYears') { firstYear = yearPage(year); changePage('years', 'yearBrowserTitle'); }
      else if (button.id === 'previousYears' || button.id === 'nextYears') {
        firstYear = Math.max(MIN_YEAR, Math.min(LAST_PAGE, firstYear + (button.id === 'nextYears' ? 12 : -12)));
        changePage('years', button.id);
      }
    });
    renderNavigation();
  }
  window.NelumiNavigation = { init, render: renderNavigation, showHome, selectDate };
})();
