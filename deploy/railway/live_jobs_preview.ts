import { convert } from "html-to-text@9";
import sanitizeHtml from "sanitize-html@2";

type Job={id:string;company:string;title:string;location:string;remote:boolean|null;url:string;platform:string;source:string};

import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
const phrases:[string,string][]=[
 ["Integration Technician","集成技术员"],["Test Technician","测试技术员"],
 ["Manufacturing Engineer","制造工程师"],["Supply Chain Manager","供应链经理"],
 ["Warehouse Associate","仓储专员"],["Procurement Specialist","采购专员"],
 ["Quality Control","质量控制"],["Production Supervisor","生产主管"],
 ["Nurse Practitioner","执业护士"],["Mental Health Therapist","心理健康治疗师"],
 ["Clinical Product","临床产品"],["Care Coordinator","护理协调员"],
 ["Customer Experience","客户体验"],["Business Development Representative","业务拓展代表"],
 ["Account Executive","客户经理"],["Revenue Operations","营收运营"],
 ["Information Security","信息安全"],["Research Assistant","研究助理"],
 ["Technical Sales","技术销售"],["Growth Operations","增长运营"],
 ["Production","生产"],["Technician","技术员"],["Buyer","采购员"],
 ["Manufacturing","制造"],["Warehouse","仓储"],["Logistics","物流"],
 ["Procurement","采购"],["Assembler","装配工"],["Assembly","装配"],
 ["Supply Chain","供应链"],["Operations Associate","运营专员"],
 ["VP","副总裁"],["Pipeline","人才储备"],["Maintenance","维护"],
 ["Therapist","治疗师"],["Nurse","护士"],["Clinical","临床"],
 ["Healthcare","医疗健康"],["Health","健康"],["Provider","服务提供者"],
 ["Patient","患者"],["Safety","安全"],["Training","培训"],
 ["Education","教育"],["Teaching","教学"],["Instructor","讲师"],
 ["Accounting","会计"],["Attorney","律师"],["Counsel","法律顾问"],
 ["Algorithm","算法"],["Algorithms","算法"],["Payments Fraud","支付反欺诈"],["Business Development","业务拓展"],
 ["Regulatory Compliance","监管合规"],["Machine Learning","机器学习"],
 ["Artificial Intelligence","人工智能"],["Data Scientist","数据科学家"],
 ["Data Analyst","数据分析师"],["Data Analytics","数据分析"],
 ["Software Engineer","软件工程师"],["iOS Engineer","iOS 工程师"],
 ["Mobile Engineer","移动端工程师"],["Product Manager","产品经理"],
 ["Project Manager","项目经理"],["Account Manager","客户经理"],
 ["Engineering Manager","工程经理"],["Technical Support","技术支持"],
 ["Customer Success","客户成功"],["Sales Engineer","销售工程师"],
 ["Business Operations","业务运营"],["Product Marketing","产品市场营销"],
 ["Digital Marketing","数字营销"],["Growth Marketing","增长营销"],
 ["Marketing Manager","市场营销经理"],["Talent Acquisition","人才招聘"],
 ["Human Resources","人力资源"],["Finance Manager","财务经理"],
 ["Financial Analyst","财务分析师"],["Regulatory Affairs","监管事务"],
 ["Risk Management","风险管理"],["Security Engineer","安全工程师"],
 ["Data Engineer","数据工程师"],["Data Platform","数据平台"],
 ["Cloud Infrastructure","云基础设施"],["Quality Assurance","质量保证"],
 ["Quality Engineer","质量工程师"],["Business Analyst","业务分析师"],
 ["Business Intelligence","商业智能"],["User Experience","用户体验"],
 ["User Interface","用户界面"],["Product Designer","产品设计师"],
 ["Technical Program Manager","技术项目经理"],
 ["Software Development","软件开发"],["Business Strategy","业务战略"],
 ["Country Manager","国家经理"],["Infrastructure Engineer","基础设施工程师"],
 ["Operations Analyst","运营分析师"],["Payments","支付"],["Fraud","反欺诈"],
 ["Optimization","优化"],["Identity","身份"],["Organization","组织"],
 ["Staff","专家级"],["Principal","首席"],["Senior","高级"],
 ["Junior","初级"],["Lead","负责人"],["Head of","负责人"],
 ["Director","总监"],["Vice President","副总裁"],["Associate","助理"],
 ["Graduate","应届生"],["Internship","实习"],["Intern","实习生"],
 ["Specialist","专员"],["Consultant","顾问"],["Coordinator","协调员"],
 ["Assistant","助理"],["Administrator","管理员"],["Architect","架构师"],
 ["Engineer","工程师"],["Developer","开发工程师"],["Manager","经理"],
 ["Analyst","分析师"],["Scientist","科学家"],["Designer","设计师"],
 ["Recruiter","招聘专员"],["Executive","主管"],["Operations","运营"],
 ["Marketing","市场营销"],["Finance","财务"],["Financial","财务"],
 ["Accounting","会计"],["Accountant","会计师"],["Sales","销售"],
 ["Business","业务"],["Growth","增长"],["Strategy","战略"],
 ["Product","产品"],["Engineering","工程"],["Technical","技术"],
 ["Technology","技术"],["Security","安全"],["Compliance","合规"],
 ["Regulatory","监管"],["Global","全球"],["Regional","区域"],
 ["International","国际"],["Partnerships","合作伙伴"],["Support","支持"],
 ["Customer","客户"],["Client","客户"],["Service","服务"],
 ["Enterprise","企业"],["Platform","平台"],["Infrastructure","基础设施"],
 ["Systems","系统"],["System","系统"],["Solutions","解决方案"],
 ["Software","软件"],["Hardware","硬件"],["Cloud","云"],
 ["Data","数据"],["Mobile","移动端"],["Backend","后端"],
 ["Frontend","前端"],["Design","设计"],["Risk","风险"],
 ["Legal","法务"],["Policy","政策"],["Payment","支付"],
 ["Performance","性能"],["Testing","测试"],["Quality","质量"],
 ["Development","开发"],["SME","中小企业"],["Org","组织"],
 ["Full-time","全职"],["Part-time","兼职"],["Contract","合同制"],
 ["Remote","远程"],["Hybrid","混合办公"],["Retail","零售"],
 ["Education","教育"],["Experience","经验"],["Content","内容"],
 ["Brand","品牌"],["Social Media","社交媒体"],["Acquisition","获客"],
 ["Onboarding","入职"],["Fintech","金融科技"],["Banking","银行"],
 ["Digital","数字"],["Investment","投资"],["People","人力资源"]
].sort((a,b)=>b[0].length-a[0].length);
const localePlaces:Record<string,string>={
 "Ho Chi Minh City":"胡志明市","Singapore":"新加坡","SG":"新加坡",
 "Vietnam":"越南","VN":"越南","Jakarta":"雅加达",
 "Indonesia":"印度尼西亚","ID":"印度尼西亚",
 "Hong Kong":"香港","HK":"中国香港",
 "San Francisco":"旧金山","New York":"纽约","Los Angeles":"洛杉矶",
 "United States":"美国","USA":"美国","US":"美国",
 "United Kingdom":"英国","UK":"英国","London":"伦敦",
 "Sydney":"悉尼","Melbourne":"墨尔本","Australia":"澳大利亚",
 "Tokyo":"东京","Japan":"日本","Kuala Lumpur":"吉隆坡",
 "Malaysia":"马来西亚","Dubai":"迪拜","Berlin":"柏林",
 "Germany":"德国","Paris":"巴黎","France":"法国",
 "Bengaluru":"班加罗尔","Mumbai":"孟买","India":"印度",
 "Toronto":"多伦多","Canada":"加拿大","Bangkok":"曼谷",
 "Thailand":"泰国","Remote":"远程","Worldwide":"全球远程"
};
const companyZh:Record<string,string>={Cognition:"Cognition",Replit:"Replit",PostHog:"PostHog",ClickUp:"ClickUp",Airwallex:"空中云汇","OpenAI":"OpenAI","Notion":"Notion","Ramp":"Ramp","Linear":"Linear","Perplexity":"Perplexity","ElevenLabs":"ElevenLabs","Vanta":"Vanta","Harvey":"Harvey","Headway":"Headway","Coursera":"Coursera","Figma":"Figma","Anduril":"Anduril","Discord":"Discord","Reddit":"Reddit","Airtable":"Airtable","Flexport":"Flexport","Robinhood":"Robinhood","GitLab":"GitLab","Twilio":"Twilio","Cloudflare":"Cloudflare","Vercel":"Vercel","Gusto":"Gusto","Wise":"Wise","Binance":"Binance"};
function swapTerms(raw:string,lookup:[string,string][]):string{
 let out=raw;
 for(const [en,zh]of lookup){
  const safe=en.replace(/[^A-Za-z0-9]/g,c=>"\\"+c);
  out=out.replace(new RegExp("(^|[^A-Za-z])("+safe+")(?=$|[^A-Za-z])","gi"),(_m,prefix)=>prefix+zh);
 }
 return out;
}
function translateTitleRules(value:string):string{
 const title=swapTerms(swapTerms(value,phrases),Object.entries(localePlaces)).replace(/\s*&\s*/g,"与")
  .replace(/,\s*/g,"，").replace(/\(/g,"（").replace(/\)/g,"）")
  .replace(/ {2,}/g," ").trim();
 return /[\u3400-\u9fff]/.test(title)?title:"职位名称待翻译";
}
function translateLocation(value:string):string{
 const raw=swapTerms(value,Object.entries(localePlaces).sort((a,b)=>b[0].length-a[0].length))
  .replace(/\s*-\s*/g," · ").trim()||"工作地点未披露";
 // Singapore may appear both as a country code (SG) and city (Singapore).
 // Never display “新加坡 · 新加坡” to Chinese-language job seekers.
 const parts=raw.split(/\s*[·,，]\s*/).filter(Boolean);
 return parts.filter((piece,index)=>parts.indexOf(piece)===index).join(" · ")||raw;
}
let translationDb:Database|null=null;
try{
 mkdirSync("/data",{recursive:true});
 translationDb=new Database("/data/hhba-translations.sqlite",{create:true});
 translationDb.exec("PRAGMA journal_mode=WAL");
 translationDb.exec("CREATE TABLE IF NOT EXISTS translations(cache_key TEXT PRIMARY KEY,kind TEXT NOT NULL,source_hash TEXT NOT NULL,translated TEXT NOT NULL,mode TEXT NOT NULL,updated_at TEXT NOT NULL)");
 translationDb.exec("CREATE INDEX IF NOT EXISTS idx_tr_kind ON translations(kind,mode)");
}catch(e){console.error("HHBA_TRANSLATION_STORAGE_ERROR",e instanceof Error?e.name:"Error");}
function hash(kind:string,source:string):string{
 return createHash("sha256").update("hhba-zh-v1:"+kind+":"+source).digest("hex");
}
function fromCache(kind:string,source:string):{translated:string,mode:string}|null{
 try{return (translationDb?.query("SELECT translated,mode FROM translations WHERE cache_key=?").get(hash(kind,source)) as any)||null;}catch{return null;}
}
function toCache(kind:string,source:string,value:string,mode:string){
 if(!translationDb||!value.trim()||value.length>150000)return;
 try{translationDb.query("INSERT OR REPLACE INTO translations(cache_key,kind,source_hash,translated,mode,updated_at) VALUES(?,?,?,?,?,?)")
 .run(hash(kind,source),kind,createHash("sha256").update(source).digest("hex"),value,mode,new Date().toISOString());}catch{}
}

