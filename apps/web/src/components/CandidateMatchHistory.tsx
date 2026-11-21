import {useEffect,useState} from 'react';
import {ArrowRight,BriefcaseBusiness,Clock3,FileText,History,LoaderCircle,Search,Sparkles,Trash2} from 'lucide-react';
import {Link} from '../router';
import {CandidateMatchNativeDialog} from './CandidateMatchNativeDialog';
import {getMatchHistory,listMatchHistory,removeMatchHistory,linkMatchHistoryResume,
 type HistoryMatchedJob,type MatchHistoryDetail,type MatchHistorySummary} from '../services/matchHistory';
import {listPrivateResumes,type PrivateResume} from '../services/privateResumes';
import type {MatchedJob,MatchProfile} from '../services/resumeMatch';
import '../styles/match-history.css';

const dateLabel=(raw:string)=>{
 const timestamp=Date.parse(raw);
 return Number.isFinite(timestamp)?new Date(timestamp).toLocaleString('zh-CN',{
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'
 }):'时间待确认';
};
const safeJobUrl=(raw:string)=>{
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash?u.href:null}
 catch{return null}
};
// Historical snapshots contain recommendation reasoning, NOT the original
// resume profile or a currently verified JD. Never synthesize qualifications.
const historyProfile:MatchProfile={
 education:null,education_evidence:null,experience_years:null,experience_evidence:null,
 skills:[],target_roles:[],warnings:[]
};
const historyJobId=(historyId:string,index:number)=>'history-'+historyId+'-'+index;
function toOptimizerJob(job:HistoryMatchedJob,historyId:string,index:number):MatchedJob{
 return {
  id:historyJobId(historyId,index),company:job.company,title:job.title,title_zh:job.title,
  location:job.location,official_url:job.official_url,
  platform:job.recruitment_source_kind||'UNVERIFIED',source:'MATCH_HISTORY',remote:false,
  reference_score:job.match_score??0,match_score:job.match_score,
  matched:[],not_evidenced:[],needs_verification:[],
  // These are the *saved* reasons, not a freshly fetched job description.
  requirements_basis:[job.score_basis,job.recommendation_reason].filter(Boolean).join('\n').slice(0,1800),
  score_basis:job.score_basis,recommendation_reason:job.recommendation_reason,
  recruitment_source_note:job.recruitment_source_note,
  recruitment_source_kind:job.recruitment_source_kind==='EMPLOYER_ATS'?'EMPLOYER_ATS':
   job.recruitment_source_kind==='EMPLOYER_DOMAIN_CANDIDATE'?'EMPLOYER_DOMAIN_CANDIDATE':'UNVERIFIED',
  availability_status:job.availability_status
 };
}
type HistoryView='details'|'optimize';

