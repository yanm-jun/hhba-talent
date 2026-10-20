import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publishIndex} from '../publish-official-index.mjs';
import {readNativeIndex} from '../read-official-index.mjs';

const job=i=>({id:'ashby-example-'+i,company:'Example',title:'Engineer',
  titleZh:'工程师',location:'Singapore',locationZh:'新加坡',
  url:'https://jobs.ashbyhq.com/example/'+i,platform:'ashby',source:'example'});
async function fixtures(root,modified={}){
 const folder=join(root,'incoming');await mkdir(folder,{recursive:true});
 const updated=new Date().toISOString();
 const checked_at=new Date().toISOString();
 const docs={
  'jobs.json':{jobs:[job(1),job(2)],total:2,updated,failures:0},
  'job-sync-status.json':{summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:updated,total_indexed_jobs:2,checked_at},
    jobs:[{job_id:job(1).id},{job_id:job(2).id}]},
  'job-sync-summary.json':{indexed_as_of:updated,total_indexed_jobs:2,checked_at},
  'job-search-facets.json':{kind:'HHBA_OFFICIAL_JD_SEARCH_FACETS_V1',indexed_as_of:updated,total_indexed_jobs:2,
   extracted_count:2,verified_at:checked_at,jobs:[{id:job(1).id,original_source_hash:'a'.repeat(64)},{id:job(2).id,original_source_hash:'b'.repeat(64)}]}
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

test('a new audit of unchanged job listings produces a new immutable version',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hhba-publisher-'));
 try{
  const {folder,docs}=await fixtures(root),dest=join(root,'volume');
  const first=await publishIndex(folder,dest,{minJobs:2});
  docs['job-sync-status.json'].summary.checked_at=new Date(Date.now()+1000).toISOString();
  docs['job-sync-summary.json'].checked_at=docs['job-sync-status.json'].summary.checked_at;
  docs['job-search-facets.json'].verified_at=docs['job-sync-status.json'].summary.checked_at;
  await writeFile(join(folder,'job-sync-summary.json'),JSON.stringify(docs['job-sync-summary.json']));
  await writeFile(join(folder,'job-search-facets.json'),JSON.stringify(docs['job-search-facets.json']));
  await writeFile(join(folder,'job-sync-status.json'),JSON.stringify(docs['job-sync-status.json']));
  const second=await publishIndex(folder,dest,{minJobs:2});
  assert.notEqual(second.version,first.version);
  assert.equal(JSON.parse(await readFile(join(dest,'current.json'),'utf8')).version,second.version);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('duplicate facet IDs or cross-source evidence must fail before pointer publication',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hhba-publisher-'));
 try{
  const {folder,docs}=await fixtures(root),dest=join(root,'volume');
  docs['job-search-facets.json'].jobs[1].id=job(1).id;
  await writeFile(join(folder,'job-search-facets.json'),JSON.stringify(docs['job-search-facets.json']));
  await assert.rejects(publishIndex(folder,dest,{minJobs:2}),/DUPLICATE_FACETS/);
  await assert.rejects(readFile(join(dest,'current.json'),'utf8'),/ENOENT/);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('publication refuses an older complete snapshot and retains newer pointer',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hhba-publisher-'));
 try{
  const {folder,docs}=await fixtures(root),dest=join(root,'volume');
  await publishIndex(folder,dest,{minJobs:2});
  const before=await readFile(join(dest,'current.json'),'utf8');
  docs['jobs.json'].updated=new Date(Date.now()-120000).toISOString();
  docs['job-sync-status.json'].summary.indexed_as_of=docs['jobs.json'].updated;
  docs['job-sync-summary.json'].indexed_as_of=docs['jobs.json'].updated;
  docs['job-search-facets.json'].indexed_as_of=docs['jobs.json'].updated;
  for(const name of Object.keys(docs))await writeFile(join(folder,name),JSON.stringify(docs[name]));
  await assert.rejects(publishIndex(folder,dest,{minJobs:2}),/REFUSE_OLDER_SOURCE_SNAPSHOT/);
  assert.equal(await readFile(join(dest,'current.json'),'utf8'),before);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('native reader verifies all hashes, version and source before returning jobs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hhba-native-reader-'));
 try{
  const {folder}=await fixtures(root),dest=join(root,'volume');
  assert.equal(await readNativeIndex(dest,'jobs.json'),null,'uninitialized remains a safe Pages fallback');
  const manifest=await publishIndex(folder,dest,{minJobs:2});
  const native=await readNativeIndex(dest,'jobs.json');
  assert.equal(JSON.parse(native.bytes.toString('utf8')).total,2);
  assert.equal(native.manifest.version,manifest.version);
  await writeFile(join(dest,'snapshots',manifest.version,'jobs.json'),'{"invalid":"tampered"}');
  await assert.rejects(readNativeIndex(dest,'jobs.json'),/NATIVE_INDEX_DIGEST_MISMATCH/);
  await assert.rejects(readNativeIndex(dest,'../secrets.json'),/INVALID_INDEX_NAME/);
 }finally{await rm(root,{recursive:true,force:true})}
});
