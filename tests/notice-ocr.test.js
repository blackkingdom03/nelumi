const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../src/notice-ocr');
test('OCR spacing is normalized without inventing digits or merging paragraphs',()=>{
 assert.equal(O.cleanText('活 动 通 知\r\n时间：11 月 5 日 15:00\n地点：一 楼 会 议 室\nhttps://example.org/a b'),'活动通知\n时间：11月5日 15:00\n地点：一楼会议室\nhttps://example.org/a b');
});
test('image type and byte limits are explicit',()=>{
 assert.equal(O.validateFile({type:'image/png',size:100}),null);
 assert.match(O.validateFile({type:'image/svg+xml',size:100}),/格式/);
 assert.match(O.validateFile({type:'image/jpeg',size:11*1024*1024}),/10 MB/);
 assert.match(O.validateFile({type:'image/png',size:0}),/空/);
});
