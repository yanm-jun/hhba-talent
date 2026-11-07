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
assert.equal(status.scope,'CN_MAINLAND_ONLY','Preview service must be mainland-only');
assert.equal(typeof status.enabled,'boolean');
assert.equal(status.per_account_daily_limit,2);
assert.equal(status.global_daily_limit,60);
if(process.env.HHBA_EXPECT_MATCH_ENABLED==='1')assert.equal(status.enabled,true,
 'Pilot Preview must expose enabled=true only when dedicated key, pepper and D1 are correctly bound');
console.log('MATCH_STATUS_OK',status.enabled?'enabled':'disabled');
const diagnostic=await request('/api/match/provider-check');
assert.equal(diagnostic.status,401,'Unauthenticated provider balance checks must be denied');
jsonResponse(diagnostic,'Provider diagnostic access denial');
const denied=await diagnostic.json();
assert.equal(denied.error,'SESSION_INVALID');
console.log('PROVIDER_CHECK_REQUIRES_LOGIN');


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
if(process.env.HHBA_EXPECT_MATCH_ENABLED==='1')assert.equal(anon.status,401,
 'Enabled pilot must reject unauthenticated requests before any AI invocation');
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
const {selectAuditedMatches,countVerifiedMainlandJobs}=await import('../functions/_lib/resume-match-core.js');
const profile={education:null,experience_years:null,
 skills:[{name:'Python',evidence:'Python'}],target_roles:['software engineer']};
const selected=selectAuditedMatches(jobs,audit,facets,profile,
 {country:'CN',remote_only:false,role_hint:'software engineer',limit:10},Date.now());
const mainlandCount=countVerifiedMainlandJobs(jobs,audit,facets);
assert.ok(Number.isInteger(mainlandCount)&&mainlandCount>=0);
assert.ok(selected.matches.length<=10);
assert.ok(selected.matched_official_jobs<=mainlandCount);
console.log('DOMESTIC_VERIFIED_JOBS_COUNT',mainlandCount);
assert.equal(new Set(selected.matches.map(x=>x.company.toLowerCase()+'|'+x.title.toLowerCase())).size,
 selected.matches.length,'Same employer+title must not repeat in Top 10');
for(const job of selected.matches){
 assert.match(job.official_url,/^https:\/\//);
 assert.equal(job.source_type,'HHBA站内岗位');
 assert.ok(job.reference_score<100,'Relevance must never be presented as hiring probability');
 assert.ok(job.needs_verification.length>0);
}
console.log('REAL_MATCHER_INDEX_CONFIRMED',
 JSON.stringify({eligibleSelected:selected.matches.length,matchingOfficialRoles:selected.matched_official_jobs}));

console.log('HHBA_PREVIEW_HTTP_ALL_PASSED');
