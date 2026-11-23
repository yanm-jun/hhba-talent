/**
 * Shared trusted JD archive bridge for Clean Match V2.
 *
 * The old search Agent / multi-layer shortlist is NOT used. This adapter
 * only promotes an independent official employer publication when its
 * public content was verified and an immutable JD snapshot was saved.
 * Public-source candidate jobs remain visible without a fake archive ID.
 */
import {safeJDSourceLocator,readFreshJobJdByUrl,saveVerifiedJobJd,
 jdArchiveReady} from './job-jd-archive.js';
import {directOfficialJobEvidence} from './official-job-evidence.js';
import {compareMatchResumeToJd} from './resume-jd-match-openai-v2.js';
import {findMainlandCity} from './mainland-job-location.js';

const norm=s=>String(s||'').normalize('NFKC').toLowerCase()
 .replace(/[\s._\-()（）【】]+/g,'')
 .replace(/(?:招聘|社招|社会招聘|岗位|职位)$/g,'')
 .replace(/(?:股份)?(?:有限公司|有限责任公司|股份有限公司|集团公司|集团)$/g,'');
const same=(a,b)=>Boolean(norm(a)&&norm(b))&&norm(a)===norm(b);
const sameWorkplace=(a,b)=>Boolean(findMainlandCity(a))&&
 findMainlandCity(a)===findMainlandCity(b);
const nonAts=locator=>locator&&!locator.kind;
export const CLEAN_V2_JD_BRIDGE='HHBA_CLEAN_V2_VERIFIED_JD_BRIDGE';

/**
 * Archive at most four independent employer details concurrently. No
 * resume or user identity is ever passed to the R2/D1 archive.
 * Model comparison can fail without destroying a truly verified posting.
 */
export async function archiveCleanMatchJobs(env,key,profile,matches,{
 signal,onActivity=()=>{},onPartial=()=>{},maxVerify=4
}={},deps={}){
 const source=Array.isArray(matches)?matches:[];
 const diag={mode:CLEAN_V2_JD_BRIDGE,eligible:0,attempted:0,
  verified:0,scored:0,failed:0,not_ready:false};
 const ready=deps.ready||jdArchiveReady;
 let enabled;
 try{enabled=await ready(env)}catch{enabled=false}
 if(!enabled){diag.not_ready=true;return {matches:source,diagnostic:diag}}
 const locatorOf=deps.locator||safeJDSourceLocator;
 const read=deps.read||readFreshJobJdByUrl;
 const fetchOfficial=deps.fetchOfficial||directOfficialJobEvidence;
 const save=deps.save||saveVerifiedJobJd;
 const compare=deps.compare||compareMatchResumeToJd;
 const out=[...source],candidates=[];
 for(let i=0;i<source.length;i++){
  const job=source[i],locator=locatorOf(job?.official_url);
  if(!nonAts(locator)||!same(job.company,locator.company))continue;
  candidates.push({job,locator,index:i});
 }
 diag.eligible=candidates.length;
 const picked=candidates.slice(0,Math.max(0,Math.min(6,maxVerify)));
 if(picked.length)onActivity({stage:'reading',
  message:'正在独立核对 '+picked.length+' 条企业官方岗位 JD，并保存可信版本用于 Word 简历优化。'});
 let cursor=0;
 const worker=async()=>{
  while(cursor<picked.length){
   if(signal?.aborted)return;
   const {job,locator,index}=picked[cursor++];
   diag.attempted++;
   try{
    let jd=await read(env,locator.url);
    if(!jd){
     const fetched=await fetchOfficial(locator.url,{signal});
     if(!fetched||fetched.canonical_url!==locator.url)throw Error('JD_SOURCE_NOT_VERIFIED');
     jd=await save(env,fetched);
    }
    // The verified posting must be the SAME advertised job and city;
    // hashing a different job on the same employer's site is not proof.
    if(!jd?.fresh||!jd.id||!jd.jd_sha256||
     jd.canonical_url!==locator.url||
     !same(job.company,jd.company)||!same(job.title,jd.title)||
     !sameWorkplace(job.location,jd.location)||
     !Array.isArray(jd.sections)||
     !jd.sections.some(x=>x.kind==='requirements')||
     !jd.sections.some(x=>x.kind==='responsibilities'))
     throw Error('JD_IDENTITY_INCOMPATIBLE');
    diag.verified++;
    let assessment=null;
    try{assessment=await compare(key,profile,jd,{signal,timeoutMs:26000})}catch{}
    const score=Number.isInteger(assessment?.score)&&assessment.score>=0&&assessment.score<=100?
     assessment.score:null;
    if(score!==null)diag.scored++;
    out[index]={...job,company:jd.company,title:jd.title,title_zh:jd.title,
     location:jd.location,match_score:score,reference_score:score??0,
     score_basis:score!==null?'已核对企业完整岗位 JD 与简历原文证据；具体对应项见下方。':'完整岗位 JD 已核验，但本轮简历证据不足以给出可靠分数。',
     recommendation_reason:score===null?
      '已取得并保存本岗位完整官方 JD，简历适配分尚未取得充分证据；请逐项核对职位要求。':
      '已取得并保存本岗位完整官方 JD，以下为简历原文与职位要求的逐项对应。',
     matched:[],not_evidenced:[],jd_comparisons:assessment?.comparisons||[],
     jd_version_id:jd.id,jd_sha256:jd.jd_sha256,jd_checked_at:jd.checked_at,
     jd_source_status:'VERIFIED_JD',source_status:'OFFICIAL_JD_VERIFIED',
     jd_score_status:score===null?'INSUFFICIENT_RESUME_EVIDENCE':'AI_VERIFIED_JD_SCORED',
     evidence_status:'VERIFIED_FULL_JD',evidence_score_status:undefined,
     jd_proof_method:jd.proof_method,
     requirements_basis:jd.sections.filter(x=>x.kind==='requirements')
      .map(x=>x.text).join('\n').slice(0,2000),
     availability_status:'UNKNOWN',
     availability_note:'已核验 JD 原文；招聘是否仍开放需在企业官网确认'};
    onPartial(out);
   }catch{diag.failed++}
  }
 };
 await Promise.all(Array.from({length:Math.min(2,picked.length)},()=>worker()));
 return {matches:out,diagnostic:diag};
}
