/**
 * Auditable, conservative career-transfer explanations for candidates who
 * want to change occupation. This does NOT increase their score, override a
 * hard gate, or claim that an interest is prior occupational experience.
 * Skill signals must already have explicit resume evidence strings.
 */
import {classifyOccupation} from './match-ranking.js';

const PATHS=Object.freeze([
 {from:'sales',to:'operations',signals:['项目管理','数据分析','市场营销','沟通能力'],label:'客户与业务运营'},
 {from:'sales',to:'content-operations',signals:['项目管理','数据分析','市场营销','沟通能力'],label:'内容与用户运营转型'},
 {from:'marketing',to:'content-operations',signals:['项目管理','数据分析','市场营销'],label:'内容与增长运营'},
 {from:'sales',to:'marketing',signals:['数据分析','市场营销','项目管理'],label:'市场业务推广'},
 {from:'marketing',to:'operations',signals:['项目管理','数据分析','市场营销'],label:'内容与增长运营'},
 {from:'logistics',to:'supply-chain',signals:['Excel','数据分析','项目管理'],label:'采购与供应链协同'},
 {from:'film-directing',to:'film-editing',signals:['剪辑','项目管理'],label:'视频内容制作'},
 {from:'dance-choreography',to:'film-directing',signals:['剪辑','项目管理'],label:'演出与视频创意策划'},
 {from:'data-analyst',to:'product',signals:['数据分析','用户研究','项目管理'],label:'数据驱动的产品工作'}
]);
const norm=s=>String(s||'').normalize('NFKC').trim().toLowerCase();
export function groundedCareerTransfer(profile,job){
 if(!profile||!job||typeof job.title!=='string')return null;
 const wanted=classifyOccupation(job.title);
 const intents=(Array.isArray(profile.career_intents)?profile.career_intents:[])
  .filter(x=>typeof x==='string').map(classifyOccupation).filter(Boolean);
 if(!wanted||!intents.includes(wanted))return null;
 const previous=new Set((Array.isArray(profile.demonstrated_roles)?profile.demonstrated_roles:[])
  .filter(x=>typeof x==='string').map(classifyOccupation).filter(Boolean));
 if(!previous.size||previous.has(wanted))return null;
 const evidenced=new Map();
 for(const s of Array.isArray(profile.skills)?profile.skills:[]){
  if(!s||typeof s!=='object'||typeof s.name!=='string'||
   typeof s.evidence!=='string'||!s.evidence.trim())continue;
  evidenced.set(norm(s.name),s.name.slice(0,30));
 }
 for(const path of PATHS){
  if(!previous.has(path.from)||path.to!==wanted)continue;
  const matched=path.signals.filter(s=>evidenced.has(norm(s)));
  if(matched.length<2)continue;
  return {
   kind:'EVIDENCED_TRANSFER_DIRECTION_ONLY',
   label:path.label,
   supporting_skills:matched.slice(0,3).map(x=>evidenced.get(norm(x))),
   disclaimer:'这只是有简历文字支持的能力迁移方向，不代表具有目标岗位任职经历或符合全部录用条件'
  };
 }
 return null;
}
