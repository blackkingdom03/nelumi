/* Local notice drafts and event-linked notes. No remote processing. */
window.NelumiNotebook = (() => {
  let ocrJob = null;
  const storageKey = 'nelumi-notebook-v1';
  let saved = {}, selected = null, busy = false, ready = false, sourceEditing = false;
  const get = id => document.getElementById(id);
  const keyFor = () => selected ? `${selected.id}@${selected.date}` : '';
  function status(message) { get('notebookStatus').textContent = message; }
  function persist() {
    let stored=true;
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
    catch { stored=false;status('草稿或操作历史暂时无法写入本地，请保留当前窗口。'); }
    syncEditingPanels();
    return stored;
  }
  function isEditing() {
    if (!ready) return false;
    return busy || Boolean(ocrJob) || Boolean(saved.notice?.text) || Object.keys(saved.notes || {}).some(key => activeEvents().some(e => key.startsWith(`${e.id}@`))) ||
      Object.keys(saved.sources || {}).some(key => activeEvents().some(e => key.startsWith(`${e.id}@`))) ||
      Boolean(document.activeElement?.closest('.notebook-panel input, .notebook-panel textarea, .notebook-panel select'));
  }
  function showTab(tab) {
    saved.tab = tab;
    get('eventDetailPane').hidden = false;
    get('noticePane').hidden = false;
    persist();
  }
  function showEvent(id, date) {
    const event = activeEvents().find(item => item.id === id);
    if (!event) return;
    sourceEditing = false;
    selected = {id, date:date || event.date};
    saved.selected = selected;
    get('sourceStatus').textContent = saved.sources?.[keyFor()] !== undefined ? '原文有未保存的修改。' : '';
    showTab('detail'); render();
    get('eventDetailPane').scrollIntoView({block:'nearest',behavior:'auto'});
  }
  function highlightedNodes(parts) {
    return parts.map(part=>{
      if(part.href){const link=document.createElement('a');link.textContent=part.text;link.href=part.href;link.target='_blank';link.rel='noopener noreferrer';link.title='打开网址：'+part.href;return link;}
      if(!part.kind)return document.createTextNode(part.text);
      const mark=document.createElement('mark');mark.className='notice-highlight-'+part.kind;mark.textContent=part.text;mark.title={date:'日期',time:'时间',place:'地点'}[part.kind];return mark;
    });
  }
  function renderComposerHighlight() {
    const input=get('noticeInput'), layer=get('noticeInputHighlights');
    if(!input||!layer)return;
    const style=getComputedStyle(input);
    for(const property of ['font','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','textIndent','textAlign','tabSize','paddingTop','paddingBottom','paddingLeft','paddingRight','wordBreak','overflowWrap'])layer.style[property]=style[property];
    layer.style.left=style.borderLeftWidth;layer.style.top=style.borderTopWidth;
    layer.style.width=input.clientWidth+'px';layer.style.height=input.clientHeight+'px';
    layer.replaceChildren(...window.NelumiNoticeHighlights.parts(input.value).map(part=>{
      if(!part.kind)return document.createTextNode(part.text);
      const mark=document.createElement('mark');mark.className='notice-highlight-'+part.kind;mark.textContent=part.text;return mark;
    }));
    if(input.value.endsWith('\n'))layer.append(document.createTextNode('\n'));
    layer.scrollTop=input.scrollTop;layer.scrollLeft=input.scrollLeft;
  }
  function renderSource() {
    const view=get('detailSourceView'), input=get('detailSource'), button=get('editSourceButton');
    const event=activeEvents().find(item=>item.id===selected?.id);
    const parts=window.NelumiNoticeHighlights.parts(input.value,event?.location||''), hasRichText=parts.some(part=>part.href||part.kind);
    view.replaceChildren(...highlightedNodes(parts));
    view.hidden=!hasRichText||sourceEditing;input.hidden=hasRichText&&!sourceEditing;
    button.hidden=!hasRichText&&!sourceEditing;button.textContent=sourceEditing?'完成编辑':'编辑原文';
    button.disabled=input.disabled;button.setAttribute('aria-expanded',String(sourceEditing));
  }
  function render() {
    if (!ready) return;
    const event = activeEvents().find(item => item.id === selected?.id);
    get('detailEmpty').hidden = Boolean(event);
    get('detailBody').hidden = false;
    get('detailNotes').disabled = !event;
    get('detailSource').disabled = !event;
    get('copySourceButton').disabled = !event;
    get('saveNotesButton').disabled = !event || busy;
    get('detailQuickEdit').disabled = !event || busy;
    get('detailEdit').disabled = !event || busy;
    if (event) {
      get('detailTitle').textContent = event.title;
      const source = saved.sources?.[keyFor()] ?? event.sourceText ?? '';
      if (get('detailSource').value !== source) get('detailSource').value = source;
      const notes = saved.notes?.[keyFor()] ?? event.notes ?? '';
      if (get('detailNotes').value !== notes) get('detailNotes').value = notes;
    } else {
      get('detailTitle').textContent = '尚未选择事项';
      get('detailSource').value = '';
      get('detailNotes').value = '';
    }
    renderSource();
    renderComposerHighlight();
    for(const [id,stack,label] of [['undoNoticeButton','past','撤销'],['redoNoticeButton','future','重做']]) {
      const count=saved.history[stack].length;
      get(id).disabled=busy || !count;
      get(id).title=count?`${label}上一次通知录入（可${label} ${count} 步）`:`没有可${label}的通知录入`;
      get(id).setAttribute('aria-label',get(id).title);
    }
  }
  function captureNotice() {saved.notice={text:get('noticeInput').value};persist();renderComposerHighlight();}
  function signature(e) {
    const r=normalizeRecurrence(e);
    return JSON.stringify([e.title,e.date,e.allDay,e.startTime||'',e.endTime||'',e.location||'',e.sourceText||'',e.notes||'',
      !!e.completed,!!e.cancelled,e.calendarId,e.category,e.color,e.allDayReminderTime||'09:00',e.reminders||[],e.exceptions||[],r.frequency,r.interval,r.until||null,r.count||null,...(e.lunarDate?[e.lunarDate]:[])]);
  }
  function trimHistory() {
    // ponytail: bounded local history, not an unlimited event archive; keep the latest batch intact.
    const h=saved.history;
    while(h.past.length+h.future.length>1 && (h.past.length+h.future.length>50 || JSON.stringify(h).length>500000)) {
      if(h.past.length) h.past.shift(); else h.future.shift();
    }
  }
  function loadHistory() {
    const valid=batch=>batch && typeof batch.text==='string' && batch.text.length<=50000 && Array.isArray(batch.items) && batch.items.length>0 && batch.items.length<=20 &&
      batch.items.every(item=>typeof item?.id==='string' && typeof item.signature==='string') && new Set(batch.items.map(item=>item.id)).size===batch.items.length;
    const h=saved.history;
    saved.history={past:Array.isArray(h?.past)?h.past.filter(valid):valid(saved.undo)?[saved.undo]:[],future:Array.isArray(h?.future)?h.future.filter(batch=>valid(batch) && typeof batch.deletedAt==='string'):[]};
    delete saved.undo;
    for(const batch of [...saved.history.past,...saved.history.future]) {
      batch.id ||= crypto.randomUUID();
      for(const item of batch.items) {
        const event=state.events.find(e=>e.id===item.id),meta=event?.titleAutomation;
        // Adopt title-only program upgrades without weakening protection for manual edits.
        if(meta && !meta.manual) {
          try {const old=JSON.parse(item.signature);if([meta.originalTitle,meta.previousTitle].includes(old[0])) {old[0]=event.title;if(JSON.stringify(old)===signature(event)) item.signature=signature(event);}} catch {}
        }
      }
    }
    trimHistory();
  }
  async function writeEvents(next) {
    const result=await window.deskcal.saveEvents(next);
    if(result?.ok !== true) throw new Error('保存未成功，请重试。');
    state.events=next;
  }
  async function scopedChanges(event,date,changes) {
    const repeating=normalizeRecurrence(event).frequency!=='none';
    if(repeating && !occursOn(event,parseDate(date))) throw new Error('该日期不是此重复事项的一次安排，请重新选择。');
    const scope=repeating ? await chooseRecurrenceScope('保存关联内容','选择这次修改应用到哪一部分日程。') : 'series';
    if(scope==='cancel') return null;
    const result=PlannerCore.applyOccurrenceChange(event,date,changes,scope,()=>crypto.randomUUID());
    const next=state.events.map(e=>e.id===event.id ? result.original : e);
    if(result.detached) next.push(result.detached);
    return {next,event:result.detached || result.original};
  }
  async function saveAssociated(field) {
    if(busy) return;
    const event=activeEvents().find(e=>e.id===selected?.id);
    if(!event) return;
    const source=field==='sourceText', drafts=source?saved.sources:saved.notes;
    const input=source?'detailSource':'detailNotes', label=source?'原文':'笔记', limit=source?50000:20000;
    const report=message=>{status(message);if(source)get('sourceStatus').textContent=message;};
    const draftKey=keyFor(), selection={...selected}, value=get(input).value;
    if(source && value===(event.sourceText || '')) return;
    if(value.length>limit) {report(`${label}最多 ${limit.toLocaleString('en-US')} 字符，请精简后保存。`);return;}
    busy=true; render(); syncEditingPanels();
    try {
      const result=await scopedChanges(event,selection.date,{[field]:value});
      if(!result) return;
      await writeEvents(result.next);
      const newerDraft=drafts[draftKey] !== undefined && drafts[draftKey] !== value;
      if(!newerDraft) delete drafts[draftKey];
      if(selected?.id===selection.id && selected?.date===selection.date) {
        selected={id:result.event.id,date:selection.date}; saved.selected=selected;
        if(newerDraft && keyFor()!==draftKey) {drafts[keyFor()]=drafts[draftKey];delete drafts[draftKey];}
        const otherDrafts=source?saved.notes:saved.sources;
        if(keyFor()!==draftKey && otherDrafts[draftKey]!==undefined) {otherDrafts[keyFor()]=otherDrafts[draftKey];delete otherDrafts[draftKey];}
      }
      const stored=persist(); window.render(); report(`${label}已保存。${newerDraft?'新输入的修改尚未保存。':''}${stored?'':'草稿状态未能写入本地，请保留当前窗口。'}`);
    } catch(error) {report(`保存失败：${error.message}。草稿已保留。`);}
    finally {busy=false;render();syncEditingPanels();}
  }
  async function copySource() {
    const selection=keyFor(), text=get('detailSource').value;
    try {
      await navigator.clipboard.writeText(text);
      if(keyFor()===selection) get('sourceStatus').textContent='全文已复制。';
    } catch {
      if(keyFor()===selection) get('sourceStatus').textContent='复制失败，请选中文字后按 Ctrl+C 复制。';
    }
  }
  function ocrControls(active) {
    get('noticeInput').disabled=active;get('noticeInput').setAttribute('aria-busy',String(active));
    get('noticeImageButton').disabled=active;get('cancelNoticeOCR').hidden=!active;
    get('saveNoticeButton').disabled=active||busy;syncEditingPanels();
  }
  async function readNoticeImage(file) { status('在线试用暂不支持图片识别，请粘贴通知文字；图片识别可使用桌面版。'); return;
    if(busy||ocrJob){status('请等待当前操作完成，或取消图片识别。');return;}
    const invalid=window.NelumiNoticeOCR.validateFile(file);if(invalid){status(invalid);return;}
    status('正在本地识别图片…');
    const job=window.NelumiNoticeOCR.start(file,progress=>{if(ocrJob===job)status(progress?'正在识别图片 '+progress+'%…':'正在加载本地识别组件…');});
    ocrJob=job;ocrControls(true);
    try{
      const result=await job.promise;if(ocrJob!==job)return;
      // Append to the current draft; never replace text typed before this image.
      const current=get('noticeInput').value;
      const combined=current+(current.trim()?'\n':'')+result.text;
      if(combined.length>50000)throw Error('合并后文字超过 50,000 字符，请先处理已有消息再重试。');
      get('noticeInput').value=combined;captureNotice();
      status((result.confidence<70?'部分文字可能识别不准。':'图片文字已识别。')+'请核对文字、日期和时间，再点确定生成日程。');
    }catch(error){if(ocrJob===job)status(error.message||'图片识别失败，请换一张清晰图片重试。');}
    finally{if(ocrJob===job){ocrJob=null;ocrControls(false);get('noticeInput').focus();}}
  }
  async function saveNotice(event) {
    event?.preventDefault();
    if(busy||ocrJob) return;
    if(get('eventDialog').open) {status('请先保存或关闭正在编辑的日程。');return;}
    const text=get('noticeInput').value,parsed=window.DeskCalNoticeInput.parseNoticeDraft(text,new Date());
    if(!parsed.ok) {status(parsed.error);return;}
    const submittedDraft=saved.notice;
    if(parsed.review) {
      const confirmed=[];
      const openNext=()=>{
        const index=confirmed.length;
        const hint=(parsed.items.length>1?`第${index+1}/${parsed.items.length}条，全部确认后一起保存。`:'')+parsed.summary;
        openNoticeEventDraft(parsed.items[index],hint,async value=>{
          if(index<parsed.items.length-1) {
            confirmed.push(value);get('eventDialog').close();openNext();return;
          }
          if(await commitNotice([...confirmed,value],text,submittedDraft,'')) get('eventDialog').close();
        });
      };
      openNext();status('已填写编辑框，检查后保存；取消会保留消息。');return;
    }
    try {
      const calendar=state.calendars.find(c=>c.visible!==false) || state.calendars[0];
      if(!calendar) throw new Error('请先创建一个日历');
      const timestamp=new Date().toISOString();
      const created=parsed.items.map(item=>({
        id:crypto.randomUUID(),title:item.title,date:item.date,allDay:item.allDay,startTime:item.startTime,endTime:item.endTime,
        titleAutomation:{version:window.DeskCalNoticeInput.TITLE_VERSION,lastTitle:item.title,originalTitle:item.title,manual:false},
        allDayReminderTime:'09:00',reminders:[],recurrence:item.recurrence,repeat:item.recurrence.frequency,exceptions:[],
        calendarId:calendar.id,category:'work',color:calendar.color||'#6750e8',location:item.location,notes:'',sourceText:text,
        completed:false,cancelled:false,deletedAt:null,createdAt:timestamp,updatedAt:timestamp
      }));
      await commitNotice(created,text,submittedDraft,parsed.summary);
    } catch(error) {status('保存失败：'+error.message+'。消息已保留。');}
  }
  async function commitNotice(created,text,submittedDraft,summary) {
    if(busy) return false;
    busy=true;get('saveNoticeButton').disabled=true;render();syncEditingPanels();
    try {
      await writeEvents([...state.events,...created]);
      saved.history.past.push({id:crypto.randomUUID(),text,items:created.map(e=>({id:e.id,signature:signature(e)}))});
      saved.history.future=[];trimHistory();
      if(saved.notice===submittedDraft) {saved.notice={};get('noticeInput').value='';}
      selected={id:created[0].id,date:created[0].date};saved.selected=selected;
      state.searchQuery='';get('searchInput').value='';state.filter='all';
      window.NelumiNavigation.selectDate(selected.date);
      const stored=persist();window.render();status('已添加'+created.length+'条事项'+(summary?' · '+summary:'')+(stored?'':'；操作历史未能写入本地，请保留当前窗口。'));
      return true;
    } catch(error) {
      const message='保存失败：'+error.message+'。消息已保留。';status(message);
      if(get('eventDialog').open) {get('eventDraftHint').textContent=message;get('eventDraftHint').classList.remove('hidden');}
      return false;
    }
    finally {busy=false;get('saveNoticeButton').disabled=false;render();syncEditingPanels();}
  }
  async function travelHistory(undo) {
    const from=undo?saved.history.past:saved.history.future,to=undo?saved.history.future:saved.history.past;
    if(busy || !from.length) return;
    const batch=from.at(-1),draft=saved.notice,label=undo?'撤销':'重做';
    if(batch.items.some(item=>{const e=state.events.find(e=>e.id===item.id);return !e || signature(e)!==item.signature || (undo?Boolean(e.deletedAt):e.deletedAt!==batch.deletedAt);} )) {
      status(`本次事项已被修改、删除或恢复，${label}不会覆盖后续修改。`);return;
    }
    busy=true;get('saveNoticeButton').disabled=true;render();syncEditingPanels();
    try {
      const ids=new Set(batch.items.map(item=>item.id)),timestamp=new Date().toISOString();
      await writeEvents(state.events.map(e=>ids.has(e.id)?{...e,deletedAt:undo?timestamp:null,updatedAt:timestamp}:e));
      from.pop();to.push({...batch,deletedAt:undo?timestamp:null});
      if(undo && saved.notice===draft && !get('noticeInput').value.trim()) {saved.notice={text:batch.text,restoredBatch:batch.id};get('noticeInput').value=batch.text;}
      if(!undo && saved.notice===draft && saved.notice?.restoredBatch===batch.id) {saved.notice={};get('noticeInput').value='';}
      const stored=persist();window.render();status((undo?'已撤销本次添加，事项已移入回收站。':'已重做本次添加，事项已恢复。')+(stored?'':'操作历史未能写入本地，请保留当前窗口。'));
    } catch(error) {status(label+'失败：'+error.message+'。可以重试。');}
    finally {busy=false;get('saveNoticeButton').disabled=false;render();syncEditingPanels();}
  }
  function init() {
    try {saved=JSON.parse(localStorage.getItem(storageKey) || '{}') || {};} catch {saved={};}
    if(typeof saved!=='object' || Array.isArray(saved)) saved={};
    if(!saved.notes || typeof saved.notes!=='object') saved.notes={};
    if(!saved.sources || typeof saved.sources!=='object' || Array.isArray(saved.sources)) saved.sources={};
    selected=saved.selected || null;
    const panel=document.createElement('section'); panel.className='notebook-panel';
    panel.setAttribute('aria-label','事项笔记与通知');
    panel.innerHTML=`
      <div id="eventDetailPane" role="region" aria-label="事项详情">
        <p id="detailEmpty" class="muted">点击日历或列表中的事项，在这里查看通知和笔记。</p>
        <div id="detailBody">
          <div class="notebook-heading detail-heading"><h3 id="detailTitle"></h3>
            <div class="notebook-buttons"><button id="detailQuickEdit" class="text-button" type="button">快速调整</button><button id="detailEdit" class="secondary-button" type="button">编辑日程</button></div></div>
          <div class="notebook-columns"><div><div class="source-heading"><label id="sourceLabel" for="detailSource">通知原文</label><button id="editSourceButton" class="text-button" type="button" aria-controls="detailSource" hidden>编辑原文</button></div><div id="detailSourceView" class="notice-source" role="region" aria-labelledby="sourceLabel" hidden></div><textarea id="detailSource" class="notice-source" rows="10" placeholder="粘贴或编辑这条事项的通知原文…" aria-describedby="sourceStatus"></textarea>
          <div class="source-save-row"><p id="sourceStatus" class="muted" role="status" aria-live="polite"></p><button id="copySourceButton" type="button" class="primary-button">复制全文</button></div></div>
          <div><label for="detailNotes">我的笔记</label><textarea id="detailNotes" rows="6" placeholder="写下需要准备的材料、链接或补充说明…"></textarea>
          <div class="notebook-buttons"><button id="saveNotesButton" type="button" class="primary-button">保存笔记</button></div></div></div>
        </div>
      </div>
      <div id="noticePane" role="region" aria-labelledby="noticeTab">
        <div class="notebook-heading"><label id="noticeTab" for="noticeInput">粘贴消息自动标记日程</label><div class="notice-history" role="group" aria-label="通知录入历史">
          <button id="undoNoticeButton" class="history-button" type="button" aria-label="撤销通知录入" title="撤销通知录入" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M4 10l4-4a6 6 0 0 1 8.5 8.5L8 23"/></svg></button>
          <button id="redoNoticeButton" class="history-button" type="button" aria-label="重做通知录入" title="重做通知录入" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4v6h-6M20 10l-4-4a6 6 0 0 0-8.5 8.5L16 23"/></svg></button>
        </div></div>
        <form id="noticeForm">
          <div class="notice-input-editor"><div id="noticeInputHighlights" aria-hidden="true"></div><textarea id="noticeInput" rows="5" placeholder="粘贴通知、消息或图片；图片识别后可修改文字。Enter 添加，Shift+Enter 换行" aria-labelledby="noticeTab" spellcheck="false"></textarea></div>
          <div class="notice-image-tools"><button id="noticeImageButton" type="button" class="text-button">选择图片</button><input id="noticeImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" hidden /><button id="cancelNoticeOCR" type="button" class="text-button" hidden>取消识别</button></div>
          <div class="notice-submit-row"><p id="notebookStatus" role="status" aria-live="polite"></p><button id="saveNoticeButton" type="submit" class="primary-button">确定</button></div>
        </form>
      </div>`;
    document.querySelector('.workspace').append(panel);
    const agenda=document.querySelector('.agenda-panel');
    const listSide=document.createElement('div');listSide.className='agenda-list-side';
    listSide.append(...agenda.children);agenda.append(listSide);
    const composer=document.createElement('section');composer.className='notice-composer notebook-panel';
    composer.setAttribute('aria-label','粘贴消息自动标记日程');
    composer.append(get('noticePane'));agenda.append(composer);loadHistory();ready=true;
    get('noticeTab').onclick=()=>{showTab('notice');get('noticeInput').focus();};
    get('detailNotes').addEventListener('input',()=>{if(selected){const event=activeEvents().find(e=>e.id===selected.id); if(!busy && get('detailNotes').value===(event?.notes || '')) delete saved.notes[keyFor()]; else saved.notes[keyFor()]=get('detailNotes').value;persist();status('笔记草稿已保留，点击保存写入事项。');}});
    get('detailSource').addEventListener('input',()=>{if(selected){const event=activeEvents().find(e=>e.id===selected.id);if(!busy && get('detailSource').value===(event?.sourceText || ''))delete saved.sources[keyFor()];else saved.sources[keyFor()]=get('detailSource').value;const stored=persist();get('sourceStatus').textContent=stored?'修改已暂存，离开输入框时自动保存。':'草稿暂时无法写入本地，请保留当前窗口。';}});
    get('detailSource').addEventListener('blur',()=>{if(saved.sources[keyFor()]!==undefined) void saveAssociated('sourceText');});
    get('saveNotesButton').onclick=()=>saveAssociated('notes');
    get('copySourceButton').onclick=copySource;
    get('editSourceButton').onclick=()=>{sourceEditing=!sourceEditing;renderSource();if(sourceEditing)get('detailSource').focus();else if(saved.sources[keyFor()]!==undefined)void saveAssociated('sourceText');};
    get('detailSourceView').addEventListener('click',async event=>{
      const link=event.target.closest('a');if(!link||!window.deskcal.openExternal)return;
      event.preventDefault();const selection=keyFor();
      try{await window.deskcal.openExternal(link.href);}catch{if(keyFor()===selection)get('sourceStatus').textContent='网址未能打开，请复制网址到浏览器重试。';}
    });
    get('detailEdit').onclick=()=>{if(selected)openEventDialog(selected.id,selected.date);};
    get('detailQuickEdit').onclick=()=>{if(selected)openQuickEdit(selected.id,selected.date);};
    get('noticeForm').onsubmit=saveNotice;get('undoNoticeButton').onclick=()=>travelHistory(true);get('redoNoticeButton').onclick=()=>travelHistory(false);
    get('noticeImageButton').onclick=()=>get('noticeImageFile').click();
    get('noticeImageFile').onchange=()=>{const file=get('noticeImageFile').files[0];get('noticeImageFile').value='';if(file)void readNoticeImage(file);};
    get('cancelNoticeOCR').onclick=()=>{if(ocrJob){ocrJob.cancel();ocrJob=null;ocrControls(false);status('已取消图片识别，已有消息保留。');}};
    get('noticeInput').addEventListener('paste',event=>{
      const images=[...(event.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/'));
      if(!images.length)return;event.preventDefault();
      if(images.length>1){status('请一次粘贴一张图片，识别后可继续粘贴。');return;}
      const file=images[0].getAsFile();if(file)void readNoticeImage(file);
    });
    window.addEventListener('beforeunload',()=>ocrJob?.cancel());
    get('noticeInput').addEventListener('scroll',()=>{get('noticeInputHighlights').scrollTop=get('noticeInput').scrollTop;get('noticeInputHighlights').scrollLeft=get('noticeInput').scrollLeft;});
    new ResizeObserver(renderComposerHighlight).observe(get('noticeInput'));
    window.addEventListener('resize',renderComposerHighlight);
    document.fonts.ready.then(renderComposerHighlight);
    get('noticeInput').addEventListener('input',()=>{captureNotice();status('');});
    get('noticeInput').addEventListener('keydown',event=>{
      if(event.key==='Enter' && !event.shiftKey && !event.isComposing && event.keyCode!==229) {
        event.preventDefault();if(!event.repeat) void saveNotice();
      }
    });
    // Hold other mutation controls while disk persistence is pending; typing remains available.
    for(const type of ['click','submit','change','pointerdown','pointerup','drop','keydown']) document.addEventListener(type,event=>{
      if(!busy || event.target.closest?.('#recurrenceScopeDialog')) return;
      if(event.target.closest?.('#copySourceButton, #editSourceButton')) return;
      if(event.target.matches?.('#noticeInput, #detailNotes, #detailSource') && !(type==='keydown' && event.ctrlKey && ['n','k'].includes(event.key.toLowerCase()))) return;
      if(type==='keydown' && event.key==='Escape') return;
      event.preventDefault();event.stopImmediatePropagation();
    },true);
    panel.addEventListener('focusin',()=>syncEditingPanels());
    panel.addEventListener('focusout',()=>queueMicrotask(syncEditingPanels));
    composer.addEventListener('focusin',()=>syncEditingPanels());
    composer.addEventListener('focusout',()=>queueMicrotask(syncEditingPanels));
    get('noticeInput').value=typeof saved.notice?.text==='string'?saved.notice.text:'';
    showTab(saved.tab==='notice'?'notice':'detail');queueMicrotask(render);
  }
  return {init,render,showEvent,isEditing};
})();

