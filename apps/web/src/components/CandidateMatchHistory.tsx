import {useEffect,useState} from 'react';
import {ArrowRight,BriefcaseBusiness,Clock3,FileText,History,LoaderCircle,Search,Trash2} from 'lucide-react';
import {Link} from '../router';
import {getMatchHistory,listMatchHistory,removeMatchHistory,
 type MatchHistoryDetail,type MatchHistorySummary} from '../services/matchHistory';
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

export function CandidateMatchHistory(){
 const [items,setItems]=useState<MatchHistorySummary[]>([]);
 const [selected,setSelected]=useState<MatchHistoryDetail|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  let mounted=true;
  void listMatchHistory().then(rows=>{if(mounted)setItems(rows)})
   .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'历史记录读取失败')})
   .finally(()=>{if(mounted)setLoading(false)});
  return()=>{mounted=false};
 },[]);
 async function open(id:string){
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{setSelected(await getMatchHistory(id))}
  catch(e){setError(e instanceof Error?e.message:'历史记录读取失败')}
  finally{setBusy(false)}
 }
 async function erase(id:string){
  if(busy||!window.confirm('确定删除这次 AI 匹配历史及全部推荐岗位记录吗？不会删除你的原始简历。'))return;
  setBusy(true);setError('');setNotice('');
  try{
   await removeMatchHistory(id);
   setItems(rows=>rows.filter(item=>item.id!==id));
   setSelected(null);
   setNotice('匹配历史已删除；已保存的原始简历未受影响。');
   window.dispatchEvent(new Event('hhba:match-history-changed'));
  }catch(e){setError(e instanceof Error?e.message:'删除失败')}
  finally{setBusy(false)}
 }
 return <section className="hhba-account-panel hhba-match-history" aria-label="AI 匹配历史">
  <div className="hhba-account-section-heading">
   <div><h2><History size={21}/> AI 匹配历史</h2>
    <p>记录每次 AI 推荐的企业、岗位、适配分和理由；这里不是已投递申请。</p>
   </div>
   <Link to="/candidate/match">使用简历找新岗位 <ArrowRight size={15}/></Link>
  </div>
  {error&&<p className="hhba-personal-error" role="alert">{error}</p>}
  {notice&&<p className="hhba-account-notice" role="status">{notice}</p>}
  {loading?<p role="status"><LoaderCircle size={16} className="spin"/> 正在读取你的专属匹配历史…</p>:
   items.length===0?<div className="hhba-account-empty">
    <Search size={29}/><strong>还没有 AI 匹配历史</strong>
    <p>上传简历并完成一次 AI 推荐后，真实的岗位结果会自动保存到你的账户。历史记录不会被算作投递。</p>
    <Link to="/candidate/match">上传简历开始匹配</Link>
   </div>:<>
    <p className="hhba-match-history-explain">你可以随时查看上一次为什么推荐这些岗位，或使用同一份已保存的简历再次查找。只有重新完成匹配，才会产生新岗位对比；目前不会在后台自动搜索或发送通知。</p>
    {selected&&<div className="hhba-match-history-detail">
     <div className="hhba-match-history-detail-heading">
      <div><strong>本次匹配详情</strong><small>{dateLabel(selected.created_at)} · {selected.resume_label}</small></div>
      <button type="button" onClick={()=>setSelected(null)}>返回历史列表</button>
     </div>
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
       {href&&<a href={href} target="_blank" rel="noopener noreferrer">查看原招聘页面（仍需确认在招） <ArrowRight size={14}/></a>}
      </article>;
     })}
     <div className="hhba-match-history-actions">
      {selected.resume_id?<Link to={'/candidate/match?resume='+encodeURIComponent(selected.resume_id)}>用这份简历重新匹配</Link>:
       <Link to="/candidate/match">上传简历重新匹配</Link>}
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
       <button type="button" disabled={busy} title="删除记录" aria-label="删除本次匹配历史" onClick={()=>void erase(item.id)}><Trash2 size={14}/></button>
      </div>
     </article>)}
    </div>}
   </>}
  <p className="hhba-match-history-footer"><BriefcaseBusiness size={15}/> 所有记录仅对当前登录账户开放。职位可能下线，历史评分不代表录用概率。未启用自动推送。</p>
 </section>;
}
