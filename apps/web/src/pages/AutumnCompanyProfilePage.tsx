import {useMemo} from 'react';
import {CompanyMajorChips} from '../components/CompanyMajorChips';
import {useSharedMajorSelection} from '../components/CompanyMajorJobs';
import {matchRoleToMajor,majorName} from '../services/majorJobMatching';
import {ArrowLeft,ArrowRight,Building2,ExternalLink,GraduationCap,MapPin,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {AutumnCompanyBrand} from '../components/AutumnCompanyBrand';
import {getDomesticCompanies,getDomesticRecruitment} from '../services/domesticCompanySearch';
import domesticProfiles from '../data/domesticCareerProfiles.json';
import {domestic200Profiles} from '../services/domesticCompany200Data';
import employersJSON from '../data/domesticAutumnScreenshot20261028.json';
import jobsJSON from '../data/domesticAutumnVerifiedJobs20261028.json';
import pfizerJobsJSON from '../data/domesticPfizerOfficialJobs20261029.json';
import officialEvidence from '../data/domesticAutumnOfficialEvidence20261028.json';
import generatedScenes from '../data/domesticAutumnAiScenes.json';
import businessDraftA from '../data/domesticAutumnBusinessDraft001.json';
import businessDraftB from '../data/domesticAutumnBusinessDraft002.json';
import verifiedHistory from '../data/domesticAutumnMilestonesVerified20261029.json';
import kpmgDossier from '../data/domesticKpmgDetailedDossier20261029.json';
import mediaA from '../data/domesticMediaBundle.json';
import mediaB from '../data/domesticMedia200Bundle.json';
import type {User} from '../services/api';
import '../styles/company-profiles.css';
import '../styles/domestic-autumn-market.css';

type Employer={id:string;name:string;reviewStatus:string;officialUrl:string|null;evidenceUrl:string|null;notes:string|null;screenshotGroup:string};
type RecordInfo={id:string;company:string;title:string;majors:string[];cities:string[];education:string;recruitmentType:string;recordKind:'job'|'program';locationScope:string;sourceUrl:string;observedOn:string;note:string;responsibilities?:string;requirements?:string};
type Editorial={displayName?:string;subtitle?:string;summary?:string;description?:string[];business?:{title:string;description:string}[];officialSource?:string;primaryIndustry?:string;subIndustry?:string;officeLocations?:{type:string;address:string;source:string}[];milestones?:{date:string;description:string}[];contentReview?:string};
type OfficialEditorial={industry:string|null;intro:string|null;source:string|null;officialRecruitment:string|null;recruitmentLabel:string|null;evidenceScope:string};
type AiScene={id:string;path:string;kind:string;status:string;sourceLabel:string;alt:string};
type NamedPhoto={state:string;path?:string;classification?:string;source?:string};
type BusinessItem={title:string;description:string};
type BusinessDraft={business:BusinessItem[];reviewLevel:string};
type Milestone={date:string;description:string;source:string};
type MilestoneEvidence={businessSource:string;businessEvidence:string;milestones:Milestone[]};
type KpmgSourceKey=typeof kpmgDossier.sources[number]['key'];
const sourceFromDossier=(key:KpmgSourceKey)=>kpmgDossier.sources.find(s=>s.key===key)?.url||'';


const employers=employersJSON.entries as Employer[];
const jobs=[...jobsJSON.jobs,...pfizerJobsJSON.jobs] as RecordInfo[];
const profiles={...domesticProfiles,...domestic200Profiles} as Record<string,Editorial>;
const reviewedOfficial=officialEvidence.entries as Record<string,OfficialEditorial>;
const aiIndex=generatedScenes.entries as Record<string,AiScene[]>;
const mediaIndex={...mediaA.companies,...mediaB.companies} as Record<string,{photos?:NamedPhoto[]}>;
const businessDrafts={...businessDraftA.entries,...businessDraftB.entries} as Record<string,BusinessDraft>;
const documentedHistories=verifiedHistory.entries as Record<string,MilestoneEvidence>;

// External URLs are rendered only when they have an unambiguous HTTPS origin.
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
 const kpmg=id==='cn-autumn-001'?kpmgDossier:null;
 const businessDraft=businessDrafts[id];
 const documentedHistory=documentedHistories[id];
 const companyBusiness=editorial?.business?.length?editorial.business:businessDraft?.business||[];
 const milestones=documentedHistory?.milestones||[];
 const recruitment=employer?getDomesticRecruitment(employer.name):undefined;
 const matched=employer?jobs.filter(j=>j.company===employer.name):[];
 const {slug:selectedMajor,choose:chooseMajor}=useSharedMajorSelection();
 const majorJobIndex=matched.map(j=>({majorNames:j.majors}));
 const shownMatched=!selectedMajor?matched:matched.filter(j=>{
  const match=matchRoleToMajor({majorNames:j.majors},selectedMajor);
  return match==='related'||match==='unrestricted';
 });
 const profileMedia=employer?mediaIndex[employer.name]:undefined;
 const localPhotos=(profileMedia?.photos||[]).filter(photo=>
   photo.state==='ready'&&photo.classification==='source_backed_named_enterprise_scene'&&
   !!safeUrl(photo.source)&&typeof photo.path==='string'&&
   /^domestic-media\/[a-z0-9-]+\.(webp|png|jpg|jpeg)$/i.test(photo.path)
 );
 const aiPhotos=(aiIndex[id]||[]).filter(photo=>
   photo.status==='published_preview'&&photo.kind==='ai_generated_concept_scene'&&
   /^images\/autumn-ai-scenes\/cn-autumn-[0-9]{3}-[0-9]{2}\.(?:webp|avif)$/.test(photo.path)&&
   photo.path.startsWith('images/autumn-ai-scenes/'+id+'-')
 ).slice(0,2);
 // Only exact-company photos. Never substitute third-party industry stock,
 // unverified website screenshots or a generated placeholder for a real employer.
 const workplaces=aiPhotos.length?aiPhotos.map(photo=>({
   id:photo.id,path:photo.path,alt:photo.alt,caption:photo.sourceLabel,isAi:true
 })):localPhotos.slice(0,2).map((photo,i)=>({
   id:photo.path||String(i),path:photo.path!,alt:employer?.name+'有来源的企业实景',caption:'已记录来源的企业场景照片',isAi:false
 }));
 const primary=safeUrl(employer?.officialUrl)||safeUrl(recruitment?.url)||safeUrl(officialArticle?.officialRecruitment);
 const website=safeUrl(kpmg?.website)||safeUrl(existing?.website);
 const hasCompanyEditorial=Boolean(editorial?.summary?.trim());
 const sourceCandidates=[
   {label:'企业介绍原始来源',url:safeUrl(officialArticle?.source)},
   {label:'企业业务资料来源',url:safeUrl(editorial?.officialSource)},
   {label:'企业名录来源',url:safeUrl(existing?.sourceUrl)},
   {label:'企业发展历程及业务来源',url:safeUrl(documentedHistory?.businessSource)},
   {label:'招聘公告依据',url:safeUrl(employer?.evidenceUrl)},
   ...(kpmg?kpmg.sources.map(s=>({label:s.label,url:safeUrl(s.url)})):[]),
 ];
 const seen=new Set<string>();
 const sources=sourceCandidates.filter((s):s is {label:string;url:string}=>{
   if(!s.url||seen.has(s.url))return false;
   seen.add(s.url);return true;
 });
 const region=[existing?.province,existing?.city].filter(Boolean).join(' · ');

 if(!employer)return <Shell user={user}><article className="company-profile unknown-company">
  <h1>没有找到对应企业档案</h1>
  <p>企业资料尚未建立，不使用其他企业的信息代替。</p>
  <Link to="/candidate/domestic-autumn">返回企业清单 <ArrowRight size={16}/></Link>
 </article></Shell>;

 return <Shell user={user}><article className="company-profile company-profile-autumn" data-company-template="openai" data-employer-id={id}>
  <nav className="company-profile-top" aria-label="企业详情导航">
   <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}>
    <ArrowLeft size={15}/> 返回上一页
   </Link>
   <Link to="/candidate/domestic-autumn">浏览全部企业 <ArrowRight size={15}/></Link>
  </nav>

  <header className="company-profile-header">
   <div className="company-profile-brand company-profile-autumn-brand"><AutumnCompanyBrand name={employer.name} large/></div>
   <div className="company-profile-identity">
    <div className="company-profile-eyebrow">HHBA · COMPANY PROFILE</div>
    <h1>{employer.name}</h1>
    <p>{kpmg?.headline||editorial?.subtitle||editorial?.primaryIndustry||officialArticle?.industry||existing?.industry||'企业资料正在完善'}</p>
   </div>
   {website&&<a className="company-profile-website" href={website} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">
    企业官网 <ExternalLink size={15}/>
   </a>}
  </header>
  <div className="company-profile-meta">
   <span>{editorial?.primaryIndustry||officialArticle?.industry||existing?.industry||'行业待核实'}</span>
   {region&&<span>{region}</span>}
   {existing?.stockCode&&<span>证券代码 {existing.stockCode}</span>}
   {kpmg&&<span>中国业务 · 官方资料核验于 {kpmg.reviewedOn}</span>}
   <span>{employer.reviewStatus==='official_entry_evidenced'?'招聘来源已核对':employer.reviewStatus==='announcement_evidenced'?'招聘公告有依据':'招聘状态待核验'}</span>
  </div>
  <p className="company-profile-editorial"><ShieldCheck size={16}/>
   HHBA 依据公开资料独立整理企业档案，不代表企业官方合作；企业商标归相应权利人所有。
  </p>
  {kpmg&&<div className="company-profile-autumn-stats" aria-label="毕马威中国官方披露概览">
    {kpmg.stats.map(stat=><div className="company-profile-autumn-stat" key={stat.label}>
      <strong>{stat.value}<small>{stat.unit}</small></strong>
      <span>{stat.label}</span>
      <a href={sourceFromDossier(stat.source)} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">官网来源 <ExternalLink size={12}/></a>
    </div>)}
  </div>}

  <section className="company-profile-section">
   <h2>关于企业</h2>
   {kpmg?<>{kpmg.overview.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</>:
   hasCompanyEditorial?<><p>{editorial!.summary}</p>
    {(editorial?.description||[]).slice(0,4).map((paragraph,i)=><p key={i}>{paragraph}</p>)}
   </>:officialArticle?.intro&&safeUrl(officialArticle.source)?<p>{officialArticle.intro}</p>:
    <p>HHBA 收录的 {employer.name} 企业资料主要涉及{companyBusiness.map(b=>b.title).join('、')}等业务领域；这些领域为编辑检索方向，尚不代表已经完成对具体经营主体的官方核验。</p>}
   {kpmg&&<div className="company-profile-autumn-verified-offices">
    <div className="company-profile-autumn-subhead">
      <h3>中国主要办事处（官网列示地址）</h3>
      <a href={sourceFromDossier('offices')} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">查看全国办事处 <ExternalLink size={14}/></a>
    </div>
    <div className="company-profile-autumn-office-grid">
      {kpmg.officeLocations.map(office=><div key={office.city}>
        <strong>{office.city}</strong><span>{office.address}</span>
      </div>)}
    </div>
  </div>}
   {editorial?.officeLocations?.length&&!kpmg? <div className="company-profile-autumn-locations">
    {editorial.officeLocations.filter(o=>!!safeUrl(o.source)).map((place,i)=><p key={i}><MapPin size={15}/>{place.type}：{place.address}</p>)}
   </div>:null}
   {existing?.route&&<Link to={existing.route} className="company-profile-autumn-more">查看已有的企业档案资料 <ArrowRight size={15}/></Link>}
  </section>

  <section className="company-profile-section company-visual-section" data-visual-workplace>
   <div className="company-visual-heading">
    <div>
     <h2>公司办公环境与建筑</h2>
     {workplaces.length>0&&<p>仅展示与本企业准确关联的独立图片，AI 场景不代表真实企业建筑、办公地点或员工。</p>}
    </div>
   </div>
   {workplaces.length>0?<div className="company-visual-workplace-grid">
    {workplaces.map(photo=><figure key={photo.id} className="company-visual-workplace">
     <div className="company-visual-photo">
      <img src={import.meta.env.BASE_URL+photo.path} loading="lazy" decoding="async" alt={photo.alt}/>
     </div>
     <figcaption><strong>{photo.caption}</strong>
      <span><Building2 size={13} aria-hidden="true"/>{photo.isAi?'AI 独立场景示意 · 非企业实景':'企业场景资料 · 按来源核验'}</span>
     </figcaption>
    </figure>)}
   </div>:<p className="company-profile-autumn-photo-pending">该企业的两张独立场景图片尚在制作，完成核验后将在此展示。</p>}
  </section>

  <section className="company-profile-section">
   <h2>{kpmg?'主要业务与专业服务':'主要业务与代表产品'}</h2>
   {kpmg&&<p className="company-profile-autumn-introline">不同于销售实体产品的公司，毕马威的核心价值来自专业服务团队、行业知识与项目交付。以下依据毕马威中国官方服务栏目，按实际业务路径梳理。</p>}
   {kpmg?<div className="company-profile-autumn-service-grid">
    {kpmg.services.map((service,i)=><article className="company-profile-autumn-service" key={service.title}>
      <div className="company-profile-autumn-service-index">{String(i+1).padStart(2,'0')} · 专业服务</div>
      <h3>{service.title}</h3><strong>{service.subtitle}</strong>
      <p>{service.description}</p>
      <div className="company-profile-autumn-service-detail"><span>典型服务内容</span>
        <ul>{service.deliverables.map(entry=><li key={entry}>{entry}</li>)}</ul>
      </div>
      <div className="company-profile-autumn-career-hint"><span>求职者可关注</span><p>{service.career}</p></div>
      <a href={sourceFromDossier(service.source)} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">官方服务说明 <ExternalLink size={13}/></a>
    </article>)}
   </div>:<div className="company-profile-focus-grid">
    {companyBusiness.map((item,i)=><div className="company-profile-focus" key={i}>
     <h3>{item.title}</h3><p>{item.description}</p>
    </div>)}
   </div>}
   {!kpmg&&!editorial?.business?.length&&!documentedHistory&&<p className="company-profile-autumn-review-note">以上为逐企业整理的业务方向清单，目前属于编辑待核稿，具体经营范围与产品名称以该企业官方资料为准。</p>}
  </section>

  <section className="company-profile-section">
   <h2>发展与重要节点</h2>
   {kpmg&&<p className="company-profile-autumn-introline">以下区分毕马威在华发展的关键事件与国际网络历史，避免将全球网络合并视为中国内地法律实体的成立日期。</p>}
   {kpmg?<div className="company-profile-milestones">
    {kpmg.milestones.map(item=><div className="company-profile-milestone" key={item.year}>
      <strong>{item.year}</strong><div className="company-profile-autumn-event">
        <div className="company-profile-autumn-event-header"><b>{item.title}</b><span>{item.scope}</span></div>
        <p>{item.description}</p>
        <a href={sourceFromDossier(item.source)} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">官方历史资料 <ExternalLink size={13}/></a>
      </div>
    </div>)}
   </div>:milestones.length?<div className="company-profile-milestones">
    {milestones.map((item,i)=><div className="company-profile-milestone" key={i}>
     <strong>{item.date}</strong><div className="company-profile-autumn-event"><p>{item.description}</p>
      <a href={item.source} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">节点出处 <ExternalLink size={13}/></a></div>
    </div>)}
   </div>:<p className="company-profile-autumn-review-note">本企业暂未取得可逐条追溯的历史事件证据。为避免错误的成立年份、上市时间或母子公司混同，此处不填写推测的时间线。</p>}
  </section>

  <section className="company-profile-section company-profile-major-chips" aria-label="适合哪些专业背景">
   <h2>适合哪些专业背景？</h2>
   <p>点击专业标签，下方只展示该企业已收录的关联岗位；未收录岗位的企业不推断招聘专业。</p>
   <CompanyMajorChips jobs={majorJobIndex} slug={selectedMajor} onChange={chooseMajor}/>
  </section>

  <section className="company-profile-section company-profile-openings" aria-labelledby="company-openings-title">
   <div className="company-profile-section-heading">
    <div>
     <h2 id="company-openings-title">招聘岗位与官方招聘入口</h2>
     <p>仅展示有对应来源的历史岗位与项目记录；招聘项目的城市不等于每个岗位的城市。当前是否仍在招，以官方招聘系统为准。</p>
    </div>
    <Link to="/candidate/jobs">浏览招聘市场 <ArrowRight size={15}/></Link>
   </div>
   {kpmg&&<>
    <p className="company-profile-autumn-introline">毕马威中国官网分别提供应届生、实习生、社会招聘与交付中心的独立入口；以下是招聘类别和专业方向，不是 HHBA 实时核验的具体在招职位。</p>
    <div className="company-profile-autumn-route-grid">
      {kpmg.careers.map(route=><article className="company-profile-autumn-route" key={route.title}>
        <span>{route.tag}</span><h3>{route.title}</h3><p>{route.description}</p>
        <div className="company-profile-autumn-route-eligibility">{route.eligibility}</div>
        <a href={sourceFromDossier(route.source)} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">查看官方项目入口 <ExternalLink size={14}/></a>
      </article>)}
    </div>
    <h3 className="company-profile-autumn-h3">求职前值得了解的四件事</h3>
    <div className="company-profile-autumn-tip-grid">
      {kpmg.careerNotes.map(tip=><div key={tip.title}><strong>{tip.title}</strong><p>{tip.description}</p></div>)}
    </div>
    <h3 className="company-profile-autumn-h3">官方网申参考流程</h3>
    <ol className="company-profile-autumn-steps">{kpmg.applicationProcess.map((step,i)=><li key={i}>{step}</li>)}</ol>
    <p className="company-profile-autumn-safety"><ShieldCheck size={17}/> <span>{kpmg.antiFraud} <a href={sourceFromDossier('safety')} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">查看官方防诈骗提示 <ExternalLink size={13}/></a></span></p>
   </>}
   {shownMatched.length?<div className="company-profile-job-grid">
    {shownMatched.map(j=><div key={j.id} className="company-profile-job-card company-profile-autumn-job">
     <strong>{j.title}</strong>
     {j.responsibilities&&<p><b>岗位职责：</b>{j.responsibilities}</p>}
     {j.requirements&&<p><b>任职要求：</b>{j.requirements}</p>}
     <span><GraduationCap size={13}/>{j.recordKind==='job'?'有来源的具体岗位':'招聘项目／方向'} · {j.majors.length?j.majors.join('、'):'专业未逐岗披露'}</span>
     <span><MapPin size={13}/>{j.cities.length?j.cities.join('、'):'地点待核验'}{j.locationScope==='program'?'（项目城市）':''}</span>
     {safeUrl(j.sourceUrl)&&<a href={safeUrl(j.sourceUrl)!} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">
      查看历史公告来源 <ExternalLink size={14}/>
     </a>}
    </div>)}
   </div>:<p className="company-profile-jobs-state">{selectedMajor?`当前未收录与「${majorName(selectedMajor)}」明确相关的岗位，请点击上方「全部专业」查看其他历史岗位。`:'当前没有已核对来源的具体职位记录；企业档案不代表当前开放招聘。'}</p>}
   {primary?<div className="company-profile-autumn-official">
    <a data-hhba-recruitment-outbound="true" href={primary} target="_blank" rel="noopener noreferrer">
     <GraduationCap size={18}/> 查看已定位的官方招聘渠道 <ExternalLink size={16}/>
    </a>
    <small>{officialArticle?.recruitmentLabel||recruitment?.label||'企业招聘入口'} · 需要先通过 HHBA 真实账户登录验证</small>
   </div>:<p className="company-profile-autumn-official-missing">暂无通过校验的官方招聘入口，不提供猜测或错误链接。</p>}
  </section>

  <section className="company-profile-section company-profile-sources">
   <h2>信息来源</h2>
   <p>企业介绍与历史招聘公告分别对应公开来源，未核实的数据不会标为实时在招。</p>
   {kpmg&&<p className="company-profile-autumn-review-note">毕马威精品档案核验日期：{kpmg.reviewedOn}。以下为本页业务、历史、地址和招聘指南对应的毕马威官方来源；历史节点和产品/业务方向均可继续独立查证。</p>}
   {sources.length?sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">
    {s.label} <ExternalLink size={14}/>
   </a>):<small>该企业暂无可确认的公开介绍来源，相关字段保留待核验状态。</small>}
   {officialArticle?.evidenceScope&&<small>资料核验范围：{officialArticle.evidenceScope}</small>}
  </section>
  <footer className="company-profile-footer">
   <span>企业名称及商标归各自权利人所有。HHBA 独立整理，不代表授权、合作或招聘承诺。</span>
   <Link to="/candidate/domestic-autumn">返回国内企业清单 <ArrowRight size={14}/></Link>
  </footer>
 </article></Shell>;
}
