(() => {
  const checks = new Map();
  let ready = false;
  function message(year) {
    const known = ChineseCalendar.getHolidaySchedule(year), check = checks.get(year);
    const calendar = ChineseCalendar.calendarVerification(year, `${year}-01-01`);
    const lunar = calendar.status === 'calculated' ? '农历、节气未核验' : calendar.status === 'partial' ? '农历、节气部分核验（1月1—19日月份待核）' : '农历、节气已对照天文台历表';
    const warning = calendar.note.includes('一日') ? '；本年部分日期存在一日预测误差提示' : '';
    const base = `${year}年${lunar}${warning}；${known ? '放假补班已对照国务院公告' : '官方放假补班尚未核验，不显示休/班'}`;
    if (check?.pending) return `${base} · 正在检查更新…`;
    if (check?.status === 'error') return `${base} · 联网检查失败，保留已有数据`;
    if (check?.status === 'unpublished') return `${base} · 数据源暂未提供正式安排`;
    if (check?.status === 'pending-review') return `${base} · 已获取候选安排，待逐项核验`;
    if (check?.status === 'conflict') return `${base} · 下载内容与已核验公告冲突，未采用`;
    return base;
  }
  function paint() {
    document.querySelectorAll('[data-holiday-status]').forEach(node => {
      const year = Number(node.dataset.holidayStatus) || state.viewDate.getFullYear();
      node.textContent = message(year);
    });
    document.querySelectorAll('[data-holiday-refresh]').forEach(button => {
      const year = Number(button.dataset.holidayRefresh) || state.viewDate.getFullYear();
      button.disabled = !!checks.get(year)?.pending || !window.deskcal.getHolidays || year < 2026 || year > 2100;
      button.title = window.deskcal.getHolidays ? `检查${year}年放假调休数据` : '联网更新在桌面版中可用；网页预览显示内置历法';
    });
  }
  async function ensure(year, force = false) {
    if (!ready || !window.deskcal.getHolidays || year < 2026 || year > 2100) return;
    const check = checks.get(year);
    if (check?.pending || (!force && check && Date.now() - check.time < (check.status === 'error' ? 300000 : 86400000))) return;
    checks.set(year, {pending:true, time:Date.now()}); paint();
    try {
      const result = await window.deskcal.getHolidays(year, force);
      if (result.data) ChineseCalendar.installHolidayData(result.data);
      checks.set(year, {status:result.status, time:Date.now()});
    } catch { checks.set(year, {status:'error', time:Date.now()}); }
    render();
  }
  function init(data) {
    for (const item of data || []) { try { ChineseCalendar.installHolidayData(item); } catch {} }
    ready = true;
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-holiday-refresh]');
      if (button && !button.disabled) ensure(Number(button.dataset.holidayRefresh) || state.viewDate.getFullYear(), true);
    });
    window.addEventListener('online', () => {
      ensure(state.viewDate.getFullYear(), true);
      ensure(new Date().getFullYear() + 1, true);
    });
    ensure(new Date().getFullYear() + 1);
  }
  window.NelumiHolidayUpdates = {init, ensure, paint, message};
})();
