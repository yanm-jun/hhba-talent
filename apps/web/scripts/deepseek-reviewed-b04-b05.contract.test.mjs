import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReviewedSource,
  whitelistJobSource,
  getReviewedDeepSeekSearchScope
} from '../functions/_lib/deepseek-reviewed-scope-v1.js';

const now=new Date('2026-11-11T09:00:00.000Z');
const USER='hhba-user-confirmed-official-20261111';
const CORP='hhba-corporate-backlink-review-20261111';
const make=(overrides={})=>({
  id:'hhba-official-test-20261111',
  display_name:'科大讯飞',
  official_company_url:'https://www.iflytek.com/',
  recruitment_base_url:'https://iflytek.zhiye.com/',
  ownership_evidence_url:'https://iflytek.zhiye.com/campus/jobs',
  reviewer:USER,
  reviewed_at:'2026-11-11T08:59:00.000Z',
  expires_at:'2027-02-07T00:00:00.000Z',
  review_status:'VERIFIED',
  industry_tags_json:'["人工智能"]',
  business_tags_json:'["智能语音","大模型"]',
  ...overrides
});

test('B04 verified recruiter ATS: exact enterprise tenant and its own jobs only',()=>{
  const source=normalizeReviewedSource(make(),{now});
  assert.ok(source);
  assert.equal(source.display_name,'科大讯飞');
  assert.ok(whitelistJobSource('https://iflytek.zhiye.com/campus/jobs', [source]));
  assert.equal(whitelistJobSource('https://random.zhiye.com/campus/jobs', [source]),null);
  assert.equal(whitelistJobSource('https://www.zhaopin.com/jobs/123', [source]),null);
});

test('B04 prevents user-confirmed generic board / forged source trust',()=>{
  assert.equal(normalizeReviewedSource(make({recruitment_base_url:'https://www.zhaopin.com/',ownership_evidence_url:'https://www.zhaopin.com/'}),{now}),null);
  assert.equal(normalizeReviewedSource(make({reviewer:'unreviewed-web-search'}),{now}),null);
  assert.equal(normalizeReviewedSource(make({review_status:'PENDING'}),{now}),null);
});

test('B04 exact 51job sub-board scope cannot escape to another event',()=>{
  const source=normalizeReviewedSource(make({
    display_name:'广汽集团',official_company_url:'https://www.gac.com.cn/',
    recruitment_base_url:'https://xyzp.51job.com/gacgroup2027/',
    ownership_evidence_url:'https://xyzp.51job.com/gacgroup2027/'
  }),{now});
  assert.ok(source);
  assert.ok(whitelistJobSource('https://xyzp.51job.com/gacgroup2027/jobs', [source]));
  assert.equal(whitelistJobSource('https://xyzp.51job.com/othercompany/jobs', [source]),null);
});

test('B04 Hotjob employer SU tenant includes exact-position pages but excludes adjacent tenants',()=>{
  const source=normalizeReviewedSource(make({
    display_name:'立讯精密',
    official_company_url:'https://www.luxshare-ict.com/',
    recruitment_base_url:'https://wecruit.hotjob.cn/SU601778b25d83dc072073230a/pb/school.html',
    ownership_evidence_url:'https://wecruit.hotjob.cn/SU601778b25d83dc072073230a/pb/school.html',
    reviewer:USER
  }),{now});
  assert.ok(source);
  assert.equal(source.recruitment_prefix,'/SU601778b25d83dc072073230a/pb/');
  assert.ok(whitelistJobSource('https://wecruit.hotjob.cn/SU601778b25d83dc072073230a/pb/posDetail.html?postId=6aa26eea5e0f494d82a70f3f&postType=campus',[source]));
  assert.equal(whitelistJobSource('https://wecruit.hotjob.cn/SU601778b25d83dc072073230b/pb/posDetail.html?postId=777',[source]),null);
});

test('B04 group corporate notices accepted without pretending current opening',()=>{
  const source=normalizeReviewedSource(make({
    display_name:'中国建筑集团',
    official_company_url:'https://www.cscec.com/',
    recruitment_base_url:'https://www.cscec.com/rlzy_new/rczp/',
    ownership_evidence_url:'https://www.cscec.com/rlzy_new/rczp/',
    reviewer:'hhba-b04-firstparty-evidence-20261111'
  }),{now});
  assert.ok(source);
  assert.equal(source.display_name,'中国建筑集团');
  assert.equal(whitelistJobSource('https://www.cscec.com/other/',[source]),null);
});

test('B05 Chery first-party backlink and exact Kuaishou corporate chain',()=>{
  const chery=normalizeReviewedSource(make({
    display_name:'奇瑞汽车',official_company_url:'https://www.chery.cn/',
    recruitment_base_url:'https://chery.zhiye.com/',
    ownership_evidence_url:'https://www.chery.cn/homepage',reviewer:CORP
  }),{now});
  assert.ok(chery);
  const kuaishou=normalizeReviewedSource(make({
    display_name:'快手',official_company_url:'https://www.kuaishou.com/',
    recruitment_base_url:'https://zhaopin.kuaishou.cn/',
    ownership_evidence_url:'https://www.kuaishou.com/cn',
    reviewer:'hhba-corporate-crossdomain-review-20261111'
  }),{now});
  assert.ok(kuaishou);
  assert.equal(normalizeReviewedSource(make({display_name:'其他平台',
    official_company_url:'https://www.random.com/',
    recruitment_base_url:'https://zhaopin.kuaishou.cn/',
    ownership_evidence_url:'https://www.random.com/cn',
    reviewer:'hhba-corporate-crossdomain-review-20261111'}),{now}),null);
});

test('B05 whitelist reader supports 100+ reviewed sources instead of truncating at 48',async()=>{
  const rows=Array.from({length:90},(_,i)=>make({id:'hhba-source-'+String(i).padStart(3,'0')}));
  let boundLimit=0;
  const env={
    HHBA_DEEPSEEK_WHITELIST_SEARCH_ENABLED:'1',
    HHBA_AUTH_ROLLOUT:'preview',
    HHBA_PNVS_AUTH_DB:{
      prepare:()=>({bind:(_time,limit)=>{
        boundLimit=limit;
        return {all:async()=>({results:rows})};
      }})
    }
  };
  const result=await getReviewedDeepSeekSearchScope(env,{now,limit:120});
  assert.equal(boundLimit,120);
  assert.equal(result.length,90);
});
