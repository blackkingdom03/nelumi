const fs = require('node:fs');
const path = require('node:path');
const {parseHolidayData, verifyHolidayData} = require('./chinese-calendar');

// Only public yearly JSON is fetched. No events, notes or settings leave this computer.
function createHolidayStore(file, request = fetch) {
  const records = {}, pending = new Map();
  try {
    if (fs.statSync(file).size <= 2000000) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const [key, record] of Object.entries(saved)) {
        try {
          const year = Number(key);
          if (!Number.isInteger(year) || year < 2026 || year > 2100 || !Number.isFinite(record.checkedAt)) continue;
          if (record.data && !parseHolidayData(record.data, year)) continue;
          if (!['available', 'unpublished', 'error', 'pending-review', 'conflict'].includes(record.status)) continue;
          if (record.status === 'available' && !record.data) continue;
          const reviewed = record.data ? verifyHolidayData(record.data).status : 'unpublished';
          records[year] = {...record, status:record.status === 'error' ? 'error' : reviewed === 'verified' ? 'available' : reviewed, checkedAt:record.status === 'error' ? 0 : record.checkedAt};
        } catch { /* One bad cached year must not hide other valid years. */ }
      }
    }
  } catch { /* Missing or damaged public cache can be downloaded again. */ }
  function persist() {
    fs.mkdirSync(path.dirname(file), {recursive:true});
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(records));
    fs.renameSync(temp, file);
  }
  async function get(year, force = false) {
    if (!Number.isInteger(year) || year < 2026 || year > 2100) throw new Error('节假日更新支持2026—2100年');
    if (pending.has(year)) return pending.get(year);
    const previous = records[year], age = Date.now() - (previous?.checkedAt || 0);
    if (!force && previous && age >= 0 && age < (previous.status === 'error' ? 300000 : 86400000)) return previous;
    const task = (async () => {
      try {
        const response = await request(`https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`, {signal:AbortSignal.timeout(10000), redirect:'error'});
        let data = null;
        if (response.status !== 404) {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const reader = response.body.getReader(); let size = 0; const parts = [];
          for (;;) {
            const {done, value} = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 250000) { await reader.cancel(); throw new Error('节假日数据过大'); }
            parts.push(Buffer.from(value));
          }
          const parsed = JSON.parse(Buffer.concat(parts).toString('utf8'));
          if (parseHolidayData(parsed, year)) data = {year, papers:parsed.papers, days:parsed.days.map(({date,name,isOffDay})=>({date,name,isOffDay}))};
        }
        // Never discard a known schedule because an upstream file temporarily disappears.
        if (!data && previous?.data) throw new Error('数据源暂缺，保留已有安排');
        const reviewed = data ? verifyHolidayData(data).status : 'unpublished';
        const result = {status:reviewed === 'verified' ? 'available' : reviewed, checkedAt:Date.now(), data};
        records[year] = result;
        try { persist(); } catch (error) { records[year] = previous; throw error; }
        return result;
      } catch {
        const result = {status:'error', checkedAt:Date.now(), data:previous?.data || null};
        records[year] = result;
        return result;
      } finally { pending.delete(year); }
    })();
    pending.set(year, task);
    return task;
  }
  return {get, entries:()=>Object.values(records).filter(r=>r?.data && verifyHolidayData(r.data).status === 'verified').map(r=>r.data)};
}
module.exports = {createHolidayStore};
