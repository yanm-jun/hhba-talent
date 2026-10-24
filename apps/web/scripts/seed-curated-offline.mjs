#!/usr/bin/env node
// ONE-TIME seed, not a cron, crawler, API sync, or production fetch.
// Only consumes HHBA's already archived GitHub Actions build artifact.
// Do not copy complete third-party job descriptions or claim current vacancies.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const companies=[
 ['OpenAI','OpenAI','ashby'],['Anthropic','Anthropic','greenhouse'],
 ['SpaceX','SpaceX','greenhouse'],['Stripe','Stripe','greenhouse'],
 ['Airbnb','爱彼迎','greenhouse'],['Notion','Notion','ashby'],
 ['Figma','Figma','greenhouse'],['Spotify','Spotify','lever'],
 ['Reddit','Reddit','greenhouse'],['Databricks','Databricks','greenhouse']
];
const names=new Set(companies.map(c=>c[0]));
const root=resolve(process.argv[2]||'./source-artifact');
const output=resolve(process.argv[3]||'./public/curated/v1');
const json=name=>JSON.parse(readFileSync(join(root,'data',name),'utf8'));
const snapshot=json('jobs.json'),audit=json('job-sync-status.json'),facet=json('job-search-facets.json');
if(snapshot.total!==snapshot.jobs?.length||snapshot.failures!==0||
 !Number.isFinite(Date.parse(snapshot.updated))||
 audit.summary?.indexed_as_of!==snapshot.updated||
 facet.indexed_as_of!==snapshot.updated||
 !Array.isArray(audit.jobs)||audit.jobs.length!==snapshot.total||
 !Array.isArray(facet.jobs))throw Error('CURATED_SOURCE_ARTIFACT_INVALID');
const audited=new Map(audit.jobs.map(v=>[v.job_id,v]));
const facets=new Map(facet.jobs.map(v=>[v.id,v]));
const srcStatus='OFFICIAL_JD_AND_REQUIREMENTS_FOUND';
const han=/[\u3400-\u9fff]/u;
const bad=/\uFFFD|(?:Ã.|Â.|â[€Œœ„™])|[\u0000-\u001F\u007F]/u;
const clean=(v,n=240)=>typeof v==='string'&&!bad.test(v)&&v.trim().length<=n?v.trim().replace(/\s+/g,' '):'';
const bucket=title=>/engineer|developer|architect|infrastructure|data scientist|research|technical|security|machine learning|sre|devops/i.test(title)?'engineering':
 /design|creative|brand/i.test(title)?'design':
 /product|program manager|project manager/i.test(title)?'product':
 /account|sales|business development|partnership|marketing|growth|customer success/i.test(title)?'commercial':
 /finance|legal|recruit|people|operations|talent|policy|communications/i.test(title)?'operations':'other';
