const {createHash}=require('node:crypto');
const Notice=require('./notice-input');
const hash=text=>createHash('sha256').update(text).digest('hex');

function normalizeAutomation(value,title,sourceText) {
  if(!value || typeof value!=='object' || !Number.isInteger(value.version) || value.version<0 || typeof value.lastTitle!=='string') return undefined;
  return {version:value.version,lastTitle:value.lastTitle.slice(0,100),originalTitle:String(value.originalTitle||value.lastTitle).slice(0,100),
    previousTitle:String(value.previousTitle||value.originalTitle||value.lastTitle).slice(0,100),
    sourceHash:typeof value.sourceHash==='string'?value.sourceHash:hash(sourceText),manual:value.manual===true || title!==value.lastTitle};
}

function upgradeTitles(events) {
  return events.map(event=>{
    if(!event.sourceText || event.deletedAt) return event;
    const meta=event.titleAutomation;
    if(meta && (meta.version>=Notice.TITLE_VERSION || meta.manual || meta.lastTitle!==event.title || meta.sourceHash!==hash(event.sourceText))) return event;
    const base=new Date(event.createdAt || event.date+'T12:00:00');
    const parsed=Notice.parseNotice(event.sourceText,base);
    if(!parsed.ok || parsed.title==='新日程') return event;
    const quick=Notice.parseQuickNotice(event.sourceText,base);
    const title=quick.ok?(quick.items.find(item=>item.date===event.date)?.title || (quick.items.length===1?quick.items[0].title:null)):parsed.title;
    if(!title) return event;
    // Legacy ownership is unknown: adopt only a reproducible old/current generated title.
    const matched=quick.ok && quick.items.length===2 && quick.items.find(item=>item.date===event.date);
    const endpoint=matched && /开始$/.test(quick.items[0].title) && /结束$/.test(quick.items[1].title)?matched.title.slice(-2):'';
    const oldEndpoint=endpoint?Notice.legacyTitle(event.sourceText,base,endpoint):null;
    if(!meta && event.title!==Notice.legacyTitle(event.sourceText,base) && event.title!==oldEndpoint && event.title!==title) return event;
    return {...event,title,titleAutomation:{version:Notice.TITLE_VERSION,lastTitle:title,originalTitle:meta?.originalTitle||event.title,previousTitle:meta?.lastTitle||event.title,sourceHash:hash(event.sourceText),manual:false}};
  });
}
function preserveOwnership(previous,event) {
  if(previous?.titleAutomation) return {...previous.titleAutomation,manual:previous.titleAutomation.manual || previous.title!==event.title};
  if(previous?.sourceText && previous.title!==event.title) return normalizeAutomation({version:Notice.TITLE_VERSION,lastTitle:event.title,originalTitle:previous.title,manual:true},event.title,event.sourceText);
  return event.titleAutomation;
}
module.exports={normalizeAutomation,upgradeTitles,preserveOwnership};
