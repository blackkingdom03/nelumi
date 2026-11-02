if (!window.deskcal) {
  const previewStore = {
    events: [],
    calendars: [
      {
        id: 'personal',
        name: '个人',
        color: '#6750e8',
        visible: true,
        createdAt: null
      }
    ],
    settings: {
      theme: 'default',
      windowMode: 'desktop',
      opacity: 0.96,
      clickThrough: false,
      startOnBoot: false,
      sound: true,
      showLunar: true,
      showTraditionalFestivals: true,
      showCommemorativeDays: false,
      showSolarTerms: true,
      showOfficialHolidays: true,
      showHolidayBadges: true,
      highlightWeekends: true
    }
  };
  window.deskcal = {
    getState: async () => structuredClone(previewStore),
    saveEvents: async (events) => {
      previewStore.events = structuredClone(events);
      return { ok: true };
    },
    saveCalendars: async (calendars) => {
      previewStore.calendars = structuredClone(calendars);
      return structuredClone(previewStore.calendars);
    },
    updateSettings: async (patch) => {
      Object.assign(previewStore.settings, patch);
      return structuredClone(previewStore.settings);
    },
    windowAction: async () => true,
    exportData: async () => ({ canceled: true }),
    importData: async () => ({ canceled: true }),
    onCreateRequest: () => {},
    onOpenSettings: () => {},
    onSettingsChanged: () => {},
    onReminder: () => {},
    onReminderOpen: () => {}
  };
}

const { dateKey, parseDate, daysBetween, occursOn, normalizeRecurrence } = window.DeskCalCore;
const ChineseCalendar = window.DeskCalChineseCalendar;
const QuickInput = window.DeskCalQuickInput;
const PlannerCore = window.DeskCalPlannerCore;

const state = {
  events: [],
  calendars: [],
  settings: {},
  viewDate: startOfMonth(new Date()),
  selectedDate: dateKey(new Date()),
  viewMode: 'month',
  filter: 'all',
  searchQuery: '',
  editingId: null,
  editingOccurrenceDate: null,
  quickEditingId: null,
  quickEditingDate: null,
  scopeResolver: null,
  undoSnapshot: null
};

const weekdayLong = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const weekdayShortMonday = ['一', '二', '三', '四', '五', '六', '日'];
const categoryLabels = {
  work: '工作',
  study: '学习',
  life: '生活',
  important: '重要'
};
const repeatLabels = {
  none: '',
  daily: '每天重复',
  weekdays: '工作日重复',
  weekly: '每周重复',
  monthly: '每月重复',
  yearly: '每年重复'
};
const repeatUnits = {
  daily: '天',
  weekly: '周',
  monthly: '个月',
  yearly: '年'
};

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function startOfWeek(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  result.setHours(12, 0, 0, 0);
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function activeEvents() {
  return state.events.filter((event) => !event.deletedAt);
}

function calendarById(id) {
  return state.calendars.find((calendar) => calendar.id === id);
}

function eventColor(event) {
  return calendarById(event.calendarId || 'personal')?.color || event.color || '#6750e8';
}

function visibleEvents() {
  const visibleIds = new Set(
    state.calendars.filter((calendar) => calendar.visible !== false).map((calendar) => calendar.id)
  );
  return activeEvents().filter((event) => visibleIds.has(event.calendarId || 'personal'));
}

// Both search entries share the existing local, literal keyword matching rule.
function searchEvents(value) {
  const query = value.trim().toLowerCase();
  if (!query) return [];
  return visibleEvents().filter(event =>
    [event.title, event.notes, event.sourceText, event.location, categoryLabels[event.category]]
      .join(' ').toLowerCase().includes(query)
  ).sort((a,b)=>a.date.localeCompare(b.date));
}

function conflictIdsForDate(key) {
  const timed = occurrencesForDate(key)
    .map(({ event }) => event)
    .filter((event) => !event.allDay && !event.completed);
  const ids = new Set();
  for (let first = 0; first < timed.length; first += 1) {
    for (let second = first + 1; second < timed.length; second += 1) {
      if (PlannerCore.timeRangesOverlap(timed[first], timed[second])) {
        ids.add(timed[first].id);
        ids.add(timed[second].id);
      }
    }
  }
  return ids;
}

function occurrencesForDate(key) {
  const date = parseDate(key);
  return visibleEvents()
    .filter((event) => occursOn(event, date))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.startTime || '').localeCompare(b.startTime || '');
    })
    .map((event) => ({ event, occurrenceDate: key }));
}

function eventsForDate(key) {
  return occurrencesForDate(key).map((item) => item.event);
}

function upcomingOccurrences(dayCount = 7) {
  const today = parseDate(dateKey(new Date()));
  const result = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addDays(today, offset);
    result.push(...occurrencesForDate(dateKey(date)));
  }
  return result;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatRecurrenceLabel(event) {
  const recurrence = normalizeRecurrence(event);
  if (recurrence.frequency === 'none') return window.NelumiLunar.label(event.lunarDate);
  const base = repeatLabels[recurrence.frequency] || '重复日程';
  const interval =
    recurrence.interval > 1 && repeatUnits[recurrence.frequency]
      ? `每${recurrence.interval}${repeatUnits[recurrence.frequency]}`
      : base;
  const limit = [
    window.NelumiLunar.label(event.lunarDate),
    recurrence.until ? `至${recurrence.until}` : '',
    recurrence.count ? `${recurrence.count}次` : ''
  ]
    .filter(Boolean)
    .join(' · ');
  return limit ? `${interval} · ${limit}` : interval;
}

function visibleChineseLabel(info) {
  if (state.settings.showTraditionalFestivals !== false && info.traditionalFestival) {
    return { text: info.traditionalFestival, type: 'festival' };
  }
  if (info.solarFestival) return { text: info.solarFestival, type: 'festival' };
  if (
    state.settings.showOfficialHolidays !== false &&
    info.holiday?.type === 'holiday' &&
    info.holiday.isStart
  ) {
    return { text: `${info.holiday.name}假期`, type: 'festival' };
  }
  if (state.settings.showSolarTerms !== false && info.solarTerm) {
    return { text: info.solarTerm, type: 'solar-term' };
  }
  if (state.settings.showCommemorativeDays && info.commemorativeDay) {
    return { text: info.commemorativeDay, type: 'commemorative' };
  }
  if (state.settings.showLunar !== false) return { text: info.lunarText, type: 'lunar' };
  return { text: '', type: 'none' };
}

function applyTheme() {
  const theme = state.settings.theme || 'default';
  const palette = { nord: 'A', sage: 'B', lavender: 'C', graphite: 'D' }[theme];
  document.documentElement.dataset.theme = palette === 'D' ? 'dark' : 'light';
  if (palette) document.documentElement.dataset.palette = palette;
  else delete document.documentElement.dataset.palette;
  document.documentElement.style.setProperty(
    '--surface-opacity', String(Math.min(1, Math.max(.55, Number(state.settings.opacity) || .96)))
  );
}

function renderWeekHeader() {
  const highlight = state.settings.highlightWeekends !== false;
  $('#weekHeader').innerHTML = weekdayShortMonday
    .map((day, index) => `<span class="${highlight && index >= 5 ? 'weekend' : ''}">${day}</span>`)
    .join('');
}

