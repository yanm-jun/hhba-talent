import {useMemo} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,BriefcaseBusiness,ExternalLink,GraduationCap,MapPin,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {AutumnCompanyBrand} from '../components/AutumnCompanyBrand';
import {AutumnIndustryReferenceGallery} from '../components/AutumnIndustryReferenceGallery';
import mediaA from '../data/domesticMediaBundle.json';
import mediaB from '../data/domesticMedia200Bundle.json';
import {getDomesticCompanies,getDomesticRecruitment} from '../services/domesticCompanySearch';
import domesticProfiles from '../data/domesticCareerProfiles.json';
import {domestic200Profiles} from '../services/domesticCompany200Data';
import employersJSON from '../data/domesticAutumnScreenshot20261028.json';
import jobsJSON from '../data/domesticAutumnVerifiedJobs20261028.json';
import officialEvidence from '../data/domesticAutumnOfficialEvidence20261028.json';
import brandMedia from '../data/domesticAutumnBrandMediaRegistry.json';
import generatedScenes from '../data/domesticAutumnAiScenes.json';
import type {User} from '../services/api';
import '../styles/domestic-autumn-market.css';

type Employer={id:string;name:string;reviewStatus:string;officialUrl:string|null;evidenceUrl:string|null;notes:string|null;screenshotGroup:string};
type RecordInfo={id:string;company:string;title:string;majors:string[];cities:string[];education:string;recruitmentType:string;recordKind:'job'|'program';locationScope:string;sourceUrl:string;observedOn:string;note:string};
type Editorial={displayName?:string;summary?:string;description?:string[];business?:{title:string;description:string}[];officialSource?:string;primaryIndustry?:string;subIndustry?:string;officeLocations?:{type:string;address:string;source:string}[];contentReview?:string;};
const employers=employersJSON.entries as Employer[];
const jobs=jobsJSON.jobs as RecordInfo[];
const profiles={...domesticProfiles,...domestic200Profiles} as Record<string,Editorial>;
type OfficialEditorial={industry:string|null;intro:string|null;source:string|null;officialRecruitment:string|null;recruitmentLabel:string|null;evidenceScope:string};
const reviewedOfficial=officialEvidence.entries as Record<string,OfficialEditorial>;
const provenance=brandMedia.entries as Record<string,{source:string;sourceType:string;confidence:string;path:string}>;
type AiScene={id:string;path:string;kind:string;status:string;sourceLabel:string;alt:string};
const aiIndex=generatedScenes.entries as Record<string,AiScene[]>;
const mediaIndex={...mediaA.companies,...mediaB.companies} as Record<string,{photos?:{state:string;path?:string;classification?:string;source?:string}[]}>;
const safeUrl=(value?:string|null)=>{
 try{const u=new URL(value||'');return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null}
 catch{return null}
};

