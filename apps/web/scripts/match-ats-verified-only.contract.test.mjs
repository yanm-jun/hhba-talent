import test from 'node:test';
import assert from 'node:assert/strict';
import {searchPublicJobs,publicMainlandAtsVerificationLeads} from '../functions/_lib/deepseek-search-match.js';
import {createMatchJdReview} from '../functions/_lib/match-jd-review.js';
import {safeHistoryJobs} from '../functions/_lib/match-history.js';

const GH='https://job-boards.greenhouse.io/hhbaexample/jobs/1234567';
const BOARD='https://www.zhipin.com/job_detail/123456';
const searchRows=[{
 title:'Regional Retail Operations Specialist - Shanghai, China',
 url:GH,site_name:'HHBA Example public job board',
 summary:'Employer role: Regional Retail Operations Specialist. Location: Shanghai, China. Responsibilities: manage retail stores.'
},{
 title:'华东区域督导，上海',url:BOARD,site_name:'第三方职位转载',
 summary:'岗位职责：门店督导；工作地点：上海。'
}];
test('exact public ATS postings become private verification leads, not unverified recommendations',async()=>{
 const result=await searchPublicJobs('synthetic','脱敏简历','区域督导',{
  queriesOverride:['区域督导 上海 公开企业招聘'],allowEmpty:true,
  fetcher:async()=>Response.json({results:searchRows})
 });
 assert.deepEqual(result.hits,[],'unverified foreign-hosted ATS or third-party URLs must never appear');
 assert.deepEqual(result.ats_posting_urls,[GH]);
 assert.equal(result.diagnostic.ats_verification_leads,1);
 assert.equal(publicMainlandAtsVerificationLeads([{results:searchRows}]).length,1);
});
test('only independently scored Mainland ATS JD becomes visible and is safe for match history',async()=>{
 let fetches=0;
 const date=new Date().toISOString();
 const env={HHBA_MATCH_JD_ENRICH_ENABLED:'1'};
 const review=await createMatchJdReview(env,'真实经历已脱敏',{
  limit:10,exclude:new Set(),compareEvidence:async()=>({score:86})
 },{
  ready:async()=>true,
  enrich:async(_env,[candidate],resume,options)=>{
   assert.equal(resume,'真实经历已脱敏');
   assert.equal(options.resolvePostingIdentity,true);
   fetches++;
   return {matches:[{...candidate,company:'hhbaexample',title:'区域督导',
    location:'上海',match_score:86,reference_score:86,
    score_basis:'简历实际门店管理经历与官方岗位中督导职责吻合，尚需核实招聘资格。',
    jd_source_status:'VERIFIED_JD',jd_proof_method:'PUBLIC_EMPLOYER_ATS_V1',
    jd_checked_at:date,jd_version_id:'jd_'+'a'.repeat(32),jd_sha256:'b'.repeat(64)}],
    diagnostic:{closed:0}};
  }
 });
 review.add([],[],[GH,GH,BOARD]);
 const result=await review.finish([]);
 assert.equal(fetches,1,'a canonical ATS posting is verified at most once');
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,GH);
 assert.equal(result.matches[0].jd_source_status,'VERIFIED_JD');
 assert.equal(safeHistoryJobs(result.matches).length,1);
 const fake={...result.matches[0],jd_source_status:undefined};
 assert.equal(safeHistoryJobs([fake]).length,0,
  'an unsigned Search-only ATS link must never be persisted as official JD');
});
test('failed ATS JD verification cannot show a candidate, infer a Mainland role or invent a match score',async()=>{
 const review=await createMatchJdReview({HHBA_MATCH_JD_ENRICH_ENABLED:'1'},'脱敏简历',{
  limit:10,exclude:new Set(),compareEvidence:async()=>null
 },{
  ready:async()=>true,
  enrich:async(_env,[candidate])=>({matches:[candidate],diagnostic:{closed:0,failed:1}})
 });
 review.add([],[],[GH]);
 const result=await review.finish([]);
 assert.deepEqual(result.matches,[]);
 assert.equal(result.diagnostic.verified,0);
 assert.equal(result.diagnostic.failed,1);
});
