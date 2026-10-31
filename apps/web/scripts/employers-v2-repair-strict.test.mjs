import assert from 'node:assert/strict';
import fs from 'node:fs';
const root='src/data/employerProfiles/',media='public/';
const read=p=>fs.readFileSync(p,'utf8');
const ids=Array.from({length:55},(_,n)=>String(n+11).padStart(3,'0'));
let count=0,assets=0,jobs=0,unverifiedMedia=0,missingRoles=[];
for(const num of ids){
 const id='cn-autumn-'+num,path=root+id+'.json';
 assert(fs.existsSync(path),'Missing V2 profile '+id);
 const p=JSON.parse(read(path));count++;
 assert.equal(p.id,id);assert.equal(p.schemaVersion,1);
 assert(p.name&&p.overview&&p.majorIntro&&p.recruitment?.url);
 assert.equal(p.business.length,6,'Six descriptive business areas required '+id);
 assert(p.business.every(b=>b.title&&b.description&&b.details?.length>=1),'Missing business descriptions '+id);
 assert(Array.isArray(p.jobs));
 if(p.jobs.length===0)missingRoles.push(id);
 assert(p.jobs.every(j=>j.category&&j.title&&j.summary&&j.requirements&&j.city&&j.evidenceUrl),'Missing job details '+id);
 assert(p.jobs.every(j=>Array.isArray(j.majorNames)&&Array.isArray(j.editorialRelatedMajors)&&typeof j.majorUnrestricted==='boolean'),'Major evidence status must be explicit '+id);
 assert(p.jobs.every(j=>j.currentOpenVerified===false),'Unsupported live recruiting status '+id);
 jobs+=p.jobs.length;
 const files=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(files).size,3,'3 independent images '+id);
 for(const f of files){assert(fs.existsSync(media+f),'Missing image '+id+' '+f);assert(fs.statSync(media+f).size>=100,'Tiny image '+f);assets++;}
 const localAudit='public/images/employer-profiles/'+id+'/media-audit.json';
 assert(fs.existsSync(localAudit),'Missing image provenance ledger '+id);
 const audit=JSON.parse(read(localAudit));
 const provenanceName=audit.company||Object.values(audit).find(v=>v&&typeof v==='object'&&v.company)?.company;
 assert(provenanceName===p.name,'Incorrect audit provenance '+id);
 if(audit.officialLogo===false||audit.realPhotos===false||audit.sourceVerification==='pending'||audit.realPhotoValidationComplete===false)unverifiedMedia++;
}
assert.equal(count,55);
assert.equal(missingRoles.length,0,'Empty job directions '+missingRoles.join(','));
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(page.includes('03[6-9]')&&page.includes('06[0-5]'),'36-65 must use same V2 template');
const oldMedia=['027','028','029','030','031','032','033','034','035'];
for(const id of oldMedia){const p=JSON.parse(read(root+'cn-autumn-'+id+'.json'));for(const f of [p.media.logo,...p.media.photos.map(x=>x.path)])assert(fs.existsSync(media+f),'Old broken image remains '+f);}
console.log('HHBA_REPAIR_STRICT_PASS',JSON.stringify({completeV2Profiles:count,mediaFiles:assets,jobs,noJobProfiles:missingRoles,provenanceToFurtherVerify:unverifiedMedia}));
