// Synthetic contract: one inference per saved immutable resume, private D1 cache,
// no raw PII persistence, daily cap, concurrency, and edited-text bypass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 getOrParseResumeProfile,safeResumeContext,PROFILE_SCHEMA,FREE_MODEL,DAILY_PARSER_CALL_CAP
} from '../functions/_lib/free-resume-profile.js';

function harness(){
 const profiles=new Map(),calls=[],usage=[],freeCalls=[],owner='13800000000';
 let pending=null;
 const db={prepare(sql){return {bind(...args){return {
  async first(){
   if(sql.startsWith('SELECT file_sha256'))return profiles.get(args[0])?.phone===args[1]?profiles.get(args[0]):null;
   throw Error('Unexpected first: '+sql);
  },
  async run(){
   if(sql.startsWith('INSERT OR IGNORE INTO hhba_candidate_resume_profiles')){
    if(profiles.has(args[0]))return {success:true,meta:{changes:0}};
    profiles.set(args[0],{phone:args[1],file_sha256:args[2],schema_version:args[3],
     state:'RUNNING',profile_json:null,attempt_id:args[4],lease_until:args[5]});
    return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith('UPDATE hhba_candidate_resume_profiles SET file_sha256=')){
    const row=profiles.get(args[6]);
    if(!row||row.phone!==args[7]||(row.state==='RUNNING'&&row.lease_until>=args[8]))
     return {success:true,meta:{changes:0}};
    Object.assign(row,{file_sha256:args[0],schema_version:args[1],state:args[2],
     profile_json:null,attempt_id:args[3],lease_until:args[4]});
    return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith('INSERT INTO hhba_free_ai_provider_calls')){
    const provider=args[3],unit=args[4];
    const total=freeCalls.filter(x=>x.provider===provider).reduce((sum,x)=>sum+x.unit,0);
    const cap=provider==='cloudflare'?7200:provider==='groq'?120000:30;
    if(total+unit>cap)return {success:true,meta:{changes:0}};
    freeCalls.push({provider,unit});return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith('INSERT INTO hhba_resume_profile_ai_calls')){
    if(usage.length>=DAILY_PARSER_CALL_CAP)return {success:true,meta:{changes:0}};
    usage.push(args[0]);return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith("UPDATE hhba_candidate_resume_profiles SET state='READY'")){
    const row=profiles.get(args[2]);
    if(!row||row.phone!==args[3]||row.attempt_id!==args[4]||row.state!=='RUNNING')
     return {success:true,meta:{changes:0}};
    row.state='READY';row.profile_json=args[0];return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith('DELETE FROM hhba_candidate_resume_profiles')){
    const row=profiles.get(args[0]);
    if(row?.phone===args[1]&&row.attempt_id===args[2]&&row.state==='RUNNING')profiles.delete(args[0]);
    return {success:true,meta:{changes:1}};
   }
   throw Error('Unexpected run: '+sql);
  }
 }}}}};
 const env={
  HHBA_FREE_RESUME_PARSE_ENABLED:'1',
  HHBA_ZERO_PAID_AI_ENFORCED:'1',
  HHBA_FREE_AI_CLOUDFLARE_FREE_PLAN_VERIFIED:'1',
  HHBA_MATCH_LIMIT_PEPPER:'synthetic-pepper-with-32-chars-123456789',
  HHBA_PNVS_AUTH_DB:db,
  AI:{async run(model,params){
   assert.equal(model,FREE_MODEL);
   calls.push(params);
   if(pending)await pending;
   assert.doesNotMatch(JSON.stringify(params),/13812345678|test@example.com/);
   return {response:JSON.stringify({
    education:'BACHELOR',education_evidence:'学历本科',
    experience_years:3,experience_evidence:'3年工作经验',
    skills:[{name:'Python',evidence:'Python数据处理'}],
    target_roles:['数据分析'],highlights:['负责Python数据处理及销售数据分析项目管理工作']
   })};
  }}};
 const text='学历本科，3年工作经验，技能Python数据处理，工作方向数据分析。负责Python数据处理及销售数据分析项目管理工作。电话13812345678，邮箱test@example.com。';
 const opts={phone:owner,resumeId:'12345678-1234-4123-8123-123456789012',
  fileSha256:'a'.repeat(64),text};
 return {env,opts,profiles,calls,usage,freeCalls,setPending:v=>{pending=v}};
}
test('first save parses; re-match returns cached profile with zero additional inference',async()=>{
 const h=harness();
 const first=await getOrParseResumeProfile(h.env,h.opts);
 assert.equal(first.source,'NEW');assert.equal(h.calls.length,1);
 assert.equal(first.profile.education,'BACHELOR');
 const again=await getOrParseResumeProfile(h.env,{...h.opts,text:''});
 assert.equal(again.source,'CACHED');assert.equal(h.calls.length,1);
 assert.equal(h.usage.length,1);assert.equal(h.profiles.size,1);
 const saved=h.profiles.values().next().value.profile_json;
 assert.doesNotMatch(saved,/13812345678|test@example.com/);
 assert.doesNotMatch(saved,/电话|邮箱/);
 assert.match(safeResumeContext(again.profile),/Python/);
 assert.equal(h.profiles.values().next().value.schema_version,PROFILE_SCHEMA);
});
test('cache miss with empty text returns 428 before any AI call',async()=>{
 const h=harness();
 await assert.rejects(getOrParseResumeProfile(h.env,{...h.opts,text:''}),e=>e.code==='FREE_RESUME_PARSER_TEXT_REQUIRED'&&e.status===428);
 assert.equal(h.calls.length,0);assert.equal(h.usage.length,0);
});
test('edited preview uses ephemeral parsing and does not overwrite saved cache',async()=>{
 const h=harness();
 await getOrParseResumeProfile(h.env,h.opts);
 const existing=h.profiles.values().next().value.profile_json;
 const edited=await getOrParseResumeProfile(h.env,{...h.opts,text:h.opts.text+'新增意向城市上海。',skipCache:true});
 assert.equal(edited.source,'EPHEMERAL');
 assert.equal(h.calls.length,2);
 assert.equal(h.profiles.values().next().value.profile_json,existing);
});
test('concurrent saved requests hold one profile lock and prevent double GPU use',async()=>{
 const h=harness();let release;
 const gate=new Promise(resolve=>{release=resolve});
 h.setPending(gate);
 const first=getOrParseResumeProfile(h.env,h.opts);
 // Wait until D1 INSERT and quota reservation have finished.
 for(let i=0;i<20&&h.calls.length===0;i++)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(h.calls.length,1);
 await assert.rejects(getOrParseResumeProfile(h.env,h.opts),e=>e.code==='FREE_RESUME_PARSER_IN_PROGRESS'&&e.status===409);
 release();assert.equal((await first).source,'NEW');
 assert.equal(h.calls.length,1);assert.equal(h.usage.length,1);
});
test('daily cap stops extra inference without blocking an existing cache hit',async()=>{
 const h=harness();
 await getOrParseResumeProfile(h.env,h.opts);
 while(h.usage.length<DAILY_PARSER_CALL_CAP)h.usage.push('synthetic');
 const cached=await getOrParseResumeProfile(h.env,{...h.opts,text:''});
 assert.equal(cached.source,'CACHED');
 await assert.rejects(getOrParseResumeProfile(h.env,{...h.opts,resumeId:null,fileSha256:null}),
  e=>e.code==='FREE_RESUME_PARSER_DAILY_LIMIT'&&e.status===429);
 assert.equal(h.calls.length,1);
});
test('missing binding fails closed and cannot silently switch to a paid provider',async()=>{
 const h=harness();delete h.env.AI;
 await assert.rejects(getOrParseResumeProfile(h.env,{...h.opts,resumeId:null,fileSha256:null}),
  e=>e.code==='FREE_RESUME_PARSER_NOT_CONFIGURED');
 assert.equal(h.profiles.size,0);
});
