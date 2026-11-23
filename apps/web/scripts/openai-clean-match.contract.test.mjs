import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCleanMatchProvider,openAIJson,openAISearch,openAIFetchOfficial,
 officialHtmlText,checkOpenAIMatchProvider} from '../functions/_lib/openai-match-adapter.js';
import {runCleanJobMatch} from '../functions/_lib/clean-match-v2.js';
import {recognizeMatchResume} from '../functions/_lib/resume-jd-match-agent.js';
import {onRequest} from '../functions/api/match-next/[[path]].js';

const URL='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const fakeJob='<h1>腾讯社会招聘</h1><p>招聘单位：腾讯</p>'+
 '<p>职位名称：销售运营主管</p><p>工作地点：上海</p>'+
 '<p>岗位职责：负责渠道运营和销售数据复盘工作</p>'+
 '<p>任职要求：具有销售数据分析经验和跨团队协作能力</p>'+
 '<p>岗位说明：本职位围绕销售渠道数据、业务过程和团队协作开展运营分析，负责日常数据复核、跨部门沟通、执行跟踪及业务流程持续优化，要求能基于真实数据提供可检查的改进建议。</p>';
const provider={name:'openai',model:'gpt-6-sol',key:'TEST_OPENAI_KEY_NOT_REAL_987654321'};
const modelResult=json=>Response.json({status:'completed',output:[
 {type:'message',content:[{type:'output_text',text:JSON.stringify(json)}]}]});
const searchResult=(sources,extras={})=>Response.json({status:'completed',output:[
 {type:'web_search_call',status:'completed',action:{sources}},
 {type:'message',content:[{type:'output_text',
 text:extras.text||'仅使用网页搜索来源',annotations:extras.annotations||[]}]}]});
const goodSource={url:URL,title:'腾讯社会招聘 销售运营主管'};
const fixtureFetcher=async (url,init={})=>{
 if(url===URL)return new Response(fakeJob,{status:200,headers:{'content-type':'text/html'}});
 if(url!=='https://api.openai.com/v1/responses')
  throw Error('Unexpected request: '+url);
 const payload=JSON.parse(init.body);
 if(payload.tools)return searchResult([goodSource,
  {url:'https://www.zhipin.com/job_detail/aabb',title:'第三方平台'}]);
 const text=JSON.stringify(payload.input||'');
 if(text.includes('resume_facts'))return modelResult({jobs:[{id:'p1',score:81,
  reason:'简历在渠道运营与销售数据分析方面与这项岗位有真实交集，但是缺少跨团队协作的详细佐证。',
  score_basis:'简历已包含渠道运营及业务数据复盘职责，可直接对应岗位部分职责。',
  alignments:[{jd_quote:'负责渠道运营和销售数据复盘工作',resume_fact_id:'CV-1'}],
  gaps:[{jd_quote:'具有销售数据分析经验和跨团队协作能力'}]}]});
 if(text.includes('待分析的数据')||text.includes('resume'))return modelResult({
  facts:[{kind:'work',quote:'负责汽车区域门店运营监督、渠道培训及销售漏斗复盘'}],
  skills:[{name:'渠道培训',evidence:'负责汽车区域门店运营监督、渠道培训及销售漏斗复盘'}],
  target_roles:['区域督导'],education:null,education_evidence:null,
  experience_years:null,experience_evidence:null});
 return modelResult({queries:[],ok:true});
};

test('provider defaults to OpenAI when the Cloudflare key is configured, DeepSeek fallback is opt-in compatible',()=>{
 const selected=selectCleanMatchProvider({HHBA_MATCH_OPENAI_API_KEY:provider.key,
  HHBA_MATCH_DEEPSEEK_KEY:'TEST_DEEPSEEK_KEY_NOT_REAL_98765'});
 assert.equal(selected.name,'openai');
 assert.equal(selected.model,'gpt-6-sol');
 assert.equal(selectCleanMatchProvider({HHBA_MATCH_DEEPSEEK_KEY:'TEST_DEEPSEEK_KEY_NOT_REAL_98765'}).name,'deepseek');
 assert.equal(selectCleanMatchProvider({HHBA_MATCH_AI_PROVIDER:'openai',HHBA_MATCH_DEEPSEEK_KEY:'TEST_DEEPSEEK_KEY_NOT_REAL_98765'}),null);
 assert.equal(selectCleanMatchProvider({HHBA_MATCH_OPENAI_API_KEY:'x'}),null);
});

