// Test a deployed Preview over public HTTPS; do not submit resumes or use API keys.
import assert from 'node:assert/strict';
const u=new URL(process.env.HHBA_PREVIEW_URL||'');
assert.equal(u.protocol,'https:');
assert.match(u.hostname,/^[0-9a-f]{8}\.hhba-talent\.pages\.dev$/);
assert.equal(u.pathname,'/');
assert.equal(u.search,'');assert.equal(u.hash,'');
const origin=u.origin;
async function request(path,options={}){
 const response=await fetch(origin+path,{...options,redirect:'follow',signal:AbortSignal.timeout(20000),cache:'no-store'});
 assert.equal(new URL(response.url).hostname,u.hostname,'Unexpected off-domain redirect');
 return response;
}
function jsonResponse(response,resource){
 assert.match(response.headers.get('content-type')||'',/application\/json/i,resource+' must be JSON');
}
const s=await request('/api/match/status');
assert.equal(s.status,200,'Cloudflare Pages AI status Function missing');
jsonResponse(s,'AI status');
const status=await s.json();
assert.equal(status.kind,'HHBA_RESUME_MATCH_CLOUDFLARE_V1');
assert.equal(typeof status.enabled,'boolean');
assert.equal(status.per_account_daily_limit,2);
assert.equal(status.global_daily_limit,60);
console.log('MATCH_STATUS_OK',status.enabled?'enabled':'disabled');

const page=await request('/candidate/match');
assert.equal(page.status,200,'Direct candidate route must serve HTML');
assert.match(page.headers.get('content-type')||'',/text\/html/i);
assert.match(await page.text(),/<!doctype html/i);
console.log('CANDIDATE_ROUTE_OK');

const external=await request('/api/match/resume',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'});
assert.equal(external.status,403);
jsonResponse(external,'Cross-origin denial');
console.log('CROSS_SITE_BLOCKED');

const anon=await request('/api/match/resume',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
assert.ok([401,503].includes(anon.status),'Anonymous requests must fail closed');
jsonResponse(anon,'Unauthorized denial');
console.log('ANONYMOUS_BLOCKED',anon.status);

async function jsonAsset(path){
 const response=await request(path);
 assert.equal(response.status,200,path+' asset missing');
 jsonResponse(response,path);
 return response.json();
}
const [jobs,audit,facets]=await Promise.all([
 jsonAsset('/data/jobs.json'),
 jsonAsset('/data/job-sync-status.json'),
 jsonAsset('/data/job-search-facets.json')
]);
assert.ok(Array.isArray(jobs.jobs)&&jobs.jobs.length>0);
assert.equal(audit.summary?.kind,'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1');
assert.equal(audit.summary?.indexed_as_of,jobs.updated);
assert.equal(facets.indexed_as_of,jobs.updated);
assert.equal(audit.jobs?.length,jobs.jobs.length);
assert.equal(facets.jobs?.length,jobs.jobs.length);
console.log('OFFICIAL_AUDIT_MATCHED',jobs.jobs.length);
console.log('HHBA_PREVIEW_HTTP_ALL_PASSED');
