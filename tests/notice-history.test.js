const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../src/renderer/notebook.js'),'utf8');
const functions=code.slice(code.indexOf('  function signature('),code.indexOf('  async function writeEvents('));
const core=require('../src/calendar-core');
function load(saved,events=[]) {
 const context=vm.createContext({saved:structuredClone(saved),state:{events},normalizeRecurrence:core.normalizeRecurrence,crypto:require('node:crypto')});
 vm.runInContext(functions+';loadHistory();',context);return JSON.parse(JSON.stringify(context.saved));
}
const batch=i=>({id:String(i),text:'消息'+i,items:[{id:String(i),signature:'[]'}]});
test('keeps recent 50 batches and bounds long history without truncating one message',()=>{
 const saved=load({history:{past:Array.from({length:60},(_,i)=>batch(i)),future:[]}});
 assert.equal(saved.history.past.length,50);assert.equal(saved.history.past[0].id,'10');
 const long=batch(1);long.text='字'.repeat(50000);long.items[0].signature='x'.repeat(400000);
 const bounded=load({history:{past:[long,{...long,id:'2'}],future:[]}});assert.equal(bounded.history.past.length,1);assert.equal(bounded.history.past[0].text.length,50000);
});
test('legacy undo survives automatic title upgrade only when other event content matches',()=>{
 const event={id:'a',title:'旧标题',date:'2026-10-22',allDay:true,sourceText:'通知',notes:'笔记'};
 const context=vm.createContext({normalizeRecurrence:core.normalizeRecurrence,event});
 const signCode=functions.slice(0,functions.indexOf('  function trimHistory'));
 const sig=vm.runInContext(signCode+';signature(event)',context);
 const saved={undo:{text:'通知',items:[{id:'a',signature:sig}]}};
 const upgraded={...event,title:'新标题',titleAutomation:{originalTitle:'旧标题',manual:false}};
 const result=load(saved,[upgraded]);assert.equal(JSON.parse(result.history.past[0].items[0].signature)[0],'新标题');assert.equal('undo' in result,false);
 const upgradedAgain={...upgraded,title:'第二版标题',titleAutomation:{originalTitle:'旧标题',previousTitle:'新标题',manual:false}};
 assert.equal(JSON.parse(load(result,[upgradedAgain]).history.past[0].items[0].signature)[0],'第二版标题','history survives a second automatic title upgrade');
 for(const changed of [{...upgraded,notes:'新笔记'},{...upgraded,titleAutomation:{originalTitle:'旧标题',manual:true}}]) assert.equal(load(saved,[changed]).history.past[0].items[0].signature,sig);
});
test('malformed persisted batches and redo records without tombstones are ignored',()=>{
 const result=load({history:{past:[null,{},batch(1)],future:[batch(2)]}});
 assert.equal(result.history.past.length,1);assert.equal(result.history.future.length,0);
});
