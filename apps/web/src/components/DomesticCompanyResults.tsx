import {useMemo,useState} from 'react';
import {Building2,ArrowRight,GraduationCap} from 'lucide-react';
import profiles from '../data/domesticCareerProfiles.json';
import {domestic200Profiles as additionalProfiles} from '../services/domesticCompany200Data';
import curated200 from '../data/domesticComplete200Target.json';
import bundled from '../data/domesticMediaBundle.json';
import additionalMedia from '../data/domesticMedia200Bundle.json';
import {Link} from '../router';
import {getDomesticCompanies,searchDomesticCompanies,type DomesticCompany} from '../services/domesticCompanySearch';
import {companyMatchesSelectedMajor,majorById} from '../services/domesticMajors';
import '../styles/domestic-company-search.css';
type Preview={displayName?:string;summary?:string;brandImage?:string;officeLocations?:unknown[];photos?:unknown[];brandAssetStatus?:string};
const allProfiles={...profiles,...additionalProfiles};
const rich=allProfiles as Record<string,Preview>;
const hasDeepProfile=(name:string)=>Boolean(rich[name]?.summary);
const isSubstantive=(name:string)=>{
 const record=allProfiles[name as keyof typeof allProfiles] as {description?:string[];business?:unknown[];majorSlugs?:string[];officialSource?:string;contentReview?:string}|undefined;
 const paragraphs=record?.description||[];
 const business=record?.business||[];
 const majors=record?.majorSlugs||[];
 return Boolean(record?.contentReview!=='first_pass_industry_explanation_not_official_company_detail_audited'&&record?.officialSource&&paragraphs.length>=3&&paragraphs.join('').length>=280&&business.length>=3&&majors.length>=4);
};
const available={companies:{...bundled.companies,...additionalMedia.companies}} as {companies:Record<string,{brand?:{state:string;path?:string}}>};
type Props={query:string;majorSlug?:string;scope?:string;country?:string;city?:string;browseDefault?:boolean};
function BrandMark({src,name}:{src?:string;name:string}){
 const [failed,setFailed]=useState(false);
 if(!src||failed)return <Building2 size={19} aria-label="企业图标待补充"/>;
 return <img loading="lazy" src={src} alt={name+'的企业网站图标'} onError={()=>setFailed(true)}/>;
}
export function DomesticCompanyResults({query,majorSlug='',scope='',country='',city='',browseDefault=false}:Props){
 const all=getDomesticCompanies();
 const [browse200,setBrowse200]=useState(browseDefault);
 const word=query.trim();
 const chosen=majorById(majorSlug);
 const list=useMemo(()=>{
  if(scope==='global')return [];
  // This control discovers Chinese business-related employers; it does not filter foreign ATS job openings.
  if(country&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country))return [];
  let eligible=chosen?all.filter(company=>company.entityKind!=='business'&&companyMatchesSelectedMajor(company,chosen.slug)):all;
  if(city)eligible=eligible.filter(company=>(company.city||'').includes(city)||(company.province||'').includes(city));
  if(word)return searchDomesticCompanies(eligible,word,36);
  if(!chosen&&browse200){
   const ids=new Map((curated200.companyNames as string[]).map((name,i)=>[name,i]));
   return eligible.filter(company=>ids.has(company.name)).sort((a,b)=>(ids.get(a.name)||0)-(ids.get(b.name)||0)).slice(0,200);
  }
  return eligible.filter(company=>company.status==='industry_reviewed').sort((a,b)=>{
   const score=(company:DomesticCompany)=>Number(Boolean(rich[company.name]?.summary))*150+
     Number(Boolean(company.careers))*30+Number(Boolean(company.city))*5;
   return score(b)-score(a)||a.name.localeCompare(b.name,'zh-CN');
  }).slice(0,36);
 },[all,word,chosen,city,country,scope,browse200]);
 if(!word&&!chosen&&!browse200){
  if(scope==='global'||country&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country))return null;
  return <div className="domestic-browse100-entry">
   <button type="button" onClick={()=>setBrowse200(true)}>浏览企业发现 200 家档案 <ArrowRight size={14}/></button>
   <small>按企业主体查看真实介绍、相关专业与已登记的官方招聘渠道</small>
  </div>;
 }
 if(scope==='global'||country&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country))
  return <section className="domestic-company-result" aria-label="国内企业专业匹配"><p className="domestic-company-caution">「所学专业」用于关联国内企业业务方向。如需查看相关国内企业，请将地区改为“国内外全部”或“中国岗位”。海外岗位仍按照官方岗位条件筛选。</p></section>;
 return <section className="domestic-company-result" aria-label="国内企业搜索结果">
  <div className="domestic-company-title"><h3>{chosen?'与所学专业相关的国内企业':browse200&&!word?'企业发现 · 200 家档案':'相关国内企业'}</h3>
   <small>{'显示 '+list.length+' 家 · 企业名录 '+all.length.toLocaleString()+' 条'}</small></div>
  {chosen&&<div className="domestic-major-filter-active"><GraduationCap size={15}/>已选择：<strong>{chosen.name}</strong><span>按业务证据关联，非在招承诺</span></div>}
  <p className="domestic-company-caution">可按企业名称或专业筛选；部分新增公司图片或招聘入口仍待核验，企业详情将明确展示状态。</p>
  {!list.length&&<p className="domestic-company-empty">当前专业尚无经过业务证据核验的关联企业，或者不符合关键词与地区条件。可以更换专业，或清除专业筛选后直接搜索企业；这不代表没有企业招聘该专业。</p>}
  <div className="domestic-company-grid">{list.map(company=>{
   const editorial=rich[company.name];
   return <Link className="domestic-company-card" key={company.id} to={company.route}>
    <div className="domestic-company-card-head"><span className="domestic-result-brand" aria-hidden="true">
      <BrandMark src={available.companies[company.name]?.brand?.state==='ready'&&available.companies[company.name]?.brand?.path?import.meta.env.BASE_URL+(available.companies[company.name]?.brand?.path||''):undefined} name={company.name}/>
     </span><strong>{editorial?.displayName||company.name}</strong></div>
    <small>{company.industry}{company.city?' · '+company.city:''}{company.parentName?' · 关联：'+company.parentName:''}</small>
    {editorial?.displayName&&editorial.displayName!==company.name&&<small className="domestic-card-legal">企业主体：{company.name}</small>}
    {hasDeepProfile(company.name)?<p>{editorial?.summary}</p>:
     <p className="domestic-directory-card-description">上市主体名录记录；当前尚无足够的企业官网证据支持详细业务介绍。{company.stockCode?'证券代码：'+company.stockCode+'。':''}</p>}
    <footer><span>{isSubstantive(company.name)?'有来源的深度介绍':hasDeepProfile(company.name)?'已整理业务内容 · 仍需完善':'仅名录信息 · 不冒充深度介绍'}</span>
     <span>{hasDeepProfile(company.name)?'查看企业详情':'查看名录事实'} <ArrowRight size={14}/></span></footer>
   </Link>})}</div>
  </section>;
}