function renderDayCell(date, referenceMonth, isWeekView) {
  const key = dateKey(date);
  const todayKey = dateKey(new Date());
  const chineseInfo = ChineseCalendar.getDayInfo(date);
  const chineseLabel = visibleChineseLabel(chineseInfo);
  const events = eventsForDate(key);
  const conflictIds = conflictIdsForDate(key);
  const showOfficialHoliday = state.settings.showOfficialHolidays !== false;
  const holiday = showOfficialHoliday ? chineseInfo.holiday : null;
  const holidayBadge =
    holiday && state.settings.showHolidayBadges !== false
      ? `<span class="day-badge ${holiday.type}">${holiday.badge}</span>`
      : '';
  const dots = events
    .slice(0, 3)
    .map(
      (event) =>
        `<span class="event-dot ${conflictIds.has(event.id) ? 'conflict' : ''}" style="background:${escapeHtml(
          eventColor(event)
        )}"></span>`
    )
    .join('');
  const more = events.length > 3 ? `<span class="event-more">+${events.length - 3}</span>` : '';
  // Presentation only: one readable title at every supported window size.
  // Click the date to inspect the complete list in the agenda below.
  const monthPreview = !isWeekView && events.length
    ? `<span class="month-event-line"><span class="month-event-preview" data-detail-event-id="${escapeHtml(events[0].id)}" style="--event-color:${escapeHtml(eventColor(events[0]))}" title="${escapeHtml([events[0].title,window.NelumiLunar.label(events[0].lunarDate)].filter(Boolean).join(' · '))}">${events[0].lunarDate?'农历 · ':''}${escapeHtml(events[0].title)}</span></span>`
    : '';
  const weekPreviews = isWeekView
    ? events
        .slice(0, 5)
        .map((event) => {
          const startMinutes = PlannerCore.minutesFromTime(event.startTime);
          const endMinutes = PlannerCore.minutesFromTime(event.endTime);
          const duration =
            !event.allDay && startMinutes !== null && endMinutes > startMinutes
              ? endMinutes - startMinutes
              : 30;
          const cardHeight = event.allDay ? 28 : Math.max(30, Math.min(54, 24 + duration / 10));
          return `
            <span
              class="week-event-preview ${conflictIds.has(event.id) ? 'conflict' : ''}"
              draggable="true"
              data-drag-event-id="${escapeHtml(event.id)}"
              data-occurrence-date="${key}"
              style="--event-color:${escapeHtml(eventColor(event))};min-height:${cardHeight}px"
              title="拖动调整日期和时间"
            >
              ${escapeHtml(event.allDay ? event.title : `${event.startTime} ${event.title}`)}
              ${
                event.allDay
                  ? ''
                  : `<span
                      class="week-resize-handle"
                      data-resize-event-id="${escapeHtml(event.id)}"
                      data-occurrence-date="${key}"
                      title="向下拖动调整时长"
                    ></span>`
              }
            </span>
          `;
        })
        .join('')
    : '';
  return `
    <div tabindex="0"
      class="day-cell ${!isWeekView && date.getMonth() !== referenceMonth ? 'outside' : ''} ${
        isWeekView ? 'week-cell' : ''
      } ${key === todayKey ? 'today' : ''} ${key === state.selectedDate ? 'selected' : ''} ${
        state.settings.highlightWeekends !== false && chineseInfo.isWeekend ? 'weekend' : ''
      } ${holiday?.type === 'holiday' ? 'official-holiday' : ''} ${
        holiday?.type === 'workday' ? 'workday-override' : ''
      }"
      data-date="${key}"
      role="gridcell"
      aria-label="${date.getMonth() + 1}月${date.getDate()}日，${
        state.settings.showLunar !== false ? chineseInfo.fullLunarText : ''
      }${holiday ? `，${holiday.name}${holiday.type === 'holiday' ? '休息' : '调休上班'}` : ''}，${
        events.length
      }项日程"
    >
      <span class="day-top">
        <span class="day-number">${date.getDate()}</span>
        <span class="day-indicators">${holidayBadge}${events.length ? `<button type="button" class="day-count" data-day-count="${key}" aria-haspopup="dialog" aria-expanded="false" aria-controls="dayCountPanel" aria-label="查看当天全部${events.length}项日程" title="当天共${events.length}项日程">${events.length}</button>` : ''}</span>
      </span>
      <span class="chinese-day-label ${chineseLabel.type}">${escapeHtml(chineseLabel.text)}</span>
      ${isWeekView ? `<span class="event-dots">${dots}${more}</span>` : monthPreview}
      ${weekPreviews}
    </div>
  `;
}

function chooseRecurrenceScope(title, message) {
  $('#scopeDialogTitle').textContent = title;
  $('#scopeDialogMessage').textContent = message;
  $('#recurrenceScopeDialog').showModal();
  return new Promise((resolve) => {
    state.scopeResolver = resolve;
  });
}

function rememberUndo(label) {
  state.undoSnapshot = {
    label,
    events: structuredClone(state.events)
  };
}

async function undoLastChange() {
  if (!state.undoSnapshot) return;
  const snapshot = state.undoSnapshot;
  state.undoSnapshot = null;
  state.events = snapshot.events;
  await window.deskcal.saveEvents(state.events);
  render();
  showToast(`已撤销${snapshot.label}`);
}

function applyScopedEventChange(event, occurrenceDate, changes, scope) {
  const result = PlannerCore.applyOccurrenceChange(
    event,
    occurrenceDate,
    changes,
    scope,
    () => crypto.randomUUID()
  );
  const index = state.events.findIndex((item) => item.id === event.id);
  state.events[index] = result.original;
  if (result.detached) state.events.push(result.detached);
}

async function moveOccurrence(eventId, occurrenceDate, targetDate, targetStartTime = null) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  const recurrence = normalizeRecurrence(event);
  let scope = 'series';
  if (recurrence.frequency !== 'none') {
    scope = await chooseRecurrenceScope(
      '移动重复日程',
      `“${event.title}”要移动哪一部分？`
    );
    if (scope === 'cancel') return;
  }

  const changes = {
    date:
      recurrence.frequency !== 'none' && scope === 'series'
        ? dateKey(
            addDays(
              parseDate(event.date),
              daysBetween(parseDate(occurrenceDate), parseDate(targetDate))
            )
          )
        : targetDate
  };
  if(event.lunarDate && scope!=='occurrence' && targetDate!==occurrenceDate) {
    showToast('农历系列请在编辑日程中修改农历日期；移动某一天可选“仅本次”');return;
  }
  if (!event.allDay && targetStartTime) {
    const start = PlannerCore.minutesFromTime(event.startTime);
    const end = PlannerCore.minutesFromTime(event.endTime);
    const target = PlannerCore.minutesFromTime(targetStartTime);
    const duration = start !== null && end !== null && end > start ? end - start : 60;
    changes.startTime = targetStartTime;
    changes.endTime = PlannerCore.timeFromMinutes(Math.min(1439, target + duration));
  }
  const candidate = { ...event, ...changes };
  const conflicts = PlannerCore.conflictsForCandidate(
    candidate,
    visibleEvents(),
    targetDate,
    event.id
  );
  if (
    conflicts.length &&
    !confirm(`该时间与“${conflicts[0].title}”冲突，仍然继续移动吗？`)
  ) {
    return;
  }

  rememberUndo('日程移动');
  applyScopedEventChange(event, occurrenceDate, changes, scope);
  state.selectedDate = targetDate;
  state.viewDate = parseDate(targetDate);
  await saveEvents('日程已移动', {
    label: '撤销',
    handler: undoLastChange
  });
}

async function resizeOccurrence(eventId, occurrenceDate, deltaMinutes) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event || event.allDay || !deltaMinutes) return;
  const end = PlannerCore.minutesFromTime(event.endTime);
  const start = PlannerCore.minutesFromTime(event.startTime);
  if (start === null || end === null) return;
  const nextEnd = Math.max(start + 30, Math.min(1439, end + deltaMinutes));
  let scope = 'series';
  if (normalizeRecurrence(event).frequency !== 'none') {
    scope = await chooseRecurrenceScope(
      '调整日程时长',
      `“${event.title}”要调整哪一部分？`
    );
    if (scope === 'cancel') return;
  }
  const changes = { endTime: PlannerCore.timeFromMinutes(nextEnd) };
  const candidate = { ...event, ...changes };
  const conflicts = PlannerCore.conflictsForCandidate(
    candidate,
    visibleEvents(),
    occurrenceDate,
    event.id
  );
  if (
    conflicts.length &&
    !confirm(`延长后与“${conflicts[0].title}”时间冲突，仍然继续吗？`)
  ) {
    return;
  }
  rememberUndo('时长调整');
  applyScopedEventChange(event, occurrenceDate, changes, scope);
  await saveEvents('日程时长已调整', { label: '撤销', handler: undoLastChange });
}

function bindWeekDrag() {
  $all('[data-drag-event-id]').forEach((preview) => {
    preview.addEventListener('click', (event) => {
      event.stopPropagation();
      window.NelumiNotebook.showEvent(preview.dataset.dragEventId, preview.dataset.occurrenceDate);
    });
    preview.addEventListener('dblclick', (event) => event.stopPropagation());
    preview.addEventListener('dragstart', (event) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'application/x-deskcal-event',
        JSON.stringify({
          eventId: preview.dataset.dragEventId,
          occurrenceDate: preview.dataset.occurrenceDate
        })
      );
      preview.classList.add('dragging');
    });
    preview.addEventListener('dragend', () => preview.classList.remove('dragging'));
  });

  $all('.day-cell.week-cell').forEach((cell) => {
    cell.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      cell.classList.add('drag-target');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-target'));
    cell.addEventListener('drop', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      cell.classList.remove('drag-target');
      let payload;
      try {
        payload = JSON.parse(event.dataTransfer.getData('application/x-deskcal-event'));
      } catch {
        return;
      }
      const source = state.events.find((item) => item.id === payload.eventId);
      if (!source) return;
      let targetStartTime = null;
      if (!source.allDay) {
        const rect = cell.getBoundingClientRect();
        const usableTop = rect.top + 76;
        const ratio = Math.max(0, Math.min(1, (event.clientY - usableTop) / (rect.bottom - usableTop)));
        const minutes = Math.round((8 * 60 + ratio * 12 * 60) / 30) * 30;
        targetStartTime = PlannerCore.timeFromMinutes(Math.min(minutes, 20 * 60));
      }
      await moveOccurrence(
        payload.eventId,
        payload.occurrenceDate,
        cell.dataset.date,
        targetStartTime
      );
    });
  });

  $all('[data-resize-event-id]').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      handle.closest('.week-event-preview')?.classList.add('resizing');
      const finish = async (finishEvent) => {
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
        handle.closest('.week-event-preview')?.classList.remove('resizing');
        const slots = Math.round((finishEvent.clientY - startY) / 12);
        if (slots) {
          await resizeOccurrence(
            handle.dataset.resizeEventId,
            handle.dataset.occurrenceDate,
            slots * 30
          );
        }
      };
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    });
  });
}

