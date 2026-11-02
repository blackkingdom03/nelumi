const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
function run(fail) {
 const calls=[],stored={schemaVersion:2,events:[{id:'a',title:'old'}]};
 const context=vm.createContext({dataPath:'',appData:{},SCHEMA_VERSION:2,DEFAULT_DATA:{events:[]},path,Date,structuredClone,
 app:{getPath:()=>'/profile',quit:()=>calls.push('quit')},dialog:{showErrorBox:()=>calls.push('error')},
 fs:{constants:fs.constants,readFileSync:()=>JSON.stringify(stored),copyFileSync:()=>{calls.push('backup');if(fail==='backup')throw Error('disk full');}},
 mergeData:()=>{if(fail==='migration')throw Error('bad upgrade');return {...stored,events:[{id:'a',title:'new',titleAutomation:{version:1}}]};},
 persistData:()=>calls.push('persist')});
 vm.runInContext(source.slice(source.indexOf('function loadData()'),source.indexOf('function persistData()'))+';loadData();',context);
 return calls;
}
test('upgrade creates backup before writing',()=>assert.deepEqual(run(),['backup','persist']));
test('migration or backup failure stops startup without writing empty data',()=>{
 for(const fail of ['migration','backup']) {const calls=run(fail);assert.equal(calls.includes('persist'),false);assert.ok(calls.includes('quit'));}
});