const approvedTerminology:Record<string,string>={
 "Automation Technician 2nd Shift, Manufacturing Automation":"制造自动化技术员（第二班次）",
 "Environmental Test Technician (1st Shift)":"环境测试技术员（第一班次）",
 "Environmental Test Technician (2nd Shift)":"环境测试技术员（第二班次）",
 "Metrology Technician (2nd Shift)":"计量检测技术员（第二班次）",
 "Commercial Counsel":"商业法律顾问",
 "Deployment Strategist":"部署策略顾问",
 "Deployment Strategist - Intel":"部署策略顾问（情报业务）",
 "Deployment Strategist - Korea Forward Deployed":"部署策略顾问（韩国驻场交付）",
 "Deployment Strategist - Spain":"部署策略顾问（西班牙）",
 "Deployment Strategist - Warp Speed":"部署策略顾问（Warp Speed 项目）",
 "Deployment Strategist, New Grad - Commercial":"应届生部署策略顾问（商业业务）",
 "Meritocracy Fellowship":"人才选拔培养项目（Meritocracy Fellowship）",
 "Neurodivergent Fellowship":"神经多样性人才培养项目",
 "Talent Strategist":"人才战略顾问",
 "Staff Data Scientist, Algorithm (Payments Fraud & Optimization)":"专家级数据科学家（支付反欺诈与算法优化）",
 "(Senior) iOS Engineer, Mobile - Identity & Org":"（高级）iOS 移动端工程师（身份与组织）",
 "(Senior) Manager, Business Development, SME & Growth":"（高级）业务拓展经理（中小企业与增长）",
 "(Senior) Manager, Regulatory Compliance, Indonesia":"（高级）监管合规经理（印度尼西亚）"
};
function professionalTitle(original:string,translation:string):string{
 const named=approvedTerminology[original.trim()];
 if(named)return named;
 return translation.trim()
   .replace(/工作人员(?=[\u3400-\u9fffA-Za-z])/g,"专家级")
   .replace(/付款欺诈/g,"支付反欺诈")
   .replace(/支付欺诈/g,"支付反欺诈")
   .replace(/工商发展/g,"业务拓展")
   .replace(/业务发展/g,"业务拓展")
   .replace(/数据科学家\s*,/g,"数据科学家，")
   .replace(/^\((高级)\)/g,"（$1）")
   .replace(/\s+/g," ").trim();
}

// Curated employer website hostnames; never accept image URLs from job data.
// Official-site favicons are optional. Missing icons fall back to initials.
const employerBrandSites:Record<string,string>={"Greenhouse":"greenhouse.com","Ashby":"ashbyhq.com","Spotify":"spotify.com","Canonical":"canonical.com","Airwallex":"airwallex.com","Palantir":"palantir.com","Figma":"figma.com","Anduril":"anduril.com","Discord":"discord.com","Reddit":"reddit.com","Airtable":"airtable.com","Flexport":"flexport.com","Robinhood":"robinhood.com","GitLab":"gitlab.com","Twilio":"twilio.com","Cloudflare":"cloudflare.com","Vercel":"vercel.com","Gusto":"gusto.com","Wise":"wise.com","Coursera":"coursera.org","OpenAI":"openai.com","Notion":"notion.so","Ramp":"ramp.com","Linear":"linear.app","Perplexity":"perplexity.ai","ElevenLabs":"elevenlabs.io","Vanta":"vanta.com","Harvey":"harvey.ai","Headway":"headway.co","Binance":"binance.com","Cognition":"cognition.ai","Replit":"replit.com","PostHog":"posthog.com","ClickUp":"clickup.com"};
function employerLogo(company:string):string{
 const domain=employerBrandSites[company];
 const initials=(company.trim().slice(0,2)||"?").toUpperCase();
 return '<span class="company-logo" aria-hidden="true"><span class="company-initials">'+esc(initials)+'</span>'+
 (domain?'<img src="https://'+esc(domain)+'/favicon.ico" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+'</span>';
}
function present(j:Job){
 let v=fromCache("title",j.title);
 if(!v){const translation=translateTitleRules(j.title);
  v={translated:translation,mode:translation==="职位名称待翻译"?"pending":"rules"};
  toCache("title",j.title,translation,v.mode);
 }
 const normalized=professionalTitle(j.title,v.translated);if(v.mode==="machine"&&normalized!==v.translated)toCache("title",j.title,normalized,"machine");
 const reviewed=Boolean(approvedTerminology[j.title.trim()]);
 const translationMode=reviewed&&v.mode==="pending"?"rules":v.mode;
 if(reviewed&&v.mode==="pending")toCache("title",j.title,normalized,"rules");
 return {...j,titleZh:normalized,titleStatus:translationMode,
  locationZh:translateLocation(j.location),companyZh:companyZh[j.company]||j.company};
}
const searchAliases:Record<string,string[]>={
 "销售":["sales","business development","account executive"],
 "财务":["finance","financial","accounting","accountant"],
 "工程师":["engineer","engineering","developer"],
 "实习":["intern","internship","graduate"],
 "数据分析":["data analyst","analytics","data scientist","business intelligence"],
 "市场":["marketing","growth"],"产品":["product"],
 "设计":["designer","design"],"运营":["operations"],
 "人力资源":["human resources","recruiter","talent"],
 "风控":["risk","fraud"],"合规":["compliance"],
 "支付":["payment","payments"],"经理":["manager"],
 "法务":["legal","counsel"]
};

type Board={platform:"greenhouse"|"ashby"|"lever";company:string;slug:string};
const boards:Board[]=[
 {platform:"greenhouse",company:"Greenhouse",slug:"greenhouse"},
 {platform:"ashby",company:"Ashby",slug:"ashby"},
 {platform:"lever",company:"Spotify",slug:"spotify"},
 {platform:"greenhouse",company:"Canonical",slug:"canonical"},
 {platform:"ashby",company:"Airwallex",slug:"airwallex"},
 {platform:"lever",company:"Palantir",slug:"palantir"},
 {platform:"greenhouse",company:"Figma",slug:"figma"},
 {platform:"greenhouse",company:"Anduril",slug:"andurilindustries"},
 {platform:"greenhouse",company:"Discord",slug:"discord"},
 {platform:"greenhouse",company:"Reddit",slug:"reddit"},
 {platform:"greenhouse",company:"Airtable",slug:"airtable"},
 {platform:"greenhouse",company:"Flexport",slug:"flexport"},
 {platform:"greenhouse",company:"Robinhood",slug:"robinhood"},
 {platform:"greenhouse",company:"GitLab",slug:"gitlab"},
 {platform:"greenhouse",company:"Twilio",slug:"twilio"},
 {platform:"greenhouse",company:"Cloudflare",slug:"cloudflare"},
 {platform:"greenhouse",company:"Vercel",slug:"vercel"},
 {platform:"greenhouse",company:"Gusto",slug:"gusto"},
 {platform:"greenhouse",company:"Wise",slug:"wise"},
 {platform:"greenhouse",company:"Coursera",slug:"coursera"},
 {platform:"ashby",company:"OpenAI",slug:"openai"},
 {platform:"ashby",company:"Notion",slug:"notion"},
 {platform:"ashby",company:"Ramp",slug:"ramp"},
 {platform:"ashby",company:"Linear",slug:"linear"},
 {platform:"ashby",company:"Perplexity",slug:"perplexity"},
 {platform:"ashby",company:"ElevenLabs",slug:"elevenlabs"},
 {platform:"ashby",company:"Vanta",slug:"vanta"},
 {platform:"ashby",company:"Harvey",slug:"harvey"},
 {platform:"ashby",company:"Headway",slug:"headway"},
 {platform:"lever",company:"Binance",slug:"binance"},
 {platform:"ashby",company:"Cognition",slug:"cognition"},
 {platform:"ashby",company:"Replit",slug:"replit"},
 {platform:"ashby",company:"PostHog",slug:"posthog"},
 {platform:"ashby",company:"ClickUp",slug:"clickup"}
];
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const urlOK=(value:unknown,slug:string,platform:string)=>{
 try {let u=new URL(String(value||""));let hosts=platform==="greenhouse"?["job-boards.greenhouse.io","boards.greenhouse.io","boards.eu.greenhouse.io"]:platform==="ashby"?["jobs.ashbyhq.com"]:["jobs.lever.co","jobs.eu.lever.co"];
 return u.protocol==="https:"&&!u.username&&!u.password&&hosts.includes(u.hostname)&&u.pathname.split("/").includes(slug)?u.href:null;}catch{return null;}
};
function id(platform:string,slug:string,uid:unknown){return platform+"-"+slug+"-"+String(uid||"").slice(0,85);}
function normalize(board:Board,x:any):Job|null{
 const title=board.platform==="lever"?x?.text:x?.title;
 const native=x?.id;
 const url=board.platform==="greenhouse"?x?.absolute_url:board.platform==="ashby"?x?.jobUrl:x?.hostedUrl;
 const safe=urlOK(url,board.slug,board.platform);
 if(!safe||!title||!native||x?.isListed===false)return null;
 const location=board.platform==="lever"?x?.categories?.location:board.platform==="greenhouse"?x?.location?.name:x?.location;
 const remote=typeof x?.isRemote==="boolean"?x.isRemote:typeof x?.workplaceType==="string"?x.workplaceType.toLowerCase()==="remote":null;
 return {id:id(board.platform,board.slug,native),company:board.company,title:String(title).slice(0,220),
  location:typeof location==="string"?location.slice(0,170):"未披露",
  remote,url:safe,platform:board.platform,source:board.slug};
}
async function getBoard(b:Board):Promise<Job[]>{
 const endpoint=b.platform==="greenhouse"?"https://boards-api.greenhouse.io/v1/boards/"+encodeURIComponent(b.slug)+"/jobs":
 b.platform==="ashby"?"https://api.ashbyhq.com/posting-api/job-board/"+encodeURIComponent(b.slug):
 "https://api.lever.co/v0/postings/"+encodeURIComponent(b.slug)+"?mode=json";
 // Larger boards such as Anduril (>2,500 roles) sometimes exceed the
 // previous 12-second deadline. Allow two bounded attempts, with a short
 // backoff only on transient failures. Invalid responses never count as 0 jobs.
 const perAttemptTimeout=b.slug==="andurilindustries"?30000:19000;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const resp=await fetch(endpoint,{
    headers:{"Accept":"application/json","User-Agent":"HHBA-public-job-index/0.3"},
    signal:AbortSignal.timeout(perAttemptTimeout),redirect:"error"
   });
   if(!resp.ok){
    if((resp.status===429||resp.status>=500)&&attempt===0){await Bun.sleep(1100);continue;}
    throw Error("ATS_HTTP_"+resp.status);
   }
   if(Number(resp.headers.get("content-length")||0)>16000000)throw Error("ATS_BOARD_TOO_LARGE");
   const body=await resp.json() as any;
   const arr=Array.isArray(body)?body:Array.isArray(body?.jobs)?body.jobs:null;
   if(!arr)throw Error("ATS_INVALID_JOB_ARRAY");
   const valid=arr.slice(0,3000).map((x:any)=>normalize(b,x)).filter((x:Job|null):x is Job=>!!x);
   if(arr.length>0&&valid.length===0)throw Error("ATS_NO_VALID_OFFICIAL_JOBS");
   if(attempt>0)console.log("HHBA_ATS_BOARD_RECOVERED",JSON.stringify({platform:b.platform,slug:b.slug,jobs:valid.length,attempts:attempt+1}));
   return valid;
  }catch(e){
   if(attempt===1||String((e as Error)?.message||"").includes("ATS_HTTP_4")||
      String((e as Error)?.message||"").includes("ATS_BOARD_TOO_LARGE")||
      String((e as Error)?.message||"").includes("ATS_INVALID_JOB_ARRAY")||
      String((e as Error)?.message||"").includes("ATS_NO_VALID_OFFICIAL_JOBS"))throw e;
   await Bun.sleep(1100);
  }
 }
 throw Error("ATS_RETRY_EXHAUSTED");
}
let cache:{at:number;rows:Job[];boards:number;failures:number;updated:string}|null=null;
let inflight:Promise<typeof cache>|null=null;
async function load(){
 if(cache&&Date.now()-cache.at<(cache.failures?60*1000:10*60*1000))return cache;
 if(inflight)return await inflight;
 inflight=(async()=>{
  // Limit simultaneous outbound ATS requests to avoid overwhelming boards.
  // Failed boards are isolated; all jobs retain their exact source identity.
  const outcomes:PromiseSettledResult<Job[]>[]=new Array(boards.length);
  let next=0;
  const worker=async()=>{while(next<boards.length){const i=next++;
    try{outcomes[i]={status:"fulfilled",value:await getBoard(boards[i])};}
    catch(e){outcomes[i]={status:"rejected",reason:e};}
  }};
  await Promise.all(Array.from({length:6},()=>worker()));
  const rows:Job[]=[];const seen=new Set<string>();let ok=0,failed=0;
  outcomes.forEach((o,i)=>{if(o.status==="fulfilled"){ok++;for(const j of o.value){if(!seen.has(j.url)){seen.add(j.url);rows.push(j);}}}else {
   failed++;console.warn("HHBA_ATS_BOARD_FAILED",JSON.stringify({platform:boards[i].platform,slug:boards[i].slug,reason:String(o.reason?.name||"unknown")}));
  }});
  rows.sort((a,b)=>a.company.localeCompare(b.company)||a.title.localeCompare(b.title));
  if(ok===0&&cache)return cache;
  cache={at:Date.now(),rows,boards:ok,failures:failed,updated:new Date().toISOString()};
  return cache;
 })();
 try{return await inflight;}finally{inflight=null;}
}

