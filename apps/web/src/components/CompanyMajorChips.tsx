import {useMemo,useState} from 'react';
import {CheckCircle2,ChevronDown} from 'lucide-react';
import {MAJOR_OPTIONS,majorById} from '../services/domesticMajors';
import {majorName,matchRoleToMajor} from '../services/majorJobMatching';
import type {LiveJob} from '../services/liveRecruitment';

type IndexedJob=Pick<LiveJob,'majorNames'|'editorialRelatedMajors'|'majorUnrestricted'>;
type Choice={slug:string;name:string;count:number};
const catalogByName=new Map<string,{slug:string;name:string}>();
// Prefer the nationally catalogued undergraduate title to historical shorthand.
for(const m of MAJOR_OPTIONS.filter(x=>x.level==='undergraduate'))if(!catalogByName.has(m.name))catalogByName.set(m.name,{slug:m.slug,name:m.name});
for(const m of MAJOR_OPTIONS)if(!catalogByName.has(m.name))catalogByName.set(m.name,{slug:m.slug,name:m.name});

export function companyMajorChoices(jobs:IndexedJob[],preferredNames:readonly string[]=[],selectedSlug=''):Choice[]{
 const labels=new Set<string>();
 for(const j of jobs)for(const name of [...(j.majorNames||[]),...(j.editorialRelatedMajors||[])]){
  if(catalogByName.has(name))labels.add(name);
 }
 // The per-company preferred order only affects labels which actually have role evidence.
 // Never manufacture a company-major link just because an old profile listed an industry.
 const prefs=new Map(preferredNames.map((n,i)=>[n,i]));
 const candidates=[...labels].map(n=>catalogByName.get(n)!).filter(Boolean);
 const saved=selectedSlug?majorById(selectedSlug):null;
 if(saved&&!candidates.some(x=>x.name===saved.name))candidates.push({slug:selectedSlug,name:saved.name});
 return candidates.map(x=>({
  ...x,count:jobs.filter(j=>['related','unrestricted'].includes(matchRoleToMajor(j,x.slug))).length
 })).filter(x=>x.count>0||x.slug===selectedSlug||x.name===saved?.name)
 .sort((a,b)=>(prefs.get(a.name)??1000)-(prefs.get(b.name)??1000)||
  b.count-a.count||a.name.localeCompare(b.name,'zh-CN'));
}
export function CompanyMajorChips({jobs,slug,onChange,preferredNames=[],maxVisible=12}:{
 jobs:IndexedJob[];slug:string;onChange:(slug:string)=>void;preferredNames?:readonly string[];maxVisible?:number
}){
 const [expanded,setExpanded]=useState(false);
 const options=useMemo(()=>companyMajorChoices(jobs,preferredNames,slug),[jobs,preferredNames,slug]);
 const shown=expanded?options:options.slice(0,maxVisible);
 const hiddenSelected=options.find(x=>x.slug===slug&&!shown.some(y=>y.slug===slug));
 if(hiddenSelected)shown.push(hiddenSelected);
 const allSelected=!slug;
 return <div className="hhba-major-quick-area">
  <div className="hhba-major-quick-list" role="group" aria-label="按专业筛选该企业的岗位">
   <button type="button" className={'hhba-kpmg-major'+(allSelected?' is-selected':'')}
    aria-pressed={allSelected} onClick={()=>onChange('')}>全部专业 <small>{jobs.length}</small>{allSelected&&<CheckCircle2 size={13}/>}</button>
   {shown.map(option=><button type="button" key={option.slug}
    className={'hhba-kpmg-major'+(majorName(slug)===option.name?' is-selected':'')}
    aria-pressed={majorName(slug)===option.name}
    onClick={()=>onChange(option.slug)}>{option.name}<small>{option.count}</small>
    {majorName(slug)===option.name&&<CheckCircle2 size={13}/>}</button>)}
   {options.length>maxVisible&&<button type="button" className="hhba-kpmg-major hhba-major-show-more"
     aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)}>
    {expanded?'收起专业':'更多专业（'+(options.length-maxVisible)+'）'} <ChevronDown size={13} className={expanded?'is-up':''}/>
   </button>}
  </div>
  {options.length===0&&<p className="hhba-major-quick-footnote">该企业的逐岗专业信息尚未完善，目前仅可浏览已收录岗位，不能凭空推断专业匹配。</p>}
 </div>;
}
