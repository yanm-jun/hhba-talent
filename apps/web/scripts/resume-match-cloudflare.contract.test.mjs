import assert from 'node:assert/strict';
import test from 'node:test';
import {redactForModel,verifiedProfile,selectAuditedMatches} from '../functions/_lib/resume-match-core.js';
import {fuseDomesticJobRecommendations} from '../functions/_lib/domestic-match-fusion.js';
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
  location:'Shanghai, China',url:'https://jobs.ashbyhq.com/example/123456',
  platform:'ashby',source:'example',remote:false};
 const bad={...good,id:'ashby-bad-12345',url:'https://attacker.example/offer'};
 const snapshot={updated:iso,jobs:[good,bad]};
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:iso,checked_at:iso},
  jobs:[good,bad].map((j,i)=>({job_id:j.id,platform:j.platform,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
   full_original_jd_verified:true,requirements_evidence:true,jd_sha256:String(i)}))};
 const facets={indexed_as_of:iso,verified_at:iso,
  jobs:[{id:good.id,countryCode:'CN',cityKey:'shanghai',skills:['python'],original_source_hash:'0'},
    {id:bad.id,countryCode:'CN',cityKey:'shanghai',skills:['python'],original_source_hash:'1'}]};
 const profile={skills:[{name:'Python',evidence:'Python'}],target_roles:['Data Analyst']};
 const out=selectAuditedMatches(snapshot,audit,facets,profile,{limit:10,country:'CN'});
 assert.equal(out.matches.length,1);
 assert.equal(out.matches[0].id,good.id);
 assert.ok(out.matches[0].reference_score<100);
 assert.throws(()=>selectAuditedMatches({...snapshot,updated:'2020-01-01'},audit,facets,profile),
   /OFFICIAL_JOB_INDEX_UNAVAILABLE/);
});
test('V2 scores the full validated candidate pool before selecting Top 10',()=>{
 const time=Date.now(),iso=new Date(time).toISOString(),jobs=[],audited=[],facts=[];
 for(let i=0;i<72;i++){
  const source='precision'+i,id='ashby-'+source+'-role'+i,hash='hash'+i;
  jobs.push({id,company:'示例企业'+i,title:'Python 开发工程师',
   location:'上海',url:'https://jobs.ashbyhq.com/'+source+'/role'+i,
   platform:'ashby',source,remote:false});
  audited.push({job_id:id,platform:'ashby',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
   full_original_jd_verified:true,requirements_evidence:true,jd_sha256:hash});
  facts.push({id,countryCode:'CN',skills:['python','sql'],experienceMinYears:2,
   education:'BACHELOR',original_source_hash:hash});
 }
 const snapshot={updated:iso,jobs};
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',
  indexed_as_of:iso,checked_at:iso},jobs:audited};
 const facets={indexed_as_of:iso,verified_at:iso,jobs:facts};
 const candidate={skills:[{name:'Python'},{name:'SQL'}],experience_years:3,
  education:'BACHELOR',target_roles:['Python 开发工程师']};
 const old=selectAuditedMatches(snapshot,audit,facets,candidate,{limit:10},time);
 assert.equal(old.matches.length,10,'legacy response contract stays Top 10');
 const pool=selectAuditedMatches(snapshot,audit,facets,candidate,
  {role_hint:'Python 开发工程师',candidate_pool_limit:1200},time);
 assert.equal(pool.matches.length,72,'no premature 60-item cutoff');
 const final=fuseDomesticJobRecommendations(pool.matches,[],candidate,
  {role_hint:'Python 开发工程师',limit:10},time);
 assert.equal(final.matches.length,10);
 assert.equal(new Set(final.matches.map(x=>x.company)).size,10);
 assert.ok(final.matches.every(x=>x.ranking_version==='HHBA_MATCH_RANKING_V2'));
});

test('Cloudflare service is disabled by default and rejects cross-site uploads',async()=>{
 const status=await onRequest({request:new Request('https://hhba.work/api/match/status'),env:{}});
 assert.equal((await status.json()).enabled,false);
 const origin='https://hhba.work';
 const request=(o)=>new Request(origin+'/api/match/resume',{method:'POST',headers:{Origin:o},body:'{}'});
 assert.equal((await onRequest({request:request('https://evil.example'),env:{}})).status,403);
 assert.equal((await onRequest({request:request(origin),env:{}})).status,503);
});


