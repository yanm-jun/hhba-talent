import { ArrowUpRight, BriefcaseBusiness, UsersRound } from 'lucide-react';
import { Link } from '../router';
import { Shell } from '../components/Shell';
import { UnifiedJobMarket } from '../components/UnifiedJobMarket';
import { CuratedJobMarket } from '../components/CuratedJobMarket';
import { HomeCompanyMarquee } from '../components/HomeCompanyMarquee';
import { navigate } from '../router';
import type { User } from '../services/api';

function EntryCard({ kind, title, body, footer }: { kind: 'candidate' | 'employer'; title: string; body: string; footer: string }) {
  const offline=import.meta.env.VITE_HHBA_CURATED_STATIC==='1';
  const Icon = kind === 'candidate' ? BriefcaseBusiness : UsersRound;
  return <button className="entry-card" onClick={() => navigate(kind === 'candidate' ? (offline?'/candidate/jobs':'/candidate') : '/recruiter/register')}><span className="entry-icon"><Icon size={23} /></span><strong>{title}</strong><small>{body}</small><span className="entry-footer">{footer}<ArrowUpRight size={15} /></span></button>;
}
export function HomePage({ user }: { user: User | null }) { return <Shell user={user}><section className="home-hero"><h1>让机会与人才，找到彼此。</h1><p>你来到这里，是为了什么？</p></section><section className="entry-grid" aria-label="选择使用入口"><EntryCard kind="candidate" title="我要应聘" body="搜索国内外企业官方岗位，按关键词、城市和招聘类型筛选，直接查看企业招聘信息，无需先上传简历。" footer="进入统一岗位市场" /><EntryCard kind="employer" title="我要招人" body="描述用人需求，完成企业与经办人认证后，再使用经过授权的人才检索功能。" footer="进入招聘方入口" /></section><div className="home-match-promo"><div><strong>你也可以上传简历，让 HHBA 帮你找合适岗位</strong><p>全平台统一提供 DeepSeek，匹配官方招聘岗位，分析符合条件和能力差距。</p></div><button type="button" onClick={()=>navigate("/candidate/match")}>使用简历智能匹配 <ArrowUpRight size={16}/></button></div>{import.meta.env.VITE_HHBA_CURATED_STATIC==='1'?<CuratedJobMarket compact/>:<UnifiedJobMarket compact/>}<section className="home-company-discover-link" style={{maxWidth:1120,margin:'0 auto 32px',padding:'20px 22px',background:'#fff',border:'1px solid var(--line)',borderRadius:12,display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:14}}><div><strong>企业发现 · 200 家国内企业</strong><p style={{color:'var(--muted)',fontSize:13,margin:'7px 0 0'}}>按企业名称、行业和所学专业了解企业与官方招聘渠道，资料状态逐项标注。</p></div><Link to="/companies/discover" style={{display:'inline-flex',alignItems:'center',gap:7,color:'#265e45',fontSize:13,fontWeight:700,textDecoration:'none'}}>探索 200 家企业 <ArrowUpRight size={15}/></Link></section><HomeCompanyMarquee/></Shell>; }
