import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enrichSearchMatchesWithJD,scoreVerifiedJDSearchJob,MATCH_JD_PIPELINE}
 from '../functions/_lib/match-jd-enrichment.js';
import {safeHistoryJobs} from '../functions/_lib/match-history.js';

const URL='https://job-boards.greenhouse.io/hhbaexample/jobs/1234567';
const ID='jd_'+'a'.repeat(32),HASH='b'.repeat(64);
const job=(url=URL)=>({
 id:'search-example',company:'示例企业',title:'区域运营经理',title_zh:'区域运营经理',
 location:'上海',official_url:url,match_score:74,reference_score:74,
 score_basis:'仅基于搜索摘要的 AI 初评分',recommendation_reason:'区域门店运营经验可迁移。',
 availability_status:'UNKNOWN',recruitment_source_kind:'EMPLOYER_ATS',
 recruitment_source_note:'企业专属 ATS 来源，法定企业名称尚待核对'
});
const archive=()=>({
 id:ID,jd_sha256:HASH,checked_at:new Date().toISOString(),fresh:true,
 company:'hhbaexample',title:'区域运营经理',location:'上海',
 canonical_url:URL,proof_method:'PUBLIC_EMPLOYER_ATS_V1',
 full_jd:'Responsibilities\nManage store performance and regional operations.\nQualifications\n熟练使用 Excel 工具，负责数据分析与门店经营管理。',
 sections:[
  {id:'JD-001',kind:'responsibilities',text:'Responsibilities'},
  {id:'JD-002',kind:'responsibilities',text:'Manage store performance and regional operations.'},
  {id:'JD-003',kind:'requirements',text:'Qualifications'},
  {id:'JD-004',kind:'requirements',text:'熟练使用 Excel 工具，负责数据分析与门店经营管理。'}
 ]
});
const resume='学历：本科\n工作经历\n2025.01-2026.07 某汽车公司 区域运营经理，负责多家门店经营管理，熟练使用 Excel 进行数据分析。';
const env={HHBA_MATCH_JD_ENRICH_ENABLED:'1',
 HHBA_JOB_JD_DB:{prepare(){}},HHBA_JOB_JD_R2:{get(){},put(){}}};
test('disabled/default settings preserve provisional Search scores and never call external fetch',async()=>{
 let calls=0;
 const result=await enrichSearchMatchesWithJD(
  {...env,HHBA_MATCH_JD_ENRICH_ENABLED:'0'},[job()],resume,{role_hint:'区域运营经理'},
  {ready:async()=>{calls++;return true},fetchAts:async()=>{calls++;throw Error('should not fetch')}});
 assert.equal(result.matches[0].match_score,74);
 assert.equal(result.matches[0].jd_version_id,undefined);
 assert.equal(result.diagnostic.mode,'disabled');
 assert.equal(calls,0);
});
test('verified public JD replaces provisional score and pins immutable version for Word and history',async()=>{
 const result=await enrichSearchMatchesWithJD(env,[job()],resume,{role_hint:'区域运营经理'},{
  ready:async()=>true,getCached:async()=>archive(),
  fetchAts:async()=>{throw Error('unexpected network fetch')}});
 const first=result.matches[0];
 assert.equal(result.diagnostic.mode,MATCH_JD_PIPELINE);
 assert.equal(result.diagnostic.verified,1);
 assert.equal(first.jd_version_id,ID);
 assert.equal(first.jd_sha256,HASH);
 assert.equal(first.jd_source_status,'VERIFIED_JD');
 assert.equal(first.jd_proof_method,'PUBLIC_EMPLOYER_ATS_V1');
 assert.equal(first.jd_employer_identity_status,'ATS_TENANT_NOT_LEGAL_ENTITY_VERIFIED');
 assert.equal(first.ranking_version,'HHBA_MATCH_RANKING_V2');
 assert.equal(first.jd_score_status,'V2_JD_EVIDENCE_SCORED');
 assert.equal(typeof first.match_score,'number');
 assert.notEqual(first.score_basis,'仅基于搜索摘要的 AI 初评分');
 const saved=safeHistoryJobs(result.matches)[0];
 assert.equal(saved.jd_version_id,ID);
 assert.equal(saved.jd_sha256,HASH);
 assert.equal(saved.jd_score_status,'V2_JD_EVIDENCE_SCORED');
 assert.ok(!('full_jd' in saved),'history must not contain full JD or personal CV');
});
test('foreign, unrecognized, and failed direct verifications cannot be promoted as verified JD',async()=>{
 const bad={...job(),official_url:'https://jobs.board.example/unknown'};
 let called=0;
 const result=await enrichSearchMatchesWithJD(env,[bad,job()],resume,{},{
  ready:async()=>true,
  getCached:async()=>null,
  fetchAts:async()=>{called++;throw Error('ATS_POSTING_NOT_AVAILABLE')}});
 assert.equal(result.diagnostic.eligible,1);
 assert.equal(result.diagnostic.verified,0);
 assert.equal(result.diagnostic.failed,1);
 assert.equal(called,1);
 assert.equal(result.matches[0].jd_version_id,undefined);
 assert.equal(result.matches[1].match_score,74);
});
test('two Search candidates pointing to one canonical job consume only ONE shared JD fetch',async()=>{
 const other={...job(URL+'?gh_jid=1234567'),id:'search-duplicate',title:'区域运营经理'};
 let reads=0,fetches=0,writes=0;
 const result=await enrichSearchMatchesWithJD(env,[job(),other],resume,{role_hint:'区域运营经理'},{
  ready:async()=>true,
  getCached:async()=>{reads++;return null},
  fetchAts:async url=>{fetches++;assert.equal(url,URL);return {...archive()};},
  save:async()=>{writes++;return archive()}
 });
 assert.equal(result.diagnostic.verified,2);
 assert.equal(reads,1);assert.equal(fetches,1);assert.equal(writes,1);
 assert.equal(result.matches[0].jd_version_id,result.matches[1].jd_version_id);
 assert.equal(result.matches[1].official_url,URL);
});
test('a different job title or a different Mainland city cannot borrow another JD',()=>{
 assert.equal(scoreVerifiedJDSearchJob({...job(),title:'软件开发工程师'},archive(),resume),null);
 assert.equal(scoreVerifiedJDSearchJob({...job(),location:'北京'},archive(),resume),null);
});
test('missing documented qualifications yield NO made-up JD score',()=>{
 const result=scoreVerifiedJDSearchJob(job(),archive(),'没有工作经验或相关技能。',{role_hint:'区域运营经理'});
 assert.equal(result.jd_version_id,ID);
 assert.equal(result.jd_score_status,'INSUFFICIENT_RESUME_EVIDENCE');
 assert.equal(result.match_score,null);
});
test('verified JD version crosses search UI, history and Word without storing private resume in shared JD',()=>{
 const route=readFileSync(new globalThis.URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 const history=readFileSync(new globalThis.URL('../functions/_lib/match-history.js',import.meta.url),'utf8');
 const dialog=readFileSync(new globalThis.URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const editor=readFileSync(new globalThis.URL('../src/components/TargetedResumeOptimization.tsx',import.meta.url),'utf8');
 assert.match(route,/verifiedJdPass\(/);
 assert.match(route,/withSavedHistory\(env,candidate,input,verified\)/);
 assert.match(history,/verifiedJdMeta\(item\)/);
 assert.match(dialog,/jd_version_id:job\.jd_version_id/);
 assert.match(editor,/getArchivedJobJdVersion\(job\.jd_version_id/);
});
