const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const parserPath = require.resolve('../src/notice-input');
const { parseNotice } = require(parserPath);
const BASE = new Date(2026, 9, 22, 12);

test('通知示例保留原文并提取明确相对日期、中文时间及地点', () => {
  const source = '  通知：明天下午3点在三楼会议室召开项目会，请带上材料。\n';
  const result = parseNotice(source, BASE);
  assert.ok(result, 'parseNotice API must exist');
  assert.equal(result.ok, true);
  assert.equal(result.date, '2026-10-23');
  assert.equal(result.startTime, '15:00');
  assert.equal(result.endTime, '');
  assert.match(result.warnings.join(' '), /结束/);
  assert.equal(result.location, '三楼会议室');
  assert.match(result.title, /项目会/);
  assert.equal(result.sourceText, source);
});

test('完整日期和明确时间区间可编辑，主题与地点字段优先', () => {
  for (const date of ['2026-10-23', '2026/10/23', '2026年10月23日']) {
    const result = parseNotice(`主题：项目复盘\n时间：${date} 15:00—16:30\n地点：A座三楼会议室`, BASE);
    assert.equal(result.date, '2026-10-23');
    assert.equal(result.startTime, '15:00');
    assert.equal(result.endTime, '16:30');
    assert.equal(result.title, '项目复盘');
    assert.equal(result.location, 'A座三楼会议室');
    assert.deepEqual(result.times, ['15:00', '16:30']);
  }
});

test('中文数字及区间继承下午标记，但不跨句推断', () => {
  const result = parseNotice('明天下午三点半至五点开会', BASE);
  assert.equal(result.startTime, '15:30');
  assert.equal(result.endTime, '17:00');
  const ambiguous = parseNotice('明天下午三点开会，五点交材料', BASE);
  assert.equal(ambiguous.startTime, '');
  assert.match(ambiguous.warnings.join(' '), /多个|明确/);
});

test('相对日期严格基于指定日期并跨年，周一为每周起点', () => {
  const examples = [['今天', '2026-10-22'], ['后天', '2026-10-24'], ['本周一', '2026-10-19'], ['下周一', '2026-10-26'], ['本周星期日', '2026-10-25'], ['下星期一', '2026-10-26']];
  for (const [word, expected] of examples) assert.equal(parseNotice(`${word}开会`, BASE).date, expected);
  assert.equal(parseNotice('明天开会', new Date(2026, 11, 31)).date, '2027-01-01');
});

test('缺失日期、多个日期、非法日期不默认选日期', () => {
  for (const source of ['请下午3点开会', '2026年2月30日开会', '2026-13-01开会', '2026/02/29开会', '明天开会，后天交材料', '2026-10-23开会，2026-02-30交材料']) {
    const result = parseNotice(source, BASE);
    assert.equal(result.date, '', source);
    assert.ok(result.warnings.length, source);
  }
  const multiple = parseNotice('明天开会，后天交材料', BASE);
  assert.deepEqual(multiple.dates, ['2026-10-23', '2026-10-24']);
  assert.equal(parseNotice('2028年2月29日开会', BASE).date, '2028-02-29');
});

test('省略年份需提示当前采用的基准年，同一日期重复不算多个日期', () => {
  const result = parseNotice('10月23日开会', BASE);
  assert.equal(result.date, '2026-10-23');
  assert.match(result.warnings.join(' '), /2026.*年|年.*2026/);
  assert.equal(parseNotice('明天（10月23日）开会', BASE).date, '2026-10-23');
});

test('不明确时段、非法时间、多个非区间时间不能静默选择', () => {
  for (const source of ['明天三点开会', '明天25:00开会', '明天上午13点开会', '明天15:80开会', '明天15:00开会，17:00交材料', '明天16:00-15:00开会']) {
    const result = parseNotice(source, BASE);
    assert.equal(result.startTime, '', source);
    assert.equal(result.endTime, '', source);
    assert.equal(result.allDay, false, source);
    assert.ok(result.warnings.length, source);
  }
  assert.equal(parseNotice('明天全天外出', BASE).allDay, true);
  assert.match(parseNotice('明天开会', BASE).warnings.join(' '), /时间|全天/);
});

test('不把数量、版本号或嵌入的更长日期当日期时间', () => {
  const result = parseNotice('版本12026-10-23，准备3点材料', BASE);
  assert.equal(result.date, '');
});

test('空输入和无效基准失败，50,000字符边界原样保留，超过上限报错', () => {
  assert.equal(parseNotice(' \n ', BASE).ok, false);
  assert.equal(parseNotice('明天开会', new Date('bad')).ok, false);
  const source = `明天开会${' '.repeat(49996)}`;
  assert.equal(source.length, 50000);
  assert.equal(parseNotice(source, BASE).sourceText, source);
  const tooLong = parseNotice(`${source} `, BASE);
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.error, /50,?000/);
});

