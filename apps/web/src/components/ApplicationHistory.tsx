import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {BriefcaseBusiness,CheckCircle2,Clock3,RefreshCcw,Trash2,ExternalLink} from 'lucide-react';
import {Link} from '../router';
import {applyAccountAvailable,deleteMyApplication,listMyApplications,saveManualApplication,type ApplicationRecord} from '../services/applyCredits';
import '../styles/application-history.css';

const labels={
 pending:'待确认',confirmed:'页面显示投递成功',manual:'自行标记已投递'
} as const;
function safeLink(raw:string){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}
}
export function ApplicationHistory(){
 const [items,setItems]=useState<ApplicationRecord[]>([]);
 const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [company,setCompany]=useState('');
 const [position,setPosition]=useState('');
 const [link,setLink]=useState('');
 const [status,setStatus]=useState<'pending'|'manual'>('pending');
 const [filter,setFilter]=useState<'all'|'pending'|'confirmed'|'manual'>('all');
 const refresh=async()=>{
  if(!applyAccountAvailable){setNotice('当前预览环境尚未接入求职记录数据库。');setLoading(false);return}
  try{setItems(await listMyApplications())}
  catch(e){setNotice(e instanceof Error?e.message:'无法读取记录')}
  finally{setLoading(false)}
 };
 useEffect(()=>{void refresh()},[]);
 const counts=useMemo(()=>({
  confirmed:items.filter(x=>x.status==='confirmed').length,
  pending:items.filter(x=>x.status==='pending').length,
  manual:items.filter(x=>x.status==='manual').length
 }),[items]);
 const visible=filter==='all'?items:items.filter(x=>x.status===filter);
 const add=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;setBusy(true);setNotice('');
  try{
   await saveManualApplication({company,position,applicationUrl:link,status});
   await refresh();setCompany('');setPosition('');setLink('');
   setNotice('已保存到本人账户。人工补充不会标记为“插件观察到成功”。');
  }catch(err){setNotice(err instanceof Error?err.message:'保存失败')}
  finally{setBusy(false)}
 };
 const remove=async(id:string)=>{
  if(busy||!window.confirm('确认删除这条投递记录吗？删除后无法撤销。'))return;
  setBusy(true);
  try{await deleteMyApplication(id);setItems(rows=>rows.filter(x=>x.id!==id));setNotice('已删除所选投递记录。')}
  catch(err){setNotice(err instanceof Error?err.message:'删除失败')}
  finally{setBusy(false)}
 };
 return <section className="hhba-account-panel hhba-application-history" aria-label="我的投递记录">
  <div className="hhba-account-section-heading"><div><h2>我的求职投递</h2>
   <p>仅展示真实保存到本人账号的记录；没有记录不代表从未申请。</p></div>
   <button className="hhba-application-refresh" type="button" disabled={busy||loading} onClick={()=>void refresh()}><RefreshCcw size={15}/>刷新</button>
  </div>
  <div className="hhba-application-stats">
   <div><CheckCircle2 size={18}/><strong>{counts.confirmed}</strong><small>页面成功提示</small></div>
   <div><Clock3 size={18}/><strong>{counts.pending}</strong><small>待确认</small></div>
   <div><BriefcaseBusiness size={18}/><strong>{counts.manual}</strong><small>人工补充</small></div>
  </div>
  <p className="hhba-application-tip">“页面成功提示”来自用户授权后的插件观察，仍不能保证企业已收到或通过审核；“人工补充”不冒充插件核验。插件暂未上传的本地记录需在插件内主动同步。</p>
  <div className="hhba-application-filters">
   {(['all','confirmed','pending','manual'] as const).map(x=><button type="button" key={x}
    onClick={()=>setFilter(x)} aria-pressed={filter===x} className={filter===x?'active':''}>
    {x==='all'?'全部记录':labels[x]}</button>)}
  </div>
  {notice&&<p className="hhba-application-notice" role="status">{notice}</p>}
  {loading?<p role="status">正在读取当前账户的真实投递记录…</p>:
   visible.length===0?<div className="hhba-account-empty"><BriefcaseBusiness size={25}/>
    <strong>{filter==='all'?'尚未记录求职投递':'此状态暂无记录'}</strong>
    <p>可以在 Edge 插件中开启本次投递跟踪，或在下方手动补充。</p>
    <Link to="/candidate/jobs">浏览职位</Link></div>:
   <div className="hhba-application-items">{visible.map(x=><article key={x.id}>
    <div className="hhba-application-details"><strong>{x.company} · {x.position}</strong>
     <span className={'hhba-application-state '+x.status}>{labels[x.status]}</span>
     <small>{x.source==='edge'?'Edge 插件记录':'本人手动补充'} · 记录于 {x.recordedAt.replace('T',' ').slice(0,16)}</small>
     {safeLink(x.applicationUrl)&&<a href={safeLink(x.applicationUrl)||undefined} target="_blank" rel="noopener noreferrer nofollow">
      打开原申请页面 <ExternalLink size={13}/></a>}
    </div><button type="button" className="hhba-application-delete" disabled={busy}
     title="删除投递记录" onClick={()=>void remove(x.id)}><Trash2 size={16}/>删除</button>
   </article>)}</div>}
  <form onSubmit={e=>void add(e)} className="hhba-application-manual">
   <h3>手动补充投递记录</h3>
   <p>适合手机、其他浏览器或插件未识别的申请。手动记录不会被标记为系统核验成功。</p>
   <label>企业名称<input required minLength={2} maxLength={100} value={company} onChange={e=>setCompany(e.target.value)} placeholder="真实企业名称"/></label>
   <label>岗位名称<input required minLength={2} maxLength={100} value={position} onChange={e=>setPosition(e.target.value)} placeholder="职位名称"/></label>
   <label>企业申请链接<input type="url" required value={link} onChange={e=>setLink(e.target.value)} placeholder="https://...（企业官方申请页面）"/></label>
   <label>记录状态<select value={status} onChange={e=>setStatus(e.target.value as 'pending'|'manual')}>
    <option value="pending">待确认（尚无成功依据）</option>
    <option value="manual">我自行确认已投递（人工标记）</option>
   </select></label>
   <button type="submit" disabled={busy||!applyAccountAvailable}>{busy?'保存中…':'保存到我的求职记录'}</button>
  </form>
 </section>;
}
