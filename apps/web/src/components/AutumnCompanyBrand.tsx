import {Building2} from 'lucide-react';
import bundled from '../data/domesticMediaBundle.json';
import additionalMedia from '../data/domesticMedia200Bundle.json';
import employersJSON from '../data/domesticAutumnScreenshot20261028.json';
import brandMedia from '../data/domesticAutumnBrandMediaRegistry.json';

// Only show employer-matched source images. Never present an HHBA illustration
// as a real company logo. Missing assets remain visibly unverified.
const readyBrands={...bundled.companies,...additionalMedia.companies} as Record<string,{brand?:{state:string;path?:string}}>;
const idByName=new Map(employersJSON.entries.map(x=>[x.name,x.id]));
const catalogMarks=brandMedia.entries as Record<string,{path:string;source:string;confidence:string}>;
function safeLocalBrand(path?:string){
 return typeof path==='string'&&/^domestic-media\/[a-z0-9-]+\.(svg|webp|png|jpg|jpeg)$/i.test(path)?path:null;
}
export function AutumnCompanyBrand({name,large=false}:{name:string;large?:boolean}){
 const logo=readyBrands[name]?.brand;
 const officialPath=logo?.state==='ready'?safeLocalBrand(logo.path):null;
 const id=idByName.get(name);
 const catalogPath=catalogMarks[name]?.path;
 const hasCatalogMark=!!id&&!!catalogPath&&new RegExp('^images/autumn-real-logos/'+id+'\\.(svg|jpg|png|webp)$').test(catalogPath);
 const imagePath=officialPath||(hasCatalogMark?catalogPath:null);
 const authenticSource=!!officialPath;
 return <span className={'hhba-autumn-brand '+(large?'hhba-autumn-brand-large':'')+(imagePath?' hhba-autumn-brand-has-logo':' hhba-autumn-brand-missing')}
   title={authenticSource?name+' · 已保存并核验的企业品牌标识':hasCatalogMark?name+' · 独立商标图集来源，尚待品牌方确认':name+' · 企业Logo待核验'}
   aria-label={authenticSource?name+'企业Logo':hasCatalogMark?name+'品牌标识（来自第三方图集）':name+' Logo待核验'}>
   {imagePath?<img src={import.meta.env.BASE_URL+imagePath} alt={authenticSource?name+'企业Logo':name+'品牌图集收录的Logo'} loading="lazy"/>:
    <Building2 size={large?31:19} aria-hidden="true"/>}
 </span>;
}