function renderCalendar() {
  window.NelumiDayCount?.close();
  const isWeekView = state.viewMode === 'week';
  const referenceDate = isWeekView ? parseDate(state.selectedDate) : state.viewDate;
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const missing=visibleEvents().filter(event=>{
    if(!event.lunarDate || normalizeRecurrence(event).frequency!=='yearly') return false;
    const start=window.NelumiLunar.fromSolar(event.date),r=normalizeRecurrence(event);
    if(!start || year<start.year || (year-start.year)%r.interval || (r.until && r.until<(window.NelumiLunar.toSolar(year,{month:1,day:1}) || `${year}-01-01`)) || window.NelumiLunar.toSolar(year,event.lunarDate)) return false;
    if(r.count){let previous=0;for(let y=start.year;y<year;y+=r.interval){const d=window.NelumiLunar.toSolar(y,event.lunarDate);if(d && d>=event.date) previous++;}if(previous>=r.count) return false;}
    return true;
  });
  $('#lunarYearNotice').classList.toggle('hidden',!missing.length);
  $('#lunarYearNotice').textContent=missing.length?`${year}农历年：${missing.map(e=>`${e.title}（${window.NelumiLunar.label(e.lunarDate)}）`).join('、')}没有对应日期或超出历表范围，未自动安排及提醒，请编辑确认。`:'';
  const first = new Date(year, month, 1, 12);
  const gridStart = isWeekView
    ? startOfWeek(referenceDate)
    : new Date(year, month, 1 - ((first.getDay() + 6) % 7), 12);
  const cellCount = isWeekView ? 7 : 42;

  if (isWeekView) {
    const gridEnd = addDays(gridStart, 6);
    $('#monthTitle').textContent = `${gridStart.getMonth() + 1}月${gridStart.getDate()}日 – ${
      gridEnd.getMonth() + 1
    }月${gridEnd.getDate()}日`;
  } else {
    $('#monthTitle').textContent = `${year}年${month + 1}月`;
  }
  $('#calendarGrid').classList.toggle('week-view', isWeekView);
  $('.month-summary').classList.toggle('hidden', isWeekView);
  $all('#calendarViewControl button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === state.viewMode);
  });

  const cells = [];
  for (let index = 0; index < cellCount; index += 1) {
    cells.push(renderDayCell(addDays(gridStart, index), month, isWeekView));
  }
  $('#calendarGrid').innerHTML = cells.join('');

  $all('.day-cell').forEach((button) => {
    button.addEventListener('click', (click) => {
      const showCount = Boolean(click.target.closest('[data-day-count]'));
      const detailId = click.target.closest('[data-detail-event-id]')?.dataset.detailEventId;
      state.selectedDate = button.dataset.date;
      const selected = parseDate(state.selectedDate);
      state.viewDate = isWeekView ? selected : startOfMonth(selected);
      render();
      if (detailId) window.NelumiNotebook.showEvent(detailId, state.selectedDate);
      if (showCount) window.NelumiDayCount.open(state.selectedDate);
    });
    button.addEventListener('keydown', e => {if(e.target===button && ['Enter',' '].includes(e.key)){e.preventDefault();button.click();}});
    button.addEventListener('dblclick', e => {if(!e.target.closest('[data-day-count]'))openEventDialog(null, button.dataset.date);});
  });
  if (isWeekView) bindWeekDrag();

  const monthEvents = visibleEvents().filter((event) => {
    const original = parseDate(event.date);
    if (normalizeRecurrence(event).frequency !== 'none') {
      for (let day = 1; day <= 31; day += 1) {
        const date = new Date(year, month, day, 12);
        if (date.getMonth() !== month) break;
        if (occursOn(event, date)) return true;
      }
      return false;
    }
    return original.getFullYear() === year && original.getMonth() === month;
  });
  $('#monthEventCount').textContent = monthEvents.length;
  $('#monthCompletedCount').textContent = monthEvents.filter((event) => event.completed).length;
  $('#monthPendingCount').textContent = monthEvents.filter((event) => !event.completed).length;
}

function renderSelectedDayDetails(selected, allEvents) {
  const chineseInfo = ChineseCalendar.getDayInfo(selected);
  $('#selectedDateTitle').textContent = `${selected.getMonth() + 1}月${selected.getDate()}日`;
  $('#selectedDateMeta').textContent = `${weekdayLong[selected.getDay()]} · ${allEvents.length}项安排`;
  $('#selectedLunarMeta').textContent = `${chineseInfo.fullLunarText} · 生肖${chineseInfo.zodiac}`;
  $('#selectedLunarMeta').title = `${chineseInfo.calendarVerification.note}\n${chineseInfo.calendarVerification.source || ''}`;
  $('#selectedLunarMeta').classList.toggle('hidden', state.settings.showLunar === false);

  const tags = [];
  if (state.settings.showOfficialHolidays !== false && chineseInfo.holiday) {
    const holiday = chineseInfo.holiday;
    const description =
      holiday.type === 'workday'
        ? `${holiday.name} · 调休上班`
        : `${holiday.name}假期 · 第${holiday.index}/${holiday.total}天`;
    tags.push(
      `<span class="day-detail-tag ${holiday.type}"><b>${holiday.badge}</b>${escapeHtml(
        description
      )}</span>`
    );
  }
  if (
    state.settings.showTraditionalFestivals !== false &&
    chineseInfo.traditionalFestival &&
    chineseInfo.traditionalFestival !== chineseInfo.holiday?.name
  ) {
    tags.push(
      `<span class="day-detail-tag festival">${escapeHtml(
        chineseInfo.traditionalFestival
      )}</span>`
    );
  }
  if (state.settings.showSolarTerms !== false && chineseInfo.solarTerm) {
    tags.push(`<span class="day-detail-tag solar-term">${escapeHtml(chineseInfo.solarTerm)}</span>`);
  }
  if (state.settings.showCommemorativeDays && chineseInfo.commemorativeDay) {
    tags.push(
      `<span class="day-detail-tag commemorative">${escapeHtml(
        chineseInfo.commemorativeDay
      )}</span>`
    );
  }
  $('#selectedDayTags').innerHTML = tags.join('');
}

function renderAgendaItem(record, showDate) {
  const { event, occurrenceDate } = record;
  const occurrence = parseDate(occurrenceDate);
  const calendar = calendarById(event.calendarId || 'personal');
  const hasConflict =
    !event.allDay &&
    PlannerCore.conflictsForCandidate(event, visibleEvents(), occurrenceDate, event.id).length > 0;
  const timeText = event.allDay ? '全天' : event.startTime || '--:--';
  const time = showDate
    ? `<strong>${occurrence.getMonth() + 1}月${occurrence.getDate()}日</strong><span>${escapeHtml(
        timeText
      )}</span>`
    : event.allDay
      ? '<strong>全天</strong>'
      : `<strong>${escapeHtml(event.startTime || '--:--')}</strong><span>${escapeHtml(
          event.endTime || ''
        )}</span>`;
  const meta = [
    event.location,
    calendar?.name,
    categoryLabels[event.category] || '日程',
    formatRecurrenceLabel(event)
  ]
    .filter(Boolean)
    .join(' · ');
  return `
    <article
      class="agenda-item ${event.completed ? 'completed' : ''} ${hasConflict ? 'conflict' : ''}"
      data-id="${escapeHtml(event.id)}"
      data-occurrence-date="${escapeHtml(occurrenceDate)}"
      style="--event-color:${escapeHtml(eventColor(event))}"
    >
      <div class="agenda-time">${time}</div>
      <div class="agenda-content">
        <h3>${escapeHtml(event.title)}</h3>
        <p>${hasConflict ? '⚠ 时间冲突 · ' : ''}${escapeHtml(
          [(event.notes || '').slice(0, 160), meta].filter(Boolean).join(' · ')
        )}</p>
      </div>
      <div class="agenda-actions">
      <button class="complete-button" data-complete-id="${escapeHtml(
        event.id
      )}" aria-label="${event.completed ? '标记为未完成' : '标记完成'}">
        <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 7"/></svg>
      </button>
      <button class="agenda-delete-button" type="button" data-delete-id="${escapeHtml(event.id)}" aria-label="删除：${escapeHtml(event.title)}" title="删除日程">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>
      </button>
      </div>
    </article>
  `;
}

function bindAgendaItems() {
  $all('.agenda-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      if (event.target.closest('.agenda-actions')) return;
      window.NelumiNotebook.showEvent(item.dataset.id, item.dataset.occurrenceDate);
    });
    item.tabIndex = 0;
    item.addEventListener('keydown', event => {
      if (event.target === item && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        window.NelumiNotebook.showEvent(item.dataset.id, item.dataset.occurrenceDate);
      }
    });
  });
  $all('[data-delete-id]').forEach(button=>{
    button.addEventListener('click',async()=>{
      if(button.disabled)return;
      button.disabled=true;
      try {await quickDelete(button.dataset.deleteId,button.closest('.agenda-item').dataset.occurrenceDate);}
      catch(error){showToast('删除未完成：'+error.message+'，事项已保留。');}
      finally {button.disabled=false;}
    });
  });
  $all('.complete-button').forEach((button) => {
    button.addEventListener('click', async () => {
      const event = state.events.find((item) => item.id === button.dataset.completeId);
      if (!event) return;
      event.completed = !event.completed;
      event.updatedAt = new Date().toISOString();
      await saveEvents(event.completed ? '已标记为完成' : '已恢复为待办');
    });
  });
}