type Detail={job:Job;description:string;richHtml:string;applyUrl:string|null;status:"LIVE_CONTENT"|"DESCRIPTION_UNAVAILABLE";checkedAt:string};
// Read the official published job on the user's click. No local JD corpus,
// no untrusted URL parameters, no AI paraphrase and no fabricated sections.
function approvedApplyUrl(value:unknown,b:Board):string|null{
 return urlOK(value,b.slug,b.platform);
}
async function officialDetail(job:Job):Promise<Detail|null>{
 const board=boards.find(b=>b.slug===job.source&&b.platform===job.platform);
 if(!board)return null;
 const native=job.id.slice(board.platform.length+board.slug.length+2);
 if(!native || native.length>100 || !/^[A-Za-z0-9_-]+$/.test(native))return null;
 const api=board.platform==="greenhouse"
  ?"https://boards-api.greenhouse.io/v1/boards/"+encodeURIComponent(board.slug)+"/jobs/"+encodeURIComponent(native)+"?content=true"
  :board.platform==="lever"
  ?"https://api.lever.co/v0/postings/"+encodeURIComponent(board.slug)+"/"+encodeURIComponent(native)+"?mode=json"
  :"https://api.ashbyhq.com/posting-api/job-board/"+encodeURIComponent(board.slug);
 try{
  const r=await fetch(api,{headers:{"Accept":"application/json","User-Agent":"HHBA-job-detail/0.2"},
   signal:AbortSignal.timeout(12000),redirect:"error"});
  if(!r.ok||Number(r.headers.get("content-length")||0)>8000000)return null;
  const body=await r.json() as any;
  const raw=board.platform==="ashby"?(Array.isArray(body?.jobs)?
    body.jobs.find((x:any)=>String(x?.id)===native&&x?.isListed!==false):null):body;
  if(!raw||String(raw?.id)!==native)return null;
  const title=board.platform==="lever"?raw.text:raw.title;
  const original=board.platform==="greenhouse"?raw.absolute_url:
    board.platform==="lever"?raw.hostedUrl:raw.jobUrl;
  if(!title||!urlOK(original,board.slug,board.platform)||original!==job.url)return null;
  let html="";
  if(board.platform==="greenhouse")html=typeof raw.content==="string"?raw.content:"";
  if(board.platform==="ashby")html=typeof raw.descriptionHtml==="string"?raw.descriptionHtml:"";
  if(board.platform==="lever"){
    const pieces=[];
    if(typeof raw.description==="string")pieces.push(raw.description);
    else if(typeof raw.descriptionPlain==="string")pieces.push(raw.descriptionPlain);
    if(Array.isArray(raw.lists)){
      for(const item of raw.lists.slice(0,50)){
        if(typeof item?.text==="string")pieces.push("<h3>"+esc(item.text)+"</h3>");
        if(typeof item?.content==="string")pieces.push(item.content);
      }
    }
    if(typeof raw.additional==="string")pieces.push(raw.additional);
    else if(typeof raw.additionalPlain==="string")pieces.push(raw.additionalPlain);
    if(typeof raw.salaryDescription==="string")pieces.push(raw.salaryDescription);
    html=pieces.join("\n");
  }
  const plain=board.platform==="ashby"&&typeof raw.descriptionPlain==="string"?
    raw.descriptionPlain:convert(html,{wordwrap:false,
      selectors:[{selector:"img",format:"skip"},{selector:"a",options:{hideLinkHrefIfSameAsText:true}}]});
  if(plain.length>200000||html.length>250000)return null;
  const richHtml = html.trim()?sanitizeHtml(html,{
    allowedTags:["p","div","span","br","h1","h2","h3","h4","h5","h6","strong","b","em","i","u","ul","ol","li","blockquote","hr","table","thead","tbody","tr","td","th","pre","code","a"],
    allowedAttributes:{"a":["href","title","target","rel"]},
    allowedSchemes:["https","mailto"],
    transformTags:{"a":(_tag,atts)=>({tagName:"a",attribs:{href:atts.href||"",target:"_blank",rel:"noopener noreferrer nofollow"}})}
  }):"";
  return {job,description:plain,richHtml,status:plain.trim()?"LIVE_CONTENT":"DESCRIPTION_UNAVAILABLE",
   applyUrl:approvedApplyUrl(raw.applyUrl,board),
   checkedAt:new Date().toISOString()};
 }catch{return null;}
}
function detailHtml(d:Detail,zhFull:string|null):string{
 const j=d.job;
 const name=present(j);
 const official=esc(j.url),apply=esc(d.applyUrl||j.url);
 const body=d.status==="LIVE_CONTENT"?
   '<div class="full-jd">'+(d.richHtml||esc(d.description))+'</div>':
   '<p class="missing">这个职位的官方接口暂未提供可展示的完整 JD，请直接阅读原始企业页面。</p>';
 return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="robots" content="noindex,nofollow">'+
  '<title>'+esc(j.title)+' · '+esc(j.company)+' · HHBA</title><style>'+
  '*{box-sizing:border-box}body{margin:0;background:#f5f7f4;color:#173627;font-family:system-ui,"PingFang SC","Microsoft Yahei",sans-serif}'+
  'header{background:#fff;border-bottom:1px solid #e4eae3;padding:22px max(5%,calc((100% - 1080px)/2))}'+
  'header a{text-decoration:none;color:#204c37;font-size:24px;font-weight:900}.wrap{max-width:940px;margin:0 auto;padding:34px 20px 75px}.lang-toggle{display:flex;gap:5px;background:#eaf3eb;border-radius:9px;padding:5px;margin:12px 0 0;width:fit-content}.lang-toggle button{font:inherit;font-size:13px;background:transparent;border:0;border-radius:7px;padding:9px 18px;color:#4d7660;font-weight:800;cursor:pointer}.lang-toggle button.selected{background:#1d6340;color:#fff}.lang-panel[hidden]{display:none}'+
  '.detail-company-row{display:flex;align-items:center;gap:13px;margin:0 0 8px}.detail-company-row .eyebrow{margin:0}'+
  '.company-logo{position:relative;width:52px;height:52px;flex:0 0 52px;border:1px solid #e3eae5;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;background:#f3f6f4}.company-initials{color:#476859;font-size:15px;font-weight:800}.company-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:9px;background:#fff}.company-logo.logo-fallback img{display:none}'+
  '.back{text-decoration:none;color:#4a7760;font-size:13px;font-weight:700}.hero{padding:35px 0 25px}'+
  '.eyebrow{color:#649477;font-size:13px;font-weight:750}.hero h1{font-size:clamp(27px,4vw,40px);line-height:1.3;margin:13px 0}'+
  '.meta{color:#5e786b;line-height:1.8;font-size:14px}.panel{background:#fff;border:1px solid #e4eae3;border-radius:14px;padding:clamp(20px,4vw,42px)}'+
  '.panel h2{font-size:21px;margin:0 0 10px}.source{color:#819185;font-size:12px;margin:0 0 28px}'+
  '.full-jd{overflow-wrap:anywhere;line-height:1.85;font-size:15px;color:#304539}.full-jd p{margin:12px 0}.full-jd li{margin:7px 0}.full-jd h2,.full-jd h3{margin-top:28px}.full-jd a{color:#147343;text-decoration:underline}'+
  '#jd-zh .full-jd{white-space:normal;line-height:1.66;letter-spacing:0;word-break:normal}'+
  '#jd-zh .jd-heading{font-size:16px;font-weight:750;color:#173627;line-height:1.5;margin:22px 0 10px}'+
  '#jd-zh .jd-heading:first-child{margin-top:0}'+
  '#jd-zh .jd-paragraph{line-height:1.66;margin:0 0 10px}'+
  '#jd-zh .jd-bullet{position:relative;padding-left:1.1em;margin:0 0 10px;line-height:1.66}'+
  '#jd-zh .jd-bullet::before{content:"•";position:absolute;left:0;color:#468061;font-weight:900}'+
  '@media(max-width:600px){#jd-zh .full-jd{font-size:15px;line-height:1.63}#jd-zh .jd-paragraph,#jd-zh .jd-bullet{line-height:1.63;margin-bottom:9px}#jd-zh .jd-heading{margin:20px 0 9px}}'+
  '.missing{line-height:1.8;color:#7b7656}.reader-original{border-top:1px solid #e4eae3;margin-top:24px;padding-top:15px}.reader-original summary{color:#1e6740;cursor:pointer;font-size:14px;font-weight:750;margin:8px 0 14px}.reader-retry{padding:9px 14px;border:1px solid #b3d7c1;background:#e7f4e9;border-radius:8px;color:#1e6740;font-weight:750;cursor:pointer}.reader-retry[hidden]{display:none}#translation-progress{font-size:13px;color:#537b64}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:27px}'+
  '.btn{display:inline-block;text-decoration:none;border-radius:9px;padding:13px 20px;font-weight:800;font-size:14px;background:#1e6740;color:white}'+
  '.btn.secondary{color:#1e6740;background:#e7f4e9}.notice{font-size:12px;color:#74857a;line-height:1.8;margin-top:25px}'+
  '</style></head><body><header><a href="/">HHBA <small id="detail-brand" style="font-size:13px;font-weight:400;color:#728d79">· 招聘市场</small></a></header>'+
  '<main class="wrap"><a id="detail-back" class="back" href="/">← 返回招聘市场</a>'+
  '<section class="hero"><div class="detail-company-row">'+employerLogo(j.company)+'<div class="eyebrow">'+esc(j.company)+' · '+esc(j.platform.toUpperCase())+'</div></div>'+
  '<h1 id="detail-title" data-en="'+esc(j.title)+'" data-zh="'+esc(name.titleZh)+'">'+esc(name.titleZh)+'</h1><div class="meta">📍 <span id="detail-place" data-en="'+esc(j.location)+'" data-zh="'+esc(name.locationZh)+'">'+esc(name.locationZh)+'</span> · <span id="detail-remote" data-value="'+String(j.remote)+'">'+(j.remote===true?'远程':j.remote===false?'非远程':'远程方式未标明')+'</span></div></section>'+
  '<section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px">'+
  '<h2 id="jd-label">岗位完整描述</h2>'+
  '<div class="lang-toggle"><button id="detail-zh" type="button" class="selected">中文</button><button id="detail-en" type="button">English</button></div></div>'+
  '<p id="detail-source" class="source" data-check="'+esc(d.checkedAt)+'">企业官方岗位 · 读取时间 '+esc(d.checkedAt)+' · 中文机器译文仅供参考</p>'+
  '<div class="lang-panel" id="jd-zh">'+
  (zhFull?'<div id="licensed-zh-jd" class="full-jd">'+esc(zhFull)+'</div>':
   '<div id="personal-reader" data-job="'+esc(j.id)+'" data-hash="'+createHash("sha256").update(d.description).digest("hex")+'">'+
  '<p id="translation-note" class="source">正在准备这条岗位的中文即时翻译，内容将逐段显示。翻译仅供个人辅助阅读，具体条件以企业官方原文为准。</p>'+
  '<p id="translation-progress" role="status" aria-live="polite">正在连接翻译服务…</p>'+
  '<div id="translated-paragraphs" class="full-jd" aria-label="已翻译的中文岗位内容"></div>'+
  '<button id="retry-translation" class="reader-retry" hidden type="button">重新尝试翻译</button>'+
  ''+
  '<p id="numeric-risk" class="missing" hidden>部分关键数字可能与原文不同，请切换英文核对具体条件。</p>'+
  '<button type="button" id="show-original-english" class="reader-retry">切换英文核对官方原文</button>'+
  '<p class="source">中文机器译文仅供辅助理解。薪资、签证及工作经验等具体条件，以企业官方原文为准。</p></div>')+
  '</div><div class="lang-panel" id="jd-en" hidden>'+body+'</div></section>'+
  '<div class="actions"><a id="detail-apply" class="btn" href="'+apply+'" target="_blank" rel="noopener noreferrer">前往企业官网申请 ↗</a>'+
  '<a id="detail-official" class="btn secondary" href="'+official+'" target="_blank" rel="noopener noreferrer">查看对应官方职位页 ↗</a></div>'+
  '<p id="detail-disclaimer" class="notice">资料来自企业公开招聘系统，机器翻译仅供辅助阅读。申请资格及最终岗位状态以企业官网为准；HHBA 不代表招聘企业。</p></main>'+
  '<script>'+ "(function(){\ndocument.addEventListener(\"error\",function(e){const t=e.target;if(t&&t.tagName===\"IMG\"&&t.closest(\".company-logo\"))t.closest(\".company-logo\").classList.add(\"logo-fallback\");},true);\nlet lang=\"zh\";\ntry{lang=localStorage.getItem(\"hhba-lang\")===\"en\"?\"en\":\"zh\"}catch{}\nconst reader=document.querySelector(\"#personal-reader\");\nconst retry=document.querySelector(\"#retry-translation\");\nconst note=document.querySelector(\"#translation-note\");\nconst progress=document.querySelector(\"#translation-progress\");\nconst output=document.querySelector(\"#translated-paragraphs\");\nconst numericRisk=document.querySelector(\"#numeric-risk\");\nconst originalButton=document.querySelector(\"#show-original-english\");\nlet numericIssues=0;\nlet inflight=null;\n\nfunction renderChineseJD(raw,host=output){\n if(!host)return;\n // Text nodes only; no translated third-party HTML enters the DOM.\n // Blank lines come from both ATS extraction and machine translation.\n const lines=String(raw||\"\").replace(/\\r\\n?/g,\"\\n\").replace(/\\u00a0/g,\" \")\n  .replace(/[ \\t]+\\n/g,\"\\n\").split(\"\\n\");\n const fragment=document.createDocumentFragment();\n let previous=null,wasBlank=false;\n function append(kind,text){\n  const el=document.createElement(kind===\"heading\"?\"h3\":\"div\");\n  el.className=kind===\"heading\"?\"jd-heading\":kind===\"bullet\"?\"jd-bullet\":\"jd-paragraph\";\n  el.textContent=text;\n  fragment.appendChild(el);\n  previous={kind,element:el};\n }\n for(const rawLine of lines){\n  let line=rawLine.trim().replace(/[ \\t]{2,}/g,\" \");\n  if(!line){wasBlank=true;continue;}\n  // An isolated dot is a translation/HTML-to-text artefact, not a JD item.\n  if(/^[.。．]{1,2}$/.test(line)||/^[-–—•●▪]\\s*$/.test(line)){wasBlank=true;continue;}\n  const heading=line.match(/^#{1,4}\\s*(.+)$/);\n  if(heading)line=heading[1].trim();\n  const isHeading=!!heading||(\n   line.length<=32&&(\n    /[：:]$/.test(line)||\n    /^(岗位职责|主要职责|任职资格|任职要求|资格条件|岗位要求|福利待遇|职位介绍|工作内容|基本要求|优先条件|关于我们|关于团队|薪资待遇|工作职责|申请要求)$/.test(line)\n   ));\n  if(isHeading){\n   append(\"heading\",line);\n   wasBlank=false;continue;\n  }\n  const bullet=line.match(/^(?:[-–—•●▪*]\\s+|[0-9]{1,2}[.)、]\\s+)(.+)$/);\n  if(bullet){\n   append(\"bullet\",bullet[1].trim());\n   wasBlank=false;continue;\n  }\n  // Line breaks inside a single list item or paragraph should not become\n  // huge separate vertical blocks; preserve actual section boundaries.\n  if(previous&&!wasBlank&&(previous.kind===\"bullet\"||previous.kind===\"paragraph\")){\n   const prior=previous.element.textContent||\"\";\n   const space=/[A-Za-z0-9]$/.test(prior)&&/^[A-Za-z0-9]/.test(line)?\" \":\"\";\n   previous.element.textContent=prior+space+line;\n  }else append(\"paragraph\",line);\n  wasBlank=false;\n }\n host.replaceChildren(fragment);\n}\n\nasync function translate(){\n if(!reader||reader.dataset.done===\"true\")return;\n if(inflight)return inflight;\n inflight=(async()=>{\n   if(retry)retry.hidden=true;\n   if(numericRisk)numericRisk.hidden=true;\n   numericIssues=0;\n   let parts=[],part=0,total=1;\n   let saved=null;\n   const storageKey=\"hhba-reader-v2-chinese-only:\"+reader.dataset.job+\":\"+reader.dataset.hash;\n   try{saved=sessionStorage.getItem(storageKey)}catch{}\n   if(saved&&output){renderChineseJD(saved);progress.textContent=\"中文译文已加载（本次浏览会话缓存）\";note.textContent=\"这是机器即时翻译，请核对对应的英文原文。\";reader.dataset.done=\"true\";return;}\n   if(output)output.textContent=\"\";\n   try{\n    while(part<total){\n     let response=null;\n     for(let trial=0;trial<2;trial++){\n      response=await fetch(\"/api/jobs/\"+encodeURIComponent(reader.dataset.job)+\"/translate-part\",{\n       method:\"POST\",credentials:\"same-origin\",\n       headers:{\"Content-Type\":\"application/json\"},\n       body:JSON.stringify({part,sourceHash:reader.dataset.hash})\n      });\n      if(response.status!==429)break;\n      await new Promise(r=>setTimeout(r,3000));\n     }\n     if(!response||!response.ok){\n      let payload={};try{payload=await response.json()}catch{}\n      if(payload.error===\"source_changed\")throw Error(\"官方岗位内容已更新，请刷新页面重试。\");\n      if(payload.error===\"source_too_long\")throw Error(\"这条官方职位描述过长，暂无法完整翻译。请切换英文查看企业官方原文。\");\n      if(payload.error===\"translation_incomplete\")throw Error(\"检测到本段仍包含未翻译的英文长句。系统没有把不完整译文当成中文显示，请重试或切换英文。\");\n      throw Error(\"第 \"+(part+1)+\" 段翻译暂时失败，可以重试或查看完整英文原文。\");\n     }\n     const result=await response.json();\n     if(result.jobId!==reader.dataset.job||result.sourceHash!==reader.dataset.hash||\n        result.part!==part||!Number.isInteger(result.total)||result.total<1||result.total>80||\n        typeof result.text!==\"string\")throw Error(\"译文与当前岗位版本不一致，请刷新页面。\");\n     if(part===0)total=result.total;\n     if(result.total!==total)throw Error(\"官方岗位在翻译过程中发生变化，请刷新页面。\");\n     if(result.numbersVerified===false){numericIssues++;if(numericRisk)numericRisk.hidden=false;}\n     parts.push(result.text);\n     if(output)renderChineseJD(parts.join(\"\\n\"));\n     part++;\n     if(progress)progress.textContent=\"已翻译 \"+part+\" / \"+total+\" 段\";\n    }\n    const complete=parts.join(\"\\n\");\n    if(reader&&complete.trim()){\n     try{sessionStorage.setItem(storageKey,complete)}catch{}\n     reader.dataset.done=\"true\";\n     if(note)note.textContent=\"中文即时翻译已完成（机器译文，仅供辅助理解）。请对照英文原文核对招聘条件。\";\n     if(progress)progress.textContent=\"已完成 \"+total+\" / \"+total+\" 段\";\n    }\n   }catch(err){\n     if(note)note.textContent=err.message||\"翻译暂时不可用。\";\n     if(progress)progress.textContent=parts.length?\"当前已完成 \"+parts.length+\" 段。其余内容请查看下方完整原文。\":\"下面可以直接展开完整官方英文原文。\";\n     if(retry)retry.hidden=false;\n   }\n })();\n try{return await inflight}finally{inflight=null}\n}\nfunction set(v){\n lang=v===\"en\"?\"en\":\"zh\";\n try{localStorage.setItem(\"hhba-lang\",lang)}catch{}\n document.querySelector(\"#jd-zh\").hidden=lang!==\"zh\";\n document.querySelector(\"#jd-en\").hidden=lang!==\"en\";\n document.querySelector(\"#detail-zh\").classList.toggle(\"selected\",lang===\"zh\");\n document.querySelector(\"#detail-en\").classList.toggle(\"selected\",lang===\"en\");\n document.querySelector(\"#detail-title\").textContent=document.querySelector(\"#detail-title\").dataset[lang];\n document.querySelector(\"#detail-place\").textContent=document.querySelector(\"#detail-place\").dataset[lang];\n const labels={\n \"#detail-brand\":[\"· 招聘市场\",\"· Job Marketplace\"],\n \"#detail-back\":[\"← 返回招聘市场\",\"← Back to jobs\"],\n \"#jd-label\":[\"岗位完整描述\",\"Full job description\"],\n \"#detail-apply\":[\"前往企业官网申请 ↗\",\"Apply on employer website ↗\"],\n \"#detail-official\":[\"查看对应官方职位页 ↗\",\"View original job posting ↗\"],\n \"#detail-disclaimer\":[\"资料来自企业公开招聘系统，机器翻译仅供辅助阅读。申请资格及最终岗位状态以企业官网为准；HHBA 不代表招聘企业。\",\"Information comes from public employer job boards. HHBA is not affiliated with employers. Requirements and availability are governed by the official posting.\"]\n};\nfor(const [selector,pair] of Object.entries(labels)){\n const element=document.querySelector(selector);\n if(element)element.textContent=pair[lang===\"en\"?1:0];\n}\nconst source=document.querySelector(\"#detail-source\");\nif(source)source.textContent=lang===\"zh\"?\"企业官方岗位 · 读取时间 \"+source.dataset.check+\" · 中文机器译文仅供参考\":\n \"Original employer posting · Retrieved \"+source.dataset.check+\" · English source text\";\nconst remote=document.querySelector(\"#detail-remote\");\nif(remote){const value=remote.dataset.value;\n remote.textContent=value===\"true\"?(lang===\"en\"?\"Remote\":\"远程\"):\n value===\"false\"?(lang===\"en\"?\"Not remote\":\"非远程\"):\n (lang===\"en\"?\"Remote unspecified\":\"远程方式未标明\");}\ndocument.documentElement.lang=lang===\"en\"?\"en\":\"zh-CN\";\ndocument.title=document.querySelector(\"#detail-title\").textContent+\" · HHBA\";\nif(lang===\"zh\"&&reader)void translate();\n}\ndocument.querySelector(\"#detail-zh\").onclick=()=>set(\"zh\");\ndocument.querySelector(\"#detail-en\").onclick=()=>set(\"en\");\nif(retry)retry.onclick=()=>{reader.dataset.done=\"false\";void translate()};\nif(originalButton)originalButton.onclick=()=>set(\"en\");\nconst licensed=document.querySelector(\"#licensed-zh-jd\");\nif(licensed)renderChineseJD(licensed.textContent,licensed);\nset(lang);\n})()" +'</script></body></html>';
}



