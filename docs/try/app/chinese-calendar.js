(function exposeChineseCalendar(root, factory) {
  const lunarLibrary =
    typeof module !== 'undefined' && module.exports ? require('lunar-javascript') : root;
  const authority = typeof module !== 'undefined' && module.exports ? require('./authority-calendar-data') : root.NelumiAuthorityCalendar;
  const api = factory(lunarLibrary, authority);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DeskCalChineseCalendar = api;
})(typeof window !== 'undefined' ? window : globalThis, function createChineseCalendar(library, authority) {
  const { Solar } = library;
  if (!Solar) throw new Error('Chinese calendar runtime is unavailable');

  const HOLIDAY_SOURCE_2026 =
    'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm';

  const TRADITIONAL_FESTIVALS = {
    '1-1': '春节',
    '1-15': '元宵节',
    '2-2': '龙抬头',
    '5-5': '端午节',
    '7-7': '七夕节',
    '7-15': '中元节',
    '8-15': '中秋节',
    '9-9': '重阳节',
    '10-15': '下元节',
    '12-8': '腊八节',
    '12-23': '小年'
  };

  const SOLAR_FESTIVALS = {
    '01-01': '元旦',
    '05-01': '劳动节',
    '10-01': '国庆节'
  };

  const COMMEMORATIVE_DAYS = {
    '03-08': '妇女节',
    '03-12': '植树节',
    '05-04': '青年节',
    '06-01': '儿童节',
    '07-01': '建党节',
    '08-01': '建军节',
    '09-10': '教师节',
    '12-13': '国家公祭日'
  };

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function keyOf(year, month, day) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  function addDaysToSchedule(schedule, start, end, details) {
    const cursor = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    let index = 0;
    const total = Math.round((last - cursor) / 86400000) + 1;
    while (cursor <= last) {
      const key = keyOf(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
      schedule[key] = {
        ...details,
        date: key,
        index: index + 1,
        total,
        isStart: index === 0,
        isEnd: index === total - 1
      };
      cursor.setDate(cursor.getDate() + 1);
      index += 1;
    }
  }

  function create2026Schedule() {
    const days = {};
    const holiday = (start, end, name) =>
      addDaysToSchedule(days, start, end, { type: 'holiday', badge: '休', name });
    const workday = (date, name) =>
      addDaysToSchedule(days, date, date, { type: 'workday', badge: '班', name });

    holiday('2026-01-01', '2026-01-03', '元旦');
    workday('2026-01-04', '元旦');
    holiday('2026-02-15', '2026-02-23', '春节');
    workday('2026-02-14', '春节');
    workday('2026-02-28', '春节');
    holiday('2026-04-04', '2026-04-06', '清明节');
    holiday('2026-05-01', '2026-05-05', '劳动节');
    workday('2026-05-09', '劳动节');
    holiday('2026-06-19', '2026-06-21', '端午节');
    holiday('2026-09-25', '2026-09-27', '中秋节');
    holiday('2026-10-01', '2026-10-07', '国庆节');
    workday('2026-09-20', '国庆节');
    workday('2026-10-10', '国庆节');

    return {
      year: 2026,
      publishedAt: '2025-11-04',
      source: HOLIDAY_SOURCE_2026,
      documentNumber: '国办发明电〔2025〕7号',
      verification: {status:'verified', checkedAt:'2026-10-22', source:'https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202511/t20251104_4258838.html'},
      days
    };
  }

  const HOLIDAY_SCHEDULES = {
    2026: create2026Schedule()
  };
  const dayInfoCache = new Map();

  // holiday-cn JSON is data only. Reject the whole year if any row is malformed.
  function parseHolidayData(data, expectedYear = data?.year) {
    const year = data?.year;
    if (!Number.isInteger(year) || year < 2026 || year > 2100 || year !== expectedYear ||
        !Array.isArray(data.papers) || !Array.isArray(data.days) || data.days.length > 100 || data.papers.length > 20) {
      throw new Error('节假日数据格式或年份不正确');
    }
    if (!data.days.length && !data.papers.length) return null;
    if (!data.days.length || !data.papers.length) throw new Error('节假日数据缺少公告或日期');
    const papers = data.papers.map(value => {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || !['www.gov.cn', 'gov.cn'].includes(url.hostname) || url.username || url.password || url.port) {
        throw new Error('节假日数据缺少国务院公告来源');
      }
      return url.href;
    });
    const seen = new Set();
    const rows = data.days.map(row => {
      if (!row || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
          Number(row.date.slice(0, 4)) !== year || typeof row.isOffDay !== 'boolean' ||
          typeof row.name !== 'string' || !/^[\u4e00-\u9fff、]{2,30}$/.test(row.name) || seen.has(row.date)) throw new Error('节假日日期或名称无效');
      const date = new Date(`${row.date}T12:00:00`);
      if (Number.isNaN(date.getTime()) || keyOf(date.getFullYear(), date.getMonth() + 1, date.getDate()) !== row.date) throw new Error('节假日日期不存在');
      seen.add(row.date);
      return { date: row.date, name: row.name, isOffDay: row.isOffDay };
    }).sort((a, b) => a.date.localeCompare(b.date));
    const days = {};
    for (let i = 0; i < rows.length;) {
      const first = rows[i];
      let end = i;
      while (first.isOffDay && end + 1 < rows.length && rows[end + 1].isOffDay && rows[end + 1].name === first.name) {
        const next = new Date(`${rows[end].date}T12:00:00`); next.setDate(next.getDate() + 1);
        if (keyOf(next.getFullYear(), next.getMonth() + 1, next.getDate()) !== rows[end + 1].date) break;
        end++;
      }
      addDaysToSchedule(days, first.date, rows[end].date, {type: first.isOffDay ? 'holiday' : 'workday', badge: first.isOffDay ? '休' : '班', name: first.name});
      i = end + 1;
    }
    return {year, source: papers[0], papers, provider: 'NateScarlet/holiday-cn', days};
  }

  function installHolidayData(data) {
    const result = verifyHolidayData(data);
    // Downloaded URLs and self-declared "verified" fields are not proof of accuracy.
    // New years require an independently reviewed official-notice baseline in a release.
    if (result.status !== 'verified') return null;
    return HOLIDAY_SCHEDULES[data.year];
  }

  function verifyHolidayData(data) {
    const candidate = parseHolidayData(data);
    if (!candidate) return {status:'unpublished'};
    const trusted = data.year === 2026 ? create2026Schedule() : null;
    if (!trusted) return {status:'pending-review'};
    const rows = schedule => Object.values(schedule.days).map(d=>[d.date,d.name,d.type]).sort((a,b)=>a[0].localeCompare(b[0]));
    const matches = candidate.papers.includes(trusted.source) && JSON.stringify(rows(candidate)) === JSON.stringify(rows(trusted));
    return {status:matches ? 'verified' : 'conflict'};
  }

  function lunarMonthName(lunar) {
    const prefix = lunar.getMonth() < 0 ? '闰' : '';
    return `${prefix}${lunar.getMonthInChinese()}月`;
  }

  function isLunarNewYearsEve(lunar) {
    const tomorrow = lunar.next(1);
    return tomorrow.getMonth() === 1 && tomorrow.getDay() === 1;
  }

  function getTraditionalFestival(lunar) {
    if (isLunarNewYearsEve(lunar)) return '除夕';
    if (lunar.getMonth() < 0) return '';
    return TRADITIONAL_FESTIVALS[`${Math.abs(lunar.getMonth())}-${lunar.getDay()}`] || '';
  }

  // Source tables are independent of lunar-javascript. UTC arithmetic avoids DST gaps.
  function authorityDay(year, month, day) {
    const table = authority?.years[year];
    if (!table) return null;
    const md = `${pad(month)}-${pad(day)}`;
    let start = '01-01', signedMonth = table.first[0], firstDay = table.first[1];
    for (const [date, value] of table.months) {
      if (date > md) break;
      start = date; signedMonth = value; firstDay = 1;
    }
    const [sm, sd] = start.split('-').map(Number);
    return {
      lunarMonth: Math.abs(signedMonth), isLeapMonth: signedMonth < 0,
      lunarDay: firstDay + (Date.UTC(year,month-1,day)-Date.UTC(year,sm-1,sd))/86400000,
      lunarYear: month <= 2 && Math.abs(signedMonth) >= 11 ? year-1 : year,
      solarTerm: table.terms.find(([date])=>date===md)?.[1] || ''
    };
  }

  function calendarVerification(year, key) {
    if (!authority?.years[year]) return {status:'calculated', note:'农历、节气为算法计算，未覆盖本次权威历表核验'};
    const partial = key < '1901-01-20';
    const uncertainYear = authority.uncertainDates.some(date=>date.startsWith(`${year}-`));
    return {
      status:partial ? 'partial' : 'table-checked', checkedAt:authority.auditDate,
      source:`https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T${year}c.txt`,
      sha256:authority.years[year].sha256,
      note:partial ? '农历日序、星期、节气已对照香港天文台；本段农历月份、闰月和年份仍为推算' :
        uncertainYear ? '已对照香港天文台现行历表；该年部分新月或节气接近午夜，天文台提示可能相差一日' : '农历、节气已逐日对照香港天文台历表'
    };
  }

  function getDayInfo(input) {
    // A calendar date is a local civil day, not midnight UTC. Parsing it as UTC
    // would turn it into the preceding day on computers west of Greenwich.
    const date = input instanceof Date ? input : new Date(
      typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T12:00:00` : input
    );
    if (Number.isNaN(date.getTime())) throw new TypeError('Invalid calendar date');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const key = keyOf(year, month, day);
    if (dayInfoCache.has(key)) return dayInfoCache.get(key);

    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    const monthDayKey = `${pad(month)}-${pad(day)}`;
    const reference = authorityDay(year, month, day);
    const verification = calendarVerification(year, key);
    // The first table starts mid-month; its preceding month/leap/year are not independently attested.
    const resolved = reference && verification.status !== 'partial' ? reference : {
      lunarYear:lunar.getYear(), lunarMonth:Math.abs(lunar.getMonth()), lunarDay:reference?.lunarDay ?? lunar.getDay(), isLeapMonth:lunar.getMonth()<0
    };
    const monthNames = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
    const dayNames = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
    const lunarMonth = `${resolved.isLeapMonth?'闰':''}${monthNames[resolved.lunarMonth-1]}月`;
    const lunarDay = dayNames[resolved.lunarDay-1];
    const next = new Date(Date.UTC(year,month-1,day+1));
    const nextReference = authorityDay(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate());
    const eve = nextReference ? nextReference.lunarMonth===1 && nextReference.lunarDay===1 && !nextReference.isLeapMonth : isLunarNewYearsEve(lunar);
    const traditionalFestival = eve ? '除夕' : resolved.isLeapMonth ? '' : TRADITIONAL_FESTIVALS[`${resolved.lunarMonth}-${resolved.lunarDay}`] || '';
    const solarFestival = SOLAR_FESTIVALS[monthDayKey] || '';
    const commemorativeDay = COMMEMORATIVE_DAYS[monthDayKey] || '';
    const solarTerm = reference ? reference.solarTerm : lunar.getJieQi() || '';
    const schedule = HOLIDAY_SCHEDULES[year] || null;
    const holiday = schedule?.days[key] || null;
    const festival = traditionalFestival || solarFestival || (solarTerm === '清明' ? '清明节' : '');
    const displayLabel =
      festival ||
      (holiday?.type === 'holiday' && holiday.isStart ? `${holiday.name}假期` : '') ||
      solarTerm ||
      (resolved.lunarDay === 1 ? lunarMonth : lunarDay);
    const labelType =
      festival || (holiday?.type === 'holiday' && holiday.isStart)
        ? 'festival'
        : solarTerm
          ? 'solar-term'
          : 'lunar';
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const info = Object.freeze({
      dateKey: key,
      year,
      month,
      day,
      weekday: date.getDay(),
      isWeekend,
      isRestDay: holiday?.type === 'holiday' || (isWeekend && holiday?.type !== 'workday'),
      isWorkdayOverride: holiday?.type === 'workday',
      ...resolved,
      calendarVerification: verification,
      lunarMonthText: lunarMonth,
      lunarDayText: lunarDay,
      lunarText: resolved.lunarDay === 1 ? lunarMonth : lunarDay,
      fullLunarText: `农历${lunar.getYearInGanZhi()}年 ${lunarMonth}${lunarDay}`,
      zodiac: lunar.getYearShengXiao(),
      traditionalFestival,
      solarFestival,
      commemorativeDay,
      festival,
      solarTerm,
      holiday,
      holidaySchedule: schedule
        ? {
            year: schedule.year,
            publishedAt: schedule.publishedAt,
            source: schedule.source,
            documentNumber: schedule.documentNumber
          }
        : null,
      displayLabel,
      labelType
    });
    dayInfoCache.set(key, info);
    return info;
  }

  function getHolidaySchedule(year) {
    return HOLIDAY_SCHEDULES[Number(year)] || null;
  }

  function clearCache() {
    dayInfoCache.clear();
  }

  return {
    HOLIDAY_SOURCE_2026,
    TRADITIONAL_FESTIVALS,
    SOLAR_FESTIVALS,
    COMMEMORATIVE_DAYS,
    getDayInfo,
    getHolidaySchedule,
    parseHolidayData,
    installHolidayData,
    verifyHolidayData,
    calendarVerification,
    clearCache
  };
});
