(function exposeNoticeInput(root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./lunar-recurrence') : root.NelumiLunar);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DeskCalNoticeInput = api;
})(typeof window !== 'undefined' ? window : globalThis, function createNoticeInput(Lunar) {
  const pad = (value) => String(value).padStart(2, '0');
  const dateKey = (date) => `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const unique = (values) => [...new Set(values)];

  function calendarDate(year, month, day) {
    const date = new Date(2000, 0, 1, 12);
    date.setFullYear(year, month - 1, day);
    return year >= 1 && year <= 9999 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? dateKey(date) : '';
  }

  function parseDates(text, base, warnings) {
    const dates = [];
    const tokens = [];
    let invalid = false;
    const pattern = /(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)|(?<!\d)(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?(?!\d)|(今天|明天|后天|今晚|明晚|今早)|((?:本|下)(?:周|星期))(?:星期|周)?([一二三四五六日天])/g;
    for (const match of text.matchAll(pattern)) {
      tokens.push(match[0]);
      let date;
      if (match[1] || match[5]) {
        const year = Number(match[1] || match[4] || base.getFullYear());
        date = calendarDate(year, Number(match[2] || match[5]), Number(match[3] || match[6]));
        if (!match[1] && !match[4]) warnings.push(`“${match[0]}”未注明年份，按通知基准日期的 ${year} 年识别，请核对。`);
      } else {
        const value = new Date(base);
        if (match[7]) value.setDate(value.getDate() + ({ 今天: 0, 明天: 1, 后天: 2, 今晚:0, 明晚:1, 今早:0 })[match[7]]);
        else {
          const weekday = '一二三四五六日'.indexOf(match[9] === '天' ? '日' : match[9]);
          value.setDate(value.getDate() - (value.getDay() + 6) % 7 + weekday + (match[8].startsWith('下') ? 7 : 0));
        }
        date = calendarDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
      }
      if (date) dates.push(date);
      else {
        invalid = true;
        warnings.push(`日期“${match[0]}”无效，请修改。`);
      }
    }
    const candidates = unique(dates);
    const abbreviatedDates = /(?:\d{1,2}月\d{1,2}[日号]?|\d{4}[-/]\d{1,2}[-/]\d{1,2})\s*(?:至|到|和|及|与|[-—–~～、，,])\s*(?:\d{1,2}[日号]|\d{1,2}[-/]\d{1,2}(?!\d))/;
    const abbreviatedWeekdays = /(?:本|下)(?:周|星期)(?:星期|周)?[一二三四五六日天]\s*(?:至|到|和|及|与|[-—–~～、，,])\s*(?:(?:本|下)?(?:周|星期))?[一二三四五六日天](?![点时分])/;
    if (abbreviatedDates.test(text) || abbreviatedWeekdays.test(text)) {
      invalid = true;
      warnings.push('发现省略部分日期的区间或多个日期，请明确本次录入日期。');
    }
    if (!tokens.length) warnings.push('未找到明确日期，请填写日期；不会自动安排到今天。');
    if (candidates.length > 1) warnings.push('发现多个日期，请选择本次录入事项的日期。');
    return { date: !invalid && candidates.length === 1 ? candidates[0] : '', dates: candidates, tokens };
  }

  function chineseNumber(value) {
    if (/^\d+$/.test(value)) return Number(value);
    const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (value in digits) return digits[value];
    const match = /^([一二三四五六七八九])?十([一二三四五六七八九])?$/.exec(value);
    return match ? (match[1] ? digits[match[1]] : 1) * 10 + (digits[match[2]] || 0) : NaN;
  }

  function clockValue(token, inheritedPeriod = '') {
    const period = token.period || (token.hour <= 12 ? inheritedPeriod : '');
    let hour = token.hour;
    if (!Number.isFinite(hour) || token.minute > 59 || !Number.isFinite(token.minute) || hour > 23) return { error: '无效时间' };
    if (period) {
      if (hour > 12 && ((period === '下午' && hour < 19) || (period === '晚上' && hour >= 18))) {
        return { value: `${pad(hour)}:${pad(token.minute)}` };
      }
      if (hour > 12 || hour < 1) return { error: '时段与小时不一致' };
      if (period === '晚上' && hour === 12) return { error: '午夜所属日期不明确' };
      if (/下午|晚上/.test(period)) hour = hour % 12 + 12;
      else if (period === '中午') {
        if (![11, 12, 1, 2].includes(hour)) return { error: '中午时段不明确' };
        if (hour < 3) hour += 12;
      } else if (hour === 12) {
        if (period === '凌晨') hour = 0;
        else return { error: '十二点的时段不明确' };
      }
    } else if (!token.colon && hour > 0 && hour <= 12) return { error: '上午或下午不明确' };
    return { value: `${pad(hour)}:${pad(token.minute)}` };
  }

  function parseTimes(text, warnings) {
    const tokens = [];
    const pattern = /(?<![\d一二两三四五六七八九十])(?:(凌晨|早上|上午|中午|下午|晚上)\s*)?(?:(\d{1,2})[:：](\d{2})(?!\d)|([\d零〇一二两三四五六七八九十]{1,3})点(?:(半|一刻|三刻)|([\d零〇一二两三四五六七八九十]{1,3})分?)?)/g;
    for (const match of text.matchAll(pattern)) {
      tokens.push({ raw: match[0].trim(), index: match.index, end: match.index + match[0].length, period: match[1] || '', colon: Boolean(match[2]), hour: chineseNumber(match[2] || match[4]), minute: match[2] ? Number(match[3]) : match[5] ? ({ 半: 30, 一刻: 15, 三刻: 45 })[match[5]] : match[6] ? chineseNumber(match[6]) : 0 });
    }
    const range = tokens.length === 2 && /^\s*(?:至|到|[-—–~～])\s*$/.test(text.slice(tokens[0].end, tokens[1].index));
    const parsed = tokens.map((token, index) => clockValue(token, range && index === 1 ? tokens[0].period : ''));
    const times = unique(parsed.map((time, index) => time.value || tokens[index].raw));
    let startTime = '';
    let endTime = '';
    const invalid = parsed.some((time) => time.error);
    parsed.forEach((time, index) => { if (time.error) warnings.push(`“${tokens[index].raw}”：${time.error}，请明确时间。`); });
    if (!tokens.length) warnings.push(/全天/.test(text) ? '已识别为全天事项，请核对。' : '未找到具体时间，暂作全天草稿，请核对或补充时间。');
    else if (!invalid && tokens.length === 1) {
      startTime = parsed[0].value;
      warnings.push('未注明结束时间，请补充；未自动假定活动时长。');
    } else if (!invalid && range && parsed[1].value > parsed[0].value) {
      startTime = parsed[0].value;
      endTime = parsed[1].value;
    } else if (range && !invalid) warnings.push('结束时间未晚于开始时间，可能跨日，请手动核对。');
    else if (tokens.length > 1) warnings.push('发现多个时间且不能确定唯一时间区间，请选择本次事项的时间。');
    return { startTime, endTime, allDay: !tokens.length, times, tokens: tokens.map((token) => token.raw) };
  }

  const titleLabels = ['主题','标题','活动名称','活动主题','讲座题目','报告题目','会议主题','培训主题','通知标题','赛事名称','事项','任务'];
  const timeLabels = ['时间','日期','活动时间','讲座时间','会议时间','报告时间','截止时间','截稿时间','报名截止时间','提交截止时间'];
  const locationLabels = ['地点','活动地点','讲座地点','会议地点'];
  function noticeFields(text) {
    const labels=[...titleLabels,...timeLabels,...locationLabels,'主讲人','主持人','活动形式','活动内容','参赛方式'];
    const pattern=new RegExp(`^(?:\\d+[.、]\\s*)?(?:【(${labels.join('|')})】|\\[(${labels.join('|')})\\]|(${labels.join('|')})\\s*[:：])\\s*[:：]?\\s*(.*)$`);
    const lines=text.split(/\r?\n/).map(line=>line.trim().replace(/^[^\p{L}\p{N}【\[]+/u,'')).filter(Boolean);
    return lines.flatMap((line,index)=>{
      const match=pattern.exec(line);if(!match) return [];
      const next=lines[index+1];
      const label=match[1]||match[2]||match[3];
      let value=match[4] || (next && !pattern.test(next)?next:'');
      const continuation=lines[index+(match[4]?1:2)];
      if(timeLabels.includes(label) && /(?:至|到|[-—–~～])\s*$/.test(value) && continuation && /^(?:(?:凌晨|早上|上午|中午|下午|晚上)\s*)?[\d一二两三四五六七八九十]/.test(continuation) && !pattern.test(continuation)) value+='\n'+continuation;
      return value?[{label,value}]:[];
    });
  }

  // Analysis copy only: preserve the user's original text, links and credentials in sourceText.
  function withoutLinks(text) {
    return text.replace(/(?:https?:\/\/|www\.)[^\s\p{Script=Han}，。！？；【】（）<>"']+/giu,' ')
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,' ');
  }

  function summarizeTitle(text, fields, dateTokens, timeTokens, location) {
    const stop=new Set('我们 你们 大家 各位 同学 老师 负责人 班级 学院 本次 活动 通知 时间 地点 主题 具体 信息 如下 谢谢 感谢 请 于 的 了 和 与 在 将 为 是 及 本年 进行 有关 工作 可以 已经 即将 开展 内容 开始 填报 填写 提交'.split(' '));
    const segmenter=new Intl.Segmenter('zh-CN',{granularity:'word'});
    const words=value=>Array.from(segmenter.segment(value)).filter(x=>x.isWordLike && x.segment.length>1 && !stop.has(x.segment) && !/^\d+$/.test(x.segment)).map(x=>x.segment.toLowerCase());
    const clean=value=>value.replace(/@(?:全体成员|所有人)/g,' ').replace(/\/[\p{Script=Han}]{1,6}/gu,' ')
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,' ')
      .replace(/^[^\p{L}\p{N}“「《【\[]+/u,'')
      .replace(/^(?:(?:各位|各班)[^：:，,。！!]{0,20}?)?(?:大家)?(?:早上好|上午好|下午好|晚上好|大家好|您好|你好)[：:，,\s]*/,'')
      .replace(/^(?:各位|各班)(?:同学|老师|同事|负责人|班长)(?:们)?[：:，,\s]*/,'').trim();
    const metadata=/^(?:\d+[.、]\s*)?(?:【|\[)?(?:时间|日期|地点|主讲人|主持人|活动时间|活动地点|活动形式|参赛方式|奖项|一等奖|二等奖|三等奖|主题[一二三四])/;
    const auxiliary=/^(?:(?:注意|温馨提示|注)\s*[:：]?\s*)?(?:(?:登录|填报|报名)?(?:地址|网址|链接|入口)|(?:账号|帐号|密码)(?:是|为|就|[:：])|(?:请)?(?:各班负责人|大家|各位同学)?(?:转发|查看|参阅|阅读)(?:通知|操作|填写|使用|附件|指南|说明)|谢谢|感谢|辛苦|详见|逾期)/;
    // Filter boilerplate BEFORE building the keyword graph, not only after scoring it.
    const clauses=text.split(/[\n\r。！？!?；;，,]/).map(clean).filter(s=>s && !metadata.test(s) && !auxiliary.test(s) && !/^(?:注[：:]|为纪念|为了)|考勤|副院长|博士生导师/.test(s));
    const graph=new Map();
    for(const clause of clauses) {
      const tokens=words(clause);
      for(let i=0;i<tokens.length;i++) {
        if(!graph.has(tokens[i])) graph.set(tokens[i],new Set());
        for(let j=i+1;j<Math.min(i+4,tokens.length);j++) if(tokens[i]!==tokens[j]) {
          if(!graph.has(tokens[j])) graph.set(tokens[j],new Set());
          graph.get(tokens[i]).add(tokens[j]);graph.get(tokens[j]).add(tokens[i]);
        }
      }
    }
    // TextRank-style co-occurrence is a tie breaker within task/explicit-title candidates.
    // ponytail: source-grounded phrases, not a semantic model; no invented task objects.
    let ranks=new Map([...graph.keys()].map(word=>[word,1]));
    for(let step=0;step<15;step++) {
      const next=new Map();
      for(const [word,neighbors] of graph) next.set(word,.15+.85*[...neighbors].reduce((sum,n)=>sum+ranks.get(n)/Math.max(1,graph.get(n).size),0));
      ranks=next;
    }
    const candidates=[];
    const add=(value,priority)=>{
      value=value.replace(/^[^\p{L}\p{N}“「《]+/u,'').replace(/[\s：:，,；;—–-]+$/,'').trim();
      if(!value || /^(?:各(?:位|班)|大家好|谢谢|感谢|辛苦)/.test(value)) return;
      const tokens=unique(words(value));
      const score=priority+Math.min(8,tokens.reduce((sum,word)=>sum+(ranks.get(word)||0),0)/Math.sqrt(Math.max(1,tokens.length)));
      candidates.push({value,score});
    };
    for(const field of fields) if(titleLabels.includes(field.label)) add((/讲座|报告/.test(field.label)?field.label.slice(0,2)+'：':'')+field.value,100);
    for(const match of text.matchAll(/[“「《]([^”」》\n]{2,80})[”」》][\s—–-]*([^\n，,。！!]{0,25}?(?:讲座|会议|培训|比赛|大赛|活动|工作坊))/g)) add(match[1]+match[2],70);
    const verbs='填报|填写|提交|报送|缴纳|领取|完成|参加|召开|举办|开展|整理|准备|处理|检查|预约|报名|申请|上传|确认|签署';
    const objectBefore=new RegExp('^(.{2,60}?)(?:可以|可|即将|现已|已经|请|需要|须|需)(?:大家|各位|同学们)?\\s*(?:于|在)?\\s*(?:之前|前)?\\s*(?:开始|进行)?\\s*('+verbs+')(?:啦|了|吧|哦|呀|工作|\\s)*$');
    const actionAfter=new RegExp('('+verbs+')\\s*(?:好)?([^：:]{2,65})');
    const trimObject=value=>value.replace(/(?:并|即将|具体信息|开启啦|开始啦|请带上).*$/,'').replace(/(?:啦|吧|哦|呀|了)\s*$/,'').trim();
    for(let clause of clauses) {
      for(const token of [...dateTokens,...timeTokens]) clause=clause.split(token).join(' ');
      if(location) clause=clause.replace('在'+location,' ');
      clause=clause.replace(/[（(](?:本周|周|星期)[一二三四五六日天][）)]/g,'').replace(/\s+/g,' ').trim();
      const before=objectBefore.exec(clause);
      if(before && !/^(?:请|为|在|于)|可以|需要/.test(before[1])) add(before[2]+trimObject(before[1]),50);
      const action=actionAfter.exec(clause);
      if(action && !/(?:不|无需|不用|不要|不必|取消|已|已经)\s*$/.test(clause.slice(0,action.index))) {
        const object=trimObject(action[2]);
        const nounUse=action[1]==='申请' && /^(?:材料|表|书|条件|流程|指南|资格|人)/.test(object) || action[1]==='报名' && /^(?:表|费|时间|方式|须知|流程)/.test(object);
        if(!nounUse && object.length>=2 && !/^(?:时间|日期|地址|网址|链接|入口|说明|指南|密码|账号)|^(?:完毕|完成|结束)$/.test(object)) add((/召开|举办|开展/.test(action[1])?'':action[1])+object,45);
      }
      const eventPhrase=/([^：:]{2,55}?(?:学术讲座|讲座|评审会议|会议|培训|大赛|比赛|共养活动|活动|工作坊))/.exec(clause);
      if(eventPhrase && !/年前|为纪念|为了|奖项|一等奖/.test(eventPhrase[1])) add(eventPhrase[1].replace(/^(?:本次|此次|拟于|现将)/,''),30);
      if(!/年前|^(?:请|注意|注[：:]|此(?:次|次填报)|密码|登录)|(?:无需|不用|不要|不必|取消|已经)|(?:时间|日期|地址|网址|密码)(?:为|是|如下)|^(?:前|至|到|[-—–~～\s])+$/.test(clause)) add(clause,0);
    }
    candidates.sort((a,b)=>b.score-a.score);
    let title=candidates[0]?.value || '新日程';
    const deadline=fields.find(field=>/截稿|截止/.test(field.label));
    const suffix=deadline && !/截止$/.test(title)?(/截稿/.test(deadline.label)?'投稿截止':'截止'):'';
    const max=40-suffix.length;
    if(title.length>max) title=title.slice(0,max-1)+'…';
    return title+suffix;
  }

  function parseNotice(value, referenceDate = new Date()) {
    const sourceText = String(value ?? '');
    const result = { ok: false, title: '', date: '', startTime: '', endTime: '', allDay: false, location: '', sourceText, warnings: [], dates: [], times: [] };
    if (sourceText.length > 50000) return { ...result, error: '通知原文不能超过 50,000 字符，请分段录入。' };
    if (!sourceText.trim()) return { ...result, error: '请粘贴通知原文。' };
    const base = new Date(referenceDate);
    if (!Number.isFinite(base.getTime())) return { ...result, error: '通知基准日期无效，请重新选择。' };
    base.setHours(12, 0, 0, 0);
    const analysisText=withoutLinks(sourceText);
    const fields=noticeFields(analysisText);
    const timeText=fields.filter(field=>timeLabels.includes(field.label)).map(field=>field.value).join('\n');
    const scopedWarnings=[];
    const scopedDates=timeText?parseDates(timeText,base,scopedWarnings):null;
    const scheduleText=scopedDates?.tokens.length?timeText:analysisText;
    const dates = parseDates(scheduleText, base, result.warnings);
    const scopedTimeWarnings=[];
    const scopedTimes=timeText?parseTimes(timeText,scopedTimeWarnings):null;
    const times=scopedTimes?.tokens.length?scopedTimes:parseTimes(analysisText,result.warnings);
    if(scopedTimes?.tokens.length) result.warnings.push(...scopedTimeWarnings);
    const locationField = /(?:^|[\n\r，,；;。])\s*地点\s*[:：]\s*([^\n\r，,；;。]+)/.exec(analysisText);
    const location = fields.find(field=>locationLabels.includes(field.label))?.value || locationField?.[1].trim() || /在([^\n\r，,；;。！？!?]{1,60}?会议室)/.exec(analysisText)?.[1] || '';
    const title=summarizeTitle(analysisText,fields,dates.tokens,times.tokens,location);
    return { ...result, ok: true, title, scheduleText, date: dates.date, dates: dates.dates, startTime: times.startTime, endTime: times.endTime, allDay: times.allDay, times: times.times, location, warnings: unique(result.warnings) };
  }

  // Direct entry uses explicit local defaults; the detailed parser remains available for diagnostics.
  function parseQuickNotice(value, now = new Date()) {
    const parsed=parseNotice(value,now);
    if(!parsed.ok) return parsed;
    const source=parsed.sourceText, current=new Date(now), warnings=[];
    if(parsed.warnings.some(w=>/无效/.test(w))) return {ok:false,error:'消息中有无效的日期或时间，请修改后再确定。'};
    const range=/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?\s*(?:至|到|[-—–~～])\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})[日号]/.exec(parsed.scheduleText) ||
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*(?:至|到|[-—–~～])\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/.exec(parsed.scheduleText);
    let dates=parsed.dates, rangeTitle='';
    const recurrence={frequency:'none',interval:1,until:null,count:null};
    if(range) {
      const start=calendarDate(Number(range[1]||current.getFullYear()),Number(range[2]),Number(range[3]));
      const end=calendarDate(Number(range[4]||range[1]||current.getFullYear()),Number(range[5]||range[2]),Number(range[6]));
      if(!start || !end || end<start || (new Date(end)-new Date(start))/86400000>366) return {ok:false,error:'日期区间无效或超过一年，请修改消息中的日期。'};
      if(parsed.dates.some(date=>date!==start && date!==end)) return {ok:false,error:'消息同时包含日期区间和其他日期，请分开提交。'};
      dates=[start,end];
      rangeTitle=(parseNotice(withoutLinks(source).replace(range[0],''),now).title || parsed.title).replace(/[\s：:，,；;—–-]+$/,'');
      warnings.push(`仅标记开始 ${start} 和结束 ${end}`);
    } else {
      if(parsed.warnings.some(w=>/无效|区间/.test(w))) return {ok:false,error:'消息中的日期无效或区间不完整，请写清起止日期。'};
      if(!dates.length) {dates=[dateKey(current)];warnings.push('未写日期，已放到今天');}
    }
    let {startTime,endTime,allDay}=parsed;
    if(!allDay && !startTime) return {ok:false,error:'时间不明确，请在消息中写成“15:00”或“下午3点”再确定。'};
    if(startTime && !endTime) {
      const minutes=Number(startTime.slice(0,2))*60+Number(startTime.slice(3));
      const end=Math.min(minutes+60,1439);
      if(end<=minutes) return {ok:false,error:'请补充有效的结束时间。'};
      endTime=`${pad(Math.floor(end/60))}:${pad(end%60)}`;warnings.push('未写结束时间，按最多1小时安排');
    }
    if(dates.length>20) return {ok:false,error:'一次最多标记20个日期，请分段提交。'};
    return {ok:true,items:dates.map((date,index)=>({...parsed,date,
      title:range ? `${rangeTitle.slice(0,98)}${index===0?'开始':'结束'}` : parsed.title,
      startTime,endTime,allDay,recurrence})),summary:warnings.join('；')};
  }

  // Resolve a bounded activity separately from registration. Existing title migrations
  // still use parseNotice/parseQuickNotice, so this cannot rewrite saved schedules.
  function parseActivityDraft(value, now) {
    const sourceText=String(value ?? '');
    if(!/打卡|签到|每天|每日/.test(sourceText) || sourceText.length>50000) return null;
    const text=withoutLinks(sourceText).normalize('NFKC')
      .replace(/(\d)\s+(?=[年月日号])/g,'$1').replace(/([年月])\s+(?=\d)/g,'$1');
    const pattern=/(?<!\d)(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?\s*(?:至|到|[-—–~～])\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})[日号]|(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*(?:至|到|[-—–~～])\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/g;
    const ranges=[...text.matchAll(pattern)];
    if(!ranges.length) return null;
    const current=new Date(now);
    if(!Number.isFinite(current.getTime())) return {ok:false,error:'通知基准日期无效。'};
    if(ranges.length>5) return {ok:false,error:'通知阶段较多，请分段录入并核对日期。'};
    const remaining=text.replace(pattern,'');
    if(parseDates(remaining,current,[]).tokens.length) return {ok:false,error:'除活动区间外还有其他日期，请分段录入，避免遗漏安排。'};
    if(/农历|阴历/.test(text)) return {ok:false,error:'农历活动区间请先换算并核对公历起止日期。'};
    const parsed=parseNotice(remaining,now);
    const fields=noticeFields(remaining);
    const bracket=[...remaining.matchAll(/【([^【】\n]{2,60})】/g)].map(m=>m[1]);
    const named=fields.find(f=>titleLabels.includes(f.label))?.value ||
      bracket.find(s=>/打卡|签到/.test(s) && !/[|｜]/.test(s)) || bracket.find(s=>/打卡|签到/.test(s));
    const title=(named || parsed.title).replace(/^.*[|｜]/,'').replace(/(?:活动)?通知$/,'').trim().slice(0,70);
    const uncertain=/无需|不必|不用|不要|不需要|不要求|任选|任意一天|仅一次|只.{0,6}一次|一次即可|累计|任意.{0,4}天|每周|每星期|隔天|每隔|每[二两三四五六七八九十\d]+天|工作日|周末|待定|不确定|另行通知/.test(remaining);
    const hints=[],items=[];
    for(const m of ranges) {
      const year=Number(m[7]||m[1]||current.getFullYear());
      const start=calendarDate(year,Number(m[8]||m[2]),Number(m[9]||m[3]));
      const end=calendarDate(Number(m[10]||m[4]||year),Number(m[11]||m[5]||m[2]),Number(m[12]||m[6]));
      if(!start || !end || end<start || (new Date(end)-new Date(start))/86400000>366) return {ok:false,error:'活动区间无效、跨年不明确或超过一年，请核对起止日期和年份。'};
      const before=text.slice(0,m.index).split(/[\n。；;]/).filter(s=>s.trim()).at(-1)||'';
      const registration=/报名(?:时间|日期|阶段|期)?\s*[:：]?\s*$/.test(before);
      const activity=/打卡|签到|活动(?:时间|日期)|每天|每日/.test(before);
      if(!registration && !activity && ranges.length>1) return {ok:false,error:'无法确定各日期区间对应哪个阶段，请写明“报名时间”和“打卡活动时间”。'};
      const context=remaining+'\n日期：'+start;
      const extracted=parseStandardNoticeDraft(context,now);
      if(!extracted.ok) return extracted;
      const detail=extracted.items[0];
      const base={...detail,title,date:start,sourceText,location:parsed.location,
        reminders:detail.reminders||[],allDayReminderTime:detail.allDayReminderTime||'09:00',category:detail.category||'work',
        recurrence:{frequency:'none',interval:1,until:null,count:null}};
      if(registration) {
        // The activity clock/reminders do not belong to its registration phase.
        const clocks=parseTimes(text.slice(m.index+m[0].length).split(/[\n。；;]/)[0],[]);
        Object.assign(base,{allDay:clocks.allDay,startTime:clocks.startTime,endTime:clocks.endTime,reminders:[],location:''});
        items.push({...base,title:title+' · 报名开始'});
        if(end!==start) items.push({...base,date:end,title:title+' · 报名截止'});
        hints.push(`报名仅标记${start}和${end}`);
      } else if(uncertain) {
        items.push(base);
        hints.push(`${start}至${end}的打卡频率需核对，未勾选每日重复，请在编辑框确认`);
      } else {
        const days=Math.round((new Date(end)-new Date(start))/86400000)+1;
        items.push({...base,title:title+(/打卡|签到/.test(text)?' · 每日打卡':' · 每日安排'),
          recurrence:{frequency:'daily',interval:1,until:end,count:null}});
        hints.push(`${start}至${end}每天一次，共${days}天（含首尾），请核对`);
      }
      if(extracted.summary) hints.push(extracted.summary);
    }
    if(!items.some(e=>!e.title.endsWith('报名开始')&&!e.title.endsWith('报名截止'))) return null;
    if(!ranges.some(m=>m[1]||m[7])) hints.push(`未写年份，按${current.getFullYear()}年填写`);
    return {ok:true,review:true,items,summary:unique(hints).join('；')};
  }

  function parseNoticeDraft(value, now = new Date()) {
    return parseActivityDraft(value,now) || parseStandardNoticeDraft(value,now);
  }

  // Review-only extraction: keep the established direct-entry/title migration rules unchanged.
  function parseStandardNoticeDraft(value, now = new Date()) {
    const sourceText=String(value ?? '');
    const review=/生日|重复|每(?:隔|个)?(?:[\d一二两三四五六七八九十]+)?(?:年|月|周|星期|天|日|工作日)|提醒/.test(sourceText);
    if(!review) return {...parseQuickNotice(value,now),review:false};
    const hints=[],reminders=[];
    const number='[\\d零〇一二两三四五六七八九十]+';
    const unit='分钟|小时|天|周|星期';
    const duration=`${number}\\s*(?:${unit})`;
    const offsets=new RegExp(`提前\\s*(${duration}(?:\\s*(?:、|和|及|与|，|,)\\s*${duration})*)`,'g');
    const disabled=/不(?:要|用|必|需)?(?:再)?提醒|无需提醒|关闭提醒/.test(sourceText);
    if(!disabled) {
      for(const match of sourceText.matchAll(offsets)) {
        const before=sourceText.slice(0,match.index).split(/[，,。；;\n]/).at(-1);
        const clause=sourceText.slice(match.index).split(/[。；;\n]/)[0];
        if(/(?:不|不要|不用|无需|取消)\s*$/.test(before) || !/提醒/.test(clause) || /或|也许|可能|待定|不确定/.test(clause)) continue;
        for(const part of match[1].matchAll(new RegExp(`(${number})\\s*(${unit})`,'g'))) {
          const minutes=chineseNumber(part[1])*({分钟:1,小时:60,天:1440,周:10080,星期:10080})[part[2]];
          if(Number.isInteger(minutes) && minutes>=0 && minutes<=10080) reminders.push(minutes);
          else hints.push('提醒目前最多支持提前一周（7天），超出或不明确的提醒未勾选');
        }
      }
      if(/(?:准时|当天|当日)(?:提醒)/.test(sourceText)) reminders.push(0);
    }
    if(/提醒/.test(sourceText) && !disabled && !reminders.length) hints.push('提醒提前量未明确识别，请自行勾选');

    // Remove reminder clock instructions before extracting the event clock.
    const reminderClock=/(?:提醒时间|提醒时刻)\s*[:：]\s*([^\n，,。；;]+)/.exec(sourceText);
    const inlineClock=/(?:的|在)?\s*((?:凌晨|早上|上午|中午|下午|晚上)?\s*(?:\d{1,2}[:：]\d{2}|[\d一二两三四五六七八九十]+点(?:半|[\d一二三四五六七八九十]+分?)?))\s*提醒/.exec(sourceText);
    const clockInstruction=reminderClock || inlineClock;
    let scheduleSource=clockInstruction?sourceText.replace(clockInstruction[0],''):sourceText;
    scheduleSource=scheduleSource.replace(/每(?:周|星期)([一二三四五六日天])/g,'本周$1');
    scheduleSource=scheduleSource.replace(/([一二三四五六七八九十]{1,3})月([一二三四五六七八九十]{1,3})[日号]/g,
      (_,month,day)=>`${chineseNumber(month)}月${chineseNumber(day)}日`);
    const parsed=parseNotice(scheduleSource,now);
    if(!parsed.ok) return parsed;
    const quick=parseQuickNotice(scheduleSource,now);
    const lunar=/农历|阴历|闰月|闰[一二三四五六七八九十\d]+月/.test(sourceText);
    const explicitNone=/不重复|(?:不|不要|无需)每年|仅(?:此|这)一次|只(?:过|办|安排)?一次/.test(sourceText);
    const frequencyMatches=[...sourceText.matchAll(/每(?:隔|个)?([\d一二两三四五六七八九十]+)?(工作日|年|月|星期|周|天|日)/g)];
    const frequencies=unique(frequencyMatches.map(m=>({年:'yearly',月:'monthly',周:'weekly',星期:'weekly',天:'daily',日:'daily',工作日:'weekdays'})[m[2]]));
    let frequency=!explicitNone && frequencies.length===1?frequencies[0]:'none';
    let interval=frequencyMatches[0]?.[1]?chineseNumber(frequencyMatches[0][1]):1;
    if(!Number.isInteger(interval) || interval<1 || interval>365 || frequencies.length>1 || unique(frequencyMatches.map(m=>m[1]?chineseNumber(m[1]):1)).length>1) {frequency='none';interval=1;hints.push('重复规则不明确，请自行选择');}
    if(/重复.*(?:次|截止)|(?:直到|截至|截止到|持续到)/.test(sourceText)) {frequency='none';hints.push('重复结束条件需要核对，请自行填写重复规则');}
    let date=parsed.date;
    if(!lunar && !parsed.dates.length && !parsed.warnings.some(w=>/无效|区间/.test(w))) {date=dateKey(new Date(now));hints.push('未写日期，暂填今天，请核对');}
    let lunarDate,lunarYear;
    if(lunar) {
      const tokens=[...sourceText.matchAll(/(闰)?([\d一二三四五六七八九十正冬腊]{1,3})月\s*([\d一二三四五六七八九十初廿卅]{1,3})[日号]?/g)];
      const trailing=tokens.length===1?sourceText.slice(tokens[0].index+tokens[0][0].length):'';
      if(tokens.length===1 && !/公历|阳历|或|待定|不确定|闰月/.test(sourceText) && !/^\s*(?:至|到|[-—–~～])\s*[\d初廿卅一二三四五六七八九十]/.test(trailing)) {
        const m=tokens[0];
        const month=({正:1,冬:11,腊:12})[m[2]] || chineseNumber(m[2]);
        const day=chineseNumber(m[3].replace(/^初/,'').replace(/^廿/,'二十').replace(/^卅/,'三十'));
        lunarDate=Lunar.normalize({month,day,leap:!!m[1]});
        const year=/(\d{4})年/.exec(sourceText);
        lunarYear=year?Number(year[1]):now.getFullYear();
        date=Lunar.toSolar(lunarYear,lunarDate)||'';
        if(lunarDate) scheduleSource=scheduleSource.replace(m[0],'');
      } else date='';
      if(!date) hints.push('农历日期不明确或所选年没有这一天，请核对农历年月日；不会自动改到其他日期');
      else hints.push(`${Lunar.label(lunarDate)}对应公历${date}，每年按农历日期安排`);
      if(!['none','yearly'].includes(frequency)){frequency='none';hints.push('农历目前支持不重复或每年重复，请核对');}
    }
    else if(!date) hints.push('日期无效或有多个候选，请选择本次事项日期');
    if(parsed.times.length && !parsed.startTime) hints.push('开始时间不明确，请填写');
    if(parsed.startTime && !parsed.endTime) hints.push('结束时间未填写，请补充');
    if(!/公历|阳历|农历|阴历/.test(sourceText) && /生日/.test(sourceText)) hints.push('日期暂按公历，请核对生日历法');
    if(frequency==='yearly' && /-02-29$/.test(date)) hints.push('2月29日按现有规则仅在闰年出现；平年安排请另行设置');
    let allDayReminderTime='09:00';
    if(clockInstruction) {
      const clock=parseTimes(clockInstruction[1],[]);
      allDayReminderTime=clock.startTime || '';
      if(!allDayReminderTime) hints.push('全天提醒时刻不明确，请填写');
    } else if(parsed.allDay && reminders.length) hints.push('未写提醒时刻，全天提醒暂用09:00，可修改');
    let location=parsed.location.split(/[，,。；;]/)[0].trim();
    if(/待定|不确定|另行通知/.test(location)) location='';
    if(!location) {
      const place=/(?:在|地点[：:])\s*([^\n，,。；;！？!?]{1,60}?)(?=庆祝|庆生|过生日|举办生日|聚餐)/.exec(sourceText);
      location=place?.[1].trim() || '';
    }
    const birthday=/生日/.test(sourceText);
    let title=parsed.title;
    if(birthday && !noticeFields(sourceText).some(f=>titleLabels.includes(f.label))) {
      const head=scheduleSource.split('生日')[0].split(/[\n，,。；;：:]/).at(-1)
        .replace(/(?:(?:\d{4})年)?\d{1,2}月\d{1,2}[日号]?|\d{4}[-/]\d{1,2}[-/]\d{1,2}/g,' ')
        .replace(/每年|公历|阳历|农历|阴历|上午|下午|晚上|\d{1,2}[:：]\d{2}|(?:记住|记一下|记得|帮我记录|帮我记住|请帮我记住)/g,' ').trim();
      const name=/([\p{L}]{1,12}?)(?:的)?(?:过)?$/u.exec(head.replace(/^(?:给|为)/,''));
      if(name && !/提前|地点|每|农历|月|初/.test(name[1])) title=name[1].replace(/的$/,'')+'生日';
    }
    const recurrence={frequency,interval,until:null,count:null};
    const base={...parsed,title,date,sourceText,location,recurrence,reminders:unique(reminders).sort((a,b)=>a-b),allDayReminderTime,category:birthday?'life':'work',...(lunar?{dateCalendar:'lunar',lunarDate,lunarYear}: {})};
    const endpoints=quick.ok && quick.items.length===2 && /开始$/.test(quick.items[0].title) && /结束$/.test(quick.items[1].title);
    const items=endpoints && !lunar ? quick.items.map(item=>({...base,title:item.title,date:item.date,recurrence:{frequency:'none',interval:1,until:null,count:null}})) : [base];
    return {ok:true,review:true,items,summary:unique(hints).join('；')};
  }

  // Frozen pre-keyword title rule, used only to identify legacy automatically named events.
  function legacyTitle(sourceText, base, endpoint='') {
    if(endpoint) {
      const range=/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?\s*(?:至|到|[-—–~～])\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})[日号]/.exec(sourceText) || /(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*(?:至|到|[-—–~～])\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/.exec(sourceText);
      if(!range) return null;
      return legacyTitle(sourceText.replace(range[0],''),base).replace(/[\s：:，,；;—–-]+$/,'').slice(0,98)+endpoint;
    }
    const dates=parseDates(sourceText,base,[]),times=parseTimes(sourceText,[]);
    const locationField=/(?:^|[\n\r，,；;。])\s*地点\s*[:：]\s*([^\n\r，,；;。]+)/.exec(sourceText);
    const location=locationField?.[1].trim() || /在([^\n\r，,；;。！？!?]{1,60}?会议室)/.exec(sourceText)?.[1] || '';
    const titleField=/(?:^|[\n\r，,；;。])\s*(?:主题|标题)\s*[:：]\s*([^\n\r，,；;。]+)/.exec(sourceText);
    let title=titleField?.[1].trim();
    if(!title) {
      const quoted=/[“「《]([^”」》\n]{2,60})[”」》]([^\n，,。！!]{0,20}?(?:活动|会议|讲座|培训|比赛))/.exec(sourceText);
      const lines=sourceText.split(/[\n\r。！？!?]/).map(line=>line.trim().replace(/^(?:大家好|您好|你好)[！!，,：:\s]*/,''));
      title=quoted?`${quoted[1]}${quoted[2]}`:lines.find(line=>line && !/^(?:时间|日期|地点|活动内容)\s*[:：]/.test(line) && !/^各位[^，,。]{0,25}[：:]?$/.test(line)) || '';
      for(const token of [...dates.tokens,...times.tokens]) title=title.replace(token,' ');
      if(location) title=title.replace(`在${location}`,' ');
      title=title.replace(/^\s*(?:通知|各位同事|各位老师)\s*[:：，,]?/,'').replace(/\s+/g,' ').trim();
    }
    return (title||'新日程').slice(0,100);
  }
  return { parseNotice, parseQuickNotice, parseNoticeDraft, legacyTitle, TITLE_VERSION: 2 };
});
