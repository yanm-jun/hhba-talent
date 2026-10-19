import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from './server.mjs';

const now = Date.parse('2026-10-19T12:00:00Z');
const raw = {jobs:[
  {id:'ashby-openai-abc',company:'OpenAI',title:'Account Executive',titleZh:'客户经理',titleStatus:'machine',
    location:'San Francisco',locationZh:'旧金山',platform:'ashby',source:'openai',
    url:'https://jobs.ashbyhq.com/openai/abc',remote:false},
  {id:'xiaomi-001',company:'Xiaomi',title:'Sales',platform:'xiaomi-official',source:'xiaomi',domestic:true,
    url:'https://hr.xiaomi.com',remote:false},
],total:2,boards:1,failures:0,updated:'2026-10-19T11:00:00Z'};

test('isolated public HTTP: recent active only, bilingual, detail, alias, sources, 405, expiration',async t=>{
  let clock=now;
  const g=createGateway({source:async()=>raw,now:()=>clock});
  await g.refresh();
  const server=g.createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const prefix='/recruitment/api/v2';
  const health=await fetch(base+prefix+'/health');
  assert.equal(health.status,200);
  const index=await (await fetch(base+prefix+'/jobs?q=%E5%AE%A2%E6%88%B7%E7%BB%8F%E7%90%86')).json();
  assert.equal(index.total,1);
  assert.equal(index.items[0].title.zh_CN,'客户经理');
  assert.ok(index.items[0].job_id.startsWith('J_'));
  assert.equal(index.items[0].availability.state,'RECENTLY_OBSERVED');
  assert.equal(index.items[0].availability.application_confirmed_open,false);
  assert.equal(index.items[0].description.original_status,'NOT_AVAILABLE_FOR_PUBLIC_DISPLAY');
  const id=index.items[0].job_id;
  const detail=await (await fetch(base+prefix+'/jobs/'+id)).json();
  assert.equal(detail.job_id,id);
  const alias=await (await fetch(base+prefix+'/jobs/ashby-openai-abc')).json();
  assert.equal(alias.job_id,id);
  const source=await (await fetch(base+prefix+'/jobs/'+id+'/sources')).json();
  assert.equal(source.source.source_key,'ashby:openai');
  assert.equal((await fetch(base+prefix+'/jobs/JOB-003545')).status,404);
  assert.equal((await fetch(base+prefix+'/jobs',{method:'POST'})).status,405);
  clock+=25*3600_000;
  assert.equal((await fetch(base+prefix+'/jobs')).status,503);
});

test('source failure never serves stale active results',async()=>{
 let broken=false;
 const g=createGateway({source:async()=>{if(broken)throw Error('board unavailable');return raw;},now:()=>now});
 await g.refresh();broken=true;
 await assert.rejects(g.refresh());
 assert.equal(g.status().ok,false);
 assert.equal(g.resolve('ashby-openai-abc'),null);
});
