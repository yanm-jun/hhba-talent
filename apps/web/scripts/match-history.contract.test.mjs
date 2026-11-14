import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 safeHistoryJobs,compareOpportunitySets,saveMatchHistory,
 listMatchHistory,getMatchHistory,deleteMatchHistory,linkSavedResumeToHistory
} from '../functions/_lib/match-history.js';
import {onRequest as handleHistory} from '../functions/api/match-history/[[path]].js';

const company='星云科技',job={
 id:'search-j1',company,title:'产品运营',location:'上海',
 official_url:'https://careers.orbit-cn.com/jobs/operations-2026',
 match_score:92,score_basis:'简历项目规划、数据分析和企业数字产品实操经验能够支撑相应岗位职责。',
 recommendation_reason:'简历展示了对需求分析、产品落地和用户增长相关工作的具体实践经验，可直接用于产品运营岗位工作。仍需核对企业实际招聘要求。',
 availability_status:'UNKNOWN',recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE',
 recruitment_source_note:'疑似企业招聘站 · 来源待核验'
};
const owned='8c5a438b-ac31-449b-873e-36ea87121c17';
const phoneA='13800000000',phoneB='13900000000';
const now=new Date().toISOString();
function inMemoryDB(){
 const runs=new Map(),resumes=new Map([[owned,{id:owned,filename:'个人简历.pdf',phone:phoneA}]]);
 const records={
  [phoneA]:{phone:phoneA,role:'candidate'},[phoneB]:{phone:phoneB,role:'candidate'}
 };
 const db={runs,resumes,prepare(sql){
  let params=[];
  return {bind(...values){params=values;return this},
   async first(){
    if(sql.includes('hhba_auth_sessions'))return {phone:params[0]===undefined?phoneA:phoneA,expires_at:new Date(Date.now()+60000).toISOString(),revoked:0};
    if(sql.includes('hhba_auth_users'))return records[params[0]]||null;
    if(sql.includes('hhba_candidate_resumes'))return resumes.get(params[1])?.phone===params[0]?resumes.get(params[1]):null;
    if(sql.startsWith('SELECT * FROM hhba_ai_match_history'))return runs.get(params[1])?.phone===params[0]?runs.get(params[1]):null;
    return null;
   },
   async all(){
    if(sql.includes('hhba_ai_match_history')){
     const matching=[...runs.values()].filter(x=>x.phone===params[0])
      .sort((a,b)=>b.created_at.localeCompare(a.created_at));
     const cutoff=sql.includes('LIMIT')?Number(params[1]):100;
     return {results:matching.slice(0,cutoff)};
    }
    return {results:[]};
   },
   async run(){
    if(sql.startsWith('INSERT INTO hhba_ai_match_history')){
     const [id,phone,resume_id,resume_label,role_hint,created_at,job_count,best_score,
      new_job_count,improved_job_count,jobs_json]=params;
     runs.set(id,{id,phone,resume_id,resume_label,role_hint,created_at,job_count,best_score,
      new_job_count,improved_job_count,jobs_json});
     return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('DELETE FROM hhba_ai_match_history')){
     const existed=runs.get(params[1])?.phone===params[0];
     if(existed)runs.delete(params[1]);
     return {success:true,meta:{changes:existed?1:0}};
    }
    if(sql.startsWith('UPDATE hhba_ai_match_history')){
     const found=runs.get(params[2]);
     if(!found||found.phone!==params[3])return {success:true,meta:{changes:0}};
     found.resume_id=params[0];found.resume_label=params[1];
     return {success:true,meta:{changes:1}};
    }
    return {success:true,meta:{changes:1}};
   }
  };
 }};
 return db;
}
test('store only trusted company careers and dedicated ATS links, no raw resume or board URL',()=>{
 const jobs=safeHistoryJobs([job,{...job,official_url:'https://www.zhipin.com/job_detail/12345.html'},
  {...job,official_url:'https://www.unknown-board.cn/jobs/id12345'},
  {...job,official_url:'javascript:alert(1)'}]);
 assert.equal(jobs.length,1);
 assert.equal(jobs[0].official_url,job.official_url);
 assert.equal(jobs[0].match_score,92);
 const json=JSON.stringify(jobs);
 assert.ok(!json.includes('简历全文')&&!json.includes('13800000000'));
 assert.equal(safeHistoryJobs([{...job,match_score:101}])[0].match_score,null);
});
test('new postings means unseen employer-job URL, never just a changed model score',()=>{
 const before=[{jobs_json:JSON.stringify([{...job,match_score:90}])}];
 const res=compareOpportunitySets(before,[{...job,match_score:95}]);
 assert.equal(res.new_job_count,0);
 assert.equal(res.improved_job_count,0);
 const out=compareOpportunitySets(before,[{...job,match_score:97},
  {...job,official_url:'https://careers.other-cn.com/careers/new-role-2026'}]);
 assert.equal(out.new_job_count,1);
 assert.equal(out.improved_job_count,1);
 assert.equal(compareOpportunitySets([], [job]).new_job_count,0,'first search is not a newly appeared opportunity');
});
test('persist results per real account, resume reference must be owned',async()=>{
 const db=inMemoryDB();
 const longRoleHint='督导，全国范围可出差，汽车零售优先；也考虑区域运营和渠道管理。'.repeat(4);
 const savedHint=await saveMatchHistory(db,'13700000000',null,longRoleHint,[job]);
 assert.equal(db.runs.get(savedHint.id).role_hint,longRoleHint.slice(0,240));
 const first=await saveMatchHistory(db,phoneA,null,'产品运营',[job]);
 assert.ok(first.id);
 assert.equal(first.new_job_count,0);
 assert.equal((await listMatchHistory(db,phoneA)).length,1);
 assert.equal((await listMatchHistory(db,phoneB)).length,0);
 assert.equal((await getMatchHistory(db,phoneB,first.id)),null);
 const found=await getMatchHistory(db,phoneA,first.id);
 assert.equal(found.matches.length,1);assert.equal(found.resume_id,null);
 assert.equal(found.resume_label,'本次上传的简历（未保存）');
 assert.equal(await linkSavedResumeToHistory(db,phoneA,first.id,owned),true);
 assert.equal((await getMatchHistory(db,phoneA,first.id)).resume_id,owned);
 db.resumes.delete(owned);
 assert.equal((await getMatchHistory(db,phoneA,first.id)).resume_id,null,
  'deleted R2 resume must not offer a dead re-match deep link');
 db.resumes.set(owned,{id:owned,filename:'个人简历.pdf',phone:phoneA});
 await assert.rejects(linkSavedResumeToHistory(db,phoneB,first.id,owned),/RESUME_NOT_OWNED/);
 const second=await saveMatchHistory(db,phoneA,owned,'产品运营',[job,{
  ...job,id:'search-j2',title:'数字产品主管',
  official_url:'https://careers.orbit-cn.com/jobs/product-lead-2026',match_score:87}]);
 assert.equal(second.new_job_count,1);
 assert.equal((await listMatchHistory(db,phoneA)).length,2);
 assert.equal(await deleteMatchHistory(db,phoneB,second.id),false);
 assert.equal(await deleteMatchHistory(db,phoneA,second.id),true);
 assert.equal((await listMatchHistory(db,phoneA)).length,1);
});
test('private route rejects anonymous bearer, cross-site mutation and forged writes',async()=>{
 const db=inMemoryDB(),env={HHBA_PNVS_AUTH_DB:db};
 const base='https://hhba.test/api/match-history';
 let res=await handleHistory({request:new Request(base),env});
 assert.equal(res.status,401);
 res=await handleHistory({request:new Request(base,{method:'POST',headers:{
  Origin:'https://attacker.test',Authorization:'Bearer attacker'
 },body:JSON.stringify({matches:[job]})}),env});
 assert.equal(res.status,403);
 res=await handleHistory({request:new Request(base,{method:'POST',headers:{
  Origin:'https://hhba.test',Authorization:'Bearer candidate'
 },body:JSON.stringify({matches:[job]})}),env});
 assert.equal(res.status,404,'users cannot write arbitrary fabricated results');
});
test('UI shows the correct login -> upload -> history navigation and real manual discovery',()=>{
 const root=new URL('../src/',import.meta.url);
 const read=p=>readFileSync(new URL(p,root),'utf8');
 const home=read('pages/HomePage.tsx');
 const login=read('pages/PhoneAuthPage.tsx');
 const match=read('pages/CandidateMatchPage.tsx');
 const account=read('pages/PersonalCenterPage.tsx');
 const vault=read('components/PrivateResumeVault.tsx');
 const dialog=read('components/CandidateMatchNativeDialog.tsx');
 const history=read('components/CandidateMatchHistory.tsx');
 assert.match(home,/candidate\/login\?next=%2Fcandidate%2Fmatch/);
 assert.match(home,/candidateSignedIn\?'\/candidate\/match'/);
 assert.match(login,/requested === '\/candidate\/match'/);
 assert.match(match,/uploadPrivateResume\(file,true\)/);
 assert.match(match,/linkMatchHistoryResume\(/);
 assert.match(dialog,/匹配历史/);
 assert.match(account,/current==='applications'&&<CandidateMatchHistory\/>/);
 assert.match(account,/historyCount/);
 assert.match(history,/不会在后台自动搜索/);
 assert.match(history,/重新匹配/);
 assert.match(vault,/私有存储/);
});
test('schema is additive, keyed by user and stores no resume body',()=>{
 const sql=readFileSync(new URL('../d1/0019_ai_match_history.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS hhba_ai_match_history/);
 assert.match(sql,/phone TEXT NOT NULL REFERENCES hhba_auth_users/);
 assert.match(sql,/jobs_json TEXT NOT NULL/);
 assert.doesNotMatch(sql,/resume_text|raw_resume|passport|email/gi);
});
