import {useState} from 'react';
import {Search, ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {DomesticCompanyResults} from '../components/DomesticCompanyResults';
import {MAJORS} from '../services/domesticMajors';
import type {User} from '../services/api';
import '../styles/domestic-company-search.css';

/**
 * Preview-only landing page. Production homepage is unchanged:
 * App routes here only when VITE_COMPANY200_STATIC_PREVIEW=1.
 * It uses the exact company cards, search, major relation and profile routes from HHBA.
 */
export function Company200PreviewPage({user}:{user:User|null}){
 const [query,setQuery]=useState('');
 const [majorSlug,setMajorSlug]=useState('');
 return <Shell user={user}>
  <main className="domestic-editorial-panel" style={{maxWidth:1200,margin:'1.5rem auto',padding:'1.5rem'}}>
   <header style={{marginBottom:24}}>
    <small style={{letterSpacing:'.1em',fontWeight:700}}>HHBA · 企业发现</small>
    <p style={{margin:'8px 0'}}><Link to="/candidate/jobs" style={{fontSize:13,color:'#265e45',textDecoration:'none'}}>← 返回原招聘市场（OpenAI / Anthropic / SpaceX 等）</Link></p>
    <h1 style={{fontSize:'clamp(1.75rem,3vw,2.7rem)',margin:'10px 0'}}>发现 200 家企业，探索更多职业可能</h1>
    <p style={{color:'var(--muted,#64748b)',maxWidth:850,lineHeight:1.8}}>
     已接入原 HHBA 企业搜索、专业匹配和详情页。原有 100 家 + 新增 100 家，按企业主体浏览。
     这是供功能与内容验收的静态预览，不代表所有招聘渠道、Logo、企业照片和岗位已完成核验。
    </p>
   </header>
   <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:20}}>
    <label style={{flex:'2 1 280px',display:'flex',alignItems:'center',gap:8,padding:'11px 14px',border:'1px solid #cbd5e1',borderRadius:12}}>
     <Search size={18} aria-hidden="true"/>
     <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="输入企业名称、行业或关键词" aria-label="搜索200家企业"
      style={{width:'100%',minWidth:0,border:'none',background:'transparent',font:'inherit',outline:'none'}}/>
    </label>
    <label style={{flex:'1 1 220px',display:'flex',alignItems:'center',gap:8,padding:'11px 14px',border:'1px solid #cbd5e1',borderRadius:12}}>
     <span style={{whiteSpace:'nowrap'}}>所学专业</span>
     <select aria-label="选择专业" value={majorSlug} onChange={e=>setMajorSlug(e.target.value)}
      style={{width:'100%',minWidth:0,border:'none',background:'transparent',font:'inherit',color:'inherit'}}>
      <option value="">全部专业</option>
      {MAJORS.map(m=><option key={m.slug} value={m.slug}>{m.name}</option>)}
     </select>
    </label>
   </div>
   <p style={{display:'flex',alignItems:'center',gap:7,fontSize:13,marginBottom:12,color:'var(--muted,#64748b)'}}>
    <ShieldCheck size={15} aria-hidden="true"/> 仅展示企业业务与专业的参考关联；实际招聘请到企业官方页面核对，待核验资料已明确标注。
   </p>
   <DomesticCompanyResults query={query} majorSlug={majorSlug} browseDefault/>
  </main>
 </Shell>;
}
