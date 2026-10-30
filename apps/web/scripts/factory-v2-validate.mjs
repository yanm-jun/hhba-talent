#!/usr/bin/env node
/**
 * HHBA Enterprise Factory V2: one validator for every employer, not one test per company.
 * Usage: node scripts/factory-v2-validate.mjs cn-autumn-018
 *        node scripts/factory-v2-validate.mjs --all
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const roster=JSON.parse(fs.readFileSync(path.join(root,'src/data/domesticAutumnScreenshot20261028.json'),'utf8')).entries;
const known=new Map(roster.map(row=>[row.id,row.name]));
const dir=path.join(root,'src/data/employerProfiles');
const files=fs.readdirSync(dir).filter(f=>/^cn-autumn-\d{3}\.json$/.test(f)).sort();
const ids=process.argv.slice(2).filter(x=>x!=='--all');
if(ids.length>1 || (ids[0]&&!/^cn-autumn-\d{3}$/.test(ids[0])))throw Error('Expected one ID such as cn-autumn-018, or --all');
const selected=ids[0]?[ids[0]]:files.map(f=>f.slice(0,-5));
const code=fs.readFileSync(path.join(root,'src/services/employerProfiles.ts'),'utf8');
const search=fs.readFileSync(path.join(root,'src/services/domesticCompanySearch.ts'),'utf8');
const jobsCode=fs.readFileSync(path.join(root,'src/services/domesticRebuildJobs.ts'),'utf8');
const home=fs.readFileSync(path.join(root,'src/components/HomeCompanyMarquee.tsx'),'utf8');
const router=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');
for(const [name,text,needed] of [
 ['data loader',code,"import.meta.glob('../data/employerProfiles/*.json'"],
 ['search',search,'for(const profile of employerProfiles)'],
 ['jobs',jobsCode,'employerProfiles.flatMap('],
 ['homepage',home,'employerProfiles.map('],
 ['page routing',router,'employerProfileById.has(']
])assert(text.includes(needed),'Factory integration missing: '+name);
const asUrl=(u,label)=>{
 assert(typeof u==='string'&&u.startsWith('https://'),label+' must be an HTTPS URL');
 const parsed=new URL(u);
 assert(!parsed.username&&!parsed.password&&!parsed.port,label+' must not contain credentials or custom port');
 return parsed;
};
const verified=[];
for(const id of selected){
 const file=path.join(dir,id+'.json');
 assert(fs.existsSync(file),'Missing profile: '+id);
 const p=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(p.id,id);
 assert.equal(p.name,known.get(id),'Profile name differs from registered employer');
 assert.equal(p.schemaVersion,1,'Factory V2 preserves existing JSON schema V1 compatibility');
 assert(Array.isArray(p.aliases)&&p.aliases.length>0);
 assert(Array.isArray(p.business)&&p.business.length>=4);
 assert(Array.isArray(p.jobs),'Jobs field required, even when empty');
 assert(Array.isArray(p.media?.photos)&&p.media.photos.length===2,'Require two independent photos');
 assert(p.recruitment?.status==='unconfirmed'||['official_portal','archived_source'].includes(p.recruitment?.status));
 for(const u of p.sources)asUrl(u,'Profile source');
 const photoKeys=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert(new Set(photoKeys).size===3,'Logo and 2 photos must be separate');
 for(const asset of photoKeys){
  assert(asset.startsWith('images/employer-profiles/'+id+'/')|| // legacy factory uses this directory
    /^images\/[a-z0-9-]+\/[a-z0-9-]+\.(png|svg|webp|jpe?g)$/.test(asset),
    'Unexpected company asset path: '+asset);
  assert(!asset.includes('..'),'Unsafe asset path');
  const file=path.join(root,'public',asset);
  assert(fs.existsSync(file),'Missing image: '+file);
  const stat=fs.statSync(file);
  assert(stat.isFile()&&stat.size>=100&&stat.size<=5_000_000,'Invalid image size: '+asset);
 }
 for(const [i,photo] of p.media.photos.entries()){
  assert(photo.alt?.trim()&&photo.caption?.trim()&&photo.note?.trim(),'Missing caption/credit for photo '+(i+1));
 }
 if(p.mediaSources){
  const sourceUrls=['logo','photo1','photo2'].map(key=>asUrl(p.mediaSources[key],key+' media provenance').href);
  assert(new Set(sourceUrls).size===3,'Media sources must be independent');
 }
 const roleIds=new Set();
 for(const role of p.jobs){
  assert(!roleIds.has(role.id),'Duplicate company role ID');
  roleIds.add(role.id);
  asUrl(role.url,'Role link');asUrl(role.evidenceUrl,'Role evidence');
  assert(role.currentOpenVerified===false,'Do not assert unverified job availability');
  assert(role.title?.trim()&&role.summary?.trim()&&role.requirements?.trim(),'Role evidence is incomplete');
  assert(Array.isArray(role.majorNames)&&Array.isArray(role.editorialRelatedMajors),'Role major mapping missing');
 }
 verified.push({id,name:p.name,aliases:p.aliases.length,roles:p.jobs.length,
  photos:p.media.photos.length,logo:p.media.logo,
  route:'/companies/autumn/'+id,sourceCount:p.sources.length});
}
const result={schema:'hhba-factory-v2',status:'PASS',profileCount:verified.length,profiles:verified};
console.log('HHBA_FACTORY_V2_VALIDATION_PASS '+JSON.stringify(result));
