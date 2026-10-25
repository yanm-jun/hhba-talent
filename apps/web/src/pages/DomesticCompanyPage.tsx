import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Building2,ShieldCheck,ChevronDown,MapPin,Images} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {getDomesticCompanies,getDomesticRecruitment,companyById,findParentCompany,findRelatedCompanies} from '../services/domesticCompanySearch';
import {matchingMajors} from '../services/domesticMajors';
import profiles from '../data/domesticCareerProfiles.json';
import {domestic200Profiles as additionalProfiles} from '../services/domesticCompany200Data';
import bundled from '../data/domesticMediaBundle.json';
import additionalMedia from '../data/domesticMedia200Bundle.json';
import type {User} from '../services/api';
import '../styles/domestic-company-search.css';

type Reviewed={
 displayName:string;subtitle:string;summary?:string;description:string[];
 business:{title:string;description:string}[];majorSlugs:string[];
 careersUrl?:string;careersLabel?:string;officialSource:string;productSource?:string;
 brandImage?:string;imageSource?:string;brandImageSource?:string;brandAssetStatus?:string;lastReviewed:string;contentReview?:string;
 photos?:{url:string;label:string;source:string;localPath?:string;kind?:'headquarters'|'factory'|'office'|'product'|'screenshot'}[];
 officeLocations?:{type:string;address:string;source:string}[];
 photoSourcePage?:string;photoSourceLabel?:string;
 evidenceLevel?:string;
 primaryIndustry?:string;subIndustry?:string;industryEvidenceUrl?:string;majorMappingBasis?:string;
};
const curated={...profiles,...additionalProfiles} as Record<string,Reviewed>;
const available={companies:{...bundled.companies,...additionalMedia.companies}} as {companies:Record<string,{brand?:{state:string;path?:string};photos?:{state:string;path?:string}[]}>};
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
 const substantive=Boolean(article?.contentReview!=='first_pass_industry_explanation_not_official_company_detail_audited'&&article?.officialSource&&article.description.length>=3&&
  article.description.join('').length>=280&&article.business.length>=3&&article.majorSlugs.length>=4);
 const media=company?available.companies[company.name]:undefined;
 const brandSrc=media?.brand?.state==='ready'?import.meta.env.BASE_URL+media.brand.path:undefined;
 const majors=company?matchingMajors(company):[];
 const recruitment=company?getDomesticRecruitment(company.name):undefined;
 const careers=company?httpsLink(company.careers):'';
 const hasReadyPhoto=Boolean(article?.photos?.some((_,i)=>media?.photos?.[i]?.state==='ready'));
 const shownRelated=related.filter(c=>(c.name+c.industry+(c.city||'')+c.tags.join(' ')).toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())).slice(0,24);
 return <Shell user={user}><article className="domestic-company-profile domestic-editorial-profile">
  <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState} className="domestic-company-back"><ArrowLeft size={16}/> 返回上一页</Link>
  {!company?<section className="domestic-editorial-panel"><h1>企业资料尚未找到</h1><Link to="/candidate/jobs">返回企业搜索</Link></section>:
   <div className="domestic-editorial-panel">
    <header className="domestic-editorial-hero">
     <div className="domestic-company-profile-mark" aria-label="企业视觉资料">
      {brandSrc&&!imageFailed?<img src={brandSrc} alt={company.name+(article?.brandAssetStatus==='official_logo_visually_verified'?'的正式品牌标识':article?.brandAssetStatus==='user_provided_logo_confirmed'?'的已确认品牌图':'的企业品牌图')} onError={()=>setImageFailed(true)}/>:
       <Building2 size={26} aria-hidden="true"/>}
     </div>
     <div className="domestic-profile-identity">
      <span className="domestic-editorial-eyebrow">{substantive?'HHBA · 已整理深度资料':article?'HHBA · 企业资料（继续完善中）':'HHBA · 上市主体名录（未完成深度核验）'}</span>
      <h1>{article?.displayName||company.name}</h1>
      <p>{article?.subtitle||(company.industry!=='行业待细分'?company.industry:'证券主体名录记录')}{company.city?' · '+company.city:''}</p>
      {article?.displayName&&article.displayName!==company.name&&<small>经营主体：{company.name}</small>}
      {article?.primaryIndustry&&<small className="domestic-category-breadcrumb">行业分类：{article.primaryIndustry} · {article.subIndustry||company.industry}</small>}
      {article?.officeLocations?.length? <small className="domestic-profile-office-hint"><MapPin size={13}/>{article.officeLocations[0].address}</small>:null}
      {article&&!brandSrc?<small className="domestic-media-confidence">正式品牌 Logo 尚未核验；已屏蔽失效图片地址</small>:null}
      {brandSrc&&<small className="domestic-media-confidence">
       {article?.brandAssetStatus==='official_logo_visually_verified'?'已对照企业官方招聘页面核验品牌标识':article?.brandAssetStatus==='official_domain_favicon_unverified_visual'?'当前显示企业网站图标，尚未确认为正式品牌 Logo':article?.brandAssetStatus==='official_website_logo_candidate'?'来自企业官网的品牌图候选，尚待核对':article?.brandAssetStatus==='user_provided_logo_confirmed'?'用户提供并确认的企业品牌图片（普通照片或截图亦可）':article?.brandAssetStatus==='user_provided_logo_pending_identity'?'已添加企业品牌图片，尚待确认品牌归属':'品牌图已登记，尚待核对品牌归属'}
      </small>}
     </div>
    </header>
    {!article?<section className="domestic-editorial-section domestic-directory-only" aria-label="上市主体名录核验">
      <h2>上市主体基本信息</h2>
      <p className="domestic-company-note">当前仅保留能够从上市公司名录核对的基础身份信息。由于还没有完成该企业自己的官方网站和主营业务资料核验，HHBA 暂不提供拼凑的企业介绍，也不会猜测适合专业或招聘岗位。</p>
      <dl className="domestic-directory-facts">
       <div><dt>企业名称</dt><dd>{company.name}</dd></div>
       {company.legalName&&<div><dt>经营主体</dt><dd>{company.legalName}</dd></div>}
       {company.stockCode&&<div><dt>证券代码</dt><dd>{company.stockCode}</dd></div>}
       {company.industry!=='行业待细分'&&company.industry!=='业务方向待核验'&&<div><dt>名录行业分类</dt><dd>{company.industry}</dd></div>}
       {company.city&&<div><dt>名录登记城市</dt><dd>{company.city}</dd></div>}
      </dl>
      <p className="domestic-company-note">此页不代表已完成企业档案。核验后再提供真实的历史、业务、图片、专业关联和独立招聘入口。</p>
      {httpsLink(company.website)&&<a href={httpsLink(company.website)} target="_blank" rel="noopener noreferrer" className="domestic-directory-website">访问已有企业官网 <ExternalLink size={13}/></a>}
     </section>:
     <section className="domestic-editorial-section" aria-label="企业介绍">
      <h2>企业介绍</h2>
      {!substantive&&<p className="domestic-company-note">当前已有业务方向初稿，企业专项事实与资料来源尚待逐项复核，不作为已通过官方资料审核的深度档案。</p>}
      <div className="domestic-editorial-body">{article.description.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>
      {article&&<div className="domestic-editorial-business">
       {article.business.map(item=><div key={item.title}><strong>{item.title}</strong><p>{item.description}</p></div>)}
      </div>}
    </section>}
    {hasReadyPhoto?<section className="domestic-editorial-section domestic-editorial-photos" aria-label="企业真实图片">
      <h2>企业照片与办公环境</h2>
      <div className="domestic-editorial-photo-grid">
       {article!.photos!.map((photo,index)=>({photo,index})).filter(({index})=>media?.photos?.[index]?.state==='ready').map(({photo,index})=><figure key={photo.localPath||photo.url} className={'domestic-official-photo'+(photo.kind==='screenshot'?' is-screenshot':'')}>
        <div className="domestic-photo-display" aria-label={photo.label}>
         <img src={import.meta.env.BASE_URL+(media?.photos?.[index]?.path||'')} loading="lazy" alt={photo.label} onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement?.classList.add('domestic-photo-unavailable')}}/>
         <span className="domestic-photo-fallback"><Images size={18}/>图片暂时无法显示</span>
        </div>
        <figcaption>{photo.label} · {photo.kind==='product'?'产品照片':photo.kind==='factory'?'工厂照片':photo.kind==='headquarters'?'总部/大楼':photo.kind==='office'?'办公环境':'网页或场景截图'}</figcaption>
       </figure>)}
      </div>
     </section>:null}
    {article?.photoSourcePage&&!hasReadyPhoto?
     <section className="domestic-editorial-section" aria-label="官方企业实景来源"><h2>企业实景与办公环境</h2>
      <p className="domestic-company-note">图片暂未核验为可在本站稳定展示，避免错用其他企业照片。</p>
      <span className="domestic-photo-source-note">企业实景图片的来源信息已登记，当前没有经过核验的可展示照片。</span></section>:null}
    {article?.officeLocations?.length?<section className="domestic-editorial-section" aria-label="办公地点">
      <h2>总部与办公地点</h2>
      <div className="domestic-office-list">{article.officeLocations.map(entry=><div key={entry.address}><MapPin size={17}/><div><strong>{entry.type}</strong><p>{entry.address}</p>
       <a target="_blank" rel="noopener noreferrer" href={entry.source}>查看官方地址来源 <ExternalLink size={12}/></a></div></div>)}</div>
      <p className="domestic-company-note">办公地址不代表该地点当前正在招聘；若需要前往现场，请先通过企业官网确认。</p>
     </section>:null}
    {article&&<section className="domestic-editorial-section" aria-label="适合哪些专业背景">
      <h2>适合哪些专业背景？</h2>
      {majors.length?<div className="domestic-profile-tags domestic-major-tags">
       {majors.map(major=><Link className="domestic-major-tag" key={major.slug} to={'/majors/'+major.slug}
        aria-label={'查看与'+major.name+'相关的企业'}>{major.name}<ArrowRight size={13}/></Link>)}</div>:
       <p className="domestic-editorial-limited">暂无足够资料判断该企业与哪些专业方向相关，正在逐步完善。</p>}
      <p className="domestic-company-note">根据企业公开业务与技术方向整理的专业关联，不等于该企业正在招聘这些专业的学生。点击专业可发现更多业务相关企业。</p>
      {article.majorMappingBasis&&<small className="domestic-media-confidence">{article.majorMappingBasis}</small>}
    </section>}
    {(article||recruitment)&&<section className="domestic-editorial-section domestic-careers" aria-label="官方招聘渠道">
      <h2>官方招聘渠道</h2>
      <p>招聘渠道与企业介绍来源分别核验。集团统一招聘站并不代表每个子公司都有开放岗位；具体法人、地区与招聘批次以官方页面为准。</p>
      {careers?<div className="domestic-careers-row"><div><strong>{recruitment?.label||'招聘渠道待复核'}</strong>
       <small>{recruitment?.availability==='unconfirmed_runtime'?'招聘线索的当前访问状态尚未完成核验，不代表已能直投岗位':recruitment?.kind==='group_recruitment_portal'?'集团统一招聘平台；投递前请核对实际用人公司':recruitment?.availability==='announcement_only'?'仅显示招聘公告，非岗位直投入口':recruitment?.availability==='temporarily_unavailable'?'官网目前显示维护中，暂可能无法投递':'已登记的企业招聘专用渠道'}</small>
       {recruitment?.recruitmentEntity&&recruitment.recruitmentEntity!==company.name?<small>招聘系统归属：{recruitment.recruitmentEntity}（并非 {company.name} 独立招聘系统）</small>:null}
       {recruitment?.notes?<small>{recruitment.notes}</small>:null}</div>
       <a data-hhba-recruitment-outbound="true" href={careers} target="_blank" rel="noopener noreferrer" className="domestic-careers-link">{recruitment?.availability==='announcement_only'?'查看招聘公告':recruitment?.availability==='temporarily_unavailable'?'访问招聘系统（维护中）':recruitment?.availability==='unconfirmed_runtime'?'查看待核实招聘线索':'查看招聘官网'} <ExternalLink size={15}/></a></div>:
       <div className="domestic-editorial-limited">尚未核验该主体的官方招聘入口，暂不展示“查看招聘官网”按钮。
       </div>}
    </section>}
    <section className="domestic-editorial-section domestic-editorial-sources" aria-label="资料来源">
      <details className="domestic-company-sources" key={"sources-"+company.id}>
       <summary>资料来源与核验说明 <ChevronDown size={15}/></summary>
       <div>{httpsLink(article?.officialSource||company.sourceUrl)&&<a href={httpsLink(article?.officialSource||company.sourceUrl)} target="_blank" rel="noopener noreferrer">企业公开资料 <ExternalLink size={13}/></a>}
       {recruitment&&<a href={recruitment.evidenceUrl} target="_blank" rel="noopener noreferrer">招聘入口核验依据（{recruitment.verifiedOn}） <ExternalLink size={13}/></a>}
       {article?.industryEvidenceUrl&&<a href={article.industryEvidenceUrl} target="_blank" rel="noopener noreferrer">行业分类核验依据 <ExternalLink size={13}/></a>}
       {article?.productSource&&<a href={article.productSource} target="_blank" rel="noopener noreferrer">公开产品资料 <ExternalLink size={13}/></a>}
       {article?.imageSource&&<span className="domestic-photo-source-note">企业图片来源已登记</span>}
       {article?.brandImageSource&&<span className="domestic-photo-source-note">{article.brandAssetStatus==='official_domain_favicon_unverified_visual'?'企业官网图标来源已登记（品牌 Logo 待核实）':'品牌图来源已登记'}</span>}
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
