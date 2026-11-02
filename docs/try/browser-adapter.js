(() => {
  'use strict';
  const status = document.getElementById('trialSaveStatus');
  const pending={};
  function error(message) {
    status.dataset.error='true';
    status.textContent='未能保存：'+String(message?.message || message)+'。请保留当前页面；未保存的修改可用“导出备份”下载恢复备份。';
  }
  let storage;
  try { storage=window.localStorage; } catch(e) { error(e); }
  const store=window.NelumiWebStore.createStore({storage,onError:error});
  window.NelumiTrialStore=store;
  const saved=()=>{if(status.dataset.error!=='true')status.textContent='已保存在当前浏览器 · 只有你自己可见';};
  const write=(kind,fn)=>(value)=>{try {const result=fn(value);delete pending[kind];if(!Object.keys(pending).length)delete status.dataset.error;saved();return result;}catch(e){pending[kind]=structuredClone(value);error(e);throw e;}};
  const noop=()=>{};
  window.deskcal={
    getState:async()=>{const result=store.getState();saved();return result;},
    saveEvents:async events=>{write('events',store.saveEvents)(events);return {ok:true};},
    saveCalendars:async calendars=>{write('calendars',store.saveCalendars)(calendars);return store.getState().calendars;},
    updateSettings:async patch=>{write('settings',store.updateSettings)(patch);return store.getState().settings;},
    windowAction:noop,onCreateRequest:noop,onOpenSettings:noop,onSettingsChanged:noop,onReminder:noop,onReminderOpen:noop,
    openExternal:async url=>{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))throw Error('网址不支持');window.open(parsed.href,'_blank','noopener,noreferrer');},
    exportData:async()=>{
      let backup,recovery=false;
      if(Object.keys(pending).length){
        const data=store.getState(),memory=new Map();
        const temporary=window.NelumiWebStore.createStore({storage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)}});
        temporary.saveCalendars(pending.calendars||data.calendars);
        const previous=new Map(data.events.map(event=>[event.id,event]));
        const events=[];
        for(const event of pending.events||data.events){
          if(previous.has(event.id)&&JSON.stringify(previous.get(event.id))!==JSON.stringify(event)){
            const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(event)));
            const id='recovery-'+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
            events.push({...event,id,title:('[恢复副本] '+event.title).slice(0,2000)});
          }else events.push(event);
        }
        temporary.saveEvents(events);
        temporary.updateSettings({...data.settings,...pending.settings});
        backup=temporary.exportBackup();recovery=true;
      }else backup=store.exportBackup();
      const blob=new Blob([backup],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=(recovery?'nelumi-recovery-':'nelumi-backup-')+new Date().toISOString().slice(0,10)+'.json';
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      if(recovery)status.textContent='恢复备份已导出。未保存的修改在合并时另存为“恢复副本”，原日程保留；请保留本页直到完成恢复。';
      return {canceled:false};
    },
    importData:()=>new Promise(resolve=>{
      const input=document.getElementById('trialBackupFile');input.value='';
      input.oncancel=()=>resolve({canceled:true});
      input.onchange=async()=>{const file=input.files[0];if(!file){resolve({canceled:true});return;}
        try {if(file.size>5*1024*1024)throw Error('备份超过 5 MB');store.importBackup(await file.text());saved();resolve({canceled:false,state:store.getState()});}
        catch(e){error(e);resolve({canceled:true});}
      };input.click();
    })
  };
  window.addEventListener('unhandledrejection',event=>{error(event.reason);event.preventDefault();});
  window.addEventListener('storage',event=>{if(event.key==='nelumi-web-trial-v1') {status.dataset.error='true';status.textContent='另一个标签页更新了日程。请先导出当前备份，再刷新查看最新数据，避免互相覆盖。';}});
})();
