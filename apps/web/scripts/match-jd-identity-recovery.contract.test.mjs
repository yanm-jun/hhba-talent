import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatchJdReview} from '../functions/_lib/match-jd-review.js';

const url='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';

test('generic and stale Search identities are replaced by the independently verified employer JD',async()=>{
 let reviewed=0;
 const matches=[];
 const review=await createMatchJdReview({HHBA_MATCH_JD_ENRICH_ENABLED:'1'},'脱敏简历',
  {signal:new AbortController().signal,limit:10,exclude:new Set(),compareEvidence:async()=>({score:84}),
   onUpdate:jobs=>matches.push(jobs)},{
   ready:async()=>true,
   enrich:async(_env,[source],_resume,opts)=>{
    reviewed++;
    assert.equal(opts.resolvePostingIdentity,true);
    assert.equal(source.official_url,url);
    return {matches:[{...source,company:'腾讯',title:'销售运营主管',location:'上海',
     jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',match_score:84,
     recommendation_reason:'JD 证明该岗位与简历中真实渠道销售经验相关。',
     jd_version_id:'jd_'+'a'.repeat(32),jd_sha256:'f'.repeat(64)}],
     diagnostic:{closed:0}};
   }
  });
 review.add([{id:'search-j1',company:'错误的公司名称',title:'职位详情',location:'北京',official_url:url}],[],[url]);
 const result=await review.finish([]);
 assert.equal(reviewed,1,'same canonical job detail verified once');
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].company,'腾讯');
 assert.equal(result.matches[0].title,'销售运营主管');
 assert.equal(result.matches[0].location,'上海');
 assert.equal(result.matches[0].match_score,84);
 assert.equal(result.diagnostic.scored,1);
 assert.ok(matches.some(x=>x.some(y=>y.jd_source_status==='VERIFIED_JD')));
});
test('a third-party job-board URL cannot be promoted into a verified employer JD',async()=>{
 let called=0;
 const review=await createMatchJdReview({HHBA_MATCH_JD_ENRICH_ENABLED:'1'},'脱敏简历',{
  limit:10,exclude:new Set(),compareEvidence:async()=>null
 },{
  ready:async()=>true,
  enrich:async()=>{called++;throw Error('must not fetch third-party board')}}
 );
 review.add([{official_url:'https://www.zhipin.com/job_detail/1234',title:'汽车督导'}]);
 const result=await review.finish([]);
 assert.equal(called,0);
 assert.deepEqual(result.matches,[]);
});
