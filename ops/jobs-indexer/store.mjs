import {readFileSync} from "node:fs";
import {fetchBoard,validateBoards} from "./catalog.mjs";

const data=JSON.parse(readFileSync(new URL("./boards.json",import.meta.url),"utf8"));
export const boards=validateBoards(data.boards);
const states=new Map(),stored=new Map();
const MAX_STALE=24*60*60*1000;
let updating=null;
export let snapshot={jobs:[],updatedAt:null,boards:boards.length,successBoards:0,failedBoards:boards.length,staleBoards:0};
export function sourceStatus(){
 return boards.map(b=>({...b,state:states.get(b.platform+":"+b.slug)||{ok:false,count:0,error:"Pending first sync"}}));
}
function assemble(){
 const now=Date.now(),all=[],seen=new Set();
 let successes=0,failures=0,staleBoards=0;
 for(const b of boards){
  const key=b.platform+":"+b.slug,state=states.get(key),saved=stored.get(key);
  if(state?.ok)successes++;else failures++;
  if(!saved||now-saved.at>MAX_STALE)continue;
  if(!state?.ok)staleBoards++;
  for(const job of saved.jobs){
   if(seen.has(job.url))continue;
   seen.add(job.url);
   all.push({...job,status:state?.ok?"fresh":"stale",observedAt:new Date(saved.at).toISOString()});
  }
 }
 all.sort((a,b)=>a.company.localeCompare(b.company)||a.title.localeCompare(b.title));
 snapshot={jobs:all,updatedAt:new Date().toISOString(),boards:boards.length,successBoards:successes,failedBoards:failures,staleBoards};
}
export async function refresh(){
 if(updating)return updating;
 updating=(async()=>{
  let next=0;
  const worker=async()=>{
   while(next<boards.length){
    const b=boards[next++],key=b.platform+":"+b.slug;
    try{
     const jobs=await fetchBoard(b),at=Date.now();
     stored.set(key,{jobs,at});
     states.set(key,{ok:true,count:jobs.length,checkedAt:new Date(at).toISOString(),error:null});
    }catch(e){
     states.set(key,{ok:false,count:0,checkedAt:new Date().toISOString(),error:String(e?.message||"Unavailable").slice(0,120)});
    }
   }
  };
  await Promise.all(Array.from({length:5},worker));
  assemble();
  console.log("HHBA_INDEXER_SYNC",JSON.stringify({jobs:snapshot.jobs.length,boards:boards.length,successBoards:snapshot.successBoards,failedBoards:snapshot.failedBoards,staleBoards:snapshot.staleBoards}));
  return snapshot;
 })();
 try{return await updating}finally{updating=null}
}
export function filterJobs(params){
 const q=String(params.get("q")||"").trim().toLowerCase().slice(0,100);
 const company=String(params.get("company")||"").trim().toLowerCase().slice(0,100);
 const remote=params.get("remote")==="true";
 return snapshot.jobs.filter(j=>(!company||j.company.toLowerCase()===company)&&
  (!remote||j.remote===true)&&(!q||[j.company,j.title,j.location].some(s=>s.toLowerCase().includes(q))));
}
