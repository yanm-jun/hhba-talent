import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const identity=read('../src/services/companyDirectory.ts');
const indexed=read('../src/pages/IndexedCompanyPage.tsx');
const listing=read('../src/pages/CompanyDirectoryPage.tsx');
const jobCards=read('../src/components/UnifiedJobMarket.tsx');
const router=read('../src/router.tsx');
const main=read('../src/main.tsx');
const publicWeb=read('../../../ops/legacy-marketplace/railway-function-20261018.ts');
const editorial=read('../src/services/reviewedCompanyEditorial.ts');
const profiles=JSON.parse(read('../src/data/reviewedEmployers.json'));
test('every source-identifiable employer has stable URL, without merging unproven sources',()=>{
 assert.ok(identity.includes('JSON.stringify([identity.platform,identity.source,identity.company])'));
 assert.ok(identity.includes('new TextEncoder()'));
 assert.ok(identity.includes('new TextDecoder(\'utf-8\',{fatal:true})'));
 assert.ok(identity.includes('encodeEmployerIdentity(validated)!==key'));
 assert.ok(identity.includes('safeOfficialJobUrl(job)'));
 assert.ok(identity.includes('officialStatus(job,snapshot.updated)'));
 assert.ok(identity.includes('companyDirectoryFromSnapshot'));
 assert.ok(identity.includes('discoverEmployerJobs'));
});
test('all employer cards and details link to real employer profile while keeping job detail intact',()=>{
 assert.ok(jobCards.includes('companyPageRouteForJob(job)'));
 assert.ok(jobCards.includes('companyRoute?<Link className="unified-company-brand"'));
 assert.ok(jobCards.includes('generalCompanyRoute?<Link to={generalCompanyRoute}'));
 assert.ok(jobCards.includes("to={'/candidate/jobs/'+encodeURIComponent(job.id)}"));
 assert.ok(jobCards.includes('浏览企业资料库'));
 assert.ok(jobCards.includes('companyProfileForJob(job)'),'three hand-reviewed companies still have dedicated profiles');
});
test('company pages never invent business descriptions or logos for pending editorial',()=>{
 assert.ok(indexed.includes('NO_PROFILE_ZH'));
 assert.ok(indexed.includes('企业资料待补充'));
 assert.ok(indexed.includes('成立时间、重大事件尚未完成公开来源核实'));
 assert.ok(indexed.includes('<EmployerBrandLogo identity={identity} variant="profile"/>'));
 assert.ok(listing.includes('<EmployerBrandLogo identity={item.identity}/>'));
 assert.ok(!indexed.includes('img src='));
 assert.ok(indexed.includes("verifiedBrandKey")===false);
 assert.ok(indexed.includes("approvedEmployerJobIds(audit,snapshot.updated)"));
 assert.ok(indexed.includes("jobs.slice(0,shown)"));
 assert.ok(indexed.includes('company-profile-sources'));
 assert.ok(indexed.includes('getCompanyReturnTarget()'));
 assert.ok(editorial.includes("p.status!=='VERIFIED'"));
 assert.equal(profiles.schemaVersion,1);
 assert.ok(Array.isArray(profiles.profiles));
});
test('every dynamic page has a safe SPA deep link and browseable directory',()=>{
 assert.ok(main.includes("if(route==='/companies')"));
 assert.ok(main.includes('return <IndexedCompanyPage user={user}'));
 assert.ok(router.includes('const companyRoute='));
 assert.ok(router.includes('const directoryRoute='));
 assert.ok(publicWeb.includes('companies(?:\\/(?:openai|anthropic|spacex|id\\/'));
 assert.ok(listing.includes('companyDirectoryFromSnapshot(snapshot,approved)'));
 assert.ok(listing.includes('搜索企业资料库'));
 assert.ok(listing.includes('item.jobCount'));
});
test('offline review queue produces evidence-only records and never overwrites output',()=>{
 const folder=mkdtempSync(join(tmpdir(),'hhba-company-review-'));
 try{
  const jobs=[
   {id:'j1',company:'Synthetic Alpha',platform:'ashby',source:'alpha',
    url:'https://jobs.ashbyhq.com/alpha/aa'},
   {id:'j2',company:'Synthetic Alpha',platform:'ashby',source:'alpha',
    url:'https://jobs.ashbyhq.com/alpha/bb'},
   {id:'j3',company:'Synthetic Beta',platform:'lever',source:'beta',
    url:'https://jobs.lever.co/beta/cc'}
  ];
  const snapshot={updated:'2026-10-20T05:00:00Z',jobs};
  const audit={summary:{indexed_as_of:snapshot.updated},jobs:jobs.map(row=>({
   job_id:row.id,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND'
  }))};
  const jobPath=join(folder,'jobs.json'),auditPath=join(folder,'audit.json'),out=join(folder,'queue.json');
  writeFileSync(jobPath,JSON.stringify(snapshot));writeFileSync(auditPath,JSON.stringify(audit));
  const command=new URL('./export-company-review-queue.mjs',import.meta.url).pathname;
  const result=spawnSync(process.execPath,[command,jobPath,auditPath,out],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const queue=JSON.parse(readFileSync(out,'utf8'));
  assert.equal(queue.count,2);
  assert.deepEqual(queue.companies.map(x=>x.jobCount),[2,1]);
  assert.ok(queue.companies.every(x=>x.editorialStatus==='NEEDS_REVIEW'));
  assert.ok(queue.companies.every(x=>x.overviewZh===null&&x.companyLogo===null&&x.companyWebsite===null));
  assert.equal(JSON.parse(Buffer.from(queue.companies[0].id,'base64url').toString('utf8'))[2],'Synthetic Alpha');
  assert.notEqual(spawnSync(process.execPath,[command,jobPath,auditPath,out],{encoding:'utf8'}).status,0,
   'export must never overwrite existing review results');
 }finally{rmSync(folder,{recursive:true,force:true})}
});

test('new reviewed employer entries have exact source ID and multiple attributable references',()=>{
 const ids=new Set();
 for(const entry of profiles.profiles){
  assert.equal(entry.status,'VERIFIED');
  assert.equal(entry.id,Buffer.from(JSON.stringify([
   entry.identity.platform,entry.identity.source,entry.identity.company
  ]),'utf8').toString('base64url'));
  assert.equal(entry.name,entry.identity.company);
  assert.ok(!ids.has(entry.id));ids.add(entry.id);
  assert.match(entry.lastReviewed,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(entry.overview.length>=2&&entry.focus.length>=1);
  assert.ok(entry.sources.length>=2);
  assert.ok(entry.sources.every(s=>{
   try{return new URL(s.url).protocol==='https:'}catch{return false}
  }));
 }
 assert.ok(profiles.profiles.some(x=>x.name==='Anduril'),
  'Anduril pilot biography should prove that publishing reviewed JSON works');
});
