// Reuse independently verified public HTML JD extraction only after a fresh
// read proves the *entire* source document unchanged and employer ownership is
// independently rechecked by the caller. No applicant data enters R2.
import {sha256Hex} from './real-auth.js';
import {v4PublicJobUrl} from './v4-open-job-evidence.js';
const text=v=>typeof v==='string'?v.trim():'';
const key=async url=>'official-jds/html-research-v1/'+await sha256Hex(url)+'.json';
export async function readPublicHtmlResearch(bucket,url){
 if(!bucket||v4PublicJobUrl(url)!==url)return null;
 try{
  const obj=await bucket.get(await key(url));if(!obj)return null;
  const r=JSON.parse(await obj.text());
  if(r.version!==1||r.canonical_url!==url||r.proof_method!=='V4_EMPLOYER_HTML_JOB'||r.source_confirmed!==true||r.independently_read!==true||
    !/^[a-f0-9]{64}$/.test(r.document_hash)||!text(r.company)||!text(r.title)||!text(r.location)||!text(r.full_jd)||
    !Array.isArray(r.employer_proof_urls)||!r.employer_proof_urls.every(u=>v4PublicJobUrl(u)===u)||
    !r.employer_proof_url||v4PublicJobUrl(r.employer_proof_url)!==r.employer_proof_url)return null;
  return r;
 }catch{return null}
}
export async function unchangedPublicHtmlResearch(record,doc){
 if(!record||doc?.url!==record.canonical_url||typeof doc?.plain!=='string'||!doc.plain.includes(record.full_jd))return false;
 return record.document_hash===await sha256Hex(doc.plain);
}
export async function writePublicHtmlResearch(bucket,doc,jd){
 if(!bucket||!doc||doc.url!==jd?.canonical_url||v4PublicJobUrl(doc.url)!==doc.url||
   jd.proof_method!=='V4_EMPLOYER_HTML_JOB'||jd.source_confirmed!==true||jd.independently_read!==true||
   typeof doc.plain!=='string'||!text(jd.full_jd)||!doc.plain.includes(jd.full_jd)||
   !jd.employer_proof_url||v4PublicJobUrl(jd.employer_proof_url)!==jd.employer_proof_url)return false;
 const chain=(jd.employer_proof_urls||[]).filter(u=>v4PublicJobUrl(u)===u);
 const record={version:1,canonical_url:doc.url,document_hash:await sha256Hex(doc.plain),
  company:jd.company,title:jd.title,location:jd.location,full_jd:jd.full_jd,requirements:jd.requirements,
  proof_method:jd.proof_method,source_confirmed:true,independently_read:true,employer_proof_url:jd.employer_proof_url,employer_proof_urls:chain};
 try{await bucket.put(await key(doc.url),JSON.stringify(record));return true}catch{return false}
}