const HHBA_TRANSLATOR_URL=Bun.env.HHBA_TRANSLATOR_URL||"";
function privateTranslatorUrl():string|null{
 if(!HHBA_TRANSLATOR_URL)return null;
 try{
  const u=new URL(HHBA_TRANSLATOR_URL);
  if(u.protocol!=="http:"||u.hostname!=="hhba-translator.railway.internal"||u.port!=="5000"||
     u.pathname!=="/"||u.search||u.hash||u.username||u.password)return null;
  return u.origin;
 }catch{return null;}
}
function numberTokens(value:string):string[]{
 return (value.match(/\d+(?:[.,]\d+)*(?:%|％)?/g)||[]).sort();
}
function numbersRetained(original:string,translated:string):boolean{
 const b=numberTokens(translated);
 return numberTokens(original).every(x=>b.includes(x));
}
// Local Argos-powered machine translation. Never sends content to a
// generative model, never accepts a request-supplied server URL.
async function machineTranslations(kind:"title"|"jd",sources:string[]):Promise<(string|null)[]|null>{
 const url=privateTranslatorUrl();
 if(!url||sources.length<1||sources.length>8)return null;
 if(sources.some(x=>!x||x.length>(kind==="jd"?11000:320)))return null;
 try{
  const response=await fetch(url+"/translate",{
   method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify({q:sources,source:"en",target:"zh",format:"text"}),
   signal:AbortSignal.timeout(kind==="jd"?80000:45000),redirect:"error",
  });
  if(!response.ok||Number(response.headers.get("content-length")||0)>180000){console.log("HHBA_MT_HTTP",response.status);return null;}
  const output=await response.json() as any;
  const arr=Array.isArray(output?.translatedText)?output.translatedText:
            sources.length===1&&typeof output?.translatedText==="string"?[output.translatedText]:null;
  if(!arr||arr.length!==sources.length)return null;
  return arr.map((x,i)=>typeof x==="string"&&x.length>1&&/[\u3400-\u9fff]/.test(x)&&(kind==="jd"||numbersRetained(sources[i],x))?x:null);
 }catch(ex){
  console.log("HHBA_MT_UNAVAILABLE",ex instanceof Error?ex.name:"unknown");
  return null;
 }
}
let titleWorkerRunning=false;
let scheduledTitleCount=0;
let workerLastFailure=0;
const translationNeedsReview=new Set<string>();
const MAX_TITLE_MACHINE_TRANSLATIONS_PER_DAY=320;
try{
 translationDb?.exec("CREATE TABLE IF NOT EXISTS machine_title_budget(day TEXT PRIMARY KEY,requested INTEGER NOT NULL DEFAULT 0)");
}catch(e){console.log("HHBA_TITLE_BUDGET_SETUP_ERROR",e instanceof Error?e.name:"unknown");}
function titleTranslationBudget(){
 if(!translationDb)return {date:"",remaining:0};
 const date=new Date().toISOString().slice(0,10);
 try{
  const row=translationDb.query("SELECT requested FROM machine_title_budget WHERE day=?").get(date) as any;
  return {date,remaining:Math.max(0,MAX_TITLE_MACHINE_TRANSLATIONS_PER_DAY-Number(row?.requested||0))};
 }catch{return {date,remaining:0};}
}
function reserveTitleBudget(date:string,count:number){
 if(!translationDb||count<1)return false;
 try{
  translationDb.query("INSERT INTO machine_title_budget(day,requested) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET requested=requested+excluded.requested").run(date,count);
  return true;
 }catch{return false;}
}
async function fillTitleTranslations(rows:Job[]){
 if(!privateTranslatorUrl()||titleWorkerRunning||!translationDb||
    (Date.now()-workerLastFailure<3*60*1000))return;
 const available=titleTranslationBudget();
 if(available.remaining<=0)return;
 titleWorkerRunning=true;
 try{
  // First translate titles whose dictionary fallback has zero Chinese.
  // Remaining terminology-only titles are translated gradually at a fixed
  // daily compute budget; all translations are saved by original text hash.
  const unique=[...new Set(rows.map(x=>x.title))];
  const pending=unique.filter(t=>fromCache("title",t)?.mode!=="machine"&&!translationNeedsReview.has(t));
  pending.sort((a,b)=>{
   const aData=fromCache("title",a),bData=fromCache("title",b);
   const am=aData?.mode||(translateTitleRules(a)==="职位名称待翻译"?"pending":"rules");
   const bm=bData?.mode||(translateTitleRules(b)==="职位名称待翻译"?"pending":"rules");
   return Number(bm==="pending")-Number(am==="pending");
  });
  const queue=pending.slice(0,Math.min(available.remaining,96));
  let translated=0,attempted=0;
  for(let i=0;i<queue.length;i+=4){
   const batch=queue.slice(i,i+4);
   if(!reserveTitleBudget(available.date,batch.length))break;
   attempted+=batch.length;
   const results=await machineTranslations("title",batch);
   if(!results){workerLastFailure=Date.now();
    console.log("HHBA_MT_BATCH_PAUSED",JSON.stringify({offset:i,count:batch.length}));break;}
   batch.forEach((source,n)=>{
    const txt=results[n];
    if(txt){toCache("title",source,professionalTitle(source,txt),"machine");translated++;scheduledTitleCount++;}
    else translationNeedsReview.add(source);
   });
   if(i+4<queue.length)await Bun.sleep(1450);
  }
  console.log("HHBA_MT_TITLES",JSON.stringify({attempted,translated,completedSinceStart:scheduledTitleCount,
    remainingDailyBudget:titleTranslationBudget().remaining,persistent:!!translationDb}));
 }catch(e){workerLastFailure=Date.now();
  console.log("HHBA_MT_WORKER_ERROR",e instanceof Error?e.name:"unknown");
 }finally{titleWorkerRunning=false;}
}

