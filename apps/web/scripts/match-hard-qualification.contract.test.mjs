import test from 'node:test';
import assert from 'node:assert/strict';
import {minimumExperienceFromJd,assessExperienceRequirement} from
 '../functions/_lib/match-hard-qualification.js';
import {scoreJobs} from '../functions/_lib/clean-match-v2.js';
import {archiveCleanMatchJobs} from '../functions/_lib/clean-match-v2-jd-bridge.js';

const provider={name:'openai',model:'gpt-6.2-sol',key:'NON_SECRET_TEST_KEY_1234567890'};
const requirement='至少5年相关零售培训或门店运营经验，能够组织区域门店辅导';
const cv={facts:[{id:'CV-1',kind:'work',
 quote:'负责汽车区域门店运营监督、渠道培训及销售漏斗复盘'}],
 experience_years:1,skills:[{name:'门店运营'}]};
const jd={company:'某运动品牌',title:'区域培训经理',location:'上海',
 url:'https://careers.tencent.com/jobdesc.html?postId=2097166275703910400',
 duties:'负责区域门店运营监督、渠道培训及销售漏斗复盘',
 requirements:requirement,excerpt:'公开岗位原文'};
const json=v=>Response.json({status:'completed',output:[
 {type:'message',content:[{type:'output_text',text:JSON.stringify(v)}]}]});
const model=async()=>json({jobs:[{id:'p1',score:95,
 reason:'候选人具有直接的区域门店运营与培训经验，但岗位另有明确任职门槛，不能忽视这项要求。',
 score_basis:'已核对部分岗位职责和原文经历，存在真实相关性。',
 alignments:[{jd_quote:'负责区域门店运营监督',resume_fact_id:'CV-1'}],
 gaps:[]}]});

test('extraction differentiates 5-year minimum from unrelated numbers',()=>{
 assert.equal(minimumExperienceFromJd(requirement).years,5);
 assert.equal(minimumExperienceFromJd('Above 5 years training or retail operation experience').years,5);
 assert.equal(minimumExperienceFromJd('Minimum 3–5 years of experience in retail marketing').years,3);
 assert.equal(minimumExperienceFromJd('活动开展3次，转化率提升20%，任职资格不限'),null);
 assert.equal(minimumExperienceFromJd('质保期3年，产品维修服务').years,undefined);
});

test('an apparently perfect skill match cannot override missing or short experience history',async()=>{
 const low=await scoreJobs(async()=>model(),provider,cv,[jd]);
 assert.equal(low[0].match_score,null);
 assert.equal(low[0].qualification_status,'BELOW_MINIMUM');
 assert.equal(low[0].minimum_experience_years,5);
 assert.match(low[0].not_evidenced.join(''),/5年/);
 const missing=await scoreJobs(async()=>model(),provider,{...cv,experience_years:null},[jd]);
 assert.equal(missing[0].match_score,null);
 assert.equal(missing[0].qualification_status,'UNVERIFIED');
 const meets=await scoreJobs(async()=>model(),provider,{...cv,experience_years:6},[jd]);
 assert.equal(meets[0].match_score,95);
 assert.equal(meets[0].qualification_status,'EVIDENCED');
});

test('hard gate also applies to independently archived official JD re-scoring',async()=>{
 const locator={url:jd.url,company:jd.company,kind:null};
 const archived={id:'jd_'+'a'.repeat(32),jd_sha256:'b'.repeat(64),
  canonical_url:jd.url,company:jd.company,title:jd.title,location:'上海',
  checked_at:'2026-11-24T10:00:00Z',fresh:true,proof_method:'DIRECT_EMPLOYER_HTML_V1',
  sections:[{id:'JD-1',kind:'responsibilities',text:jd.duties},
   {id:'JD-2',kind:'requirements',text:requirement}]};
 let compared=0;
 const result=await archiveCleanMatchJobs({},provider,cv,[{
  company:jd.company,title:jd.title,location:'上海',official_url:jd.url
 }],{},{ready:async()=>true,locator:()=>locator,read:async()=>archived,
  compare:async()=>{compared++;return {score:95}}});
 assert.equal(result.diagnostic.verified,1);
 assert.equal(result.diagnostic.scored,0);
 assert.equal(result.matches[0].match_score,null);
 assert.equal(result.matches[0].qualification_status,'BELOW_MINIMUM');
 assert.equal(compared,0,'do not pay a model to override an explicit experience requirement');
});