test('rejects degree-level mismatch even when evidence is a real excerpt',()=>{
 const text='学历：本科，2019-2023 本科毕业。工作经历：市场营销';
 const bad=verifiedProfile({education:'MASTER',education_evidence:'学历：本科',
  experience_years:null,experience_evidence:null,skills:[],target_roles:[]},text);
 const good=verifiedProfile({education:'BACHELOR',education_evidence:'学历：本科',
  experience_years:null,experience_evidence:null,skills:[],target_roles:[]},text);
 assert.equal(bad.education,null);
 assert.equal(good.education,'BACHELOR');
});
test('incorrect employer board identity cannot be recommended',()=>{
 const now=Date.now(),iso=new Date(now).toISOString();
 const job={id:'ashby-acme-abcdef',company:'Acme',title:'Python Developer',
  location:'Shanghai, China',url:'https://jobs.ashbyhq.com/other-board/abcdef',
  platform:'ashby',source:'acme',remote:true};
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:iso,checked_at:iso},
  jobs:[{job_id:job.id,platform:job.platform,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
    full_original_jd_verified:true,requirements_evidence:true,jd_sha256:'hash'}]};
 const facets={indexed_as_of:iso,verified_at:iso,
  jobs:[{id:job.id,countryCode:'CN',cityKey:'shanghai',skills:['python'],original_source_hash:'hash'}]};
 const profile={target_roles:['Python Developer'],skills:[{name:'Python',evidence:'Python'}]};
 assert.equal(selectAuditedMatches({jobs:[job],updated:iso},audit,facets,profile,{limit:10},now).matches.length,0);
});

test('privacy-reviewed empty text never silently falls back to raw resume',async()=>{
 const {readFile}=await import('node:fs/promises');
 const ui=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(ui,/if\(previewLoaded\)/);
 assert.match(ui,/previewLoaded&&previewText\.replace\(\/\\s\/g,''\)\.length<30/);
 assert.match(ui,/setPreviewLoaded\(false\);setConsent\(false\);setSavedId/);
 assert.match(ui,/Once the user has reviewed\/edited text, NEVER fall back/);
});


test('saved R2 resumes offer direct AI navigation without auto-upload or auto-consent',async()=>{
 const {readFile}=await import('node:fs/promises');
 const vault=await readFile(new URL('../src/components/PrivateResumeVault.tsx',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(vault,/candidate\/match\?resume=/);
 assert.match(page,/deepLinkPending\.current/);
 assert.match(page,/rows\.some\(item=>item\.id===requested\)/);
 assert.match(page,/setSavedId\(requested\)/);
 assert.doesNotMatch(vault,/submitResumeForMatching/);
});
test('Top 10 never repeats company+title just because an ATS job has more locations',()=>{
 const now=Date.now(),at=new Date(now).toISOString();
 const companies=[['acme','Data Analyst','111','Shanghai, China'],['acme','Data Analyst','222','Beijing, China'],
  ['acme','Data Scientist','333','Shanghai, China'],['acme','Data Engineer','444','Shanghai, China'],
  ['beta','Data Scientist','555','Shanghai, China'],['gamma','Data Analyst','666','Shanghai, China']];
 const jobs=companies.map(([source,title,id,location])=>({
  id:'ashby-'+source+'-'+id,source,company:source,title,location,
  url:'https://jobs.ashbyhq.com/'+source+'/'+id,platform:'ashby',remote:false
 }));
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:at,checked_at:at},
  jobs:jobs.map(x=>({job_id:x.id,platform:x.platform,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
   full_original_jd_verified:true,requirements_evidence:true,jd_sha256:'sha-'+x.id}))};
 const facets={indexed_as_of:at,verified_at:at,
  jobs:jobs.map(x=>({id:x.id,countryCode:'CN',cityKey:'shanghai',skills:['sql'],original_source_hash:'sha-'+x.id}))};
 const p={skills:[{name:'SQL',evidence:'SQL'}],target_roles:['Data Analyst']};
 const out=selectAuditedMatches({updated:at,jobs},audit,facets,p,{limit:10},now);
 const identities=out.matches.map(x=>x.company+'|'+x.title);
 assert.equal(out.matched_official_jobs,5);
 assert.equal(new Set(identities).size,identities.length);
 assert.equal(out.matches.length,5);
 assert.ok(out.matches.find(x=>x.company==='beta'));
 assert.ok(out.matches.find(x=>x.company==='gamma'));
 assert.equal(out.matches.filter(x=>x.company==='acme').length,3);
});


