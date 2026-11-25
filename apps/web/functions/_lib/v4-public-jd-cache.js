// Only public, independently confirmed JobPosting records are cached.
// A strong origin ETag plus a successful conditional revalidation is required.
// No résumé, applicant identifier, score, model prompt or private page is stored.
import {sha256Hex} from './real-auth.js';
const FRESH=24*60*60*1000;
const text=v=>typeof v==='string'?v.trim():'';
const strong=v=>typeof v==='string'&&/^"[^"\r\n]+"$/.test(v)&&!v.startsWith('W/');
const identity=(url,expected)=>JSON.stringify([url,text(expected?.company),text(expected?.title||expected?.role),text(expected?.location||expected?.city)]);
const key=async(url,expected)=>'official-jds/v4-conditional/'+await sha256Hex(identity(url,expected))+'.json';
const eligible=jd=>jd?.proof_method==='V4_STRUCTURED_JOBPOSTING'&&jd.source_confirmed===true&&jd.independently_read===true&&!!text(jd.full_jd)&&!!text(jd.company)&&!!text(jd.title)&&!!text(jd.location);
const deadline=(date,now)=>date==null||date===''||Number.isFinite(Date.parse(date))&&Date.parse(date)>=now;
const publicHeaders=headers=>!/(?:^|,)\s*(?:private|no-store)\b/i.test(headers.get('cache-control')||'')&&!headers.has('set-cookie')&&(!headers.get('vary')||headers.get('vary').split(',').every(v=>['accept','accept-encoding'].includes(v.trim().toLowerCase())));
export async function readConditionalJd(bucket,url,expected,now=Date.now()){
 if(typeof bucket?.get!=='function')return null;
 try{
  const obj=await bucket.get(await key(url,expected));if(!obj)return null;
  const rec=JSON.parse(await obj.text());
  if(rec.kind!=='HHBA_PUBLIC_JD_CONDITIONAL_V1'||rec.identity!==identity(url,expected)||!strong(rec.etag)||!eligible(rec.jd)||rec.jd.canonical_url!==url||!Number.isFinite(rec.savedAt)||rec.savedAt>now||now-rec.savedAt>FRESH||!deadline(rec.validThrough,now))return null;
  if(rec.hash!==await sha256Hex(JSON.stringify([rec.identity,rec.etag,rec.savedAt,rec.validThrough,rec.jd])))return null;
  return rec;
 }catch{return null;}
}
export function canReuseConditionalJd(record,response,url,now=Date.now()){
 return !!record&&response.status===304&&response.headers.get('etag')===record.etag&&record.jd.canonical_url===url&&deadline(record.validThrough,now)&&publicHeaders(response.headers);
}
export async function writeConditionalJd(bucket,url,expected,response,jd,validThrough,now=Date.now()){
 if(typeof bucket?.put!=='function'||!eligible(jd)||jd.canonical_url!==url||!strong(response.headers.get('etag'))||response.status!==200||!publicHeaders(response.headers)||!deadline(validThrough,now))return false;
 try{
  const safe={id:jd.id,canonical_url:jd.canonical_url,company:jd.company,title:jd.title,location:jd.location,requirements:jd.requirements,full_jd:jd.full_jd,checked_at:jd.checked_at,proof_method:jd.proof_method,source_confirmed:true,independently_read:true,application_status:'NEEDS_OFFICIAL_CONFIRMATION'};
  const rec={kind:'HHBA_PUBLIC_JD_CONDITIONAL_V1',identity:identity(url,expected),etag:response.headers.get('etag'),savedAt:now,validThrough:validThrough||null,jd:safe};
  rec.hash=await sha256Hex(JSON.stringify([rec.identity,rec.etag,rec.savedAt,rec.validThrough,rec.jd]));
  await bucket.put(await key(url,expected),JSON.stringify(rec),{httpMetadata:{contentType:'application/json'}});
  return true;
 }catch{return false;}
}
