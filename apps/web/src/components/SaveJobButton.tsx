import {useEffect,useState} from 'react';
import {Bookmark,BookmarkCheck} from 'lucide-react';
import {listSavedJobs,savedAvailable,setSavedJob} from '../services/savedJobs';
export function SaveJobButton({jobId,compact=false}:{jobId:string,compact?:boolean}){
 const [saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!savedAvailable)return;
  let mounted=true;
  listSavedJobs().then(items=>{if(mounted)setSaved(items.some(j=>j.jobId===jobId))})
   .catch(()=>{if(mounted)setError('收藏暂不可用')});
  const refresh=()=>{listSavedJobs().then(items=>{if(mounted)setSaved(items.some(j=>j.jobId===jobId))}).catch(()=>undefined)};
  addEventListener('hhba:saved-changed',refresh);
  return()=>{mounted=false;removeEventListener('hhba:saved-changed',refresh)};
 },[jobId]);
 if(!savedAvailable)return null;
 const click=async()=>{if(busy)return;setBusy(true);setError('');
  try{await setSavedJob(jobId,!saved);setSaved(!saved);}catch(e){setError(e instanceof Error?e.message:'操作失败')}
  finally{setBusy(false)}
 };
 return <span className="hhba-save-wrap">
  <button type="button" className="hhba-save-button" aria-pressed={saved}
   aria-label={saved?'取消收藏该岗位':'收藏该岗位'} disabled={busy}
   onClick={click}>{saved?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}
   {!compact&&<span>{saved?'已收藏':'收藏'}</span>}</button>
  {error&&<small role="alert" className="hhba-save-error">{error}</small>}
 </span>;
}
