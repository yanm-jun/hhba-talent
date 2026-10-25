import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const parse=async path=>JSON.parse(await readFile(path,'utf8'));
const [feed,facets,archive,seeds]=await Promise.all([
  parse('dist/data/jobs.json'),parse('dist/data/job-search-facets.json'),
  parse('public/curated/v1/jobs.json'),parse('src/data/staticJobEditorial.json')
]);
if(!Array.isArray(feed.jobs)||feed.total!==feed.jobs.length||feed.failures!==0||
    !Array.isArray(facets.jobs)||facets.indexed_as_of!==feed.updated||
    !Array.isArray(archive.jobs)||archive.jobs.length!==100||
    !Array.isArray(seeds.editorial))throw Error('UNTRUSTED_STATIC_JD_INPUTS');
const jobs=new Map(feed.jobs.map(j=>[j.id,j]));
if(jobs.size!==feed.jobs.length)throw Error('DUPLICATED_LIVE_JOB_ID');
const facts=new Map(facets.jobs.map(f=>[f.id,f]));
const archived=new Map;
for(const a of archive.jobs){
 if(a.editorial?.verification!=='official_page_read'||a.fullJdReprintPermissionVerified!==false||
    !a.originalUrl?.startsWith('https://')||!a.id?.startsWith('curated-'))continue;
 const key=a.id.slice('curated-'.length);
 if(!archived.has(key))archived.set(key,a);
}
const seedIndex=new Map;
for(const s of seeds.editorial){
 if(!s.company||!s.title||!s.originalSourcePrefix.startsWith('https://')||
    !s.evidencePage.startsWith('https://')||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.verifiedOn)||
    !Array.isArray(s.responsibilitiesZh)||s.responsibilitiesZh.length<2||
    !Array.isArray(s.requirementsZh)||s.requirementsZh.length<2||
    s.rights!=='HHBA_ORIGINAL_PARAPHRASE')throw Error('INVALID_EDITORIAL_PROVENANCE');
 const key=s.company+'::'+s.title;
 if(seedIndex.has(key))throw Error('DUPLICATE_MANUAL_REVIEW');
 seedIndex.set(key,s);
}
function safeLines(lines){
 return Array.isArray(lines)?lines.filter(v=>typeof v==='string'&&v.trim().length>8&&v.length<500&&!/[<>]/.test(v)).slice(0,16):[];
}
function safeText(s){return typeof s==='string'&&s.length<2500&&!/[<>]/.test(s)?s:'';}
function structured(f){
 if(!f || !/^[a-f0-9]{64}$/.test(f.original_source_hash||''))return null;
 const edu=['UNRESTRICTED','HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','PHD'].includes(f.education)?f.education:null;
 const experience=Number.isInteger(f.experienceMinYears)&&f.experienceMinYears>=0&&f.experienceMinYears<=50?f.experienceMinYears:null;
 const skills=Array.isArray(f.skills)?f.skills.filter(v=>typeof v==='string'&&v.length<=40).slice(0,25):[];
 if(!edu&&experience===null&&!skills.length)return null;
 return {education:edu,experienceMinYears:experience,skills,sourceHash:f.original_source_hash};
}
const byId={};const counts={total:feed.jobs.length,editorial:0,archivedEditorial:0,manuallyReviewed:0,structuredOnly:0,withoutDetails:0};
for(const job of feed.jobs){
 if(!job.id||typeof job.url!=='string'||!job.url.startsWith('https://'))continue;
 let story=null,mode=null,reviewedAt=null,sourcePage=null;
 const a=archived.get(job.id);
 if(a&&a.originalUrl===job.url&&a.company===job.company&&a.titleEn===job.title&&
    a.editorial?.responsibilities?.length&&a.editorial?.requirements?.length){
  story=a.editorial;mode='ARCHIVAL_EDITORIAL';reviewedAt=a.editorial.sourceVerifiedAt;sourcePage=a.originalUrl;counts.archivedEditorial++;
 }
 if(!story){
  const candidate=seedIndex.get(job.company+'::'+job.title);
  if(candidate&&job.url.startsWith(candidate.originalSourcePrefix)&&
     (!candidate.location||job.location?.includes(candidate.location))){
   story=candidate;mode='MANUAL_EDITORIAL';reviewedAt=candidate.verifiedOn;sourcePage=candidate.evidencePage;
   counts.manuallyReviewed++;
  }
 }
 const f=structured(facts.get(job.id));
 if(!story&&!f){counts.withoutDetails++;continue;}
 const row={id:job.id,company:job.company,title:job.title,sourceUrl:job.url,mode:mode||'EXTRACTED_FACTS',
   reviewDate:reviewedAt||null,sourcePage:sourcePage||null,overviewZh:'',
   responsibilitiesZh:[],requirementsZh:[],benefitsZh:[],overviewEn:'',
   responsibilitiesEn:[],requirementsEn:[],benefitsEn:[],facts:f};
 if(story){
  row.overviewZh=safeText(story.overviewZh||story.overview);
  row.responsibilitiesZh=safeLines(story.responsibilitiesZh||story.responsibilities);
  row.requirementsZh=safeLines(story.requirementsZh||story.requirements);
  row.benefitsZh=safeLines(story.benefitsZh||story.benefits);
  row.overviewEn=safeText(story.overviewEn);
  row.responsibilitiesEn=safeLines(story.responsibilitiesEn);
  row.requirementsEn=safeLines(story.requirementsEn);
  row.benefitsEn=safeLines(story.benefitsEn);
  if(!row.responsibilitiesZh.length||!row.requirementsZh.length)throw Error('INCOMPLETE_EDITORIAL:'+job.id);
  counts.editorial++;
 }else counts.structuredOnly++;
 byId[job.id]=row;
}
if(counts.total<1||counts.editorial===0||counts.structuredOnly===0)throw Error('STATIC_JD_COVERAGE_EMPTY');
const result={kind:'HHBA_SELF_HOSTED_JD_SUMMARIES_V1',snapshotUpdated:feed.updated,
  rightsStatement:'Original HHBA editorial summaries, not reproduced third-party full JD texts.',
  count:Object.keys(byId).length,coverage:counts,jobs:byId};
// Independent first-party static shards ensure one detail view downloads only a
// small local JSON file, never a foreign ATS or Railway endpoint.
const shard=id=>String([...id].reduce((n,ch)=>(n+ch.charCodeAt(0))%32,0)).padStart(2,'0');
const groups=new Map();
for(const [id,record] of Object.entries(byId)){
 const key=shard(id);
 if(!groups.has(key))groups.set(key,{});
 groups.get(key)[id]=record;
}
await mkdir('dist/data/self-hosted-jd/v1',{recursive:true});
for(let n=0;n<32;n++){
 const name=String(n).padStart(2,'0');
 await writeFile(join('dist/data/self-hosted-jd/v1',name+'.json'),JSON.stringify({
  kind:'HHBA_SELF_HOSTED_JD_SHARD_V1',snapshotUpdated:feed.updated,jobs:groups.get(name)||{}
 }),'utf8');
}
await mkdir('dist/data',{recursive:true});
await writeFile(join('dist/data','self-hosted-jd.json'),JSON.stringify(result),'utf8');
await writeFile(join('dist/data','self-hosted-jd-coverage.json'),JSON.stringify({
  kind:result.kind,snapshotUpdated:result.snapshotUpdated,...counts
}),'utf8');
console.log('HHBA_SELF_HOSTED_JD_READY',JSON.stringify(counts));
