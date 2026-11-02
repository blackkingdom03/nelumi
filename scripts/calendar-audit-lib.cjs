const assert=require('node:assert/strict');
const digits=['一','二','三','四','五','六','七','八','九','十'];
const dayNames=['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const monthNames=['正','二','三','四','五','六','七','八','九','十','十一','十二'];
const simplify=s=>s.replaceAll('驚','惊').replaceAll('蟄','蛰').replaceAll('穀','谷').replaceAll('處','处').replaceAll('滿','满').replaceAll('種','种');
const iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
function parseHkoYear(text,year,previousLast=null){
 const raw=[];
 for(const line of text.split(/\r?\n/)){
  if(!/^\d{4}年/.test(line))continue;
  const match=line.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\S+)\s+星期([日一二三四五六])(?:\s+(\S+))?\s*$/);
  assert.ok(match,`unrecognized row: ${line}`);
  const [,y,m,d,label,weekday,term='']=match;assert.equal(Number(y),year);
  let month=null;if(label.endsWith('月')){const name=label.replace(/^閏/,'').slice(0,-1);month=name==='一'?1:monthNames.indexOf(name)+1;assert.ok(month>0,`unknown month: ${label}`);if(label.startsWith('閏'))month=-month;}
  const lunarDay=month!==null?1:dayNames.indexOf(label)+1;assert.ok(lunarDay>0,`unknown lunar day ${label}`);
  raw.push({date:iso(year,Number(m),Number(d)),month,lunarDay,weekday:'日一二三四五六'.indexOf(weekday),solarTerm:simplify(term)});
 }
 const count=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;assert.equal(raw.length,count,`${year} row count`);
 const firstMonth=raw.find(r=>r.month!==null);assert.ok(firstMonth);
 let month=raw[0].month??(previousLast ? previousLast.lunarMonth*(previousLast.isLeapMonth?-1:1) : (firstMonth.month<0?-firstMonth.month:(firstMonth.month===1?12:firstMonth.month-1)));
 if(previousLast && raw[0].month===null)assert.equal(raw[0].lunarDay,previousLast.lunarDay+1,`${year} cross-year lunar continuity`);
 const result=raw.map((r,i)=>{
  const date=new Date(Date.UTC(year,0,1+i));assert.equal(r.date,date.toISOString().slice(0,10),`${year} sequence`);assert.equal(r.weekday,date.getUTCDay(),`${r.date} weekday`);
  if(r.month!==null)month=r.month;
  return {date:r.date,lunarMonth:Math.abs(month),lunarDay:r.lunarDay,isLeapMonth:month<0,lunarYear:date.getUTCMonth()<2&&Math.abs(month)>=11?year-1:year,weekday:r.weekday,solarTerm:r.solarTerm};
 });
 assert.equal(result.filter(r=>r.solarTerm).length,24,`${year} solar terms`);
 for(let i=1;i<result.length;i++){const prev=result[i-1],curr=result[i];assert.ok(curr.lunarDay===prev.lunarDay+1||(curr.lunarDay===1&&[29,30].includes(prev.lunarDay)),`${curr.date} lunar continuity`);}
 return result;
}
module.exports={parseHkoYear,dayNames,monthNames};
