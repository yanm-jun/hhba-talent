import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExplicitHardRequirements,
  judgeVerifiedJobFit,
  createEvidenceFitScorer,
} from '../functions/_lib/talent-search-evidence-fit.js';
import { runTalentIntelligenceSearch } from '../functions/_lib/talent-search-orchestrator.js';

const resumeText=[
  '负责六家连锁门店的月度经营管理和销售目标复盘。',
  '组织销售顾问培训，制定巡店整改清单并跟进执行情况。',
  '通过线索与到店转化率分析，推动渠道销售流程持续优化。',
  '协调区域经销商和市场部门共同推进品牌推广活动。',
].join('\n');
const duties=[
  '负责区域门店运营与经营目标管理，组织区域督导和门店运营改善。',
  '对门店销售团队开展业务培训，推进标准化巡店与整改流程。',
  '分析销售线索转化数据，持续优化销售渠道运营效率。',
].join('\n');
const req=[
  '要求至少2年以上渠道运营管理经验。',
  '具备市场推广、数据分析和跨部门协作能力。',
  '本科及以上学历。',
].join('\n');
const job={
  company:'示例连锁企业有限公司',
  title:'区域运营督导',
  location:'上海',
  requirements:req,
  responsibilities:duties,
  official_url:'https://careers.example.cn/jobs/regional-ops-2026',
  recruitment_source_status:'VERIFIED_EMPLOYER_DOMAIN',
};
const profile={ education:'BACHELOR',experience_years:3,skills:[{name:'数据分析'}] };
const pair1={
  alignment:'direct',
  resume_quote:'负责六家连锁门店的月度经营管理和销售目标复盘。',
  job_quote:'负责区域门店运营与经营目标管理，组织区域督导和门店运营改善。',
  explanation:'具备真实的门店经营目标管理经历，可以迁移到岗位要求的区域运营。',
};
const pair2={
  alignment:'direct',
  resume_quote:'组织销售顾问培训，制定巡店整改清单并跟进执行情况。',
  job_quote:'对门店销售团队开展业务培训，推进标准化巡店与整改流程。',
  explanation:'简历具备门店培训和巡店整改经历，岗位也需要这两项具体能力。',
};
const pair3={
  alignment:'adjacent',
  resume_quote:'通过线索与到店转化率分析，推动渠道销售流程持续优化。',
  job_quote:'分析销售线索转化数据，持续优化销售渠道运营效率。',
  explanation:'简历中的转化率分析与岗位的数据驱动渠道改善具有相同工作方法。',
};