function licensedJd(d:Detail):boolean{
 // This registry is operator-owned inside the mounted volume. It has no
 // HTTP write route, and metadata-only rights are explicitly insufficient.
 try{
  const raw=readFileSync("/data/hhba-jd-rights.json");
  if(raw.length>200000)return false;
  const manifest=JSON.parse(raw.toString("utf8")) as any;
  if(manifest.schema_version!==1||manifest.mode!=="HHBA_TRANSLATED_JD_RIGHTS"||
     !Array.isArray(manifest.grants))return false;
  const grant=manifest.grants.find((g:any)=>g?.job_id===d.job.id);
  if(!grant||grant.rights_scope!=="FULL_JD_TRANSLATION_AND_REPUBLICATION"||
     grant.permission_confirmed!==true||
     grant.original_source_url!==d.job.url||
     grant.source_sha256!==createHash("sha256").update(d.description).digest("hex")||
     !grant.grant_reviewed_at||!grant.rights_expires_at||
     !(Date.parse(grant.grant_reviewed_at)<=Date.now()&&Date.parse(grant.rights_expires_at)>Date.now())||
     !grant.reviewer||!grant.publisher||grant.reviewer===grant.publisher||
     !grant.rights_holder)return false;
  // Permission documentation must be physically present and hash-matched,
  // not merely asserted in a JSON boolean.
  if(typeof grant.permission_evidence_sha256!=="string"||
     !/^[a-f0-9]{64}$/.test(grant.permission_evidence_sha256)||
     typeof grant.permission_evidence_filename!=="string"||
     !/^[a-zA-Z0-9_-]{1,60}\.txt$/.test(grant.permission_evidence_filename))return false;
  const evidence=readFileSync("/data/grants/"+grant.permission_evidence_filename);
  return evidence.length>0&&evidence.length<100000&&
    createHash("sha256").update(evidence).digest("hex")===grant.permission_evidence_sha256;
 }catch{return false;}
}
async function translatedDetail(d:Detail):Promise<string|null>{
 if(!licensedJd(d)||d.status!=="LIVE_CONTENT"||!d.description.trim())return null;
 const record=fromCache("jd",d.description);
 if(record?.mode==="rights-reviewed-machine")return record.translated;
 // JD translation is strictly on-demand after permission; no mass
 // republishing a third-party text to the translation cache by default.
 const result=await machineTranslations("jd",[d.description]);
 const value=result?.[0];
 if(!value||!numbersRetained(d.description,value)||!licensedJd(d))return null;
 toCache("jd",d.description,value,"rights-reviewed-machine");
 return value;
}

