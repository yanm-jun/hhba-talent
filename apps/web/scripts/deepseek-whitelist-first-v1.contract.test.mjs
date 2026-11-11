import test from 'node:test';
import assert from 'node:assert/strict';
import {
 WHITE_SEARCH_VERSION,normalizeReviewedSource,whitelistJobSource,onlyWhitelistHits,
 whitelistSearchQueries,deepseekWhitelistTargets,getReviewedDeepSeekSearchScope
} from '../functions/_lib/deepseek-reviewed-scope-v1.js';
import {runSearchFirstMatch} from '../functions/_lib/deepseek-search-match.js';

const now=new Date('2026-11-11T08:00:00.000Z');
const reviewed=(overrides={})=>({
 id:'huawei-2026',display_name:'华为',legal_subject:null,
 official_company_url:'https://www.huawei.com/',
 recruitment_base_url:'https://career.huawei.com/',
 ownership_evidence_url:'https://www.huawei.com/cn/contact-us',
 reviewer:'hhba-editorial-reviewed',
 review_status:'VERIFIED',reviewed_at:'2026-11-11T07:00:00.000Z',
 expires_at:'2027-02-10T07:00:00.000Z',
 industry_tags_json:'["semiconductors","software-internet"]',
 business_tags_json:'["hardware-rd"]',...overrides
});
const norm=(row=reviewed())=>normalizeReviewedSource(row,{now});

test('reviewed, time-valid official employer recruitment is search scope (not open jobs)',()=>{
 const s=norm();
 assert.equal(s.display_name,'华为');
 assert.equal(s.career_host,'career.huawei.com');
 assert.equal(s.recruitment_prefix,'/');
 assert.equal(s.shared_ats,false);
 assert.equal(WHITE_SEARCH_VERSION,'HHBA_DEEPSEEK_OFFICIAL_SCOPE_S4');
});
test('PENDING, expired, fake reviewer, unrelated proof, recruitment boards and outside hosts rejected',()=>{
 const mods=[
  {review_status:'PENDING'},{review_status:'SUSPENDED'},
  {expires_at:'2026-11-10T07:00:00.000Z'},
  {reviewer:''},{ownership_evidence_url:'https://attacker.net/claims'},
  {recruitment_base_url:'https://www.zhipin.com/job_detail/123'},
  {recruitment_base_url:'https://careers.attacker.net/jobs/123'}
 ];
 for(const mod of mods)assert.equal(norm(reviewed(mod)),null,JSON.stringify(mod));
});
test('shared ATS requires corporate proof AND specific tenant prefix',()=>{
 const base=reviewed({id:'acme',display_name:'Acme科技',
  official_company_url:'https://www.acme-global.com/',
  ownership_evidence_url:'https://www.acme-global.com/careers',
  recruitment_base_url:'https://jobs.lever.co/acme'});
 const s=norm(base);
 assert.equal(s.shared_ats,true);
 assert.equal(whitelistJobSource('https://jobs.lever.co/acme/1234',[s])?.id,'acme');
 assert.equal(whitelistJobSource('https://jobs.lever.co/acme-evil/1234',[s]),null);
 assert.equal(whitelistJobSource('https://jobs.lever.co/another/1234',[s]),null);
 assert.equal(whitelistJobSource('https://jobs.lever.co/acme/1234?token=abc',[s])?.id,'acme');
 assert.equal(norm({...base,recruitment_base_url:'https://jobs.lever.co/'}),null);
 assert.equal(norm({...base,ownership_evidence_url:'https://jobs.lever.co/acme'}),null);
});
test('only reviewed employer URLs survive scope filter even if DeepSeek Search returned others',()=>{
 const s=norm();
 const jobs=onlyWhitelistHits([
  {url:'https://career.huawei.com/cn/job-details?advertisementId=777'},
  {url:'https://careers.other-company.com/jobs/777'},
  {url:'https://www.51job.com/job/888'}
 ],[s]);
 assert.equal(jobs.length,1);
 assert.ok(jobs[0].url.includes('huawei'));
});
test('Search query prioritizes company name plus site domain, no third-party boards',()=>{
 const q=whitelistSearchQueries('数据分析师 招聘 职位 工作地点 中国大陆 企业官网',[
  norm(),norm(reviewed({id:'tencent',display_name:'腾讯',
   official_company_url:'https://www.tencent.com/',
   ownership_evidence_url:'https://www.tencent.com/zh-cn/',
   recruitment_base_url:'https://careers.tencent.com/'}))
 ]);
 assert.equal(q.length,2);
 assert.ok(q[0].includes('site:career.huawei.com'));
 assert.ok(q[1].includes('site:careers.tencent.com'));
 assert.ok(q.every(x=>x.length<=128&&!x.includes('zhipin')));
});
test('no whitelist when flag is absent, env not Preview or table unavailable',async()=>{
 const db={prepare(){return {bind(){return {async all(){return {results:[reviewed()]}}}}}}};
 assert.deepEqual(await getReviewedDeepSeekSearchScope({HHBA_PNVS_AUTH_DB:db}),[]);
 assert.deepEqual(await getReviewedDeepSeekSearchScope({
  HHBA_PNVS_AUTH_DB:db,HHBA_DEEPSEEK_WHITELIST_SEARCH_ENABLED:'1'}),[]);
 const got=await getReviewedDeepSeekSearchScope({
  HHBA_PNVS_AUTH_DB:db,HHBA_AUTH_ROLLOUT:'preview',HHBA_DEEPSEEK_WHITELIST_SEARCH_ENABLED:'1'
 },{now});
 assert.equal(got.length,1);
 assert.equal(got[0].id,'huawei-2026');
});
test('DeepSeek selects employer targets from reviewed pool, not HHBA scoring',async()=>{
 const sources=Array.from({length:5},(_,i)=>norm(reviewed({id:'company'+i,display_name:'某企业'+i})));
 const observed=[];
 const result=await deepseekWhitelistTargets('valid-key-1234567','已脱敏的求职简历，软件与产品工作经历','产品运营',sources,{
  fetcher:async (url,opts)=>{
   observed.push({url,body:JSON.parse(opts.body)});
   return {ok:true,async json(){return {output:[{type:'message',content:[
    {type:'output_text',text:JSON.stringify({ids:['company4','company1','invented']})}
   ]}]}}};
  }
 });
 assert.deepEqual(result.map(x=>x.id),['company4','company1']);
 assert.equal(observed.length,1);
 assert.equal(observed[0].url,'https://api.deepseek.com/responses');
 assert.ok(!JSON.stringify(observed).includes('zhipin.com'));
});

