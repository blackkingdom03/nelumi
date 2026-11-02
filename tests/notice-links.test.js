const test=require('node:test'),assert=require('node:assert/strict');
const Links=require('../src/notice-links');
test('Chinese notice URLs stop before prose and preserve all original text',()=>{
 const text='地址如下https://portal.example.org/user/web-v2/sso 密码自己设置。另见https://example.org/a?x=1&y=2。';
 const parts=Links.parts(text);assert.equal(parts.map(p=>p.text).join(''),text);
 assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href),['https://portal.example.org/user/web-v2/sso','https://example.org/a?x=1&y=2']);
});
test('www and enclosing punctuation',()=>{
 const parts=Links.parts('（www.example.org），参考 https://example.org/a(b).');
 assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href),['https://www.example.org/','https://example.org/a(b)']);
});
test('unsafe schemes, credentials, whitespace and oversized URLs rejected',()=>{
 for(const s of ['javascript:alert(1)','file:///C:/a','data:text/html,x','https://user:pw@example.org','https://example.org/\nabc','https://example.org/'+ 'x'.repeat(2082),null]) assert.equal(Links.webUrl(s),null);
 assert.equal(Links.webUrl('http://example.org'), 'http://example.org/');
});
test('HTML remains plain text and cannot become executable markup',()=>{
 const text='<img src=x onerror=alert(1)> javascript:alert(1)';
 assert.deepEqual(Links.parts(text),[{text}]);
});