test('native match has one upload action and retains separate explicit AI consent',async()=>{
 const {readFile}=await import('node:fs/promises');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(page,/单独授权 HHBA 将本次简历文字/);
 assert.match(page,/DeepSeek API/);
 assert.match(page,/不保证完全匿名/);
 assert.match(page,/开始智能匹配/);
 assert.match(page,/CandidateMatchNativeDialog/);
 assert.doesNotMatch(page,/检测 AI 密钥及余额（不消耗匹配次数）/);
});

test('even a forged overseas preference cannot force foreign jobs into Top 10',()=>{
 const now=Date.now(),at=new Date(now).toISOString();
 const rows=[['main','Shanghai, China','CN'],['us','San Francisco, USA','US'],
  ['hk','Hong Kong, China','CN'],['tw','Taipei, Taiwan','CN'],
  ['remote','Remote, China','CN']];
 const jobs=rows.map(([id,location])=>({id:'ashby-company-'+id,company:'Company',
  title:'Data Analyst',location,url:'https://jobs.ashbyhq.com/company/'+id,
  source:'company',platform:'ashby'}));
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:at,checked_at:at},
  jobs:jobs.map(j=>({job_id:j.id,platform:'ashby',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
   full_original_jd_verified:true,requirements_evidence:true,jd_sha256:j.id}))};
 const facets={indexed_as_of:at,verified_at:at,
  jobs:rows.map(([id,,countryCode])=>({id:'ashby-company-'+id,countryCode,
   original_source_hash:'ashby-company-'+id,skills:['sql']}))};
 const profile={skills:[{name:'SQL',evidence:'SQL'}],target_roles:['Data Analyst']};
 const matched=selectAuditedMatches({jobs,updated:at},audit,facets,profile,{country:'US',limit:10},now);
 assert.deepEqual(matched.matches.map(x=>x.id),['ashby-company-main']);
});


test('native Top10 is in a focus-managed single dialog with reasons and direct URLs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const dialog=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(page,/result\|\|partialJobs\.length>0/);
 assert.doesNotMatch(page,/hhba-ai-results/);
 assert.match(page,/country:'CN'/);
 assert.match(dialog,/createPortal/);
 assert.match(dialog,/role="dialog"/);
 assert.match(dialog,/aria-modal="true"/);
 assert.match(dialog,/event\.key==='Escape'/);
 assert.match(dialog,/onMouseDown/);
 assert.match(dialog,/document\.body\.style\.overflow='hidden'/);
 assert.match(dialog,/job\.recommendation_reason/);
 assert.match(dialog,/href=\{job\.official_url\}/);
});

test('same-version audited internal job with minimum 7 years is rejected for 3-year applicant',()=>{
 const at=new Date().toISOString();
 const job={id:'ashby-domestic-abc12345',company:'国内企业',title:'Python Developer',
  location:'Shanghai, China',url:'https://jobs.ashbyhq.com/domestic/abc12345',
  source:'domestic',platform:'ashby',remote:false};
 const snapshot={updated:at,jobs:[job]};
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:at,checked_at:at},
  jobs:[{job_id:job.id,platform:'ashby',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
   full_original_jd_verified:true,requirements_evidence:true,jd_sha256:'sourcehash'}]};
 const facets={indexed_as_of:at,verified_at:at,jobs:[{id:job.id,countryCode:'CN',
  original_source_hash:'sourcehash',skills:['python'],experienceMinYears:7,education:'BACHELOR'}]};
 const three={experience_years:3,education:'BACHELOR',target_roles:['Python Developer'],skills:[{name:'Python'}]};
 const eight={...three,experience_years:8};
 assert.equal(selectAuditedMatches(snapshot,audit,facets,three,{limit:10}).matches.length,0);
 const accepted=selectAuditedMatches(snapshot,audit,facets,eight,{limit:10}).matches;
 assert.equal(accepted.length,1);
 assert.equal(accepted[0].experience_requirement,'7年以上');
});
