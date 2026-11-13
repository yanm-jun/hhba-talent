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
    if(sql.startsWith('SELECT industry_id,lower'))return {results:[{industry_id:'automotive',normalized:'https://jobs.existing.example',source_batch:'legacy'}]};
    return {results:[]};
   }};
 },async batch(statements){batches.push(statements);return statements.map(()=>({success:true,meta:{changes:1}}))}};
}
function env(db){return {HHBA_ACCESS_TEAM_DOMAIN:team,HHBA_ACCESS_CONSOLE_AUD:aud,HHBA_ACCESS_WORK_ADMIN_AUD:aud,
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
test('17 halls never fall back to stale hardcoded counts when live catalog is unavailable',()=>{
 assert.equal(INDUSTRIES.length,17);
 assert.equal(INDUSTRIES[0][1],'汽车馆');
 assert.equal(INDUSTRIES.at(-1)[1],'教育科研馆');
 const ui=readFileSync(new URL('../../admin-preview/library.js',import.meta.url),'utf8');
 assert.match(ui,/mode:'summary'/);
 assert.match(ui,/mode:'list'/);
 assert.doesNotMatch(ui,/LIB_VERIFIED_SNAPSHOT/);
 assert.doesNotMatch(ui,/mode:'snapshot'/);
 assert.match(ui,/D1_DAILY_LIMIT_REACHED/);
 assert.match(ui,/lib-total-candidate/);
});
test('verification-state aggregation keeps missing URLs and historical evidence separate',async()=>{
 const {calculateCatalogSummary}=await import('../functions/_lib/library-snapshot-cache.js');
 const rows=[
  {industry_id:'automotive',enterprise:'A',recruitment_url:'https://example.com/a',source_kind:'admin_verified_official'},
  {industry_id:'automotive',enterprise:'B',recruitment_url:'https://example.com/b',source_kind:'previously_reviewed_official'},
  {industry_id:'automotive',enterprise:'C',recruitment_url:'https://example.com/c',source_kind:'historical_candidate_url'},
  {industry_id:'automotive',enterprise:'D',recruitment_url:null,source_kind:'historical_name_only'}
 ];
 const result=calculateCatalogSummary(rows,INDUSTRIES);
 assert.equal(result.total.records,4);
 assert.equal(result.total.linked,3);
 assert.equal(result.total.missing,1);
 assert.equal(result.total.verified,1);
 assert.equal(result.total.historical_verified,1);
 assert.equal(result.total.candidate,1);
 assert.equal(result.industries[0].verified,1);
 assert.equal(result.industries[0].candidate,1);
 assert.equal(result.total.verified+result.total.historical_verified+result.total.candidate,result.total.linked);
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
 assert.equal(db.calls.filter(x=>x.startsWith('SELECT industry_id,lower')).length,1);
}));
test('exact same-industry empty employer is filled with an indexed UPDATE, not duplicated',()=>signed(async()=>{
 const db=mockDb();
 const original=db.prepare;
 db.prepare=function(sql){
  const stmt=original.call(this,sql);
  if(sql.startsWith('SELECT source_key,industry_id,enterprise,recruitment_url')&&sql.includes('WHERE (recruitment_url IS NULL')){
   stmt.all=async()=>({results:[{source_key:'legacy:missing-1',industry_id:'automotive',
    enterprise:'真实待补企业',recruitment_url:null,source_kind:'historical_name_only',
    source_batch:'historical-source',source_sequence:12,updated_at:'2026-11-12T00:00:00Z'}]});
  }
  return stmt;
 };
 const result=await onRequestPost({request:post({action:'import',rows:[
  {industry_id:'automotive',enterprise:'真实待补企业',recruitment_url:'https://careers.real-company.example'}]}),env:env(db)});
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.inserted,0);assert.equal(data.filled,1);assert.equal(data.skipped,0);
 assert.equal(db.batches.length,1);
 assert.equal(db.batches[0].length,2,'update plus append-only audit');
 assert.equal(db.batches[0][1].args[1],'edit','DB audit CHECK only permits add/edit/delete/import');
 assert.equal(db.calls.filter(x=>x.startsWith('INSERT INTO hhba_industry_employer_links')).length,0);
 assert.equal(db.calls.filter(x=>x.startsWith('UPDATE hhba_industry_employer_links')).length,1);
 assert.ok(db.calls.some(x=>x.includes('enterprise IN (')),'lookup uses exact names, no correlated scan');
}));
test('quota errors fail visibly with 503 rather than showing synthetic numbers',()=>signed(async()=>{
 const db=mockDb({quota:true});
 const res=await onRequestGet({request:request('?mode=summary'),env:env(db)});
 assert.equal(res.status,503);assert.equal((await res.json()).error,'D1_DAILY_LIMIT_REACHED');
}));

test('100-row import uses bounded reads and four atomic batches without >100 binds',()=>signed(async()=>{
 const db=mockDb();
 const rows=Array.from({length:100},(_,i)=>({industry_id:'internet-ai',enterprise:'测试'+i,recruitment_url:'https://jobs'+i+'.example.com'}));
 const result=await onRequestPost({request:post({action:'import',upload_id:'b7e2028f-cc43-402e-9008-35736fa914e2',rows}),env:env(db)});
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.inserted,100);
 assert.equal(data.duplicates,0);
 assert.equal(data.replayed,0);
 assert.equal(db.batches.length,4,'25 records per transaction');
 assert.deepEqual(db.batches.map(b=>b.length),[50,50,50,50],'one INSERT and one audit per row, in four batched subrequests');
 assert.equal(db.calls.filter(x=>x.startsWith('SELECT industry_id,lower')).length,2);
 assert.equal(db.calls.filter(x=>x.startsWith('INSERT INTO')).length,200);
 assert.ok(db.batches.flat().every(s=>s.args.length<=100),'each SQL stays within D1 parameter cap');
}));
test('retry of partially written batch reports replayed as successful, never as duplicates',()=>signed(async()=>{
 const db=mockDb();
 const upload='b7e2028f-cc43-402e-9008-35736fa914e2';
 const prior=db.prepare;
 db.prepare=function(sql){
  const stmt=prior.call(this,sql);
  if(sql.startsWith('SELECT industry_id,lower')){
   stmt.all=async()=>({results:[{industry_id:'automotive',normalized:'https://jobs.already.example',source_batch:'admin-import:'+upload}]});
  }
  return stmt;
 };
 const response=await onRequestPost({request:post({action:'import',upload_id:upload,
  rows:[{industry_id:'automotive',enterprise:'已写入企业',recruitment_url:'https://jobs.already.example/'}]}),env:env(db)});
 const data=await response.json();
 assert.equal(data.inserted,0);
 assert.equal(data.replayed,1);
 assert.equal(data.duplicates,0);
}));

test('read-only production preview reads its dedicated binding and cannot write to either D1',()=>signed(async()=>{
 const staging=mockDb(),production=mockDb();
 const e={...env(staging),HHBA_LIBRARY_READ_DB:production};
 const r=await onRequestGet({request:request('?mode=summary'),env:e});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.readonly,true);
 assert.equal(data.source,'production-read-only');
 assert.equal(staging.calls.length,0);
 assert.ok(production.calls.length>0);
 const base={action:'add',row:{industry_id:'automotive',enterprise:'测试公司',recruitment_url:'https://jobs.test.example/'}};
 const denied=await onRequestPost({request:post(base),env:e});
 assert.equal(denied.status,403);
 assert.equal((await denied.json()).error,'LIBRARY_PREVIEW_READ_ONLY');
 assert.equal(staging.batches.length,0);
 assert.equal(production.batches.length,0);
}));
