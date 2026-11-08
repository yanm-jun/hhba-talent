import assert from 'node:assert/strict';

// Public, no-login smoke. NO resume content, no provider API key and
// no credentialed request is sent. Endpoint must reject the unauthenticated
// POST BEFORE quota reservation or AI provider invocation.
const configured=process.env.HHBA_MATCH_V7_PREVIEW;
assert.ok(configured,'HHBA_MATCH_V7_PREVIEW must be set');
const root=new URL(configured);
assert.equal(root.protocol,'https:');
assert.ok(root.hostname.endsWith('.hhba-talent.pages.dev'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(path,init={}){
 const url=new URL(path,root);
 let err;
 for(let attempt=0;attempt<10;attempt++){
  try {
   const response=await fetch(url,{
    redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000),...init
   });
   // Pages deployment and DNS may briefly lag behind GitHub PR checks.
   if([502,503,504].includes(response.status)&&attempt<9){
    await sleep(7000);continue;
   }
   return response;
  } catch(e){err=e;if(attempt<9){await sleep(7000);continue;}}
 }
 throw new Error('LIVE_PREVIEW_UNREACHABLE: '+String(err?.message||'no healthy response'));
}

for(const route of ['/','/candidate/match']){
 let response=await request(route);
 if(response.status===308&&route!=='/'){
  // Cloudflare Pages may canonicalize a directory-backed SPA route by
  // appending a trailing slash. Follow ONLY the same-origin canonical route.
  const redirect=new URL(response.headers.get('location')||'',root);
  assert.equal(redirect.origin,root.origin,'preview redirect must stay same-origin');
  assert.equal(redirect.pathname,route+'/','only canonical trailing slash is allowed');
  assert.equal(redirect.search,'');
  response=await request(redirect.pathname);
 }
 assert.equal(response.status,200,route+' should serve the SPA');
 const type=response.headers.get('content-type')||'';
 assert.ok(type.includes('text/html'),route+' must return HTML');
 const html=await response.text();
 assert.match(html,/<title>HHBA/);
 assert.match(html,/<div id="root">/);
 console.log('HHBA_PREVIEW_ROUTE_OK',route);
}
async function json(path,init){
 const response=await request(path,init);
 assert.ok((response.headers.get('content-type')||'').includes('json'),path);
 const data=await response.json();
 return {status:response.status,data,headers:response.headers};
}

const status=await json('/api/match/status');
assert.equal(status.status,200);
assert.equal(status.data.kind,'HHBA_RESUME_MATCH_CLOUDFLARE_V1');
assert.equal(status.data.scope,'CN_MAINLAND_ONLY');
assert.equal(typeof status.data.enabled,'boolean');
assert.equal(status.headers.get('cache-control'),'private, no-store');
console.log('HHBA_PREVIEW_MATCH_STATUS_OK');

const discover=await json('/api/match/discover');
assert.equal(discover.status,200);
assert.equal(discover.data.kind,'HHBA_DOMESTIC_DISCOVERY_V1');
assert.equal(discover.data.scope,'CN_MAINLAND_ONLY');
assert.equal(typeof discover.data.enabled,'boolean');
console.log('HHBA_PREVIEW_DOMESTIC_SEARCH_STATUS_OK');

// Minimal uncredentialed request. The server must deny BEFORE parsing data,
// reserving quotas, reading private resumes or contacting DeepSeek.
const unauth=await json('/api/match/resume',{
 method:'POST',
 headers:{'Content-Type':'application/json','Origin':root.origin},
 body:JSON.stringify({}),
});
assert.equal(unauth.status,status.data.enabled?401:503);
assert.equal(unauth.data.error,status.data.enabled?'SESSION_INVALID':'MATCH_NOT_ENABLED');
console.log('HHBA_PREVIEW_ANONYMOUS_AI_SPEND_BLOCKED');
console.log('HHBA_MATCH_V7_PREVIEW_HTTP_ALL_PASSED');
