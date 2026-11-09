/**
 * HHBA V8: cache ONLY a previously independent, fetched employer->recruitment
 * source proof. It is NOT a cache of job listings, vacancies, or eligibility.
 *
 * D1 stores public employer/website URLs, never resumes, query text,
 * website bodies, personal identifiers, browser output or model messages.
 * 72-hour expiry is checked on every read. Errors fail open to FULL source
 * verification (not to admitting the vacancy).
 */
export const TRUSTED_SOURCE_TTL_HOURS=72;
const PROOF_TYPES=new Set([
 'CORPORATE_DOMAIN_AND_BRAND','CORPORATE_EXACT_JOB_LINK','CORPORATE_NAMED_BOARD_LINK'
]);
const MAX_AGE=TRUSTED_SOURCE_TTL_HOURS*3600000;

function sourceUrl(s){
 if(typeof s!=='string'||s.length>420)return null;
 try{
  const u=new URL(s);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+){1,5}$/i.test(u.hostname)||
    /(?:^|\.)localhost$/i.test(u.hostname)||u.hostname.includes('xn--')||
    /^\d+(?:\.\d+){3}$/u.test(u.hostname))return null;
  return u;
 }catch{return null;}
}
function companyRoot(host){
 const p=String(host||'').toLowerCase().split('.');
 if(p.length<2)return null;
 const suffix=p.slice(-2).join('.');
 return ['com.cn','net.cn','org.cn'].includes(suffix)&&p.length>=3?
  p.slice(-3).join('.'):suffix;
}
export function validSourceProof(row,job,now=new Date()){
 if(!row||!job||job.source_status!=='PUBLIC_JOB_UNCONFIRMED'||
  job.has_application_cta!==true||typeof job.company_claim!=='string'||
  row.employer_claim!==job.company_claim.trim()||!PROOF_TYPES.has(row.proof_method))
  return null;
 const link=sourceUrl(job.official_url),source=sourceUrl(row.employer_site),
  scope=sourceUrl(row.proof_scope);
 const checked=Date.parse(row.verified_at),expiry=Date.parse(row.expires_at);
 const timestamp=new Date(now).getTime();
 if(!Number.isFinite(checked)||!Number.isFinite(expiry)||!Number.isFinite(timestamp)||
  checked>timestamp+120000||timestamp>=expiry||expiry-checked>MAX_AGE+120000||
  checked<timestamp-MAX_AGE-120000||!link||!source||!scope||
  link.hostname!==row.job_hostname||row.employer_claim.length>65)return null;
 if(row.proof_method==='CORPORATE_DOMAIN_AND_BRAND'){
  if(scope.href!=='https://'+link.hostname+'/'||
    !companyRoot(link.hostname)||
    companyRoot(link.hostname)!==companyRoot(source.hostname))
   return null;
 }else{
  // Shared ATS: never trust the vendor's domain; trust ONLY the exact
  // third-party vacancy or a board prefix explicitly linked by the employer.
  if(scope.hostname!==link.hostname)return null;
  if(row.proof_method==='CORPORATE_EXACT_JOB_LINK'){
   if(scope.href!==link.href)return null;
  }else{
   if(scope.search||scope.pathname.split('/').filter(Boolean).length<2||
     !link.pathname.startsWith(scope.pathname.replace(/\/+$/,'')+'/'))
    return null;
  }
 }
 const {company_claim,_job_page_title,_page_excerpt,...evidence}=job;
 return {...evidence,company:row.employer_claim,
  source_status:'OFFICIAL_DETAIL_FETCHED',
  source_verification:row.proof_method,
  employer_site:row.employer_site,
  source_proof_checked_at:row.verified_at,
  source_proof_cache:'VALID_72H_EMPLOYER_SOURCE'};
}
export function cachedSourceRecord(checked,job,now=new Date()){
 if(checked?.reason!=='VERIFIED'||!checked.job||
  !job||typeof job.company_claim!=='string')return null;
 const result=checked.job;
 if(!PROOF_TYPES.has(result.source_verification)||!checked.cache_scope||
   result.company!==job.company_claim.trim())return null;
 const date=new Date(now),when=date.getTime();
 if(!Number.isFinite(when))return null;
 const row={
  employer_claim:result.company,
  job_hostname:sourceUrl(job.official_url)?.hostname,
  proof_scope:checked.cache_scope,
  proof_method:result.source_verification,
  employer_site:result.employer_site,
  verified_at:date.toISOString(),
  expires_at:new Date(when+MAX_AGE).toISOString()
 };
 return validSourceProof(row,job,date)?row:null;
}
export function createTrustedEmployerSourceCache(db,{now=()=>new Date()}={}){
 if(!db||typeof db.prepare!=='function')return null;
 return {
  async lookup(job){
   if(!job?.company_claim||typeof job.company_claim!=='string')return null;
   const u=sourceUrl(job.official_url);
   if(!u)return null;
   try{
    const response=await db.prepare(
     'SELECT employer_claim,job_hostname,proof_scope,proof_method,'+
     'employer_site,verified_at,expires_at FROM hhba_match_trusted_employer_sources '+
     'WHERE employer_claim=? AND job_hostname=? AND expires_at>? '+
     'ORDER BY LENGTH(proof_scope) DESC LIMIT 12'
    ).bind(job.company_claim.trim(),u.hostname,new Date(now()).toISOString()).all();
    for(const row of (response?.results||[])){
     const found=validSourceProof(row,job,now());
     if(found)return found;
    }
   }catch{ /* Source cache unavailable => fresh independent proof required. */ }
   return null;
  },
  async remember(checked,job){
   const row=cachedSourceRecord(checked,job,now());
   if(!row)return false;
   try{
    const saved=await db.prepare(
     'INSERT INTO hhba_match_trusted_employer_sources('+
     'employer_claim,job_hostname,proof_scope,proof_method,employer_site,verified_at,expires_at)'+
     ' VALUES(?,?,?,?,?,?,?) ON CONFLICT(employer_claim,job_hostname,proof_scope) '+
     'DO UPDATE SET proof_method=excluded.proof_method,employer_site=excluded.employer_site,'+
     'verified_at=excluded.verified_at,expires_at=excluded.expires_at'
    ).bind(row.employer_claim,row.job_hostname,row.proof_scope,row.proof_method,
      row.employer_site,row.verified_at,row.expires_at).run();
    return saved?.success===true&&saved?.meta?.changes===1;
   }catch{return false;}
  }
 };
}
