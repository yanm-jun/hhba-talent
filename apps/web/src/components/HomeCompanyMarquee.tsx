import { useState } from 'react';
import { ArrowUpRight, Building2 } from 'lucide-react';
import { Link } from '../router';
import { verifiedBrandKey } from './EmployerBrandLogo';
import { encodeEmployerIdentity } from '../services/companyDirectory';
import { verifiedBrandRecords, type VerifiedBrand } from '../services/verifiedBrandRegistry';
import '../styles/home-company-marquee.css';

// Actual source-reviewed logo identities are the only source of entries.
// No third-party logo proxy, AI artwork, simulated company marks or cooperation claim.
const featuredOrder=['OpenAI','Anthropic','SpaceX'];
const employers=verifiedBrandRecords()
  .filter(item=>!!encodeEmployerIdentity(item))
  .sort((a,b)=>{
    const ia=featuredOrder.indexOf(a.company),ib=featuredOrder.indexOf(b.company);
    if(ia!==-1||ib!==-1)return (ia===-1?999:ia)-(ib===-1?999:ib);
    return a.company.localeCompare(b.company,'en');
  })
  .map(item=>({
    ...item,
    route:(()=>{
      const known=verifiedBrandKey(item);
      return known?'/companies/'+known:'/companies/id/'+encodeEmployerIdentity(item);
    })()
  }));

type EmployerTile=VerifiedBrand&{route:string};
function MarqueeBrand({brand,clone,index}:{brand:EmployerTile;clone:boolean;index:number}){
  const [broken,setBroken]=useState(false);
  const label=brand.company==='Anthropic'?'Anthropic（Claude）':brand.company;
  return <li className="home-company-marquee-item">
    <Link className="home-company-marquee-link" to={brand.route}
      title={'查看 '+brand.company+' 企业介绍与岗位'} tabIndex={clone?-1:0}>
      <span className={'home-company-marquee-icon'+(brand.wide?' is-wide':'')}>
        {broken?<Building2 aria-hidden="true" size={25}/>:
         <img src={import.meta.env.BASE_URL+'brands/'+brand.file}
           alt={clone?'':brand.company+' 品牌标识'}
           loading={index<8?'eager':'lazy'} decoding="async"
           onError={()=>setBroken(true)}/>}
      </span>
      <span className="home-company-marquee-name">{label}</span>
    </Link>
  </li>;
}
function BrandRun({clone=false}:{clone?:boolean}){
  return <ul className={'home-company-marquee-run'+(clone?' is-copy':'')}
     aria-hidden={clone?'true':undefined}>
    {employers.map((brand,index)=><MarqueeBrand key={brand.platform+':'+brand.source+':'+brand.company}
      brand={brand} clone={clone} index={index}/>)}
  </ul>;
}

export function HomeCompanyMarquee(){
  if(!employers.length)return null;
  return <section className="home-company-marquee"
    aria-label="HHBA 已核验企业品牌展示">
    <div className="home-company-marquee-heading">
      <div>
        <p className="home-company-marquee-kicker">HHBA · EXPLORE COMPANIES</p>
        <h2>探索更多招聘企业</h2>
        <p className="home-company-marquee-description">
          {employers.length} 个来源可追溯的企业品牌 · 点击查看企业介绍和真实岗位
        </p>
      </div>
      <Link className="home-company-marquee-all" to="/companies">
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
      品牌信息来自公开招聘来源及品牌资料，不代表相关企业与 HHBA 存在招聘合作。
    </p>
  </section>;
}
