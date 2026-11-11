import test from 'node:test';
import assert from 'node:assert/strict';
import {
 normalizeReviewedSource,whitelistJobSource,
 getReviewedDeepSeekSearchScope,deepseekWhitelistTargets
} from '../functions/_lib/deepseek-reviewed-scope-v1.js';
const now=new Date('2026-11-11T10:20:00.000Z');
const source=(overrides={})=>({
 id:'hhba-official-b06-test-20261111',
 display_name:'荣耀',
 official_company_url:'https://www.honor.com/',
 recruitment_base_url:'https://www.honor.com/cn/career/',
 ownership_evidence_url:'https://www.honor.com/cn/career/',
 reviewer:'hhba-b06-firstparty-public-career-review-20261111',
 reviewed_at:'2026-11-11T10:00:00.000Z',
 expires_at:'2027-02-07T10:00:00.000Z',
 review_status:'VERIFIED',
 industry_tags_json:'["消费电子"]',business_tags_json:'["AI终端"]',
 ...overrides
});

test('B06 first-party Honor is valid but pending or spoofed origins are never promoted',()=>{
 assert.ok(normalizeReviewedSource(source(),{now}));
 assert.equal(normalizeReviewedSource(source({review_status:'PENDING'}),{now}),null);
 assert.equal(normalizeReviewedSource(source({reviewer:''}),{now}),null);
 assert.equal(normalizeReviewedSource(source({ownership_evidence_url:'https://evil.example.com/jobs'}),{now}),null);
});

test('B06 official Yonyou jobs use the evidenced SU tenant and do not match adjacent paths',()=>{
 const s=normalizeReviewedSource(source({
  display_name:'用友网络',official_company_url:'https://www.yonyou.com/',
  recruitment_base_url:'https://career.yonyou.com/SU67ac41886202cc7916ae3029/pb/index.html',
  ownership_evidence_url:'https://career.yonyou.com/SU67ac41886202cc7916ae3029/pb/index.html'
 }),{now});
 assert.ok(s);
 assert.equal(s.recruitment_prefix,'/SU67ac41886202cc7916ae3029/pb/');
 assert.ok(whitelistJobSource('https://career.yonyou.com/SU67ac41886202cc7916ae3029/pb/posDetail.html?postId=abc',[s]));
 assert.equal(whitelistJobSource('https://career.yonyou.com/SUanother/pb/posDetail.html',[s]),null);
});

test('B06 first-party CIMC career details stay within reviewed /hr/ directory',()=>{
 const s=normalizeReviewedSource(source({
  display_name:'中集集团',official_company_url:'https://www.cimc.com/',
  recruitment_base_url:'https://www.cimc.com/hr/recruit-search2.php',
  ownership_evidence_url:'https://www.cimc.com/hr/recruit-search2.php'
 }),{now});
 assert.ok(s);
 assert.equal(s.recruitment_prefix,'/hr/');
 assert.ok(whitelistJobSource('https://www.cimc.com/hr/recruit-detail.php',[s]));
 assert.equal(whitelistJobSource('https://www.cimc.com/investor/report.pdf',[s]),null);
});

test('B06 reviewed railway company host is not equivalent to public job boards',()=>{
 const s=normalizeReviewedSource(source({
  display_name:'中国国家铁路集团',official_company_url:'https://www.china-railway.com.cn/',
  recruitment_base_url:'https://rczp.china-railway.com.cn/',
  ownership_evidence_url:'https://rczp.china-railway.com.cn/'
 }),{now});
 assert.ok(s);
 assert.equal(whitelistJobSource('https://www.zhaopin.com/job/123',[s]),null);
 assert.equal(whitelistJobSource('https://rczp.china-railway.com.cn/foo',[s])?.display_name,'中国国家铁路集团');
});

test('B06 preview reader does not silently lose sources #161–#175',async()=>{
 const items=Array.from({length:175},(_,i)=>source({id:'hhba-b06-'+String(i+1).padStart(3,'0')}));
 let boundLimit;
 const env={HHBA_DEEPSEEK_WHITELIST_SEARCH_ENABLED:'1',
  HHBA_AUTH_ROLLOUT:'preview',
  HHBA_PNVS_AUTH_DB:{prepare:()=>({bind:(_date,n)=>{boundLimit=n;return {all:async()=>({results:items})};}})}};
 const result=await getReviewedDeepSeekSearchScope(env,{now});
 assert.equal(boundLimit,256);
 assert.equal(result.length,175);
});

test('B06 Zhejiang Zheshang Bank company-domain backlink authorizes only its single exact recruitment host',()=>{
 const s=normalizeReviewedSource(source({
  display_name:'浙商银行',
  official_company_url:'https://www.czbank.com/',
  recruitment_base_url:'https://zp.czbank.com.cn/',
  ownership_evidence_url:'https://www.czbank.com/cn/',
  reviewer:'hhba-corporate-crossdomain-review-20261111'
 }),{now});
 assert.ok(s);
 assert.ok(whitelistJobSource('https://zp.czbank.com.cn/zpweb/commonController/main.mvc',[s]));
 assert.equal(whitelistJobSource('https://zp.czbank.com.cn.evil.com/fake',[s]),null);
 assert.equal(normalizeReviewedSource(source({
  display_name:'其他银行',
  official_company_url:'https://www.czbank.com/',
  recruitment_base_url:'https://zp.czbank.com.cn/',
  ownership_evidence_url:'https://www.czbank.com/cn/',
  reviewer:'hhba-corporate-crossdomain-review-20261111'
 }),{now}),null);
});

test('B06 Guosen Securities corporate-subsidiary backlink approves only Guosen ATS tenant',()=>{
 const s=normalizeReviewedSource(source({
  display_name:'国信证券',official_company_url:'https://www.guosen.com.cn/',
  recruitment_base_url:'https://guosen.zhiye.com/campus/jobs',
  ownership_evidence_url:'https://hs.guosen.com.cn/hs/contactus_job.html',
  reviewer:'hhba-corporate-backlink-review-20261111'
 }),{now});
 assert.ok(s);
 assert.ok(whitelistJobSource('https://guosen.zhiye.com/campus/jobs',[s]));
 assert.equal(whitelistJobSource('https://guosen.zhiye.com/campus/jobs2',[s]),null);
 assert.equal(whitelistJobSource('https://stranger.zhiye.com/campus/jobs',[s]),null);
});

test('B06 unreviewed recruitment tenant is refused even when branded',()=>{
 const s=normalizeReviewedSource(source({
  display_name:'传音控股',
  official_company_url:'https://www.transsion.com/',
  recruitment_base_url:'https://transsion.zhiye.com/jobs',
  ownership_evidence_url:'https://transsion.zhiye.com/jobs',
  review_status:'PENDING'
 }),{now});
 assert.equal(s,null);
});
