import {useMemo,useState} from 'react';
import {Building2,ArrowRight,GraduationCap} from 'lucide-react';
import profiles from '../data/domesticCareerProfiles.json';
import bundled from '../data/domesticMediaBundle.json';
import {Link} from '../router';
import {getDomesticCompanies,searchDomesticCompanies,type DomesticCompany} from '../services/domesticCompanySearch';
import {companyMatchesSelectedMajor,majorById} from '../services/domesticMajors';
import '../styles/domestic-company-search.css';
type Preview={displayName?:string;summary?:string;brandImage?:string;officeLocations?:unknown[];photos?:unknown[];brandAssetStatus?:string};
const rich=profiles as Record<string,Preview>;
const available=bundled as {companies:Record<string,{brand?:{state:string;path?:string}}>};
type Props={query:string;majorSlug?:string;scope?:string;country?:string;city?:string};
function BrandMark({src,name}:{src?:string;name:string}){
 const [failed,setFailed]=useState(false);
 if(!src||failed)return <Building2 size={19} aria-label="企业图标待补充"/>;
 return <img loading="lazy" src={src} alt={name+'的企业网站图标'} onError={()=>setFailed(true)}/>;
}
export function DomesticCompanyResults({query,majorSlug='',scope='',country='',city=''}:Props){
 const all=getDomesticCompanies();
 const word=query.trim();
 const chosen=majorById(majorSlug);
 const list=useMemo(()=>{
  if(scope==='global')return [];
  // This control discovers Chinese business-related employers; it does not filter foreign ATS job openings.
  if(country&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country))return [];
  let eligible=chosen?all.filter(company=>company.entityKind!=='business'&&companyMatchesSelectedMajor(company,chosen.slug)):all;
  if(city)eligible=eligible.filter(company=>(company.city||'').includes(city)||(company.province||'').includes(city));
  if(word)return searchDomesticCompanies(eligible,word,36);
  return eligible.filter(company=>company.status==='industry_reviewed').sort((a,b)=>{
   const score=(company:DomesticCompany)=>Number(Boolean(rich[company.name]?.summary))*150+
     Number(Boolean(company.careers))*30+Number(Boolean(company.city))*5;
   return score(b)-score(a)||a.name.localeCompare(b.name,'zh-CN');
  }).slice(0,36);
 },[all,word,chosen,city,country,scope]);
 if(!word&&!chosen)return null;
 if(scope==='global'||country&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country))
  return <section className="domestic-company-result" aria-label="国内企业专业匹配"><p className="domestic-company-caution">「所学专业」用于关联国内企业业务方向。如需查看相关国内企业，请将地区改为“国内外全部”或“中国岗位”。海外岗位仍按照官方岗位条件筛选。</p></section>;
 return <section className="domestic-company-result" aria-label="国内企业搜索结果">
  <div className="domestic-company-title"><h3>{chosen?'与所学专业相关的国内企业':'相关国内企业'}</h3>
   <small>{'显示 '+list.length+' 家 · 企业名录 '+all.length.toLocaleString()+' 条'}</small></div>
  {chosen&&<div className="domestic-major-filter-active"><GraduationCap size={15}/>已选择：<strong>{chosen.name}</strong><span>按业务证据关联，非在招承诺</span></div>}
  <p className="domestic-company-caution">输入一个汉字即可搜索企业。选择专业后可进一步输入企业名称；进入公司详情可查看已核验的官方招聘渠道。</p>
  {!list.length&&<p className="domestic-company-empty">当前专业尚无经过业务证据核验的关联企业，或者不符合关键词与地区条件。可以更换专业，或清除专业筛选后直接搜索企业；这不代表没有企业招聘该专业。</p>}
  <div className="domestic-company-grid">{list.map(company=>{
   const editorial=rich[company.name];
   return <Link className="domestic-company-card" key={company.id} to={company.route}>
    <div className="domestic-company-card-head"><span className="domestic-result-brand" aria-hidden="true">
      <BrandMark src={available.companies[company.name]?.brand?.state==='ready'&&available.companies[company.name]?.brand?.path?import.meta.env.BASE_URL+(available.companies[company.name]?.brand?.path||''):undefined} name={company.name}/>
     </span><strong>{editorial?.displayName||company.name}</strong></div>
    <small>{company.industry}{company.city?' · '+company.city:''}{company.parentName?' · 关联：'+company.parentName:''}</small>
    {editorial?.displayName&&editorial.displayName!==company.name&&<small className="domestic-card-legal">企业主体：{company.name}</small>}
    <p>{editorial?.summary||company.overview}</p>
    <footer><span>{editorial?.summary?'企业介绍已整理':company.status==='industry_reviewed'?'业务资料已整理':'基础资料 · 待完善'}</span>
     <span>查看企业 <ArrowRight size={14}/></span></footer>
   </Link>})}</div>
  </section>;
}
