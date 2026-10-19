import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startOverseasJdWorker} from './jd-sync-worker.mjs';
const job={id:'greenhouse-airtable-100',platform:'greenhouse',company:'Airtable',url:'https://job-boards.greenhouse.io/airtable/jobs/100'};
const feed={rows:[job],boards:1,failures:0};
const logger={log(){},warn(){}};
function setup(opts={}){
 let leased=false,done=0,state='QUEUED',hash=null,budget=opts.budget??10,read=0,failures=[];
 const store={
   catalogSync(rows,{complete}){assert.equal(complete,true);return {discovered:rows.length}},
   cleanup(){return {expired:0}},
   coverage(){return {complete:done===2?1:0}},
   remainingBudget(){return budget},
   reserveBudget(){if(budget<=0)return false;budget--;return true},
   claim(){if(leased||done===2)return null;leased=true;return {id:job.id}},
   sourceVersion(id,h,total){assert.equal(id,job.id);hash=h;return {done,complete:done===total}},
   cachedPart(id,h,p,total){assert.equal(h,hash);return p<done?'之前已经验证的中文段落':null},
   saveVerifiedPart(id,h,p,total,zh){assert.match(zh,/中文/);assert.equal(p,done);done++;state=done===total?'COMPLETE':'TRANSLATING';return {done,total,complete:done===total}},
   release(){leased=false},
   fail(id,reason){leased=false;state='RETRY';failures.push(reason)}
 };
 const worker=startOverseasJdWorker({store,load:async()=>feed,boardsCount:1,
  officialDetail:async()=>{read++;return opts.noDetail?null:{status:'LIVE_CONTENT',description:'Responsibilities\\n\\nMust have programming experience'};},
  jdChunks:()=>['Responsible for software engineering','Qualifications and skills'],
  translateVerifiedChunk:async(j,chunk)=>opts.badTranslation?{text:null,error:'translation_incomplete'}:
    {text:'中文：'+chunk,error:null},dailyChunks:10,logger,
  initialDelayMs:999999,intervalMs:999999});
 return {worker,get:()=>({done,state,budget,read,failures})};
}
test('private worker processes verified parts without ever marking incomplete JD done',async()=>{
 const ctx=setup();
 try{
  const first=await ctx.worker.tick();
  assert.equal(first.status,'STORED_PART');
  assert.equal(ctx.get().done,1);
  const second=await ctx.worker.tick();
  assert.equal(second.status,'COMPLETED_JOB');
  assert.equal(ctx.get().done,2);
  const third=await ctx.worker.tick();
  assert.equal(third.status,'QUEUE_EMPTY');
  assert.equal(ctx.get().budget,8);
 }finally{ctx.worker.stop()}
});
test('failed official detail or failed machine translation does not become COMPLETE',async()=>{
 for(const opts of [{noDetail:true},{badTranslation:true}]){
  const ctx=setup(opts);
  try{
   const result=await ctx.worker.tick();
   assert.ok(['DETAIL_UNAVAILABLE','TRANSLATION_RETRY'].includes(result.status));
   assert.equal(ctx.get().done,0);
   assert.equal(ctx.get().state,'RETRY');
  }finally{ctx.worker.stop()}
 }
});
test('daily budget exhaustion prevents translation without erasing queue',async()=>{
 const ctx=setup({budget:0});
 try{assert.equal((await ctx.worker.tick()).status,'DAILY_BUDGET_EXHAUSTED');assert.equal(ctx.get().read,0)}
 finally{ctx.worker.stop()}
});
test('stopped worker never performs background work',async()=>{
 const ctx=setup();ctx.worker.stop();
 assert.equal((await ctx.worker.tick()).status,'BUSY_OR_STOPPED');
 assert.equal(ctx.get().read,0);
});
