import {ArrowRight,ArrowUpRight,BookOpen,BriefcaseBusiness,ShieldCheck} from 'lucide-react';
import {Link} from '../router';
import '../styles/home-workplace-promise.css';

// Two real, publicly readable HHBA resources. Keep the finance-report state
// transparent without presenting hypothetical funding as an accomplished result.
const resources=[
 {
  href:'/rights/knowledge',
  index:'01 / RIGHTS',
  title:'劳动权益知识库',
  summary:'从劳动合同、工资和社保，到加班、辞退与争议处理。',
  detail:'20 个专题 · 法律依据、证据准备与处理步骤',
  action:'了解劳动权益',
  Icon:BookOpen
 },
 {
  href:'/rights/guide',
  index:'02 / CAREER GUIDE',
  title:'高性价比职场指南',
  summary:'从准备求职到入职、在职、离职，让每一步更有依据。',
  detail:'200 条原创建议 · 覆盖 8 个职业阶段',
  action:'阅读职场指南',
  Icon:BriefcaseBusiness
 }
];

export function HomeWorkplacePromise(){
 return <section className="hhba-home-workplace" aria-labelledby="hhba-home-workplace-title">
  <header className="hhba-home-workplace-heading">
   <span className="hhba-home-workplace-kicker">HHBA · CAREER RESOURCES</span>
   <h2 id="hhba-home-workplace-title">让职业选择更有依据。</h2>
   <p>从职场准备到劳动权益，找到真正有用的信息。</p>
  </header>

  <div className="hhba-home-membership-card hhba-home-resources-panel" aria-label="HHBA 免费职场知识产品">
   <div className="hhba-home-resources-header">
    <div>
     <span className="hhba-home-card-kicker">KNOWLEDGE · MADE PRACTICAL</span>
     <h3>从理解问题，到找到下一步。</h3>
    </div>
    <span className="hhba-home-resources-access">免费开放</span>
   </div>
   <div className="hhba-home-resource-grid">
    {resources.map(({href,index,title,summary,detail,action,Icon})=><Link className="hhba-home-resource-card" to={href} key={href}>
     <div className="hhba-home-resource-top">
      <span className="hhba-home-resource-icon"><Icon size={21} strokeWidth={1.75} aria-hidden="true"/></span>
      <span className="hhba-home-resource-index">{index}</span>
     </div>
     <h4>{title}</h4>
     <p>{summary}</p>
     <span className="hhba-home-resource-detail">{detail}</span>
     <span className="hhba-home-resource-action">{action}<ArrowUpRight size={17} aria-hidden="true"/></span>
    </Link>)}
   </div>
   <div className="hhba-home-resources-note"><ShieldCheck size={16} aria-hidden="true"/><span>免费阅读 · 法律信息仅供一般参考，具体问题以官方规定及实际情况为准。</span></div>
  </div>

  <aside className="hhba-home-pledge" aria-labelledby="hhba-home-commitment-title">
   <div className="hhba-home-pledge-intro">
    <span className="hhba-home-card-kicker">OUR COMMITMENT · 我们的坚持</span>
    <h3 id="hhba-home-commitment-title">每一份职业选择，都值得被认真守护。</h3>
    <p>从寻找机会，到走进职场。HHBA 致力于帮助求职者理解真实信息、做出更有依据的选择，持续关注劳动者的合法权益。</p>
    <span className="hhba-home-pledge-signature">HHBA · 让机会与人才，找到彼此。</span>
   </div>
   <Link className="hhba-home-transparency-link" to="/commitment" aria-label="了解 HHBA 的坚持，进入品牌宣传墙">
    了解我们的坚持 <ArrowRight size={17} aria-hidden="true"/>
   </Link>
  </aside>
 </section>;
}
