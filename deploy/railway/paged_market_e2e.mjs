import test from 'node:test';
import assert from 'node:assert/strict';
const BASE='https://hhba-live-jobs-preview-production.up.railway.app';
async function api(path){
 const r=await fetch(BASE+path,{signal:AbortSignal.timeout(50000),headers:{Accept:'application/json'}});
 assert.equal(r.status,200,path+' HTTP '+r.status);
 return r.json();
}
test('paged API loads 30 real jobs instead of 10k',async()=>{
 const original=await api('/api/jobs');
 const first=await api('/api/jobs/page?limit=30&offset=0');
 const second=await api('/api/jobs/page?limit=30&offset=30');
 assert.equal(first.jobs.length,30);
 assert.equal(second.jobs.length,30);
 assert.equal(first.total,original.total);
 assert.equal(first.allJobs,original.total);
 assert.ok(first.companies.length>=34);
 assert.equal(first.boards,original.boards);
 const seen=new Set(first.jobs.map(j=>j.id));
 for(const job of second.jobs)assert.equal(seen.has(job.id),false,'duplicate next page job');
});
test('Chinese search queries official English jobs on server',async()=>{
 for(const query of ['销售','工程师','数据分析']){
  const result=await api('/api/jobs/page?limit=30&q='+encodeURIComponent(query));
  assert.ok(result.total>0,query+' returned zero rows');
  assert.ok(result.jobs.length<=30);
  assert.ok(result.jobs.every(j=>j.id&&j.url&&j.title));
 }
});
test('company and remote filters run across global index',async()=>{
 const company=await api('/api/jobs/page?company='+encodeURIComponent('OpenAI')+'&limit=30');
 assert.ok(company.total>0);
 assert.ok(company.jobs.every(j=>j.company==='OpenAI'));
 const remote=await api('/api/jobs/page?remote=true&limit=30');
 assert.ok(remote.total>0);
 assert.ok(remote.jobs.every(j=>j.remote===true));
});
test('browser is wired to paginated search while legacy full route remains',async()=>{
 const resp=await fetch(BASE,{signal:AbortSignal.timeout(50000)});
 assert.equal(resp.status,200);
 const html=await resp.text();
 assert.match(html,/fetchJobs\(reset=true\)/);
 assert.match(html,/\/api\/jobs\/page/);
 assert.match(html,/searchTimer/);
 assert.match(html,/setLanguage/);
 assert.match(html,/id="toggle-en"/);
});
