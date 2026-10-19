import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {makeServer} from './web.mjs';

const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve(s.address().port)));
const close=s=>new Promise(resolve=>s.close(resolve));
test('recruitment-only site serves React and proxies only explicit GET jobs, no cookies',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hhba-railway-'));
 await writeFile(join(dir,'index.html'),'<html><body>HHBA</body></html>');
 const hits=[];
 const backend=createServer((req,res)=>{
   hits.push({url:req.url,cookie:req.headers.cookie,authorization:req.headers.authorization});
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({items:[],total:0}));
 });
 const bp=await listen(backend);
 const site=makeServer({dist:dir,apiUrl:'http://127.0.0.1:'+bp});
 const port=await listen(site),root='http://127.0.0.1:'+port;
 try{
   let r=await fetch(root+'/candidate/jobs');assert.equal(r.status,200);assert.match(await r.text(),/HHBA/);
   r=await fetch(root+'/health');assert.equal(r.status,200);
   r=await fetch(root+'/recruitment/api/v1/marketplace?limit=8',{
     headers:{Cookie:'PRIVATE_SESSION=abc',Authorization:'Bearer token'}});
   assert.equal(r.status,200);assert.equal((await r.json()).total,0);
   assert.equal(hits.at(-1).url,'/api/v1/marketplace?limit=8');
   assert.equal(hits.at(-1).cookie,undefined);
   assert.equal(hits.at(-1).authorization,undefined);
   r=await fetch(root+'/recruitment/api/v1/jobs/ATS-f12345678901234567890123/original-jd');
   assert.equal(r.status,200);
   assert.equal(hits.at(-1).url,'/api/v1/jobs/ATS-f12345678901234567890123/original-jd');
   r=await fetch(root+'/recruitment/api/v1/internal/ats-jd/ATS-abc');
   assert.equal(r.status,404);
   r=await fetch(root+'/api/v1/auth/me');assert.equal(r.status,401);
   r=await fetch(root+'/api/v1/resumes');assert.equal(r.status,503);
 } finally{await close(site);await close(backend);await rm(dir,{recursive:true,force:true});}
});
test('site fails closed without configured upstream',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hhba-no-api-'));
 await writeFile(join(dir,'index.html'),'ok');
 const s=makeServer({dist:dir,apiUrl:''});const p=await listen(s);
 try{
  const root='http://127.0.0.1:'+p;
  assert.equal((await fetch(root+'/health')).status,503);
  assert.equal((await fetch(root+'/recruitment/api/v1/jobs')).status,503);
 }finally{await close(s);await rm(dir,{recursive:true,force:true});}
});
