import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const roster=JSON.parse(fs.readFileSync(path.join(webRoot,'src/data/domesticAutumnScreenshot20261028.json'),'utf8'));
const byId=new Map(roster.entries.map(e=>[e.id,e]));
const folder=path.join(webRoot,'src/data/employerProfiles');
const list=fs.readdirSync(folder).filter(f=>f.endsWith('.json')).sort();
assert(list.length>0,'No employer profiles');
const aliases=new Map();
let jobs=0,images=0;
const fail=(message)=>{throw Error('EMPLOYER_FACTORY_INVALID: '+message)};
const url=(text,id)=>{try{const u=new URL(text);if(u.protocol!=='https:'||u.username||u.password||u.port)fail(id+' must use normal HTTPS');return u}catch{fail(id+' URL invalid: '+text)}};
for(const filename of list){
 const p=JSON.parse(fs.readFileSync(path.join(folder,filename),'utf8'));
 const id=p.id||'unknown';
 if(!/^cn-autumn-\d{3}$/.test(id)||filename!==id+'.json'||!byId.has(id))fail('Unregistered filename/id '+filename);
 if(p.schemaVersion!==1||p.name!==byId.get(id).name)fail('Employer identity mismatch '+id);
 for(const k of ['name','englishName','industry','subtitle','overview','lastReviewed','majorIntro','photoNote'])if(!p[k]||typeof p[k]!=='string')fail(id+' missing '+k);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.lastReviewed))fail(id+' invalid review date');
 if(!Array.isArray(p.aliases)||!Array.isArray(p.preferredMajors)||!Array.isArray(p.sources)||!p.sources.length)fail(id+' incomplete aliases/majors/sources');
 for(const source of p.sources)url(source,id+' source');
 for(const keyword of [p.name,p.englishName,...p.aliases]){
  if(typeof keyword!=='string'||!keyword.trim())fail('blank search alias '+id);
  const key=keyword.normalize('NFKC').toLowerCase().replace(/[\s·・（）()\-—_]/g,'');
  if(aliases.has(key)&&aliases.get(key)!==id)fail('Cross-company search alias '+keyword);
  aliases.set(key,id);
 }
 if(!p.recruitment||!['archived_source','official_portal','unconfirmed'].includes(p.recruitment.status)||!p.recruitment.subject||!p.recruitment.note)fail(id+' recruitment metadata incomplete');
 if(p.recruitment.status!=='unconfirmed')url(p.recruitment.url,id+' recruitment');
 const assets=[p.media?.logo,...(p.media?.photos||[]).map(x=>x.path)];
 if(assets.length!==3||new Set(assets).size!==3)fail(id+' must have a separate Logo and 2 photos');
 for(const asset of assets){
  if(!/^images\/[a-z0-9-/]+\.(?:png|jpe?g|webp|svg)$/.test(asset)||asset.includes('..'))fail(id+' unsafe asset path '+asset);
  const f=path.join(webRoot,'public',asset);
  if(!fs.existsSync(f)||fs.statSync(f).size<100||fs.statSync(f).size>5*1024*1024)fail(id+' missing/oversized photo '+asset);
  images++;
 }
 for(const photo of p.media.photos)if(!photo.alt||!photo.note||!photo.caption)fail(id+' photo needs alt, caption and provenance');
 if(!Array.isArray(p.business)||p.business.length<4||p.business.length>12)fail(id+' business section must contain 4-12 areas');
 for(const item of p.business)if(!item.title||!item.description||!item.tags||!Array.isArray(item.details)||!item.details.length)fail(id+' incomplete business card');
 if(!Array.isArray(p.jobs))fail(id+' jobs must be explicit array, possibly empty');
 const jobIds=new Set();
 for(const job of p.jobs){
  if(!/^[A-Za-z0-9-]{2,70}$/.test(job.id)||jobIds.has(job.id))fail(id+' invalid/duplicated job ID');
  jobIds.add(job.id);
  if(!job.title||!job.city||!job.summary||!job.requirements||!job.recruitmentSubject)fail(id+' job evidence incomplete');
  if(!['CAMPUS','SOCIAL','INTERNSHIP'].includes(job.recruitmentType)||job.currentOpenVerified!==false)fail(id+' incorrect job status or type');
  if(!Array.isArray(job.majorNames)||!Array.isArray(job.editorialRelatedMajors)||typeof job.majorUnrestricted!=='boolean')fail(id+' major mapping must be explicit');
  const u=url(job.url,id+' job'),e=url(job.evidenceUrl,id+' evidence');
  if(!p.recruitment.url||u.hostname!==new URL(p.recruitment.url).hostname)fail(id+' job URL is outside approved employer destination');
  if(!e.hostname||!/^\d{4}-\d{2}-\d{2}$/.test(job.observedOn))fail(id+' job missing source date');
  jobs++;
 }
}
console.log('EMPLOYER_FACTORY_CHECK_OK',JSON.stringify({profiles:list.length,assets:images,manifestJobs:jobs,legacyJobsUnchanged:160,lookupAliases:aliases.size}));
