// Public analytics contract: aggregate-only, no page query strings, identity, IP or search text.
export const ALLOWED_EVENTS=new Set(['page_view','job_view','job_search','official_apply_click']);
export function normalizeEngagement(input){
 if(!input||typeof input!=='object'||!ALLOWED_EVENTS.has(input.type))return null;
 let path=typeof input.path==='string'?input.path:'';
 if(path.length>240||!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))return null;
 if(path.includes('?')||path.includes('#'))return null;
 // Keep only route families: never collect position IDs, query strings or personal profile slugs.
 if(/^\/candidate\/jobs\/[A-Za-z0-9_-]{1,180}$/.test(path))path='/candidate/jobs/:job';
 else if(/^\/companies\/(?:id\/)?[a-zA-Z0-9_-]{1,600}$/.test(path))path='/companies/:company';
 else if(/^\/public\/[a-zA-Z0-9_-]{1,200}$/.test(path))path='/public/:profile';
 else if(!new Set(['/','/candidate','/candidate/jobs','/candidate/jobs/archive','/candidate/match','/candidate/account','/candidate/saved','/employer','/employer/workspace','/companies','/auth']).has(path))path='/other';
 return {type:input.type,path};
}
// Railway terminates HTTPS at its proxy. Bun may receive an internal http:// URL,
// which must never be used as the canonical browser origin for CSRF checks.
// A trusted deployment variable, not a request-controlled proxy header, defines it.
export function validOrigin(origin,url,publicDomain=''){
 try{
  if(typeof origin!=='string'||!origin||origin==='null')return false;
  let expected=new URL(url).origin;
  if(publicDomain){
   const domain=String(publicDomain).toLowerCase();
   if(!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(domain)||domain.includes('..'))return false;
   expected=new URL('https://'+domain).origin;
  }
  return origin===expected;
 }catch{return false}
}
