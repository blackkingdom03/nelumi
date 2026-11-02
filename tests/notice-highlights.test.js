const {test}=require('node:test'),assert=require('node:assert/strict'),{parts}=require('../src/notice-highlights');
test('marks dates, ranges, Chinese clocks, labelled and prose locations without changing text',()=>{
 for(const [text,expected] of [
 ['【时间】2026年11月11日（周三）下午14：00\n📍【地点】\n公共管理学院404报告厅',['2026年11月11日','周三','下午14：00','公共管理学院404报告厅']],
 ['10月22日—11月22日。明天下午三点半在一楼会议室开会。',['10月22日','11月22日','明天','下午三点半','一楼会议室']],
 ['农历八月十五生日，地点：海棠餐厅；时间：18:30',['农历八月十五','海棠餐厅','18:30']],
 ['2026-11-11 09:00至10:00，会议地点：第二会议室 时间：15:00',['2026-11-11','09:00','10:00','第二会议室','15:00']]
 ]) {const result=parts(text);assert.equal(result.map(p=>p.text).join(''),text);for(const word of expected)assert(result.some(p=>p.kind&&p.text.trim()===word),word);}
});
test('preserves URLs, markup, newlines, unknown text and optional event location',()=>{
 const text='<img src=x onerror=alert(1)>\nhttps://example.org/2026/11/11?q=15:00\n请到星光大厅';const result=parts(text,'星光大厅');assert.equal(result.map(p=>p.text).join(''),text);assert.equal(result.filter(p=>p.href).length,1);assert.deepEqual(result.filter(p=>p.kind).map(p=>[p.text,p.kind]),[['星光大厅','place']]);assert.deepEqual(parts('大家好，请注意通知。'),[{text:'大家好，请注意通知。'}]);
});

test('spaced notice/OCR dates highlight without rewriting the source',()=>{
 const text='报名时间：10 月 27 日 —10 月 29 日';const p=parts(text);assert.deepEqual(p.filter(x=>x.kind==='date').map(x=>x.text),['10 月 27 日','10 月 29 日']);assert.equal(p.map(x=>x.text).join(''),text);
});
