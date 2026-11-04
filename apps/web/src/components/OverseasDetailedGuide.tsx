import {useState} from 'react';
import {ExternalLink} from 'lucide-react';
import type {OverseasPathway} from '../data/overseasNewZealand';
import {overseasTerms} from '../data/overseasGlossary';
import {OverseasOccupationDirectory} from './OverseasOccupationDirectory';
import {JapanOccupationDirectory,type JapanOccupationTrack} from './JapanOccupationDirectory';
import {GermanyOccupationDirectory,type GermanyOccupationTrack} from './GermanyOccupationDirectory';
import '../styles/overseas-guide-v2.css';

/** Shared editorial reader: keep the practical content without card and checklist clutter. */
export type GuidePoint={label:string;explain:string;action:string};
export type GuideSection={title:string;summary:string;points:GuidePoint[]};
export type GuideFAQ={question:string;answer:string};
export type GuideSource={label:string;url:string;purpose:string};
export type DetailedGuide={
 id:string;plainAnswer:string;firstAction:string;checkedAt:string;
 sections:GuideSection[];faq:GuideFAQ[];risks:string[];terms:string[];
 sources:GuideSource[];
};

function InlineTerms({value,terms,openTerm,onToggle}:{value:string;terms:string[];openTerm:string|null;onToggle:(term:string)=>void}){
 const candidates=terms.filter(t=>overseasTerms[t]&&value.includes(t)).sort((a,b)=>b.length-a.length);
 if(!candidates.length)return <>{value}</>;
 const re=new RegExp('('+candidates.join('|')+')','g');
 const once=new Set<string>();
 return <>{value.split(re).map((chunk,i)=>{
  if(!candidates.includes(chunk)||once.has(chunk))return <span key={i}>{chunk}</span>;
  once.add(chunk);
  return <span className="hhba-guide-inline-term-wrap" key={i}>
   <button className="hhba-guide-inline-term" type="button" aria-expanded={openTerm===chunk}
    aria-label={'解释术语：'+chunk} onClick={()=>onToggle(chunk)}>{chunk}</button>
   {openTerm===chunk&&<span className="hhba-guide-inline-term-note" role="note"><strong>{chunk}</strong>{overseasTerms[chunk]}</span>}
  </span>;
 })}</>;
}

