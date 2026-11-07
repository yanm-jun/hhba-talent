// Local-only user-owned application history merge logic.
// A verified success page may follow a full-page ATS redirect. Keep the
// original application URL and upgrade the most recent matching pending row
// instead of creating an unrelated receipt-page record.
const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();
const identity=x=>[norm(x.company),norm(x.position),String(x.applicationUrl||'')].join('\x1f');
export function mergeApplicationRecord(items,record,nowMs=Date.now()){
 const old=Array.isArray(items)?items.filter(x=>x&&typeof x==='object').slice(0,100):[];
 const when=Number.isFinite(nowMs)?nowMs:Date.now();
 const updated={...record,recordedAt:new Date(when).toISOString(),synced:false};
 let matched=old.find(x=>identity(x)===identity(updated));
 if(!matched&&updated.status==='confirmed'&&updated.evidenceKind==='success_notice'){
  // Only match an earlier user-initiated PENDING attempt, not another
  // successfully submitted role or manually self-reported entry.
  const candidates=old.filter(x=>norm(x.company)===norm(updated.company)&&
   norm(x.position)===norm(updated.position)&&x.status==='pending'&&
   x.evidenceKind==='none'&&Number.isFinite(Date.parse(x.recordedAt))&&
   when-Date.parse(x.recordedAt)>=0&&when-Date.parse(x.recordedAt)<=5*60*1000);
  if(candidates.length===1){
   matched=candidates[0];
   updated.applicationUrl=matched.applicationUrl;
  }
 }
 if(matched?.status==='confirmed'&&updated.status!=='confirmed')return old;
 const next={...updated,recordedAt:matched?.recordedAt||updated.recordedAt};
 return [next,...old.filter(x=>identity(x)!==identity(matched||next))].slice(0,100);
}