function sse(data){
 const payload={type:'response.completed',response:{status:'completed',
  output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]}};
 return new Response('data: '+JSON.stringify(payload)+'\n\n',{
  headers:{'content-type':'text/event-stream'}});
}
const wUrl='https://career.huawei.com/cn/job-details?advertisementId=87654';
const bUrl='https://careers.other-company.com/jobs/456';
const wHit={url:wUrl,title:'华为 数据分析师 招聘',summary:'工作地点上海，职责是数据分析、SQL 和业务增长分析，2027年招聘。'};
const bHit={url:bUrl,title:'云杉科技 市场运营 招聘',summary:'工作地点北京，市场活动策划、数据分析、增长运营，2027年招聘。'};
const thirdParty={url:'https://www.zhipin.com/job_detail/888',title:'岗位招聘',summary:'工作地点上海'};
const modelJob=(id,company,title,location,score)=>({
 id,company,title,location,match_score:score,
 score_basis:'公开的岗位职责与简历经历在数据分析和跨团队协作上存在具体交集，需要核查职位最新资格。',
 reason:'根据求职者此前的分析与协作经历，这个公开岗位存在能力对应关系，仍需核对最新要求。',
 job_basis:'公开招聘信息的工作职责包括分析与沟通'
});
const mockRun=({includeWide=true,firstScore=72}={})=>{
 const calls=[],responses=[];
 const fetcher=async (url,opts)=>{
  const body=JSON.parse(opts.body);
  calls.push({url,body});
  if(url.endsWith('/v1/tools/search')){
   if(body.query.includes('site:career.huawei.com'))
    return {ok:true,async json(){return {results:[wHit]}}};
   return {ok:true,async json(){return {results:includeWide?[bHit,thirdParty]:[]}}};
  }
  if(url.endsWith('/v1/tools/fetch'))return {ok:true,async json(){return {
   content:'岗位职责：工作地点上海或北京。负责数据分析和团队协作；任职要求：熟悉Excel和SQL。招聘职位详情以官方招聘页面为准。'
  }}};
  if(url.endsWith('/responses')){
   const jobs=responses.length===0?
    [modelJob('j1','华为','数据分析师','上海',firstScore)]:
    [modelJob('j1','华为','数据分析师','上海',83),
     modelJob('j2','云杉科技','市场运营','北京',80)];
   responses.push(jobs);
   return sse({jobs});
  }
  throw Error('unexpected '+url);
 };
 return {calls,responses,fetcher};
};
test('whitelist FIRST DeepSeek Search then global Search then DeepSeek unified ranking',async()=>{
 const m=mockRun();
 const result=await runSearchFirstMatch('test-key','熟悉Excel SQL 数据分析和市场运营项目。',
  '数据分析师',2,{reviewedWhitelist:[norm()],fetcher:m.fetcher,
   expandDetailed:false,supplementalLimit:0});
 const searches=m.calls.filter(x=>x.url.endsWith('/v1/tools/search'));
 assert.ok(searches.length>=2);
 assert.ok(searches[0].body.query.includes('site:career.huawei.com'));
 assert.ok(searches.some(x=>!x.body.query.includes('site:')));
 assert.equal(m.responses.length,2);
 assert.equal(result.matches.length,2);
 assert.equal(result.diagnostic.deepseek_whitelist_phase,true);
 assert.ok(result.diagnostic.deepseek_global_expansion_queries>=1);
 assert.ok(result.matches.every(x=>!x.official_url.includes('zhipin')));
});
test('no trusted source => DeepSeek global search, never local DB matching',async()=>{
 const m=mockRun();
 const result=await runSearchFirstMatch('test-key','熟悉Excel SQL 数据分析和市场运营项目。',
  '市场运营',1,{reviewedWhitelist:[],fetcher:m.fetcher,
   expandDetailed:false,supplementalLimit:0});
 assert.equal(result.diagnostic.deepseek_whitelist_phase,false);
 assert.ok(m.calls.some(x=>x.url.endsWith('/v1/tools/search')));
});