function renderAgenda() {
  const selected = parseDate(state.selectedDate);
  const selectedRecords = occurrencesForDate(state.selectedDate);
  const query = state.searchQuery.trim().toLowerCase();
  let records = selectedRecords;
  let showDate = false;
  let emptyTitle = state.filter === 'all' ? '今天留有余白' : '没有符合条件的日程';
  let emptyDescription = '双击日期或点击右上角的加号，记录下一件重要的事。';

  if (query) {
    records = searchEvents(query).map((event) => ({ event, occurrenceDate: event.date }));
    showDate = true;
    $('#selectedDateTitle').textContent = '搜索结果';
    $('#selectedDateMeta').textContent = `${records.length}项匹配“${state.searchQuery.trim()}”`;
    $('#selectedLunarMeta').classList.add('hidden');
    $('#selectedDayTags').innerHTML = '';
    emptyTitle = '没有找到相关日程';
    emptyDescription = '可以尝试搜索标题、地点、备注或分类。';
  } else if (state.filter === 'upcoming') {
    records = upcomingOccurrences(7);
    showDate = true;
    const today = new Date();
    const end = addDays(today, 6);
    $('#selectedDateTitle').textContent = '未来七天';
    $('#selectedDateMeta').textContent = `${today.getMonth() + 1}月${today.getDate()}日 – ${
      end.getMonth() + 1
    }月${end.getDate()}日 · ${records.length}项安排`;
    $('#selectedLunarMeta').classList.add('hidden');
    $('#selectedDayTags').innerHTML = '';
    emptyTitle = '未来七天没有安排';
    emptyDescription = '给自己留白，也可以快速添加下一件事。';
  } else {
    records = selectedRecords.filter(({ event }) => {
      if (state.filter === 'completed') return event.completed;
      if (state.filter === 'pending') return !event.completed;
      return true;
    });
    renderSelectedDayDetails(selected, selectedRecords);
  }

  if (!records.length) {
    $('#agendaList').innerHTML = `
      <div class="empty-state">
        <div class="empty-illustration"></div>
        <strong>${escapeHtml(emptyTitle)}</strong>
        <p>${escapeHtml(emptyDescription)}</p>
      </div>
    `;
    return;
  }
  $('#agendaList').innerHTML = records.map((record) => renderAgendaItem(record, showDate)).join('');
  bindAgendaItems();
}

function renderCalendarControls() {
  $('#calendarStrip').innerHTML = state.calendars
    .map(
      (calendar) => `
        <button
          type="button"
          class="calendar-chip ${calendar.visible !== false ? 'active' : ''}"
          data-calendar-toggle="${escapeHtml(calendar.id)}"
          title="${calendar.visible !== false ? '点击隐藏' : '点击显示'}${escapeHtml(calendar.name)}"
        >
          <span style="background:${escapeHtml(calendar.color)}"></span>
          ${escapeHtml(calendar.name)}
        </button>
      `
    )
    .join('');
  $all('[data-calendar-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const calendar = calendarById(button.dataset.calendarToggle);
      if (!calendar) return;
      calendar.visible = calendar.visible === false;
      await saveCalendars();
    });
  });

  const currentCalendar = $('#eventCalendar').value;
  $('#eventCalendar').innerHTML = state.calendars
    .map(
      (calendar) =>
        `<option value="${escapeHtml(calendar.id)}">${escapeHtml(calendar.name)}</option>`
    )
    .join('');
  $('#eventCalendar').value =
    state.calendars.some((calendar) => calendar.id === currentCalendar)
      ? currentCalendar
      : state.calendars[0]?.id || 'personal';

  $('#calendarManagerList').innerHTML = state.calendars
    .map(
      (calendar) => `
        <div class="calendar-manager-item" data-calendar-id="${escapeHtml(calendar.id)}">
          <input
            type="color"
            value="${escapeHtml(calendar.color)}"
            data-calendar-color="${escapeHtml(calendar.id)}"
            aria-label="${escapeHtml(calendar.name)}颜色"
          />
          <input
            type="text"
            maxlength="50"
            value="${escapeHtml(calendar.name)}"
            data-calendar-name="${escapeHtml(calendar.id)}"
            aria-label="日历名称"
          />
          <label class="calendar-visible-label">
            <input type="checkbox" data-calendar-visible="${escapeHtml(calendar.id)}" ${
              calendar.visible !== false ? 'checked' : ''
            } />
            显示
          </label>
          ${
            calendar.id === 'personal'
              ? '<span class="data-chip">默认</span>'
              : `<button type="button" class="danger-button" data-calendar-delete="${escapeHtml(
                  calendar.id
                )}">删除</button>`
          }
        </div>
      `
    )
    .join('');
  bindCalendarManager();
}

function bindCalendarManager() {
  $all('[data-calendar-color]').forEach((input) => {
    input.addEventListener('change', async () => {
      const calendar = calendarById(input.dataset.calendarColor);
      if (!calendar) return;
      calendar.color = input.value;
      await saveCalendars();
    });
  });
  $all('[data-calendar-name]').forEach((input) => {
    input.addEventListener('change', async () => {
      const calendar = calendarById(input.dataset.calendarName);
      if (!calendar || !input.value.trim()) return renderCalendarControls();
      calendar.name = input.value.trim();
      await saveCalendars();
    });
  });
  $all('[data-calendar-visible]').forEach((input) => {
    input.addEventListener('change', async () => {
      const calendar = calendarById(input.dataset.calendarVisible);
      if (!calendar) return;
      calendar.visible = input.checked;
      await saveCalendars();
    });
  });
  $all('[data-calendar-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const calendar = calendarById(button.dataset.calendarDelete);
      if (!calendar || !confirm(`删除“${calendar.name}”日历吗？其中的日程会移动到个人日历。`)) {
        return;
      }
      state.events.forEach((event) => {
        if (event.calendarId === calendar.id) event.calendarId = 'personal';
      });
      state.calendars = state.calendars.filter((item) => item.id !== calendar.id);
      await window.deskcal.saveEvents(state.events);
      await saveCalendars('日历已删除，原日程已移入个人日历');
    });
  });
}

async function saveCalendars(message = '') {
  state.calendars = await window.deskcal.saveCalendars(state.calendars);
  render();
  if (message) showToast(message);
}

function renderSettings() {
  $all('#windowModeControl button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === state.settings.windowMode);
  });
  $all('#themeControl button').forEach((button) => {
    const selectedTheme = ['nord', 'sage', 'lavender', 'graphite'].includes(state.settings.theme) ? state.settings.theme : 'default';
    button.classList.toggle('active', button.dataset.theme === selectedTheme);
    button.setAttribute('aria-pressed', String(button.dataset.theme === selectedTheme));
  });
  const opacity = Math.round((state.settings.opacity || 0.96) * 100);
  $('#opacityRange').value = opacity;
  $('#opacityValue').textContent = `${opacity}%`;
  $('#startOnBootToggle').checked = Boolean(state.settings.startOnBoot);
  $('#soundToggle').checked = state.settings.sound !== false;
  $('#lunarToggle').checked = state.settings.showLunar !== false;
  $('#traditionalFestivalToggle').checked = state.settings.showTraditionalFestivals !== false;
  $('#commemorativeToggle').checked = Boolean(state.settings.showCommemorativeDays);
  $('#solarTermToggle').checked = state.settings.showSolarTerms !== false;
  $('#officialHolidayToggle').checked = state.settings.showOfficialHolidays !== false;
  $('#holidayBadgeToggle').checked = state.settings.showHolidayBadges !== false;
  $('#weekendHighlightToggle').checked = state.settings.highlightWeekends !== false;
}

function render() {
  applyTheme();
  renderWeekHeader();
  renderCalendarControls();
  renderCalendar();
  renderAgenda();
  renderSettings();
  window.NelumiNotebook.render();
  window.NelumiNavigation.render();
  window.NelumiHolidayUpdates.ensure(state.viewDate.getFullYear());
  window.NelumiHolidayUpdates.paint();
  window.NelumiToolbarSearch.refresh();
}

function resetEventForm(date = state.selectedDate) {
  state.noticeDraft = null;
  $('#eventDraftHint').textContent = '';
  $('#eventDraftHint').classList.add('hidden');
  $all('#eventReminderOptions [data-custom-reminder]').forEach(node => node.remove());
  $('#eventForm').reset();
  $('#eventId').value = '';
  $('#eventDate').value = date;
  setLunarDateInputs(null,date);
  $('#eventStartTime').value = '09:00';
  $('#eventEndTime').value = '10:00';
  $('#eventAllDayReminderTime').value = '09:00';
  $all('#eventReminderOptions input').forEach((input) => {
    input.checked = input.value === '10';
  });
  $('#eventRepeat').value = 'none';
  $('#eventRepeatInterval').value = '1';
  $('#eventRepeatUntil').value = '';
  $('#eventRepeatCount').value = '';
  $('#eventEditScope').value = 'occurrence';
  $('#eventEditScopeField').classList.add('hidden');
  $('#eventCalendar').value = state.calendars[0]?.id || 'personal';
  $('#eventCategory').value = 'work';
  $('#eventColor').value = '#6750e8';
  $('#eventColorText').textContent = '#6750E8';
  $('#eventLocation').value = '';
  $('#deleteEventButton').classList.add('hidden');
  $('#skipOccurrenceButton').classList.add('hidden');
  $('#eventConflictWarning').classList.add('hidden');
  $('#eventConflictWarning').textContent = '';
  $('.time-field').classList.remove('hidden');
  toggleRecurrenceFields();
}

function openEventDialog(eventId = null, date = state.selectedDate) {
  const panel = $('#eventDialog');
  if (panel.open) {
    bringPanelForward(panel);
    $('#eventTitle').focus();
    return;
  }
  state.editingId = eventId;
  state.editingOccurrenceDate = date;
  resetEventForm(date);
  if (eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    $('#eventDialogTitle').textContent = '编辑日程';
    $('#eventId').value = event.id;
    $('#eventTitle').value = event.title;
    $('#eventDate').value =
      normalizeRecurrence(event).frequency !== 'none' && date ? date : event.date;
    $('#eventAllDay').checked = Boolean(event.allDay);
    $('#eventStartTime').value = event.startTime || '09:00';
    $('#eventEndTime').value = event.endTime || '10:00';
    $('#eventAllDayReminderTime').value = event.allDayReminderTime || '09:00';
    ensureReminderOptions(event.reminders || []);
    const reminders = new Set((event.reminders || []).map(String));
    $all('#eventReminderOptions input').forEach((input) => {
      input.checked = reminders.has(input.value);
    });
    const recurrence = normalizeRecurrence(event);
    $('#eventRepeat').value = recurrence.frequency;
    $('#eventRepeatInterval').value = String(recurrence.interval);
    $('#eventRepeatUntil').value = recurrence.until || '';
    $('#eventRepeatCount').value = recurrence.count ? String(recurrence.count) : '';
    $('#eventCalendar').value = event.calendarId || 'personal';
    $('#eventCategory').value = event.category || 'work';
    $('#eventColor').value = event.color || '#6750e8';
    $('#eventColorText').textContent = (event.color || '#6750e8').toUpperCase();
    $('#eventLocation').value = event.location || '';
    setLunarDateInputs(event.lunarDate,$('#eventDate').value);
    $('#eventNotes').value = event.notes || '';
    $('#deleteEventButton').classList.remove('hidden');
    if (recurrence.frequency !== 'none' && date && occursOn(event, parseDate(date))) {
      const occurrence = parseDate(date);
      $('#skipOccurrenceButton').textContent = `仅跳过${occurrence.getMonth() + 1}月${occurrence.getDate()}日`;
      $('#skipOccurrenceButton').classList.remove('hidden');
      $('#eventEditScopeField').classList.remove('hidden');
    }
  } else {
    $('#eventDialogTitle').textContent = '添加新日程';
  }
  toggleTimeFields();
  toggleRecurrenceFields();
  panel.show();
  syncEditingPanels();
  bringPanelForward(panel);
  positionFloatingPanel(panel, !panel.style.left);
  requestAnimationFrame(() => $('#eventTitle').focus());
}

function ensureReminderOptions(reminders) {
  for (const minutes of reminders) {
    if (!Number.isInteger(minutes) || minutes<0 || minutes>10080 || $(`#eventReminderOptions input[value="${minutes}"]`)) continue;
    const label=document.createElement('label'),input=document.createElement('input');
    label.dataset.customReminder='true';input.type='checkbox';input.value=String(minutes);
    const text=minutes%1440===0?`${minutes/1440}天`:minutes%60===0?`${minutes/60}小时`:`${minutes}分钟`;
    label.append(input,document.createTextNode(`提前${text}`));$('#eventReminderOptions').append(label);
  }
}

