import {useState} from 'react';
import {ArrowUpRight,Building2} from 'lucide-react';
import {Link} from '../router';
import curated200 from '../data/domesticComplete200Target.json';
import originalMedia from '../data/domesticMediaBundle.json';
import expandedMedia from '../data/domesticMedia200Bundle.json';
import {getDomesticCompanies} from '../services/domesticCompanySearch';
import '../styles/home-company-marquee.css';

// Static HHBA-owned Chinese company records only. Never query an overseas ATS,
// download a remote logo, guess a brand from the employer name, or create a job.
type StoredLogo={
 state:string;path?:string;source?:string;classification?:string
};
type StoredCompanyMedia={brand?:StoredLogo};
type BrandTile={name:string;route:string;file:string;verified:boolean};
const domesticMedia={
 ...(originalMedia.companies as Record<string,StoredCompanyMedia>),
 ...(expandedMedia.companies as Record<string,StoredCompanyMedia>)
};
const targetNames=curated200.companyNames as string[];
const indexedCompanies=new Map(getDomesticCompanies().map(company=>[company.name,company]));
const brands:BrandTile[]=targetNames.flatMap(name=>{
 const company=indexedCompanies.get(name);
 const logo=domesticMedia[name]?.brand;
 if(!company||!company.route.startsWith('/companies/domestic/')||
    logo?.state!=='ready'||!logo.path||
    !/^domestic-media\/[a-z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/i.test(logo.path)||
    !['logo_identity_checked','user_submitted_logo_pending_identity'].includes(logo.classification||''))return [];
 return [{name,route:company.route,file:logo.path,
   verified:logo.classification==='logo_identity_checked'}];
}).sort((a,b)=>Number(b.verified)-Number(a.verified));

function MarqueeBrand({brand,clone,index}:{brand:BrandTile;clone:boolean;index:number}){
 const [broken,setBroken]=useState(false);
 return <li className="home-company-marquee-item">
  <Link className="home-company-marquee-link" to={brand.route}
    title={'查看 HHBA 内的 '+brand.name+' 企业档案'} tabIndex={clone?-1:0}>
   <span className="home-company-marquee-icon">
    {broken?<Building2 aria-hidden="true" size={25}/>:
     <img src={import.meta.env.BASE_URL+brand.file}
       alt={clone?'':brand.name+(brand.verified?' 已核对品牌标识':' 已登记品牌图片（待复核）')}
       loading={index<8?'eager':'lazy'} decoding="async"
       onError={()=>setBroken(true)}/>}
   </span>
   <span className="home-company-marquee-name">{brand.name}</span>
  </Link>
 </li>;
}
function BrandRun({clone=false}:{clone?:boolean}){
 return <ul className={'home-company-marquee-run'+(clone?' is-copy':'')}
   aria-hidden={clone?'true':undefined}>
  {brands.map((brand,index)=><MarqueeBrand key={brand.name}
    brand={brand} clone={clone} index={index}/>)}
 </ul>;
}

export function HomeCompanyMarquee(){
 if(!brands.length)return null;
 const pending=brands.some(brand=>!brand.verified);
 return <section className="home-company-marquee" aria-label="HHBA 国内企业品牌展示">
  <div className="home-company-marquee-heading">
   <div>
    <p className="home-company-marquee-kicker">HHBA · EXPLORE COMPANIES</p>
    <h2>探索更多国内企业</h2>
    <p className="home-company-marquee-description">
     {brands.length} 家已收录品牌图片的国内企业 · 点击查看 HHBA 站内企业资料
    </p>
   </div>
   <Link className="home-company-marquee-all" to="/companies/discover">
    浏览企业资料库 <ArrowUpRight size={15} aria-hidden="true"/>
   </Link>
  </div>
  <div className="home-company-marquee-window">
   <div className="home-company-marquee-track">
    <BrandRun/>
    <BrandRun clone/>
   </div>
  </div>
  <p className="home-company-marquee-disclaimer">
   {pending?'部分图片来自用户提供的品牌资料，身份仍待核对。':''}企业展示不代表正在招聘，也不代表与 HHBA 存在合作。
  </p>
 </section>;
}
