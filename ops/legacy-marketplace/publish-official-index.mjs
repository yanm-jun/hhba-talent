// Atomic, public-only official recruitment index publication for Railway.
// Used after the existing ATS importer and evidence auditor have successfully
// generated one MATCHING four-file evidence set. No resumes, raw JD or PII.
import {createHash} from "node:crypto";
import {readFile,writeFile,mkdir,rename,rm,stat} from "node:fs/promises";
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
 const docs={jobs:jobs.total,facets:facets.jobs.length,updated:jobs.updated};
 const version=hash(contents.get("jobs.json")).slice(0,24);
 await mkdir(join(destination,"snapshots"),{recursive:true});
 const staging=join(destination,"snapshots","."+version+".staging");
 const published=join(destination,"snapshots",version);
 // No partially updated index is ever made discoverable.
 await rm(staging,{force:true,recursive:true});
 await mkdir(staging,{recursive:true});
 try{
  const hashes={};
  for(const name of names){
   const value=contents.get(name);hashes[name]=hash(value);
   await writeFile(join(staging,name),value,{flag:"wx",mode:0o600});
  }
  const manifest={kind:"HHBA_RAILWAY_PUBLIC_INDEX_V1",version,...docs,files:hashes};
  await writeFile(join(staging,"manifest.json"),JSON.stringify(manifest),{flag:"wx",mode:0o600});
  try{await rename(staging,published)}catch(e){
   if(e.code!=="EEXIST"&&e.code!=="ENOTEMPTY")throw e;
   await rm(staging,{recursive:true,force:true});
  }
  const pointer=join(destination,"current.json");
  const temp=join(destination,"current."+process.pid+".tmp");
  await writeFile(temp,JSON.stringify({version,updated:jobs.updated}),{flag:"w",mode:0o600});
  await rename(temp,pointer);
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
