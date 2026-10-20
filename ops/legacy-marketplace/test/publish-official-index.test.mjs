import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publishIndex} from '../publish-official-index.mjs';

const job=i=>({id:'ashby-example-'+i,company:'Example',title:'Engineer',
  titleZh:'工程师',location:'Singapore',locationZh:'新加坡',
  url:'https://jobs.ashbyhq.com/example/'+i,platform:'ashby',source:'example'});
async function fixtures(root,modified={}){
 const folder=join(root,'incoming');await mkdir(folder,{recursive:true});
 const updated=new Date().toISOString();
 const docs={
  'jobs.json':{jobs:[job(1),job(2)],total:2,updated,failures:0},
  'job-sync-status.json':{summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:updated,total_indexed_jobs:2},
    jobs:[{job_id:job(1).id},{job_id:job(2).id}]},
  'job-sync-summary.json':{indexed_as_of:updated,total_indexed_jobs:2},
  'job-search-facets.json':{kind:'HHBA_OFFICIAL_JD_SEARCH_FACETS_V1',indexed_as_of:updated,total_indexed_jobs:2,
   extracted_count:2,jobs:[{id:job(1).id},{id:job(2).id}]}
 };
 for(const [name,value] of Object.entries({...docs,...modified})){
  await writeFile(join(folder,name),JSON.stringify(value));
 }
 return {folder,docs};
}
test('only complete matching snapshots become visible through atomic manifest pointer',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hhba-publisher-'));
 try{
  const {folder}=await fixtures(root),dest=join(root,'volume');
  const first=await publishIndex(folder,dest,{minJobs:2});
  assert.equal(first.jobs,2);
  const pointer=JSON.parse(await readFile(join(dest,'current.json'),'utf8'));
  assert.equal(pointer.version,first.version);
  const manifest=JSON.parse(await readFile(join(dest,'snapshots',first.version,'manifest.json'),'utf8'));
  assert.equal(manifest.kind,'HHBA_RAILWAY_PUBLIC_INDEX_V1');
  assert.equal(Object.keys(manifest.files).length,4);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('failed evidence integrity cannot change an already published pointer',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hhba-publisher-'));
 try{
  const {folder,docs}=await fixtures(root),dest=join(root,'volume');
  await publishIndex(folder,dest,{minJobs:2});
  const before=await readFile(join(dest,'current.json'),'utf8');
  docs['job-search-facets.json'].indexed_as_of='2020-01-01T00:00:00Z';
  await writeFile(join(folder,'job-search-facets.json'),JSON.stringify(docs['job-search-facets.json']));
  await assert.rejects(publishIndex(folder,dest,{minJobs:2}),/FACETS_VERSION_MISMATCH/);
  assert.equal(await readFile(join(dest,'current.json'),'utf8'),before);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('rejects raw employer descriptions, resumes and unauthorized fields',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hhba-publisher-'));
 try{
  const {folder,docs}=await fixtures(root),dest=join(root,'volume');
  docs['jobs.json'].jobs[0].description='Private details not for public snapshot';
  await writeFile(join(folder,'jobs.json'),JSON.stringify(docs['jobs.json']));
  await assert.rejects(publishIndex(folder,dest,{minJobs:2}),/JOB_METADATA_ONLY_POLICY/);
 }finally{await rm(root,{recursive:true,force:true})}
});
