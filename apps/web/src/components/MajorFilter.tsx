import {useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {Check,ChevronDown,X} from 'lucide-react';
import {MAJOR_OPTIONS,majorById,type MajorLevel} from '../services/domesticMajors';
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
 const [level,setLevel]=useState<'all'|MajorLevel>('all');
 const input=useRef<HTMLInputElement>(null);
 const current=majorById(value);
 const matches=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase().replace(/\s+/g,'');
  const candidates=MAJOR_OPTIONS.filter(m=>level==='all'||m.level===level);
  if(!q)return candidates.slice(0,25);
  return candidates.map(m=>{
   const name=m.name.toLocaleLowerCase();
   const syn=(synonyms[m.name]||[]).map(a=>a.toLocaleLowerCase());
   const matched=m.code===q?400:name===q?350:name.startsWith(q)?240:name.includes(q)?140:
    syn.some(v=>v===q)?170:syn.some(v=>v.includes(q))?90:
    m.discipline?.toLocaleLowerCase().includes(q)?10:0;
   return {m,matched};
  }).filter(x=>x.matched>0).sort((a,b)=>b.matched-a.matched||
    Number(a.m.level==='undergraduate')-Number(b.m.level==='undergraduate')||a.m.name.localeCompare(b.m.name,'zh-CN'))
   .slice(0,35).map(x=>x.m);
 },[query,level]);
 const displayedTotal=MAJOR_OPTIONS.filter(m=>level==='all'||m.level===level).length;
 const labelLevel=(item?:MajorLevel)=>item==='undergraduate'?'本科':item==='vocational'?'高职专科':
   item==='postgraduate'?'研究生':item==='custom'?'自填':item==='legacy'?'待核验':'';
 const choose=(slug:string)=>{onChange(slug);setQuery('');setOpen(false);setFocusIndex(0)};
 const customValue='custom:'+encodeURIComponent(query.trim().slice(0,70));
 const allowCustom=query.trim().length>=2&&!MAJOR_OPTIONS.some(m=>m.name===query.trim());
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
     <small>按专业名称、专业代码或常用别名查找 · 已收录 {MAJOR_OPTIONS.length} 条目录记录</small>
     <div className="unified-major-levels" role="group" aria-label="学历层次">
      {([['all','全部'],['undergraduate','本科'],['vocational','高职专科'],['postgraduate','研究生']] as const).map(([key,title])=>
       <button key={key} type="button" className={level===key?'is-active':''}
        onMouseDown={e=>e.preventDefault()} onClick={()=>{setLevel(key);setFocusIndex(0)}}>
         {title}</button>)}
     </div>
     {!query&&<small>当前类别 {displayedTotal} 项，输入文字可查找全部结果</small>}
     {matches.map((major,i)=><button id={'major-opt-'+major.slug} role="option" aria-selected={value===major.slug}
      type="button" key={major.slug} className={i===focusIndex?'is-focused':''} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(major.slug)}>
       <span>{major.name}<small>{labelLevel(major.level)}{major.code?' · '+major.code:''}</small></span>
       {value===major.slug&&<Check size={14}/>}
     </button>)}
     {!matches.length&&<div className="unified-major-no-match">未找到已收录的专业名称，可以使用下面的自填选项。</div>}
     {allowCustom&&<button type="button" className="unified-major-custom" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(customValue)}>
      <span>使用自填专业「{query.trim()}」<small>未核对目录，不自动推断企业招聘需求</small></span>
     </button>}
   </div>}
 </div>;
}