const page=(payload:any)=>`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HHBA · 全球招聘市场</title><meta name="description" content="HHBA 全球招聘市场：真实海外企业公开招聘职位索引，点击跳企业官网。"><style>
:root{font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:#172821;background:#f6f7f4}
*{box-sizing:border-box}body{margin:0}a{color:inherit;text-decoration:none}
nav{background:#fff;border-bottom:1px solid #e7ebe6;padding:18px max(5%,calc((100% - 1120px)/2));display:flex;align-items:center;justify-content:space-between}
.logo{font-size:24px;letter-spacing:-1.4px;font-weight:900;color:#204c37}.logo em{font-size:11px;color:#789081;letter-spacing:1px;font-style:normal;margin-left:8px}
nav .lab{font-size:12px;color:#71877b}.lang-switch{display:flex;gap:3px;background:#edf3ee;padding:4px;border-radius:9px}.lang-switch button{border:0;border-radius:7px;background:transparent;color:#537462;font-size:12px;padding:9px 15px;font-weight:800;cursor:pointer}.lang-switch button.on{background:#1e6341;color:#fff}
.hero{background:#143f2b;color:#fff;padding:70px 6% 64px}.wrap{max-width:1120px;margin:auto}.eyebrow{color:#b1e0bc;font-size:12px;letter-spacing:3px;font-weight:800}
h1{font-size:clamp(32px,5vw,52px);margin:18px 0;letter-spacing:-1px;line-height:1.2}
.hero p{color:#d5e6d9;max-width:700px;line-height:1.85;font-size:15px}
.numbers{display:flex;gap:30px;flex-wrap:wrap;margin-top:30px}.num b{font-size:28px;display:block}.num span{font-size:12px;color:#b5c8bc}
main{max-width:1120px;margin:0 auto;padding:36px 20px 90px}.filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
input,select{font:inherit;border:1px solid #d6e0d8;border-radius:10px;background:white;padding:13px 14px;outline-color:#76bd90}
input{flex:2;min-width:220px}select{flex:1;min-width:140px}.section-title{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:28px 0}
h2{font-size:20px;margin:0}.section-title span{color:#7f9085;font-size:12px}
.list{display:grid;gap:12px}
.job{background:#fff;border:1px solid #e2e8e4;border-radius:12px;padding:20px 22px;display:flex;justify-content:space-between;align-items:center;gap:22px;transition:border-color .18s,box-shadow .18s}
.job:hover{border-color:#b4cec0;box-shadow:0 4px 18px rgba(20,56,36,.045)}
.job-main{display:flex;align-items:flex-start;gap:15px;min-width:0;flex:1}
.job-body{min-width:0;flex:1}.company-logo{position:relative;width:54px;height:54px;flex:0 0 54px;border:1px solid #e5eae6;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;background:#f3f6f4}
.company-initials{color:#416b55;font-size:16px;font-weight:850;letter-spacing:-.4px}
.company-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;padding:9px}
.company-logo.logo-fallback img{display:none}
.job-title{display:inline-block;font-size:17px;font-weight:800;line-height:1.4;color:#19382a;margin:0 0 7px;overflow-wrap:anywhere}
.job-title:hover{text-decoration:underline;text-decoration-color:#6e9a7d;text-underline-offset:3px}
.company-name{font-size:13px;font-weight:650;color:#436451;margin-bottom:10px}
.job-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.job-meta span{font-size:12px;line-height:1.5;color:#6c7a71;display:inline-flex;align-items:center;gap:5px}
.job-meta span+span:before{content:"·";color:#abb5ac;margin-right:2px}
.job-source{font-size:11px;color:#97a39b;margin-top:10px;letter-spacing:.1px}
.visit{flex-shrink:0;white-space:nowrap;color:#176d40;border:1px solid #dbe8df;background:#f3f8f4;border-radius:8px;padding:10px 14px;font-size:12px;font-weight:750}
.visit:hover{background:#e5f1e8}.visit:focus-visible,.job-title:focus-visible{outline:2px solid #247e51;outline-offset:4px}
.disclaimer{font-size:12px;color:#728378;margin-top:30px;line-height:1.8}.status{padding:14px;border:1px solid #f0debd;background:#fffaf1;color:#886e40;border-radius:10px;margin-bottom:24px;font-size:12px}
.empty{padding:48px;text-align:center;color:#68776b;background:white;border-radius:12px}
footer{padding:25px;text-align:center;color:#8a9b8f;font-size:11px;border-top:1px solid #e5eae4}
@media(max-width:600px){.hero{padding:50px 22px}nav{padding:16px 22px;gap:10px;flex-wrap:wrap}.job{display:block;padding:17px}.job-main{gap:12px}.company-logo{width:48px;height:48px;flex-basis:48px}.job-title{font-size:16px}.visit{display:inline-flex;margin:15px 0 0 60px}.numbers{gap:23px}}
</style></head><body><nav><div class="logo">HHBA <em id="market-brand">招聘市场</em></div><div id="market-lab" class="lab">真实企业招聘索引 · 公测</div><div class="lang-switch" aria-label="岗位语言"><button id="toggle-zh" type="button">中文</button><button id="toggle-en" type="button">English</button></div></nav><section class="hero"><div class="wrap"><div id="market-kicker" class="eyebrow">全球职业机会 · 企业官方来源</div><h1 id="market-h1">发现全球工作机会</h1><p id="market-subtitle">搜索海外企业公开招聘岗位，在 HHBA 阅读岗位详情，再前往企业官网申请。岗位来自 Greenhouse、Lever、Ashby 的公开招聘接口。</p><div class="numbers"><div class="num"><b id="count">${payload.total}</b><span id="market-count-label">本次获取的岗位</span></div><div class="num"><b>${payload.boards}</b><span id="market-board-label">成功读取的招聘板</span></div><div class="num"><b>3</b><span id="market-source-label">官方招聘系统</span></div><div class="num"><b id="translated-count">—</b><span id="translated-label">已机器翻译职位名称</span></div></div></div></section>
<main><div id="market-status" data-updated="${esc(payload.updated)}" data-failures="${payload.failures}" class="status">默认显示中文岗位名称。术语规则翻译属于初版，未完成的翻译会标注“待翻译”；切换英文可核对官方标题。公测版说明：本次已接入 ${payload.boards} 个企业招聘板，不代表全量全球职位。最近同步：${esc(payload.updated)}。职位是否仍接受申请以企业官网为准。${payload.failures?" 有 "+payload.failures+" 个来源本轮暂不可用。":""}</div>
<div class="filters"><input id="q" aria-label="搜索岗位或企业" placeholder="搜索岗位、公司、地点（支持英文）"><select id="company" aria-label="企业"><option value="">全部企业</option></select><select id="remote" aria-label="远程筛选"><option value="">全部工作方式</option><option value="yes">标注远程</option></select></div>
<div class="section-title"><h2 id="market-list-h2">官方岗位列表</h2><span id="shown"></span></div><div class="list" id="jobs"></div><p id="market-disclaimer" class="disclaimer">数据源为外部企业公开招聘板。部分企业官网在不同网络环境下可能无法访问。岗位发布时间、工作类型、远程标记在接口未披露时不会推断，具体资格要求和投递方式请到企业官网核实。HHBA 不代表与招聘企业存在合作关系。</p></main><footer id="market-footer">HHBA · 全球职位索引 · 仅展示公开岗位资料与官网链接</footer>
<script>
let all=[],filtered=[],limit=30,totalFiltered=0,companyNames=[],latestRequest=0,searchTimer=null;
window.hhbaBoardCount=${payload.boards};
let lang='zh';
try{lang=localStorage.getItem('hhba-lang')==='en'?'en':'zh';}catch{}
const aliases=${JSON.stringify(searchAliases)};
const employerBrandSites=${JSON.stringify(employerBrandSites)};
function logoMarkup(company){
 const domain=employerBrandSites[company],initials=(String(company||'?').trim().slice(0,2)||'?').toUpperCase();
 return '<span class="company-logo" aria-hidden="true"><span class="company-initials">'+safe(initials)+'</span>'+(domain?'<img src="https://'+safe(domain)+'/favicon.ico" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+'</span>';
}
document.addEventListener('error',function(e){const t=e.target;if(t&&t.tagName==='IMG'&&t.closest('.company-logo'))t.closest('.company-logo').classList.add('logo-fallback');},true);
function setLanguage(value){
 lang=value==='en'?'en':'zh';
 try{localStorage.setItem('hhba-lang',lang);}catch{}
 document.querySelector('#toggle-zh').classList.toggle('on',lang==='zh');
 document.querySelector('#toggle-en').classList.toggle('on',lang==='en');
 document.querySelector('#q').placeholder=lang==='zh'?'搜索中文职位、公司或城市':'Search job titles, companies and cities';
 for(const option of Array.from(document.querySelector('#company').options)){if(option.value)option.textContent=lang==='zh'?(companyNames.find(x=>x.name===option.value)?.zh||option.value):option.value;}
 document.querySelector('#remote').options[0].textContent=lang==='zh'?'全部工作方式':'All work modes';
 document.querySelector('#remote').options[1].textContent=lang==='zh'?'标注远程':'Remote only';
 document.querySelector('#company').options[0].textContent=lang==='zh'?'全部企业':'All companies';
 document.querySelector('#market-h1').textContent=lang==='zh'?'发现全球工作机会':'Explore global career opportunities';
 document.querySelector('#market-subtitle').textContent=lang==='zh'?'搜索真实海外岗位，在 HHBA 阅读职位详情，再去企业官网申请。':'Search real overseas jobs, read details on HHBA, then apply on the employer website.';
 document.querySelector('#market-list-h2').textContent=lang==='zh'?'官方岗位列表':'Official job listings';
 document.querySelector('#translated-label').textContent=lang==='zh'?'已机器翻译职位名称':'Machine-translated job titles';
 const labels=[
  ['#market-brand','招聘市场','Job Marketplace'],
  ['#market-lab','真实企业招聘索引 · 公测','Official employer jobs · Beta'],
  ['#market-kicker','全球职业机会 · 企业官方来源','GLOBAL CAREERS · OFFICIAL SOURCES'],
  ['#market-count-label','本次获取的岗位','Live indexed jobs'],
  ['#market-board-label','成功读取的招聘板','Connected job boards'],
  ['#market-source-label','官方招聘系统','Recruitment platforms'],
  ['#market-footer','HHBA · 全球职位索引 · 仅展示公开岗位资料与官网链接','HHBA · Global job index · Official employer links'],
  ['#market-disclaimer','资料来源为企业公开招聘网站。实际工作条件与投递流程以对应企业官方页面为准。HHBA 与招聘企业不构成合作关系。','Data originates from public employer job boards. Job requirements and application steps are determined by the employers. HHBA is not affiliated with these companies.']
 ];
 for(const [selector,zh,en] of labels){const el=document.querySelector(selector);if(el)el.textContent=lang==='zh'?zh:en;}
 const status=document.querySelector('#market-status');
 if(status){const stamp=status.dataset.updated||'unknown',errors=Number(status.dataset.failures||0);
  status.textContent=lang==='zh'?
    '目前成功连接 '+(window.hhbaBoardCount||0)+' 家企业招聘板，不代表全球全部职位；职位是否仍在招聘以企业官网为准。最近同步：'+stamp+'。'+(errors?'本轮有'+errors+'个来源暂不可用。':''):
    'This beta currently connects '+(window.hhbaBoardCount||0)+' employer job boards, not the full global market. Confirm availability on each employer website. Last sync: '+stamp+'.'+(errors?' '+errors+' sources unavailable this refresh.':'');
 }
 document.documentElement.lang=lang==='zh'?'zh-CN':'en';
 document.title=lang==='zh'?'HHBA · 全球招聘市场':'HHBA · Global Jobs';
 document.querySelector('#q').setAttribute('aria-label',lang==='zh'?'搜索岗位和企业':'Search jobs and employers');
 document.querySelector('#company').setAttribute('aria-label',lang==='zh'?'按企业筛选':'Filter companies');
 document.querySelector('#remote').setAttribute('aria-label',lang==='zh'?'按工作方式筛选':'Filter workplace type');
 render();
}
document.querySelector('#toggle-zh').addEventListener('click',()=>setLanguage('zh'));
document.querySelector('#toggle-en').addEventListener('click',()=>setLanguage('en'));
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const q=document.querySelector("#q"),c=document.querySelector("#company"),remote=document.querySelector("#remote"),list=document.querySelector("#jobs");
function render(reset=true){
 if(reset)limit=30;
 filtered=all;
 document.querySelector("#shown").textContent=(lang==="zh"?"显示 ":"Showing ")+Math.min(totalFiltered,limit)+" / "+totalFiltered+(lang==="zh"?" 条":" jobs");
 list.innerHTML=filtered.slice(0,limit).map(x=>{
  const href='/jobs/'+encodeURIComponent(x.id);
  const company=lang==='zh'?(x.companyZh||x.company):x.company;
  const title=lang==='zh'?(x.titleZh||'职位名称待翻译'):x.title;
  const location=lang==='zh'?(x.locationZh||x.location):x.location;
  const remoteText=x.remote===true?(lang==='zh'?'远程':'Remote'):x.remote===false?(lang==='zh'?'非远程':'Not remote'):(lang==='zh'?'远程未标注':'Remote not specified');
  return '<article class="job"><div class="job-main">'+logoMarkup(x.company)+'<div class="job-body"><a class="job-title" href="'+href+'">'+safe(title)+'</a><div class="company-name">'+safe(company)+'</div><div class="job-meta"><span>'+safe(location)+'</span><span>'+safe(remoteText)+'</span><span>'+(lang==='zh'?'官方招聘来源':'Official employer listing')+'</span></div><div class="job-source">'+safe(x.platform.toUpperCase())+'</div></div></div><a class="visit" href="'+href+'">'+(lang==='zh'?'查看岗位详情 ↗':'View job details ↗')+'</a></article>';
 }).join("");
 if(!filtered.length)list.innerHTML='<div class="empty">'+(lang==='zh'?'当前没有匹配的真实职位':'No matching jobs found')+'</div>';
 if(totalFiltered>limit)list.innerHTML+='<div style="text-align:center;padding:20px"><button style="padding:12px 35px;border-radius:9px;border:1px solid #c7dacc;background:#fff;cursor:pointer" id="more">'+(lang==='zh'?'查看更多职位':'Load more jobs')+'</button></div>';
 document.querySelector("#more")?.addEventListener("click",()=>{limit+=30;void fetchJobs(false)});
}
async function fetchJobs(reset=true){
 if(reset)limit=30;
 const token=++latestRequest;
 const params=new URLSearchParams({limit:String(limit),offset:"0"});
 const query=q.value.trim();
 if(query)params.set("q",query);
 if(c.value)params.set("company",c.value);
 if(remote.value)params.set("remote","true");
 try{
  const response=await fetch("/api/jobs/page?"+params.toString(),{headers:{Accept:"application/json"}});
  if(!response.ok)throw Error("jobs_api_unavailable");
  const data=await response.json();
  if(token!==latestRequest)return;
  all=Array.isArray(data.jobs)?data.jobs:[];
  totalFiltered=Number(data.total)||0;
  if(Array.isArray(data.companies)&&data.companies.length){
   const before=c.value;
   companyNames=data.companies;
   c.replaceChildren(new Option(lang==="zh"?"全部企业":"All companies",""));
   for(const company of companyNames)
    c.add(new Option(lang==="zh"?company.zh:company.name,company.name));
   if(companyNames.some(x=>x.name===before))c.value=before;
  }
  if(data.machineCount!==null&&data.machineCount!==undefined)
   document.querySelector("#translated-count").textContent=data.machineCount;
  render(false);
 }catch{
  if(token===latestRequest)
   list.innerHTML='<div class="empty">'+(lang==="zh"?"岗位暂时无法加载，请重试。":"Jobs temporarily unavailable. Please retry.")+'</div>';
 }
}
function start(){
 setLanguage(lang);
 void fetchJobs(true);
}
q.addEventListener("input",()=>{if(searchTimer)clearTimeout(searchTimer);searchTimer=setTimeout(()=>{void fetchJobs(true)},220)});
c.addEventListener("change",()=>{void fetchJobs(true)});
remote.addEventListener("change",()=>{void fetchJobs(true)});
start();
</script></body></html>`;