export function AutumnCompanyProfilePage({user,id}:{user:User|null;id:string}){
 const employer=employers.find(e=>e.id===id);
 const back=getCompanyReturnTarget();
 const existing=useMemo(()=>employer?getDomesticCompanies().find(c=>c.name===employer.name):null,[employer?.name]);
 const editorial=employer?profiles[employer.name]:undefined;
 const officialArticle=employer?reviewedOfficial[employer.name]:undefined;
 const recognizedBrand=employer?provenance[employer.name]:undefined;
 const recruitment=employer?getDomesticRecruitment(employer.name):undefined;
 const matched=employer?jobs.filter(j=>j.company===employer.name):[];
 const profileMedia=employer?mediaIndex[employer.name]:undefined;
 const localPhotos=(profileMedia?.photos||[]).filter(photo=>photo.state==='ready'&&photo.classification==='source_backed_named_enterprise_scene'&&!!photo.source&&typeof photo.path==='string'&&/^domestic-media\/[a-z0-9-]+\.(webp|png|jpg|jpeg)$/i.test(photo.path));
 const websiteCaptures=(profileMedia?.photos||[]).filter(photo=>photo.state==='ready'&&photo.classification==='official_website_screenshot_unreviewed'&&typeof photo.path==='string'&&/^domestic-media\/[a-z0-9-]+\.(webp|png|jpg|jpeg)$/i.test(photo.path));
 const aiPhotos=(aiIndex[id]||[]).filter(photo=>photo.status==='published_preview'&&photo.kind==='ai_generated_concept_scene'&&/^images\/autumn-ai-scenes\/cn-autumn-[0-9]{3}-[0-9]{2}\.webp$/.test(photo.path)&&photo.path.startsWith('images/autumn-ai-scenes/'+id+'-'));
 const primary=safeUrl(employer?.officialUrl)||safeUrl(recruitment?.url)||safeUrl(officialArticle?.officialRecruitment);
 const hasRecruitment=Boolean(primary);
 const hasCompanyEditorial=Boolean(editorial?.summary?.trim());
 const evidence=safeUrl(employer?.evidenceUrl);
 return <Shell user={user}><main className="hhba-autumn-company-profile">
  <Link className="hhba-autumn-company-back" to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={16}/> 返回上一页</Link>
  {!employer?<section className="hhba-autumn-profile-panel"><h1>没有找到对应企业档案</h1><Link to="/candidate/domestic-autumn">返回秋招企业清单</Link></section>:<>
   <section className="hhba-autumn-profile-panel">
    <header className="hhba-autumn-profile-hero">
     <AutumnCompanyBrand name={employer.name} large/>
     <div>
      <small className="hhba-autumn-profile-kicker">HHBA · 企业资料与招聘入口</small>
      <h1>{employer.name}</h1>
      <p>{editorial?.primaryIndustry||officialArticle?.industry||existing?.industry||'行业与业务资料待核验'}</p>
      <small>资料核验状态：{employer.reviewStatus==='official_entry_evidenced'?'官方招聘入口已定位':employer.reviewStatus==='announcement_evidenced'?'招聘公告已有来源':'招聘信息尚待核验'}</small>
     </div>
    </header>
    <p className="hhba-domestic-autumn-disclaimer"><ShieldCheck size={17}/> 此处展示的企业品牌标识仅来自有来源的素材，未核实时显示中性图标；不使用任何虚构的办公大楼或伪造官方 Logo。企业 Logo 不代表企业与 HHBA 合作或背书。</p>
    <div className="hhba-autumn-profile-sections">
     <section className="hhba-autumn-profile-info">
      <h2>企业介绍</h2>
      {hasCompanyEditorial?<><p>{editorial!.summary}</p>
        {(editorial?.description||[]).slice(0,3).map((p,i)=><p key={i}>{p}</p>)}
        {existing?.route&&<Link to={existing.route} className="hhba-autumn-profile-details">查看 HHBA 已整理的完整企业档案 <ArrowRight size={15}/></Link>}
        <p className="hhba-autumn-profile-note">企业信息为已整理资料，深度核验状态以企业完整档案标注为准。</p>
       </>:officialArticle?.intro&&officialArticle.source?<>
         <p>{officialArticle.intro}</p><p className="hhba-autumn-profile-note">这段介绍依据可核对的公开资料整理，不代表已核实所有经营主体、办公地点、在招岗位或人员规模。</p>
         <a className="hhba-autumn-profile-source" href={officialArticle.source} data-hhba-non-recruitment-link="true" target="_blank" rel="noopener noreferrer">查看企业介绍原始来源 <BookOpen size={14}/></a>
       </>:<>
        <p>这家企业已收录于本次秋招截图名单，但企业业务、总部地址及经营情况尚未完成独立核实。</p>
        {existing?.overview&&existing.status==='industry_reviewed'&&<p>{existing.overview}</p>}
        {existing?.industry&&existing.industry!=='行业待细分'&&<p>已有名录行业分类：{existing.industry}。此分类不代表该企业正在招聘。</p>}
        {existing?.route&&<Link to={existing.route} className="hhba-autumn-profile-details">查看已有的企业名录资料 <ArrowRight size={15}/></Link>}
       </>}
      {editorial?.officialSource&&safeUrl(editorial.officialSource)&&<a className="hhba-autumn-profile-source" href={safeUrl(editorial.officialSource)!} data-hhba-non-recruitment-link="true" target="_blank" rel="noopener noreferrer">查看企业介绍来源 <BookOpen size={14}/></a>}
      <div className="hhba-autumn-verified-facts" aria-label="企业档案核验情况">
       <span>已有 HHBA 企业档案：<b>{existing?'有':'待建立'}</b></span>
       <span>企业专属介绍：<b>{hasCompanyEditorial||officialArticle?.intro?'有资料 · 请核对来源':'待核验'}</b></span>
       <span>官方招聘入口：<b>{hasRecruitment?'已登记 · 实际状态待核验':'待核验'}</b></span>
       <span>已有具体岗位／项目：<b>{matched.filter(j=>j.recordKind==='job').length} 条／{matched.filter(j=>j.recordKind==='program').length} 条</b></span>
       {existing?.stockCode&&<span>证券代码：<b>{existing.stockCode}</b></span>}
       {existing?.province&&<span>名录登记地区：<b>{[existing.province,existing.city].filter(Boolean).join(' · ')}（非岗位工作地）</b></span>}
      </div>
     </section>
     <section className="hhba-autumn-profile-recruitment">
      <h2>选择官方招聘渠道</h2>
      <p>招聘专业、地点和职位是否仍可申请，以企业招聘系统为准。外部官方招聘入口需要通过 HHBA 的真实账户登录验证。</p>
      {hasRecruitment?<div className="hhba-autumn-channel-list">
        <a className="hhba-autumn-channel" data-hhba-recruitment-outbound="true" href={primary!} target="_blank" rel="noopener noreferrer"><GraduationCap size={19}/><span><strong>查看已定位招聘渠道</strong><small>{recruitment?.availability==='campus_only'?'校园招聘入口':officialArticle?.recruitmentLabel||recruitment?.label||'招聘入口（请在官网区分校招／社招）'} · 招聘状态待核实</small></span><ExternalLink size={16}/></a>
       </div>:<p className="hhba-autumn-profile-note">尚未定位可信的企业官方招聘入口，暂不显示可能错误的“立即投递”按钮。</p>}
      {evidence&&<a className="hhba-autumn-profile-source" href={evidence} data-hhba-non-recruitment-link="true" target="_blank" rel="noopener noreferrer">查看招聘公告依据 <BookOpen size={14}/></a>}
      {officialArticle?.evidenceScope&&<p className="hhba-autumn-profile-note">资料核验范围：{officialArticle.evidenceScope}</p>}
     </section>
    </div>
   </section>
   <section className="hhba-autumn-profile-panel hhba-autumn-visual-panel" aria-label="企业图片及标识">
    <h2>企业图片与品牌标识</h2>
    <p className="hhba-autumn-profile-note">{recognizedBrand?'已找到第三方品牌图形库中的企业标识，待品牌方进一步确认。':'企业 Logo 尚待核验，因此不显示编造的品牌标志。'} 真实企业照片和 AI 场景示意分开展示，AI 场景不代表该企业实际的办公地点。</p>
    {recognizedBrand&&<p className="hhba-autumn-profile-note"><a href={recognizedBrand.source} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">查看企业标识素材来源（第三方目录）</a> · 不表示官方授权或商业合作。</p>}
    {localPhotos.length?<div className="hhba-autumn-local-photo-grid">{localPhotos.map((photo,i)=><figure key={photo.path||i}><img loading="lazy" src={import.meta.env.BASE_URL+photo.path!} alt={employer.name+'有来源的企业实景'}/><figcaption>企业场景照片 · <a href={photo.source} data-hhba-non-recruitment-link="true" target="_blank" rel="noopener noreferrer">图片来源</a></figcaption></figure>)}</div>:<div className="hhba-autumn-no-photo"><AutumnCompanyBrand name={employer.name} large/><p>真实企业场景照片尚待核验。下面如有 AI 场景图，仅用于视觉示意，绝不是企业实景。</p></div>}
    {aiPhotos.length>0&&<><h3 className="hhba-autumn-subsection-title">AI 独立场景图（非企业实景）</h3><p className="hhba-autumn-profile-note">画面中的建筑、空间以及招牌可能由 AI 虚构，不能据此判断企业实际总部、办公楼和现场环境。</p><div className="hhba-autumn-local-photo-grid">{aiPhotos.map(photo=><figure key={photo.id}><img loading="lazy" src={import.meta.env.BASE_URL+photo.path} alt={photo.alt}/><figcaption>{photo.sourceLabel}</figcaption></figure>)}</div></>}
    <AutumnIndustryReferenceGallery companyId={id} companyName={employer.name}/>
    {websiteCaptures.length>0&&<><h3 className="hhba-autumn-subsection-title">企业网站截图（不是办公实景）</h3><div className="hhba-autumn-local-photo-grid">{websiteCaptures.map((photo,i)=><figure key={photo.path||i}><img loading="lazy" src={import.meta.env.BASE_URL+photo.path!} alt={employer.name+'网站页面截图'}/><figcaption>企业网站页面留档 · 非企业实景</figcaption></figure>)}</div></>}
   </section>
    <section className="hhba-autumn-profile-panel">
     <h2>主要业务与代表产品</h2>
     {editorial?.business?.length?<div className="hhba-autumn-profile-business-grid">{editorial.business.map((item,i)=><article key={i}><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>:
      <p className="hhba-autumn-profile-note">该企业的具体产品、服务和业务部门正在核验中。暂不根据行业通用描述编造产品或名称。</p>}
     {editorial?.officialSource&&safeUrl(editorial.officialSource)&&<a href={safeUrl(editorial.officialSource)!} data-hhba-non-recruitment-link="true" target="_blank" rel="noopener noreferrer" className="hhba-autumn-profile-source">查看企业业务资料来源 <BookOpen size={14}/></a>}
    </section>
    <section className="hhba-autumn-profile-panel">
     <h2>发展与重要节点</h2>
     <p className="hhba-autumn-profile-note">仅在官方公告或可靠企业资料能够明确对应日期与事件后列出时间节点。未经核实的成立年份、融资或发展事件不作展示。</p>
    </section>
   <section className="hhba-autumn-profile-panel">
    <h2>已整理的相关岗位和招聘项目</h2>
    <p className="hhba-autumn-profile-note">逐岗专业、城市和学历信息仅在公告提供对应证据时展示，招聘项目的城市不等于每个岗位的城市。</p>
    {matched.length?<div className="hhba-autumn-profile-jobs">{matched.map(j=><article key={j.id} className="hhba-autumn-profile-job">
      <div><BriefcaseBusiness size={16}/><strong>{j.title}</strong><small>{j.recordKind==='job'?'公开具体岗位':'招聘项目／方向'}</small></div>
      <p><GraduationCap size={14}/> {j.majors.length?j.majors.join('、'):'岗位专业未逐一披露'}</p>
      <p><MapPin size={14}/> {j.cities.length?j.cities.join('、'):'工作地点待核验'} {j.locationScope==='program'&&'（招聘项目城市，非逐岗）'}</p>
      <a href={j.sourceUrl} data-hhba-non-recruitment-link="true" target="_blank" rel="noopener noreferrer">查看招聘来源 <ExternalLink size={14}/></a>
     </article>)}</div>:<p className="hhba-autumn-profile-empty">尚未找到可以与本企业准确对应的具体岗位或招聘项目。截图中的企业名称不代表目前正在招聘。</p>}
   </section>
   <div className="hhba-autumn-profile-footer"><Link to="/candidate/domestic-autumn">返回秋招企业清单 <ArrowRight size={15}/></Link><Link to="/candidate/jobs">浏览招聘市场 <ArrowRight size={15}/></Link></div>
  </>}
 </main></Shell>;
}
