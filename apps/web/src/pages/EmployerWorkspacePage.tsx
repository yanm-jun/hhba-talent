import {useEffect,useState,type FormEvent} from 'react';
import {ArrowRight,Building2,ClipboardCheck,FilePlus2,Search,ShieldCheck,Users,XCircle} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {api,ApiError,employerApiReady,type EmployerPosting,type EmployerPostingInput,type Organization,type TalentSearchCandidate,type User} from '../services/api';
import '../styles/employer-workspace.css';
import {EmployerApplicantPanel} from '../components/EmployerApplicantPanel';
const blank:EmployerPostingInput={title:'',description:'',requirements:'',location:'',work_mode:'onsite',recruitment_type:'SOCIAL',apply_url:''};
const messages:Record<string,string>={
 draft:'仅自己与所属企业可见',pending_review:'待平台岗位审核',published:'已公开',rejected:'审核未通过',closed:'已关闭'
};
function readable(e:unknown){if(e instanceof ApiError){if(e.status===403)return '权限不足：请先完成企业及经办人认证，等待审核和招聘服务权限开放。';if(e.status===404)return '无权访问此企业的数据，请检查企业身份。';if(e.status===429)return '企业人才检索今日次数已用完。';return e.message;}return '当前服务暂不可用，请稍后再试。'}
function rawId(id:string){return id.replace(/^employer-/,'')}
export function EmployerWorkspacePage({user}:{user:User|null}){
 const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [oid,setOid]=useState('');
 const [postings,setPostings]=useState<EmployerPosting[]>([]);
 const [form,setForm]=useState<EmployerPostingInput>(blank);
 const [editing,setEditing]=useState<string|null>(null);
 const [tab,setTab]=useState<'jobs'|'talent'|'applications'>('jobs');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [search,setSearch]=useState({keywords:'',skills:'',industry:'',region:'',work_mode:'',min:'',max:''});
 const [results,setResults]=useState<TalentSearchCandidate[]>([]);
 const [page,setPage]=useState(1);
 const [hasMore,setHasMore]=useState(false);
 const [searched,setSearched]=useState(false);
 const organization=organizations.find(o=>o.id===oid);
 useEffect(()=>{if(!user||!employerApiReady)return;let cancelled=false;api.organizations().then(r=>{if(cancelled)return;setOrganizations(r.organizations);setOid(r.organizations[0]?.id||'')}).catch(e=>{if(!cancelled)setNotice(readable(e))}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[user]);
 useEffect(()=>{if(!oid||!employerApiReady){setPostings([]);return}let cancelled=false;setNotice('');setResults([]);setSearched(false);api.postings(oid).then(r=>{if(!cancelled)setPostings(r.items)}).catch(e=>{if(!cancelled)setNotice(readable(e))});return()=>{cancelled=true}},[oid]);
 async function refresh(){if(!oid)return;const r=await api.postings(oid);setPostings(r.items)}
 async function save(e:FormEvent){e.preventDefault();if(!employerApiReady){setNotice('当前为静态预览，企业业务服务器未连接，无法保存岗位。');return}if(!oid)return;setBusy(true);setNotice('');
  try{
   if(editing)await api.updatePosting(oid,editing,form);else await api.createPosting(oid,form);
   await refresh();setForm(blank);setEditing(null);setNotice('岗位草稿已私密保存。只有认证完成并经平台审核后才能公开。');
  }catch(e){setNotice(readable(e))}finally{setBusy(false)}
 }
 async function action(post:EmployerPosting,command:'submit'|'close'){
  if(!oid)return;setBusy(true);setNotice('');
  try{
   if(command==='submit')await api.submitPosting(oid,rawId(post.id));else await api.closePosting(oid,rawId(post.id));
   await refresh();setNotice(command==='submit'?'已提交岗位审核，尚未对外公开。':'岗位已关闭，公开页面将不再展示。');
  }catch(e){setNotice(readable(e))}finally{setBusy(false)}
 }
 function change<K extends keyof EmployerPostingInput>(key:K,value:EmployerPostingInput[K]){setForm(prev=>({...prev,[key]:value}))}
 function edit(post:EmployerPosting){setEditing(post.id);setForm({title:post.title,description:post.description,requirements:post.requirements,location:post.location,work_mode:post.work_mode,recruitment_type:post.recruitment_type,apply_url:post.apply_url});setTab('jobs');window.scrollTo({top:0,behavior:'smooth'})}
 async function findTalents(nextPage=1){
  if(!employerApiReady){setNotice('当前是界面预览，认证企业人才搜索尚未上线。');return}if(!oid)return;
  const parsedSkills=search.skills.split(/[，,、]/).map(s=>s.trim()).filter(Boolean).slice(0,8);
  if(!search.keywords.trim()&&!parsedSkills.length&&!search.industry.trim()&&!search.region.trim()&&!search.work_mode&&search.min===''&&search.max===''){
   setNotice('请至少填写关键词、技能或一项筛选条件。');return;
  }
  if(search.min!==''&&search.max!==''&&Number(search.min)>Number(search.max)){setNotice('最低工作年限不能大于最高年限。');return}
  setBusy(true);setNotice('');try{
   const r=await api.talentSearch(oid,{keywords:search.keywords.trim()||undefined,skills:parsedSkills,industry:search.industry.trim()||undefined,region:search.region.trim()||undefined,work_mode:search.work_mode||undefined,work_years_min:search.min===''?undefined:Number(search.min),work_years_max:search.max===''?undefined:Number(search.max),page:nextPage,page_size:10});
   setResults(r.items);setPage(r.page);setHasMore(r.has_more);setSearched(true);
  }catch(e){setResults([]);setHasMore(false);setSearched(false);setNotice(readable(e))}finally{setBusy(false)}
 }
 if(!user&&employerApiReady){navigate('/recruiter/login?next='+encodeURIComponent('/employer/workspace'));return null}
 return <Shell user={user}><main className="employer-workspace">
  <div className="employer-ws-top"><span className="page-kicker">HHBA 企业招聘工作台</span><h1>发布真实岗位，寻找已授权的人才。</h1>
   <p>先完成企业主体和招聘经办人认证。岗位需经平台审核才会对外发布，人才搜索只返回明确同意企业检索的候选人。</p></div>
  {!employerApiReady&&<section className="employer-ws-offline" role="status"><ShieldCheck size={20}/><div><strong>企业功能预览版 · 暂未连接正式业务服务器</strong><p>现在可以查看企业认证、岗位发布、人才检索的页面结构；真实提交、人工审核和授权人才数据查询尚未开放。不会生成模拟数据。</p></div></section>}
  <div className="employer-ws-company"><Building2 size={20}/><label>当前企业
   <select value={oid} onChange={e=>setOid(e.target.value)} disabled={loading}>{organizations.length?organizations.map(o=><option key={o.id} value={o.id}>{o.legal_name}</option>):<option value="">暂未创建企业组织</option>}</select></label>
   <span className="employer-ws-status">{!employerApiReady?'企业资料未连接':organization?.status==='approved'?'企业组织已审核':'企业组织尚未审核通过'}</span>
   <Link to="/recruiter/onboarding">办理或查看企业认证 <ArrowRight size={14}/></Link>
   {user?.role==='admin'&&<Link to="/admin/employer-review">进入管理员审核台 →</Link>}
  </div>
  {!oid&&employerApiReady&&<section className="employer-ws-empty"><ShieldCheck size={24}/><h2>先完成企业主体信息</h2><p>企业招聘经办人先注册、提交营业执照和招聘授权材料，审核通过后才能提交公开职位及检索授权人才。</p><Link to="/recruiter/onboarding">开始认证企业 →</Link></section>}
  {(oid||!employerApiReady)&&<>
   <nav className="employer-ws-tabs" aria-label="企业工作台功能">
    <button className={tab==='jobs'?'active':''} onClick={()=>setTab('jobs')}><FilePlus2 size={17}/> 岗位发布与管理</button>
    <button className={tab==='talent'?'active':''} onClick={()=>setTab('talent')}><Users size={17}/> 授权人才搜索</button>
    <button className={tab==='applications'?'active':''} onClick={()=>setTab('applications')}><ClipboardCheck size={17}/> 收到的求职申请</button>
   </nav>
   {notice&&<p role="status" className="employer-ws-notice">{notice}</p>}
   {tab==='jobs'?<div className="employer-ws-layout">
    <form className="employer-ws-card employer-ws-editor" onSubmit={save}>
     <div className="employer-ws-card-heading"><FilePlus2 size={19}/><div><h2>{editing?'修改岗位草稿':'发布一条招聘岗位'}</h2><p>所有信息均为企业自行填写，未经审核不会出现在招聘市场。</p></div></div>
     <label>岗位名称<input required minLength={3} maxLength={160} value={form.title} onChange={e=>change('title',e.target.value)} placeholder="例如：新能源汽车区域销售经理"/></label>
     <div className="employer-ws-two"><label>招聘地点<input required minLength={2} maxLength={120} value={form.location} onChange={e=>change('location',e.target.value)} placeholder="例如：山东济南"/></label>
      <label>工作方式<select value={form.work_mode} onChange={e=>change('work_mode',e.target.value as EmployerPostingInput['work_mode'])}><option value="onsite">线下办公</option><option value="hybrid">混合办公</option><option value="remote">远程办公</option></select></label></div>
     <label>招聘类型<select value={form.recruitment_type} onChange={e=>change('recruitment_type',e.target.value as EmployerPostingInput['recruitment_type'])}><option value="SOCIAL">社会招聘</option><option value="CAMPUS">校园招聘 / 应届</option><option value="INTERNSHIP">实习招聘</option></select></label>
     <label>岗位职责<textarea required minLength={40} maxLength={8000} rows={5} value={form.description} onChange={e=>change('description',e.target.value)} placeholder="填写真实职责，不得伪造工作地点、薪资或招聘主体。"/></label>
     <label>任职要求<textarea required minLength={20} maxLength={8000} rows={5} value={form.requirements} onChange={e=>change('requirements',e.target.value)} placeholder="明确学历、经验、技能、证书等确实需要的条件。"/></label>
     <label>官方投递地址<input required type="url" minLength={12} maxLength={1000} pattern="https://.*" value={form.apply_url} onChange={e=>change('apply_url',e.target.value)} placeholder="https://careers.example.com/job/123"/></label>
     <div className="employer-ws-actions"><button className="primary-button" disabled={!employerApiReady||!oid||busy}>{busy?'正在保存…':employerApiReady?'保存私密岗位草稿':'待连接企业 API 后开放保存'}</button>{editing&&<button type="button" className="text-button" onClick={()=>{setEditing(null);setForm(blank)}}>取消编辑</button>}</div>
    </form>
    <section className="employer-ws-card">
     <div className="employer-ws-card-heading"><ClipboardCheck size={19}/><div><h2>企业岗位列表</h2><p>草稿 → 平台审核 → 公开发布 → 到期或关闭</p></div></div>
     {postings.length===0?<p className="employer-ws-muted">暂无岗位。保存第一条招聘草稿后，它会出现在这里。</p>:postings.map(p=><article className="employer-ws-job" key={p.id}><div><strong>{p.title}</strong><span>{p.location} · {p.recruitment_type==='SOCIAL'?'社招':p.recruitment_type==='CAMPUS'?'校招':'实习'}</span><small>{messages[p.status]||p.status}</small></div>
      {p.review_reason&&<p>审核备注：{p.review_reason}</p>}
      <div className="employer-ws-actions">
       {(p.status==='draft'||p.status==='rejected')&&<><button disabled={busy} onClick={()=>edit(p)}>编辑</button><button disabled={busy} onClick={()=>void action(p,'submit')}>提交审核</button></>}
       {p.status!=='closed'&&<button disabled={busy} onClick={()=>void action(p,'close')}><XCircle size={13}/> 关闭</button>}
      </div></article>)}
    </section>
   </div>:tab==='applications'?<EmployerApplicantPanel oid={oid} postings={postings}/>:<section className="employer-ws-card employer-ws-search">
    <div className="employer-ws-card-heading"><Search size={19}/><div><h2>只搜索已授权的求职者</h2><p>需要企业、招聘经办人和组织权限全部有效。求职者撤回授权后不能继续被搜索；原始简历和联系方式不会展示。</p></div></div>
    <form onSubmit={e=>{e.preventDefault();void findTalents(1)}} className="employer-ws-filters">
     <label>关键词<input maxLength={200} value={search.keywords} onChange={e=>setSearch({...search,keywords:e.target.value})} placeholder="例如：新能源汽车门店运营"/></label>
     <label>专业技能（最多 8 项，逗号分隔）<input value={search.skills} onChange={e=>setSearch({...search,skills:e.target.value})} placeholder="例如：销售培训、客户管理"/></label>
     <label>行业<input value={search.industry} onChange={e=>setSearch({...search,industry:e.target.value})} placeholder="例如：新能源汽车"/></label>
     <label>地区<input value={search.region} onChange={e=>setSearch({...search,region:e.target.value})} placeholder="例如：山东"/></label>
     <label>工作方式<select value={search.work_mode} onChange={e=>setSearch({...search,work_mode:e.target.value})}><option value="">全部</option><option value="全职">全职</option><option value="远程">远程</option><option value="短期项目">短期项目</option></select></label>
     <div className="employer-ws-two"><label>最少工作年限<input type="number" min="0" max="80" value={search.min} onChange={e=>setSearch({...search,min:e.target.value})}/></label><label>最多工作年限<input type="number" min="0" max="80" value={search.max} onChange={e=>setSearch({...search,max:e.target.value})}/></label></div>
     <button className="primary-button" disabled={!employerApiReady||!oid||busy}>{busy?'正在授权检索…':employerApiReady?'检索符合条件的人才':'待企业业务服务上线后开放检索'}</button>
    </form>
    {searched&&<div className="employer-ws-results"><h3>授权检索结果 · 当前第 {page} 页</h3>{results.length===0?<p className="employer-ws-muted">没有符合当前条件且授权企业检索的候选人。请调整筛选，不能扩大至未授权简历。</p>:results.map(candidate=><article className="employer-ws-person" key={candidate.candidate_ref}>
      <strong>{candidate.display_name||'已授权候选人'}</strong><span>{candidate.headline||'暂未提供职业简介'}</span>
      <div>{candidate.skills.slice(0,8).map(skill=><small key={skill}>{skill}</small>)}</div>
      <p>{candidate.location||'地区未披露'} · 工作经验：{candidate.work_years===null?'未披露':candidate.work_years+' 年'}</p>
      <p>命中条件：{candidate.match_reasons.map(x=>String(x.value)).join('、')||'由筛选条件命中'}</p>
     </article>)}
     <div className="employer-ws-actions"><button disabled={busy||page<=1} onClick={()=>void findTalents(page-1)}>上一页</button><button disabled={busy||!hasMore} onClick={()=>void findTalents(page+1)}>下一页</button></div>
    </div>}
   </section>}
  </>}
 </main></Shell>
}
