import test from 'node:test';
import assert from 'node:assert/strict';
import {openAIResponse,openAIJson,openAIEmployerSearch,
 openAISearchSources,readOfficialEmployerPage,safePublicEmployerUrl}
 from '../functions/_lib/openai-match-v2-provider.js';
import {runCleanJobMatch} from '../functions/_lib/clean-match-v2.js';
import {recognizeMatchResume} from '../functions/_lib/resume-jd-match-openai-v2.js';

const JD_URL='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const SECRET='synthetic-not-a-real-token';
const CV='负责区域门店督导、汽车渠道培训及销售数据复盘';
const JD=[
 '腾讯招聘','公司名称：腾讯','职位名称：渠道运营专员','工作地点：上海',
 '岗位职责：负责渠道运营和销售数据复盘工作',
 '任职要求：具有销售数据分析经验和跨团队协作能力',
 '薪酬以企业官方岗位公告为准。',
 '工作说明：该职位需要跨团队配合，定期整理客户运营数据，复盘转化指标并向渠道管理团队汇报实际工作进展。'
].join('\n');
const json=value=>Response.json({status:'completed',output:[
 {type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}
]});
const search=urls=>Response.json({status:'completed',output:[
 {type:'web_search_call',status:'completed',action:{type:'search',
  sources:urls.map(url=>({url,title:'腾讯 渠道运营专员 官方招聘'}))}}
]});
function syntheticFetch(calls){
 return async(raw,opts)=>{
  const url=new URL(raw);calls.push({url:raw,opts});
  if(url.origin==='https://api.openai.com'&&url.pathname==='/v1/responses'){
   const body=JSON.parse(opts.body);
   if(body.tools?.some(t=>t.type==='web_search'))return search([JD_URL]);
   if(body.instructions?.includes('简历识别 Agent'))
    return json({facts:[{kind:'work',quote:CV}],skills:[{name:'渠道运营',evidence:CV}],
     target_roles:['渠道运营'],education:null,education_evidence:null,
     experience_years:null,experience_evidence:null});
   if(body.instructions?.includes('检索策略')||body.instructions?.includes('第二轮'))
    return json({queries:[]});
   if(body.instructions?.includes('求职匹配分析师'))
    return json({jobs:[{id:'p1',score:79,alignments:[{jd_quote:'负责渠道运营和销售数据复盘工作',resume_fact_id:'CV-1'}],gaps:[],
      reason:'简历包含区域门店督导、渠道培训和数据复盘的可核对经历，岗位职责涉及渠道运营与销售数据复盘，具备可验证的相关经验。',
      score_basis:'简历渠道培训及销售复盘能力与本岗位原文对应，但其余专业任职要求仍待核验。'}]});
   if(body.instructions?.includes('提取真实公司'))return json({jobs:[]});
   if(body.instructions?.includes('仅输出 JSON'))return json({ok:true});
   throw Error('unexpected model prompt');
  }
  if(raw===JD_URL)return new Response(JD,{headers:{'Content-Type':'text/plain'}});
  throw Error('cannot read other destinations');
 };
}
test('Responses transport is pinned to official OpenAI and sends store:false',async()=>{
 const calls=[];
 const out=await openAIJson(syntheticFetch(calls),{key:SECRET,model:'gpt-6.2-astra'},
  '仅输出 JSON',{'task':'test'});
 assert.deepEqual(typeof out,'object');
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.openai.com/v1/responses');
 const opts=calls[0].opts,body=JSON.parse(opts.body);
 assert.equal(body.store,false);
 assert.equal(opts.redirect,'manual');
 assert.equal(opts.headers.Authorization,'Bearer '+SECRET);
});
test('Search trusts only completed OpenAI tool sources, not model text listing URLs',async()=>{
 const hallucinated=JSON.stringify({urls:[JD_URL]});
 assert.deepEqual(openAISearchSources({status:'completed',output:[
  {type:'message',content:[{type:'output_text',text:hallucinated}]}
 ]}),[]);
 const calls=[];
 const result=await openAIEmployerSearch(syntheticFetch(calls),SECRET,'渠道运营 上海',null);
 assert.equal(result.results.length,1);
 assert.equal(result.results[0].url,JD_URL);
 const body=JSON.parse(calls[0].opts.body);
 assert.equal(body.tool_choice,'required');
 assert.ok(body.tools.some(x=>x.type==='web_search'));
 assert.ok(!JSON.stringify(body).includes(CV));
});
test('Employer-only reader blocks private networks and will not forward OpenAI token',async()=>{
 for(const u of [
  'http://careers.tencent.com/jobdesc.html?postId=1',
  'https://127.0.0.1/jobs/detail/123','https://localhost/job/1',
  'https://169.254.169.254/job/1','https://foo.nip.io/job/1',
  'https://user:pass@careers.tencent.com/jobs/detail/1'
 ])assert.equal(safePublicEmployerUrl(u),false,u);
 const calls=[];
 const page=await readOfficialEmployerPage(syntheticFetch(calls),JD_URL,null);
 assert.match(page.content,/工作地点：上海/);
 assert.equal(calls[0].opts.method,'GET');
 assert.equal(calls[0].opts.redirect,'manual');
 assert.ok(!JSON.stringify(calls[0].opts).includes(SECRET));
});
test('V2 from résumé evidence to actual employer JD does not call a DeepSeek endpoint',async()=>{
 const calls=[],fetcher=syntheticFetch(calls);
 const provider={key:SECRET,model:'gpt-6.2-astra'};
 const profile=await recognizeMatchResume(provider,
  '工作经历：'+CV+'\n求职意向城市：上海','渠道运营',
  {fetcher,fallbackDelayMs:60000});
 assert.equal(profile.facts[0].quote,CV);
 const result=await runCleanJobMatch(provider,'工作经历：'+CV+'\n求职意向城市：上海',
  profile,'渠道运营',10,{},{fetcher});
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,JD_URL);
 assert.equal(result.matches[0].location,'上海');
 assert.equal(result.matches[0].match_score,79);
 assert.ok(calls.some(x=>x.url===JD_URL),'must read a real employer JD_URL');
 assert.ok(calls.filter(x=>x.url!==JD_URL).every(x=>x.url==='https://api.openai.com/v1/responses'));
 assert.ok(calls.filter(x=>x.url===JD_URL).every(x=>!x.opts.headers.Authorization));
 assert.ok(calls.some(x=>JSON.stringify(x.opts.body||'').includes(CV)));
 assert.ok(calls.filter(x=>x.opts.body?.includes('web_search')).every(x=>
  !x.opts.body.includes(CV)),'public web search cannot receive private résumé');
});
test('upstream model key rejection is an explicit error, never a fabricated recommendation',async()=>{
 await assert.rejects(openAIResponse(async()=>new Response('denied',{status:401}),SECRET,{input:'hi'}),
  e=>e.code==='AI_PROVIDER_KEY_REJECTED');
});

