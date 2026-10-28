import {useState} from 'react';
import bundled from '../data/domesticMediaBundle.json';
import additionalMedia from '../data/domesticMedia200Bundle.json';

// Never infer a brand image from a company name. Only verified local media is
// eligible as an official company logo. Otherwise render an HHBA nameplate.
const readyBrands={...bundled.companies,...additionalMedia.companies} as Record<string,{brand?:{state:string;path?:string}}>;
function safeLocalBrand(path?:string){
 return typeof path==='string'&&/^domestic-media\/[a-z0-9-]+\.(svg|webp|png|jpg|jpeg)$/i.test(path)?path:null;
}
function nameplate(name:string){
 const clean=name.trim().replace(/^(中国|中华|中国大陆)/,'').replace(/(有限责任公司|股份有限公司|集团有限公司|有限公司|股份公司)$/,'');
 if(/^[\x20-\x7e]+$/.test(clean)){
  const words=clean.match(/[A-Za-z]+/g)||[];
  return words.length>1?words.slice(0,3).map(x=>x[0]).join('').toUpperCase():clean.replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase();
 }
 return Array.from(clean).slice(0,2).join('')||'企业';
}
function visualHue(name:string){
 let result=0;
 for(const char of name)result=(result*31+char.codePointAt(0)!)%360;
 return (result+120)%360;
}
export function AutumnCompanyBrand({name,large=false}:{name:string;large?:boolean}){
 const [imageFailed,setImageFailed]=useState(false);
 const logo=readyBrands[name]?.brand;
 const path=logo?.state==='ready'?safeLocalBrand(logo.path):null;
 const hasImage=!!path&&!imageFailed;
 const hue=visualHue(name);
 return <span className={'hhba-autumn-brand '+(large?'hhba-autumn-brand-large':'')}
   style={!hasImage?{background:`linear-gradient(135deg,hsl(${hue} 46% 95%),hsl(${hue} 38% 88%))`,color:`hsl(${hue} 52% 30%)`,borderColor:`hsl(${hue} 35% 82%)`}:undefined}
   title={hasImage?name+' · 已保存的企业品牌图':name+' · HHBA名称标识，非企业官方Logo'}
   aria-label={hasImage?name+'企业标识':name+'的文字名称标识，非官方Logo'}>
  {hasImage?<img src={import.meta.env.BASE_URL+path} alt={name+'已保存的品牌图'} loading="lazy" onError={()=>setImageFailed(true)}/>:
   <span className="hhba-autumn-brand-text" aria-hidden="true">{nameplate(name)}</span>}
 </span>;
}