export function CandidateMatchHistory({active=true}:{active?:boolean}){
 const [items,setItems]=useState<MatchHistorySummary[]>([]);
 const [selected,setSelected]=useState<MatchHistoryDetail|null>(null);
 const [view,setView]=useState<HistoryView>('details');
 const [original,setOriginal]=useState<PrivateResume|null>(null);
 const [wordFiles,setWordFiles]=useState<PrivateResume[]>([]);
 const [chosenWordId,setChosenWordId]=useState('');
 const [wordNotice,setWordNotice]=useState('');
 const [editingJobId,setEditingJobId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  if(!active){setEditingJobId(null);return;}
  let mounted=true;setLoading(true);setError('');
  void listMatchHistory().then(rows=>{if(mounted)setItems(rows)})
   .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'历史记录读取失败')})
   .finally(()=>{if(mounted)setLoading(false)});
  return()=>{mounted=false};
 },[active]);
 async function open(id:string,nextView:HistoryView='details'){
  if(busy)return;
  setBusy(true);setError('');setNotice('');setWordNotice('');setEditingJobId(null);
  setOriginal(null);setChosenWordId('');setWordFiles([]);
  try{
   const detail=await getMatchHistory(id);
   setSelected(detail);setView(nextView);
   if(nextView==='optimize'){
    try{
     const originals=(await listPrivateResumes()).filter(item=>/\.docx$/i.test(item.name));
     setWordFiles(originals);
     const linked=originals.find(item=>item.id===detail.resume_id)||null;
     setOriginal(linked);
     if(!linked)setWordNotice(detail.resume_id?
      '这份历史记录关联的原 Word 已不存在，或原文件不是 DOCX。请重新上传并手动关联正确的 Word。':
      '本次历史没有保存原始 Word。请从已保存的文件中选择当时的原件；如果没有，请先上传。');
    }catch(e){
     setWordNotice(e instanceof Error?e.message:'私有简历暂时无法读取，请稍后再试。');
    }
   }
  }catch(e){setError(e instanceof Error?e.message:'历史记录读取失败')}
  finally{setBusy(false)}
 }
 async function attachOriginal(){
  if(!selected||busy||!chosenWordId)return;
  const chosen=wordFiles.find(file=>file.id===chosenWordId);
  if(!chosen)return;
  if(!window.confirm('请确认这就是当时用于匹配的原始 Word 简历。关联后会用于这些历史岗位的定向优化，历史匹配分不会重新计算。'))return;
  setBusy(true);setError('');setWordNotice('');
  try{
   await linkMatchHistoryResume(selected.id,chosen.id);
   const checked=await getMatchHistory(selected.id);
   if(checked.resume_id!==chosen.id)throw Error('原文件关联未通过账户校验，请重试。');
   setSelected(checked);setOriginal(chosen);
   setItems(rows=>rows.map(item=>item.id===checked.id?{...item,resume_id:chosen.id,resume_label:chosen.name}:item));
   setWordNotice('原 Word 已关联。请选择下方一个岗位继续优化；不会重新搜索或修改历史分数。');
  }catch(e){setWordNotice(e instanceof Error?e.message:'关联原 Word 失败，请重试。')}
  finally{setBusy(false)}
 }
 async function erase(id:string){
  if(busy||!window.confirm('确定删除这次 AI 匹配历史及全部推荐岗位记录吗？不会删除你的原始简历。'))return;
  setBusy(true);setError('');setNotice('');
  try{
   await removeMatchHistory(id);
   setItems(rows=>rows.filter(item=>item.id!==id));
   setSelected(null);setOriginal(null);setEditingJobId(null);
   setNotice('匹配历史已删除；已保存的原始简历未受影响。');
   window.dispatchEvent(new Event('hhba:match-history-changed'));
  }catch(e){setError(e instanceof Error?e.message:'删除失败')}
  finally{setBusy(false)}
 }
 const historyJobs=selected?.matches.map((job,index)=>toOptimizerJob(job,selected.id,index))||[];
 return <section className="hhba-account-panel hhba-match-history" aria-label="AI 匹配历史">
  <div className="hhba-account-section-heading">
   <div><h2><History size={21}/> AI 匹配历史</h2>
    <p>记录每次 AI 推荐的企业、岗位、适配分和理由；这里不是已投递申请。</p>
   </div>
   <Link to="/candidate/account/match">使用简历找新岗位 <ArrowRight size={15}/></Link>
  </div>
  {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
  {notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
  {loading?<p role="status"><LoaderCircle size={16} className="spin"/> 正在读取你的专属匹配历史…</p>:
   items.length===0?<div className="hhba-account-empty">
    <Search size={29}/><strong>还没有 AI 匹配历史</strong>
    <p>上传简历并完成一次 AI 推荐后，真实的岗位结果会自动保存到你的账户。历史记录不会被算作投递。</p>
    <Link to="/candidate/account/match">上传简历开始匹配</Link>
   </div>:<>
    <p className="hhba-match-history-explain">你可以随时查看上一次为什么推荐这些岗位，或使用同一份已保存的简历再次查找。只有重新完成匹配，才会产生新岗位对比；目前不会在后台自动搜索或发送通知。</p>
    {selected&&<div className="hhba-match-history-detail">
     <div className="hhba-match-history-detail-heading">
      <div><strong>{view==='optimize'?'选择要优化的历史岗位':'本次匹配详情'}</strong>
       <small>{dateLabel(selected.created_at)} · {selected.resume_label}</small></div>
      <button type="button" disabled={busy} onClick={()=>{setSelected(null);setEditingJobId(null)}}>返回历史列表</button>
     </div>
     {view==='optimize'&&<div className="hhba-match-history-optimizer-state">
      {original?<p><FileText size={16}/> 当前原 Word：<strong>{original.name}</strong></p>:
       <div className="hhba-match-history-attach">
        <p role="status">{wordNotice||'需要先关联本次匹配所用的原始 Word，才能保留原格式进行优化。'}</p>
        {wordFiles.length>0&&<div className="hhba-match-history-attach-controls">
         <label htmlFor="hhba-history-original-word">选择本次匹配的原 Word</label>
         <select id="hhba-history-original-word" value={chosenWordId} disabled={busy}
          onChange={event=>setChosenWordId(event.target.value)}>
          <option value="">请选择已保存的 DOCX</option>
          {wordFiles.map(file=><option key={file.id} value={file.id}>{file.name}</option>)}
         </select>
         <button type="button" disabled={busy||!chosenWordId} onClick={()=>void attachOriginal()}>
          {busy?'正在关联…':'关联并继续'}</button>
        </div>}
        <Link to="/candidate/account/resume">去「我的简历」上传原 Word <ArrowRight size={14}/></Link>
       </div>}
      {original&&wordNotice&&<small role="status">{wordNotice}</small>}
      <small>仅使用这次历史记录中的推荐理由和评分依据，不重新搜索岗位。原招聘要求及是否在招，请以企业官网当前信息为准；历史分数不是录用概率。</small>
     </div>}
     {selected.new_job_count>0&&<p className="hhba-match-history-new">{'相较之前已保存的记录，本次新发现 '+selected.new_job_count+' 个未推荐过的岗位。'}</p>}
     {selected.matches.map((job,i)=>{
      const href=safeJobUrl(job.official_url);
      return <article key={job.official_url} className="hhba-match-history-job">
       <div className="hhba-match-history-job-top">
        <span>{String(i+1).padStart(2,'0')}</span>
        <div><strong>{job.company}</strong><h3>{job.title}</h3><small>{job.location} · {job.recruitment_source_note||'企业招聘入口待核验'}</small></div>
        <b>{job.match_score===null?'—':job.match_score+'/100'}</b>
       </div>
       {job.score_basis&&<p><strong>评分依据：</strong>{job.score_basis}</p>}
       <p><strong>推荐理由：</strong>{job.recommendation_reason||'暂无补充理由，请核对岗位详情。'}</p>
       <div className="hhba-match-history-job-actions">
        {href&&<a href={href} target="_blank" rel="noopener noreferrer">查看原招聘页面（仍需确认在招） <ArrowRight size={14}/></a>}
        {view==='optimize'&&<button type="button" disabled={!original||busy}
         title={!original?'请先关联原 Word':'使用本次历史岗位的资料优化原 Word'}
         onClick={()=>setEditingJobId(historyJobId(selected.id,i))}>
          <Sparkles size={15}/> 优化这个岗位的简历
         </button>}
       </div>
      </article>;
     })}
     <div className="hhba-match-history-actions">
      {selected.resume_id?<Link to={'/candidate/account/match?resume='+encodeURIComponent(selected.resume_id)}>用这份简历重新匹配</Link>:
       <Link to="/candidate/account/match">上传简历重新匹配</Link>}
      {view==='details'&&<button type="button" className="hhba-match-history-optimize-secondary"
       disabled={busy} onClick={()=>void open(selected.id,'optimize')}><Sparkles size={15}/> 优化历史岗位简历</button>}
      <button type="button" disabled={busy} onClick={()=>void erase(selected.id)}><Trash2 size={15}/> 删除本次历史</button>
     </div>
    </div>}
    {!selected&&<div className="hhba-match-history-list">
     {items.map(item=><article key={item.id}>
      <div className="hhba-match-history-icon"><FileText size={20}/></div>
      <div className="hhba-match-history-copy">
       <strong>{item.role_hint?item.role_hint+' · AI 岗位匹配':'AI 智能岗位匹配'}</strong>
       <small><Clock3 size={13}/>{dateLabel(item.created_at)} · {item.resume_label}</small>
       <span>匹配 {item.job_count} 个岗位{item.best_score===null?'':' · 最高适配分 '+item.best_score}</span>
       {item.new_job_count>0&&<em>本次新发现 {item.new_job_count} 个之前未推荐的岗位</em>}
      </div>
      <div className="hhba-match-history-row-actions">
       <button type="button" disabled={busy} onClick={()=>void open(item.id)}>查看岗位与理由 <ArrowRight size={15}/></button>
       <button type="button" className="hhba-match-history-row-optimize" disabled={busy}
        onClick={()=>void open(item.id,'optimize')}><Sparkles size={14}/> 优化简历</button>
       <button type="button" disabled={busy} title="删除记录" aria-label="删除本次匹配历史"
        onClick={()=>void erase(item.id)}><Trash2 size={14}/></button>
      </div>
     </article>)}
    </div>}
   </>}
  <p className="hhba-match-history-footer"><BriefcaseBusiness size={15}/> 所有记录仅对当前登录账户开放。职位可能下线，历史评分不代表录用概率。未启用自动推送。</p>
  {active&&selected&&original&&editingJobId&&
   <CandidateMatchNativeDialog key={selected.id+':'+editingJobId}
    result={{profile:historyProfile,matches:historyJobs}}
    initialOptimizedJobId={editingJobId}
    sourceResume={original} accountScope={selected.id}
    onClose={()=>setEditingJobId(null)}/>}
 </section>;
}