test('approved HTTPS relay is configured server-side, retains model, and only trusts tool citations',async()=>{
 const calls=[];
 const provider={key:'synthetic-relay-key',model:'gpt-6.2-sol',baseUrl:'https://api-c.reqtoken.com/v1'};
 const mock=async(url,opts)=>{
  calls.push({url,opts});
  const body=JSON.parse(opts.body);
  assert.equal(body.model,'gpt-6.2-sol');
  assert.equal(body.store,false);
  assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.Authorization,'Bearer synthetic-relay-key');
  if(body.tools?.some(t=>t.type==='web_search'))return search([JD_URL]);
  return json({ok:true});
 };
 const parsed=await openAIJson(mock,provider,'仅输出 JSON',{task:'test'});
 assert.equal(parsed.ok,true);
 const sources=await openAIEmployerSearch(mock,provider,'渠道运营 上海',null);
 assert.equal(sources.results[0]?.url,JD_URL);
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.url==='https://api-c.reqtoken.com/v1/responses'));
 assert.ok(!JSON.stringify(calls[1].opts.body).includes(CV));
});
test('provider refuses unapproved origins, scheme changes, query-string credential leaks, and redirects',async()=>{
 const bad=[
  'http://api-c.reqtoken.com/v1','https://api-c.reqtoken.com/v1?pass=1',
  'https://api-c.reqtoken.com/v1/','https://api-c.reqtoken.com.evil.example/v1',
  'https://api.openai.com@evil.example/v1','https://127.0.0.1/v1',
  'https://api.deepseek.com/v1'
 ];
 for(const baseUrl of bad){
  let called=false;
  await assert.rejects(openAIResponse(async()=>{called=true;return json({ok:true})},
   {key:SECRET,model:'gpt-6.2-sol',baseUrl},{input:'public'}),e=>e.code==='AI_PROVIDER_ENDPOINT_NOT_APPROVED');
  assert.equal(called,false,'invalid base URL must never receive API credentials');
 }
 await assert.rejects(openAIResponse(async()=>new Response(null,{status:302,headers:{Location:'https://evil.example'}}),
  {key:SECRET,model:'gpt-6.2-sol',baseUrl:'https://api-c.reqtoken.com/v1'},{input:'public'}),
  e=>e.code==='AI_PROVIDER_UNEXPECTED_REDIRECT');
});
