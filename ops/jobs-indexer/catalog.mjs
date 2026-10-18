import {createHash} from "node:crypto";
const platforms = new Set(["greenhouse","ashby","lever"]);
export function validateBoards(boards) {
  if (!Array.isArray(boards) || boards.length<1 || boards.length>1000) throw Error("boards missing");
  const keys=new Set();
  for(const b of boards) {
    if (!platforms.has(b.platform) || !/^[\w-]{2,90}$/.test(b.slug) || typeof b.company!=="string" || !b.company.trim()) throw Error("bad board");
    if (b.website && !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(b.website)) throw Error("bad website");
    const key=b.platform+":"+b.slug.toLowerCase();
    if(keys.has(key))throw Error("duplicate board");
    keys.add(key);
  }
  return boards;
}
export function officialLink(value,board){
  try {
    const url=new URL(String(value||""));
    const hosts={
      greenhouse:["job-boards.greenhouse.io","boards.greenhouse.io","boards.eu.greenhouse.io"],
      ashby:["jobs.ashbyhq.com"],
      lever:["jobs.lever.co","jobs.eu.lever.co"]
    }[board.platform];
    if(url.protocol!=="https:"||url.username||url.password||!hosts?.includes(url.hostname))return null;
    if(!url.pathname.split("/").includes(board.slug))return null;
    return url.href;
  }catch{return null}
}
export function normalize(board,raw){
  if(!raw||raw.isListed===false)return null;
  const native=raw.id,title=board.platform==="lever"?raw.text:raw.title;
  const href=board.platform==="greenhouse"?raw.absolute_url:board.platform==="ashby"?raw.jobUrl:raw.hostedUrl;
  const url=officialLink(href,board);
  if(!url||native==null||!String(native)||typeof title!=="string"||!title.trim())return null;
  const location=board.platform==="lever"?raw.categories?.location:board.platform==="greenhouse"?raw.location?.name:raw.location;
  const kind=typeof raw.workplaceType==="string"?raw.workplaceType.toLowerCase():null;
  const remote=typeof raw.isRemote==="boolean"?raw.isRemote:kind==="remote"?true:kind==="onsite"?false:null;
  const id=createHash("sha256").update(board.platform+":"+board.slug+":"+String(native)).digest("hex").slice(0,32);
  return {id,company:board.company,title:title.trim().slice(0,220),
    location:typeof location==="string"&&location.trim()?location.slice(0,170):"Not specified",
    remote,url,platform:board.platform,source:board.slug,website:board.website||""};
}
export function endpoint(b) {
 if(b.platform==="greenhouse")return "https://boards-api.greenhouse.io/v1/boards/"+encodeURIComponent(b.slug)+"/jobs";
 if(b.platform==="ashby")return "https://api.ashbyhq.com/posting-api/job-board/"+encodeURIComponent(b.slug);
 return "https://api.lever.co/v0/postings/"+encodeURIComponent(b.slug)+"?mode=json";
}
export function isTalentPool(title){
 return /^(?:general application|open application|join our talent network|future opportunities|talent community|don.t see the job|don.t see a role|speculative application)(?:$|[\s?!:–—-])/i.test(String(title||"").trim());
}
export async function fetchBoard(board){
 const target=endpoint(board);
 for(let attempt=0;attempt<2;attempt++){
  try {
   const response=await fetch(target,{redirect:"error",headers:{"Accept":"application/json","User-Agent":"HHBA-public-job-index/0.4"},
    signal:AbortSignal.timeout(board.slug==="andurilindustries"?35000:22000)});
   if(!response.ok){
    if(attempt===0&&(response.status===429||response.status>=500))continue;
    throw Error("ATS_HTTP_"+response.status);
   }
   if(Number(response.headers.get("content-length")||0)>20_000_000)throw Error("Too large");
   const text=await response.text();
   if(text.length>20_000_000)throw Error("Too large");
   const payload=JSON.parse(text);
   const raw=Array.isArray(payload)?payload:Array.isArray(payload?.jobs)?payload.jobs:null;
   if(!raw)throw Error("Invalid job array");
   const validated=raw.slice(0,5000).map(x=>normalize(board,x)).filter(Boolean);
   if(raw.length>0&&!validated.length)throw Error("No validated job URLs");
   return validated.filter(x=>!isTalentPool(x.title));
  }catch(e){if(attempt>0)throw e;}
 }
 throw Error("ATS_UNAVAILABLE");
}
