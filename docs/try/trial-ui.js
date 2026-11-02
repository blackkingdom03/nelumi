(() => {
  'use strict';
  document.getElementById('trialAdd').onclick=()=>document.getElementById('addEventButton').click();
  document.getElementById('trialPaste').onclick=()=>{const input=document.getElementById('noticeInput');input.scrollIntoView({block:'center',behavior:'smooth'});input.focus({preventScroll:true});};
  document.getElementById('trialExport').onclick=()=>document.getElementById('exportButton').click();
  document.getElementById('trialImport').onclick=()=>document.getElementById('importButton').click();
  const dialog=document.getElementById('trialFeedbackDialog');
  document.getElementById('trialFeedback').onclick=()=>dialog.showModal();
  document.getElementById('trialCloseFeedback').onclick=()=>dialog.close();
  document.getElementById('trialCopyFeedback').onclick=async()=>{
    const field=document.getElementById('trialFeedbackText'),status=document.getElementById('trialFeedbackStatus');
    if(!field.value.trim()){status.textContent='先写下你的意见，再复制。';field.focus();return;}
    const text='Nelumi 在线试用反馈\n'+field.value.trim();
    try {await navigator.clipboard.writeText(text);status.textContent='已复制，请粘贴到聊天里发给朋友。';}
    catch {field.focus();field.select();status.textContent='浏览器未允许自动复制，请长按选中文字后复制。';}
  };
  for(const id of ['windowModeControl','startOnBootToggle','soundToggle','opacityRange'])document.getElementById(id)?.closest('.settings-section')?.classList.add('web-unsupported');
  // Browser trial cannot perform native OCR or OS reminders.
  document.getElementById('noticeImageButton')?.setAttribute('hidden','');
  document.getElementById('eventReminderOptions')?.closest('.field')?.classList.add('web-unsupported');
})();
