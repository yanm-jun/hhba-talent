import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowUpRight,BriefcaseBusiness,Building2,MapPin,Wallet,CheckCircle2,X} from 'lucide-react';
import {Link} from '../router';
import {safeOfficialJobUrl} from '../services/liveRecruitment';
import {safeExternalJobApplicationUrl,safeOfficialNavigationUrl,type MatchResponse,type MatchedJob,type OfficialNavigationOpportunity} from '../services/resumeMatch';
import '../styles/resume-match-dialog.css';

// Chinese labels are presentation-only: never replace or invent the official job title.
const translatedTitles:[RegExp,string][]=[
 [/^python\s+(?:developer|engineer)$/i,'Python 开发工程师'],
 [/^(?:software\s+(?:engineer|developer)|software development engineer)$/i,'软件开发工程师'],
 [/^(?:data analyst|business data analyst)$/i,'数据分析师'],
 [/^data engineer$/i,'数据工程师'],
 [/^data scientist$/i,'数据科学家'],
 [/^front.?end\s+(?:developer|engineer)$/i,'前端开发工程师'],
 [/^back.?end\s+(?:developer|engineer)$/i,'后端开发工程师'],
 [/^full.?stack\s+(?:developer|engineer)$/i,'全栈开发工程师'],
 [/^product manager$/i,'产品经理'],
 [/^(?:ui\/ux designer|ux designer)$/i,'用户体验设计师'],
 [/^business analyst$/i,'业务分析师'],
 [/^operations specialist$/i,'运营专员'],
 [/^marketing specialist$/i,'市场营销专员'],
 [/^devops engineer$/i,'运维开发工程师'],
 [/^machine learning engineer$/i,'机器学习工程师'],
 [/^qa engineer$/i,'测试工程师'],
 [/^test engineer$/i,'测试工程师'],
 [/^research engineer$/i,'研发工程师'],
 [/^sales manager$/i,'销售经理'],
 [/^product designer$/i,'产品设计师'],
 [/^graphic designer$/i,'平面设计师'],
 [/^account manager$/i,'客户经理'],
 [/^software engineer[\\s,\\-–—]+backend$/i,'后端软件开发工程师'],
 [/^software engineer[\\s,\\-–—]+frontend$/i,'前端软件开发工程师'],
 [/^software engineer[\\s,\\-–—]+fullstack$/i,'全栈软件开发工程师'],
 [/^software engineer[\\s,\\-–—]+ubuntu commercial computers$/i,'Ubuntu 商用电脑软件开发工程师'],
 [/^software engineer(?:\\s+(?:i|ii|iii|iv))?$/i,'软件开发工程师']
];
function chineseJobTitle(item:MatchedJob):string|null{
 const named=item.title_zh?.trim()||'';
 if(/[\u3400-\u9fff]/u.test(named))return named;
 const original=item.title.trim();
 if(/[\u3400-\u9fff]/u.test(original))return original;
 const level=/^(senior|staff|principal|junior|lead)\s+/i.exec(original)?.[1]?.toLowerCase();
 const base=level?original.replace(/^(?:senior|staff|principal|junior|lead)\s+/i,''):original;
 const chinese=translatedTitles.find(([rule])=>rule.test(base))?.[1]||null;
 if(!chinese)return null; // Never put untranslated English-only positions into a Chinese shortlist.
 const prefix:Record<string,string>={senior:'高级',staff:'资深',principal:'首席',junior:'初级',lead:'技术负责人·'};
 return (level?prefix[level]:'')+chinese;
}
const cityNames:Record<string,string>={
 beijing:'北京',shanghai:'上海',shenzhen:'深圳',guangzhou:'广州',
 hangzhou:'杭州',chengdu:'成都',nanjing:'南京',suzhou:'苏州',
 wuhan:'武汉',xian:'西安',tianjin:'天津',chongqing:'重庆',
 qingdao:'青岛',ningbo:'宁波',xiamen:'厦门',jinan:'济南'
};
function chineseLocation(location:string){
 if(/[\u3400-\u9fff]/.test(location))return location;
 const lower=location.toLowerCase();
 const selected=Object.entries(cityNames).find(([en])=>
  new RegExp('(?:^|[^a-z])'+en+'(?:$|[^a-z])').test(lower));
 return selected?.[1]||'中国大陆（城市见官网）';
}
function officialLink(item:MatchedJob){
 if(item.source_type==='站外官方招聘')return safeExternalJobApplicationUrl(item);
 return safeOfficialJobUrl({id:item.id,source:item.source,platform:item.platform,
  company:item.company,title:item.title,url:item.official_url,location:item.location,remote:item.remote});
}
function Row({item,onOpen}:{item:MatchedJob;onOpen:()=>void}){
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
function OfficialLinkRow({item,url}:{item:OfficialNavigationOpportunity;url:string}){
 const direct=item.kind==='JOB_DETAIL';
 return <a className="hhba-match-job hhba-match-navigation-row" href={url}
  target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true"
  aria-label={'前往'+item.company+(direct?'相关岗位链接':'招聘入口')+'，在对应招聘页面核实'}>
  <span className="hhba-match-job-company-mark" aria-hidden="true"><Building2 size={19}/></span>
  <span className="hhba-match-job-main">
   <strong className="hhba-match-job-company">{item.company}</strong>
   <span className="hhba-match-job-role">{direct?('相关岗位 · '+item.role):'企业招聘入口'}</span>
   <span className="hhba-match-job-facts">
    <span>{direct?'具体岗位链接':'招聘入口'}</span>
    <span>{item.workplace}</span>
    <span>资格及在招状态待官网确认</span>
   </span>
  </span>
  <span className="hhba-match-navigation-action">打开招聘页</span>
  <ArrowUpRight className="hhba-match-job-arrow" size={17} aria-hidden="true"/>
 </a>;
}
export function CandidateMatchResultDialog({result,onClose}:{result:MatchResponse;onClose:()=>void}){
 const dialogRef=useRef<HTMLDivElement|null>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const visibleMatches=result.matches.filter(job=>chineseJobTitle(job)!==null);
 const officialLinks=(result.opportunities||[]).map(item=>({
  item,url:safeOfficialNavigationUrl(item)
 })).filter((entry):entry is {item:OfficialNavigationOpportunity;url:string}=>Boolean(entry.url));
 const selected=visibleMatches.find(x=>x.id===selectedId)||null;
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
      <div><strong>HHBA 智能招聘导航</strong><small>寻找机会，前往企业招聘渠道</small></div>
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
       <span className="hhba-match-eyebrow">招聘机会 · 官方链接直达</span>
       <h2 id="hhba-match-dialog-title">找到相关招聘入口，直接查看</h2>
       <p>优先展示与你的求职方向相关的企业招聘页面和岗位直达链接，可能跳转至企业使用的第三方招聘系统。公开链接不是资格审核结果，请在对应页面核实。</p>
      </div>
      {officialLinks.length>0&&<>
       <div className="hhba-match-list-heading"><strong>企业招聘链接 <span>{officialLinks.length} 个</span></strong><small>打开招聘官网或招聘系统</small></div>
       <div className="hhba-match-job-list" aria-label="企业官方招聘链接">
        {officialLinks.map(({item,url})=><OfficialLinkRow key={url} item={item} url={url}/>)}
       </div>
       <p className="hhba-match-link-notice">这些公开链接仅用于招聘导航。即使页面已成功读取，也不代表企业身份、岗位在招、工作城市或个人资格均已独立核实。请在企业招聘页面自行确认中国大陆工作地点及申请条件。</p>
      </>}
      {visibleMatches.length>0&&
       <div className="hhba-match-list-heading hhba-match-verified-heading"><strong>已核验岗位 <span>{visibleMatches.length} 个</span></strong><small>按参考相关度排序</small></div>}
      {visibleMatches.length>0&&<div className="hhba-match-job-list">
       {visibleMatches.map(job=><Row key={job.id} item={job} onOpen={()=>setSelectedId(job.id)}/>)}
      </div>}
      {!officialLinks.length&&!visibleMatches.length&&<div className="hhba-match-empty"><Building2 size={23}/><h3>暂未找到可核验的企业招聘入口</h3>
       <p>不会用招聘聚合站、境外工作或未经确认的链接凑满十条。你可以修改岗位方向再次查找。</p></div>}
      {Boolean(result.qualification_reviews?.length)&&<section className="hhba-match-review" aria-label="需要补充资料的岗位">
       <h3>另外 {result.qualification_reviews?.length} 个岗位需要补充资料</h3>
       <p>这些不是已确认符合条件的推荐，不计入 Top 10。简历没有写明的条件不代表您一定不符合。</p>
       <div className="hhba-match-review-rows">{result.qualification_reviews?.map(review=>
        <div className="hhba-match-review-row" key={review.id}>
         <strong>{review.company} · {review.title}</strong>
         <span>{review.missing.slice(0,2).map(x=>x.label).join('；')}</span>
        </div>)}</div>
       <button type="button" onClick={onClose}>返回补充简历信息</button>
      </section>}
      <p className="hhba-match-disclaimer">招聘导航与已核验岗位分开展示；导航链接不计入资格匹配分数，也不代表录用概率。最终以企业官网或其指定招聘系统为准。</p>
     </>}
    </div>
    <footer className="hhba-match-modal-foot">
     <span>HHBA · 求职机会匹配</span>
     <button type="button" className="hhba-match-done" onClick={onClose}>完成查看</button>
    </footer>
   </div>
  </div>,document.body);
}
