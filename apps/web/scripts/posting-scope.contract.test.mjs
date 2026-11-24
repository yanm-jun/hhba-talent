import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePostingUrl,stablePostingScope} from '../src/services/stablePostingScope.mjs';

const u='https://jobs.example.org/team/role-123?job_id=role-123&from=search&utm_source=hhba';
test('independent search or history IDs cannot change one posting Word scope',()=>{
 const a=stablePostingScope(u);
 const b=stablePostingScope('https://jobs.example.org/team/role-123/?utm_source=history&job_id=role-123');
 assert.equal(a,b);
 assert.match(a,/^posting-url-v1-[a-f0-9]{32}$/);
 assert.ok(a.length<=160);
});
test('distinct actual job URLs never share a scope even when search reuses the same transient card ID',()=>{
 const x=stablePostingScope('https://jobs.example.org/team/role-123?job_id=role-123');
 const y=stablePostingScope('https://jobs.example.org/team/role-999?job_id=role-999');
 assert.notEqual(x,y);
});
test('query identifiers are significant, tracking parameters are not',()=>{
 assert.equal(stablePostingScope('https://jobs.example.org/apply?job_id=a&utm_campaign=1'),
  stablePostingScope('https://jobs.example.org/apply?utm_campaign=2&job_id=a'));
 assert.notEqual(stablePostingScope('https://jobs.example.org/apply?job_id=a'),
  stablePostingScope('https://jobs.example.org/apply?job_id=b'));
 assert.equal(normalizePostingUrl('https://jobs.example.org/role/?z=2&a=1'),
  'https://jobs.example.org/role?a=1&z=2');
});
test('a changed JD hash or past search never changes this posting identity',()=>{
 const posting=stablePostingScope(u);
 const stored={oldJdVersion:'jd_'+ '1'.repeat(32),newJdVersion:'jd_'+ '2'.repeat(32)};
 assert.notEqual(stored.oldJdVersion,stored.newJdVersion);
 assert.equal(posting,stablePostingScope(u));
});
test('invalid links must never accidentally edit the unscoped original Word',()=>{
 for(const url of ['http://jobs.example.org/role','https://u:pw@jobs.example.org/role',
  'https://jobs.example.org:8443/role','https://jobs.example.org/role#part','invalid',null]){
  assert.equal(stablePostingScope(url),null);
 }
});
test('UI keeps Word, saved versions and session drafts under the same stable posting scope',()=>{
 const source=readFileSync(new URL('../src/components/TargetedResumeOptimization.tsx',import.meta.url),'utf8');
 assert.match(source,/postingScope=useMemo\(\(\)=>stablePostingScope\(job\.official_url,MATCH_V4_PREVIEW\?job\.posting_key:undefined\)/);
 assert.match(source,/jobId=\{postingScope\}/);
 assert.match(source,/listResumeVersions\(postingScope\)/);
 assert.match(source,/saveResumeVersion\(\{id:postingScope/);
 assert.match(source,/encodeURIComponent\(postingScope\)/);
 assert.doesNotMatch(source,/jobId=\{job\.id\}/);
});
test('verified JD previously used to score cannot silently be refreshed to a new version for rewriting',()=>{
 const source=readFileSync(new URL('../src/components/TargetedResumeOptimization.tsx',import.meta.url),'utf8');
 assert.match(source,/getArchivedJobJdVersion\(job\.jd_version_id/);
 assert.match(source,/official\.jd_sha256!==job\.jd_sha256/);
 assert.match(source,/if\(!official\.fresh\)/);
 assert.doesNotMatch(source,/if\(!official\)official=await ensureArchivedJobJd/);
});


test('V4 two distinct vacancies on one URL never share a Word scope, even for long public URLs',async()=>{
 const {v4PostingKey}=await import('../src/services/v4PostingIdentity.mjs');
 const long='https://jobs.example.org/list?parameters='+'a'.repeat(1900);
 const a=v4PostingKey({company:'企业',title:'运营',location:'北京'},long),b=v4PostingKey({company:'企业',title:'培训',location:'北京'},long);
 assert.notEqual(a,b);assert.match(stablePostingScope(long,a),/^posting-url-v1-[a-f0-9]{32}$/);assert.notEqual(stablePostingScope(long,a),stablePostingScope(long,b));
});
