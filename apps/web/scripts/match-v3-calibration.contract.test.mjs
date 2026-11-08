import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCandidateFit} from '../functions/_lib/match-ranking.js';
import {explainFinalJobScore} from '../functions/_lib/match-explanation.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';
import {prioritizeOfficialSearchCandidates} from '../functions/_lib/domestic-search-fetch.js';

const applicant={
 education:'BACHELOR',experience_years:3,target_roles:['Python 开发工程师'],
 skills:[{name:'Python',evidence:'用 Python 开发接口'},{name:'SQL',evidence:'SQL 查询'}]
};
const job={
 id:'local',company:'真实企业',title:'Python 开发工程师',
 location:'上海',minimum_education:'BACHELOR',min_experience_years:2
};
const externalId='2097166275703910400',now=Date.parse('2026-11-08T00:00:00Z');

test('identical verified skill overlap is comparable regardless of how source labels it',()=>{
 const external=scoreCandidateFit(applicant,{...job,source_type:'站外官方招聘',
  required_skills:['Python','SQL']});
 const internal=scoreCandidateFit(applicant,{...job,source_type:'HHBA站内岗位',
  required_skills:[],unclassified_skills:['Python','SQL']});
 assert.equal(external.eligible,true);
 assert.equal(internal.eligible,true);
 assert.equal(external.breakdown.skills,30);
 assert.ok(internal.breakdown.skills>=24);
 assert.ok(external.score-internal.score<=6);
 assert.equal(external.evidence_quality.skills,'CLASSIFIED_REQUIREMENTS');
 assert.equal(internal.evidence_quality.skills,'UNCLASSIFIED_JD_SKILLS');
 assert.equal(external.breakdown.role,internal.breakdown.role);
 assert.equal(external.breakdown.experience,internal.breakdown.experience);
 assert.equal(external.breakdown.education,internal.breakdown.education);
});

test('missing mandatory skill still blocks recommendation despite source-neutral calibration',()=>{
 const candidate={...applicant,skills:[{name:'SQL'}]};
 const posted={...job,required_skills:['Python','SQL'],mandatory_skills:['Python']};
 const result=scoreCandidateFit(candidate,posted);
 assert.equal(result.eligible,false);
 assert.equal(result.reason,'MANDATORY_SKILL_NOT_EVIDENCED');
 assert.equal(result.score,null);
});

test('recommendation reasons are computed from the same final score and evidence',()=>{
 const posted={...job,required_skills:['Python','SQL']};
 const fit=scoreCandidateFit(applicant,posted);
 const reason=explainFinalJobScore(applicant,posted,fit);
 assert.match(reason.matched[0],new RegExp('匹配参考分 '+fit.score+'/100'));
 assert.ok(reason.matched[0].includes('技能 '+fit.breakdown.skills+'/30'));
 assert.ok(reason.matched.some(line=>line.includes('Python')&&line.includes('SQL')));
 assert.ok(reason.matched.some(line=>line.includes('达到岗位明确要求的最低 2 年')));
 assert.ok(reason.matched.some(line=>line.includes('符合该岗位最低学历要求')));
 assert.deepEqual(reason.not_evidenced,[]);
 assert.equal(reason.score_reasoning,reason.matched[0]);
});

test('uncategorized skill tags are explained as uncertain without claiming mandatory JD conditions',()=>{
 const tagged={...job,required_skills:[],unclassified_skills:['Python','SQL'],
  minimum_education:null,min_experience_years:null};
 const fit=scoreCandidateFit(applicant,tagged);
 const explanation=explainFinalJobScore(applicant,tagged,fit);
 assert.equal(fit.skill_evidence_status,'UNCLASSIFIED_JD_SKILLS');
 assert.ok(explanation.not_evidenced.some(x=>x.includes('技能标签')));
 assert.ok(explanation.not_evidenced.some(x=>x.includes('最低工作年限')));
 assert.ok(explanation.not_evidenced.some(x=>x.includes('最低学历')));
 assert.equal(explanation.matched.some(x=>x.includes('达到岗位明确要求')),false);
 assert.equal(explanation.matched.some(x=>x.includes('符合该岗位最低学历要求')),false);
});

test('score cap for title-only weak evidence is reflected in the rationale',()=>{
 const posted={...job,title:'工程平台支持',required_skills:['Python']};
 const fit=scoreCandidateFit(applicant,posted);
 assert.equal(fit.eligible,true);
 assert.ok(fit.score<=55);
 const explanation=explainFinalJobScore(applicant,posted,fit);
 if(fit.score_cap_applied){
  assert.ok(explanation.matched[0].includes('已限制上限'));
  assert.ok(explanation.not_evidenced.some(x=>x.includes('方向的证据有限')));
 }
});

test('fused source explanations never reuse a stale pre-V2 keyword rationale',()=>{
 const row={
  id:'careers.tencent.com:'+externalId,company:'腾讯',title:'Python 开发工程师',
  location:'深圳',official_url:'https://careers.tencent.com/jobdesc.html?postId='+externalId,
  official_domain:'careers.tencent.com',source_type:'站外官方招聘',
  source_status:'OFFICIAL_DETAIL_FETCHED',application_status:'NEEDS_OFFICIAL_CONFIRMATION',
  has_application_cta:true,checked_at:'2026-11-08T00:00:00Z',
  evidence:{title:'Python 开发工程师',location:'深圳',requirement:
   '岗位要求：本科及以上学历，有2年以上开发工作经验。熟练使用 Python 和 SQL，能够完成后端 API 开发、服务维护和数据库优化。'}
 };
 const output=fuseDomesticJobRecommendations([],[row],applicant,{role_hint:'Python 开发工程师'},now);
 assert.equal(output.matches.length,1);
 const final=output.matches[0];
 assert.match(final.matched[0],new RegExp('匹配参考分 '+final.reference_score+'/100'));
 assert.equal(final.score_reasoning,final.matched[0]);
 assert.ok(final.matched.some(x=>x.includes('Python')));
 assert.equal(final.matched.some(x=>x.includes('简历已识别技能与官方任职要求相关：')),false);
 assert.ok(final.evidence_quality);
 assert.equal(final.ranking_version,'HHBA_MATCH_RANKING_V2');
});

test('fetch target priority uses search title only for budget ordering, not verification',()=>{
 const urls=i=>'https://careers.tencent.com/jobdesc.html?postId='+String(2097166275703910400+i);
 const rows=[
  ...Array.from({length:10},(_,i)=>({url:urls(i),title:i<6?'数据分析师':'职位详情'})),
  {url:'https://career.huawei.com/cn/job-details?advertisementId=46651',title:'Python 开发工程师'},
  {url:'https://zhaopin.jd.com/web/job-info-detail?requementId=227402',title:'Python 后端开发工程师'},
  {url:'https://example.com/job',title:'Python 开发工程师'}
 ];
 const chosen=prioritizeOfficialSearchCandidates(rows,['Python 开发工程师'],8);
 assert.ok(chosen.length<=8);
 assert.ok(chosen.some(x=>x.url.includes('career.huawei.com')));
 assert.ok(chosen.some(x=>x.url.includes('zhaopin.jd.com')));
 assert.equal(chosen.some(x=>x.url.includes('example.com')),false);
 assert.equal(new Set(chosen.map(x=>x.url)).size,chosen.length);
 const tencent=chosen.filter(x=>x.url.includes('careers.tencent.com'));
 assert.ok(tencent.length<=6); // second pass fills only when diversity exhausted
 assert.ok(chosen.every(x=>!Object.hasOwn(x,'relevance')),'untrusted hint is not forwarded as a JD fact');
});