function openNoticeEventDraft(item, summary, save) {
  openEventDialog(null,item.date);
  state.noticeDraft={item,save};
  state.editingOccurrenceDate=null;
  $('#eventDialogTitle').textContent='确认日程';
  $('#eventDraftHint').textContent=summary || '已按消息填写，请检查后保存。';
  $('#eventDraftHint').classList.remove('hidden');
  $('#eventTitle').value=item.title;
  $('#eventDate').value=item.date;
  $('#eventAllDay').checked=item.allDay;
  $('#eventStartTime').value=item.startTime;
  $('#eventEndTime').value=item.endTime;
  $('#eventAllDayReminderTime').value=item.allDayReminderTime;
  $('#eventRepeat').value=item.recurrence.frequency;
  $('#eventRepeatInterval').value=String(item.recurrence.interval);
  $('#eventRepeatUntil').value=item.recurrence.until || '';
  $('#eventRepeatCount').value=item.recurrence.count || ''; 
  $('#eventLocation').value=item.location;
  $('#eventCategory').value=item.category;
  setLunarDateInputs(item.lunarDate,item.date,item.dateCalendar==='lunar',item.lunarYear);
  ensureReminderOptions(item.reminders);
  $all('#eventReminderOptions input').forEach(input=>{input.checked=item.reminders.includes(Number(input.value));});
  toggleTimeFields();toggleRecurrenceFields();
}

function setLunarDateInputs(rule,date,forceLunar=false,year=null) {
  const Lunar=window.NelumiLunar,converted=Lunar.fromSolar(date);
  $('#eventDateCalendar').value=rule || forceLunar?'lunar':'solar';
  $('#eventLunarMonth').innerHTML='<option value="">请选择月份</option>'+Lunar.monthNames.map((name,i)=>`<option value="${i+1}">${name}月</option>`).join('');
  $('#eventLunarDay').innerHTML='<option value="">请选择日期</option>'+Lunar.dayNames.map((name,i)=>`<option value="${i+1}">${name}</option>`).join('');
  $('#eventLunarYear').value=year || converted?.year || new Date().getFullYear();
  $('#eventLunarMonth').value=rule?.month || (forceLunar?'':converted?.month || '');
  $('#eventLunarDay').value=rule?.day || (forceLunar?'':converted?.day || '');
  $('#eventLunarLeap').checked=rule?.leap ?? (forceLunar?false:converted?.leap || false);
  syncLunarDateInputs();
}

function readLunarDateInputs() {
  return window.NelumiLunar.normalize({month:Number($('#eventLunarMonth').value),day:Number($('#eventLunarDay').value),leap:$('#eventLunarLeap').checked});
}

function syncLunarDateInputs() {
  const lunar=$('#eventDateCalendar').value==='lunar',Lunar=window.NelumiLunar;
  $('#eventLunarFields').classList.toggle('hidden',!lunar);
  $all('#eventLunarFields input, #eventLunarFields select').forEach(input=>{input.disabled=!lunar;input.required=lunar && input.type!=='checkbox';});
  $('#eventDate').readOnly=lunar;
  $('#eventDate').required=!lunar;
  $('#eventDateLabel').textContent=lunar?'对应公历日期':'日期';
  $('#eventLunarYear').setCustomValidity('');
  $all('#eventRepeat option').forEach(option=>{option.disabled=lunar && !['none','yearly'].includes(option.value);});
  if(lunar) {
    const rule=readLunarDateInputs(),date=Lunar.toSolar(Number($('#eventLunarYear').value),rule);
    $('#eventDate').value=date || '';
    const hint=date?`${Lunar.label(rule)} → ${date}`:'该年份没有这一天，或日期未填完整，请选择有效的农历日期';
    $('#eventLunarHint').textContent=hint+'。支持农历1901—2099年；每年重复时，缺少该闰月或三十的年份不安排、不提醒，并保留待确认提示。';
    if(!date) $('#eventLunarYear').setCustomValidity('请核对农历年月日，该年可能没有所选闰月或三十。');
    if(!['none','yearly'].includes($('#eventRepeat').value)) $('#eventRepeat').value='none';
  }
  toggleRecurrenceFields();
}

function toggleTimeFields() {
  const allDay = $('#eventAllDay').checked;
  $all('.time-field').forEach((field) => field.classList.toggle('hidden', allDay));
  $all('.all-day-time-field').forEach((field) => field.classList.toggle('hidden', !allDay));
  $('#eventStartTime').required = !allDay;
  $('#eventEndTime').required = !allDay;
}

function toggleRecurrenceFields() {
  const frequency = $('#eventRepeat').value;
  const repeats = frequency !== 'none';
  const supportsInterval = repeats && frequency !== 'weekdays';
  $('#repeatIntervalField').classList.toggle('hidden', !supportsInterval);
  $('#repeatUntilField').classList.toggle('hidden', !repeats);
  $('#repeatCountField').classList.toggle('hidden', !repeats);
  $('#repeatIntervalUnit').textContent = repeatUnits[frequency] || '天';
  $('#eventRepeatInterval').disabled = !supportsInterval;
  $('#eventRepeatUntil').disabled = !repeats;
  $('#eventRepeatCount').disabled = !repeats;
}

