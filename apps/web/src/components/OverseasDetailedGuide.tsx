import {useState} from 'react';
import {BookOpenText,CheckCircle2,ClipboardCheck,ExternalLink,HelpCircle,Info,ShieldAlert} from 'lucide-react';
import type {OverseasPathway} from '../data/overseasNewZealand';
import {overseasTerms} from '../data/overseasGlossary';
import '../styles/overseas-guide-v2.css';

/** Every country guide follows the same 10 chapters, but ALL factual wording is pathway-specific. */
export type GuidePoint={label:string;explain:string;action:string};
export type GuideSection={title:string;summary:string;points:GuidePoint[]};
export type GuideFAQ={question:string;answer:string};
export type GuideSource={label:string;url:string;purpose:string};
export type DetailedGuide={
  id:string;plainAnswer:string;firstAction:string;checkedAt:string;
  sections:GuideSection[];faq:GuideFAQ[];risks:string[];terms:string[];
  sources:GuideSource[];
};


export function OverseasDetailedGuide({pathway,guide}:{pathway:OverseasPathway;guide:DetailedGuide}){
 const [completed,setCompleted]=useState<string[]>([]);
 const total=guide.sections.reduce((n,s)=>n+s.points.length,0);
 const checked=completed.length;
 const toggle=(id:string)=>setCompleted(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const sectionId=(i:number)=>'overseas-v2-'+pathway.id+'-'+(i+1);
 return <div className="hhba-guide-v2" data-overseas-guide-v2={pathway.id}>
  <header className="hhba-guide-v2-intro">
   <span className="hhba-guide-v2-eyebrow"><BookOpenText size={15}/> HHBA · 出国方案详细操作指南 V2.0</span>
   <h2>先用大白话讲明白</h2>
   <p>{guide.plainAnswer}</p>
   <div className="hhba-guide-v2-start"><CheckCircle2 size={20}/><div><strong>如果现在开始准备，第一件事做什么？</strong><p>{guide.firstAction}</p></div></div>
   <small>本页政策资料核验时间：{guide.checkedAt} · 涉及个人条件与金额，提交前必须打开对应官方页面重新核验。</small>
  </header>
  <nav className="hhba-guide-v2-index" aria-label="申请指南章节导航"><strong>快速跳转到你关心的问题</strong><div>{guide.sections.map((part,i)=><a key={i} href={'#'+sectionId(i)}>{String(i+1).padStart(2,'0')} {part.title}</a>)}<a href={'#'+sectionId(8)}>09 常见问题</a><a href={'#'+sectionId(9)}>10 风险与官方来源</a></div></nav>
  <section className="hhba-guide-v2-terms" aria-label="专有名词解释">
   <h2><HelpCircle size={20}/> 看不懂专有名词？点一下就能解释</h2>
   <p>这些名称直接影响申请资格，不能凭字面意思猜。点击下方词条看中文解释。</p>
   <div className="hhba-guide-v2-termgrid">{guide.terms.map(term=><details key={term}><summary>{term} <span aria-hidden="true">＋</span></summary><p>{overseasTerms[term]||'此术语在不同签证中的含义可能不同，请以该签证官方解释为准。'}</p></details>)}</div>
  </section>
  <div className="hhba-guide-v2-check-status" aria-live="polite"><ClipboardCheck size={19}/><span>个人准备清单：已标记 <strong>{checked}/{total}</strong> 项</span><span className="hhba-guide-v2-fine">勾选仅在本次页面浏览中生效，不上传个人资料，也不代表符合签证资格。</span></div>
  {guide.sections.map((section,i)=><section className="hhba-guide-v2-section" id={sectionId(i)} key={i}>
   <header><span>{String(i+1).padStart(2,'0')}</span><div><h2>{section.title}</h2><p>{section.summary}</p></div></header>
   <div className="hhba-guide-v2-pointlist">{section.points.map((point,j)=>{const id=pathway.id+'-'+i+'-'+j;return <article key={j} className="hhba-guide-v2-point">
    <h3>{point.label}</h3>
    <p>{point.explain}</p>
    <div className="hhba-guide-v2-action"><span>怎么做</span><p>{point.action}</p></div>
    <label className="hhba-guide-v2-check"><input type="checkbox" checked={completed.includes(id)} onChange={()=>toggle(id)}/><span>我已了解这一项（不等于已经达标）</span></label>
   </article>;})}</div>
  </section>)}
  <section className="hhba-guide-v2-section" id={sectionId(8)}>
   <header><span>09</span><div><h2>普通人最常问的实际问题</h2><p>不是简单重复政策，而是说明条件不足、操作卡住时应该如何判断。</p></div></header>
   <div className="hhba-guide-v2-faq">{guide.faq.map((x,i)=><details key={i}><summary><HelpCircle size={18}/>{x.question}</summary><p>{x.answer}</p></details>)}</div>
  </section>
  <section className="hhba-guide-v2-section" id={sectionId(9)}>
   <header><span>10</span><div><h2>风险、证据来源与最后核对</h2><p>每次提交申请前都要查看官方链接，因为政策、开放时间和收费会变动。</p></div></header>
   <ul className="hhba-guide-v2-risks">{guide.risks.map((x,i)=><li key={i}><ShieldAlert size={18}/><span>{x}</span></li>)}</ul>
   <div className="hhba-guide-v2-sources"><strong>本指南所用的官方来源（点击阅读原文）</strong>{guide.sources.map((x,i)=><a href={x.url} target="_blank" rel="noopener noreferrer" key={i}><ExternalLink size={16}/><span><b>{x.label}</b><small>{x.purpose}</small></span></a>)}<a href={pathway.officialUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/><span><b>本签证官方申请主页</b><small>核对最新资格、费用、实际开放状态和正式申请入口</small></span></a></div>
   <p className="hhba-guide-v2-final"><Info size={17}/> HHBA 负责把公开规则解释清楚，不向用户作“保录取、保工作、保签证、保证移民”的承诺。官方政府部门或其授权机构拥有最终解释与审理权。</p>
  </section>
 </div>;
}
