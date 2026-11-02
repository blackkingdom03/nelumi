const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHolidayStore}=require('../src/holiday-store');
const C=require('../src/chinese-calendar');
const fixture={year:2026,papers:[C.HOLIDAY_SOURCE_2026],days:Object.values(C.getHolidaySchedule(2026).days).map(d=>({date:d.date,name:d.name,isOffDay:d.type==='holiday'}))};
const folder=path.join(__dirname,'..','.test-profile-holidays-'+Date.now());fs.mkdirSync(folder);
test('downloaded and previously cached future candidates cannot self-certify',async()=>{
 const data={year:2027,papers:['https://www.gov.cn/zhengce/example.htm'],verified:true,days:[{date:'2027-01-01',name:'元旦',isOffDay:true}]};
 const file=path.join(folder,'candidate.json');
 fs.writeFileSync(file,JSON.stringify({2027:{status:'available',checkedAt:Date.now(),data}}));
 const store=createHolidayStore(file,async()=>new Response(JSON.stringify(data)));
 assert.equal(store.entries().length,0);assert.equal((await store.get(2027)).status,'pending-review');
 assert.equal((await store.get(2027,true)).status,'pending-review');assert.equal(store.entries().length,0);
});
test('cache survives reload, empty/error replies preserve prior dates, and requests coalesce',async()=>{
 let calls=0,mode='ok';const request=async()=>{calls++;if(mode==='fail')throw Error('offline');return new Response(JSON.stringify(mode==='empty'?{year:2026,papers:[],days:[]}:fixture));};
 const file=path.join(folder,'cache.json'),store=createHolidayStore(file,request);
 const [a,b]=await Promise.all([store.get(2026),store.get(2026)]);assert.equal(calls,1);assert.equal(a.status,'available');assert.deepEqual(a,b);
 assert.equal((await store.get(2026)).status,'available');assert.equal(calls,1);
 const reopened=createHolidayStore(file,request);assert.equal(reopened.entries()[0].year,2026);
 mode='empty';assert.ok((await store.get(2026,true)).data);mode='fail';const failed=await store.get(2026,true);assert.equal(failed.status,'error');assert.ok(failed.data);
 assert.deepEqual(createHolidayStore(file,request).entries()[0],fixture);
 await assert.rejects(()=>store.get('../2026'));assert.equal(calls,3);
 mode='empty';await store.get(2026,true);
 // Persisting another year after an offline check must retain the old year's data.
 const mixed=createHolidayStore(file,async url=>url.includes('2026')?Promise.reject(Error('offline')):new Response(JSON.stringify({year:2028,papers:[],days:[]})));
 await mixed.get(2026,true);await mixed.get(2028,true);
 assert.deepEqual(createHolidayStore(file,request).entries()[0],fixture);
});
test('unpublished years remain unknown, malformed and oversized replies are rejected',async()=>{
 const f=path.join(folder,'empty.json');let response=()=>new Response(JSON.stringify({year:2028,papers:[],days:[]}));
 const store=createHolidayStore(f,async()=>response());assert.equal((await store.get(2028)).status,'unpublished');assert.equal(store.entries().length,0);
 response=()=>new Response(JSON.stringify({...fixture,year:2028}));assert.equal((await store.get(2028,true)).status,'error');
 response=()=>new Response('x'.repeat(260000));assert.equal((await store.get(2028,true)).status,'error');assert.equal(store.entries().length,0);
});