function previewEventConflict() {
  if ($('#eventAllDay').checked) {
    $('#eventConflictWarning').classList.add('hidden');
    return;
  }
  const candidate = {
    id: $('#eventId').value,
    date: $('#eventDate').value,
    allDay: false,
    startTime: $('#eventStartTime').value,
    endTime: $('#eventEndTime').value
  };
  const conflicts = PlannerCore.conflictsForCandidate(
    candidate,
    visibleEvents(),
    candidate.date,
    candidate.id || null
  );
  $('#eventConflictWarning').classList.toggle('hidden', !conflicts.length);
  $('#eventConflictWarning').textContent = conflicts.length
    ? `⚠ 与“${conflicts[0].title}”时间冲突`
    : '';
}

async function saveEvents(message = '日程已保存', action = null) {
  await window.deskcal.saveEvents(state.events);
  render();
  showToast(message, 'nelumi', action);
}

async function submitEventForm(event) {
  event.preventDefault();
  if (state.noticeDraftSaving) return;
  const noticeDraft=state.noticeDraft;
  const existing = state.events.find((item) => item.id === $('#eventId').value);
  const frequency = $('#eventRepeat').value;
  const until = $('#eventRepeatUntil').value || null;
  const count = Number($('#eventRepeatCount').value) || null;
  const reminders = $all('#eventReminderOptions input:checked').map((input) =>
    Number(input.value)
  );
  const value = {
    id: existing?.id || crypto.randomUUID(),
    title: $('#eventTitle').value.trim(),
    date: $('#eventDate').value,
    allDay: $('#eventAllDay').checked,
    lunarDate: $('#eventDateCalendar').value==='lunar' ? readLunarDateInputs() : null,
    startTime: $('#eventAllDay').checked ? '' : $('#eventStartTime').value,
    endTime: $('#eventAllDay').checked ? '' : $('#eventEndTime').value,
    allDayReminderTime: $('#eventAllDayReminderTime').value || '09:00',
    reminders,
    recurrence: {
      frequency,
      interval: frequency === 'weekdays' ? 1 : Number($('#eventRepeatInterval').value) || 1,
      until,
      count
    },
    repeat: frequency,
    exceptions: existing?.exceptions || [],
    calendarId: $('#eventCalendar').value || 'personal',
    category: $('#eventCategory').value,
    color: $('#eventColor').value,
    location: $('#eventLocation').value.trim(),
    notes: $('#eventNotes').value.trim(),
    sourceText: existing?.sourceText || noticeDraft?.item.sourceText || '',
    ...(noticeDraft ? {titleAutomation:{version:window.DeskCalNoticeInput.TITLE_VERSION,lastTitle:$('#eventTitle').value.trim(),originalTitle:noticeDraft.item.title,manual:true}} : {}),
    ...(existing?.titleAutomation ? {titleAutomation:{...existing.titleAutomation,manual:existing.titleAutomation.manual || $('#eventTitle').value.trim()!==existing.title}} : {}),
    completed: existing?.completed || false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!value.title) return;
  if(!window.DeskCalCore.isDateKey(value.date) || ($('#eventDateCalendar').value==='lunar' && (!value.lunarDate || window.NelumiLunar.toSolar(Number($('#eventLunarYear').value),value.lunarDate)!==value.date))) {
    showToast('请核对日期后保存');return;
  }
  if (noticeDraft && value.allDay && value.reminders.length && !$('#eventAllDayReminderTime').value) {
    showToast('请填写全天提醒时间','提醒时间待确认');
    return;
  }
  if ($('#eventNotes').value.length > 20000) {
    showToast('笔记最多 20,000 字符，请精简后保存', '输入内容已保留');
    return;
  }
  if (!value.allDay && value.endTime <= value.startTime) {
    showToast('结束时间必须晚于开始时间', '请调整日程时间');
    return;
  }
  if (value.recurrence.until && value.recurrence.until < value.date) {
    showToast('重复截止日期不能早于开始日期', '请调整重复规则');
    return;
  }
  const conflictDate = value.date;
  const conflicts = PlannerCore.conflictsForCandidate(
    value,
    visibleEvents(),
    conflictDate,
    existing?.id || null
  );
  if (conflicts.length) {
    $('#eventConflictWarning').textContent = `与“${conflicts[0].title}”时间冲突`;
    $('#eventConflictWarning').classList.remove('hidden');
    if (!confirm(`该时间与“${conflicts[0].title}”冲突，仍然保存吗？`)) return;
  }

  if (noticeDraft) {
    state.noticeDraftSaving=true;
    try { await noticeDraft.save(value); }
    finally { state.noticeDraftSaving=false; }
    return;
  }
  if (existing) {
    const recurrence = normalizeRecurrence(existing);
    const scope =
      recurrence.frequency === 'none' ? 'series' : $('#eventEditScope').value || 'occurrence';
    let scopedValue =
      scope === 'series' && !existing.lunarDate && !value.lunarDate && state.editingOccurrenceDate !== existing.date
        ? {
            ...value,
            date: dateKey(
              addDays(
                parseDate(existing.date),
                daysBetween(
                  parseDate(state.editingOccurrenceDate),
                  parseDate(value.date)
                )
              )
            )
          }
        : value;
    if(scope==='series' && existing.lunarDate && value.lunarDate) {
      const start=window.NelumiLunar.fromSolar(existing.date);
      const date=window.NelumiLunar.toSolar(start?.year,value.lunarDate);
      if(!date){showToast('原系列起始年没有这个农历日期，请选择“本次及后续”修改。');return;}
      scopedValue={...value,date};
    }
    applyScopedEventChange(
      existing,
      state.editingOccurrenceDate || existing.date,
      scopedValue,
      scope
    );
  } else {
    state.events.push(value);
  }
  const returnDate = state.editingOccurrenceDate || value.date;
  state.selectedDate = returnDate;
  state.viewDate = state.viewMode === 'week' ? parseDate(returnDate) : startOfMonth(parseDate(returnDate));
  await saveEvents(existing ? '日程修改已保存' : '新日程已添加');
  $('#eventDialog').close();
}

async function deleteEditingEvent() {
  const id = $('#eventId').value;
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  const recurrence = normalizeRecurrence(event);
  const scope =
    recurrence.frequency === 'none' ? 'series' : $('#eventEditScope').value || 'occurrence';
  if (!confirm(`删除“${event.title}”的${scope === 'occurrence' ? '本次安排' : scope === 'future' ? '本次及后续安排' : '整个系列'}吗？`)) {
    return;
  }
  await deleteOccurrence(event, state.editingOccurrenceDate || event.date, scope);
  $('#eventDialog').close();
}

async function deleteOccurrence(event, occurrenceDate, scope) {
  const timestamp = new Date().toISOString();
  const changed = {...event,updatedAt:timestamp};
  if (normalizeRecurrence(event).frequency === 'none' || scope === 'series') {
    changed.deletedAt=timestamp;
  } else if (scope === 'future') {
    changed.recurrence={...normalizeRecurrence(event),until:PlannerCore.previousDateKey(occurrenceDate),count:null};
  } else {
    changed.exceptions=[...new Set([...(event.exceptions || []),occurrenceDate])].sort();
  }
  const next=state.events.map(item=>item.id===event.id?changed:item);
  const result=await window.deskcal.saveEvents(next);
  if(result?.ok!==true)throw new Error('保存未成功，请重试');
  rememberUndo('日程删除');
  state.events=next;
  render();
  showToast('日程已删除','nelumi',{label:'撤销',handler:undoLastChange});
}

async function skipEditingOccurrence() {
  const event = state.events.find((item) => item.id === $('#eventId').value);
  const occurrenceDate = state.editingOccurrenceDate;
  if (!event || !occurrenceDate || normalizeRecurrence(event).frequency === 'none') return;
  if (!confirm(`仅跳过“${event.title}”在${occurrenceDate}的这一次吗？`)) return;
  event.exceptions = [...new Set([...(event.exceptions || []), occurrenceDate])].sort();
  event.updatedAt = new Date().toISOString();
  await saveEvents('已跳过本次重复日程');
  $('#eventDialog').close();
}

function openQuickEdit(eventId, occurrenceDate) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  state.quickEditingId = eventId;
  state.quickEditingDate = occurrenceDate;
  $('#quickEditTitle').textContent = event.title;
  const calendar = calendarById(event.calendarId || 'personal');
  $('#quickEditMeta').textContent = [
    occurrenceDate,
    event.allDay ? '全天' : `${event.startTime}–${event.endTime}`,
    calendar?.name
  ]
    .filter(Boolean)
    .join(' · ');
  $('[data-quick-action="complete"]').textContent = event.completed ? '恢复为待办' : '标记完成';
  $('#quickEditDialog').showModal();
}

