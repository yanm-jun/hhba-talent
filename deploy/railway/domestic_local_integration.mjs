import assert from 'node:assert/strict';
const base='http://127.0.0.1:3555';
async function get(path){
 let last;
 for(let attempt=0;attempt<65;attempt++){
  try{const res=await fetch(base+path,{signal:AbortSignal.timeout(25000)});
   if(!res.ok)throw Error('HTTP '+res.status+' '+path);
   return res.headers.get('content-type')?.includes('json')?res.json():res.text();
  }catch(e){last=e;if(attempt<64)await new Promise(r=>setTimeout(r,1800));}
 }
 throw last;
}
const summary=await get('/api/jobs/page?country=cn&limit=3');
assert.equal(summary.total,1010);
assert.equal(summary.domesticObserved,1010);
assert.ok(summary.jobs.every(x=>x.company==='Xiaomi'&&x.domestic===true&&x.recordKind==='OFFICIAL_LIST_OBSERVED'));
assert.ok(summary.jobs.every(x=>x.currentApplicationVerified===false));
for(const [t,n] of [['SOCIAL',350],['CAMPUS',350],['INTERNSHIP',310]]){
 const rows=await get('/api/jobs/page?country=cn&recruitment_type='+t+'&limit=2');
 assert.equal(rows.total,n,'Wrong Xiaomi '+t+' count');
 assert.ok(rows.jobs.every(x=>x.recruitmentType===t));
}
for(const query of ['小米','小米集团','xiaomi']){
 const data=await get('/api/jobs/page?q='+encodeURIComponent(query)+'&limit=2');
 assert.equal(data.total,1010,'Company alias missing '+query);
}
const id=summary.jobs[0].id;
const detail=await get('/api/jobs/'+encodeURIComponent(id));
assert.equal(detail.job.id,id);
assert.equal(detail.description,null);
assert.equal(detail.applyUrl,null);
assert.equal(detail.currentApplicationVerified,false);
assert.equal(detail.recordKind,'OFFICIAL_LIST_OBSERVED');
assert.ok(detail.officialListUrl.startsWith('https://xiaomi.jobs.f.mioffice.cn/'));
const html=await get('/jobs/'+encodeURIComponent(id));
assert.ok(html.includes('该岗位直达投递')||html.includes('直达投递链接'));
assert.ok(!html.includes('https://xiaomi.jobs.f.mioffice.cn/campus/position/'));
const page=await get('/');
assert.ok(page.includes('id="country"')&&page.includes('id="recruitment"'));
assert.ok(page.includes('历史列表 · 投递未核实'));
const global=await get('/api/jobs/page?country=global&limit=2');
assert.ok(global.boards>=25,'International ATS discovery regressed');
assert.ok(global.jobs.every(x=>!x.domestic));
const openai=await get('/api/jobs/page?q=OpenAI&limit=1');
assert.ok(openai.total>=1&&openai.jobs[0].company==='OpenAI');
console.log('HHBA_DOMESTIC_INTEGRATION_PASS',JSON.stringify({domestic:summary.total,channels:{SOCIAL:350,CAMPUS:350,INTERNSHIP:310},internationalATS:global.boards,globalJobs:global.total,openaiJobs:openai.total,detail:'source-only',filters:'pass'}));
