import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,BriefcaseBusiness,CheckCircle2,ChevronRight,FileCheck2,Globe2,LoaderCircle,MapPin,ShieldCheck,Sparkles,UserRound} from 'lucide-react';
import {isVerifiedMatchReport} from '../services/verifiedMatchPresentation.mjs';
import {discoveryApplyDestination} from '../services/discoveryApplyDestination.mjs';
import type {MatchProfile,MatchResearchReport,MatchedJob,NativeMatchActivity,NativeMatchProgress} from '../services/resumeMatch';
import '../styles/report-first-experience.css';

type View='reports'|'explore'|'profile';
type Props={
 profile?:MatchProfile;report?:MatchResearchReport;jobs:MatchedJob[];officialJobs:MatchedJob[];
 pending?:boolean;failed?:boolean;progressStage?:NativeMatchProgress;activity?:NativeMatchActivity|null;
 elapsed?:number;onOptimize?:(job:MatchedJob)=>void;optimizationAvailable?:boolean;
};
const safeScore=(job:MatchedJob)=>Number.isInteger(job.match_score)&&job.match_score!==null&&job.match_score!==undefined&&job.match_score>=0&&job.match_score<=100?job.match_score:null;
const fullReport=(job:MatchedJob)=>job.report_status==='COMPLETE'&&!!job.research_detail?.score_explanation?.trim()&&Array.isArray(job.research_detail.comparisons)&&!!(job.reference_jd?.trim()||job.evidence_excerpt?.trim())&&!job.excluded_board&&!job.excluded_closed&&!['CLOSED_LISTED','POSSIBLY_CLOSED'].includes(job.availability_status||'UNKNOWN');
const completeness=(job:MatchedJob)=>(fullReport(job)?100:0)+(job.reference_jd?20:0)+(job.research_detail?20:0)+(job.jd_research?.facts?.length||0)+(Number.isInteger(job.match_score)?5:0);
const validJob=(job:MatchedJob)=>!!job.official_url&&!job.excluded_board&&!job.excluded_closed&&!['CLOSED_LISTED','POSSIBLY_CLOSED'].includes(job.availability_status||'UNKNOWN');
const stageText:Record<NativeMatchProgress,string>={
 preparing:'正在准备职业研究',parsing:'正在理解你的简历',connected:'正在连接研究服务',
 planning:'正在规划职业方向',searching:'正在发现新的职业机会',reading:'正在整理岗位公开资料',
 researching:'正在研究岗位与企业',writing:'AI 正在编写岗位研究报告',
 scoring:'正在分析岗位与你的契合度',waiting:'正在接续职业研究'
};
function Section({title,children}:{title:string;children:React.ReactNode}){
 if(!children)return null;
 return <section className="hhba-rf-section"><h3>{title}</h3><div className="hhba-rf-text">{children}</div></section>;
}
function EvidenceRows({job}:{job:MatchedJob}){
 const items=job.research_detail?.comparisons||[];
 if(!items.length)return null;
 return <div className="hhba-rf-comparisons">{items.map((item,i)=><article key={i} className="hhba-rf-comparison">
  <span className={'hhba-rf-evidence-kind hhba-rf-evidence-'+item.status}>{item.status==='supported'?'已有证据':item.status==='partial'?'部分相关':'需要补充'}</span>
  <strong>{item.requirement}</strong>
  <p>{item.analysis}</p>
  {item.resume_evidence&&<small>简历依据：{item.resume_evidence}</small>}
 </article>)}</div>;
}
export function ReportFirstMatchExperience({profile,report,jobs,officialJobs,pending=false,failed=false,progressStage='preparing',activity,elapsed=0,onOptimize,optimizationAvailable=false}:Props){
 const [view,setView]=useState<View>('reports');
 const [arrival,setArrival]=useState<string[]>([]);
 const [selectedUrl,setSelectedUrl]=useState<string|null>(null);
 const firstDelivered=useRef(false);
 // Prefer independently written research over a newer search-only preview.
 // A late poll must never erase an already completed report.
 const all=useMemo(()=>{
  const result=new Map<string,MatchedJob>();
  for(const incoming of [...jobs,...officialJobs]){
   if(!validJob(incoming))continue;
   const previous=result.get(incoming.official_url);
   if(!previous){result.set(incoming.official_url,incoming);continue;}
   const preferred=completeness(incoming)>=completeness(previous)?incoming:previous;
   const secondary=preferred===incoming?previous:incoming;
   result.set(incoming.official_url,{
    ...secondary,...preferred,
    research_detail:preferred.research_detail||secondary.research_detail,
    reference_jd:preferred.reference_jd||secondary.reference_jd,
    reference_jd_basis:preferred.reference_jd_basis||secondary.reference_jd_basis,
    jd_research:preferred.jd_research||secondary.jd_research
   });
  }
  return [...result.values()];
 },[jobs,officialJobs]);
 const ready=useMemo(()=>all.filter(fullReport),[all]);
 useEffect(()=>{
  setArrival(previous=>{
   const found=new Set(ready.map(j=>j.official_url)),kept=previous.filter(url=>found.has(url)),existing=new Set(kept);
   const next=[...kept,...ready.filter(j=>!existing.has(j.official_url)).map(j=>j.official_url)];
   return next.length===previous.length&&next.every((x,i)=>x===previous[i])?previous:next;
  });
 },[ready]);
 useEffect(()=>{
  if(ready.length&&!firstDelivered.current){
   firstDelivered.current=true;setView('reports');
  }
 },[ready.length]);
 const order=[...arrival.map(url=>ready.find(j=>j.official_url===url)).filter((j):j is MatchedJob=>!!j),...ready.filter(j=>!arrival.includes(j.official_url))];
 const selectedIndex=Math.max(0,order.findIndex(j=>j.official_url===selectedUrl));
 const current=order[selectedIndex];
 const target=Number.isSafeInteger(report?.final_target)&&Number(report?.final_target)>0?Number(report?.final_target):20;
 const discovered=Math.max(report?.discovered||0,all.length);
 const profileData=report?.profile||profile;
 const sourceCount=report?.search_source_count||0;
 const officialReady=ready.filter(isVerifiedMatchReport).length;
 const progressMessage=activity?.message||stageText[progressStage];
 const choose=(index:number)=>{if(index<0||index>=order.length)return;setSelectedUrl(order[index].official_url);};
 return <div className="hhba-report-first" data-hhba-report-first="true">
  <div className="hhba-rf-topline">
   <div><span className="hhba-rf-kicker">HHBA / CAREER INTELLIGENCE</span><h1>你的职业机会研究</h1>
    <p>一份报告研究完成，就先交付这一份。其余机会继续探索。</p></div>
   <div className={'hhba-rf-running'+(!pending?' hhba-rf-running-done':'')} role="status">
    {pending?<LoaderCircle className="hhba-rf-spin" size={15} aria-hidden="true"/>:<CheckCircle2 size={15} aria-hidden="true"/>}
    <span>{pending?'研究持续进行':failed?'本次研究已中断':'本轮研究已结束'}</span>
   </div>
  </div>
  <div className="hhba-rf-tabs" role="tablist" aria-label="职业研究工作区">
   {([{id:'reports',label:'研究报告',icon:FileCheck2},{id:'explore',label:'机会探索',icon:Globe2},{id:'profile',label:'职业画像',icon:UserRound}] as const).map(item=><button key={item.id} type="button" role="tab" aria-selected={view===item.id} className={view===item.id?'hhba-rf-tab-active':''} onClick={()=>setView(item.id)}>
    <item.icon size={16} aria-hidden="true"/>{item.label}{item.id==='reports'&&ready.length>0&&<span className="hhba-rf-tab-count">{ready.length}</span>}
   </button>)}
  </div>
  {view==='reports'&&<div className="hhba-rf-body" role="tabpanel" aria-label="研究报告">
   <div className="hhba-rf-summary">
    <div><span>已交付完整报告</span><strong>{String(ready.length).padStart(2,'0')} <small>/ {target}</small></strong></div>
    <p>{ready.length>0?'已完成的报告可立即阅读，后续新增不会打断当前阅读。':pending?'第一份完整报告正在准备中，完成后会自动出现在这里。':failed?'本轮研究中断，尚无完整报告交付。':'本轮没有可交付的完整报告，请查看研究记录。'}</p>
   </div>
   {!current?<div className="hhba-rf-first-wait" aria-live="polite">
    <div className="hhba-rf-first-symbol">{pending?<Sparkles size={27}/>:<BookOpen size={27}/>}</div>
    <h2>{pending?'首份专属岗位报告，优先生成中':failed?'本次研究暂未完成':'尚未形成可交付报告'}</h2>
    <p>{pending?'AI 正在整理岗位详情、匹配依据与求职建议。报告未完成前，不会用一张空岗位卡代替成果。':failed?'已收到的职业机会仍可在「机会探索」查看。':'可在「机会探索」中查看已收到的岗位线索。'}</p>
    {pending&&<div className="hhba-rf-wait-status"><LoaderCircle className="hhba-rf-spin" size={15}/><span>{progressMessage}</span></div>}
   </div>:<>
    <div className="hhba-rf-navigation">
     <span>完整报告 <b>{String(selectedIndex+1).padStart(2,'0')}</b> / {String(order.length).padStart(2,'0')}</span>
     <div><button className="hhba-rf-prev" type="button" aria-label="上一份报告" disabled={selectedIndex===0} onClick={()=>choose(selectedIndex-1)}><ArrowLeft size={17}/></button>
      <button className="hhba-rf-next" type="button" aria-label="下一份报告" disabled={selectedIndex>=order.length-1} onClick={()=>choose(selectedIndex+1)}><ArrowRight size={17}/></button></div>
    </div>
    <article key={current.official_url} className="hhba-rf-report">
     <div className="hhba-rf-report-head">
      <div className="hhba-rf-report-identity"><span className="hhba-rf-report-label">PERSONALIZED CAREER REPORT</span>
       <h2>{current.title_zh||current.title}</h2><p><BriefcaseBusiness size={14}/>{current.company}<span className="hhba-rf-mid-dot">·</span><MapPin size={14}/>{current.location}</p>
       <span className={isVerifiedMatchReport(current)?'hhba-rf-source-tag hhba-rf-source-official':'hhba-rf-source-tag'}>{isVerifiedMatchReport(current)?'岗位资料已核实':'AI 参考研究 · 招聘信息待核实'}</span>
      </div>
      <div className="hhba-rf-score"><strong>{safeScore(current)??'—'}{safeScore(current)!==null&&<small>/100</small>}</strong><span>匹配参考分</span></div>
     </div>
     <div className="hhba-rf-report-content">
      <Section title="岗位详情">{current.reference_jd||current.evidence_excerpt||'暂无可用的岗位详情。'}</Section>
      <Section title="岗位详情整理依据">{current.reference_jd_basis||'所述岗位详情以本次实际获得的公开资料为依据。'}</Section>
      <Section title="匹配分析"><p>{current.research_detail?.score_explanation}</p><EvidenceRows job={current}/></Section>
      <div className="hhba-rf-pair">
       <Section title="你的竞争优势">{current.research_detail?.strengths||'尚未形成可靠结论。'}</Section>
       <Section title="需要关注的差距">{current.research_detail?.risks||'尚未形成可靠结论。'}</Section>
      </div>
      <Section title="职业发展与竞争力">{[current.research_detail?.career_development,current.research_detail?.competition].filter(Boolean).join('\n\n')}</Section>
      <Section title="求职行动与简历优化">{current.research_detail?.optimization_advice||'尚未形成具体建议。'}</Section>
      {(current.research_detail?.extra_sections||[]).map((section,i)=><Section key={i} title={section.title}>{section.content}</Section>)}
     </div>
     <div className="hhba-rf-report-footer">
      <div className="hhba-rf-trust"><ShieldCheck size={16}/><span>{current.reference_jd_kind==='AI_GENERATED_REFERENCE'?'岗位详情为 AI 编写的参考研究，并非企业发布的原文要求。':'以可核实的岗位资料为依据；申请条件以招聘页面为准。'} 匹配分不代表录用概率。</span></div>
      <div className="hhba-rf-actions">
       {discoveryApplyDestination(current)&&<a href={discoveryApplyDestination(current)||undefined} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">{isVerifiedMatchReport(current)?'投递官网':'查看岗位来源'}<ArrowUpRight size={15}/></a>}
       {onOptimize&&isVerifiedMatchReport(current)&&<button type="button" disabled={!optimizationAvailable} onClick={()=>onOptimize(current)}><Sparkles size={15}/>针对岗位优化简历</button>}
      </div>
     </div>
    </article>
    {pending&&<div className="hhba-rf-continuing"><LoaderCircle size={16} className="hhba-rf-spin"/><span>其他岗位正在继续研究，新的完整报告将自动加入这里。</span></div>}
   </>}
  </div>}
  {view==='explore'&&<div className="hhba-rf-body" role="tabpanel" aria-label="机会探索">
   <div className="hhba-rf-explore-head"><div><span className="hhba-rf-kicker">LIVE OPPORTUNITY RESEARCH</span><h2>正在为你探索更多机会</h2></div>{pending&&<span className="hhba-rf-live"><LoaderCircle className="hhba-rf-spin" size={14}/>研究中</span>}</div>
   <div className="hhba-rf-facts">
    <div><span>已发现具体岗位</span><strong>{discovered}</strong></div>
    <div><span>已交付研究报告</span><strong>{ready.length}</strong></div>
    <div><span>已核实正式推荐</span><strong>{officialReady}</strong></div>
   </div>
   <p className="hhba-rf-explore-note">{progressMessage}{sourceCount>0?' · 已研究 '+sourceCount+' 条公开检索来源':''}。候选数量不等于报告数量。</p>
   <h3>最新发现的岗位</h3>
   {all.length?<div className="hhba-rf-leads">{[...all].reverse().slice(0,12).map(job=><div key={job.official_url} className="hhba-rf-lead">
    <div><strong>{job.title_zh||job.title}</strong><small>{job.company} · {job.location}</small></div>
    {fullReport(job)?<span className="hhba-rf-lead-ready"><CheckCircle2 size={14}/>报告完成</span>:<span className="hhba-rf-lead-working">研究中</span>}
    {fullReport(job)&&<button type="button" onClick={()=>{setSelectedUrl(job.official_url);setView('reports')}} aria-label={'查看 '+(job.title_zh||job.title)+' 完整报告'}><ChevronRight size={18}/></button>}
   </div>)}</div>:<p className="hhba-rf-none">暂未收到具体岗位。AI 正在研究真实招聘机会。</p>}
  </div>}
  {view==='profile'&&<div className="hhba-rf-body" role="tabpanel" aria-label="职业画像">
   <span className="hhba-rf-kicker">PERSONAL CAREER PROFILE</span><h2 className="hhba-rf-subtitle">AI 对你的职业背景的理解</h2>
   {!profileData?<p className="hhba-rf-none">简历分析正在进行，完成后会展示职业画像。</p>:<>
    <Section title="职业概况">{profileData.summary||'已读取简历信息，正在整理职业背景。'}</Section>
    <div className="hhba-rf-pair">
     <Section title="工作经验">{profileData.experience_evidence||'尚未取得可独立确认的工作年限。'}</Section>
     <Section title="教育背景">{profileData.education_evidence||profileData.education||'简历中未发现明确的教育信息。'}</Section>
    </div>
    {!!profileData.skills?.length&&<section className="hhba-rf-section"><h3>核心能力</h3><div className="hhba-rf-skill-list">{profileData.skills.map((skill,i)=><span key={i} title={skill.evidence}>{skill.name}</span>)}</div></section>}
    {!!profileData.target_roles?.length&&<section className="hhba-rf-section"><h3>AI 探索方向</h3><div className="hhba-rf-skill-list">{profileData.target_roles.map((role,i)=><span key={i}>{role}</span>)}</div></section>}
   </>}
  </div>}
 </div>;
}
