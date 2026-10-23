import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Building2,ShieldCheck,ChevronDown,MapPin,Images} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {getDomesticCompanies,companyById,findParentCompany,findRelatedCompanies} from '../services/domesticCompanySearch';
import {matchingMajors} from '../services/domesticMajors';
import profiles from '../data/domesticCareerProfiles.json';
import bundled from '../data/domesticMediaBundle.json';
import type {User} from '../services/api';
import '../styles/domestic-company-search.css';

type Reviewed={
 displayName:string;subtitle:string;summary?:string;description:string[];
 business:{title:string;description:string}[];majorSlugs:string[];
 careersUrl?:string;careersLabel?:string;officialSource:string;productSource?:string;
 brandImage?:string;imageSource?:string;brandImageSource?:string;brandAssetStatus?:string;lastReviewed:string;
 photos?:{url:string;label:string;source:string}[];
 officeLocations?:{type:string;address:string;source:string}[];
 photoSourcePage?:string;photoSourceLabel?:string;
 evidenceLevel?:string;
};
const curated=profiles as Record<string,Reviewed>;
const available=bundled as {companies:Record<string,{brand?:{state:string;path?:string};photos?:{state:string;path?:string}[]}>};
function httpsLink(value?:string){
 if(!value)return '';
 try{const u=new URL(/^https?:\/\//i.test(value)?value:'https://'+value);
 return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return ''}
}
export function DomesticCompanyPage({user,id}:{user:User|null;id:string}){
 const all=useMemo(()=>getDomesticCompanies(),[]);
 const company=useMemo(()=>companyById(all,id),[all,id]);
 const [imageFailed,setImageFailed]=useState(false);
 const [filter,setFilter]=useState('');
 useEffect(()=>{setFilter('');setImageFailed(false)},[id]);
 const back=getCompanyReturnTarget();
 const parent=company?findParentCompany(all,company):null;
 const related=company?findRelatedCompanies(all,company):[];
 const article=company?curated[company.name]:undefined;
 const media=company?available.companies[company.name]:undefined;
 const brandSrc=media?.brand?.state==='ready'?import.meta.env.BASE_URL+media.brand.path:undefined;
 const majors=company?matchingMajors(company):[];
 const careers=company?httpsLink(article?.careersUrl||company.careers):'';
 const shownRelated=related.filter(c=>(c.name+c.industry+(c.city||'')+c.tags.join(' ')).toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())).slice(0,24);
 return <Shell user={user}><article className="domestic-company-profile domestic-editorial-profile">
  <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState} className="domestic-company-back"><ArrowLeft size={16}/> 返回上一页</Link>
  {!company?<section className="domestic-editorial-panel"><h1>企业资料尚未找到</h1><Link to="/candidate/jobs">返回企业搜索</Link></section>:
   <div className="domestic-editorial-panel">
    <header className="domestic-editorial-hero">
     <div className="domestic-company-profile-mark" aria-label="企业视觉资料">
      {brandSrc&&!imageFailed?<img src={brandSrc} alt={company.name+'的企业官网图标'} onError={()=>setImageFailed(true)}/>:
       <Building2 size={26} aria-hidden="true"/>}
     </div>
     <div className="domestic-profile-identity">
      <span className="domestic-editorial-eyebrow">HHBA · COMPANY PROFILE</span>
      <h1>{article?.displayName||company.name}</h1>
      <p>{article?.subtitle||company.industry}{company.city?' · '+company.city:''}</p>
      {article?.displayName&&article.displayName!==company.name&&<small>经营主体：{company.name}</small>}
      {article?.officeLocations?.length? <small className="domestic-profile-office-hint"><MapPin size={13}/>{article.officeLocations[0].address}</small>:null}
      {article&&!brandSrc?<small className="domestic-media-confidence">正式品牌 Logo 尚未核验；已屏蔽失效图片地址</small>:null}
      {brandSrc&&<small className="domestic-media-confidence">
       {article.brandAssetStatus==='official_domain_favicon_unverified_visual'?'当前显示企业网站图标，尚未确认为正式品牌 Logo':'品牌图来源已登记，显示状态以实际加载结果为准'}
      </small>}
     </div>
    </header>
    <section className="domestic-editorial-section" aria-label="企业介绍">
      <h2>企业介绍</h2>
      {article?<div className="domestic-editorial-body">{article.description.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>:
       <div className="domestic-editorial-body"><p>{company.name}已收录至 HHBA 企业资料库。{company.industry!=='行业待细分'?'现有行业分类为：'+company.industry+'。':''}目前尚缺完整的官网核验资料，因此不编造企业历史、技术优势或招聘要求。</p>
       {company.legalName&&<p>工商主体名称：{company.legalName}</p>}
       {company.stockCode&&<p>上市证券代码：{company.stockCode}</p>}
       <p className="domestic-editorial-limited">资料状态：基础档案。点击“资料来源”可查看已有出处；详细介绍将按官方资料逐步补齐。</p></div>}
      {article&&<div className="domestic-editorial-business">
       {article.business.map(item=><div key={item.title}><strong>{item.title}</strong><p>{item.description}</p></div>)}
      </div>}
    </section>
    {article?.photos?.some((_,i)=>media?.photos?.[i]?.state==='ready')?<section className="domestic-editorial-section domestic-editorial-photos" aria-label="企业真实图片">
      <h2>企业与产品实景</h2>
      <div className="domestic-editorial-photo-grid">
       {article!.photos!.filter((_,i)=>media?.photos?.[i]?.state==='ready').map(photo=><figure key={photo.url} className="domestic-official-photo">
        <a href={photo.source} target="_blank" rel="noopener noreferrer" aria-label={'查看'+photo.label+'的来源'}>
         <img src={import.meta.env.BASE_URL+media!.photos![article.photos!.indexOf(photo)].path} loading="lazy" alt={photo.label} onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement?.classList.add('domestic-photo-unavailable')}}/>
         <span className="domestic-photo-fallback"><Images size={18}/>点击查看官网图片</span>
        </a>
        <figcaption>{photo.label} · 官方来源</figcaption>
       </figure>)}
      </div>
     </section>:null}
    {article?.photoSourcePage&&!article.photos?.length?
     <section className="domestic-editorial-section" aria-label="官方企业实景来源"><h2>企业实景与办公环境</h2>
      <p className="domestic-company-note">图片暂未核验为可在本站稳定展示，避免错用其他企业照片。</p>
      <a href={article.photoSourcePage} target="_blank" rel="noopener noreferrer" className="domestic-careers-link">
       {article.photoSourceLabel||'查看官网企业实景资料'} <ExternalLink size={14}/></a></section>:null}
    {article?.officeLocations?.length?<section className="domestic-editorial-section" aria-label="办公地点">
      <h2>总部与办公地点</h2>
      <div className="domestic-office-list">{article.officeLocations.map(entry=><div key={entry.address}><MapPin size={17}/><div><strong>{entry.type}</strong><p>{entry.address}</p>
       <a target="_blank" rel="noopener noreferrer" href={entry.source}>查看官方地址来源 <ExternalLink size={12}/></a></div></div>)}</div>
      <p className="domestic-company-note">办公地址不代表该地点当前正在招聘；若需要前往现场，请先通过企业官网确认。</p>
     </section>:null}
    <section className="domestic-editorial-section" aria-label="适合哪些专业背景">
      <h2>适合哪些专业背景？</h2>
      {majors.length?<div className="domestic-profile-tags domestic-major-tags">
       {majors.map(major=><Link className="domestic-major-tag" key={major.slug} to={'/majors/'+major.slug}
        aria-label={'查看与'+major.name+'相关的企业'}>{major.name}<ArrowRight size={13}/></Link>)}</div>:
       <p className="domestic-editorial-limited">暂无足够资料判断该企业与哪些专业方向相关，正在逐步完善。</p>}
      <p className="domestic-company-note">根据企业公开业务与技术方向整理的专业关联，不等于该企业正在招聘这些专业的学生。点击专业可发现更多业务相关企业。</p>
    </section>
    <section className="domestic-editorial-section domestic-careers" aria-label="官方招聘渠道">
      <h2>官方招聘渠道</h2>
      <p>点击企业招聘页面查看当前招聘信息、岗位职责和实际申请条件；HHBA 不同步或虚构国内企业职位。</p>
      {careers?<div className="domestic-careers-row"><div><strong>{article?.careersLabel||'企业招聘入口'}</strong>
       <small>{article?'与该经营主体对应的官方招聘页面':'经独立核验的企业官方招聘页面'}</small></div>
       <a href={careers} target="_blank" rel="noopener noreferrer" className="domestic-careers-link">查看招聘官网 <ExternalLink size={15}/></a></div>:
       <div className="domestic-editorial-limited">尚未核验该主体的官方招聘入口，暂不展示“查看招聘官网”按钮。
       {httpsLink(company.website)&&<p><a href={httpsLink(company.website)} target="_blank" rel="noopener noreferrer">访问企业官网了解更多 <ExternalLink size={13}/></a></p>}</div>}
    </section>
    <section className="domestic-editorial-section domestic-editorial-sources" aria-label="资料来源">
      <details className="domestic-company-sources" key={"sources-"+company.id}>
       <summary>资料来源与核验说明 <ChevronDown size={15}/></summary>
       <div>{httpsLink(article?.officialSource||company.sourceUrl)&&<a href={httpsLink(article?.officialSource||company.sourceUrl)} target="_blank" rel="noopener noreferrer">企业公开资料 <ExternalLink size={13}/></a>}
       {article?.productSource&&<a href={article.productSource} target="_blank" rel="noopener noreferrer">公开产品资料 <ExternalLink size={13}/></a>}
       {article?.imageSource&&<a href={article.imageSource} target="_blank" rel="noopener noreferrer">企业图片来源 <ExternalLink size={13}/></a>}
       {article?.brandImageSource&&<a href={article.brandImageSource} target="_blank" rel="noopener noreferrer">
        {article.brandAssetStatus==='official_domain_favicon_unverified_visual'?'企业官网图标来源（品牌Logo待核实）':'品牌图来源'} <ExternalLink size={13}/></a>}
       {httpsLink(company.website)&&<a href={httpsLink(company.website)} target="_blank" rel="noopener noreferrer">企业网站 <ExternalLink size={13}/></a>}
       <p>资料日期：{article?.lastReviewed||company.lastReviewed}。企业介绍和专业方向由 HHBA 独立整理，不代表企业招聘合作。</p></div>
      </details>
    </section>
    {(parent||related.length>0)&&<section className="domestic-editorial-section domestic-profile-relations" aria-label="企业关系">
      <details key={"relations-"+company.id}>
       <summary>企业关系 <span>按需查看</span><ChevronDown size={16}/></summary>
       <div className="domestic-relations-inside">
        {parent&&<p>所属或关联主体：<Link to={parent.route}>{parent.name} <ArrowRight size={13}/></Link> <small>· {company.relationLabel||'关联关系'}</small></p>}
        {related.length>0&&<><p>已整理 {related.length} 条子公司、分支机构及业务板块关系记录，不代表均为直接全资控股。</p>
         <label className="domestic-relations-search"><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="搜索关联企业" aria-label="搜索关联企业"/></label>
         <div className="domestic-relations-compact">{shownRelated.map(item=><Link key={item.id} to={item.route}>{item.name}<ArrowRight size={13}/></Link>)}</div>
         {related.length>24&&<small>为保持页面简洁，仅展示前 24 条匹配关系。</small>}
        </>}
       </div>
      </details>
    </section>}
    <p className="domestic-company-disclaimer"><ShieldCheck size={15}/> 企业信息与专业关联供职业探索参考，真实招聘要求以企业官网为准。</p>
   </div>}
 </article></Shell>;
}
