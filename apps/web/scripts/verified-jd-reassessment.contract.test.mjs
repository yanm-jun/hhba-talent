import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {archivedJDToScoreJob,sameEngineReassessment} from '../functions/_lib/resume-reassessment.js';

const archived={
 id:'jd_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
 canonical_url:'https://careers.tencent.com/jobdesc.html?postId=123456789012',
 company:'腾讯',title:'区域运营经理',location:'上海',fresh:true,
 jd_sha256:'ff'.repeat(32),checked_at:new Date().toISOString(),
 proof_method:'DIRECT_EMPLOYER_HTML_V1',
 full_jd:'岗位职责\n管理多家门店运营及数据统计工作。\n任职要求\n熟练使用 Excel 工具开展数据分析。',
 sections:[
  {id:'JD-001',kind:'responsibilities',text:'岗位职责'},
  {id:'JD-002',kind:'responsibilities',text:'管理多家门店运营及数据统计工作。'},
  {id:'JD-003',kind:'requirements',text:'任职要求'},
  {id:'JD-004',kind:'requirements',text:'熟练使用 Excel 工具开展数据分析。'}
 ]};
test('Only current authenticated JD snapshots produce score facets',()=>{
 assert.equal(archivedJDToScoreJob({...archived,fresh:false}),null);
 assert.equal(archivedJDToScoreJob({...archived,sections:[]}),null);
 const scoring=archivedJDToScoreJob(archived);
 assert.equal(scoring.id,archived.id);
 assert.deepEqual(scoring.required_skills.sort(),['Excel','数据分析'].sort());
 assert.equal(scoring.proof_hash,archived.jd_sha256);
 assert.equal(scoring.official_url,archived.canonical_url);
 assert.equal(scoring.minimum_education,null);
});
test('Evidence score compares original versus revised text against SAME JD, not historical AI score',()=>{
 const job=archivedJDToScoreJob(archived);
 const profile={skills:[],target_roles:['区域运营经理'],education:null,experience_years:null};
 const before=[{id:'experience-0',section:'experience',text:'负责区域门店日常运营和数据统计。'}];
 const after=[{...before[0],text:'负责区域门店日常运营，使用 Excel 开展数据分析和月度汇报。'}];
 const comparison=sameEngineReassessment(job,profile,before,after);
 assert.equal(comparison.supported,true);
 assert.equal(comparison.ranking_version,'HHBA_MATCH_RANKING_V2');
 assert.equal(typeof comparison.original_score,'number');
 assert.equal(typeof comparison.updated_score,'number');
 assert.ok(comparison.updated_score>=comparison.original_score);
 assert.ok(comparison.newly_visible_terms.includes('Excel'));
 assert.match(comparison.important_notice,/不等于/);
});
test('There is no client-side replacement for full official JD scoring route',()=>{
 const route=readFileSync(new URL('../functions/api/resume-reassess.js',import.meta.url),'utf8');
 assert.match(route,/readJobJdById\(env,input.job_id\)/);
 assert.match(route,/archivedJDToScoreJob/);
 assert.match(route,/\/\^jd_\[a-f0-9\]\{32\}\$\//);
 assert.doesNotMatch(route,/input\.job\.requirements/);
});
