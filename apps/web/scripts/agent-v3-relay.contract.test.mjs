import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAgentProvider,agentV3Request,agentV3Json,probeAgentV3}
 from '../functions/_lib/agent-v3-provider.js';
import {verifiedUnderstanding} from '../functions/_lib/agent-v3-understanding.js';
import {onRequest} from '../functions/api/agent-v3/[[path]].js';

const token='TEST_ONLY_NONWORKING_TOKEN_0123456789';
const config={HHBA_AGENT_PROVIDER:'relay',
 HHBA_AGENT_BASE_URL:'https://api-c.reqtoken.com/v1',
 HHBA_AGENT_RELAY_API_KEY:token,
 HHBA_AGENT_MODEL:'gpt-6.2-sol',HHBA_AGENT_REVIEW_MODEL:'gpt-6.2-sol',
 HHBA_AGENT_ACTOR_AUTH:'local-image-extension'};
const response=value=>Response.json({status:'completed',
 output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
test('explicit relay isolation never falls back to official OpenAI production secret',()=>{
 const p=resolveAgentProvider(config);
 assert.equal(p.name,'relay');
 assert.equal(p.baseUrl,'https://api-c.reqtoken.com/v1');
 assert.equal(p.reviewModel,'gpt-6.2-sol');
 assert.equal(resolveAgentProvider({...config,HHBA_AGENT_RELAY_API_KEY:undefined,
  HHBA_MATCH_OPENAI_API_KEY:token}),null);
 assert.equal(resolveAgentProvider({...config,HHBA_AGENT_BASE_URL:'https://evil.test/v1'}),null);
 assert.equal(resolveAgentProvider({...config,HHBA_AGENT_BASE_URL:'http://api-c.reqtoken.com/v1'}),null);
 assert.equal(resolveAgentProvider({...config,HHBA_AGENT_ACTOR_AUTH:'bad\nHeader'}),null);
 assert.equal(resolveAgentProvider({...config,HHBA_AGENT_PROVIDER:'openai',
  HHBA_AGENT_BASE_URL:'https://api.openai.com/v1',HHBA_AGENT_OPENAI_API_KEY:token}).name,'openai');
});
test('relay uses Responses only and forces store false; credentials stay server side',async()=>{
 const p=resolveAgentProvider(config);
 let seen={};
 const result=await agentV3Request(async(url,options)=>{
  seen={url,options};return response({ok:true});
 },p,'/responses',{payload:{instructions:'测试',input:'ok',store:true}});
 assert.equal(result.status,'completed');
 assert.equal(seen.url,'https://api-c.reqtoken.com/v1/responses');
 assert.equal(JSON.parse(seen.options.body).store,false);
 assert.equal(seen.options.headers.authorization,'Bearer '+token);
 assert.equal(seen.options.headers['x-openai-actor-authorization'],'local-image-extension');
 assert.equal(seen.options.redirect,'manual');
});
test('no redirection of bearer token to another host',async()=>{
 const p=resolveAgentProvider(config);
 await assert.rejects(()=>agentV3Request(async()=>new Response(null,{status:302,
  headers:{Location:'https://attacker.invalid'}}),p,'/responses',
  {payload:{input:'hi'}}),/AI_PROVIDER_UNEXPECTED_REDIRECT/);
});
test('json response parser is independent of client flags',async()=>{
 const parsed=await agentV3Json(async()=>response({facts:[],hello:'world'}),
  resolveAgentProvider(config),{instructions:'json',input:'hi'});
 assert.equal(parsed.hello,'world');
});
test('capability check distinguishes fake/unsupported web search from simple JSON text',async()=>{
 const fetcher=async(url,options)=>{
  if(url.endsWith('/models'))return Response.json({data:[{id:'gpt-6.2-sol'}]});
  const body=JSON.parse(options.body);
  if(body.tools)return response({ok:true});
  return response({ok:true});
 };
 const result=await probeAgentV3(fetcher,resolveAgentProvider(config));
 assert.equal(result.models,true);
 assert.equal(result.json,true);
 assert.equal(result.web_search,false);
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.errors[0].code,'AI_SEARCH_TOOL_MISSING');
});
test('real resume evidence cannot be replaced with hallucinated model claim',()=>{
 const resume='负责区域督导和线索转化改善。意向城市：上海；目标岗位：区域督导。';
 const result=verifiedUnderstanding({facts:[
  {kind:'work',quote:'负责区域督导和线索转化改善'},
  {kind:'credential',quote:'拥有英国医学博士学位'}],
  recommended_roles:['区域督导','品牌督导'],
  recommended_industries:['汽车','商贸零售'],
  preferences:{cities:['上海'],city_evidence:'意向城市：上海'},
  experience_years:3,experience_evidence:'3年工作经验'
 },resume);
 assert.equal(result.facts.length,1);
 assert.equal(result.experience_years,null);
 assert.equal(result.recommended_roles.length,2);
});
test('status does not leak relay key or mark test as passed',async()=>{
 const res=await onRequest({env:{...config,HHBA_AGENT_V3_ENABLED:'0'},
  request:new Request('https://demo.hhba-talent.pages.dev/api/agent-v3/status')});
 assert.equal(res.status,200);
 const result=await res.json();
 assert.equal(result.relay_mode,true);
 assert.equal(result.real_provider_verified,false);
 assert.equal(result.enabled,false);
 assert.ok(!JSON.stringify(result).includes(token));
});
test('preview routes stay closed by default, reject cross-origin and do not accept a real resume',async()=>{
 let request=new Request('https://demo.hhba-talent.pages.dev/api/agent-v3/analyze',{
  method:'POST',headers:{Origin:'https://demo.hhba-talent.pages.dev',
  'content-type':'application/json'},body:JSON.stringify({consent:true,
   resume_text:'工作经历：区域督导。'.repeat(15)})});
 let result=await onRequest({env:config,request});
 assert.equal(result.status,503);
 request=new Request('https://hhba.work/api/agent-v3/analyze',{
  method:'POST',headers:{Origin:'https://hhba.work',
  'content-type':'application/json'},body:JSON.stringify({consent:true,
   resume_text:'工作经历：区域督导。'.repeat(15)})});
 result=await onRequest({env:{...config,HHBA_AGENT_V3_ENABLED:'1'},request});
 assert.equal(result.status,404);
});
