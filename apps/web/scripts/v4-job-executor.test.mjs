import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {candidateRevision} from '../functions/_lib/v4-research-pipeline.js';
import {reconcileV4JobWork,claimV4JobWork,finishV4JobWork} from '../functions/_lib/v4-job-work-queue.js';
import {independentJobKey,v4JobExecutorEnabled,mergeIndependentV4Jobs,runIndependentV4Job,v4IndependentJobTransport} from '../functions/_lib/v4-job-executor.js';
const schema=readFileSync(new URL('../d1/20261126_v4_job_work_queue.sql',import.meta.url),'utf8');
const taskKey='b'.repeat(64),url='https://careers.real.test/job/22';
const candidate=()=>({company:'真实雇主',title:'区域督导',location:'上海',requirements:'销售运营经验',employer_proof_url:url});
const scored=()=>({research_candidate_url:url,official_url:url,company:'真实雇主',title:'区域督导',location:'上海',curated_suitable:true,source_type:'站外官方招聘',match_score:86,jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',evidence_excerpt:'销售运营经验'});
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);
 const db={prepare(sql){return {bind(...args){return {async all(){return {results:sqlite.prepare(sql).all(...args)}},async first(){return sqlite.prepare(sql).get(...args)},async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}}}}},async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
 const env={HHBA_V4_JOB_EXECUTOR_ENABLED:'1',HHBA_V4_JOB_QUEUE_ENABLED:'1',HHBA_PNVS_AUTH_DB:db};
 return {db,env};
}
test('executor is strictly gated by both queue and active worker deployment flags',async()=>{
 assert.equal(v4JobExecutorEnabled({}),false);
 assert.equal(v4JobExecutorEnabled({HHBA_V4_JOB_EXECUTOR_ENABLED:'1'}),false);
 assert.equal(v4JobExecutorEnabled(fixture().env),true);
 assert.deepEqual(await runIndependentV4Job({},'opaque','verification'),{status:'DISABLED'});
});
test('completed verification merges from encrypted job result exactly once',async()=>{
 const {db,env}=fixture(),cp={phase:'verification',rows:[[url,candidate()]],matches:[],processedEarlier:[],processedEvidence:[],read:0,scored:0};
 await reconcileV4JobWork(db,taskKey,0,cp);
 const claim=await claimV4JobWork(db,taskKey,0,'verification',{owner:'one'});assert.ok(claim);
 assert.equal(await finishV4JobWork(db,claim),true);
 const resultKey=await independentJobKey(taskKey,0,'verification',claim.job_key,claim.revision);
 let reads=0;
 const read=async(_env,id)=>{reads++;assert.equal(id,resultKey);return {kind:'V4_INDEPENDENT_JOB_V1',complete:true,generation:0,lane:'verification',job_key:claim.job_key,revision:claim.revision,source_url:url,job:scored(),checkpoint:{read:1,scored:1,archived:1}};};
 const first=await mergeIndependentV4Jobs(env,taskKey,0,cp,{read});
 assert.equal(first.count,1);assert.equal(first.checkpoint.matches.length,1);
 assert.equal(first.checkpoint.matches[0].match_score,86);
 assert.deepEqual(first.checkpoint.processedEarlier,[url]);
 assert.deepEqual(first.checkpoint.processedEvidence,[[url,candidateRevision(candidate())]]);
 assert.equal(first.checkpoint.scored,1);
 const second=await mergeIndependentV4Jobs(env,taskKey,0,first.checkpoint,{read});
 assert.equal(second.count,0);assert.equal(second.checkpoint.scored,1);assert.equal(reads,1);
 assert.equal(second.checkpoint,first.checkpoint,'no new independent results must not clone a 500-job checkpoint');
 const changed={...cp,rows:[[url,{...candidate(),requirements:'要求已变更'}]]};
 const invalidated=await mergeIndependentV4Jobs(env,taskKey,0,changed,{read});
 assert.equal(invalidated.count,0);assert.equal(reads,1,'stale revision never causes a result fetch');
});
test('independent report result can replace only the selected ranked job',async()=>{
 const {db,env}=fixture(),cp={phase:'reporting',rows:[[url,candidate()]],matches:[scored()],globalRankState:{done:true},globalOrder:[url]};
 await reconcileV4JobWork(db,taskKey,1,cp);
 const claim=await claimV4JobWork(db,taskKey,1,'reporting',{owner:'reporter'});assert.ok(claim);
 assert.equal(await finishV4JobWork(db,claim),true);
 const read=async()=>({kind:'V4_INDEPENDENT_JOB_V1',complete:true,generation:1,lane:'reporting',job_key:claim.job_key,revision:claim.revision,source_url:url,job:{...scored(),report_status:'UNAVAILABLE',report_retry_reason:'VALIDATED_EVIDENCE_MISSING'}});
 const records=await db.prepare("SELECT lane,job_key,revision,state FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=?").bind(taskKey,1).all();
 assert.equal(records.results.filter(r=>r.lane==='reporting'&&r.state==='COMPLETED').length,1);
 const result=await mergeIndependentV4Jobs(env,taskKey,1,cp,{read});
 assert.equal(result.count,1,JSON.stringify({records:records.results,original:cp.matches,merged:result.checkpoint.matches}));assert.equal(result.checkpoint.matches[0].report_status,'UNAVAILABLE');
 assert.equal((await mergeIndependentV4Jobs(env,taskKey,1,result.checkpoint,{read})).count,0);
});

