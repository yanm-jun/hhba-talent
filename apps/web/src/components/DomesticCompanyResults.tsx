import {useMemo} from 'react';
import {Building2,ArrowRight,GraduationCap} from 'lucide-react';
import profiles from '../data/domesticCareerProfiles.json';
import {Link} from '../router';
import {getDomesticCompanies,searchDomesticCompanies,type DomesticCompany} from '../services/domesticCompanySearch';
import {matchingMajors,majorById} from '../services/domesticMajors';
import '../styles/domestic-company-search.css';
type Preview={displayName?:string;summary?:string;brandImage?:string};
const rich=profiles as Record<string,Preview>;
type Props={query:string;majorSlug?:string;scope?:string;country?:string;city?:string};
export function DomesticCompanyResults({query,majorSlug='',scope='',country='',city=''}:Props){
 const all=getDomesticCompanies();
 const word=query.trim();
 const chosen=majorById(majorSlug);
 const list=useMemo(()=>{
  if(scope==='global')return [];
  // This control discovers Chinese business-related employers; it does not filter foreign ATS job openings.
  if(country&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country))return [];
  let eligible=chosen?all.filter(company=>company.entityKind!=='business'&&matchingMajors(company).some(major=>major.slug===chosen.slug)):all;
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
  {chosen&&<div className="domestic-major-filter-active"><GraduationCap size={15}/>已选择：<strong>{chosen.name}</strong><span>根据公开业务方向匹配，非在招承诺</span></div>}
  <p className="domestic-company-caution">输入一个汉字即可搜索企业。选择专业后可进一步输入企业名称；进入公司详情可查看已核验的官方招聘渠道。</p>
  {!list.length&&<p className="domestic-company-empty">未找到同时符合当前专业、关键词或地区条件的企业，请调整筛选。</p>}
  <div className="domestic-company-grid">{list.map(company=>{
   const editorial=rich[company.name];
   return <Link className="domestic-company-card" key={company.id} to={company.route}>
    <div className="domestic-company-card-head"><span className="domestic-result-brand" aria-hidden="true">
      {editorial?.brandImage?<img loading="lazy" src={editorial.brandImage} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<Building2 size={19}/>}
     </span><strong>{editorial?.displayName||company.name}</strong></div>
    <small>{company.industry}{company.city?' · '+company.city:''}{company.parentName?' · 关联：'+company.parentName:''}</small>
    <p>{editorial?.summary||company.overview}</p>
    <footer><span>{editorial?.summary?'完整企业介绍':company.status==='industry_reviewed'?'业务资料已整理':'基础资料 · 待完善'}</span>
     <span>查看企业 <ArrowRight size={14}/></span></footer>
   </Link>})}</div>
  </section>;
}
