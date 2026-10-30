import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,CheckCircle2,ChevronDown,ClipboardCheck,ExternalLink,FileCheck2,HelpCircle,Info,Landmark,MapPin,Phone,ShieldCheck,Wallet,AlertTriangle} from 'lucide-react';
import {Link} from '../../router';
import '../../styles/talent-jinan-guide-preview.css';

export type GuideStep={title:string;why:string;action:string;done:string;note?:string};
export type GuideBranch={label:string;desc:string;conditions:string[];materials:string[];warning:string};
export type OfficialContact={name:string;phone:string};
export type CompleteGuide={
 city:string;title:string;kicker:string;desc:string;support:string;unit:string;limit:string;review:string;qualityLevel?:'A'|'B'|'C';
 amounts:string[][];branches:Record<string,GuideBranch>;defaultBranch:string;
 steps:GuideStep[];checks:string[];faq:[string,string][];sources:[string,string][];
 officialUrl?:string;officialLabel:string;officialNote:string;contacts:OfficialContact[];
 contactSource?:string;otherRoute?:string;otherLabel?:string;
 listPath:string;detailPath?:string;stepPortalIndex?:number;
};
export function UnifiedPolicyGuide({data}:{data:CompleteGuide}){
 const branchKeys=Object.keys(data.branches);
 const [branch,setBranch]=useState(data.defaultBranch);
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 const [contact,setContact]=useState(data.contacts[0]?.name||'');
 const [faqQuery,setFaqQuery]=useState('');
 const [openFaq,setOpenFaq]=useState<number|null>(0);
 const active=data.branches[branch]||data.branches[branchKeys[0]];
 const progress=data.checks.filter((_,i)=>selected[String(i)]).length;
 const faq=useMemo(()=>data.faq.map(([q,a],i)=>({q,a,i})).filter(x=>(x.q+x.a).includes(faqQuery.trim())),[data.faq,faqQuery]);
 const selectedContact=data.contacts.find(c=>c.name===contact)||data.contacts[0];
 const availablePortal=Boolean(data.officialUrl);
 return <main className="jgd-page">
  <nav className="jgd-breadcrumb"><Link to="/talent-service">人才服务</Link><span>›</span><Link to={data.listPath}>{data.city}人才政策</Link><span>›</span>{data.qualityLevel==='B'?'分步办理资料 · 基础等级':data.qualityLevel==='C'?'历史或已截止资料 · 不可直接申报':'完整办理指南'}</nav>
  <header className="jgd-hero"><div className="jgd-hero-text"><span className="jgd-kicker">HHBA / {data.kicker}</span><h1>{data.title}</h1><p>{data.desc}</p>
   <div className="jgd-tags"><span>政府来源可追溯</span><span>按不同资格核对</span><span>{data.review}</span></div></div>
   <div className="jgd-hero-aside"><span>政策支持／配租规模</span><strong>{data.support}</strong><small>{data.unit}</small><span>{data.limit}</span></div>
  </header>
  <nav className="jgd-page-nav" aria-label="页面快速导航"><a href="#ug-benefit">政策标准</a><a href="#ug-conditions">申请资格</a><a href="#ug-steps">办理步骤</a><a href="#ug-checks">材料自查</a><a href="#ug-faq">常见问题</a><a href="#ug-official">官方入口</a></nav>
  <div className="jgd-layout"><div className="jgd-main">
   <section className="jgd-panel" id="ug-benefit"><div className="jgd-section-heading"><span className="jgd-section-icon"><Wallet size={18}/></span><div><h2>01 政策标准与待遇</h2><p>按真实类别与官方规则分档，不能仅按最高额推定个人待遇。</p></div></div>
    <div className="jgd-money-table"><table><thead><tr><th>适用类别／项目</th><th>待遇／租金</th><th>期限／说明</th></tr></thead><tbody>{data.amounts.map((row,i)=><tr key={i}>{row.map((value,j)=><td key={j}>{value}</td>)}</tr>)}</tbody></table></div>
    <div className="jgd-tip"><Info size={16}/><p>{data.review} 本站仅协助理解政策，不作资格认定或实时房源承诺。</p></div>
   </section>
   <section className="jgd-panel" id="ug-conditions"><div className="jgd-section-heading"><span className="jgd-section-icon"><ShieldCheck size={18}/></span><div><h2>02 申请对象与资格条件</h2><p>不同申请人的资格限制和材料清单不一样，切换后同步显示。</p></div></div>
    <div className="jgd-track-tabs" role="group" aria-label="选择申请人类型">{branchKeys.map(key=><button type="button" key={key} aria-pressed={branch===key} className={branch===key?'active':''} onClick={()=>setBranch(key)}>{data.branches[key].label}</button>)}</div>
    <div className="jgd-track-box"><h3>{active.label}</h3><p>{active.desc}</p><ul>{active.conditions.map((s,i)=><li key={i}><CheckCircle2 size={15}/><span>{s}</span></li>)}</ul>
     <div className="jgd-track-remark"><AlertTriangle size={16}/><span>{active.warning}</span></div>
    </div>
   </section>
   <section className="jgd-panel" id="ug-steps"><div className="jgd-section-heading"><span className="jgd-section-icon"><ClipboardCheck size={18}/></span><div><h2>03 申请办理指南 · {data.steps.length}个步骤</h2><p>每一步解释为什么做、具体怎么做，以及完成后如何确认。</p></div></div>
    <ol className="jgd-step-list">{data.steps.map((s,i)=><li className="jgd-step" key={i}><span className="jgd-step-index">{i+1}</span><div className="jgd-step-content"><h3>{s.title}</h3>
      <div className="jgd-step-detail"><p><strong>为什么要做</strong>{s.why}</p><p><strong>具体怎么做</strong>{s.action}</p><p><strong>完成标志</strong>{s.done}</p></div>
      {s.note&&<p className="jgd-step-note">{s.note}</p>}
      {data.officialUrl&&i===(data.stepPortalIndex??2)&&<a href={data.officialUrl} className="jgd-step-action" target="_blank" rel="noopener noreferrer">{data.officialLabel} <ArrowUpRight size={14}/></a>}
    </div></li>)}</ol>
   </section>
   <section className="jgd-panel" id="ug-checks"><div className="jgd-section-heading"><span className="jgd-section-icon"><FileCheck2 size={18}/></span><div><h2>04 申请前自查和材料准备</h2><p>勾选结果仅在当前页面保留，不上传个人资料。</p></div></div>
    <div className="jgd-progress"><span>已核对 {progress}/{data.checks.length} 项</span><div role="progressbar" aria-label="资料准备进度" aria-valuemin={0} aria-valuemax={data.checks.length} aria-valuenow={progress}><span style={{width:(progress/(data.checks.length||1)*100)+'%'}}/></div></div>
    <div className="jgd-checklist">{data.checks.map((x,i)=><label key={i}><input type="checkbox" checked={Boolean(selected[String(i)])} onChange={e=>setSelected(p=>({...p,[String(i)]:e.target.checked}))}/><span>{x}</span></label>)}</div>
    <h3 className="jgd-material-heading">{active.label} · 材料准备方向</h3><ul className="jgd-materials">{active.materials.map((s,i)=><li key={i}>{s}</li>)}</ul>
    <p className="jgd-mutedsmall">具体材料以官方原文附件和当期申报系统为准。自查完成不意味着政府审批通过。</p>
   </section>
   <section className="jgd-panel" id="ug-faq"><div className="jgd-section-heading"><span className="jgd-section-icon"><HelpCircle size={18}/></span><div><h2>05 常见问题与注意事项</h2><p>针对不同政策的真实条件整理，不机械复制其他城市的回答。</p></div></div>
    <label className="jgd-faq-search">搜索常见疑问<input type="search" value={faqQuery} onChange={e=>setFaqQuery(e.target.value)} placeholder="搜索社保、学历、材料、审核、到账……"/></label>
    <div className="jgd-faq-list">{faq.map(x=><div className="jgd-faq-item" key={x.i}><button type="button" aria-expanded={openFaq===x.i} onClick={()=>setOpenFaq(v=>v===x.i?null:x.i)}><span>{x.q}</span><ChevronDown size={16} className={openFaq===x.i?'opened':''}/></button>{openFaq===x.i&&<p>{x.a}</p>}</div>)}{!faq.length&&<p className="jgd-no-results">没有符合关键词的问题，请清空后再查看。</p>}</div>
   </section>
   <section className="jgd-panel" id="ug-official"><div className="jgd-section-heading"><span className="jgd-section-icon"><Landmark size={18}/></span><div><h2>06 官方办理入口与咨询方式</h2><p>政策原文、申报系统和联系电话分别标明来源。</p></div></div>
    <div className="jgd-portal"><div><strong>{data.officialLabel}</strong><span>{data.officialNote}</span><small>政策实际受理状态、办理按钮及审核结果以主管部门系统为准。</small></div>
     {availablePortal?<a href={data.officialUrl} target="_blank" rel="noopener noreferrer">进入官方渠道 <ExternalLink size={14}/></a>:<span>官方申报入口待核验</span>}</div>
    {selectedContact&&<><label className="jgd-district"><MapPin size={15}/> 选择咨询部门
      <select value={selectedContact.name} onChange={e=>setContact(e.target.value)}>{data.contacts.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
      <div className="jgd-contact"><div><span>{selectedContact.name} · 公开联系电话</span><strong>{selectedContact.phone}</strong><small>服务时间和接通情况需以主管部门为准。</small></div><a href={'tel:'+selectedContact.phone}><Phone size={15}/>拨打电话</a></div>
      {data.contactSource&&<a className="jgd-inline-ref" href={data.contactSource} target="_blank" rel="noopener noreferrer">查看官方电话出处 <ArrowUpRight size={14}/></a>}</>}
    {data.contacts.length===0&&<p className="jgd-portal-warning"><AlertTriangle size={14}/> 未核实可公开的咨询电话，请以政府政策原文内的经办机构为准。</p>}
    <div className="jgd-sources"><h3>官方依据与重要附件</h3>{data.sources.map(([title,url],i)=><a key={i} target="_blank" rel="noopener noreferrer" href={url}>{title}<ArrowUpRight size={13}/></a>)}</div>
   </section>
  </div><aside className="jgd-side"><div className="jgd-side-card"><span>办理重点</span><h3>先核实本人资格，再按官方步骤申请</h3><p>{data.review}</p>{data.officialUrl&&<a href={data.officialUrl} target="_blank" rel="noopener noreferrer">官方办理入口 <ArrowUpRight size={13}/></a>}</div>
   <div className="jgd-side-card"><span>资料质量</span><p>本页依据官方公开资料编排办事步骤。资料内容与政府最终资格认定有别，是否获得V5.1 A级认证以政策列表的质量标识为准。</p>{data.otherRoute&&<Link to={data.otherRoute}>{data.otherLabel||'查看同城其他政策'} <ArrowRight size={13}/></Link>}
     {data.detailPath&&<Link to={data.detailPath}>查看原始政策记录 <ArrowRight size={13}/></Link>}</div></aside></div>
  <footer className="jgd-footer"><Link to={data.listPath}><ArrowLeft size={14}/> 返回{data.city}政策列表</Link><span>HHBA · 资料整理由官方原文核对，不替代政府经办审核</span></footer>
 </main>;
}
