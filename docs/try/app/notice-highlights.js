(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./notice-links'));else root.NelumiNoticeHighlights=factory(root.NelumiNoticeLinks);})(typeof globalThis!=='undefined'?globalThis:this,Links=>{
  // Display candidates only: highlighting never rewrites or validates the original notice.
  function parts(value,location='') {
    const text=String(value??''),spans=[];let offset=0;
    for(const part of Links.parts(text)){if(part.href)spans.push({start:offset,end:offset+part.text.length,href:part.href});offset+=part.text.length;}
    function add(start,end,kind){if(end>start&&!spans.some(s=>start<s.end&&end>s.start))spans.push({start,end,kind});}
    function scan(regex,kind,group=0){for(const m of text.matchAll(regex)){const word=m[group];if(!word)continue;const start=m.index+(group?m[0].lastIndexOf(word):0);add(start,start+word.length,kind);}}
    if(location&&location.trim()){let at=0;while((at=text.indexOf(location,at))>=0){add(at,at+location.length,'place');at+=location.length;}}
    scan(/(?:【(?:活动|讲座|会议|集合|上课|举办)?(?:地点|地址)】|\[(?:活动|讲座|会议|集合|上课|举办)?(?:地点|地址)\]|(?:活动|讲座|会议|集合|上课|举办)?(?:地点|地址)\s*[:：])\s*[:：]?\s*([^\r\n，,；;。！？!?]{1,100}?)(?=\s*(?:【|\[|(?:时间|日期|主题|联系人|备注)\s*[:：])|[\r\n，,；;。！？!?]|$)/gu,'place',1);
    scan(/在\s*([^\r\n，,；;。！？!?]{1,60}?(?:会议室|报告厅|礼堂|教室|体育馆|图书馆|咖啡厅|餐厅|酒店|办公室))(?=\s|[，,。；;！!？?]|(?:开会|参加|召开|举办|举行|集合|见面|聚餐)|$)/gu,'place',1);
    scan(/(?:(?:农历|阴历|阳历|公历)\s*)?(?:(?:\d{4}|[二〇零一三四五六七八九]{4})\s*年\s*)?(?:闰\s*)?(?:\d{1,2}|[正冬腊一二三四五六七八九十]{1,3})\s*月\s*(?:\d{1,2}(?:\s*(?:日|号))?|初[一二三四五六七八九十]|廿[一二三四五六七八九]|[一二三四五六七八九十]{1,3}(?:日|号)?)/gu,'date');
    scan(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}\/\d{1,2}\b|(?:今天|明天|后天|大后天)|(?:(?:本|这|下|上)(?:周|星期)|周|星期)[一二三四五六日天]|(?:至|到|[-—–~～])\s*(\d{1,2}(?:日|号))/gu,'date');
    scan(/(?:(?:凌晨|早上|早晨|上午|中午|下午|晚上|晚间)\s*)?(?:[01]?\d|2[0-3])[:：][0-5]\d(?:[:：][0-5]\d)?(?!\d)|(?:(?:凌晨|早上|早晨|上午|中午|下午|晚上|晚间)\s*)?(?:\d{1,2}|[零一二两三四五六七八九十]{1,3})(?:点|时)(?:\s*(?:半|一刻|三刻|(?:\d{1,2}|[零一二两三四五六七八九十]{1,3})分?))?/gu,'time');
    spans.sort((a,b)=>a.start-b.start);const result=[];offset=0;
    for(const span of spans){if(span.start>offset)result.push({text:text.slice(offset,span.start)});result.push({text:text.slice(span.start,span.end),...(span.href?{href:span.href}:{kind:span.kind})});offset=span.end;}
    if(offset<text.length||!result.length)result.push({text:text.slice(offset)});return result;
  }
  return {parts};
});
