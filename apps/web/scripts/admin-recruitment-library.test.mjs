import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {INDUSTRIES,onRequestGet,onRequestPost,onRequestPatch,onRequestDelete} from '../functions/admin-preview/api/library.js';

const team='hhba-lib-test.cloudflareaccess.com',aud='library-console-aud',email='owner@example.com';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'lib-test-key',alg:'RS256'};
const b64=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
function jwt(audience=aud){
 const t=Math.floor(Date.now()/1000),parts=b64({alg:'RS256',kid:jwk.kid})+'.'+
  b64({iss:'https://'+team,aud:audience,iat:t-60,exp:t+600,email});
 return parts+'.'+sign('RSA-SHA256',Buffer.from(parts),privateKey).toString('base64url');
}
function mockDb({quota=false}={}){
 const calls=[],batches=[];
 return {calls,batches,prepare(sql){
  calls.push(sql);
  if(quota)throw Error('row read limit exceeded 7500');
  return {args:[],bind(...args){this.args=args;return this},
   async first(){
    if(sql.includes("SELECT COUNT(*) records"))return {records:5288,linked:2573,unique_urls:1900,missing:2715};
    return null;
   },
   async all(){
    if(sql.includes('GROUP BY industry_id'))return {results:[{industry_id:'automotive',records:353,linked:353,unique_urls:318,missing:0}]};
    if(sql.startsWith('SELECT industry_id,recruitment_url'))return {results:[{industry_id:'automotive',recruitment_url:'https://jobs.existing.example/'}]};
    return {results:[]};
   }};
 },async batch(statements){batches.push(statements);return statements.map(()=>({success:true,meta:{changes:1}}))}};
}
function env(db){return {HHBA_ACCESS_TEAM_DOMAIN:team,HHBA_ACCESS_CONSOLE_AUD:aud,
 HHBA_METRICS_ADMIN_EMAIL:email,HHBA_METRICS_SECRET:'a-real-secret-at-least-32-characters-long',HHBA_METRICS_DB:db}}
async function signed(action){
 const prior=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200});
 try{return await action()}finally{globalThis.fetch=prior}
}
function request(path,options={}){
 const headers={'cf-access-jwt-assertion':jwt(),...(options.headers||{})};
 return new Request('https://hhba-talent.pages.dev/admin-preview/api/library'+path,{...options,headers});
}
function post(data,{origin='https://hhba-talent.pages.dev',url='' }={}){
 return request(url,{method:'POST',headers:{'content-type':'application/json','x-hhba-library-request':'1',Origin:origin,'sec-fetch-site':'same-origin'},body:JSON.stringify(data)});
}
test('17 halls are correctly named and no production numbers are hardcoded in static library',()=>{
 assert.equal(INDUSTRIES.length,17);
 assert.equal(INDUSTRIES[0][1],'汽车馆');
 assert.equal(INDUSTRIES.at(-1)[1],'教育科研馆');
 const ui=readFileSync(new URL('../../../admin-preview/library.js',import.meta.url),'utf8');
 assert.match(ui,/mode:'summary'/);
 assert.match(ui,/mode:'list'/);
 assert.doesNotMatch(ui,/1,900|1900|318|2,715/);
});
test('unsigned and invalid-audience requests cannot query D1',async()=>{
 const db=mockDb();
 const denied=await onRequestGet({request:new Request('https://hhba.work/admin-preview/api/library?mode=summary'),env:env(db)});
 assert.equal(denied.status,403);
 assert.equal(db.calls.length,0);
 await signed(async()=>{
  const q=new Request('https://hhba-talent.pages.dev/admin-preview/api/library?mode=summary',
   {headers:{'cf-access-jwt-assertion':jwt('wrong-audience')}});
  const res=await onRequestGet({request:q,env:env(db)});
  assert.equal(res.status,403);assert.equal(db.calls.length,0);
 });
});
test('authorized summary is live D1 data, with all 17 halls and no fake missing values',()=>signed(async()=>{
 const db=mockDb();
 const res=await onRequestGet({request:request('?mode=summary'),env:env(db)});
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.kind,'HHBA_RECRUITMENT_LIBRARY_V1');
 assert.equal(body.total.unique_urls,1900);
 assert.equal(body.total.missing,2715);
 assert.equal(body.industries.length,17);
 assert.equal(body.industries.find(x=>x.id==='automotive').unique_urls,318);
 assert.equal(body.industries.find(x=>x.id==='education-research').unique_urls,0);
}));
test('list requires a selected hall or explicit search, preventing expensive unbounded scans',()=>signed(async()=>{
 const db=mockDb();
 const res=await onRequestGet({request:request('?mode=list'),env:env(db)});
 assert.equal(res.status,400);assert.equal(db.calls.length,0);
 const ok=await onRequestGet({request:request('?mode=list&industry=automotive&page=1'),env:env(db)});
 assert.equal(ok.status,200);assert.deepEqual((await ok.json()).rows,[]);
}));
test('write requires same-origin JSON and special request header even with a signed admin',()=>signed(async()=>{
 const db=mockDb();
 const base={action:'add',row:{industry_id:'automotive',enterprise:'测试企业',recruitment_url:'https://jobs.test-company.example/'}};
 const fail=await onRequestPost({request:post(base,{origin:'https://evil.example'}),env:env(db)});
 assert.equal(fail.status,403);assert.equal(db.calls.length,0);
 const patch=await onRequestPatch({request:request('',{method:'PATCH',body:'{}'}),env:env(db)});
 assert.equal(patch.status,403);
 const del=await onRequestDelete({request:request('',{method:'DELETE',body:'{}'}),env:env(db)});
 assert.equal(del.status,403);
}));
test('import rejects unsafe URLs and deduplicates current industry URLs in one DB read',()=>signed(async()=>{
 const db=mockDb();
 const rows=[
  {industry_id:'automotive',enterprise:'A',recruitment_url:'https://jobs.existing.example/'},
  {industry_id:'automotive',enterprise:'B',recruitment_url:'https://jobs.fresh.example/'},
  {industry_id:'automotive',enterprise:'C',recruitment_url:'https://jobs.fresh.example/'}
 ];
 const bad=await onRequestPost({request:post({action:'import',rows:[{...rows[0],recruitment_url:'javascript:alert(1)'}]}),env:env(db)});
 assert.equal(bad.status,400);
 assert.equal(db.calls.length,0);
 const result=await onRequestPost({request:post({action:'import',rows}),env:env(db)});
 assert.equal(result.status,200);
 assert.deepEqual((( {inserted,skipped})=>({inserted,skipped}))(await result.json()),{inserted:1,skipped:2});
 assert.equal(db.batches.length,1);
 assert.equal(db.batches[0].length,2,'insert plus append-only audit');
 assert.equal(db.calls.filter(x=>x.startsWith('SELECT industry_id,recruitment_url')).length,1);
}));
test('quota errors fail visibly with 503 rather than showing synthetic numbers',()=>signed(async()=>{
 const db=mockDb({quota:true});
 const res=await onRequestGet({request:request('?mode=summary'),env:env(db)});
 assert.equal(res.status,503);assert.equal((await res.json()).error,'D1_DAILY_LIMIT_REACHED');
}));
