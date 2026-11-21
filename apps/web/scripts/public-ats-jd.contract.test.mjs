import test from 'node:test';
import assert from 'node:assert/strict';
import {safePublicAtsJobLocator,fetchPublicAtsJd} from '../functions/_lib/public-ats-jd.js';
import {saveVerifiedJobJd,readJobJdById,readFreshJobJdByUrl} from '../functions/_lib/job-jd-archive.js';

const GH='https://job-boards.greenhouse.io/hhbaexample/jobs/1234567';
const LEVER='https://jobs.lever.co/hhbaexample/11111111-2222-4333-8444-555555555555';
const jdBody='<h3>Responsibilities</h3><ul><li>Manage store performance and analyze regional sales metrics.</li><li>Coordinate store operations and customer service improvement.</li></ul><h3>Qualifications</h3><ul><li>Experience with retail operations management and KPI tracking.</li><li>Strong communication skills and reporting ability.</li></ul>';
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})}
function provider(url){
 if(url==='https://boards-api.greenhouse.io/v1/boards/hhbaexample/jobs/1234567?content=true')
  return json({id:1234567,title:'Regional Retail Operations Specialist',location:{name:'Shanghai, China'},content:jdBody,
   absolute_url:GH});
 if(url==='https://api.lever.co/v0/postings/hhbaexample/11111111-2222-4333-8444-555555555555')
  return json({id:'11111111-2222-4333-8444-555555555555',
   hostedUrl:LEVER,text:'Regional Store Operations Specialist',
   categories:{location:'Shanghai, China'},descriptionPlain:'Responsibilities',
   lists:[
    {text:'Responsibilities',content:'<ul><li>Manage region-wide retail store operations.</li><li>Analyze sales and service metrics across stores.</li></ul>'},
    {text:'Qualifications',content:'<ul><li>Retail operation experience.</li><li>Communication and analysis skills.</li></ul>'}
   ]});
 throw Error('Unapproved URL '+url);
}

test('Only exact ATS job detail URLs are admitted, never board roots/redirect/API paths',()=>{
 assert.equal(safePublicAtsJobLocator(GH)?.kind,'greenhouse');
 assert.equal(safePublicAtsJobLocator(LEVER)?.kind,'lever');
 for(const value of [
  'https://job-boards.greenhouse.io/hhbaexample',
  'https://job-boards.greenhouse.io/hhbaexample/jobs/1234567?redirect=evil',
  'https://boards-api.greenhouse.io/v1/boards/hhbaexample/jobs/1234567',
  'https://jobs.lever.co/hhbaexample',
  'https://jobs.lever.co/hhbaexample/11111111-2222-4333-8444-555555555555/apply',
  'https://jobs.lever.co@evil.example/hhbaexample/11111111-2222-4333-8444-555555555555',
  'http://jobs.lever.co/hhbaexample/11111111-2222-4333-8444-555555555555',
  'https://jobs.lever.co.evil.example/hhbaexample/11111111-2222-4333-8444-555555555555',
  'https://127.0.0.1/hhbaexample/jobs/1234567'
 ])assert.equal(safePublicAtsJobLocator(value),null,value);
});

test('Exact Greenhouse posting content yields complete source sections, Mainland city, no model guesses',async()=>{
 const calls=[];
 const fetched=await fetchPublicAtsJd(GH,{fetcher:async(url,opts)=>{
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');
  calls.push(url);return provider(url);
 }});
 assert.equal(calls.length,1);
 assert.equal(fetched.company,'hhbaexample');
 assert.equal(fetched.location,'上海');
 assert.equal(fetched.proof_method,'PUBLIC_EMPLOYER_ATS_V1');
 assert.equal(fetched.content_status,'VERIFIED_SECTIONS');
 assert.ok(fetched.sections.length>=5);
 assert.match(fetched.full_jd,/Responsibilities/);
 assert.match(fetched.full_jd,/Qualifications/);
});

test('Exact Lever posting matches hostedUrl and has full responsibility/qualification sections',async()=>{
 const fetched=await fetchPublicAtsJd(LEVER,{fetcher:provider});
 assert.equal(fetched.proof_method,'PUBLIC_EMPLOYER_ATS_V1');
 assert.equal(fetched.location,'上海');
 assert.match(fetched.full_jd,/Manage region-wide retail store operations/);
 assert.match(fetched.full_jd,/Retail operation experience/);
});

test('Reject unverifiable, foreign and redirected ATS content',async()=>{
 await assert.rejects(fetchPublicAtsJd(GH,{fetcher:async()=>json({
  id:1234567,title:'Overseas Researcher',location:{name:'London, United Kingdom'},content:jdBody
 })}),/ATS_NOT_MAINLAND/);
 await assert.rejects(fetchPublicAtsJd(LEVER,{fetcher:async()=>json({
  id:'11111111-2222-4333-8444-555555555555',
  hostedUrl:'https://jobs.lever.co/other/11111111-2222-4333-8444-555555555555',
  text:'Manager',categories:{location:'Shanghai, China'},descriptionPlain:'long description'
 })}),/ATS_POSTING_UNVERIFIED/);
 await assert.rejects(fetchPublicAtsJd(GH,{fetcher:async()=>new Response('',{status:302,headers:{Location:'https://example.net'}})}),/ATS_POSTING_NOT_AVAILABLE/);
});

test('D1 and R2 retain immutable ATS provenance and can retrieve same version for more than one user',async()=>{
 const record=new Map(),objects=new Map(),now=new Date();
 const db={prepare(sql){return {
   bind(...args){this.args=args;return this},
   async first(){if(sql.includes('WHERE id=?'))return record.get(this.args[0])||null;
    if(sql.includes('WHERE canonical_url=?'))return [...record.values()].find(v=>v.canonical_url===this.args[0])||null;
    throw Error('unexpected SQL '+sql);},
   async run(){assert.match(sql,/INSERT INTO hhba_job_ats_jd_versions/);
    const [id,canonical_url,url_sha256,company,title,location,jd_sha256,object_key,text_bytes,
     proof_method,content_status,first_verified_at,last_verified_at]=this.args;
    const existing=record.get(id);
    record.set(id,{id,canonical_url,url_sha256,company,title,location,jd_sha256,
     object_key,text_bytes,proof_method,content_status,
     first_verified_at:existing?.first_verified_at||first_verified_at,last_verified_at});
    return {success:true,meta:{changes:1}};}
  }}};
 let writes=0;
 const r2={async head(key){return objects.has(key)?{key}:null},
  async put(key,payload){writes++;objects.set(key,payload)},
  async get(key){return objects.has(key)?{text:async()=>objects.get(key)}:null}};
 const env={HHBA_JOB_JD_DB:db,HHBA_JOB_JD_R2:r2};
 const source=await fetchPublicAtsJd(GH,{fetcher:provider});
 const saved=await saveVerifiedJobJd(env,source,{now});
 const reused=await saveVerifiedJobJd(env,source,{now});
 assert.equal(saved.id,reused.id);
 assert.equal(writes,1);
 assert.equal(record.size,1);
 assert.equal((await readJobJdById(env,saved.id))?.proof_method,'PUBLIC_EMPLOYER_ATS_V1');
 assert.equal((await readFreshJobJdByUrl(env,GH))?.jd_sha256,saved.jd_sha256);
 const altered=JSON.parse(objects.get(record.get(saved.id).object_key));
 altered.full_jd+=' Forged instructions';
 objects.set(record.get(saved.id).object_key,JSON.stringify(altered));
 assert.equal(await readJobJdById(env,saved.id),null);
});
