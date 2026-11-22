/**
 * A posting's identity must not depend on the current Search result index,
 * history entry id or mutable JD content version.
 *
 * Word revisions and saved targeted-resume drafts are scoped to:
 * account + original resume + canonical employer posting URL.
 * Never use an unstable "search-j1" / "history-..." UI id as a storage key.
 */
const MASK=(1n<<64n)-1n;
const PRIME=1099511628211n;
const SEED_1=14695981039346656037n;
const SEED_2=7809847782465536322n;
const TRACKING=/^(?:utm_[a-z0-9_]+|gh_src|lever-source|from|source|ref|referrer|tracking|campaign)$/i;

export function normalizePostingUrl(value){
 if(typeof value!=='string'||value.length>1800)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||
   !u.hostname.includes('.'))return null;
  u.pathname=u.pathname.replace(/\/+$/,'')||'/';
  for(const key of [...u.searchParams.keys()]){
   if(TRACKING.test(key))u.searchParams.delete(key);
  }
  u.searchParams.sort();
  return u.href;
 }catch{return null;}
}
function fnv64(bytes,seed){
 let h=seed;
 for(const b of bytes)h=((h^BigInt(b))*PRIME)&MASK;
 return h.toString(16).padStart(16,'0');
}
export function stablePostingScope(officialUrl){
 const canonical=normalizePostingUrl(officialUrl);
 if(!canonical)return null;
 const bytes=new TextEncoder().encode(canonical);
 return 'posting-url-v1-'+fnv64(bytes,SEED_1)+fnv64(bytes,SEED_2);
}
