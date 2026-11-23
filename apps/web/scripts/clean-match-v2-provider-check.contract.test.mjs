import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkCleanMatchProvider,MATCH_V2_PREFLIGHT}
 from '../functions/_lib/clean-match-v2-provider-check.js';

const JD='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
function setup({modelStatus=200,searchStatus=200,withoutSources=false}={}){
 const calls=[];
 const fetcher=async(url,opts)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(opts.method,'POST');
  const request=JSON.parse(opts.body);
  calls.push(request);
  assert.equal(request.store,false);
  assert.equal(request.model,'gpt-6.2-astra');
  if(request.tools?.some(x=>x.type==='web_search'))
   return Response.json({status:'completed',output:[{
    type:'web_search_call',status:'completed',action:{sources:withoutSources?[]:[
     {url:JD,title:'腾讯真实招聘详情页'}
    ]}
   }]},{status:searchStatus});
  return Response.json({status:'completed',output:[{
   type:'message',content:[{type:'output_text',text:'{"ok":true}'}]
  }]},{status:modelStatus});
 };
 return {fetcher,calls};
}
test('OpenAI probe checks actual JSON and web sources through the official host',async()=>{
 const {fetcher,calls}=setup();
 const result=await checkCleanMatchProvider({key:'synthetic-secret'},{fetcher});
 assert.equal(result.kind,MATCH_V2_PREFLIGHT);
 assert.equal(result.status,'READY');
 assert.equal(result.fetch_content_verified,false);
 assert.deepEqual(result.capabilities,['openai_responses_json','openai_web_search_sources']);
 assert.equal(result.searches_returned,1);
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>!JSON.stringify(x).includes('我的简历')));
 assert.ok(calls.every(x=>x.store===false));
});
test('no actual web source cannot be reported as READY',async()=>{
 const {fetcher}=setup({withoutSources:true});
 await assert.rejects(checkCleanMatchProvider('synthetic',{fetcher}),
  e=>e.code==='AI_SEARCH_EMPTY_SOURCES');
});
test('invalid official OpenAI credential never passes preflight',async()=>{
 const {fetcher}=setup({modelStatus:401});
 await assert.rejects(checkCleanMatchProvider('synthetic',{fetcher}),
  e=>e.code==='AI_PROVIDER_KEY_REJECTED');
});
test('web-search 429 cannot masquerade as healthy provider',async()=>{
 const {fetcher}=setup({searchStatus:429});
 await assert.rejects(checkCleanMatchProvider('synthetic',{fetcher}),
  e=>e.code==='AI_PROVIDER_RATE_LIMITED');
});
test('V2 route keeps candidate-authenticated readiness check and no static success',()=>{
 const route=readFileSync(new URL('../functions/api/match-next/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/checkCleanMatchProvider/);
 assert.match(route,/candidateSession\(env,request\)/);
 assert.doesNotMatch(route,/return json\(\{ok:true,status:'READY',engine:MATCH_V2\}\)/);
});
