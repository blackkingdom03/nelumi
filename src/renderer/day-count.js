window.NelumiDayCount=(()=>{
 let panel,anchor;
 const isOpen=()=>Boolean(panel?.matches(':popover-open'));
 function close(restore=false){if(isOpen())panel.hidePopover();if(anchor){anchor.setAttribute('aria-expanded','false');if(restore)anchor.focus({preventScroll:true});}}
 function open(key){
  const events=eventsForDate(key);if(!events.length)return;
  if(!panel){panel=document.createElement('section');panel.id='dayCountPanel';panel.setAttribute('popover','auto');panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','dayCountTitle');document.body.append(panel);panel.addEventListener('toggle',()=>{anchor?.setAttribute('aria-expanded',String(isOpen()));syncEditingPanels();});window.addEventListener('resize',()=>close());document.querySelector('.workspace')?.addEventListener('scroll',()=>close());}
  anchor=document.querySelector('[data-day-count="'+key+'"]');if(!anchor)return;
  panel.replaceChildren();const header=document.createElement('div');header.className='day-count-heading';const title=document.createElement('h3');title.id='dayCountTitle';title.textContent=key+' · 共 '+events.length+' 项';const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='icon-button';dismiss.textContent='×';dismiss.setAttribute('aria-label','关闭当天日程');dismiss.onclick=()=>close(true);header.append(title,dismiss);panel.append(header);
  const list=document.createElement('div');list.setAttribute('role','list');
  for(const event of events){const row=document.createElement('div');row.setAttribute('role','listitem');const b=document.createElement('button');b.type='button';b.className='day-count-event';const name=document.createElement('strong');name.textContent=event.title;const meta=document.createElement('span');meta.textContent=(event.allDay?'全天':event.startTime||'未填时间')+(event.completed?' · 已完成':'');b.append(name,meta);if(event.location?.trim()){const place=document.createElement('span');place.className='day-count-location';place.textContent='地点：'+event.location.trim();b.append(place);}b.onclick=()=>{close();if(eventsForDate(key).some(e=>e.id===event.id))window.NelumiNotebook.showEvent(event.id,key);};row.append(b);list.append(row);}panel.append(list);
  panel.showPopover();anchor.setAttribute('aria-expanded','true');const r=anchor.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(r.right-panel.offsetWidth,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+7,innerHeight-panel.offsetHeight-8))+'px';dismiss.focus({preventScroll:true});syncEditingPanels();
 }
 return {open,close,isOpen};
})();
