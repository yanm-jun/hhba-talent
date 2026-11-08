import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowUpRight,BriefcaseBusiness,Building2,MapPin,Wallet,CheckCircle2,X} from 'lucide-react';
import {Link} from '../router';
import {safeOfficialJobUrl} from '../services/liveRecruitment';
import {safeExternalJobApplicationUrl,type MatchResponse,type MatchedJob} from '../services/resumeMatch';
import '../styles/resume-match-dialog.css';

// Chinese labels are presentation-only: never replace or invent the official job title.
const translatedTitles:[RegExp,string][]=[
 [/^(?:senior\s+)?python\s+(?:developer|engineer)$/i,'Python 开发工程师'],
 [/^(?:senior\s+)?(?:software\s+(?:engineer|developer)|software development engineer)$/i,'软件开发工程师'],
 [/^(?:senior\s+)?(?:data analyst|business data analyst)$/i,'数据分析师'],
 [/^(?:senior\s+)?(?:data engineer)$/i,'数据工程师'],
 [/^(?:senior\s+)?(?:data scientist)$/i,'数据科学家'],
 [/^(?:senior\s+)?(?:front.?end\s+(?:developer|engineer))$/i,'前端开发工程师'],
 [/^(?:senior\s+)?(?:back.?end\s+(?:developer|engineer))$/i,'后端开发工程师'],
 [/^(?:senior\s+)?(?:full.?stack\s+(?:developer|engineer))$/i,'全栈开发工程师'],
 [/^(?:senior\s+)?(?:product manager)$/i,'产品经理'],
 [/^(?:senior\s+)?(?:ui\/ux designer|ux designer)$/i,'用户体验设计师'],
 [/^(?:senior\s+)?(?:business analyst)$/i,'业务分析师'],
 [/^(?:senior\s+)?(?:operations specialist)$/i,'运营专员'],
 [/^(?:senior\s+)?(?:marketing specialist)$/i,'市场营销专员']
];
function chineseJobTitle(item:MatchedJob){
 if(item.title_zh?.trim())return item.title_zh.trim();
 const original=item.title.trim();
 if(/[\u3400-\u9fff]/.test(original))return original;
 return translatedTitles.find(([rule])=>rule.test(original))?.[1]||original;
}
const cityNames:Record<string,string>={
 beijing:'北京',shanghai:'上海',shenzhen:'深圳',guangzhou:'广州',
 hangzhou:'杭州',chengdu:'成都',nanjing:'南京',suzhou:'苏州',
 wuhan:'武汉',xian:'西安',tianjin:'天津',chongqing:'重庆',
 qingdao:'青岛',ningbo:'宁波',xiamen:'厦门',jinan:'济南'
};
function chineseLocation(location:string){
 if(/[\u3400-\u9fff]/.test(location))return location;
 const key=location.toLowerCase().split(/[\s,\/]+/)[0];
 return cityNames[key]||location;
}
function officialLink(item:MatchedJob){
 if(item.source_type==='站外官方招聘')return safeExternalJobApplicationUrl(item);
 return safeOfficialJobUrl({id:item.id,source:item.source,platform:item.platform,
  company:item.company,title:item.title,url:item.official_url,location:item.location,remote:item.remote});
}
function Row({item,index,onOpen}:{item:MatchedJob;index:number;onOpen:()=>void}){
 return <button type="button" className="hhba-match-job" onClick={onOpen}
   aria-label={'查看'+item.company+'的'+chineseJobTitle(item)+'岗位详情'}>
  <span className="hhba-match-job-company-mark" aria-hidden="true"><Building2 size={19}/></span>
  <span className="hhba-match-job-main">
   <strong className="hhba-match-job-company">{item.company}</strong>
   <span className="hhba-match-job-role">{chineseJobTitle(item)}</span>
   <span className="hhba-match-job-facts">
    <span><MapPin size={13}/>{chineseLocation(item.location)||'地点待确认'}</span>
    <span><Wallet size={13}/>{item.salary||'薪资未公布'}</span>
    <span><BriefcaseBusiness size={13}/>{item.experience_requirement||'经验未注明'}</span>
   </span>
  </span>
  <span className="hhba-match-job-score"><strong>{item.reference_score}<small>分</small></strong><span>参考匹配度</span></span>
  <ArrowUpRight className="hhba-match-job-arrow" size={17} aria-hidden="true"/>
 </button>;
}
export function CandidateMatchResultDialog({result,onClose}:{result:MatchResponse;onClose:()=>void}){
 const dialogRef=useRef<HTMLDivElement|null>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const selected=result.matches.find(x=>x.id===selectedId)||null;
 useEffect(()=>{
  const previous=document.body.style.overflow;
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.style.overflow='hidden';
  dialogRef.current?.focus();
  return()=>{document.body.style.overflow=previous;trigger?.focus();};
 },[]);
 function onKeyDown(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();if(selected){setSelectedId(null);}else onClose();return;}
  if(event.key!=='Tab'||!dialogRef.current)return;
  const focusable=Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
   'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
  )).filter(element=>element.getClientRects().length>0);
  if(!focusable.length){event.preventDefault();dialogRef.current.focus();return;}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){
   event.preventDefault();last.focus();
  }else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
 const link=selected?officialLink(selected):null;
 return createPortal(
  <div className="hhba-match-overlay" role="presentation"
   onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
   <div className="hhba-match-modal" role="dialog" aria-modal="true"
    aria-labelledby="hhba-match-dialog-title" ref={dialogRef} tabIndex={-1} onKeyDown={onKeyDown}>
    <header className="hhba-match-modal-head">
     <div className="hhba-match-modal-brand"><span className="hhba-match-modal-symbol"><BriefcaseBusiness size={19}/></span>
      <div><strong>HHBA 智能岗位匹配</strong><small>让合适的机会，与你更近一步</small></div>
     </div>
     <button type="button" className="hhba-match-modal-close" aria-label="关闭岗位推荐" onClick={onClose}><X size={19}/></button>
    </header>
    <div className="hhba-match-modal-content">
     {selected?<>
      <button type="button" className="hhba-match-detail-back" onClick={()=>setSelectedId(null)}><ArrowLeft size={17}/> 返回岗位列表</button>
      <div className="hhba-match-detail-head">
       <div><p className="hhba-match-detail-company">{selected.company}</p>
        <h2 id="hhba-match-dialog-title">{chineseJobTitle(selected)}</h2></div>
       <span className="hhba-match-job-score"><strong>{selected.reference_score}<small>分</small></strong><span>参考匹配度</span></span>
      </div>
      <div className="hhba-match-detail-facts">
       <span><MapPin size={15}/>{chineseLocation(selected.location)}</span>
       <span><Wallet size={15}/>{selected.salary||'薪资未公布'}</span>
       <span><BriefcaseBusiness size={15}/>{selected.experience_requirement||'经验未注明'}</span>
      </div>
      <section className="hhba-match-detail-section"><h3>为什么推荐给您</h3>
       {selected.matched?.length?<ul>{selected.matched.map((reason,i)=><li key={i}><CheckCircle2 size={15}/>{reason}</li>)}</ul>:
        <p>该岗位与您的求职方向有关，具体职责请参考企业招聘原文。</p>}
      </section>
      {Boolean(selected.not_evidenced?.length)&&<section className="hhba-match-detail-section">
       <h3>需要进一步确认的条件</h3><ul>{selected.not_evidenced.map((gap,i)=><li key={i}>{gap}</li>)}</ul>
      </section>}
      <section className="hhba-match-detail-section"><h3>岗位要求与投递</h3>
       <p>请在企业官方页面核实完整任职要求、薪资及最新招聘状态，匹配分数不代表录用概率。</p>
       {link?<a className="hhba-match-detail-apply" href={link} rel="noopener noreferrer" target="_blank" data-hhba-recruitment-outbound="true">查看企业官方岗位 <ArrowUpRight size={16}/></a>:
        selected.source_type!=='站外官方招聘'?<Link className="hhba-match-detail-apply" to={'/candidate/jobs/'+encodeURIComponent(selected.id)}>查看岗位资料 <ArrowUpRight size={16}/></Link>:
        <p className="hhba-match-detail-unavailable">暂未取得安全可用的官方投递入口。</p>}
      </section>
     </>:<>
      <div className="hhba-match-intro">
       <span className="hhba-match-eyebrow">为您精选的岗位机会</span>
       <h2 id="hhba-match-dialog-title">根据您的简历，为您匹配合适的工作</h2>
       <p>综合您的学历、工作经验、专业技能与求职方向，筛选中国大陆境内的招聘岗位。</p>
      </div>
      <div className="hhba-match-list-heading"><strong>推荐岗位 <span>{result.matches.length?('Top '+result.matches.length):'暂无'}</span></strong><small>按参考匹配度排序</small></div>
      {result.matches.length?<div className="hhba-match-job-list">
       {result.matches.map((job,i)=><Row key={job.id} index={i+1} item={job} onOpen={()=>setSelectedId(job.id)}/>)}
      </div>:<div className="hhba-match-empty"><Building2 size={23}/><h3>目前没有通过岗位条件核验的推荐</h3>
       <p>不会用境外岗位、经验要求不符或无法核验的职位凑满十条。您可以返回调整求职方向。</p></div>}
      <p className="hhba-match-disclaimer">仅推荐中国大陆岗位。匹配分数是参考相关度，不是录用成功率；实际招聘状态以企业官网为准。</p>
     </>}
    </div>
    <footer className="hhba-match-modal-foot">
     <span>HHBA · 求职机会匹配</span>
     <button type="button" className="hhba-match-done" onClick={onClose}>完成查看</button>
    </footer>
   </div>
  </div>,document.body);
}
