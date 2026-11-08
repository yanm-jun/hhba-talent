import assert from 'node:assert/strict';
const base=process.env.HHBA_NATIONAL_SEARCH_PREVIEW||'https://67a3cd3e.hhba-talent.pages.dev';
const root=new URL(base);
assert.equal(root.protocol,'https:');
assert.ok(root.hostname.endsWith('.hhba-talent.pages.dev'));
async function check(path,init={}){
 const response=await fetch(new URL(path,root),{
  redirect:'manual',signal:AbortSignal.timeout(25000),cache:'no-store',...init
 });
 const raw=await response.text();
 let json=null;
 if((response.headers.get('content-type')||'').includes('application/json'))
  try{json=JSON.parse(raw);}catch{throw Error('Invalid JSON: '+path);}
 return {status:response.status,json,raw};
}
const status=await check('/api/match/discover');
assert.equal(status.status,200);
assert.equal(status.json.kind,'HHBA_DOMESTIC_DISCOVERY_V1');
assert.equal(status.json.scope,'CN_MAINLAND_ONLY');
assert.equal(status.json.enabled,true);
assert.equal(status.json.max_search_requests,5);
assert.equal(status.json.max_fetch_requests,10);
assert.equal(status.json.cache_ttl_hours,24);
assert.equal(status.json.theoretical_search_fetch_cost_cap_cny,0.075);
assert.equal(status.json.integrated_into_top10,true);
console.log('NATIONAL_PREVIEW_5_SEARCH_10_FETCH_CONFIRMED');
const noToken=await check('/api/match/discover',{
 method:'POST',
 headers:{'Content-Type':'application/json',Origin:root.origin},
 body:JSON.stringify({role_hint:'数据分析师',consent_search:true})
});
assert.equal(noToken.status,401);
assert.equal(noToken.json?.error,'SESSION_INVALID');
console.log('NATIONAL_PREVIEW_UNAUTHORISED_POST_REJECTED_NO_SEARCH_CHARGE');
const match=await check('/api/match/status');
assert.equal(match.status,200);
assert.equal(match.json?.kind,'HHBA_RESUME_MATCH_CLOUDFLARE_V1');
assert.equal(match.json.scope,'CN_MAINLAND_ONLY');
console.log('EXISTING_PREVIEW_MATCH_STATUS_UNCHANGED');
// Pages may return a same-origin 308 for its canonical static SPA path.
const page=await fetch(new URL('/candidate/match',root),{
 redirect:'follow',signal:AbortSignal.timeout(25000),cache:'no-store'
});
assert.equal(page.status,200);
assert.equal(new URL(page.url).origin,root.origin);
assert.match(await page.text(),/<html|<div id=/i);
console.log('NATIONAL_PREVIEW_PAGE_HTTP_200');
console.log('NATIONAL_SEARCH_V2_HTTPS_SMOKE_ALL_PASSED');