const cap=10;
const selection=[],evidence=[];
for(const [name,nameZh,platform] of companies){
 const candidates=snapshot.jobs.filter(j=>j.company===name&&!j.domestic&&j.platform===platform&&
   clean(j.title)&&clean(j.titleZh)&&han.test(j.titleZh)&&
   clean(j.location)&&clean(j.url,1024)&&/^https:\/\//.test(j.url)&&
   audited.get(j.id)?.status===srcStatus&&audited.get(j.id)?.full_original_jd_verified===true&&
   facets.has(j.id));
 // Preserve functional diversity rather than allowing alphabetical senior-role clusters.
 const grouped=new Map(),identity=new Set();
 for(const job of candidates.sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id))){
  const identityKey=(job.title+'|'+job.location).toLowerCase();
  if(identity.has(identityKey))continue;
  identity.add(identityKey);
  const kind=bucket(job.title);if(!grouped.has(kind))grouped.set(kind,[]);
  grouped.get(kind).push(job);
 }
 const chosen=[],kinds=['engineering','commercial','product','operations','design','other'];
 while(chosen.length<cap&&kinds.some(k=>(grouped.get(k)||[]).length)){
  for(const kind of kinds){
   const job=grouped.get(kind)?.shift();
   if(job)chosen.push(job);
   if(chosen.length===cap)break;
  }
 }
 if(chosen.length<cap)throw Error('INSUFFICIENT_VERIFIED_SAMPLES '+name+' '+chosen.length);
 for(const job of chosen){
  const f=facets.get(job.id),a=audited.get(job.id);
  const id='curated-'+job.id;
  const skills=Array.isArray(f.skills)?f.skills.filter(x=>typeof x==='string'&&/^[a-z0-9+#. -]{1,42}$/i.test(x)).slice(0,12):[];
  const row={
   id,company:name,companyZh:nameZh,titleEn:clean(job.title),
   titleZh:clean(job.titleZh),titleTranslation:'machine_unreviewed',
   locationEn:clean(job.location),locationZh:clean(job.locationZh)||'地点待核验',
   countryCode:clean(f.countryCode,5)||null,cityKey:clean(f.cityKey,80)||null,
   education:clean(f.education,40)||null,
   experienceMinYears:Number.isInteger(f.experienceMinYears)&&f.experienceMinYears>=0?f.experienceMinYears:null,
   skillSignals:skills,jobCategory:bucket(job.title),
   jobType:clean(f.jobType,40)||null,
   originalPlatform:job.platform,originalSource:job.source,
   originalUrl:job.url,
   officialDescriptionPreviouslyObserved:a.official_jd_observed===true,
   fullJdReprintPermissionVerified:false,
   originalDescriptionStored:false,
   snapshotObservedAt:snapshot.updated,sourceCheckedAt:a.official_checked_at||null,
   status:'historical_public_posting',currentApplicationVerified:false,
   responsibilitiesZh:null,requirementsFullZh:null,
   notices:{en:'Archived public vacancy metadata. Current application availability and complete requirements are not verified.',
   zh:'历史公开岗位资料：不代表当前在招。学历、经验和技能为历史公开内容提取线索，可能不完整；岗位职责原文未收录。'}
  };
  if(!row.id||!row.originalUrl||!row.titleZh||!row.titleEn)throw Error('INVALID_CURATED_ROW '+name);
  selection.push(row);evidence.push({id,hash:a.jd_sha256||null,sourceUrl:job.url});
 }
}
if(selection.length!==100||new Set(selection.map(j=>j.id)).size!==100)throw Error('CURATED_COUNT_OR_DUPLICATES');
const sourceDigest=createHash('sha256').update(JSON.stringify({jobs:selection.map(j=>j.id),snapshot:snapshot.updated})).digest('hex');
const manifest={
 kind:'HHBA_CURATED_OFFLINE_V1',version:1,source:'HHBA_EXISTING_SNAPSHOT_GITHUB_ACTIONS',
 originalSnapshotAt:snapshot.updated,sourceBoardsSnapshot:snapshot.boards,
 numberOfCompanies:companies.length,numberOfJobs:selection.length,
 hash:sourceDigest,sourceOfficialJdVerified:selection.length,
 fullReprintedJobDescriptions:0,completeHumanReviewedChineseDescriptions:0,
 automaticSync:false,externalApiAtRuntime:false,
 historicalData:true,defaultCurrentVacancyClaim:false,
 contentPolicy:'Metadata and source-derived factual signals only. No reprinted full third-party JD. Machine-translated labels require editorial review.',
 refreshedAt:null
};
const directory=companies.map(([name,nameZh,platform])=>({
 id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,nameZh,originalPlatform:platform,
 jobsCount:selection.filter(j=>j.company===name).length
}));
mkdirSync(output,{recursive:true});
for(const [name,obj] of [['manifest.json',manifest],['companies.json',{kind:'HHBA_CURATED_COMPANIES_V1',companies:directory}],['jobs.json',{kind:'HHBA_CURATED_JOBS_V1',jobs:selection}]]){
 writeFileSync(join(output,name),JSON.stringify(obj,null,2)+'\n','utf8');
}
console.log('HHBA_CURATED_OFFLINE_SEED_OK',JSON.stringify({
 companies:directory.length,jobs:selection.length,fromSnapshot:snapshot.updated,
 platforms:Object.fromEntries(['ashby','greenhouse','lever'].map(p=>[p,selection.filter(j=>j.originalPlatform===p).length])),
 noFullJD:true,noLiveATS:true,hash:sourceDigest
}));
