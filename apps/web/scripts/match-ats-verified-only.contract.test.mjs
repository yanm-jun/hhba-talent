import test from 'node:test';
import assert from 'node:assert/strict';
import {searchPublicJobs} from '../functions/_lib/deepseek-search-match.js';
import {createMatchJdReview} from '../functions/_lib/match-jd-review.js';
import {safeHistoryJobs} from '../functions/_lib/match-history.js';

const GH='https://job-boards.greenhouse.io/hhbaexample/jobs/1234567';
const LEVER='https://jobs.lever.co/hhbaexample/11111111-2222-4333-8444-555555555555';
const DOMESTIC='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const BOARD='https://www.zhipin.com/job_detail/123456';
const searchRows=[GH,LEVER,BOARD].map(url=>({
 title:'Regional Operations Specialist - Shanghai, China - Official Job',
 url,site_name:'职位信息',summary:'Shanghai, China. Responsibilities: regional operations. Qualifications: retail operations experience.'
}));

test('foreign ATS and third-party boards never enter mainland Search candidates or JD verification queue',async()=>{
 const result=await searchPublicJobs('synthetic','脱敏简历','区域督导',{
  queriesOverride:['区域督导 上海 企业招聘'],allowEmpty:true,
  fetcher:async()=>Response.json({results:searchRows})
 });
 assert.deepEqual(result.hits,[]);
 assert.deepEqual(result.ats_posting_urls,[]);
 assert.equal(result.diagnostic.ats_verification_leads,0);
 assert.equal(result.diagnostic.rejected_links,3);
});

test('even fully scored and apparently verified foreign ATS links are not presented or persisted',async()=>{
 let fetched=0;
 const date=new Date().toISOString();
 const review=await createMatchJdReview({HHBA_MATCH_JD_ENRICH_ENABLED:'1'},'脱敏简历',{
  limit:10,exclude:new Set(),compareEvidence:async()=>({score:88})
 },{
  ready:async()=>true,
  enrich:async()=>{fetched++;throw Error('foreign ATS must never be fetched')}
 });
 review.add([GH,LEVER].map((url,i)=>({
  id:'search-'+i,company:'某公司',title:'区域督导',location:'上海',
  official_url:url,match_score:88,jd_source_status:'VERIFIED_JD',
  jd_proof_method:'PUBLIC_EMPLOYER_ATS_V1'
 })),[],[GH,LEVER,BOARD]);
 const result=await review.finish([]);
 assert.equal(fetched,0);
 assert.deepEqual(result.matches,[]);
 const legacy={company:'某公司',title:'区域督导',location:'上海',
  official_url:GH,match_score:88,jd_source_status:'VERIFIED_JD',
  jd_proof_method:'PUBLIC_EMPLOYER_ATS_V1',
  jd_checked_at:date,jd_version_id:'jd_'+'a'.repeat(32),
  jd_sha256:'b'.repeat(64)};
 assert.deepEqual(safeHistoryJobs([legacy,{...legacy,official_url:LEVER}]),[]);
});

test('mainland employer official jobs continue to verify and retain a legitimate numeric score',async()=>{
 let called=0;
 const review=await createMatchJdReview({HHBA_MATCH_JD_ENRICH_ENABLED:'1'},'真实经历已脱敏',{
  limit:10,exclude:new Set(),compareEvidence:async()=>({score:86})
 },{
  ready:async()=>true,
  enrich:async(_env,[job],_resume,options)=>{
   called++;
   assert.equal(options.resolvePostingIdentity,true);
   assert.equal(job.official_url,DOMESTIC);
   return {matches:[{...job,company:'腾讯',title:'销售运营主管',
    location:'上海',match_score:86,reference_score:86,
    jd_source_status:'VERIFIED_JD',jd_proof_method:'DIRECT_EMPLOYER_HTML_V1'}],
    diagnostic:{closed:0}};
  }
 });
 review.add([],[],[DOMESTIC]);
 const result=await review.finish([]);
 assert.equal(called,1);
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,DOMESTIC);
 assert.equal(result.matches[0].match_score,86);
});