async function quickEditAction(action) {
  const event = state.events.find((item) => item.id === state.quickEditingId);
  const occurrenceDate = state.quickEditingDate;
  if (!event || !occurrenceDate) return;
  const recurrence = normalizeRecurrence(event);
  let scope = 'series';
  if (recurrence.frequency !== 'none') {
    scope = await chooseRecurrenceScope('调整重复日程', `“${event.title}”要调整哪一部分？`);
    if (scope === 'cancel') return;
  }

  const changes = {};
  let targetDate = occurrenceDate;
  if (action === 'tomorrow') {
    if(event.lunarDate && scope!=='occurrence') {showToast('农历系列请在编辑日程中调整，或仅调整本次。');return;}
    targetDate = dateKey(addDays(parseDate(occurrenceDate), 1));
    changes.date =
      recurrence.frequency !== 'none' && scope === 'series'
        ? dateKey(addDays(parseDate(event.date), 1))
        : targetDate;
  } else if (action === 'later30' || action === 'later60') {
    if (event.allDay) {
      showToast('全天日程无法延后分钟，请使用完整编辑');
      return;
    }
    Object.assign(
      changes,
      PlannerCore.shiftTimeRange(event.startTime, event.endTime, action === 'later30' ? 30 : 60)
    );
  } else if (action === 'complete') {
    changes.completed = !event.completed;
  }

  const candidate = { ...event, ...changes };
  const conflicts = PlannerCore.conflictsForCandidate(
    candidate,
    visibleEvents(),
    targetDate,
    event.id
  );
  if (
    conflicts.length &&
    !confirm(`调整后与“${conflicts[0].title}”时间冲突，仍然继续吗？`)
  ) {
    return;
  }

  rememberUndo('快速调整');
  applyScopedEventChange(event, occurrenceDate, changes, scope);
  $('#quickEditDialog').close();
  state.selectedDate = targetDate;
  await saveEvents('日程已快速调整', { label: '撤销', handler: undoLastChange });
}

async function quickDelete(eventId = state.quickEditingId, occurrenceDate = state.quickEditingDate) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  let scope = 'series';
  if (normalizeRecurrence(event).frequency !== 'none') {
    scope = await chooseRecurrenceScope('删除重复日程', `“${event.title}”要删除哪一部分？`);
    if (scope === 'cancel') return;
  } else if (!confirm(`将“${event.title}”移入回收站吗？`)) {
    return;
  }
  $('#quickEditDialog').close();
  await deleteOccurrence(event, occurrenceDate || event.date, scope);
}

function renderRecycleBin() {
  const deleted = state.events
    .filter((event) => event.deletedAt)
    .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  if (!deleted.length) {
    $('#recycleBinList').innerHTML = `
      <div class="recycle-empty">
        <strong>回收站是空的</strong>
        <p>删除的日程会安全地保留在这里。</p>
      </div>
    `;
    return;
  }
  $('#recycleBinList').innerHTML = deleted
    .map(
      (event) => `
        <article class="recycle-item">
          <span class="recycle-color" style="background:${escapeHtml(event.color || '#6750e8')}"></span>
          <div>
            <strong>${escapeHtml(event.title)}</strong>
            <p>${escapeHtml(event.date)} · 删除于${escapeHtml(
              new Date(event.deletedAt).toLocaleString('zh-CN')
            )}</p>
          </div>
          <div class="recycle-item-actions">
            <button type="button" class="secondary-button" data-restore-id="${escapeHtml(
              event.id
            )}">恢复</button>
            <button type="button" class="danger-button" data-purge-id="${escapeHtml(
              event.id
            )}">永久删除</button>
          </div>
        </article>
      `
    )
    .join('');
  $all('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const event = state.events.find((item) => item.id === button.dataset.restoreId);
      if (!event) return;
      event.deletedAt = null;
      event.updatedAt = new Date().toISOString();
      await saveEvents('日程已恢复');
      renderRecycleBin();
    });
  });
  $all('[data-purge-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const event = state.events.find((item) => item.id === button.dataset.purgeId);
      if (!event || !confirm(`永久删除“${event.title}”吗？此操作无法撤销。`)) return;
      state.events = state.events.filter((item) => item.id !== event.id);
      await saveEvents('日程已永久删除');
      renderRecycleBin();
    });
  });
}

function openRecycleBin() {
  renderRecycleBin();
  $('#recycleBinDialog').showModal();
}

function updateQuickAddPreview() {
  const parsed = QuickInput.parseQuickInput($('#quickAddInput').value);
  $('#quickAddPreview').textContent = parsed.ok
    ? `${parsed.title} · ${QuickInput.formatQuickPreview(parsed)}`
    : parsed.error || '输入后会自动识别日期、时间、重复和提醒。';
  $('#quickAddPreview').classList.toggle('ready', parsed.ok);
  return parsed;
}

function openQuickAdd() {
  if ($('#eventDialog').open) { openEventDialog(); return; }
  $('#quickAddForm').reset();
  $('#quickAddPreview').textContent = '输入后会自动识别日期、时间、重复和提醒。';
  $('#quickAddPreview').classList.remove('ready');
  $('#quickAddDialog').showModal();
  requestAnimationFrame(() => $('#quickAddInput').focus());
}

function submitQuickAdd(event) {
  event.preventDefault();
  const parsed = updateQuickAddPreview();
  if (!parsed.ok) return;
  $('#quickAddDialog').close();
  state.selectedDate = parsed.date;
  state.viewDate = state.viewMode === 'week' ? parseDate(parsed.date) : startOfMonth(parseDate(parsed.date));
  openEventDialog(null, parsed.date);
  $('#eventTitle').value = parsed.title;
  $('#eventAllDay').checked = parsed.allDay;
  $('#eventStartTime').value = parsed.startTime || '09:00';
  $('#eventEndTime').value = parsed.endTime || '10:00';
  $all('#eventReminderOptions input').forEach((input) => {
    input.checked = parsed.reminders.includes(Number(input.value));
  });
  $('#eventRepeat').value = parsed.recurrence.frequency;
  $('#eventRepeatInterval').value = String(parsed.recurrence.interval);
  $('#eventCategory').value = parsed.category;
  toggleTimeFields();
  toggleRecurrenceFields();
}

async function updateSettings(patch) {
  try { state.settings = await window.deskcal.updateSettings(patch); }
  catch (error) { showToast(error.message || '设置未能保存', '设置失败'); }
  render();
}