test('independent JD preserves a transport-specific SSE failure across a durable per-job continuation',async()=>{
 const sseError={code:'AI_PROVIDER_UPSTREAM_ERROR',upstreamKind:'SSE_FAILED'};
 assert.equal(v4IndependentJobTransport(null,null,true),'configured');
 assert.equal(v4IndependentJobTransport(null,sseError,true),'json','SSE failure must switch next step to JSON');
 assert.equal(v4IndependentJobTransport({transport_mode:'json'},null,true),'json','retries must not re-enter broken SSE path');
 assert.equal(v4IndependentJobTransport(null,sseError,false),'configured','do not switch an already JSON-only provider');
 assert.equal(v4IndependentJobTransport(null,{code:'AI_PROVIDER_UPSTREAM_ERROR',upstreamKind:'HTTP_503'},true),'configured','a 503 must not be mistaken for SSE transport rejection');
 assert.equal(v4IndependentJobTransport(null,{code:'AI_PROVIDER_NETWORK_ERROR'},true),'configured');
 assert.equal(v4IndependentJobTransport(null,{code:'AI_PROVIDER_NETWORK_ERROR'},true,1),'configured','one network failure is not proof of broken SSE');
 assert.equal(v4IndependentJobTransport(null,{code:'AI_PROVIDER_NETWORK_ERROR'},true,2),'json','second interrupted SSE should switch transport on next durable step');
 assert.equal(v4IndependentJobTransport({transport_mode:'json'},null,true,3),'json','the sidecar must retain network failover');
 assert.equal(v4IndependentJobTransport(null,{code:'AI_PROVIDER_NETWORK_ERROR'},false,3),'configured','already-JSON requests cannot flip a nonexistent SSE connection');
 assert.equal(v4IndependentJobTransport(null,{code:'AI_PROVIDER_UPSTREAM_ERROR',upstreamKind:'HTTP_503'},true,3),'configured','ordinary provider 503 remains a service error');
 const route=readFileSync(new URL('../functions/_lib/v4-job-executor.js',import.meta.url),'utf8');
 assert.match(route,/provider\.stream=false;/,'provider transport must obey persisted per-job fallback');
 assert.match(route,/transport_mode:'json'/,'SSE fallback must be serialized into encrypted job sidecar');
 assert.match(route,/transportMode=v4IndependentJobTransport\(vettedPrevious\?previous:null,e,provider\.stream,claim\.attempts\)/);
 assert.match(route,/await saveMatchTask\(env,resultKey,/,'job checkpoint remains persisted for same candidate and revision');
});


test('job-step control stream writes immediate heartbeat and periodic keepalive before private AI finishes',async()=>{
 const {streamV4JobControl}=await import('../functions/_lib/v4-job-control-stream.js');
 let finishJob;
 const work=new Promise(resolve=>{finishJob=resolve;});
 const result=streamV4JobControl(()=>work,{heartbeatMs:10});
 assert.match(result.headers.get('content-type'),/text\/event-stream/);
 const reader=result.body.getReader(),decoder=new TextDecoder();
 const first=decoder.decode((await reader.read()).value);
 assert.match(first,/event: heartbeat/);
 assert.doesNotMatch(first,/Bearer|resume|research|cv_text/);
 const second=decoder.decode((await reader.read()).value);
 assert.match(second,/event: heartbeat/);
 finishJob({ok:true,body:{status:'DONE',lane:'verification'}});
 const third=decoder.decode((await reader.read()).value);
 assert.match(third,/event: complete/);
 assert.match(third,/"status":"DONE"/);
 assert.equal((await reader.read()).done,true);
});
test('job stream returns sanitized failures, not private JD evidence or full exception messages',async()=>{
 const {streamV4JobControl}=await import('../functions/_lib/v4-job-control-stream.js');
 for(const failure of [{ok:false,error:'AI_PROVIDER_UPSTREAM_ERROR'},{ok:false,error:'SECRET_RAW_PROMPT'}]){
  const stream=streamV4JobControl(async()=>failure,{heartbeatMs:10000});
  const frames=await stream.text();
  assert.match(frames,/event: heartbeat/);
  assert.match(frames,/event: failure/);
  assert.doesNotMatch(frames,/SECRET_RAW_PROMPT/);
  assert.ok(frames.includes(failure.error==='AI_PROVIDER_UPSTREAM_ERROR'?'AI_PROVIDER_UPSTREAM_ERROR':'AI_BACKGROUND_EXECUTION_FAILED'));
 }
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/if\(data\.stream===true\)return streamV4JobControl\(execute\)/);
 assert.match(route,/const result=await execute\(\)/,'legacy caller has JSON fallback');
});


