const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/main.js'),'utf8');
function fixture(minimized=false) {
 const calls=[],handlers={};
 const window={isDestroyed:()=>false,isVisible:()=>true,isMinimized:()=>minimized,restore:()=>calls.push('restore'),show:()=>calls.push('show'),moveTop:()=>calls.push('moveTop'),focus:()=>calls.push('focus'),hide:()=>calls.push('hide')};
 const context=vm.createContext({mainWindow:window,appData:{settings:{clickThrough:false}},applyWindowSettings:()=>calls.push('settings'),createWindow:()=>{},updateTrayMenu:()=>{},createAppIcon:()=>({resize:()=>({})}),Tray:class {setToolTip(){}on(name,fn){handlers[name]=fn;}},tray:null});
 vm.runInContext(source.slice(source.indexOf('function showWindow()'),source.indexOf('function updateTrayMenu()'))+source.slice(source.indexOf('function createTray()'),source.indexOf('function localDateKey('))+';createTray();',context);
 return {calls,handlers,context};
}
test('tray click raises an already visible but obscured calendar instead of hiding it',()=>{
 const f=fixture();f.handlers.click();assert.deepEqual(f.calls,['settings','show','moveTop','focus']);
 f.calls.length=0;f.handlers.click();assert.equal(f.calls.includes('hide'),false);
});
test('activation restores minimized calendar before showing and focusing',()=>{
 const f=fixture(true);vm.runInContext('showWindow()',f.context);
 assert.deepEqual(f.calls,['settings','restore','show','moveTop','focus']);
});
