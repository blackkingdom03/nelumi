const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
test('final authority audit fails on a differing day and keeps a readable difference report',()=>{
 const file=path.resolve('scripts/audit-calendar.cjs'),localRequire=createRequire(file),C=localRequire('../src/chinese-calendar');
 const fakeProcess={argv:['node',file,'--final'],exitCode:0};let report;
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{
  __dirname:path.dirname(file),process:fakeProcess,console:{log(){}},
  require(name){
   if(name==='node:fs')return {...fs,writeFileSync(file,content){if(file.endsWith('final-report.json'))report=JSON.parse(content);}};
   if(name==='../src/chinese-calendar')return {...C,getDayInfo(date){const info=C.getDayInfo(date);return date.startsWith('2026-01-01')?{...info,lunarDay:99}:info;}};
   return localRequire(name);
  }
 });
 assert.equal(fakeProcess.exitCode,1);assert.equal(report.totalDays,73049);
 assert.equal(report.differentDays,1);assert.equal(report.differences[0].date,'2026-01-01');
});
