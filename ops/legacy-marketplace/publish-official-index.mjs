// Atomic, public-only official recruitment index publication for Railway.
// Used after the existing ATS importer and evidence auditor have successfully
// generated one MATCHING four-file evidence set. No resumes, raw JD or PII.
import {createHash,randomBytes} from "node:crypto";
import {readFile,writeFile,mkdir,rename,rm,stat,readdir} from "node:fs/promises";
import {join,resolve} from "node:path";
const names=["jobs.json","job-sync-status.json","job-sync-summary.json","job-search-facets.json"];
const hash=buf=>createHash("sha256").update(buf).digest("hex");
const validTime=value=>{const t=Date.parse(value);return Number.isFinite(t)&&Date.now()-t<24*3600000&&t<Date.now()+5*60000;};
export async function publishIndex(sourceDir,destination,{minJobs=10000}={}){
 if(!Number.isInteger(minJobs)||minJobs<1)throw Error("INVALID_MINIMUM");
 const contents=new Map(),raw={};
 for(const name of names){
  const p=join(sourceDir,name);
  const metadata=await stat(p);
  if(metadata.size<10||metadata.size>32*1024*1024||!metadata.isFile())throw Error("BAD_SOURCE_FILE_"+name);
  const body=await readFile(p);
  contents.set(name,body);
  raw[name]=JSON.parse(body.toString("utf8"));
 }
 const jobs=raw["jobs.json"], audit=raw["job-sync-status.json"];
 const report=raw["job-sync-summary.json"],facets=raw["job-search-facets.json"];
 if(!validTime(jobs.updated)||jobs.failures!==0||!Array.isArray(jobs.jobs)||
    jobs.total!==jobs.jobs.length||jobs.total<minJobs)throw Error("JOB_SNAPSHOT_UNVERIFIED");
 if(!Array.isArray(audit.jobs)||audit.summary?.kind!=="HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1"||
    audit.summary.indexed_as_of!==jobs.updated||audit.jobs.length!==jobs.total)
    throw Error("AUDIT_VERSION_MISMATCH");
 if(facets.kind!=="HHBA_OFFICIAL_JD_SEARCH_FACETS_V1"||
    facets.indexed_as_of!==jobs.updated||
    facets.total_indexed_jobs!==jobs.total||!Array.isArray(facets.jobs)||
    facets.extracted_count!==facets.jobs.length)throw Error("FACETS_VERSION_MISMATCH");
 if(report.indexed_as_of!==jobs.updated||!report.total_indexed_jobs||
    report.total_indexed_jobs!==jobs.total)throw Error("SUMMARY_VERSION_MISMATCH");
 const allowedJobFields=new Set(["id","company","companyZh","title","titleZh","titleStatus","location","locationZh",
  "url","platform","source","domestic","remote","recruitmentType","observedAt","recordKind","currentApplicationVerified"]);
 const jobIds=new Set();
 for(const job of jobs.jobs){
  if(!job||typeof job.id!=="string"||!job.id||jobIds.has(job.id)||
    Object.keys(job).some(key=>!allowedJobFields.has(key)))throw Error("JOB_METADATA_ONLY_POLICY");
  jobIds.add(job.id);
 }
 if(!Array.isArray(facets.jobs)||facets.jobs.some(row=>
   !jobIds.has(row?.id) || typeof row?.original_source_hash!=="string" ||
   !/^[0-9a-f]{64}$/.test(row.original_source_hash)))
   throw Error("FACETS_EVIDENCE_MISSING");
 const facetIds=new Set(facets.jobs.map(x=>x.id));
 if(facetIds.size!==facets.jobs.length)throw Error("DUPLICATE_FACETS");
 if(!validTime(audit.summary.checked_at)||
   facets.verified_at!==audit.summary.checked_at||
   report.checked_at!==audit.summary.checked_at)
   throw Error("AUDIT_VERIFICATION_TIME_INVALID");
 const audited=new Set(audit.jobs.map(row=>row?.job_id));
 if(audited.size!==jobs.total||audit.jobs.some(row=>!jobIds.has(row?.job_id)))
   throw Error("AUDIT_DUPLICATE_OR_MISSING_JOBS");
 const docHashes={};
 for(const name of names)docHashes[name]=hash(contents.get(name));
 // A new verification changes release ID even if source jobs stay identical.
 const version=hash(names.map(name=>name+":"+docHashes[name]).join("\n")).slice(0,32);
 const docs={jobs:jobs.total,facets:facets.jobs.length,updated:jobs.updated,
  checkedAt:audit.summary.checked_at};
 await mkdir(join(destination,"snapshots"),{recursive:true});
 const staging=join(destination,"snapshots","."+version+"."+process.pid+"."+randomBytes(6).toString("hex")+".staging");
 const published=join(destination,"snapshots",version);
 // No partially updated index is ever made discoverable.
 await mkdir(staging,{recursive:true,mode:0o700});
 try{
  const hashes={};
  for(const name of names){
   const value=contents.get(name);hashes[name]=docHashes[name];
   await writeFile(join(staging,name),value,{flag:"wx",mode:0o600});
  }
  const manifest={kind:"HHBA_RAILWAY_PUBLIC_INDEX_V1",version,...docs,files:hashes};
  await writeFile(join(staging,"manifest.json"),JSON.stringify(manifest),{flag:"wx",mode:0o600});
  try{await rename(staging,published)}catch(e){
   if(e.code!=="EEXIST"&&e.code!=="ENOTEMPTY")throw e;
   const existing=JSON.parse(await readFile(join(published,"manifest.json"),"utf8"));
   if(existing.version!==version||names.some(n=>existing.files?.[n]!==hashes[n]))
     throw Error("PUBLISHED_VERSION_COLLISION");
   await rm(staging,{recursive:true,force:true});
  }
  const pointer=join(destination,"current.json");
  // Preserve the previously accepted feed if a slower writer arrives late.
  let previous=null;try{previous=JSON.parse(await readFile(pointer,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
  if(previous?.updated && Date.parse(previous.updated)>Date.parse(jobs.updated))
   throw Error("REFUSE_OLDER_SOURCE_SNAPSHOT");
  if(previous?.checkedAt && jobs.updated===previous.updated &&
     Date.parse(previous.checkedAt)>Date.parse(docs.checkedAt))
   throw Error("REFUSE_OLDER_AUDIT");
  const temp=join(destination,"current."+process.pid+"."+randomBytes(5).toString("hex")+".tmp");
  try{
   await writeFile(temp,JSON.stringify({version,updated:jobs.updated,checkedAt:docs.checkedAt}),{flag:"wx",mode:0o600});
   await rename(temp,pointer);
  }finally{await rm(temp,{force:true})}
  // Keep the active release and two predecessors on the 500 MB Railway volume.
  // Ignore cleanup failures: they must never undo a successful atomic release.
  try{
   const dir=join(destination,"snapshots");
   const versions=(await readdir(dir,{withFileTypes:true}))
     .filter(e=>e.isDirectory()&&/^[a-f0-9]{32}$/.test(e.name)).map(e=>e.name);
   const ordered=await Promise.all(versions.map(async name=>({
     name,mtime:(await stat(join(dir,name))).mtimeMs
   })));
   ordered.sort((a,b)=>b.mtime-a.mtime);
   const keep=new Set([version,...ordered.slice(0,2).map(e=>e.name)]);
   for(const entry of ordered)if(!keep.has(entry.name))
    await rm(join(dir,entry.name),{recursive:true,force:true});
  }catch(e){console.warn("HHBA_INDEX_PRUNE_SKIPPED",e instanceof Error?e.message:"unknown")}
  return manifest;
 }catch(e){await rm(staging,{recursive:true,force:true});throw e}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const origin=process.argv[2],destination=process.argv[3];
 if(!origin||!destination)throw Error("Usage: publish-official-index.mjs <dist/data> </sync-state/public-index>");
 const manifest=await publishIndex(origin,destination);
 console.log("HHBA_RAILWAY_PUBLIC_INDEX_PUBLISHED",JSON.stringify({
  version:manifest.version,jobs:manifest.jobs,facets:manifest.facets,updated:manifest.updated}));
}