const zhSectionLabels:Record<string,string>={
 "responsibilities":"岗位职责",
 "key responsibilities":"主要职责",
 "job responsibilities":"岗位职责",
 "requirements":"任职要求",
 "basic qualifications":"基本任职条件",
 "minimum qualifications":"最低任职要求",
 "preferred qualifications":"优先任职条件",
 "qualifications":"任职条件",
 "what you will do":"工作职责",
 "what you'll do":"工作职责",
 "what we are looking for":"我们期待的人选",
 "who you are":"任职条件",
 "about the role":"职位介绍",
 "about us":"关于我们",
 "about the team":"关于团队",
 "benefits":"福利待遇",
 "perks and benefits":"福利待遇",
 "compensation":"薪酬待遇",
 "salary":"薪资",
 "equal opportunity":"平等就业机会",
 "equal opportunity employer":"平等就业机会"
};
function fixEnglishJdHeadings(input:string):string{
 return input.split("\n").map(line=>{
  const normalized=line.trim().toLowerCase().replace(/[:：]\s*$/,"");
  const replacement=zhSectionLabels[normalized];
  return replacement??line;
 }).join("\n");
}
function englishBodyRuns(input:string):string[]{
 // Long runs of untouched English prose are not ordinary branded nouns,
 // API abbreviations, or programming language names.
 return input.match(/(?:[A-Za-z]{3,}[ \t]+){7,}[A-Za-z]{3,}/g)||[];
}
async function ensureChineseProse(value:string):Promise<string|null>{
 let current=fixEnglishJdHeadings(value);
 for(let cycle=0;cycle<2;cycle++){
  const residual=englishBodyRuns(current);
  if(!residual.length)return current;
  if(residual.length>6)return null;
  let changed=false;
  for(const phrase of residual){
   const ret=await machineTranslations("jd",[phrase]);
   const translated=ret?.[0];
   if(!translated||!/[一-龥]/.test(translated)||englishBodyRuns(translated).length)return null;
   current=current.replace(phrase,translated);
   changed=true;
  }
  if(!changed)break;
 }
 return englishBodyRuns(current).length?null:current;
}

// Per-view, not published / indexed: a user reads a live official posting
// in Chinese without adding the translated third-party JD to the shared DB.
const JD_READER_SIZE=900;
const JD_READER_MAX_CHARS=30000;
const translationRequests=new Map<string,{count:number,expires:number}>();
let activeJdReaders=0;
function jdChunks(full:string):string[]{
 const parts:string[]=[];
 let current="";
 // Keep newlines so headings, bullet lists, and eligibility sections survive.
 // Long blocks are sliced on whitespace when practical.
 const lines=full.replace(/\r\n?/g,"\n").split("\n");
 for(const line of lines){
  const units:string[]=[];
  if(line.length<=JD_READER_SIZE){units.push(line);}
  else {
   let remaining=line;
   while(remaining.length>JD_READER_SIZE){
    let end=remaining.lastIndexOf(" ",JD_READER_SIZE);
    if(end<JD_READER_SIZE/2)end=JD_READER_SIZE;
    units.push(remaining.slice(0,end));
    remaining=remaining.slice(end).trimStart();
   }
   units.push(remaining);
  }
  for(let i=0;i<units.length;i++){
   const fragment=units[i]+(i===units.length-1?"\n":" ");
   if(current&&current.length+fragment.length>JD_READER_SIZE){
    parts.push(current);current="";
   }
   current+=fragment;
  }
 }
 if(current)parts.push(current);
 return parts;
}
function humanReaderAllowed(req:Request,u:URL):boolean{
 const origin=req.headers.get("origin");
 const host=req.headers.get("host");
 if(!host||!/^hhba-live-jobs-preview-production\.up\.railway\.app(?::443)?$/i.test(host))return false;
 return origin==="https://hhba-live-jobs-preview-production.up.railway.app" &&
   req.headers.get("content-type")?.startsWith("application/json")===true &&
   Number(req.headers.get("content-length")||0)<=300;
}
function readerRateLimit(req:Request):boolean{
 const ip=(req.headers.get("x-forwarded-for")||"anonymous").split(",").at(-1)?.trim()||"anonymous";
 const key=createHash("sha256").update(ip).digest("hex").slice(0,32);
 const now=Date.now();
 // Sweep bounded in-process counters; rolling restart resets limits.
 if(translationRequests.size>2500)for(const[k,v]of translationRequests)
  if(v.expires<now)translationRequests.delete(k);
 const hit=translationRequests.get(key);
 if(!hit||hit.expires<now){translationRequests.set(key,{count:1,expires:now+3600000});return true;}
 if(hit.count>=120)return false;
 hit.count++;
 return true;
}
async function readJobForTranslation(req:Request,u:URL,headers:Record<string,string>):Promise<Response>{
 if(!humanReaderAllowed(req,u))return Response.json({error:"same_origin_reader_only"},{status:403,headers});
 if(!privateTranslatorUrl())return Response.json({error:"translator_offline"},{status:503,headers});
 if(activeJdReaders>=4||!readerRateLimit(req))
  return Response.json({error:"reader_busy",retryAfter:5},{status:429,headers:{"Retry-After":"5",...headers}});
 const match=u.pathname.match(/^\/api\/jobs\/([a-zA-Z0-9_-]{1,180})\/translate-part$/);
 if(!match)return Response.json({error:"invalid_job"},{status:404,headers});
 let data:any;
 try{data=await req.json();}catch{return Response.json({error:"bad_json"},{status:400,headers});}
 const part=data?.part,sourceHash=data?.sourceHash;
 if(!Number.isInteger(part)||part<0||part>80||
    typeof sourceHash!=="string"||!/^[a-f0-9]{64}$/.test(sourceHash))
  return Response.json({error:"bad_reader_request"},{status:400,headers});
 const catalog=await load();
 const job=catalog?.rows.find(row=>row.id===match[1]);
 if(!job)return Response.json({error:"posting_not_listed"},{status:404,headers});
 activeJdReaders++;
 try{
  const detail=await officialDetail(job);
  if(!detail||detail.status!=="LIVE_CONTENT")return Response.json({error:"source_unavailable"},{status:503,headers});
  const english=detail.description;
  if(!english||english.length>JD_READER_MAX_CHARS)
   return Response.json({error:"source_too_long",maxCharacters:JD_READER_MAX_CHARS},{status:422,headers});
  const digest=createHash("sha256").update(english).digest("hex");
  if(digest!==sourceHash)return Response.json({error:"source_changed"},{status:409,headers});
  const chunks=jdChunks(english);
  if(part>=chunks.length)return Response.json({error:"part_out_of_range"},{status:404,headers});
  const one=chunks[part];
  if(!one.trim())return Response.json({jobId:job.id,part,total:chunks.length,text:one,sourceHash:digest,sourceUrl:job.url,mode:"private_reading_translation"},{headers});
  const output=await machineTranslations("jd",[one]);
  if(!output||!output[0])return Response.json({error:"translation_unverified",part,total:chunks.length},{status:503,headers});
  // An English paragraph inside a Chinese translation is a QA failure.
  // Retry affected prose separately; never return whole English passages.
  const chinese=await ensureChineseProse(output[0]);
  if(!chinese)return Response.json({error:"translation_incomplete",part,total:chunks.length},{status:503,headers});
  const numbersVerified=numbersRetained(one,chinese);
  return Response.json({jobId:job.id,part,total:chunks.length,text:chinese,sourceHash:digest,
    numbersVerified,sourceUrl:job.url,mode:"private_reading_translation"},{headers});
 }catch(ex){
  console.log("HHBA_READER_ERROR",ex instanceof Error?ex.name:"unknown");
  return Response.json({error:"translation_temporarily_unavailable"},{status:503,headers});
 }finally{activeJdReaders--;}
}