function showToast(message, title = 'nelumi', action = null) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div>
      <strong>${escapeHtml(title)}</strong>
      ${escapeHtml(message)}
    </div>
    ${
      action
        ? `<button type="button" class="toast-action">${escapeHtml(action.label || '撤销')}</button>`
        : ''
    }
  `;
  if (action) {
    toast.querySelector('.toast-action').addEventListener('click', async () => {
      toast.remove();
      await action.handler();
    });
  }
  $('#toastRegion').appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function positionFloatingPanel(panel, reset = false, left, top) {
  if (!panel.open) return;
  const rect = panel.getBoundingClientRect();
  const x = left ?? (reset ? innerWidth - rect.width - 12 : rect.left);
  const y = top ?? (reset ? 44 : rect.top);
  panel.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
  panel.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
  panel.style.right = 'auto';
}

function positionSettingsPanel(reset = false, left, top) {
  positionFloatingPanel($('#settingsDialog'), reset, left, top);
}

function syncEditingPanels() {
  window.deskcal.setSettingsOpen?.($('#settingsDialog').open || $('#eventDialog').open || window.NelumiNotebook?.isEditing() || window.NelumiToolbarSearch?.isOpen() || window.NelumiDayCount?.isOpen());
}

function bringPanelForward(panel) {
  for (const card of [$('#settingsDialog'), $('#eventDialog')]) {
    card.style.zIndex = card === panel ? '21' : '20';
  }
}

function openSettings() {
  const panel = $('#settingsDialog');
  if (panel.open) { bringPanelForward(panel); $('#settingsDragHandle').focus(); return; }
  renderSettings();
  panel.show();
  syncEditingPanels();
  bringPanelForward(panel);
  positionSettingsPanel(!panel.style.left);
}

function bindFloatingPanel(panel, handle) {
  let drag = null;
  panel.addEventListener('pointerdown', () => bringPanelForward(panel));
  panel.addEventListener('focusin', () => bringPanelForward(panel));
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
    handle.setPointerCapture(event.pointerId);
    handle.focus();
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) positionFloatingPanel(panel, false, event.clientX - drag.x, event.clientY - drag.y);
  });
  const endDrag = () => { drag = null; };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('lostpointercapture', endDrag);
  handle.addEventListener('keydown', event => {
    if (event.target !== handle) return;
    const step = event.shiftKey ? 40 : 10;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (delta || event.key === 'Home') {
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      positionFloatingPanel(panel, event.key === 'Home', delta ? rect.left + delta[0] : undefined, delta ? rect.top + delta[1] : undefined);
    }
  });
  panel.addEventListener('close', () => {
    endDrag();
    syncEditingPanels();
  });
  new ResizeObserver(() => positionFloatingPanel(panel)).observe(panel);
  window.addEventListener('resize', () => positionFloatingPanel(panel));
}

function bindEvents() {
  window.NelumiNavigation.init();
  window.NelumiNotebook.init();
  window.NelumiToolbarSearch.init();
  bindFloatingPanel($('#settingsDialog'), $('#settingsDragHandle'));
  bindFloatingPanel($('#eventDialog'), $('#eventDragHandle'));
  $('#settingsDialog').addEventListener('close', () => applyTheme());
  $('#settingsDialog form').addEventListener('submit', event => event.preventDefault());
  $('#previousMonth').addEventListener('click', () => {
    if (state.viewMode === 'week') {
      const selected = addDays(parseDate(state.selectedDate), -7);
      state.selectedDate = dateKey(selected);
      state.viewDate = selected;
    } else {
      state.viewDate = new Date(
        state.viewDate.getFullYear(),
        state.viewDate.getMonth() - 1,
        1,
        12
      );
    }
    render();
  });
  $('#nextMonth').addEventListener('click', () => {
    if (state.viewMode === 'week') {
      const selected = addDays(parseDate(state.selectedDate), 7);
      state.selectedDate = dateKey(selected);
      state.viewDate = selected;
    } else {
      state.viewDate = new Date(
        state.viewDate.getFullYear(),
        state.viewDate.getMonth() + 1,
        1,
        12
      );
    }
    render();
  });
  $('#todayButton').addEventListener('click', () => {
    const today = new Date();
    state.selectedDate = dateKey(today);
    state.viewDate = startOfMonth(today);
    render();
  });
  $all('#calendarViewControl button').forEach((button) => {
    button.addEventListener('click', () => {
      state.viewMode = button.dataset.view;
      state.viewDate =
        state.viewMode === 'week'
          ? parseDate(state.selectedDate)
          : startOfMonth(parseDate(state.selectedDate));
      render();
    });
  });
  $('#addEventButton').addEventListener('click', () => openEventDialog());
  $('#quickAddButton').addEventListener('click', openQuickAdd);
  $('#quickAddForm').addEventListener('submit', submitQuickAdd);
  $('#quickAddInput').addEventListener('input', updateQuickAddPreview);
  $all('[data-example]').forEach((button) => {
    button.addEventListener('click', () => {
      $('#quickAddInput').value = button.dataset.example;
      updateQuickAddPreview();
      $('#quickAddInput').focus();
    });
  });
  $('#eventForm').addEventListener('submit', submitEventForm);
  $('#eventAllDay').addEventListener('change', toggleTimeFields);
  $all('#eventDate, #eventStartTime, #eventEndTime').forEach((input) => {
    input.addEventListener('change', previewEventConflict);
  });
  $('#eventRepeat').addEventListener('change', toggleRecurrenceFields);
  $('#eventDateCalendar').addEventListener('change',()=>{
    if($('#eventDateCalendar').value==='lunar') {
      const date=$('#eventDate').value,converted=window.NelumiLunar.fromSolar(date);
      setLunarDateInputs(converted,date,true,converted?.year);
    } else syncLunarDateInputs();
  });
  $all('#eventLunarFields input, #eventLunarFields select').forEach(input=>input.addEventListener('change',syncLunarDateInputs));
  $('#eventColor').addEventListener('input', (event) => {
    $('#eventColorText').textContent = event.target.value.toUpperCase();
  });
  $('#deleteEventButton').addEventListener('click', deleteEditingEvent);
  $('#skipOccurrenceButton').addEventListener('click', skipEditingOccurrence);
  $('#addCalendarButton').addEventListener('click', async () => {
    const name = prompt('请输入新日历名称，例如“工作”或“家庭”');
    if (!name?.trim()) return;
    const palette = ['#e05d6f', '#168e83', '#df8a32', '#3c7edb', '#9b59b6', '#6750e8'];
    state.calendars.push({
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 50),
      color: palette[state.calendars.length % palette.length],
      visible: true,
      createdAt: new Date().toISOString()
    });
    await saveCalendars('新日历已创建');
  });
  $all('[data-quick-action]').forEach((button) => {
    button.addEventListener('click', () => quickEditAction(button.dataset.quickAction));
  });
  $('#quickEditFullButton').addEventListener('click', () => {
    const id = state.quickEditingId;
    const date = state.quickEditingDate;
    $('#quickEditDialog').close();
    openEventDialog(id, date);
  });
  $('#quickEditDeleteButton').addEventListener('click', () => quickDelete());
  $all('[data-scope]').forEach((button) => {
    button.addEventListener('click', () => {
      const resolve = state.scopeResolver;
      state.scopeResolver = null;
      $('#recurrenceScopeDialog').close();
      if (resolve) resolve(button.dataset.scope);
    });
  });
  $('#recycleBinButton').addEventListener('click', openRecycleBin);
  $('#settingsButton').addEventListener('click', openSettings);
  $('#minimizeButton').addEventListener('click', () => window.deskcal.windowAction('minimize'));
  $('#closeButton').addEventListener('click', () => window.deskcal.windowAction('hide'));

  $all('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => $(`#${button.dataset.closeDialog}`).close());
  });
  $all('.filter-pill').forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      state.searchQuery = '';
      $('#searchInput').value = '';
      $all('.filter-pill').forEach((item) => item.classList.toggle('active', item === button));
      renderAgenda();
    });
  });
  $('#searchInput').addEventListener('input', (event) => {
    state.searchQuery = event.target.value;
    renderAgenda();
  });
  $all('#windowModeControl button').forEach((button) => {
    button.addEventListener('click', () => updateSettings({ windowMode: button.dataset.mode }));
  });
  $all('#themeControl button').forEach((button) => {
    button.addEventListener('click', () => updateSettings({ theme: button.dataset.theme }));
  });
  $('#opacityRange').addEventListener('input', (event) => {
    $('#opacityValue').textContent = `${event.target.value}%`;
    document.documentElement.style.setProperty('--surface-opacity', String(Number(event.target.value) / 100));
  });
  $('#opacityRange').addEventListener('change', (event) =>
    updateSettings({ opacity: Number(event.target.value) / 100 })
  );
  $('#startOnBootToggle').addEventListener('change', (event) =>
    updateSettings({ startOnBoot: event.target.checked })
  );
  $('#soundToggle').addEventListener('change', (event) =>
    updateSettings({ sound: event.target.checked })
  );
  $('#lunarToggle').addEventListener('change', (event) =>
    updateSettings({ showLunar: event.target.checked })
  );
  $('#traditionalFestivalToggle').addEventListener('change', (event) =>
    updateSettings({ showTraditionalFestivals: event.target.checked })
  );
  $('#commemorativeToggle').addEventListener('change', (event) =>
    updateSettings({ showCommemorativeDays: event.target.checked })
  );
  $('#solarTermToggle').addEventListener('change', (event) =>
    updateSettings({ showSolarTerms: event.target.checked })
  );
  $('#officialHolidayToggle').addEventListener('change', (event) =>
    updateSettings({ showOfficialHolidays: event.target.checked })
  );
  $('#holidayBadgeToggle').addEventListener('change', (event) =>
    updateSettings({ showHolidayBadges: event.target.checked })
  );
  $('#weekendHighlightToggle').addEventListener('change', (event) =>
    updateSettings({ highlightWeekends: event.target.checked })
  );
  $('#exportButton').addEventListener('click', async () => {
    const result = await window.deskcal.exportData();
    if (!result.canceled) showToast('备份文件已导出');
  });
  $('#importButton').addEventListener('click', async () => {
    
    try {
      const result = await window.deskcal.importData();
      if (!result.canceled) {
        state.events = result.state.events;
        state.calendars = result.state.calendars || state.calendars;
        state.settings = result.state.settings;
        render();
        showToast('备份已合并，已有日程保留');
      }
    } catch {
      showToast('无法读取该备份文件', '导入失败');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      openEventDialog();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openQuickAdd();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'f') {
      if (event.isComposing || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      window.NelumiToolbarSearch.open();
    }
    if (event.key === 'Escape') {
      if (state.scopeResolver) {
        const resolve = state.scopeResolver;
        state.scopeResolver = null;
        resolve('cancel');
      }
      $all('dialog[open]').forEach((dialog) => dialog.close());
    }
  });

  window.deskcal.onCreateRequest(() => openEventDialog());
  window.deskcal.onOpenSettings(openSettings);
  window.deskcal.onSettingsChanged((settings) => {
    state.settings = settings;
    render();
  });
  window.deskcal.onReminder((reminder) => {
    showToast(
      `${reminder.date}${reminder.time ? ` ${reminder.time}` : ''}`,
      reminder.late ? `遗漏提醒：${reminder.title}` : reminder.title
    );
  });
  window.deskcal.onReminderOpen((eventId) => {
    const event = state.events.find((item) => item.id === eventId);
    if (event) {
      state.selectedDate = event.date;
      state.viewDate = startOfMonth(parseDate(event.date));
      render();
      openEventDialog(eventId, event.date);
    }
  });
}

async function init() {
  bindEvents();
  try {
    const initial = await window.deskcal.getState();
    state.events = initial.events || [];
    state.calendars = initial.calendars || [
      { id: 'personal', name: '个人', color: '#6750e8', visible: true }
    ];
    state.settings = initial.settings || {};
    window.NelumiHolidayUpdates.init(initial.holidayData);
    render();
  } catch (error) {
    showToast(error.message || '无法加载本地数据', '启动失败');
  }
}

init();
