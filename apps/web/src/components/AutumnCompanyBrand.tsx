import {useState} from 'react';
import bundled from '../data/domesticMediaBundle.json';
import additionalMedia from '../data/domesticMedia200Bundle.json';

const readyBrands={...bundled.companies,...additionalMedia.companies} as Record<string,{brand?:{state:string;path?:string}}>;

export function AutumnCompanyBrand({name,large=false}:{name:string;large?:boolean}){
 const [imageFailed,setImageFailed]=useState(false);
 const logo=readyBrands[name]?.brand;
 const path=logo?.state==='ready'&&logo.path?import.meta.env.BASE_URL+logo.path:null;
 const letters=Array.from(name.trim()).slice(0,2).join('')||'企';
 return <span className={'hhba-autumn-brand '+(large?'hhba-autumn-brand-large':'')} title={path&&!imageFailed?name+' · 已保存的企业品牌图':name+' · HHBA名称标识，非企业官方Logo'} aria-label={path&&!imageFailed?name+'企业标识':name+'的文字名称标识，非官方Logo'}>
  {path&&!imageFailed?<img src={path} alt={name+'已核实来源的品牌图'} loading="lazy" onError={()=>setImageFailed(true)}/>:
   <span className="hhba-autumn-brand-text" aria-hidden="true">{letters}</span>}
 </span>;
}
