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
export function validOrigin(origin,url){
 try{return origin===new URL(url).origin}catch{return false}
}
