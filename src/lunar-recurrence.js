(function(root,factory){
  const api=factory(typeof module!=='undefined' && module.exports ? require('./authority-calendar-data') : root.NelumiAuthorityCalendar);
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  if(root) root.NelumiLunar=api;
})(typeof window!=='undefined'?window:globalThis,function(authority){
  // Month starts come from the independently checked HKO tables, not an estimated 354-day year.
  const starts=[];
  for(const [year,table] of Object.entries(authority.years)) {
    for(const [md,month] of table.months) {
      const [m,d]=md.split('-').map(Number);
      starts.push({key:`${year}-${md}`,stamp:Date.UTC(+year,m-1,d),year:m<=2 && Math.abs(month)>=11?+year-1:+year,month});
    }
  }
  starts.sort((a,b)=>a.stamp-b.stamp);
  const months=new Map();
  starts.forEach((s,i)=>{s.end=starts[i+1]?.stamp ?? Date.UTC(2101,0,1);months.set(`${s.year}/${s.month}`,s);});
  function normalize(value){
    if(!value || typeof value!=='object') return null;
    const {month,day}=value;
    if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(day)||day<1||day>30) return null;
    return {month,day,leap:value.leap===true};
  }
  function toSolar(year,value){
    const rule=normalize(value);
    if(!rule||!Number.isInteger(year)||year<1901||year>2099) return null;
    const start=months.get(`${year}/${rule.leap?-rule.month:rule.month}`);
    if(!start) return null;
    const stamp=start.stamp+(rule.day-1)*86400000;
    return stamp<start.end?new Date(stamp).toISOString().slice(0,10):null;
  }
  function fromSolar(key){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const stamp=Date.parse(key+'T00:00:00Z');
    if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==key) return null;
    let lo=0,hi=starts.length-1,found=null;
    while(lo<=hi){const mid=(lo+hi)>>1;if(starts[mid].stamp<=stamp){found=starts[mid];lo=mid+1;}else hi=mid-1;}
    if(!found||stamp>=found.end||found.year<1901||found.year>2099) return null;
    return {year:found.year,month:Math.abs(found.month),day:1+(stamp-found.stamp)/86400000,leap:found.month<0};
  }
  const monthNames=['正','二','三','四','五','六','七','八','九','十','冬','腊'];
  const dayNames=['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  function label(value){const r=normalize(value);return r?`农历${r.leap?'闰':''}${monthNames[r.month-1]}月${dayNames[r.day-1]}`:'';}
  function ordinal(event,key,interval){
    const start=fromSolar(event.date),target=fromSolar(key),rule=normalize(event.lunarDate);
    if(!start||!target||!rule||target.year<start.year||(target.year-start.year)%interval ||toSolar(target.year,rule)!==key) return 0;
    let count=0;
    for(let year=start.year;year<=target.year;year+=interval){const date=toSolar(year,rule);if(date && date>=event.date) count++;}
    return count;
  }
  return {normalize,toSolar,fromSolar,label,ordinal,monthNames,dayNames};
});