test('resumed isolated JD job uses a full safe phase budget instead of repeated narrow recovery budgets',async()=>{
 const {v4ManagedResourceBudget,v4IndependentJobBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const full=v4IndependentJobBudget(),legacy=v4ManagedResourceBudget({background:true,recovering:true});
 assert.equal(full.snapshot().soft,36);
 assert.equal(full.snapshot().hard,44);
 assert.equal(full.snapshot().progress_reserve,4);
 assert.equal(legacy.snapshot().soft,29,'main discovery recovery keeps its conservative safety margin');
 assert.equal(full.snapshot().external_subrequests.ceiling,46,'real Cloudflare external cap is still enforced');
 assert.ok(full.remainingResearch()>legacy.remainingResearch(),'saved one-job continuation should have more room to finish real JD research');
 for(let i=0;i<28;i++)full.take('fetch');
 assert.equal(full.snapshot().external_subrequests.used,28);
 assert.equal(full.canStart(),false,'phase stops admitting new AI work at the soft budget');
 for(let i=0;i<4;i++)full.take('fetch');
 assert.equal(full.snapshot().used,40,'hard guard holds four units for persistence');
 assert.throws(()=>full.take('fetch'),e=>e.code==='AI_PHASE_RESOURCE_YIELD');
 const source=readFileSync(new URL('../functions/_lib/v4-job-executor.js',import.meta.url),'utf8');
 assert.match(source,/const budget=v4IndependentJobBudget\(\)/);
 assert.match(source,/HHBA_V4_INDEPENDENT_JOB_BUDGET_YIELD/);
});


test('completed JD model calls are durably replayed by exact payload on a later invocation, not repeated or truncated',async()=>{
 const {phaseModelReplay}=await import('../functions/_lib/v4-phase-budget.js');
 const {v4Call}=await import('../functions/_lib/simple-match-v4.js');
 const reply={status:'completed',output:[
  {type:'reasoning',summary:['private model reasoning must not persist']},
  {type:'message',role:'assistant',content:[{type:'output_text',text:'{"sources":[{"url":"https://employer.test/jobs/22"}]}'}]}
 ]};
 let sent=0,persisted=null,writes=0;
 const fetcher=async()=>{sent++;return Response.json(reply)};
 const payload={input:JSON.stringify({job:'22',company:'employer'}),instructions:'Find the real official posting.'};
 const firstReplay=phaseModelReplay([],{
  onRemember:async entries=>{persisted=structuredClone(entries);writes++;}
 });
 const makeProvider=replay=>({kind:'openai',model:'gpt-test',key:'fake',baseUrl:'https://relay.test/v1',stream:false,phaseReplay:replay});
 const first=await v4Call(fetcher,makeProvider(firstReplay),payload,{stage:'jd_search'});
 assert.equal(first.status,'completed');
 assert.equal(sent,1);
 assert.equal(writes,1,'the successful model result must reach encrypted-sidecar writer before next JD step');
 assert.equal(persisted.length,1);
 assert.deepEqual(persisted[0][1].output,[reply.output[1]],'never persist hidden reasoning');
 const resumed=phaseModelReplay(persisted,{onRemember:async entries=>{persisted=entries;writes++;}});
 const exact=await v4Call(fetcher,makeProvider(resumed),payload,{stage:'jd_search'});
 assert.equal(exact.status,'completed');
 assert.equal(sent,1,'do not repeat an already completed, exact-payload paid call');
 await v4Call(fetcher,makeProvider(resumed),payload,{stage:'jd_search'});
 assert.equal(sent,2,'two intentional same-prompt calls within one invocation are not reused');
 await v4Call(fetcher,makeProvider(resumed),{...payload,input:'different official vacancy'},{stage:'jd_search'});
 assert.equal(sent,3,'new or changed official research is never blocked by replay');
 assert.equal(writes,3);
});
test('independent JD sidecar enforces current lease, account generation and encrypted write for every completed model response',()=>{
 const source=readFileSync(new URL('../functions/_lib/v4-job-executor.js',import.meta.url),'utf8');
 assert.match(source,/const replay=phaseModelReplay\(vettedPrevious\?previous\?\.phaseReplay:\[\],\{/);
 assert.match(source,/onRemember:async entries=>\{/);
 assert.match(source,/await renewV4JobWork\(db,claim,\{leaseMs:300000\}\)/);
 assert.match(source,/await assertSessionTaskActive\(env,session,task\.id,generation\)/);
 assert.match(source,/checkpoint:recovery\(\)\|\|child,phaseReplay:entries,complete:false/);
 assert.match(source,/phaseReplay:replay\.snapshot\(\),complete:false/);
 assert.match(source,/checkpoint:snapshot,phaseReplay:replay\.snapshot\(\),job:result/);
 const model=readFileSync(new URL('../functions/_lib/simple-match-v4.js',import.meta.url),'utf8');
 assert.match(model,/await provider\.phaseReplay\.persist\?\.\(\)/);
});


test('completed JD model calls are encrypted-checkpoint candidates, replayed only on the next invocation',async()=>{
 const {phaseModelReplay}=await import('../functions/_lib/v4-phase-budget.js');
 const persisted=[];
 const first=phaseModelReplay([],{onRemember:async entries=>{persisted.push(structuredClone(entries));}});
 const answer={status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:'公开招聘依据'}]}]};
 first.remember('exact-jd-stage-and-prompt-digest',answer);
 await first.persist();
 assert.equal(persisted.length,1,'a successful paid model call must be saved before the next JD step');
 assert.equal(persisted[0].length,1);
 assert.ok(!JSON.stringify(persisted).includes('reasoning'),'private model reasoning must not be saved in replay');
 assert.equal(first.take('exact-jd-stage-and-prompt-digest'),null,'same-run deliberate repeat must be live');
 const restarted=phaseModelReplay(persisted[0]);
 const once=restarted.take('exact-jd-stage-and-prompt-digest');
 assert.equal(once.output[0].content[0].text,'公开招聘依据');
 assert.equal(restarted.take('exact-jd-stage-and-prompt-digest'),null,'next deliberate repeat must still research live');
 assert.equal(restarted.take('different-prompt-digest'),null,'new evidence/prompt must never reuse a stale result');
 const source=readFileSync(new URL('../functions/_lib/v4-job-executor.js',import.meta.url),'utf8');
 const model=readFileSync(new URL('../functions/_lib/simple-match-v4.js',import.meta.url),'utf8');
 assert.match(source,/phaseModelReplay\(vettedPrevious\?previous\?\.phaseReplay:/);
 assert.match(source,/phaseReplay:replay\.snapshot\(\)/,'both finished and deferred JD checkpoints retain completed model evidence');
 assert.match(source,/await saveMatchTask\(env,resultKey,/);
 assert.match(model,/await provider\.phaseReplay\.persist\?\.\(\)/,'successful provider response must be saved before later verification can fail');
});
test('failed model answers are not reused and checkpoint write failure remains retryable',async()=>{
 const {phaseModelReplay}=await import('../functions/_lib/v4-phase-budget.js');
 let writes=0;
 const replay=phaseModelReplay([],{onRemember:async()=>{writes++;throw Error('temporary encrypted storage failure')}});
 replay.remember('failed',{status:'incomplete',output:[{type:'message'}]});
 await replay.persist();
 assert.equal(writes,0);
 replay.remember('complete',{status:'completed',output:[{type:'message',content:[]}]});
 await assert.rejects(()=>replay.persist(),/temporary encrypted storage failure/);
 await assert.rejects(()=>replay.persist(),/temporary encrypted storage failure/);
 assert.equal(writes,2,'failed durable writes cannot acknowledge model evidence as persisted');
});
