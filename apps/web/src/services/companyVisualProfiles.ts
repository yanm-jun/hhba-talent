import dataset from '../data/companyVisualProfiles.json';
import { verifiedBrandRecords } from './verifiedBrandRegistry';
import type { EmployerIdentity } from './companyDirectory';

export type VisualLanguage = 'zh' | 'en';
export type VisualText = {zh:string;en:string};
export type CommonsPhoto = {
 file:string;author:string;license:string;caption:VisualText;location:VisualText;
 date?:string;takenAt?:string;kind?:'office-building'|'workplace';
};
export type FounderRecord = {name:string;role:VisualText;source:string;photo:CommonsPhoto|null};
export type CompanyVisualRecord = {
 company:string;platform:string;source:string;people:FounderRecord[];
 workplaces:CommonsPhoto[];relationship:VisualText|null;
};
const key=(p:Pick<EmployerIdentity,'company'|'platform'|'source'>)=>
 JSON.stringify([p.platform,p.source,p.company]);
const vetted=new Set(verifiedBrandRecords().map(key));
const registry=new Map<string,CompanyVisualRecord>();
for(const item of dataset.records){
 const record=item as CompanyVisualRecord;
 const id=key(record);
 if(vetted.has(id) && !registry.has(id))registry.set(id,record);
}
export function visualProfileFor(identity:EmployerIdentity):CompanyVisualRecord|null{
 const id=key(identity);
 return vetted.has(id)?registry.get(id)||null:null;
}
export function commonsImage(photo:CommonsPhoto,width=560):string|null{
 if(!/^[^/?#<>:]{3,180}[.](?:jpe?g|png|webp)$/i.test(photo.file))return null;
 const max=Math.max(240,Math.min(width,1024));
 return 'https://commons.wikimedia.org/wiki/Special:FilePath/'+
  encodeURIComponent(photo.file.replaceAll(' ','_'))+'?width='+max;
}
export function commonsCredit(photo:CommonsPhoto):string|null{
 if(!commonsImage(photo))return null;
 return 'https://commons.wikimedia.org/wiki/File:'+
  encodeURIComponent(photo.file.replaceAll(' ','_'));
}
export const companyVisualInventory={
 brands:vetted.size,
 recorded:registry.size,
 founders:dataset.records.reduce((n,r)=>n+r.people.length,0),
 portraits:dataset.records.reduce((n,r)=>n+r.people.filter(p=>p.photo).length,0),
 workplaces:dataset.records.reduce((n,r)=>n+r.workplaces.length,0)
};
