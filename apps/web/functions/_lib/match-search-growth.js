// Search-first coverage extension. No saved job index, guessed URLs or ATS APIs.
import {MAINLAND_CITIES} from './mainland-job-location.js';
import {sortByMatchScore} from './match-job-quality.js';
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
 const original=plain(roleHint).slice(0,35);
 const text=String(resume||'').slice(0,10000);
 const direct=original||(/(?:智能体|Agent|RAG|AI产品)/i.test(text)?'AI产品 运营':'区域运营 产品运营');
 const adjacent=/(?:AI|智能|产品)/i.test(direct)?'数字化产品运营 项目协调':
  /(?:经销商|汽车|区域|渠道|销售|督导)/i.test(direct)?'区域运营 渠道管理':'业务运营 项目运营';
 const suffix=city?city+' 工作地点':'中国大陆 工作地点';
 const candidates=[
  (direct+' '+suffix+' 2026 社会招聘 职位详情').slice(0,128),
  (adjacent+' '+suffix+' 企业招聘 申请职位').slice(0,128)
 ];
 return [...new Set(candidates)].filter(q=>!primaryQueries.includes(q)).slice(0,2);
}
export function mergeCandidateHits(initial,additional,max=48){
 const normalized=new Set(),merged=[];
 for(const hit of [...initial,...additional]){
  if(!hit?.url||normalized.has(hit.url))continue;
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
  if(!url||keys.has(companyRole)||keys.has(url))continue;
  keys.add(companyRole);keys.add(url);merged.push(job);
  if(merged.length>=limit)break;
 }
 return sortByMatchScore(merged);
}