test('OpenAI Responses calls only the official API, with store:false and server-side key',async()=>{
 let outbound;
 const result=await openAIJson(async(url,init)=>{
  outbound={url,init};return modelResult({ok:true});
 },provider,'仅回复JSON',{ping:true},1000);
 assert.deepEqual(result,{ok:true});
 assert.equal(outbound.url,'https://api.openai.com/v1/responses');
 assert.equal(JSON.parse(outbound.init.body).store,false);
 assert.equal(outbound.init.headers.Authorization,'Bearer '+provider.key);
});

test('grounded search ignores URLs invented by assistant output and only accepts tool sources',async()=>{
 const forged='https://careers.tencent.com/jobdesc.html?postId=unverified';
 const fake=async()=>searchResult([goodSource],{text:JSON.stringify({
  results:[{url:forged,title:'凭空编造的岗位'}]})});
 const found=await openAISearch(fake,provider,'上海运营招聘',2000);
 assert.equal(found.results.length,1);
 assert.equal(found.results[0].url,URL);
 assert.ok(!found.results.some(x=>x.url===forged));
 const noSearch=async()=>modelResult({results:[{url:forged}]});
 await assert.rejects(()=>openAISearch(noSearch,provider,'岗位',2000),
  /AI_SEARCH_RESPONSE_INVALID/);
});

test('independent source GET rejects untrusted URL/redirect and keeps employer JD text',async()=>{
 assert.match(officialHtmlText(fakeJob),/工作地点：上海/);
 assert.match(officialHtmlText(fakeJob),/岗位职责：负责渠道运营/);
 let called=false;
 await assert.rejects(()=>openAIFetchOfficial(async()=>{called=true;},'https://careers.localhost/job/123',3000),
  /AI_FETCH_URL_REJECTED/);
 assert.equal(called,false);
 const result=await openAIFetchOfficial(fixtureFetcher,URL,3000);
 assert.match(result.content,/任职要求：具有销售数据分析经验/);
 await assert.rejects(()=>openAIFetchOfficial(async()=>new Response(null,{status:302}),URL,3000),
  /AI_FETCH_HTTP_ERROR/);
});

test('complete OpenAI evidence pipeline uses search source, actually reads JD and grounds scoring',async()=>{
 const profile={facts:[{id:'CV-1',kind:'work',
  quote:'负责汽车区域门店运营监督、渠道培训及销售漏斗复盘'}],
  skills:[{name:'渠道培训'}],target_roles:['区域督导']};
 const found=await runCleanJobMatch(provider,
  '意向城市：上海\n负责汽车区域门店运营监督、渠道培训及销售漏斗复盘',
  profile,'区域督导',1,{}, {fetcher:fixtureFetcher});
 assert.equal(found.matches.length,1);
 assert.equal(found.matches[0].official_url,URL);
 assert.equal(found.matches[0].location,'上海');
 assert.equal(found.matches[0].match_score,81);
 assert.equal(found.matches[0].platform,'openai-web-search');
 assert.equal(found.diagnostic.provider,'openai');
 assert.ok(found.diagnostic.page_reads>=1);
 assert.ok(found.matches[0].matched[0].includes('简历原文'));
});

test('OpenAI profile recognition validates source quote and does not run speculative backup',async()=>{
 const resume='负责汽车区域门店运营监督、渠道培训及销售漏斗复盘\n意向城市：上海';
 let calls=0;
 const parsed=await recognizeMatchResume(provider,resume,'区域督导',{
  fetcher:async (...args)=>{calls++;return fixtureFetcher(...args)}
 });
 assert.equal(calls,1);
 assert.equal(parsed.facts[0].quote,'负责汽车区域门店运营监督、渠道培训及销售漏斗复盘');
});

test('OpenAI readiness checks actual JSON and web_search, never returns a fake balance proof',async()=>{
 const testFetcher=async (url,init)=>{
  const body=JSON.parse(init.body);
  return body.tools?searchResult([goodSource]):modelResult({ok:true});
 };
 const checked=await checkOpenAIMatchProvider(provider,{fetcher:testFetcher});
 assert.equal(checked.status,'READY');
 assert.deepEqual(checked.capabilities,['openai_responses_json','openai_web_search']);
});

test('match status reveals selected provider without leaking server API credentials',async()=>{
 const env={HHBA_MATCH_SERVICE_ENABLED:'1',HHBA_MATCH_OPENAI_API_KEY:provider.key,
  HHBA_MATCH_CLEAN_V2_ENABLED:'0',HHBA_PNVS_AUTH_DB:{prepare(){}}};
 const response=await onRequest({request:new Request('https://hhba.work/api/match-next/status'),env});
 const result=await response.json();
 assert.equal(result.provider,'openai');
 assert.equal(result.enabled,false);
 assert.ok(!JSON.stringify(result).includes(provider.key));
});
