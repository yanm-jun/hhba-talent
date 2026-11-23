import test from 'node:test';
import assert from 'node:assert/strict';
import {checkCleanMatchProvider,MATCH_V2_PREFLIGHT}
 from '../functions/_lib/clean-match-v2-provider-check.js';

const url='https://api-docs.deepseek.com/zh-cn/guides/search/';
function setup({fetchStatus=200,emptyFetch=false,keyStatus=200}={}){
 const calls=[];
 const fetcher=async(raw,opts)=>{
  const path=new URL(raw).pathname;
  const data=opts?.body?JSON.parse(opts.body):{};
  calls.push({path,data});
  if(path==='/user/balance')return Response.json({is_available:true},{status:keyStatus});
  if(path==='/v1/tools/search')return Response.json({results:[]});
  if(path==='/responses')return Response.json({status:'completed',output:[{
   type:'message',content:[{type:'output_text',text:'{"ok":true}'}]
  }]});
  if(path==='/v1/tools/fetch')return Response.json({
   title:'DeepSeek API Docs',
   content:emptyFetch?'':'# Search & Fetch\n'+
    'DeepSeek Search API finds real public web pages and Fetch API reads single web pages in Markdown. '.repeat(3)
  },{status:fetchStatus});
  throw Error('unexpected '+raw);
 };
 return {fetcher,calls};
}
test('V2 provider-check really calls balance, Search, JSON Responses and Fetch, no private resume',async()=>{
 const {fetcher,calls}=setup();
 const result=await checkCleanMatchProvider('synthetic-secret', {fetcher});
 assert.equal(result.kind,MATCH_V2_PREFLIGHT);
 assert.equal(result.status,'READY');
 assert.equal(result.fetch_content_verified,true);
 assert.deepEqual(calls.map(x=>x.path).sort(),[
  '/responses','/user/balance','/v1/tools/fetch','/v1/tools/search'].sort());
 assert.equal(calls.find(x=>x.path==='/v1/tools/fetch').data.url,url);
 assert.ok(calls.every(x=>!JSON.stringify(x.data).includes('我的简历')));
});
test('403 from Fetch is a policy block, not a false positive or an invalid key',async()=>{
 const {fetcher}=setup({fetchStatus:403});
 await assert.rejects(checkCleanMatchProvider('synthetic',{fetcher}),
  e=>e?.code==='AI_FETCH_ACCESS_DENIED');
});
test('HTTP 200 with empty Fetch content must not be reported READY',async()=>{
 const {fetcher}=setup({emptyFetch:true});
 await assert.rejects(checkCleanMatchProvider('synthetic',{fetcher}),
  e=>e?.code==='AI_FETCH_RESPONSE_INVALID');
});
test('balance or Search failure prevents a false READY despite working Fetch mock',async()=>{
 const {fetcher}=setup({keyStatus:401});
 await assert.rejects(checkCleanMatchProvider('synthetic',{fetcher}),
  e=>e?.code==='AI_PROVIDER_KEY_REJECTED');
});
test('new matching backend route delegates provider-check to actual probe, never static READY',()=>{
 const {readFileSync}=requireFile();
 const route=readFileSync(new URL('../functions/api/match-next/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/checkCleanMatchProvider/);
 assert.doesNotMatch(route,/return json\(\{ok:true,status:'READY',engine:MATCH_V2\}\)/);
 assert.match(route,/candidateSession\(env,request\)/);
});
function requireFile(){return {readFileSync:(...a)=>readFileSyncCompat(...a)}}
function readFileSyncCompat(...args){return innerRead(...args)}
import {readFileSync as innerRead} from 'node:fs';
