import reviewed from '../data/reviewedEmployers.json';
import batchA from '../data/companyEditorialAdditionalA.json';
import batchB from '../data/companyEditorialAdditionalB.json';
import batchC from '../data/companyEditorialAdditionalC.json';
import batchD from '../data/companyEditorialAdditionalD.json';
import type { EmployerIdentity } from './companyDirectory';
import { encodeEmployerIdentity, identityKey } from './companyDirectory';

export type EditorialText={zh:string;en:string};
export type ReviewedCompanyEditorial={
  id:string;
  identity:EmployerIdentity;
  name:string;
  industry:EditorialText;
  country:EditorialText;
  founded:string;
  tagline:EditorialText;
  overview:EditorialText[];
  focus:{name:EditorialText;description:EditorialText}[];
  milestones:{date:string;description:EditorialText}[];
  sources:{label:EditorialText;url:string}[];
  lastReviewed:string;
  status:'VERIFIED';
};
function isLocalized(value:unknown):value is EditorialText{
 return !!value&&typeof value==='object'&&
   typeof (value as EditorialText).zh==='string'&&
   typeof (value as EditorialText).en==='string'&&
   !!(value as EditorialText).zh.trim()&&!!(value as EditorialText).en.trim();
}
function isOfficialReference(value:unknown){
 if(typeof value!=='string')return false;
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
    !/^(localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname)&&
    url.hostname.includes('.');
 }catch{return false}
}
export function validatedReviewedEditorial(candidate:unknown,identity:EmployerIdentity)
 :ReviewedCompanyEditorial|null{
 if(!candidate||typeof candidate!=='object')return null;
 const p=candidate as ReviewedCompanyEditorial;
 if(p.status!=='VERIFIED'||p.id!==encodeEmployerIdentity(identity)||
  !p.identity||identityKey(p.identity)!==identityKey(identity)||p.name!==identity.company||
  !isLocalized(p.industry)||!isLocalized(p.country)||!isLocalized(p.tagline)||
  !Array.isArray(p.overview)||p.overview.length<2||!p.overview.every(isLocalized)||
  !Array.isArray(p.focus)||p.focus.length<1||
  !p.focus.every(f=>isLocalized(f?.name)&&isLocalized(f?.description))||
  !Array.isArray(p.milestones)||!p.milestones.every(m=>typeof m?.date==='string'&&isLocalized(m?.description))||
  !Array.isArray(p.sources)||p.sources.length<2||
  !p.sources.every(s=>isLocalized(s?.label)&&isOfficialReference(s?.url))||
  !/^\d{4}-\d{2}-\d{2}$/.test(p.lastReviewed)||
  !(/^(?:\d{4}|—)$/.test(p.founded)))return null;
 return p;
}
// Exact ATS employer identities; never merge by company names alone.
const allReviewed=[...reviewed.profiles,...batchA.profiles,...batchB.profiles,...batchC.profiles,...batchD.profiles];
export function reviewedEditorialForEmployer(identity:EmployerIdentity){
 const key=encodeEmployerIdentity(identity);
 if(!key)return null;
 // Only human-reviewed editorials enter this published static dataset.
 const item=(allReviewed as unknown[]).find(record=>
   !!record&&typeof record==='object'&&(record as {id?:string}).id===key);
 return validatedReviewedEditorial(item,identity);
}