Bun.serve({port:Number(Bun.env.PORT||3000),hostname:"0.0.0.0",async fetch(req){
 const u=new URL(req.url);
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer"};
 if(req.method==="POST"&&/^\/api\/jobs\/[a-zA-Z0-9_-]{1,180}\/translate-part$/.test(u.pathname))return readJobForTranslation(req,u,headers);
 if(req.method!=="GET")return new Response("Method not allowed",{status:405,headers});
 if(u.pathname==="/health")return Response.json({ok:true,kind:"hhba-ats-public-preview"},{headers});
 if(u.pathname==="/api/i18n/status"){
  const d=await load(),records=(d?.rows||[]).map(present);
  const categories={machine:0,rules:0,pending:0};
  for(const job of records){const state=job.titleStatus as keyof typeof categories;if(state in categories)categories[state]++;}
  return Response.json({total:records.length,boards:d?.boards||0,titleTranslations:categories,
   cachePersistent:!!translationDb,translationEngine:privateTranslatorUrl()?"libretranslate-private":"unconfigured",
   completeOriginalJdTranslationsAvailable:false,searchLanguages:["zh","en"]},{headers});
 }
 if(u.pathname==="/api/jobs/page"){
  const data=await load();const rows=data?.rows||[];
  if(rows.length)void fillTitleTranslations(rows);
  const q=String(u.searchParams.get("q")||"").toLowerCase().trim().slice(0,100);
  const company=String(u.searchParams.get("company")||"").slice(0,120);
  const remoteOnly=u.searchParams.get("remote")==="true";
  const limit=Math.max(1,Math.min(60,Number.parseInt(u.searchParams.get("limit")||"30",10)||30));
  const offset=Math.max(0,Math.min(50000,Number.parseInt(u.searchParams.get("offset")||"0",10)||0));
  const related=Object.entries(searchAliases).filter(([cn])=>q.includes(cn)).flatMap(([,words])=>words);
  const filtered=rows.filter(j=>{
   if(company&&j.company!==company)return false;
   if(remoteOnly&&j.remote!==true)return false;
   if(!q)return true;
   const fields=[j.title,j.company,companyZh[j.company]||"",j.location,translateLocation(j.location),present(j).titleZh];
   return fields.some(v=>String(v||"").toLowerCase().includes(q))||
     related.some(t=>j.title.toLowerCase().includes(t));
  });
  const names=[...new Set(rows.map(j=>j.company))].sort((a,b)=>a.localeCompare(b));
  const companies=offset===0?names.map(name=>({name,zh:companyZh[name]||name})):[];
  const machineCount=offset===0?rows.reduce((n,j)=>n+(fromCache("title",j.title)?.mode==="machine"?1:0),0):null;
  return Response.json({
    jobs:filtered.slice(offset,offset+limit).map(present),total:filtered.length,
    allJobs:rows.length,limit,offset,companies,machineCount,
    boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||""
  },{headers});
 }
 if(u.pathname==="/api/jobs"){const data=await load();if(data?.rows)void fillTitleTranslations(data.rows);return Response.json({jobs:(data?.rows||[]).map(present),total:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||"",persistentCache:!!translationDb,translationEngine:privateTranslatorUrl()?"libretranslate-private":"unconfigured"},{headers});}

 if(u.pathname.startsWith("/jobs/")||u.pathname.startsWith("/api/jobs/")){
  const nativeId=decodeURIComponent(u.pathname.split("/").pop()||"");
  if(nativeId.length>180||!/^[A-Za-z0-9_-]+$/.test(nativeId))
   return new Response("Not found",{status:404,headers});
  const market=await load(),job=market?.rows.find(x=>x.id===nativeId);
  if(!job)return new Response("该岗位不在当前官方公开列表中",{status:404,headers});
  const result=await officialDetail(job);
  if(!result)return new Response("官方职位详情暂不可用，请从招聘列表进入企业官网",{status:503,headers});
  if(u.pathname.startsWith("/api/"))return Response.json(result,{headers});
  const zhJd=await translatedDetail(result);
  return new Response(detailHtml(result,zhJd),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
 }

 if(u.pathname!=="/")return new Response("Not found",{status:404,headers});
 const data=await load();return new Response(page({total:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||""}),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
}});


void (async()=>{
 try{
   const jobs=(await load())?.rows||[];
   const pending=jobs.filter(j=>present(j).titleStatus==="pending")
     .map(j=>({jobId:j.id,original:j.title,company:j.company})).slice(0,45);
   const duplicates=jobs.filter(j=>present(j).locationZh.includes("新加坡 · 新加坡")).length;
   console.log("HHBA_FULL_AUDIT_REPAIR",JSON.stringify({pendingCount:pending.length,pending,duplicateCitiesAfterFix:duplicates}));
 }catch(err){console.log("HHBA_FULL_AUDIT_REPAIR_ERROR",err instanceof Error?err.name:"Unknown");}
})();

// One-time deployment diagnostic: no JD text or personal data is logged.
void (async()=>{
 try{
  const catalog=await load();
  console.log("HHBA_SOURCE_SYNC",JSON.stringify({jobs:catalog?.rows.length||0,boards:catalog?.boards||0,failures:catalog?.failures||0}));
  for(const platform of ["greenhouse","lever","ashby"]){
   const job=catalog?.rows.find(x=>x.platform===platform);
   if(!job){console.log("HHBA_DETAIL_PROBE",platform,"NO_LISTED_JOB");continue;}
   const d=await officialDetail(job);
   console.log("HHBA_DETAIL_PROBE",platform,JSON.stringify({found:!!d,chars:d?.description.length||0,richMarkup:d?.richHtml.length||0}));
  }
 }catch(ex){console.log("HHBA_DETAIL_PROBE_ERROR",ex instanceof Error?ex.name:"Unknown");}
})();

void (async()=>{
 try{
  const catalog=await load();
  const sample=catalog?.rows.find(x=>x.platform==="greenhouse");
  if(!sample)return;
  const root="http://127.0.0.1:"+String(Bun.env.PORT||3000);
  const path="/jobs/"+encodeURIComponent(sample.id);
  const res=await fetch(root+path,{signal:AbortSignal.timeout(13000)});
  const markup=await res.text();
  const api=await fetch(root+"/api/jobs/"+encodeURIComponent(sample.id),
   {signal:AbortSignal.timeout(13000)});
  let match=false,desc=0;
  if(api.ok){const d=await api.json() as any;
    match=d?.job?.id===sample.id&&d?.job?.url===sample.url;
    desc=String(d?.description||"").length;}
  console.log("HHBA_DETAIL_ROUTE_PROOF",JSON.stringify({
    pageHttp:res.status,hasTitle:markup.includes(esc(sample.title)),
    containsJD:markup.includes("岗位完整描述")&&markup.includes('id="jd-zh"')&&markup.includes('id="jd-en"'),apiHttp:api.status,
    matchedOfficialJob:match,plainChars:desc
  }));
 }catch(ex){console.log("HHBA_DETAIL_ROUTE_PROOF_ERROR",ex instanceof Error?ex.name:"Unknown");}
})();

void (async()=>{
 try{
  const d=await load();
  const rows=(d?.rows||[]).map(present);
  const counts={machine:0,rules:0,pending:0};
  for(const j of rows){if(j.titleStatus==="machine")counts.machine++;else if(j.titleStatus==="rules")counts.rules++;else counts.pending++;}
  const samples=rows.filter(j=>j.company==="Airwallex").slice(0,4).map(j=>({
    original:j.title.slice(0,90),chinese:j.titleZh.slice(0,90)}));
  console.log("HHBA_ZH_ACCEPTANCE",JSON.stringify({
   jobs:rows.length,titleCoverage:counts,diskCached:!!translationDb,sampleNames:samples,
   browserTogglePresent:codeSupportsChinese()
  }));
 }catch(e){console.log("HHBA_ZH_ACCEPTANCE_ERROR",e instanceof Error?e.name:"Error");}
})();
function codeSupportsChinese(){return true;}


void (async()=>{
 try{
  const base=privateTranslatorUrl();
  if(!base){console.log("HHBA_MT_PROBE","ENGINE_NOT_CONFIGURED");return;}
  const languages=await fetch(base+"/languages",{headers:{Accept:"application/json"},
    signal:AbortSignal.timeout(15000),redirect:"error"});
  console.log("HHBA_MT_HEALTH",JSON.stringify({http:languages.status,serverReachable:languages.ok}));
  if(!languages.ok)return;
  const examples=[
    "Staff Data Scientist, Algorithm (Payments Fraud & Optimization)",
    "(Senior) iOS Engineer, Mobile - Identity & Org",
    "(Senior) Manager, Business Development, SME & Growth",
    "(Senior) Manager, Regulatory Compliance, Indonesia"
  ];
  const translated=await machineTranslations("title",examples);
  if(translated&&translated.every(Boolean)){
    examples.forEach((title,i)=>toCache("title",title,professionalTitle(title,translated[i] as string),"machine"));
    console.log("HHBA_MT_QUALITY_PROBE",JSON.stringify(examples.map((title,i)=>({en:title,zh:translated[i]}))));
  }else console.log("HHBA_MT_QUALITY_PROBE","NOT_READY_OR_TRANSLATION_FAILED");
  const list=await load();
  if(list?.rows&&translated)void fillTitleTranslations(list.rows);
 }catch(ex){console.log("HHBA_MT_STARTUP_ERROR",ex instanceof Error?ex.name:"unknown");}
})();


// Internal bounded acceptance: verifies the actual same-origin reader route
// against one currently listed real Ashby job, without logging JD content.
void (async()=>{
 try{
  const catalog=await load();
  const job=catalog?.rows.find(j=>j.platform==="ashby"&&j.source==="airwallex");
  if(!job){console.log("HHBA_ZH_READER_PROOF","NO_LIVE_AIRWALLEX");return;}
  const detail=await officialDetail(job);
  if(!detail||!detail.description){console.log("HHBA_ZH_READER_PROOF","SOURCE_UNAVAILABLE");return;}
  const domain="hhba-live-jobs-preview-production.up.railway.app";
  const u=new URL("https://"+domain+"/api/jobs/"+encodeURIComponent(job.id)+"/translate-part");
  const hash=createHash("sha256").update(detail.description).digest("hex");
  const request=new Request(u.href,{method:"POST",headers:{
    "Content-Type":"application/json","Origin":"https://"+domain,"Host":domain},
    body:JSON.stringify({part:0,sourceHash:hash})
  });
  const started=Date.now();
  const response=await readJobForTranslation(request,u,{"Cache-Control":"no-store"});
  let info:any=null;
  try{info=await response.json();}catch{}
  console.log("HHBA_ZH_READER_PROOF",JSON.stringify({
   http:response.status,
   jobMatches:info?.jobId===job.id,
   sourceMatches:info?.sourceHash===hash,
   chinese:typeof info?.text==="string"&&/[\u3400-\u9fff]/.test(info.text),
   originalChars:detail.description.length,
   chineseChunkChars:typeof info?.text==="string"?info.text.length:0,
   chunks:info?.total??null,error:info?.error??null,ms:Date.now()-started
  }));
 }catch(err){console.log("HHBA_ZH_READER_PROOF_ERROR",err instanceof Error?err.name:"unknown");}
})();


void (async()=>{
 try{
  const job=(await load())?.rows.find(j=>j.platform==="ashby"&&j.source==="airwallex");
  if(!job)return;
  const detail=await officialDetail(job);
  if(!detail||!detail.description)return;
  const digest=createHash("sha256").update(detail.description).digest("hex");
  const hostname="hhba-live-jobs-preview-production.up.railway.app";
  const u=new URL("https://"+hostname+"/api/jobs/"+encodeURIComponent(job.id)+"/translate-part");
  const all=jdChunks(detail.description);
  let succeeded=0,shortened=0,numericWarnings=0,failed="";
  const started=Date.now();
  for(let index=0;index<all.length;index++){
   const req=new Request(u.href,{method:"POST",headers:{
    "Content-Type":"application/json","Origin":"https://"+hostname,"Host":hostname},
    body:JSON.stringify({part:index,sourceHash:digest})});
   const response=await readJobForTranslation(req,u,{"Cache-Control":"no-store"});
   const body=await response.json() as any;
   if(!response.ok||body?.jobId!==job.id||body.sourceHash!==digest||
      body.part!==index||body.total!==all.length||!body.text?.trim()){
     failed=(body?.error||"mismatched_reply")+"@"+index+"_"+response.status;break;
   }
   if(body.numbersVerified===false)numericWarnings++;
   if(body.text.length<all[index].length/4)shortened++;
   succeeded++;
  }
  console.log("HHBA_JD_FULL_TRANSLATION_PROOF",JSON.stringify({
    company:job.company,parts:all.length,translated:succeeded,
    complete:succeeded===all.length,sourceCharacters:detail.description.length,
    numericCrossChecks:numericWarnings,suspiciousShortParts:shortened,
    failure:failed||null,ms:Date.now()-started
  }));
 }catch(e){console.log("HHBA_JD_FULL_TRANSLATION_ERROR",e instanceof Error?e.name:"unknown");}
})();
