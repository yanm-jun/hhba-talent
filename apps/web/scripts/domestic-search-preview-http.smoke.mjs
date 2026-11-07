import assert from 'node:assert/strict';
const base=process.env.HHBA_DOMESTIC_PILOT_PREVIEW||'https://8cfd4c6d.hhba-talent.pages.dev';
const root=new URL(base);
const enabledExpected=process.env.HHBA_DOMESTIC_PILOT_EXPECT_ENABLED==='1';
if(root.protocol!=='https:'||!root.hostname.endsWith('.hhba-talent.pages.dev'))throw Error('Unexpected Preview host');
async function read(path,config){
 const response=await fetch(new URL(path,root),{redirect:'manual',signal:AbortSignal.timeout(20000),...config});
 const body=await response.text();
 let data;try{data=JSON.parse(body);}catch{throw Error('Non-JSON response from '+path+' HTTP '+response.status);}
 return {response,data};
}
const status=await read('/api/match/discover');
assert.equal(status.response.status,200);
assert.equal(status.data.kind,'HHBA_DOMESTIC_DISCOVERY_V1');
assert.equal(status.data.scope,'CN_MAINLAND_ONLY');
assert.equal(status.data.integrated_into_top10,false);
assert.equal(status.data.enabled,enabledExpected,'Preview Search flag did not match expected state');
assert.equal(status.data.max_search_requests,2);
assert.equal(status.data.max_fetch_requests,3);
console.log(enabledExpected?'DOMESTIC_PILOT_PREVIEW_ON_CONFIRMED':'DOMESTIC_PILOT_PREVIEW_OFF_CONFIRMED');
const denied=await read('/api/match/discover',{
 method:'POST',headers:{'Content-Type':'application/json',Origin:root.origin},
 body:JSON.stringify({role_hint:'软件开发工程师',consent_search:true})
});
assert.equal(denied.response.status,enabledExpected?401:503);
assert.equal(denied.data.error,enabledExpected?'SESSION_INVALID':'EXTERNAL_SEARCH_NOT_ENABLED');
console.log('PREVIEW_PILOT_NO_ANONYMOUS_PROVIDER_SPEND_CONFIRMED');
const match=await read('/api/match/status');
assert.equal(match.response.status,200);
assert.equal(match.data.kind,'HHBA_RESUME_MATCH_CLOUDFLARE_V1');
assert.equal(match.data.scope,'CN_MAINLAND_ONLY');
console.log('EXISTING_MATCH_SERVICE_PRESERVED');
console.log('DOMESTIC_PILOT_HTTP_ALL_PASSED');
