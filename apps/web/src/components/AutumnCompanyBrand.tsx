import {useState} from 'react';
import bundled from '../data/domesticMediaBundle.json';
import additionalMedia from '../data/domesticMedia200Bundle.json';
import employersJSON from '../data/domesticAutumnScreenshot20261028.json';

// Existing locally reviewed logos win; original HHBA brand nameplates fill any gaps.
// Names are matched against the exact screenshot record to avoid confusing subsidiaries.
const readyBrands={...bundled.companies,...additionalMedia.companies} as Record<string,{brand?:{state:string;path?:string}}>;
const idByName=new Map(employersJSON.entries.map(x=>[x.name,x.id]));
function safeLocalBrand(path?:string){
 return typeof path==='string'&&/^domestic-media\/[a-z0-9-]+\.(svg|webp|png|jpg|jpeg)$/i.test(path)?path:null;
}
function nameplate(name:string){
 const clean=name.trim().replace(/(有限责任公司|股份有限公司|有限公司|集团有限公司)$/,'');
 return Array.from(clean).slice(0,2).join('')||'企业';
}
export function AutumnCompanyBrand({name,large=false}:{name:string;large?:boolean}){
 const [imageFailed,setImageFailed]=useState(false);
 const logo=readyBrands[name]?.brand;
 const officialPath=logo?.state==='ready'?safeLocalBrand(logo.path):null;
 const id=idByName.get(name);
 const imagePath=officialPath|| (id?'images/autumn-brand/'+id+'.svg':null);
 const hasImage=!!imagePath&&!imageFailed;
 const official=!!officialPath;
 return <span className={'hhba-autumn-brand '+(large?'hhba-autumn-brand-large':'')}
   title={official?name+' · 已核验本地品牌图':name+' · HHBA原创企业名称标识，非官方Logo'}
   aria-label={official?name+'企业品牌图':name+'的HHBA设计标识，非企业官方Logo'}>
  {hasImage?<img src={import.meta.env.BASE_URL+imagePath} alt={official?name+'企业品牌图':name+' HHBA设计名称标识（非官方Logo）'} loading="lazy" onError={()=>setImageFailed(true)}/>:
   <span className="hhba-autumn-brand-text" aria-hidden="true">{nameplate(name)}</span>}
 </span>;
}
