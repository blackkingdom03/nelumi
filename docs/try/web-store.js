(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NelumiWebStore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const SCHEMA = 'nelumi-web-trial';
  const MAX_BYTES = 4 * 1024 * 1024;
  const defaults = {
    theme: 'default', windowMode: 'window', opacity: 1, clickThrough: false,
    startOnBoot: false, sound: true, showLunar: true, showTraditionalFestivals: true,
    showCommemorativeDays: false, showSolarTerms: true, showOfficialHolidays: true,
    showHolidayBadges: true, highlightWeekends: true
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function check(condition, message) {
    if (!condition) throw new Error(message);
  }
  function safe(value, depth = 0) {
    check(depth <= 12, '备份嵌套层数过多');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'string') { check(value.length <= 100000, '文本超出长度限制'); return; }
    if (typeof value === 'number') { check(Number.isFinite(value), '无效数字'); return; }
    check(typeof value === 'object', '仅支持 JSON 数据');
    check(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, '无效数据对象');
    check(Object.keys(value).length <= 10000, '数据项过多');
    for (const name of Object.keys(value)) {
      check(!['__proto__', 'constructor', 'prototype'].includes(name), '备份包含不安全字段');
      safe(value[name], depth + 1);
    }
  }
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function id(value) { return typeof value === 'string' && value.length > 0 && value.length <= 200; }
  function time(value) { return value === '' || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)); }
  function settings(value) {
    check(object(value), '设置格式不正确');
    for (const [key, item] of Object.entries(value)) {
      check(Object.hasOwn(defaults, key), '不支持的设置字段: ' + key);
      if (key === 'opacity') check(typeof item === 'number' && item >= 0.2 && item <= 1, '透明度必须在 0.2 到 1 之间');
      else if (key === 'theme') check(typeof item === 'string' && /^[a-zA-Z0-9_-]{1,50}$/.test(item), '主题名称不正确');
      else if (key === 'windowMode') check(['window', 'desktop', 'floating', 'top'].includes(item), '窗口模式不正确');
      else check(typeof item === 'boolean', '设置值必须是布尔值: ' + key);
    }
    return { ...defaults, ...value };
  }
  function validate(value) {
    safe(value);
    check(object(value) && Object.keys(value).every(key => ['events', 'calendars', 'settings'].includes(key)), '日历数据格式不正确');
    check(Array.isArray(value.calendars) && value.calendars.length > 0 && value.calendars.length <= 100, '日历数量必须在 1 到 100 之间');
    const calendars = new Set();
    for (const calendar of value.calendars) {
      check(object(calendar) && id(calendar.id) && !calendars.has(calendar.id), '日历 ID 无效或重复');
      check(typeof calendar.name === 'string' && calendar.name.trim().length > 0 && calendar.name.length <= 200, '日历名称不正确');
      check(typeof calendar.color === 'string' && /^#[a-fA-F0-9]{6}$/.test(calendar.color), '日历颜色不正确');
      check(typeof calendar.visible === 'boolean', '日历显示设置不正确');
      calendars.add(calendar.id);
    }
    check(Array.isArray(value.events) && value.events.length <= 10000, '日程数量超出限制');
    const ids = new Set();
    for (const event of value.events) {
      check(object(event) && id(event.id) && !ids.has(event.id), '日程 ID 无效或重复');
      ids.add(event.id);
      check(typeof event.title === 'string' && event.title.trim().length > 0 && event.title.length <= 2000, '日程标题不正确');
      for (const key of ['notes', 'location', 'sourceText', 'category', 'color']) {
        if (event[key] !== undefined) check(typeof event[key] === 'string', '日程字段必须是文本: ' + key);
      }
      if (event.color !== undefined) check(/^#[a-fA-F0-9]{6}$/.test(event.color), '日程颜色不正确');
      check(date(event.date), '日程日期无效');
      check(event.calendarId === undefined || calendars.has(event.calendarId), '日程所属日历不存在');
      for (const key of ['startTime', 'endTime', 'allDayReminderTime']) {
        if (event[key] !== undefined) check(time(event[key]), '日程时间无效');
      }
      for (const key of ['allDay', 'completed']) {
        if (event[key] !== undefined) check(typeof event[key] === 'boolean', '日程状态无效');
      }
      for (const key of ['createdAt', 'updatedAt', 'deletedAt']) {
        if (event[key] != null) check(typeof event[key] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(event[key]) && date(event[key].slice(0, 10)) && Number.isFinite(Date.parse(event[key])), '日程时间戳无效');
      }
      if (event.exceptions !== undefined) check(Array.isArray(event.exceptions) && event.exceptions.every(date), '例外日期无效');
      if (event.reminders !== undefined) check(Array.isArray(event.reminders) && event.reminders.every(item => Number.isInteger(item) && item >= 0 && item <= 525600), '提醒设置无效');
      if (event.repeat !== undefined) check(['none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays'].includes(event.repeat), '重复频率无效');
      if (event.recurrence !== undefined) {
        const recurrence = event.recurrence;
        check(object(recurrence) && ['none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays'].includes(recurrence.frequency), '重复规则无效');
        // Splitting/deleting from the first occurrence closes the old series before its start.
        if (recurrence.until != null && recurrence.until !== '') check(date(recurrence.until), '重复截止日期无效');
        if (recurrence.interval !== undefined) check(Number.isInteger(recurrence.interval) && recurrence.interval >= 1 && recurrence.interval <= 9999, '重复间隔无效');
        if (recurrence.count != null) check(Number.isInteger(recurrence.count) && recurrence.count >= 1 && recurrence.count <= 100000, '重复次数无效');
      }
    }
    return clone({ events: value.events, calendars: value.calendars, settings: settings(value.settings) });
  }
  function encode(data) {
    const text = JSON.stringify({ schema: SCHEMA, version: 1, data });
    check(text.length <= MAX_BYTES, '备份超出 4 MB 字符限制');
    return text;
  }
  function decode(text) {
    check(typeof text === 'string' && text.length <= MAX_BYTES, '备份必须是 4 MB 内的 JSON 文本');
    const parsed = JSON.parse(text);
    safe(parsed);
    check(object(parsed) && parsed.schema === SCHEMA && parsed.version === 1, '备份 schema 或版本不支持');
    check(Object.keys(parsed).every(key => ['schema', 'version', 'data'].includes(key)), '备份包含未知字段');
    return validate(parsed.data);
  }
  function createStore({ storage, key = 'nelumi-web-trial-v1', onError } = {}) {
    let state = { events: [], calendars: [{ id: 'personal', name: '个人', color: '#6750e8', visible: true, createdAt: null }], settings: { ...defaults } };
    let blocked = null;
    let lastRaw = null;
    function report(error) {
      if (typeof onError === 'function') { try { onError(error); } catch (_) { /* Preserve the original failure. */ } }
    }
    try {
      check(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function', '浏览器存储不可用，无法保存');
      const persisted = storage.getItem(key);
      if (persisted !== null) state = decode(persisted);
      lastRaw = persisted;
    } catch (error) {
      blocked = new Error('浏览器存储不可用或数据损坏；请先备份并恢复原始存储。' + error.message);
      report(blocked);
    }
    function write(next) {
      try {
        if (blocked) throw blocked;
        const validated = validate(next);
        const text = encode(validated);
        if (storage.getItem(key) !== lastRaw) {
          blocked = new Error('其他页面已更新日历；请刷新后再保存或导出。');
          throw blocked;
        }
        storage.setItem(key, text);
        lastRaw = text;
        state = validated;
      } catch (error) { report(error); throw error; }
    }
    return {
      getState: () => clone(state),
      saveEvents(events) { write({ ...state, events }); return { ok: true }; },
      saveCalendars(calendars) { write({ ...state, calendars }); return clone(state.calendars); },
      updateSettings(patch) { safe(patch); check(object(patch), '设置格式不正确'); write({ ...state, settings: { ...state.settings, ...patch } }); return clone(state.settings); },
      exportBackup() {
        if (blocked) { report(blocked); throw blocked; }
        return encode(state);
      },
      importBackup(text) {
        const incoming = decode(text);
        const merge = (existing, added) => {
          const ids = new Set(existing.map(item => item.id));
          return [...existing, ...added.filter(item => !ids.has(item.id))];
        };
        write({ events: merge(state.events, incoming.events), calendars: merge(state.calendars, incoming.calendars), settings: state.settings });
        return clone(state);
      }
    };
  }
  return { createStore };
});
