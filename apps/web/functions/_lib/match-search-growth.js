// Search-first coverage extension. No saved job index, guessed URLs or ATS APIs.
import {MAINLAND_CITIES} from './mainland-job-location.js';
import {sortByMatchScore} from './match-job-quality.js';
import {allowedEmployerJobLink} from './match-employer-source.js';
import {buildSupplementalRoleQueries} from './match-role-intent.js';
const plain=s=>String(s||'').replace(/[\r\n<>\"']/g,' ').replace(/\s+/g,' ').trim();
export function explicitPreferredCity(resume){
 const s=String(resume||'').slice(0,12000);
 const snippets=[...s.matchAll(/(?:意向|期望|希望|目标|首选|求职)(?:工作)?(?:城市|地点|地区|区域)|(?:期望|意向|希望)(?:在|去)(.{2,8})(?:工作|就业)/g)]
  .map(m=>s.slice(m.index,m.index+38));
 for(const snippet of snippets){
  // City must be expressed after the preference label, not in past work history.
  const found=MAINLAND_CITIES.filter(c=>c.length>1&&snippet.indexOf(c)>0)
    .sort((a,b)=>snippet.indexOf(a)-snippet.indexOf(b));
  if(found.length)return found[0];
 }
 return '';
}
export function supplementalQueries(resume,roleHint,primaryQueries=[]){
 const city=explicitPreferredCity(resume);
 return buildSupplementalRoleQueries(roleHint,resume,city)
  .filter(q=>!primaryQueries.includes(q)).slice(0,2);
}
export function mergeCandidateHits(initial,additional,max=48){
 const normalized=new Set(),merged=[];
 for(const hit of [...initial,...additional]){
  if(!hit?.url||!allowedEmployerJobLink(hit.url)||normalized.has(hit.url))continue;
  normalized.add(hit.url);
  merged.push({...hit,id:'j'+(merged.length+1)});
  if(merged.length>=max)break;
 }
 return merged;
}
export function combineRecommended(initial,next,limit=10){
 const keys=new Set(),merged=[];
 for(const job of [...initial,...next]){
  const companyRole=(String(job.company||'')+'|'+String(job.title||'')).toLowerCase().replace(/\s+/g,'');
  const url=job.official_url;
  if(!url||!allowedEmployerJobLink(url)||keys.has(companyRole)||keys.has(url))continue;
  keys.add(companyRole);keys.add(url);merged.push(job);
  if(merged.length>=limit)break;
 }
 return sortByMatchScore(merged);
}
