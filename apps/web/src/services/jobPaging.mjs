// Pure, source-agnostic pagination for HHBA's existing audited 30-job feed.
// UI pages contain ten consecutive records; no API shape or source data changes.
export const JOBS_PER_PAGE=10;
export const FETCH_BATCH_SIZE=30;
export function pageCount(total){
 if(!Number.isSafeInteger(total)||total<=0)return 0;
 return Math.ceil(total/JOBS_PER_PAGE);
}
export function batchOffsetForPage(page){
 if(!Number.isSafeInteger(page)||page<0)throw new RangeError('INVALID_JOB_PAGE');
 return Math.floor(page*JOBS_PER_PAGE/FETCH_BATCH_SIZE)*FETCH_BATCH_SIZE;
}
export function sliceJobsForPage(rows,page){
 if(!Array.isArray(rows))throw new TypeError('INVALID_JOB_BATCH');
 if(!Number.isSafeInteger(page)||page<0)throw new RangeError('INVALID_JOB_PAGE');
 const first=(page*JOBS_PER_PAGE)%FETCH_BATCH_SIZE;
 return rows.slice(first,first+JOBS_PER_PAGE);
}
export function validJumpPage(value,total){
 if(typeof value!=='string'||!/^[0-9]{1,8}$/.test(value.trim()))return null;
 const n=Number(value.trim()),pages=pageCount(total);
 return Number.isSafeInteger(n)&&n>=1&&n<=pages?n-1:null;
}
export function visiblePageTokens(page,total){
 const pages=pageCount(total),current=page+1;
 if(!pages)return [];
 const selected=new Set([1,pages,current-2,current-1,current,current+1,current+2]
   .filter(n=>n>=1&&n<=pages));
 const sorted=[...selected].sort((a,b)=>a-b),tokens=[];
 for(let i=0;i<sorted.length;i++){
  if(i>0&&sorted[i]-sorted[i-1]>1)tokens.push('dots');
  tokens.push(sorted[i]);
 }
 return tokens;
}
