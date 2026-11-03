import {useEffect,useState,type FormEvent} from 'react';
import type {Language} from '../services/liveRecruitment';
import {pageCount,validJumpPage,visiblePageTokens} from '../services/jobPaging.mjs';

type Props={
 page:number;total:number;pageSize:number;loading:boolean;
 onChange:(page:number)=>void;lang:Language;
};
export function JobResultPagination({page,total,pageSize,loading,onChange,lang}:Props){
 const [typed,setTyped]=useState('');
 const pages=Math.max(1,pageCount(total));
 const current=Math.min(page+1,pages);
 useEffect(()=>setTyped(''),[page,total,pageSize]);
 if(total<=0)return null;
 const jump=validJumpPage(typed,total);
 const valid=jump!==null;
 const numbers=visiblePageTokens(page,total);
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!loading&&jump!==null)onChange(jump);
 }
 const zh=lang==='zh';
 return <nav className="unified-job-paging" aria-label={zh?'岗位结果分页':'Job result pagination'}>
  <div className="unified-job-pages">
   <button type="button" disabled={loading||page===0} onClick={()=>onChange(page-1)}>
    {zh?'上一页':'Previous'}
   </button>
   {numbers.map((n,i)=>n==='dots'
    ?<span className="unified-page-ellipsis" aria-hidden="true" key={'dots'+i}>…</span>
    :<button type="button" key={n} aria-current={n===current?'page':undefined}
      aria-label={(zh?'第 ':'Page ')+n+(zh?' 页':'')} disabled={loading||n===current}
      onClick={()=>onChange(n-1)}>{n}</button>)}
   <button type="button" disabled={loading||current>=pages} onClick={()=>onChange(page+1)}>
    {zh?'下一页':'Next'}
   </button>
  </div>
  <form className="unified-job-page-jump" onSubmit={submit}>
   <span>{zh?'第 '+current+' / '+pages+' 页':'Page '+current+' / '+pages}</span>
   <label htmlFor="hhba-job-page-jump">{zh?'跳至':'Go to'}</label>
   <input id="hhba-job-page-jump" type="number" inputMode="numeric"
     min={1} max={pages} step={1} value={typed} onChange={e=>setTyped(e.target.value)}
     aria-label={zh?'输入跳转页码':'Enter page number'} placeholder={String(current)} disabled={loading}/>
   <button type="submit" disabled={loading||!valid}>{zh?'跳转':'Go'}</button>
  </form>
 </nav>;
}
