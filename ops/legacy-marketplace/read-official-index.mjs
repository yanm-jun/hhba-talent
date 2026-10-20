// Read the authoritative, checksum-verified Railway volume snapshot only.
// Null means not bootstrapped; malformed or expired snapshots are errors.
import {readFile,stat} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
export const PUBLIC_INDEX_FILES=new Set([
 "jobs.json","job-sync-status.json","job-sync-summary.json","job-search-facets.json"
]);
const hash=data=>createHash("sha256").update(data).digest("hex");
const fresh=s=>{
 const t=Date.parse(s);
 return Number.isFinite(t)&&t<=Date.now()+5*60000&&Date.now()-t<24*3600000;
};
export async function readNativeIndex(root,name){
 if(!PUBLIC_INDEX_FILES.has(name))throw Error("INVALID_INDEX_NAME");
 let pointer;
 try{pointer=JSON.parse(await readFile(join(root,"current.json"),"utf8"))}
 catch(e){if(e.code==="ENOENT")return null;throw Error("INVALID_INDEX_POINTER")}
 if(!/^[a-f0-9]{32}$/.test(pointer?.version||"")||!fresh(pointer?.updated))
  throw Error("NATIVE_INDEX_POINTER_STALE_OR_INVALID");
 const directory=join(root,"snapshots",pointer.version);
 let manifest;
 try{manifest=JSON.parse(await readFile(join(directory,"manifest.json"),"utf8"))}
 catch{throw Error("NATIVE_INDEX_MANIFEST_MISSING")}
 if(manifest.kind!=="HHBA_RAILWAY_PUBLIC_INDEX_V1"||
  manifest.version!==pointer.version||manifest.updated!==pointer.updated||
  !Number.isInteger(manifest.jobs)||manifest.jobs<1||
  !Number.isInteger(manifest.facets)||manifest.facets<0||
  !PUBLIC_INDEX_FILES.has(name)||!Array.from(PUBLIC_INDEX_FILES).every(x=>/^[a-f0-9]{64}$/.test(manifest.files?.[x]||"")))
  throw Error("NATIVE_INDEX_MANIFEST_INVALID");
 const path=join(directory,name);
 const file=await stat(path);
 if(!file.isFile()||file.size>32*1024*1024||file.size<10)
  throw Error("NATIVE_INDEX_FILE_SIZE_INVALID");
 const bytes=await readFile(path);
 if(hash(bytes)!==manifest.files[name])throw Error("NATIVE_INDEX_DIGEST_MISMATCH");
 let parsed;try{parsed=JSON.parse(bytes.toString("utf8"))}
 catch{throw Error("NATIVE_INDEX_JSON_INVALID")}
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("NATIVE_INDEX_JSON_INVALID");
 if(name==="jobs.json" && (parsed.total!==manifest.jobs||
   !Array.isArray(parsed.jobs)||parsed.jobs.length!==parsed.total||
   parsed.failures!==0||parsed.updated!==manifest.updated))
  throw Error("NATIVE_INDEX_JOBS_INVALID");
 if(name==="job-search-facets.json" && (parsed.indexed_as_of!==manifest.updated||
  !Array.isArray(parsed.jobs)||parsed.jobs.length!==manifest.facets||
  parsed.total_indexed_jobs!==manifest.jobs))
  throw Error("NATIVE_INDEX_FACETS_INVALID");
 if(name==="job-sync-status.json" && (parsed.summary?.indexed_as_of!==manifest.updated||
  !Array.isArray(parsed.jobs)||parsed.jobs.length!==manifest.jobs))
  throw Error("NATIVE_INDEX_AUDIT_INVALID");
 if(name==="job-sync-summary.json" && (parsed.indexed_as_of!==manifest.updated||
  parsed.total_indexed_jobs!==manifest.jobs))
  throw Error("NATIVE_INDEX_SUMMARY_INVALID");
 return {bytes,manifest};
}
