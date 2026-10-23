import {useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {Check,ChevronDown,X} from 'lucide-react';
import {MAJORS,majorById} from '../services/domesticMajors';
type Props={value:string;onChange:(slug:string)=>void;lang:'zh'|'en'};
const synonyms:Record<string,string[]>={
 '电气工程及其自动化':['电气','电工','电力','电气自动化'],
 '计算机科学与技术':['计算机','计算机专业','cs'],
 '机械设计制造及其自动化':['机械','机械设计','机械自动化'],
 '电子信息工程':['电子','电子信息'],
 '光电信息科学与工程':['光电','光学'],
 '车辆工程':['车辆','汽车'],
 '人工智能':['ai','机器学习'],
 '软件工程':['软件','程序'],
 '市场营销':['营销','销售'],
 '自动化':['自动控制','自动化技术']
};
export function MajorFilter({value,onChange,lang}:Props){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [focusIndex,setFocusIndex]=useState(0);
 const input=useRef<HTMLInputElement>(null);
 const current=majorById(value);
 const matches=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  const items=q?MAJORS.filter(m=>(m.name+' '+m.description+' '+(synonyms[m.name]||[]).join(' ')).toLocaleLowerCase().includes(q)):MAJORS;
  return items.slice(0,12);
 },[query]);
 const choose=(slug:string)=>{onChange(slug);setQuery('');setOpen(false);setFocusIndex(0)};
 const onKey=(event:KeyboardEvent<HTMLInputElement>)=>{
  if(event.key==='Escape'){event.preventDefault();setOpen(false);setQuery('');return}
  if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setFocusIndex(n=>Math.min(n+1,matches.length-1))}
  else if(event.key==='ArrowUp'){event.preventDefault();setOpen(true);setFocusIndex(n=>Math.max(n-1,0))}
  else if(event.key==='Enter'&&open&&matches.length){event.preventDefault();choose(matches[Math.max(0,focusIndex)].slug)}
 };
 return <div className="unified-major-filter" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}>
   <div className="unified-major-field">
    <input ref={input} value={open?query:(current?.name||'')} onChange={e=>{setQuery(e.target.value);setOpen(true);setFocusIndex(0)}}
     onFocus={()=>{setOpen(true);setQuery('');setFocusIndex(0)}}
     onKeyDown={onKey}
     role="combobox" aria-label={lang==='zh'?'搜索或选择所学专业':'Search or select academic major'}
     aria-autocomplete="list" aria-expanded={open} aria-controls="hhba-major-filter-options"
     aria-activedescendant={open&&matches[focusIndex]?'major-opt-'+matches[focusIndex].slug:undefined}
     placeholder={lang==='zh'?'所学专业（可输入）':'Academic major'}
     autoComplete="off" maxLength={70}/>
    {value?<button type="button" className="unified-major-clear" aria-label={lang==='zh'?'清除所学专业':'Clear major'} onMouseDown={e=>e.preventDefault()} onClick={()=>{choose('');input.current?.focus()}}><X size={14}/></button>:
      <ChevronDown className="unified-major-arrow" size={14}/>}
   </div>
   {open&&<div className="unified-major-options" id="hhba-major-filter-options" role="listbox" aria-label={lang==='zh'?'匹配的大学专业':'Matching university majors'}>
     <small>{lang==='zh'?'搜索专业名称 · 选择后筛选相关企业':'Select an academic major to find related companies'}</small>
     {matches.map((major,i)=><button id={'major-opt-'+major.slug} role="option" aria-selected={value===major.slug}
      type="button" key={major.slug} className={i===focusIndex?'is-focused':''} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(major.slug)}>
       <span>{major.name}</span>{value===major.slug&&<Check size={14}/>}
     </button>)}
     {!matches.length&&<div className="unified-major-no-match">{lang==='zh'?'暂未找到匹配专业，请尝试其他名称':'No matching major found'}</div>}
   </div>}
 </div>;
}