export function OverseasDetailedGuide({pathway,guide}:{pathway:OverseasPathway;guide:DetailedGuide}){
 const [openTerm,setOpenTerm]=useState<string|null>(null);
 const [tocOpen,setTocOpen]=useState(false);
 const toggle=(term:string)=>setOpenTerm(t=>t===term?null:term);
 const sectionId=(index:number)=>'overseas-guide-'+pathway.id+'-'+(index+1);
 const japanTrack=(['jp-ssw1','jp-ssw2','jp-engineer'].includes(pathway.id)?pathway.id:null) as JapanOccupationTrack|null;
 const germanyTrack=(pathway.id==='de-blue-card'?'blue':pathway.id==='de-training'?'training':null) as GermanyOccupationTrack|null;
 const showOccupationDirectory=pathway.id==='nz-green-tier1'||pathway.id==='au-189'||!!japanTrack||!!germanyTrack;
 const occupationCountry=pathway.id==='au-189'?'au':'nz';
 const chapters=[...guide.sections.map((s,i)=>({label:s.title,id:sectionId(i)})),
  {label:'常见问题',id:sectionId(8)},{label:'风险与官方来源',id:sectionId(9)}];
 const glossary=(text:string)=><InlineTerms value={text} terms={guide.terms} openTerm={openTerm} onToggle={toggle}/>;
 return <div className="hhba-guide-v2 hhba-guide-v2-editorial" data-overseas-guide-v2={pathway.id}>
  <nav className="hhba-guide-v2-toc" aria-label="签证详情章节目录">
   <div className="hhba-guide-v2-desktop-toc"><strong>本文目录</strong>
    {chapters.map((part,i)=><><a key={part.id} href={'#'+part.id}><span>{String(i+1).padStart(2,'0')}</span>{part.label}</a>{i===0&&showOccupationDirectory&&<a key="occupation-directory" href="#hhba-overseas-occupation-directory"><span>↳</span>具体职业查询</a>}</>)}
   </div>
   <details className="hhba-guide-v2-mobile-toc" open={tocOpen} onToggle={e=>setTocOpen(e.currentTarget.open)}>
    <summary>查看本文目录 <span aria-hidden="true">⌄</span></summary>
    <div>{chapters.map((part,i)=><><a key={part.id} href={'#'+part.id} onClick={()=>setTocOpen(false)}>
     {String(i+1).padStart(2,'0')} · {part.label}</a>{i===0&&showOccupationDirectory&&<a key="occupation-directory" href="#hhba-overseas-occupation-directory" onClick={()=>setTocOpen(false)}>↳ 具体职业查询</a>}</>)}</div>
   </details>
  </nav>
  <article className="hhba-guide-v2-article">
   <div className="hhba-guide-v2-opening">
    <p className="hhba-guide-v2-article-eyebrow">开始之前 · 先把这条路线读明白</p>
    <p className="hhba-guide-v2-lede">{glossary(guide.plainAnswer)}</p>
    <p className="hhba-guide-v2-first"><strong>建议你先做这件事：</strong>{glossary(guide.firstAction)}</p>
    <p className="hhba-guide-v2-verified">政策资料核验日期：{guide.checkedAt}。规则和费用可能调整，以申请当日官方信息为准。</p>
   </div>
   {guide.sections.map((section,i)=><div key={i} className="hhba-guide-v2-chapter"><section className="hhba-guide-v2-section" id={sectionId(i)}>
    <h2><span>{String(i+1).padStart(2,'0')}</span>{section.title}</h2>
    <p className="hhba-guide-v2-section-intro">{glossary(section.summary)}</p>
    {section.points.map((point,j)=><div className="hhba-guide-v2-point" key={j}>
     <h3>{point.label}</h3>
     <p>{glossary(point.explain)}</p>
     <p className="hhba-guide-v2-howto"><strong>具体怎么做：</strong>{glossary(point.action)}</p>
    </div>)}
   </section>{i===0&&japanTrack&&<JapanOccupationDirectory track={japanTrack}/>}{i===0&&germanyTrack&&<GermanyOccupationDirectory track={germanyTrack}/>}{i===0&&showOccupationDirectory&&!japanTrack&&!germanyTrack&&<OverseasOccupationDirectory country={occupationCountry}/>}</div>)}
   <section className="hhba-guide-v2-section" id={sectionId(8)}>
    <h2><span>09</span>常见问题</h2>
    <p className="hhba-guide-v2-section-intro">遇到不符合条件、准备材料或判断签证资格的问题，可以先查看这里。</p>
    <dl className="hhba-guide-v2-faq">{guide.faq.map((item,i)=><div key={i}>
     <dt>{item.question}</dt><dd>{glossary(item.answer)}</dd>
    </div>)}</dl>
   </section>
   <section className="hhba-guide-v2-section" id={sectionId(9)}>
    <h2><span>10</span>风险提醒与官方依据</h2>
    <p className="hhba-guide-v2-section-intro">以下提醒不能代替签证规则；资格、收费及开放时间，请以官方最新说明为准。</p>
    <ul className="hhba-guide-v2-risks">{guide.risks.map((warning,i)=><li key={i}>{glossary(warning)}</li>)}</ul>
    <h3 className="hhba-guide-v2-references-title">官方参考资料</h3>
    <ul className="hhba-guide-v2-sources">{guide.sources.map((source,i)=><li key={i}>
     <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} <ExternalLink size={13} aria-hidden="true"/></a>
     <span>{source.purpose}</span>
    </li>)}</ul>
    <p className="hhba-guide-v2-footer-note">HHBA 仅提供政策解读与准备方法，不承诺签证、录取、岗位或永久居留结果。政府或其授权机构负责审理。</p>
   </section>
  </article>
 </div>;
}
