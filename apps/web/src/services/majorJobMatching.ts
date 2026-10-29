/**
 * Pure, shared major-to-role matching for the static recruitment market and the
 * reviewed employer profile pages. No AI inference and no fabricated eligibility.
 * All "related" labels describe recorded/curated relevance, NOT official admission.
 */
import type {LiveJob} from './liveRecruitment';
import {majorById} from './domesticMajors';
export type MajorMatch='all'|'related'|'unrestricted'|'unknown'|'other';
export const MAJOR_STORAGE_KEY='hhba.company.major';
const normalize=(s:string)=>s.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s（）()·．.]/g,'');
const broadGroups:Record<string,string[]>={
 '计算机类':['计算机科学与技术','软件工程','网络工程','人工智能','数据科学与大数据技术','信息安全','物联网工程'],
 '计算机':['计算机科学与技术','软件工程','网络工程','信息安全'],
 '医学':['临床医学','基础医学','预防医学','护理学','药学'],
 '生命科学':['生物科学','生物技术','生物工程'],
 '数学与统计':['数学与应用数学','统计学','应用统计学'],
 '设计学':['产品设计','数字媒体艺术','视觉传达设计','动画','艺术设计学'],
 '电子信息类':['电子信息工程','电子科学与技术','通信工程','光电信息科学与工程'],
 '机械类':['机械工程','机械设计制造及其自动化','机械电子工程','车辆工程'],
 '经济金融类':['经济学','金融学','金融工程','国际经济与贸易'],
 '经济管理类':['工商管理','财务管理','会计学','市场营销','经济学','金融学'],
 '设计学类':['产品设计','数字媒体艺术','视觉传达设计','动画','艺术设计学'],
 '医学类':['临床医学','护理学','药学','基础医学'],
 '生物类':['生物科学','生物技术','生物工程']
};
const groupsFor=(major:string)=>Object.entries(broadGroups)
 .filter(([,members])=>members.some(n=>normalize(n)===normalize(major)))
 .map(([group])=>normalize(group));
function equivalent(label:string,major:string){
 const a=normalize(label),b=normalize(major);
 if(!a||!b)return false;
 if(a===b)return true;
 // Strictly allow a *named category*, never substring guesses such as '艺术'
 // accidentally matching computer graphics or '管理' matching every role.
 return groupsFor(major).includes(a);
}
export function validMajorSlug(slug:string){
 return !!slug&&!!majorById(slug);
}
export function getSavedMajor():string{
 try{
  const url=new URLSearchParams(location.search).get('major');
  if(url&&validMajorSlug(url))return url;
  const key=sessionStorage.getItem(MAJOR_STORAGE_KEY)||'';
  return validMajorSlug(key)?key:'';
 }catch{return ''}
}
export function storeSelectedMajor(slug:string){
 const verified=validMajorSlug(slug)?slug:'';
 try{
  if(verified)sessionStorage.setItem(MAJOR_STORAGE_KEY,verified);
  else sessionStorage.removeItem(MAJOR_STORAGE_KEY);
 }catch{}
 // Keep a company deep link's major query aligned when users switch subjects there.
 try{
  if(location.pathname.includes('/companies/')&&new URLSearchParams(location.search).has('major')){
   const url=new URL(location.href);
   if(verified)url.searchParams.set('major',verified);
   else url.searchParams.delete('major');
   history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  }
 }catch{}
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('hhba-major-changed',{detail:verified}));
}
export function majorName(slug:string){return majorById(slug)?.name||'';}
export function matchRoleToMajor(job:Pick<LiveJob,'majorNames'|'editorialRelatedMajors'|'majorUnrestricted'>,slug:string):MajorMatch{
 if(!slug)return 'all';
 const chosen=majorById(slug);if(!chosen)return 'unknown';
 if(job.majorUnrestricted===true)return 'unrestricted';
 const fields=[...(job.majorNames||[]),...(job.editorialRelatedMajors||[])];
 if(fields.some(x=>/^(?:不限专业|专业不限|不限制专业|不限学科|any major)$/i.test(x.trim())))return 'unrestricted';
 if(fields.some(x=>equivalent(x,chosen.name)))return 'related';
 // Distinguish an absent major field from a documented but different subject.
 // A known-other requirement must not be described as 'unreported'.
 return fields.length?'other':'unknown';
}
export function visibleRoleForMajor(job:Pick<LiveJob,'majorNames'|'editorialRelatedMajors'|'majorUnrestricted'>,
 slug:string,includeUnknown=false){
 const status=matchRoleToMajor(job,slug);
 return status==='all'||status==='related'||status==='unrestricted'||includeUnknown&&status==='unknown';
}
export const majorMatchLabel=(match:MajorMatch)=>match==='unrestricted'?'公开标注不限专业':
 match==='related'?'专业相关 · 资格待核验':
 match==='unknown'?'专业要求未披露 · 待核验':match==='other'?'已列其他专业 · 请核对官方资格':'全部已收录岗位';
