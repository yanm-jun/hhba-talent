import { useMemo } from 'react';
import { Building2,ArrowRight } from 'lucide-react';
import profiles from '../data/domesticCareerProfiles.json';
import { Link } from '../router';
import { getDomesticCompanies,searchDomesticCompanies } from '../services/domesticCompanySearch';
import '../styles/domestic-company-search.css';
type Preview={displayName?:string;summary?:string;brandImage?:string};
const rich=profiles as Record<string,Preview>;
export function DomesticCompanyResults({query}:{query:string}){
 const companies=getDomesticCompanies();
 const word=query.trim();
 const matched=useMemo(()=>searchDomesticCompanies(companies,word),[companies,word]);
 if(!word)return null;
 return <section className="domestic-company-result" aria-label="国内企业搜索结果">
 <div className="domestic-company-title"><h3>相关国内企业</h3><small>{'显示 '+matched.length+' 家 · 收录 '+companies.length.toLocaleString()+' 条企业与经营主体记录'}</small></div>
 <p className="domestic-company-caution">输入一个汉字即可匹配企业名称；点击企业阅读档案。专业关联不等于当前正在招聘。</p>
 {!matched.length&&<p className="domestic-company-empty">暂未找到名称或业务相符的企业，请尝试完整企业名称。</p>}
 <div className="domestic-company-grid">{matched.map(company=>{
 const editorial=rich[company.name];
 return <Link className="domestic-company-card" key={company.id} to={company.route}>
  <div className="domestic-company-card-head"><span className="domestic-result-brand" aria-hidden="true">
   {editorial?.brandImage?<img loading="lazy" src={editorial.brandImage} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<Building2 size={19}/>}
  </span><strong>{editorial?.displayName||company.name}</strong></div>
  <small>{company.industry}{company.city?' · '+company.city:''}{company.parentName?' · 关联：'+company.parentName:''}</small>
  <p>{editorial?.summary||company.overview}</p>
  <footer><span>{editorial?.summary?'完整企业介绍':company.status==='industry_reviewed'?'业务资料已整理':'基础资料 · 待完善'}</span><span>查看企业 <ArrowRight size={14}/></span></footer>
 </Link>;
 })}</div>
 </section>;
}