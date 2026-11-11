import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,BookOpen,CarFront,GraduationCap,Search,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/career-library-preview.css';

type Major={major_code:string;display_name:string};
type LibraryRole={role_id:string;display_name:string;keyword_examples:string;route_type:string;requires_skill_evidence:boolean};
type LibrarySection={section_id:string;display_name:string;sort_order:number};
type Employer={id:string;name:string;official_company_url:string;recruitment_base_url:string;
 membership_type:'PRIMARY'|'SECONDARY';section_id:string|null;section_name:string|null;
 documented_business_role_scope:boolean;position_status:'NOT_CHECKED';advisory:string};
type LibraryResponse={ok:true;hall:{display_name:string};major:Major|null;major_options:Major[];
 roles:LibraryRole[];sections:LibrarySection[];employers:Employer[];employer_count:number;
 selected_role:string;note:string};

const safeUrl=(value:string)=>{try{
 const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&
 !u.port&&u.hostname.includes('.')?u.href:null;
}catch{return null;}};

export function AutomotiveLibraryPage({user}:{user:User|null}){
 const [major,setMajor]=useState('');
 const [role,setRole]=useState('');
 const [section,setSection]=useState('');
 const [data,setData]=useState<LibraryResponse|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const abort=new AbortController();
  setLoading(true);setError('');
  const params=new URLSearchParams();
  if(major)params.set('major',major);
  if(role)params.set('role',role);
  const suffix=params.toString()?'?'+params:'';
  fetch('/api/career-library/automotive'+suffix,{signal:abort.signal,credentials:'same-origin'})
   .then(async r=>{const body=await r.json() as LibraryResponse&{error?:string};
    if(!r.ok||!body.ok)throw new Error(body.error||'暂时无法打开汽车馆');
    return body;})
   .then(value=>setData(value))
   .catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'加载失败');})
   .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return ()=>abort.abort();
 },[major,role]);
 const visible=useMemo(()=>!section?data?.employers||[]:(data?.employers||[]).filter(e=>e.section_id===section),[data,section]);
 const activeRoles=data?.roles||[];
 return <Shell user={user}>
  <div className="hhba-library-page">
   <nav className="hhba-library-crumb" aria-label="所在位置">
    <Link to="/companies">企业目录</Link><span>/</span><span>汽车与智能出行馆</span>
   </nav>
   <header className="hhba-library-hero">
    <span className="hhba-library-eyebrow"><BookOpen size={15}/> HHBA 招聘资源图书馆 · Preview 样板馆</span>
    <h1><CarFront size={30}/> 汽车与智能出行馆</h1>
    <p>先按专业查找可探索的岗位方向，再进入对应企业官方招聘系统。集团只建一份档案，汽车、电子、软件等业务可跨馆关联。</p>
    <span className="hhba-library-verified"><ShieldCheck size={16}/> 已审核招聘来源 · 不代表岗位当前在招</span>
   </header>
   <section className="hhba-library-filter" aria-label="专业导航">
    <h2><GraduationCap size={21}/> 按专业导航</h2>
    <div className="hhba-library-inputs">
     <label>你的大学专业
      <select value={major} onChange={event=>{setMajor(event.target.value);setRole('');}} aria-label="大学专业">
       <option value="">先查看全部专业方向</option>
       {(data?.major_options||[]).map(m=><option key={m.major_code} value={m.major_code}>{m.display_name}</option>)}
      </select>
     </label>
     <label>希望探索的岗位方向
      <select value={role} onChange={event=>setRole(event.target.value)} aria-label="岗位方向">
       <option value="">按专业自动推荐方向</option>
       {activeRoles.map(r=><option key={r.role_id} value={r.role_id}>{r.display_name}</option>)}
      </select>
     </label>
    </div>
    {data?.major&&<div className="hhba-library-role-list" aria-label="专业可探索岗位方向">
     <p>「{data.major.display_name}」可先考虑以下方向，跨专业岗位还需看真实任职条件：</p>
     <div>{data.roles.map((r,i)=><button key={r.role_id} type="button"
      className={role===r.role_id||(!role&&i===0)?'is-selected':''}
      onClick={()=>setRole(r.role_id)}>{r.display_name}{r.requires_skill_evidence?' · 需技能支持':''}</button>)}</div>
    </div>}
    <p className="hhba-library-notice">专业只决定优先搜索路线，不是硬性限制。会计、法学、传媒等专业，也可以在汽车企业寻找对应部门岗位。</p>
   </section>
   <section className="hhba-library-sections" aria-label="汽车馆区域">
    <h2>汽车馆的细分区域</h2>
    <div className="hhba-library-tabs">
     <button type="button" className={!section?'is-selected':''} onClick={()=>setSection('')}>全部区域</button>
     {(data?.sections||[]).map(s=><button type="button" key={s.section_id}
      className={section===s.section_id?'is-selected':''} onClick={()=>setSection(s.section_id)}>{s.display_name}</button>)}
    </div>
   </section>
   <section className="hhba-library-employers" aria-live="polite">
    <div className="hhba-library-results-title">
     <h2><Search size={19}/> 企业官方招聘入口</h2>
     <span>{loading?'载入中…':error?'暂不可用':`当前 ${visible.length} 家关联企业`}</span>
    </div>
    {error&&<p role="alert" className="hhba-library-error">{error}。此分类馆目前仅在 Preview 验收开放。</p>}
    {!loading&&!error&&visible.length===0&&<p>该区域暂无已核验企业来源，可以查看其他区域。</p>}
    <div className="hhba-library-cards">
     {!loading&&!error&&visible.map(e=>{
      const u=safeUrl(e.recruitment_base_url);
      return <article className="hhba-library-company" key={e.id}>
       <div className="hhba-library-company-meta">
        <strong>{e.name}</strong>
        <span>{e.membership_type==='PRIMARY'?'主营业务关联':'跨业务关联'}</span>
       </div>
       <p>{e.section_name||'汽车业务关联'} · 官方招聘入口来源已核验</p>
       {e.documented_business_role_scope&&<p className="hhba-library-scope">已记录此业务方向的搜索线索，仍需验证是否有岗位</p>}
       {u?<a href={u} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true"
        aria-label={`查看 ${e.name} 官方招聘入口`}>查看企业招聘系统 <ArrowUpRight size={16}/></a>:
        <span>暂未提供可安全跳转的招聘入口</span>}
      </article>;
     })}
    </div>
   </section>
   <footer className="hhba-library-disclaimer">
    <p>以上是行业与专业导航，不是招聘岗位列表；企业可能包含财务、法务、运营、研发等不同部门，具体岗位以官网实际招聘详情为准。</p>
    <Link to="/candidate/match">上传简历，让 DeepSeek 结合经历搜索真实岗位</Link>
   </footer>
  </div>
 </Shell>;
}
export default AutomotiveLibraryPage;
