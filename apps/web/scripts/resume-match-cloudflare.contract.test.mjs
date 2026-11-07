import assert from 'node:assert/strict';
import test from 'node:test';
import {redactForModel,verifiedProfile,selectAuditedMatches} from '../functions/_lib/resume-match-core.js';
import {onRequest} from '../functions/api/match/[[path]].js';

test('contact identifiers removed while employment dates survive',()=>{
 const s=redactForModel('2020-2025 工作，手机13812345678，邮箱abc@example.com，身份证110101200301012345');
 assert.match(s,/2020-2025/);
 assert.doesNotMatch(s,/13812345678|abc@example.com|110101200301012345/);
});
test('AI cannot invent degrees, skills, work years or target roles',()=>{
 const text='学历：本科。数据分析工作3年。技能：Python 和 SQL';
 const p=verifiedProfile({education:'MASTER',education_evidence:'博士论文',
  experience_years:8,experience_evidence:'数据分析工作3年',
  skills:[{name:'Python',evidence:'技能：Python 和 SQL'},
   {name:'Rust',evidence:'技能：Python 和 SQL'}],
  target_roles:['数据分析','互联网大厂CEO']},text);
 assert.equal(p.education,null);
 assert.equal(p.experience_years,null);
 assert.deepEqual(p.skills.map(x=>x.name),['Python']);
 assert.deepEqual(p.target_roles,['数据分析']);
});
test('only same-snapshot audit, exact JD hash and secure official ATS can rank',()=>{
 const iso=new Date().toISOString();
 const good={id:'ashby-example-123456',company:'Example',title:'Python Data Analyst',
  location:'Singapore',url:'https://jobs.ashbyhq.com/example/123456',
  platform:'ashby',source:'example',remote:false};
 const bad={...good,id:'ashby-bad-12345',url:'https://attacker.example/offer'};
 const snapshot={updated:iso,jobs:[good,bad]};
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:iso,checked_at:iso},
  jobs:[good,bad].map((j,i)=>({job_id:j.id,platform:j.platform,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
   full_original_jd_verified:true,requirements_evidence:true,jd_sha256:String(i)}))};
 const facets={indexed_as_of:iso,verified_at:iso,
  jobs:[{id:good.id,countryCode:'SG',skills:['python'],original_source_hash:'0'},
    {id:bad.id,countryCode:'SG',skills:['python'],original_source_hash:'1'}]};
 const profile={skills:[{name:'Python',evidence:'Python'}],target_roles:['Data Analyst']};
 const out=selectAuditedMatches(snapshot,audit,facets,profile,{limit:10,country:'SG'});
 assert.equal(out.matches.length,1);
 assert.equal(out.matches[0].id,good.id);
 assert.ok(out.matches[0].reference_score<100);
 assert.throws(()=>selectAuditedMatches({...snapshot,updated:'2020-01-01'},audit,facets,profile),
   /OFFICIAL_JOB_INDEX_UNAVAILABLE/);
});
test('Cloudflare service is disabled by default and rejects cross-site uploads',async()=>{
 const status=await onRequest({request:new Request('https://hhba.work/api/match/status'),env:{}});
 assert.equal((await status.json()).enabled,false);
 const origin='https://hhba.work';
 const request=(o)=>new Request(origin+'/api/match/resume',{method:'POST',headers:{Origin:o},body:'{}'});
 assert.equal((await onRequest({request:request('https://evil.example'),env:{}})).status,403);
 assert.equal((await onRequest({request:request(origin),env:{}})).status,503);
});
