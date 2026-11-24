// V4 on-demand JD verification: one job per HTTP request. No CV is stored.
import {v4PublicJobUrl,v4ReadEmployerJob} from './v4-open-job-evidence.js';
import {directOfficialJobEvidence,extractOfficialJdSections} from './official-job-evidence.js';
import {readFreshJobJdByUrl,saveVerifiedJobJd,safeJDSourceLocator,jdArchiveConfigured} from './job-jd-archive.js';
import {sha256Hex} from './real-auth.js';
const board=/(?:^|\.)(?:zhipin\.com|liepin\.com|51job\.com|zhaopin\.com|lagou\.com|indeed\.com|linkedin\.com|glassdoor\.com)$/i;
const keyOf=id=>'official-jds/v4/'+id+'.json';
const proof='V4_STRUCTURED_JOBPOSTING';
const norm=v=>String(v||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
function normalized(source){
 const url=v4PublicJobUrl(source?.canonical_url);
 if(!url||url!==source.canonical_url||board.test(new URL(url).hostname)||
    source.proof_method!==proof||source.source_confirmed!==true||
    typeof source.company!=='string'||!source.company.trim()||
    typeof source.title!=='string'||!source.title.trim()||
    typeof source.location!=='string'||!source.location.trim())return null;
 const sections=extractOfficialJdSections(source.full_jd,{unbounded:true});
 if(!sections)return null;
 return {canonical_url:url,company:source.company,title:source.title,location:source.location,
  proof_method:proof,source_confirmed:true,...sections};
}
export async function readV4ArchivedJd(env,id){
 if(!/^jd_[a-f0-9]{32}$/.test(id)||!jdArchiveConfigured(env))return null;
 const object=await env.HHBA_JOB_JD_R2.get(keyOf(id));if(!object)return null;
 let raw;try{raw=JSON.parse(await object.text());}catch{return null;}
 const source=normalized(raw);
 if(!source||raw.id!==id)return null;
 const hash=await sha256Hex(source.full_jd);
 const expected='jd_'+(await sha256Hex(source.canonical_url+'\n'+hash)).slice(0,32);
 if(hash!==raw.jd_sha256||expected!==id)return null;
 const age=Date.now()-Date.parse(raw.checked_at);
 return {...source,id,jd_sha256:hash,checked_at:raw.checked_at,
  fresh:Number.isFinite(age)&&age>=-300000&&age<=86400000,
  posting_status:'UNTRACKED'};
}
async function saveV4PublicJd(env,source){
 const valid=normalized(source);if(!valid)throw Error('JD_NOT_COMPLETE_ENOUGH');
 const hash=await sha256Hex(valid.full_jd);
 const id='jd_'+(await sha256Hex(valid.canonical_url+'\n'+hash)).slice(0,32);
 const payload={...valid,id,jd_sha256:hash,checked_at:new Date().toISOString()};
 await env.HHBA_JOB_JD_R2.put(keyOf(id),JSON.stringify(payload),{httpMetadata:{contentType:'application/json'}});
 return readV4ArchivedJd(env,id);
}
export async function prepareV4JobForOptimization(env,url,{signal,fetcher=fetch,expectedTitle}={}){
 if(!jdArchiveConfigured(env))throw Error('JD_ARCHIVE_DISABLED');
 const canonical=v4PublicJobUrl(url);
 if(!canonical||board.test(new URL(canonical).hostname))throw Error('JD_NOT_COMPLETE_ENOUGH');
 let saved;
 const locator=safeJDSourceLocator(canonical);
 if(locator&&!locator.kind){
  try{
   saved=await readFreshJobJdByUrl(env,locator.url);
   if(!saved){const verified=await directOfficialJobEvidence(locator.url,{signal,fetcher});saved=await saveVerifiedJobJd(env,verified);}
  }catch{}
 }
 if(!saved?.fresh){
  const verified=await v4ReadEmployerJob(canonical,{signal,fetcher,expectedTitle});
  saved=await saveV4PublicJd(env,verified);
 }
 if(!saved?.fresh||saved.canonical_url!==canonical)throw Error('JD_NOT_COMPLETE_ENOUGH');
 if(expectedTitle&& !/待核实/.test(expectedTitle)&&norm(expectedTitle)!==norm(saved.title))
  throw Error('JD_JOB_IDENTITY_MISMATCH');
 return {company:saved.company,title:saved.title,title_zh:saved.title,location:saved.location,
  jd_version_id:saved.id,jd_sha256:saved.jd_sha256,jd_checked_at:saved.checked_at,
  jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',
  jd_proof_method:saved.proof_method,requirements_basis:saved.full_jd,
  recruitment_source_note:'已读取并保存招聘页面原文，是否仍可投递以招聘页面为准。'};
}
