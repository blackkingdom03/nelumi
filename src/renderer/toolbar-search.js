window.NelumiToolbarSearch = (() => {
  let panel, input, button;
  const isOpen = () => Boolean(panel?.matches(':popover-open'));
  function position() {
    if (!isOpen()) return;
    const anchor = button.getBoundingClientRect();
    const left = Math.max(12, Math.min(anchor.width ? anchor.left : innerWidth - panel.offsetWidth - 12, innerWidth - panel.offsetWidth - 12));
    const top = Math.max(12, Math.min(anchor.width ? anchor.bottom + 8 : 48, innerHeight - panel.offsetHeight - 12));
    panel.style.left = `${left}px`; panel.style.top = `${top}px`;
  }
  function close(restoreFocus = false) {
    if (!isOpen()) return;
    panel.hidePopover(); button.setAttribute('aria-expanded','false');
    syncEditingPanels();
    if (restoreFocus) button.focus({preventScroll:true});
  }
  function refresh() {
    if (!isOpen()) return;
    const query = input.value.trim(), matches = searchEvents(query);
    const results = document.getElementById('toolbarSearchResults');
    const focusedId = results.contains(document.activeElement) ? document.activeElement.dataset.searchEvent : null;
    results.replaceChildren();
    document.getElementById('toolbarSearchStatus').textContent = !query ? '搜索标题、地点、通知原文和笔记' :
      !matches.length ? '没有找到相关事项' : `找到 ${matches.length} 项${matches.length>50?'，显示前50项，请细化关键词':''}`;
    for (const event of matches.slice(0,50)) {
      const row = document.createElement('div'); row.setAttribute('role','listitem');
      const item = document.createElement('button');item.type='button';item.className='toolbar-search-result';item.dataset.searchEvent=event.id;
      const title = document.createElement('strong');title.textContent=event.title;
      const meta = document.createElement('span');
      const repeating = normalizeRecurrence(event).frequency !== 'none';
      meta.textContent = `${event.date}${repeating?' · 重复事项 · 系列起始':''} · ${calendarById(event.calendarId||'personal')?.name||'日历'}${event.completed?' · 已完成':''}`;
      item.append(title,meta);row.append(item);results.append(row);
      item.addEventListener('click',()=>{
        // Re-check the current data; an open result must not resurrect deleted/hidden items.
        const current = visibleEvents().find(e=>e.id===event.id);
        if (!current) {refresh();return;}
        close();
        window.NelumiNavigation.selectDate(current.date);
        window.NelumiNotebook.showEvent(current.id,current.date);
        const heading=document.getElementById('detailTitle');heading.tabIndex=-1;heading.focus({preventScroll:true});
      });
    }
    if (focusedId) {
      const retained = Array.from(results.querySelectorAll('[data-search-event]')).find(node=>node.dataset.searchEvent===focusedId);
      (retained || input).focus({preventScroll:true});
    }
    position();
  }
  function open() {
    if (!isOpen()) panel.showPopover();
    button.setAttribute('aria-expanded','true');refresh();syncEditingPanels();input.focus();input.select();
  }
  function init() {
    panel=document.getElementById('toolbarSearchPanel');input=document.getElementById('toolbarSearchInput');button=document.getElementById('toolbarSearchButton');
    // Native popover target handles pointer light-dismiss before click correctly.
    panel.addEventListener('beforetoggle',event=>{
      if(event.newState==='open')queueMicrotask(()=>{
        if(!isOpen())return;
        button.setAttribute('aria-expanded','true');refresh();syncEditingPanels();input.focus();input.select();
      });
    });
    document.getElementById('toolbarSearchClose').addEventListener('click',()=>close(true));
    input.addEventListener('input',refresh);
    panel.addEventListener('toggle',()=>{button.setAttribute('aria-expanded',String(isOpen()));syncEditingPanels();});
    panel.addEventListener('keydown',event=>{
      if(event.isComposing || event.keyCode===229)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
      if(event.target===input && (event.key==='Enter'||event.key==='ArrowDown')){
        event.preventDefault();const first=panel.querySelector('[data-search-event]');
        if(event.key==='Enter')first?.click();else first?.focus();
      }
    });
    window.addEventListener('resize',position);
    document.querySelector('.workspace').addEventListener('scroll',position);
  }
  return {init,open,refresh,isOpen};
})();