test('浏览器全局接口可用，HTML只作为原文保存', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(parserPath, 'utf8'), context);
  const source = '<script>alert(1)</script>\n明天开会';
  const result = context.window.DeskCalNoticeInput.parseNotice(source, BASE);
  assert.equal(result.sourceText, source);
});

test('截短的日期区间和不明确的午夜时间要求核对', () => {
  const dates = parseNotice('10月23日至25日出差', BASE);
  assert.equal(dates.date, '');
  assert.match(dates.warnings.join(' '), /区间/);
  assert.equal(parseNotice('明天晚上十二点开会', BASE).startTime, '');
  assert.equal(parseNotice('明天下午三点至17点开会', BASE).endTime, '17:00');
});

test('长空白输入的处理时间受限，避免阻塞界面', () => {
  const start = performance.now();
  parseNotice(`明天开会${' '.repeat(49996)}`, BASE);
  assert.ok(performance.now() - start < 500, '50k whitespace should not trigger quadratic regex backtracking');
});

for (const source of [
  '2026-10-23至25日出差，每天15:00-16:00汇报',
  '2026/10/23—25日出差',
  '2026-10-23、25日开会',
  '2026/10/23至10/25出差',
  '下周一至周三外出',
  '下周一、周三开会',
  '本周星期一到星期三外出',
  '下星期一和星期三开会',
  '下周一至三外出'
]) {
  test(`省略日期组成的区间或并列日期需手动选择：${source}`, () => {
    const parsed = parseNotice(source, BASE);
    assert.equal(parsed.date, '');
    assert.match(parsed.warnings.join(' '), /区间|多个日期/);
  });
}

test('区间防误判不影响单个完整日期和单个星期', () => {
  for (const source of ['2026-10-23出差，15:00-16:00汇报', '2026/10/23—15:00汇报']) {
    assert.equal(parseNotice(source, BASE).date, '2026-10-23');
  }
  assert.equal(parseNotice('下周一15:00-16:00开会', BASE).date, '2026-10-26');
});

const {parseQuickNotice}=require(parserPath);
test('直接添加：缺省年份、日期、时间与原文',()=>{
  const a=parseQuickNotice('主题：准备材料\n10月1日',BASE);
  assert.equal(a.items[0].date,'2026-10-01');assert.equal(a.items[0].allDay,true);
  const b=parseQuickNotice('整理材料',BASE);
  assert.equal(b.items[0].date,'2026-10-22');assert.equal(b.items[0].sourceText,'整理材料');
  assert.equal(parseQuickNotice('2027年1月2日 开会',BASE).items[0].date,'2027-01-02');
});
test('直接添加：长通知标题、日期区间和独立日期',()=>{
  const a=parseQuickNotice('各位班级负责人：\n大家好！“共育新绿”绿植共养活动开启啦！\n活动时间：10月22日至11月22日',BASE);
  assert.equal(a.ok,true);assert.equal(a.items[0].title,'共育新绿绿植共养活动开始');
  assert.equal(a.items[1].title,'共育新绿绿植共养活动结束');
  assert.deepEqual(a.items.map(item=>item.date),['2026-10-22','2026-11-22']);
  assert.ok(a.items.every(item=>item.recurrence.frequency==='none'));
  assert.equal(parseQuickNotice('10月23日、10月25日整理材料',BASE).items.length,2);
});
test('直接添加：时间和非法内容',()=>{
  assert.equal(parseQuickNotice('今晚20:00开会',BASE).items[0].endTime,'21:00');
  for(const text of ['', '长'.repeat(50001),'2月30日 开会','明天25:99开会','10月22日至10月20日活动'])
    assert.equal(parseQuickNotice(text,BASE).ok,false,text.slice(0,30));
});
test('直接添加：数字日期区间只标记首尾，非法日期不能被其他有效区间掩盖',()=>{
  const a=parseQuickNotice('2026-10-23至2026-10-25出差',BASE);
  assert.equal(a.items.length,2);assert.equal(a.items[0].date,'2026-10-23');
  assert.equal(a.items[0].title,'出差开始');assert.equal(a.items[1].title,'出差结束');
  assert.equal(a.items[1].date,'2026-10-25');assert.ok(a.items.every(item=>item.recurrence.frequency==='none'));
  assert.equal(parseQuickNotice('10月23日至25日出差，2月30日归档',BASE).ok,false);
});
test('用户示例：中文连字符区间只在首尾日期出现，原文完整保留',()=>{
  const source='绿植共养活动：10月22日-11月22日';
  const result=parseQuickNotice(source,BASE);
  assert.deepEqual(result.items.map(item=>item.date),['2026-10-22','2026-11-22']);
  assert.deepEqual(result.items.map(item=>item.title),['绿植共养活动开始','绿植共养活动结束']);
  const {occursOn}=require('../src/calendar-core');
  assert.ok(result.items.every(item=>item.sourceText===source && !occursOn(item,new Date(2026,9,23))));
});
