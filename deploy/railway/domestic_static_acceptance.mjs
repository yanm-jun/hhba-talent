import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('./live_jobs_preview.ts',import.meta.url),'utf8');
const observed=JSON.parse(readFileSync(new URL('./domestic_xiaomi_20261016.compact.json',import.meta.url),'utf8'));
assert.equal(observed.schema,1);
assert.equal(observed.kind,'OFFICIAL_LIST_OBSERVED');
assert.equal(observed.jobs.length,1010);
assert.equal(observed.verified_current_apply,0);
assert.equal(observed.verified_details,0);
assert.equal(observed.original_jsonl_sha256,'43f1937c0b2263a9e2334963f8f2becc074089f93ba26572ec2e11e8ea977d34');
assert.deepEqual(observed.channels,{SOCIAL:350,CAMPUS:350,INTERNSHIP:310});
const seen=new Set();
const types={S:0,C:0,I:0};
for(const job of observed.jobs){
 assert.ok(Array.isArray(job)&&job.length===4);
 const [channel,id,title,city]=job;
 assert.ok(Object.hasOwn(types,channel));
 assert.match(id,/^\d{12,22}$/);
 assert.ok(title.length>0&&city.length>0);
 assert.ok(!seen.has(channel+id));seen.add(channel+id);types[channel]++;
}
assert.deepEqual(types,{S:350,C:350,I:310});
for(const token of ['const domesticObserved:Job[]','rows.push(...domesticObserved,...meituanObserved)','domesticDetailHtml(job)','currentApplicationVerified:false','applyUrl:null','id="country"','id="recruitment"','country==="cn"','country==="global"','recruitmentType&&j.recruitmentType!==recruitmentType','titleStatus:"original"']){
 assert.ok(source.includes(token),'Missing guarded domestic feature: '+token);
}
assert.ok(source.includes('company:"OpenAI"')&&source.includes('company:"Figma"'),'Existing international sources must remain present');
assert.ok(source.includes('officialListUrl:job.company==="Meituan"?null:job.url'),'Xiaomi official list link retained');
assert.ok(source.includes('officialJobUrl:job.company==="Meituan"?job.url:null'),'Meituan exact official detail linked');
assert.ok(source.includes('applyUrl:null'),'Unverified application links remain unavailable');
assert.ok(source.includes('renderPortalDirectory()'),'Employer portal directory displayed separately');
assert.ok(!source.includes('originalJobUrlAssumedApproved'),'Unreviewed direct link contract');
console.log('HHBA_XIAOMI_ENV_SNAPSHOT_SHA256',createHash('sha256').update(JSON.stringify(observed.jobs)).digest('hex'));
console.log('HHBA_DOMESTIC_STATIC_PASS',JSON.stringify({observed:seen.size,channels:types,schema:observed.schema,reviewedApply:observed.verified_current_apply,reviewedJd:observed.verified_details,globalCompaniesRetained:true}));
