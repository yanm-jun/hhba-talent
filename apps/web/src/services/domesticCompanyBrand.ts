import autumn from '../data/domesticAutumnScreenshot20261028.json';
import media from '../data/domesticMediaBundle.json';
import media200 from '../data/domesticMedia200Bundle.json';
import catalogue from '../data/domesticAutumnBrandMediaRegistry.json';
import {domesticV2Records} from './domesticRebuildJobs';
import {employerProfileFor} from './employerProfiles';

/**
 * One resolved asset per employer identity, reused by search cards, autumn
 * directory and domestic V2 job cards. User-approved uploaded images win over
 * historical catalog entries. Never guess the corporate identity by substring.
 */
export type DomesticBrand={path:string;source:'user_supplied'|'catalogue'|'saved_company_media';verifiedByOwner:boolean};
const uploaded:Record<string,string>={
 'cn-autumn-001':'images/autumn-real-logos/cn-autumn-001.svg',
 'cn-autumn-002':'images/autumn-real-logos/cn-autumn-002.svg',
 'cn-autumn-003':'images/pfizer-user/pfizer-logo.webp',
 'cn-autumn-004':'images/csair-user/csair-logo.png',
 'cn-autumn-005':'images/sf-user/sf-logo.webp',
 'cn-autumn-006':'images/netease-user/netease-logo.png',
 'cn-autumn-007':'images/hypergryph-user/hypergryph-logo.png',
 'cn-autumn-008':'images/autumn-real-logos/cn-autumn-008.svg',
 'cn-autumn-009':'images/laifen-user/laifen-logo.webp',
 'cn-autumn-010':'images/shkp-user/shkp-logo.webp',
 'cn-autumn-011':'images/boyu-user/boyu-logo.webp'
};
const byName=new Map(autumn.entries.map(e=>[e.name,e.id]));
const jobRoutes=new Map<string,string>();
for(const job of domesticV2Records){
 if(job.employerRoute){
  jobRoutes.set(job.company,job.employerRoute);
  if(job.companyZh)jobRoutes.set(job.companyZh,job.employerRoute);
 }
}
const catalogueMarks=catalogue.entries as Record<string,{id?:string;path?:string}>;
const mediaBrands={...media.companies,...media200.companies} as Record<string,{brand?:{state:string;path?:string}}>;
function safePath(path:string|undefined){
 return typeof path==='string'&&/^(?:domestic-media|images\/[a-z0-9-]+)\/[a-z0-9-]+\.(?:svg|webp|png|jpg|jpeg)$/i.test(path)&&!path.includes('..')?path:null;
}
function idFromRoute(route:string|undefined){
 const match=route?.match(/^\/companies\/autumn\/(cn-autumn-\d{3})$/);
 return match?.[1]||null;
}
const findId=(name:string,route?:string)=>{
 return idFromRoute(route)||byName.get(name)||idFromRoute(jobRoutes.get(name))||null;
};
export function domesticBrandFor(input:{name:string;route?:string}):DomesticBrand|null{
 const configured=employerProfileFor(input);
 if(configured)return {path:configured.media.logo,source:'user_supplied',verifiedByOwner:false};
 const id=findId(input.name,input.route);
 if(id&&uploaded[id]&&safePath(uploaded[id]))return {path:uploaded[id],source:'user_supplied',verifiedByOwner:false};
 const saved=mediaBrands[input.name]?.brand;
 const savedPath=saved?.state==='ready'?safePath(saved.path):null;
 if(savedPath)return {path:savedPath,source:'saved_company_media',verifiedByOwner:false};
 const mark=catalogueMarks[input.name];
 const p=mark&&id===mark.id?safePath(mark.path):null;
 if(p)return {path:p!,source:'catalogue',verifiedByOwner:false};
 return null;
}
export function domesticBrandUrl(input:{name:string;route?:string}):string|null{
 const found=domesticBrandFor(input);
 return found?import.meta.env.BASE_URL+found.path:null;
}
export const uploadedAutumnBrands=uploaded; // build-time asset integrity tests