test('the JD minimums parser handles Chinese years, degree, and unproven professional licenses',()=>{
  const parsed=parseExplicitHardRequirements('本科及以上学历。要求三年以上区域运营管理经验。硕士优先。必须持有护士执业证书。');
  assert.equal(parsed.minimum_education,'BACHELOR');
  assert.equal(parsed.min_experience_years,3);
  assert.deepEqual(parsed.professional_credential_requirements,['NURSE_PRACTICE']);
});
test('preferred degree or experience never becomes a mandatory gate',()=>{
  const parsed=parseExplicitHardRequirements('学历不限；本科优先。具备渠道管理技能，5年以上经验者优先。');
  assert.equal(parsed.minimum_education,null);
  assert.equal(parsed.min_experience_years,null);
});
test('verified original resume and JD evidence produce a bounded, explainable fit score',()=>{
  const scored=judgeVerifiedJobFit({
    resumeText,profile,job,
    direction:{role:'区域督导',intent:'direct'},
    proposal:{pairs:[pair1,pair2]},
  });
  assert.equal(scored.eligible,true);
  assert.ok(scored.relevance>=0.75&&scored.relevance<=0.94);
  assert.ok(scored.competitiveness!==null);
  assert.equal(scored.pairs.length,2);
  assert.equal(scored.hard_requirements.minimum_education,'BACHELOR');
  assert.equal(scored.hard_requirements.min_experience_years,2);
});
test('fabricated or absent source quotes cannot generate a good fit score',()=>{
  const scored=judgeVerifiedJobFit({
    resumeText,profile,job,
    direction:{role:'区域督导',intent:'direct'},
    proposal:{pairs:[
      pair1,
      {...pair2,resume_quote:'独立研发量子芯片三十年并获诺贝尔奖'},
    ]},
  });
  assert.equal(scored.eligible,true);
  assert.equal(scored.relevance,null);
  assert.equal(scored.pairs.length,1);
  assert.equal(scored.reason,'INSUFFICIENT_MATCH_EVIDENCE');
});
test('one resume line cannot be copied across multiple JD lines to inflate a score',()=>{
  const scored=judgeVerifiedJobFit({
    resumeText,profile,job,direction:{role:'区域督导',intent:'direct'},
    proposal:{pairs:[
      pair1,
      {...pair1,job_quote:pair2.job_quote},
      {...pair1,job_quote:pair3.job_quote},
    ]},
  });
  assert.equal(scored.relevance,null);
  assert.equal(scored.pairs.length,1);
});
test('a transferable direction needs three separate grounded capability alignments',()=>{
  const two=judgeVerifiedJobFit({
    resumeText,profile,job,direction:{role:'跨行业连锁运营',intent:'transferable'},
    proposal:{pairs:[pair1,pair2]},
  });
  const three=judgeVerifiedJobFit({
    resumeText,profile,job,direction:{role:'跨行业连锁运营',intent:'transferable'},
    proposal:{pairs:[pair1,pair2,pair3]},
  });
  assert.equal(two.relevance,null);
  assert.ok(three.relevance!==null && three.relevance>=0.6);
});
test('minimum JD experience never yields a high match when resume experience is too low',()=>{
  const scored=judgeVerifiedJobFit({
    resumeText,profile:{...profile,experience_years:1},job,
    direction:{role:'区域督导',intent:'direct'},proposal:{pairs:[pair1,pair2]},
  });
  assert.equal(scored.eligible,false);
  assert.equal(scored.reason,'EXPERIENCE_NOT_MET');
  assert.equal(scored.relevance,null);
});
test('minimum education and mandatory professional license are hard gates',()=>{
  const edu=judgeVerifiedJobFit({
    resumeText,profile:{...profile,education:'ASSOCIATE'},job,
    direction:{role:'区域督导',intent:'direct'},proposal:{pairs:[pair1,pair2]},
  });
  assert.equal(edu.reason,'DEGREE_NOT_MET');
  const licensedJob={...job,requirements:req+'\n必须持有护士执业证书。'};
  const credential=judgeVerifiedJobFit({
    resumeText,profile,job:licensedJob,
    direction:{role:'区域督导',intent:'direct'},proposal:{pairs:[pair1,pair2]},
  });
  assert.equal(credential.eligible,false);
  assert.equal(credential.reason,'PROFESSIONAL_CREDENTIAL_NOT_EVIDENCED');
});
test('overseas-only or unverified jobs are ineligible regardless of model output',()=>{
  const foreign=judgeVerifiedJobFit({
    resumeText,profile,job:{...job,location:'新加坡'},
    direction:{role:'区域督导',intent:'direct'},proposal:{pairs:[pair1,pair2]},
  });
  assert.equal(foreign.eligible,false);
  assert.equal(foreign.reason,'NOT_MAINLAND_JOB');
  const untrusted=judgeVerifiedJobFit({
    resumeText,profile,job:{...job,recruitment_source_status:'OFFICIAL_SOURCE_UNCONFIRMED'},
    direction:{role:'区域督导',intent:'direct'},proposal:{pairs:[pair1,pair2]},
  });
  assert.equal(untrusted.reason,'UNVERIFIED_EVIDENCE');
});
test('separate fit and application competitiveness measures do not imply job-offer probability',()=>{
  const scored=judgeVerifiedJobFit({
    resumeText,profile,job,
    direction:{role:'区域督导',intent:'direct'},
    proposal:{pairs:[{...pair1,alignment:'adjacent'},{...pair2,alignment:'transferable'},pair3]},
  });
  assert.ok(scored.relevance!==null);
  assert.equal(scored.competitiveness,null);
  assert.match(scored.disclaimer,/不是面试、录用概率/);
});
test('an evidence scorer rejects absent providers, then validates all proposed quotes',async()=>{
  assert.throws(()=>createEvidenceFitScorer({resumeText,profile}),/FIT_EVIDENCE_MODEL_REQUIRED/);
  const scorer=createEvidenceFitScorer({
    resumeText,profile,evaluatePairs:async input=>{
      assert.equal(input.job.title,job.title);
      assert.equal(input.direction.role,'区域督导');
      return {pairs:[pair1,pair2]};
    },
  });
  const result=await scorer(job,{role:'区域督导',intent:'direct'});
  assert.equal(result.eligible,true);
  assert.ok(result.relevance>0.75);
});
test('the multi-wave engine removes hard-ineligible jobs from returned recommendations',async()=>{
  const scorer=createEvidenceFitScorer({
    resumeText,profile:{...profile,experience_years:1},
    evaluatePairs:async()=>({pairs:[pair1,pair2]}),
  });
  const verified=async hit=>({
    eligible:true,state:'VERIFIED_EMPLOYER_DOMAIN',job:{...job,official_url:hit.url},
    source_proof:{attestation_id:'test-audit'},field_evidence:{title:job.title},
  });
  const result=await runTalentIntelligenceSearch({
    careerGraph:[{role:'区域督导',intent:'direct',evidence_count:1}],
    maxWaves:1,queriesPerWave:1,minVerified:1,minRelevant:1,
    searchFn:async()=>({
      results:[{url:'https://careers.example.cn/jobs/regional-ops-2026'}],
      diagnostics:{provider_count:1,successful_provider_count:1,raw_hit_count:1},
    }),
    verifyCandidate:verified,
    scoreCandidate:scorer,
  });
  assert.equal(result.results.length,0);
  assert.equal(result.counters.rejected_jobs,1);
});
