import { convert } from "html-to-text@9";
import sanitizeHtml from "sanitize-html@2";
import { decode as decodeHtmlEntities } from "html-entities";
import { parseDocument } from "htmlparser2";

type Job={id:string;company:string;title:string;location:string;remote:boolean|null;url:string;platform:string;source:string;domestic?:boolean;recruitmentType?:string;observedAt?:string};

import { handleEngagement } from "./engagement.ts";
import { handleSavedJobs } from "./saved.ts";
import { handlePrivateAdmin } from "./admin-console.ts";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { openJobSyncStore } from "./jd-sync-store.mjs";
import { startOverseasJdWorker } from "./jd-sync-worker.mjs";
import { createFullJdWorker } from "./jd-sync-runner.mjs";
import { translateWithSourceNumbers } from "./number-locked-translation.mjs";
import {readNativeIndex} from "./read-official-index.mjs";
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
const companyZh:Record<string,string>={Xiaomi:"小米集团",Meituan:"美团",Tencent:"腾讯",Baidu:"百度",Cognition:"Cognition",Replit:"Replit",PostHog:"PostHog",ClickUp:"ClickUp",Airwallex:"空中云汇","OpenAI":"OpenAI","Notion":"Notion","Ramp":"Ramp","Linear":"Linear","Perplexity":"Perplexity","ElevenLabs":"ElevenLabs","Vanta":"Vanta","Harvey":"Harvey","Headway":"Headway","Coursera":"Coursera","Figma":"Figma","Anduril":"Anduril","Discord":"Discord","Reddit":"Reddit","Airtable":"Airtable","Flexport":"Flexport","Robinhood":"Robinhood","GitLab":"GitLab","Twilio":"Twilio","Cloudflare":"Cloudflare","Vercel":"Vercel","Gusto":"Gusto","Wise":"Wise","Binance":"Binance","Cursor":"Cursor","Mercor":"Mercor"};
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
 "Account Executive, Corporate":"企业客户经理",
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

const employerBrandSites:Record<string,string>={"Tencent":"tencent.com","ByteDance":"bytedance.com","Huawei":"huawei.com","BYD":"byd.com","Alibaba":"alibaba.com","Meituan":"meituan.com","Baidu":"baidu.com","NIO":"nio.com","Lenovo":"lenovo.com","Trip.com Group":"ctrip.com","Xiaomi":"mi.com","Greenhouse":"greenhouse.com","Ashby":"ashbyhq.com","Spotify":"spotify.com","Canonical":"canonical.com","Airwallex":"airwallex.com","Palantir":"palantir.com","Figma":"figma.com","Anduril":"anduril.com","Discord":"discord.com","Reddit":"reddit.com","Airtable":"airtable.com","Flexport":"flexport.com","Robinhood":"robinhood.com","GitLab":"gitlab.com","Twilio":"twilio.com","Cloudflare":"cloudflare.com","Vercel":"vercel.com","Gusto":"gusto.com","Wise":"wise.com","Coursera":"coursera.org","OpenAI":"openai.com","Notion":"notion.so","Ramp":"ramp.com","Linear":"linear.app","Perplexity":"perplexity.ai","ElevenLabs":"elevenlabs.io","Vanta":"vanta.com","Harvey":"harvey.ai","Headway":"headway.co","Binance":"binance.com","Cognition":"cognition.ai","Replit":"replit.com","PostHog":"posthog.com","ClickUp":"clickup.com","Cursor":"cursor.com","Mercor":"mercor.com"};
function employerLogo(company:string):string{
 const domain=employerBrandSites[company];
 const initials=(company.trim().slice(0,2)||"?").toUpperCase();
 return '<span class="company-logo" aria-hidden="true"><span class="company-initials">'+esc(initials)+'</span>'+
 (domain?'<img src="https://'+esc(domain)+'/favicon.ico" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+'</span>';
}
function present(j:Job){
 if(j.domestic)return {...j,companyZh:companyZh[j.company]||j.company,titleZh:j.title,titleStatus:"original",locationZh:j.location,recordKind:j.company==="Xiaomi"?"OFFICIAL_LIST_OBSERVED":"OFFICIAL_JOB_PAGE_OBSERVED",currentApplicationVerified:false};
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

// Public CI verifies the website and public ATS endpoints without copying
// the private Xiaomi production dataset. This bypass is forbidden in Railway.
const publicCiOnly=Bun.env.HHBA_PUBLIC_CI_ONLY==="1" &&
 !Bun.env.RAILWAY_ENVIRONMENT && !Bun.env.RAILWAY_PROJECT_ID &&
 !Bun.env.RAILWAY_SERVICE_ID && !Bun.env.RAILWAY_SERVICE_NAME;
const xiaomiPayload=Array.from({length:11},(_,i)=>Bun.env["HHBA_XIAOMI_CHUNK_"+i]||"").join("");
if(!publicCiOnly&&createHash("sha256").update(xiaomiPayload,"utf8").digest("hex")!=="97ef1d92751c7726225f98fdd0797d22e45eb07553029452697b54dd208def8e")throw Error("HHBA_XIAOMI_SNAPSHOT_DIGEST_MISMATCH");
const xiaomiCompact:[string,string,string,string][]=publicCiOnly?[]:JSON.parse(xiaomiPayload);
const xiaomiType:Record<string,string>={S:"SOCIAL",C:"CAMPUS",I:"INTERNSHIP"};
const xiaomiUrls:Record<string,string>={S:"https://xiaomi.jobs.f.mioffice.cn/index/",C:"https://xiaomi.jobs.f.mioffice.cn/campus/",I:"https://xiaomi.jobs.f.mioffice.cn/internship/"};
const domesticObserved:Job[]=xiaomiCompact.map(([kind,native,title,city])=>{
 if(!xiaomiType[kind]||!/^\d{12,22}$/.test(native)||!title||title.length>220||!city||city.length>100)throw Error("Invalid Xiaomi list record");
 return {id:"xiaomi-"+kind+"-"+native,company:"Xiaomi",title,location:city,remote:null,url:xiaomiUrls[kind],platform:"xiaomi-official",source:xiaomiType[kind],domestic:true,recruitmentType:xiaomiType[kind],observedAt:"2026-10-16"};
});
if(!publicCiOnly&&(domesticObserved.length!==1010||new Set(domesticObserved.map(j=>j.id)).size!==1010||domesticObserved.filter(j=>j.recruitmentType==="SOCIAL").length!==350||domesticObserved.filter(j=>j.recruitmentType==="CAMPUS").length!==350||domesticObserved.filter(j=>j.recruitmentType==="INTERNSHIP").length!==310))throw Error("Invalid Xiaomi total or channels");
const meituanCompact:[string,string,string,string,string][]=[["4694862735","AI应用开发工程师","北京、上海","CAMPUS","https://zhaopin.meituan.com/web/position/detail?highlightType=campus&jobShareType=1&jobUnionId=4694862735"],["4691573955","B端AI应用FDE","北京","SOCIAL","https://zhaopin.meituan.com/web/position/detail?highlightType=social&jobUnionId=4691573955"],["4696454382","产品运营岗","多城市","CAMPUS","https://zhaopin.meituan.com/web/position/detail?highlightType=campus&jobShareType=1&jobUnionId=4696454382"],["4701989120","美团联盟行业运营（到店方向）","北京","SOCIAL","https://zhaopin.meituan.com/web/position/detail?highlightType=social&jobUnionId=4701989120"],["4747089400","用户体验改善-服务运营岗","北京","SOCIAL","https://zhaopin.meituan.com/web/position/detail?highlightType=social&jobUnionId=4747089400"],["4360870843","AI产品经理","北京","SOCIAL","https://zhaopin.meituan.com/web/position/detail?highlightType=social&jobUnionId=4360870843"],["4694862636","商品运营岗","北京、广州","CAMPUS","https://zhaopin.meituan.com/web/position/detail?highlightType=campus&jobShareType=1&jobUnionId=4694862636"]];
const meituanObserved:Job[]=meituanCompact.map(([uid,title,location,recruitmentType,url])=>{
 if(!/^\d{8,20}$/.test(uid)||!title||!location||!["SOCIAL","CAMPUS","INTERNSHIP"].includes(recruitmentType))throw Error("Invalid Meituan record");
 const u=new URL(url);
 if(u.protocol!=="https:"||u.hostname!=="zhaopin.meituan.com"||u.pathname!=="/web/position/detail"||u.searchParams.get("jobUnionId")!==uid)throw Error("Invalid Meituan official job URL");
 return {id:"meituan-"+uid,company:"Meituan",title,location,remote:null,url,platform:"meituan-official",source:"verified-detail",domestic:true,recruitmentType,observedAt:"2026-10-18"};
});
if(meituanObserved.length!==7||new Set(meituanObserved.map(j=>j.id)).size!==7)throw Error("Invalid Meituan count");
const reviewedPayload=(Bun.env.HHBA_REVIEWED_OFFICIAL_0||"")+(Bun.env.HHBA_REVIEWED_OFFICIAL_1||"");
const reviewedRows:[string,string,string,string,string,string][]=reviewedPayload&&createHash("sha256").update(reviewedPayload).digest("hex")==="5bbae03c21888eff0765f8b8a34aa10b61b353caacea95702009e6272413ee49"?JSON.parse(reviewedPayload):[];
if(reviewedRows.length!==27)console.warn("HHBA_DOMESTIC_REVIEWED_SNAPSHOT_UNAVAILABLE");
const additionalDomesticJobs:Job[]=reviewedRows.map(([company,id,title,city,kind,url])=>{
 const u=new URL(url),tencent=company==="Tencent";
 if(!(tencent||company==="Baidu")||!title||!city||!["SOCIAL","CAMPUS"].includes(kind)||
 (tencent?(!/^\d{18,21}$/.test(id)||u.hostname!=="careers.tencent.com"||u.pathname!=="/jobdesc.html"||u.searchParams.get("postId")!==id):(!/^[0-9a-f-]{36}$/.test(id)||u.hostname!=="talent.baidu.com"||u.pathname!=="/jobs/detail/GRADUATE/"+id))||u.protocol!=="https:")throw Error("Invalid official China job");
 return {id:company.toLowerCase()+"-"+id,company,title,location:city,remote:null,url,platform:company.toLowerCase()+"-official",source:"official-detail-observed",domestic:true,recruitmentType:kind,observedAt:"2026-10-18"};
});
type Board={platform:"greenhouse"|"ashby"|"lever";company:string;slug:string};
const boards:Board[]=[
 // Audited 2026-10-19 against public original ATS board+job+description URLs.
 // Custom first-party corporate URLs, admitted only when gh_jid equals official native ATS ID.
 {platform:"greenhouse",company:"Stripe",slug:"stripe"},
 {platform:"greenhouse",company:"Coinbase",slug:"coinbase"},
 {platform:"greenhouse",company:"Airbnb",slug:"airbnb"},
 {platform:"greenhouse",company:"Databricks",slug:"databricks"},
 {platform:"greenhouse",company:"SpaceX",slug:"spacex"},
 {platform:"greenhouse",company:"SpaceX Global",slug:"spacexglobal"},
 {platform:"greenhouse",company:"Anthropic",slug:"anthropic"},
 {platform:"greenhouse",company:"DoorDash",slug:"doordashusa"},
 {platform:"ashby",company:"Deepgram",slug:"deepgram"},
 {platform:"ashby",company:"Cohere",slug:"cohere"},
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
 {platform:"ashby",company:"ClickUp",slug:"clickup"},
 {platform:"ashby",company:"Cursor",slug:"cursor"},
 {platform:"ashby",company:"Mercor",slug:"mercor"},
 {platform:"ashby",company:"Form Energy",slug:"formenergy"},
 {platform:"lever",company:"ShopBack",slug:"shopback-2"},
 {platform:"greenhouse",company:"AlphaSights Campus Recruiting",slug:"alphasightsresumedrop"},
 {platform:"ashby",company:"General Robotics",slug:"generalrobotics"}
];
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const brandedGreenhouse:Record<string,{host:string;path:string}>={
 stripe:{host:"stripe.com",path:"/jobs/search"},
 coinbase:{host:"www.coinbase.com",path:"/careers/positions/"},
 airbnb:{host:"careers.airbnb.com",path:"/positions/"},
 databricks:{host:"databricks.com",path:"/company/careers/open-positions/job"}
};
const urlOK=(value:unknown,slug:string,platform:string,nativeId?:unknown)=>{
 try {
  const u=new URL(String(value||""));
  if(u.protocol!=="https:"||u.username||u.password||u.port)return null;
  const hosts=platform==="greenhouse"?
   ["job-boards.greenhouse.io","boards.greenhouse.io","boards.eu.greenhouse.io"]:
   platform==="ashby"?["jobs.ashbyhq.com"]:["jobs.lever.co","jobs.eu.lever.co"];
  if(hosts.includes(u.hostname)&&u.pathname.split("/").includes(slug))return u.href;
  const branded=platform==="greenhouse"?brandedGreenhouse[slug]:null;
  const native=String(nativeId??"");
  if(branded && u.hostname===branded.host &&
    (branded.path.endsWith("/")?u.pathname.startsWith(branded.path):u.pathname===branded.path) &&
    /^[0-9]{5,20}$/.test(native) &&
    u.searchParams.get("gh_jid")===native)return u.href;
  return null;
 }catch{return null;}
};
function id(platform:string,slug:string,uid:unknown){return platform+"-"+slug+"-"+String(uid||"").slice(0,85);}
function normalize(board:Board,x:any):Job|null{
 const title=board.platform==="lever"?x?.text:x?.title;
 const native=x?.id;
 const url=board.platform==="greenhouse"?x?.absolute_url:board.platform==="ashby"?x?.jobUrl:x?.hostedUrl;
 const safe=urlOK(url,board.slug,board.platform,native);
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
  rows.push(...domesticObserved,...meituanObserved,...additionalDomesticJobs);
  rows.sort((a,b)=>a.company.localeCompare(b.company)||a.title.localeCompare(b.title));
  if(ok===0&&cache)return cache;
  cache={at:Date.now(),rows,boards:ok,failures:failed,updated:new Date().toISOString()};
  return cache;
 })();
 try{return await inflight;}finally{inflight=null;}
}

type Detail={job:Job;description:string;richHtml:string;applyUrl:string|null;status:"LIVE_CONTENT"|"DESCRIPTION_UNAVAILABLE";checkedAt:string};
function approvedApplyUrl(value:unknown,b:Board):string|null{
 return urlOK(value,b.slug,b.platform);
}

function hasEscapedJdTags(value:string):boolean{
 return /&(?:amp;){0,3}lt;\s*\/?\s*(?:p|div|ul|ol|li|h[1-6]|br|strong|em|span|a|section|blockquote|table|tr|td)\b/i.test(value)||
        /&#(?:0*60|x0*3c);\s*\/?\s*(?:p|div|ul|ol|li|h[1-6]|br|span|a)\b/i.test(value);
}
function normalizeOfficialMarkup(value:string):string{
 let current=value;
 for(let round=0;round<4&&hasEscapedJdTags(current);round++){
  const next=decodeHtmlEntities(current);
  if(next===current)break;
  current=next;
 }
 return current;
}
function hasLeakedJdTags(value:string):boolean{
 return /<\/?\s*(?:p|div|ul|ol|li|h[1-6]|br|strong|em|span|a|section|blockquote|table|tr|td)(?:\s|>|\/)/i.test(value)||hasEscapedJdTags(value);
}


type OfficialJdBlock={kind:"heading"|"bullet"|"paragraph";text:string;links:{label:string;href:string}[]};
function officialJdBlocks(html:string):OfficialJdBlock[]{
 const doc=parseDocument(normalizeOfficialMarkup(html),{decodeEntities:true});
 const result:OfficialJdBlock[]=[];
 const inline=(node:any):string=>{
  if(node?.type==="text")return String(node.data||"");
  if(node?.name==="br")return "\n";
  if(["script","style","iframe","svg"].includes(node?.name))return "";
  return Array.isArray(node?.children)?node.children.map(inline).join(""):"";
 };
 const links=(node:any):{label:string;href:string}[]=>{
  const out:{label:string;href:string}[]=[];
  const walk=(n:any)=>{
   if(n?.name==="a"&&typeof n.attribs?.href==="string"){
    try{
     const url=new URL(n.attribs.href);
     if((url.protocol==="https:"||url.protocol==="mailto:")&&!url.username&&!url.password){
      out.push({label:inline(n).trim().slice(0,120),href:url.href});
     }
    }catch{}
   }
   if(Array.isArray(n?.children))for(const child of n.children)walk(child);
  };
  walk(node);return out.slice(0,12);
 };
 const add=(kind:OfficialJdBlock["kind"],raw:string,node:any)=>{
  const pieces=String(raw||"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ")
   .split(/\n{2,}/).map(x=>x.replace(/\s*\n\s*/g," ").trim()).filter(Boolean);
  for(const [index,piece] of pieces.entries()){
   if(piece.length>30000)continue;
   result.push({kind,text:piece,links:index===0?links(node):[]});
  }
 };
 const visit=(node:any)=>{
  if(result.length>=250||!node)return;
  const tag=String(node.name||"").toLowerCase();
  if(["script","style","iframe","svg","noscript"].includes(tag))return;
  if(/^h[1-6]$/.test(tag)){add("heading",inline(node),node);return}
  if(tag==="li"){
   const top=Array.isArray(node.children)?node.children.filter((x:any)=>!["ul","ol"].includes(x?.name)):[];
   add("bullet",top.map(inline).join(""),node);
   for(const nested of node.children||[])if(["ul","ol"].includes(nested?.name))visit(nested);
   return;
  }
  if(tag==="p"){add("paragraph",inline(node),node);return}
  if(tag==="div"||tag==="section"||tag==="article"||tag==="blockquote"){
   const children=node.children||[];
   const structural=children.some((n:any)=>/^(?:p|div|section|article|blockquote|h[1-6]|ul|ol|li)$/.test(n.name||""));
   if(!structural){add("paragraph",inline(node),node);return}
  }
  if(node.type==="text"){if(String(node.data||"").trim())add("paragraph",node.data,node);return}
  if(Array.isArray(node.children))for(const child of node.children)visit(child);
 };
 for(const child of doc.children)visit(child);
 return result;
}
function officialBlocksText(blocks:OfficialJdBlock[]):string{
 return blocks.map(b=>(b.kind==="heading"?"# ":b.kind==="bullet"?"- ":"")+b.text).join("\n\n");
}
function officialBlocksHtml(blocks:OfficialJdBlock[]):string{
 let out="",listOpen=false;
 for(const b of blocks){
  if(b.kind==="bullet"&&!listOpen){out+="<ul>";listOpen=true;}
  else if(b.kind!=="bullet"&&listOpen){out+="</ul>";listOpen=false;}
  const tag=b.kind==="heading"?"h3":b.kind==="bullet"?"li":"p";
  const refs=b.links.map(l=>' <a href="'+esc(l.href)+'" rel="noopener noreferrer nofollow" target="_blank">'+esc(l.label||"查看相关链接")+' ↗</a>').join("");
  out+="<"+tag+">"+esc(b.text)+refs+"</"+tag+">";
 }
 if(listOpen)out+="</ul>";
 return out;
}

// The white GitHub Pages website publishes a signed-by-source metadata snapshot,
// not third-party JD bodies. Older Railway has fewer ATS boards than the white site.
// Allow on-demand reads ONLY for a job ID proved to belong to that public snapshot.
let whiteJobCache:{at:number,jobs:Job[]}|null=null;
async function fromWhiteIndex(id:string):Promise<Job|null>{
 if(!/^(?:greenhouse|ashby|lever)-[a-zA-Z0-9_-]{1,100}-[A-Za-z0-9_-]{1,100}$/.test(id))return null;
 try{
  if(!whiteJobCache||Date.now()-whiteJobCache.at>300000){
   // Native Railway evidence is now authoritative for on-demand JD identity.
   // Pages is retained only as an explicit, pre-cutover bootstrap fallback.
   let data:any=null;
   if(Bun.env.HHBA_NATIVE_INDEX_READ==="1"){
    const local=await readNativeIndex("/sync-state/public-index","jobs.json");
    if(local)data=JSON.parse(new TextDecoder().decode(local.bytes));
   }
   if(!data){
    const response=await fetch("https://yanm-jun.github.io/hhba-talent/data/jobs.json",{
     headers:{"Accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(14000)});
    if(!response.ok||Number(response.headers.get("content-length")||0)>16000000)return null;
    const raw=await response.text();
    if(raw.length>16000000)return null;
    data=JSON.parse(raw);
   }
   if(!Array.isArray(data.jobs)||data.jobs.length>25000||
     !Number.isFinite(Date.parse(data.updated||""))||
     Math.abs(Date.now()-Date.parse(data.updated))>24*3600000||
     Number(data.failures)!==0)return null;
   // Retain metadata in memory for only five minutes; no JD content persisted.
   whiteJobCache={at:Date.now(),jobs:data.jobs};
  }
  const row=whiteJobCache.jobs.find(j=>j.id===id);
  if(!row||!["ashby","greenhouse","lever"].includes(row.platform)||
    !/^[A-Za-z0-9_-]{2,100}$/.test(row.source||"")||
    typeof row.url!=="string"||typeof row.title!=="string"||!row.title.trim())return null;
  const native=id.slice(row.platform.length+row.source.length+2);
  if(id!==row.platform+"-"+row.source+"-"+native||
    !/^[A-Za-z0-9_-]{1,100}$/.test(native)||
    !urlOK(row.url,row.source,row.platform,native))return null;
  return {id:row.id,company:String(row.company||"").slice(0,120),
    title:row.title.slice(0,220),location:String(row.location||"").slice(0,170),
    remote:typeof row.remote==="boolean"?row.remote:null,url:row.url,
    platform:row.platform,source:row.source,domestic:false};
 }catch{return null;}
}
async function officialDetail(job:Job):Promise<Detail|null>{
 const known=boards.find(b=>b.slug===job.source&&b.platform===job.platform);
 // The only allowed dynamic sources are validated against the white public feed.
 const fallbackBoard=(!known && ["greenhouse","ashby","lever"].includes(job.platform) &&
   /^[A-Za-z0-9_-]{2,100}$/.test(job.source)) ?
   {platform:job.platform as Board["platform"],slug:job.source,company:job.company}:null;
 const board=known||fallbackBoard;
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
  if(!title||!urlOK(original,board.slug,board.platform,native)||original!==job.url)return null;
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
  const normalizedHtml=normalizeOfficialMarkup(html);
  const blocks=officialJdBlocks(normalizedHtml);
  const textFromBlocks=officialBlocksText(blocks);
  const ashbyPlain=board.platform==="ashby"&&typeof raw.descriptionPlain==="string"?
    raw.descriptionPlain:"";
  const plain=textFromBlocks||(ashbyPlain&&!hasLeakedJdTags(ashbyPlain)?ashbyPlain:
    convert(normalizedHtml,{wordwrap:false,
      selectors:[{selector:"img",format:"skip"},{selector:"a",options:{hideLinkHrefIfSameAsText:true}}]}));
  if(plain.length>200000||normalizedHtml.length>250000)return null;
  if(hasLeakedJdTags(plain))return null;
  // Emit only markup created from parsed, escaped text, never ATS raw HTML.
  const richHtml=blocks.length?officialBlocksHtml(blocks):'<p>'+esc(plain)+'</p>';
  return {job,description:plain,richHtml,status:plain.trim()?"LIVE_CONTENT":"DESCRIPTION_UNAVAILABLE",
   applyUrl:approvedApplyUrl(raw.applyUrl,board),
   checkedAt:new Date().toISOString()};
 }catch{return null;}
}
function domesticDetailHtml(j:Job):string{
 const meituan=j.company==="Meituan",direct=j.company!=="Xiaomi",name=companyZh[j.company]||j.company;
 const category=({SOCIAL:"社招",CAMPUS:"校招",INTERNSHIP:"实习"} as Record<string,string>)[j.recruitmentType||""]||"待核实";
 const note=meituan?"2026-10-18核验美团官方职位详情，当时可见申请入口。请在官网确认当前是否在招；未核实申请提交。":direct?"腾讯/百度官方单岗页面于2026-10-18观察到职位名称和地点。当前是否在招、具体投递状态请在官网核对，HHBA不转载完整JD。":"2026-10-16小米官方列表观察记录。当前在招状态、完整任职要求及直达投递链接尚未核实。";
 const english=meituan?"Official Meituan job and Apply entry observed October 18, 2026. Recheck availability.":direct?"Tencent/Baidu official job detail page observed October 18, 2026. Current opening and application status unverified.":"Xiaomi public job list observed October 16, 2026. Current opening and direct application unverified.";
 const attrs=(a:string,b:string)=>' data-zh="'+esc(a)+'" data-en="'+esc(b)+'"';
 return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(j.title)+' · HHBA</title><style>body{font-family:system-ui;margin:0;color:#183c28;background:#f5f7f5}header{background:white;padding:20px;font-weight:900;font-size:24px}main{max-width:850px;margin:25px auto;padding:18px}article{background:#fff;border-radius:12px;padding:26px}h1{font-size:30px}.notice{background:#fff8ea;padding:18px;line-height:1.8;margin:22px 0}.action{display:inline-block;background:#207247;border-radius:8px;padding:14px;color:white;text-decoration:none}button{padding:9px;margin:4px}</style></head><body><header>HHBA</header><main><a href="/"'+attrs("← 返回招聘市场","← Back to jobs")+'>← 返回招聘市场</a><article><div style="text-align:right"><button id="zh">中文</button><button id="en">English</button></div><p'+attrs(name+" · 官方招聘记录",j.company+" · Official job observation")+'>'+name+' · 官方招聘记录</p><h1'+attrs(j.title,"Original job title available in Chinese")+'>'+esc(j.title)+'</h1><p'+attrs(j.location+" · "+category,"Mainland China · "+(j.recruitmentType||"Unknown"))+'>'+esc(j.location)+' · '+category+'</p><p'+attrs("来源观察："+j.observedAt,"Source observed: "+j.observedAt)+'>来源观察：'+esc(j.observedAt)+'</p><div class="notice"'+attrs(note,english)+'>'+esc(note)+'</div><a class="action" href="'+esc(j.url)+'" target="_blank" rel="noopener noreferrer nofollow"'+attrs(direct?"查看官方职位详情 ↗":"前往小米官方招聘频道 ↗",direct?"Open official job details ↗":"Open Xiaomi careers ↗")+'>'+(meituan?"前往美团官方职位与申请入口 ↗":"前往小米官方招聘频道 ↗")+'</a></article></main><script>(function(){function set(l){document.documentElement.lang=l==="en"?"en":"zh-CN";for(const e of document.querySelectorAll("[data-zh][data-en]"))e.textContent=e.dataset[l];}for(const l of ["zh","en"])document.getElementById(l).onclick=()=>{try{localStorage.setItem("hhba-lang",l)}catch{}set(l)};let l="zh";try{l=localStorage.getItem("hhba-lang")==="en"?"en":"zh"}catch{}set(l);})();</script></body></html>';
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
  '<script>'+ "(function(){\ndocument.addEventListener(\"error\",function(e){const t=e.target;if(t&&t.tagName===\"IMG\"&&t.closest(\".company-logo\"))t.closest(\".company-logo\").classList.add(\"logo-fallback\");},true);\nlet lang=\"zh\";\ntry{lang=localStorage.getItem(\"hhba-lang\")===\"en\"?\"en\":\"zh\"}catch{}\nconst reader=document.querySelector(\"#personal-reader\");\nconst retry=document.querySelector(\"#retry-translation\");\nconst note=document.querySelector(\"#translation-note\");\nconst progress=document.querySelector(\"#translation-progress\");\nconst output=document.querySelector(\"#translated-paragraphs\");\nconst numericRisk=document.querySelector(\"#numeric-risk\");\nconst originalButton=document.querySelector(\"#show-original-english\");\nlet numericIssues=0;\nlet inflight=null;\n\nfunction renderChineseJD(raw,host=output){\n if(!host)return;\n // Text nodes only; no translated third-party HTML enters the DOM.\n // Blank lines come from both ATS extraction and machine translation.\n const lines=String(raw||\"\").replace(/\\r\\n?/g,\"\\n\").replace(/\\u00a0/g,\" \")\n  .replace(/[ \\t]+\\n/g,\"\\n\").split(\"\\n\");\n const fragment=document.createDocumentFragment();\n let previous=null,wasBlank=false;\n function append(kind,text){\n  const el=document.createElement(kind===\"heading\"?\"h3\":\"div\");\n  el.className=kind===\"heading\"?\"jd-heading\":kind===\"bullet\"?\"jd-bullet\":\"jd-paragraph\";\n  el.textContent=text;\n  fragment.appendChild(el);\n  previous={kind,element:el};\n }\n for(const rawLine of lines){\n  let line=rawLine.trim().replace(/[ \\t]{2,}/g,\" \");\n  if(!line){wasBlank=true;continue;}\n  // An isolated dot is a translation/HTML-to-text artefact, not a JD item.\n  if(/^[.。．]{1,2}$/.test(line)||/^[-–—•●▪]\\s*$/.test(line)){wasBlank=true;continue;}\n  const heading=line.match(/^#{1,4}\\s*(.+)$/);\n  if(heading)line=heading[1].trim();\n  const isHeading=!!heading||(\n   line.length<=32&&(\n    /[：:]$/.test(line)||\n    /^(岗位职责|主要职责|任职资格|任职要求|资格条件|岗位要求|福利待遇|职位介绍|工作内容|基本要求|优先条件|关于我们|关于团队|薪资待遇|工作职责|申请要求)$/.test(line)\n   ));\n  if(isHeading){\n   append(\"heading\",line);\n   wasBlank=false;continue;\n  }\n  const bullet=line.match(/^(?:[-–—•●▪*]\\s+|[0-9]{1,2}[.)、]\\s+)(.+)$/);\n  if(bullet){\n   append(\"bullet\",bullet[1].trim());\n   wasBlank=false;continue;\n  }\n  // Line breaks inside a single list item or paragraph should not become\n  // huge separate vertical blocks; preserve actual section boundaries.\n  if(previous&&!wasBlank&&(previous.kind===\"bullet\"||previous.kind===\"paragraph\")){\n   const prior=previous.element.textContent||\"\";\n   const space=/[A-Za-z0-9]$/.test(prior)&&/^[A-Za-z0-9]/.test(line)?\" \":\"\";\n   previous.element.textContent=prior+space+line;\n  }else append(\"paragraph\",line);\n  wasBlank=false;\n }\n host.replaceChildren(fragment);\n}\n\nasync function translate(){\n if(!reader||reader.dataset.done===\"true\")return;\n if(inflight)return inflight;\n inflight=(async()=>{\n   if(retry)retry.hidden=true;\n   if(numericRisk)numericRisk.hidden=true;\n   numericIssues=0;\n   let parts=[],part=0,total=1;\n   let saved=null;\n   const storageKey=\"hhba-reader-v4-semantic-jd:\"+reader.dataset.job+\":\"+reader.dataset.hash;\n   try{saved=sessionStorage.getItem(storageKey)}catch{}\n   if(saved&&output){renderChineseJD(saved);progress.textContent=\"中文译文已加载（本次浏览会话缓存）\";note.textContent=\"这是机器即时翻译，请核对对应的英文原文。\";reader.dataset.done=\"true\";return;}\n   if(output)output.textContent=\"\";\n   try{\n    while(part<total){\n     let response=null;\n     for(let trial=0;trial<2;trial++){\n      response=await fetch(\"/api/jobs/\"+encodeURIComponent(reader.dataset.job)+\"/translate-part\",{\n       method:\"POST\",credentials:\"same-origin\",\n       headers:{\"Content-Type\":\"application/json\"},\n       body:JSON.stringify({part,sourceHash:reader.dataset.hash})\n      });\n      if(response.status!==429)break;\n      await new Promise(r=>setTimeout(r,3000));\n     }\n     if(!response||!response.ok){\n      let payload={};try{payload=await response.json()}catch{}\n      if(payload.error===\"source_changed\")throw Error(\"官方岗位内容已更新，请刷新页面重试。\");\n      if(payload.error===\"source_too_long\")throw Error(\"这条官方职位描述过长，暂无法完整翻译。请切换英文查看企业官方原文。\");\n      if(payload.error===\"translation_incomplete\")throw Error(\"检测到本段仍包含未翻译的英文长句。系统没有把不完整译文当成中文显示，请重试或切换英文。\");\n      throw Error(\"第 \"+(part+1)+\" 段翻译暂时失败，可以重试或查看完整英文原文。\");\n     }\n     const result=await response.json();\n     if(result.jobId!==reader.dataset.job||result.sourceHash!==reader.dataset.hash||\n        result.part!==part||!Number.isInteger(result.total)||result.total<1||result.total>80||\n        typeof result.text!==\"string\")throw Error(\"译文与当前岗位版本不一致，请刷新页面。\");\n     if(part===0)total=result.total;\n     if(result.total!==total)throw Error(\"官方岗位在翻译过程中发生变化，请刷新页面。\");\n     if(result.numbersVerified===false){numericIssues++;if(numericRisk)numericRisk.hidden=false;}\n     parts.push(result.text);\n     if(output)renderChineseJD(parts.join(\"\\n\\n\"));\n     part++;\n     if(progress)progress.textContent=\"已翻译 \"+part+\" / \"+total+\" 段\";\n    }\n    const complete=parts.join(\"\\n\\n\");\n    if(reader&&complete.trim()){\n     try{sessionStorage.setItem(storageKey,complete)}catch{}\n     reader.dataset.done=\"true\";\n     if(note)note.textContent=\"中文即时翻译已完成（机器译文，仅供辅助理解）。请对照英文原文核对招聘条件。\";\n     if(progress)progress.textContent=\"已完成 \"+total+\" / \"+total+\" 段\";\n    }\n   }catch(err){\n     if(note)note.textContent=err.message||\"翻译暂时不可用。\";\n     if(progress)progress.textContent=parts.length?\"当前已完成 \"+parts.length+\" 段。其余内容请查看下方完整原文。\":\"下面可以直接展开完整官方英文原文。\";\n     if(retry)retry.hidden=false;\n   }\n })();\n try{return await inflight}finally{inflight=null}\n}\nfunction set(v){\n lang=v===\"en\"?\"en\":\"zh\";\n try{localStorage.setItem(\"hhba-lang\",lang)}catch{}\n document.querySelector(\"#jd-zh\").hidden=lang!==\"zh\";\n document.querySelector(\"#jd-en\").hidden=lang!==\"en\";\n document.querySelector(\"#detail-zh\").classList.toggle(\"selected\",lang===\"zh\");\n document.querySelector(\"#detail-en\").classList.toggle(\"selected\",lang===\"en\");\n document.querySelector(\"#detail-title\").textContent=document.querySelector(\"#detail-title\").dataset[lang];\n document.querySelector(\"#detail-place\").textContent=document.querySelector(\"#detail-place\").dataset[lang];\n const labels={\n \"#detail-brand\":[\"· 招聘市场\",\"· Job Marketplace\"],\n \"#detail-back\":[\"← 返回招聘市场\",\"← Back to jobs\"],\n \"#jd-label\":[\"岗位完整描述\",\"Full job description\"],\n \"#detail-apply\":[\"前往企业官网申请 ↗\",\"Apply on employer website ↗\"],\n \"#detail-official\":[\"查看对应官方职位页 ↗\",\"View original job posting ↗\"],\n \"#detail-disclaimer\":[\"资料来自企业公开招聘系统，机器翻译仅供辅助阅读。申请资格及最终岗位状态以企业官网为准；HHBA 不代表招聘企业。\",\"Information comes from public employer job boards. HHBA is not affiliated with employers. Requirements and availability are governed by the official posting.\"]\n};\nfor(const [selector,pair] of Object.entries(labels)){\n const element=document.querySelector(selector);\n if(element)element.textContent=pair[lang===\"en\"?1:0];\n}\nconst source=document.querySelector(\"#detail-source\");\nif(source)source.textContent=lang===\"zh\"?\"企业官方岗位 · 读取时间 \"+source.dataset.check+\" · 中文机器译文仅供参考\":\n \"Original employer posting · Retrieved \"+source.dataset.check+\" · English source text\";\nconst remote=document.querySelector(\"#detail-remote\");\nif(remote){const value=remote.dataset.value;\n remote.textContent=value===\"true\"?(lang===\"en\"?\"Remote\":\"远程\"):\n value===\"false\"?(lang===\"en\"?\"Not remote\":\"非远程\"):\n (lang===\"en\"?\"Remote unspecified\":\"远程方式未标明\");}\ndocument.documentElement.lang=lang===\"en\"?\"en\":\"zh-CN\";\ndocument.title=document.querySelector(\"#detail-title\").textContent+\" · HHBA\";\nif(lang===\"zh\"&&reader)void translate();\n}\ndocument.querySelector(\"#detail-zh\").onclick=()=>set(\"zh\");\ndocument.querySelector(\"#detail-en\").onclick=()=>set(\"en\");\nif(retry)retry.onclick=()=>{reader.dataset.done=\"false\";void translate()};\nif(originalButton)originalButton.onclick=()=>set(\"en\");\nconst licensed=document.querySelector(\"#licensed-zh-jd\");\nif(licensed)renderChineseJD(licensed.textContent,licensed);\nset(lang);\n})()" +'</script></body></html>';
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

/** Restore grouped numbers that machine translation separated with spaces.
 * Examples: $182,800 -> 182 800美元 -> 182,800美元. Does not invent numbers.
 */

/** Keep an employer's official product name intact in machine-translated JD.
 * These fixes are limited to evidenced mistranslations for this board.
 */
function stabilizeEmployerTerminology(company:string,translated:string):string{
 if(company!=="Airtable")return translated;
 return translated
  .replace(/\b(?:Airbet|Airable|AirTable)\b/gi,"Airtable")
  .replace(/空气表|气表/g,"Airtable")
  .replace(/机票(?=是机会均等|致力于|是一个|是一家)/g,"Airtable")
  .replace(/公司账户执行人/g,"企业客户经理")
  .replace(/企业账户执行官/g,"企业大客户经理");
}

function restoreGroupedNumbers(source:string,translated:string):string{
 let fixed=translated;
 for(const token of new Set(source.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g)||[])){
  if(fixed.includes(token))continue;
  const pattern="(?<!\\d)"+token.split(",").map(x=>x.replace(/\./g,"\\.")).join("[\\s,，]+")+"(?!\\d)";
  fixed=fixed.replace(new RegExp(pattern,"g"),token);
 }
 return fixed;
}

function numbersRetained(original:string,translated:string):boolean{
 const translatedDigits=numberTokens(translated);
 // Equivalent number formats are valid: 3,000 = 3000, 500,000 = 50万.
 // Preserve percentages as percentages. A wrong value still fails.
 const equivalent=(source:string,target:string)=>{
  const percentSource=/[%％]$/.test(source),percentTarget=/[%％]$/.test(target);
  if(percentSource!==percentTarget)return false;
  const left=Number(source.replace(/[,％%]/g,"")),right=Number(target.replace(/[,％%]/g,""));
  return Number.isFinite(left)&&Number.isFinite(right)&&left===right;
 };
 const expressed:string[]=[];
 for(const m of translated.matchAll(/(\d+(?:\.\d+)?)\s*(?:多|余)?\s*(百万|千|万|亿)/g)){
  const factors:Record<string,number>={"千":1000,"万":10000,"百万":1000000,"亿":100000000};
  expressed.push(String(Number(m[1])*factors[m[2]]));
 }
 return numberTokens(original).every(token=>{
  if(translatedDigits.some(x=>equivalent(token,x)))return true;
  if(/[%％]$/.test(token))return false;
  const numeric=Number(token.replace(/,/g,""));
  return Number.isFinite(numeric)&&expressed.includes(String(numeric));
 });
}
/**
 * Numeral-safe fallback for MT that spelled a source digit in Chinese.
 * Never invent numerical values: only attach source-observed numbers and only
 * if no extra, contradictory Arabic-number value appears in the translation.
 * A visible "official original numbers" note avoids implying that a unit was
 * reliably placed into the translated sentence.
 */
function preserveOfficialNumbers(source:string,translated:string):string|null{
 if(numbersRetained(source,translated))return translated;
 const originals=numberTokens(source);
 if(!originals.length)return translated;
 const asValue=(token:string)=>{
  const percent=/%|％/.test(token);
  const amount=Number(token.replace(/[,％%]/g,""));
  return Number.isFinite(amount)?{amount,percent}:null;
 };
 const originalValues=originals.map(asValue);
 const permitted=(token:string)=>{
  const target=asValue(token);
  if(!target)return false;
  if(originalValues.some(x=>x && x.percent===target.percent && x.amount===target.amount))
    return true;
  // 50万 is an equivalent formatting of an official 500,000, not a new value.
  const factors:Record<string,number>={"千":1000,"万":10000,"亿":100000000,"百万":1000000};
  if(target.percent)return false;
  for(const match of translated.matchAll(/(\d+(?:\.\d+)?)\s*(?:多|余)?\s*(百万|千|万|亿)/g)){
   if(match[1]===token && originalValues.some(x=>x && !x.percent &&
     x.amount===Number(match[1])*factors[match[2]]))return true;
  }
  return false;
 };
 if(numberTokens(translated).some(token=>!permitted(token)))return null;
 const missing=originals.filter(token=>!numbersRetained(token,translated));
 if(!missing.length)return translated;
 if(missing.length>8)return null;
 const unique=[...new Set(missing)];
 const result=translated.trimEnd()+"\n（官网原文数字核对："+unique.join("、")+"）";
 return numbersRetained(source,result)?result:null;
}
function selfTestOfficialNumericFidelity(){
 const restored=preserveOfficialNumbers("5 years of experience","具有五年工作经验");
 const wrong=preserveOfficialNumbers("5 years of experience","具有3年工作经验");
 const unit=preserveOfficialNumbers("$500,000 annual salary","年薪为50万美元");
 const percent=preserveOfficialNumbers("20% annual bonus","20％年度奖金");
 const many=preserveOfficialNumbers("3 to 5 years","三到五年");
 const noDigits=preserveOfficialNumbers("Develop a product","开发一款产品");
 if(!restored?.includes("官网原文数字核对：5")||wrong!==null||
    unit!== "年薪为50万美元" || percent!=="20％年度奖金" ||
    !many?.includes("3、5")||noDigits!=="开发一款产品")
   throw Error("OFFICIAL_JD_NUMERAL_FIDELITY_REGRESSION");
 console.log("HHBA_OFFICIAL_JD_NUMBER_GUARD",{pass:true,missingOriginalRestored:true,contradictionRejected:true});
}
selfTestOfficialNumericFidelity();
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
  return arr.map((x,i)=>typeof x==="string"&&x.length>=(kind==="jd"?1:2)&&/[\u3400-\u9fff]/.test(x)&&(kind==="jd"||numbersRetained(sources[i],x))?x:null);
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
  const unique=[...new Set(rows.filter(x=>!x.domestic).map(x=>x.title))];
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
 const result=await machineTranslations("jd",[d.description]);
 const value=result?.[0];
 if(!value||!numbersRetained(d.description,value)||!licensedJd(d))return null;
 toCache("jd",d.description,value,"rights-reviewed-machine");
 return value;
}

function firstPageJobCards(rows:Job[]):string{
 const unique=new Map<string,Job>();
 for(const j of rows)if(!unique.has(j.company))unique.set(j.company,j);
 return [...unique.values()].slice(0,30).map(j=>{
  const name=companyZh[j.company]||j.company;
  const title=j.domestic?j.title:(present(j).titleZh||j.title);
  const place=j.domestic?j.location:translateLocation(j.location);
  const initials=esc(j.company.slice(0,2).toUpperCase()),domain=employerBrandSites[j.company];
  const icon='<span class="company-logo" aria-hidden="true"><span class="company-initials">'+initials+'</span>'+(domain?'<img src="https://'+esc(domain)+'/favicon.ico" alt="" loading="lazy" decoding="async">':'')+'</span>';
  const detail='/jobs/'+encodeURIComponent(j.id);
  return '<article class="job"><div class="job-main">'+icon+'<div class="job-body"><a class="job-title" href="'+detail+'">'+esc(title)+'</a><div class="company-name">'+esc(name)+'</div><div class="job-meta"><span>'+esc(place)+'</span><span>'+(j.domestic?'国内官方 · 招聘状态待核实':'海外企业官方招聘')+'</span></div></div></div><a class="visit" href="'+detail+'">查看岗位详情 ↗</a></article>';
 }).join("");
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
.empty{padding:36px 22px;text-align:center;color:#68776b;background:white;border-radius:12px}.filter-tools{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin:-10px 0 20px;font-size:12px;color:#658070}.filter-clear{border:1px solid #c8d9ce;border-radius:8px;background:#fff;color:#1e6740;cursor:pointer;font:inherit;font-weight:700;padding:8px 14px}.filter-clear:hover{background:#e8f4ed}.filter-clear[hidden]{display:none}.empty .filter-clear{margin-top:15px}
footer{padding:25px;text-align:center;color:#8a9b8f;font-size:11px;border-top:1px solid #e5eae4}
@media(max-width:600px){.hero{padding:50px 22px}nav{padding:16px 22px;gap:10px;flex-wrap:wrap}.job{display:block;padding:17px}.job-main{gap:12px}.company-logo{width:48px;height:48px;flex-basis:48px}.job-title{font-size:16px}.visit{display:inline-flex;margin:15px 0 0 60px}.numbers{gap:23px}}
.hhba-entrances{display:flex;gap:10px;align-items:center}.hhba-entrances a{display:inline-block;color:#fff;text-decoration:none;border:1px solid #b4d5bf;border-radius:9px;padding:8px 12px;font-size:13px;font-weight:650}.hhba-entrances a:hover{background:#e4f2e8;color:#16472f}@media(max-width:600px){.hhba-entrances{order:3;width:100%;justify-content:center}}</style></head><body><nav><div class="logo">HHBA <em id="market-brand">招聘市场</em></div><div class="hhba-entrances"><a href="/candidate" aria-label="我要应聘">我要应聘</a><a href="/employer" aria-label="我要招人">我要招人</a></div><div id="market-lab" class="lab">真实企业招聘索引 · 公测</div><div class="lang-switch" aria-label="岗位语言"><button id="toggle-zh" type="button">中文</button><button id="toggle-en" type="button">English</button></div></nav><section class="hero"><div class="wrap"><div id="market-kicker" class="eyebrow">全球职业机会 · 企业官方来源</div><h1 id="market-h1">发现全球工作机会</h1><p id="market-subtitle">搜索海外企业公开招聘岗位，在 HHBA 阅读岗位详情，再前往企业官网申请。岗位来自 Greenhouse、Lever、Ashby 的公开招聘接口。</p><div class="numbers"><div class="num"><b id="count">${payload.total}</b><span id="market-count-label">本次获取的岗位</span></div><div class="num"><b>${payload.boards}</b><span id="market-board-label">成功读取的招聘板</span></div><div class="num"><b>4</b><span id="market-source-label">有岗位记录的国内企业</span></div><div class="num"><b id="translated-count">—</b><span id="translated-label">已机器翻译职位名称</span></div></div></div></section>
<main><div id="market-status" data-updated="${esc(payload.updated)}" data-failures="${payload.failures}" class="status">默认显示中文岗位名称。术语规则翻译属于初版，未完成的翻译会标注“待翻译”；切换英文可核对官方标题。公测版说明：本次已接入 ${payload.boards} 个企业招聘板，不代表全量全球职位。最近同步：${esc(payload.updated)}。职位是否仍接受申请以企业官网为准。${payload.failures?" 有 "+payload.failures+" 个来源本轮暂不可用。":""}</div>
<div class="filters"><input id="q" aria-label="搜索岗位或企业" placeholder="搜索岗位、公司、地点（支持英文）"><select id="company" aria-label="企业"><option value="">全部企业</option></select><select id="country" aria-label="招聘来源"><option value="">全部来源</option><option value="cn">国内官方</option><option value="global">海外 ATS</option></select><select id="recruitment" aria-label="招聘类型"><option value="">全部招聘类型</option><option value="SOCIAL">社招</option><option value="CAMPUS">校招</option><option value="INTERNSHIP">实习</option></select><select id="remote" aria-label="远程筛选"><option value="">全部工作方式</option><option value="yes">标注远程</option></select></div>
<div class="filter-tools"><span id="filter-summary" aria-live="polite"></span><button type="button" id="clear-filters" class="filter-clear" hidden>清除全部筛选</button></div><div class="section-title"><h2 id="market-list-h2">官方岗位列表</h2><span id="shown">显示 ${Math.min(payload.total,30)} / ${payload.total} 条</span></div><div class="list" id="jobs">${firstPageJobCards(payload.rows||[])}</div><p id="market-disclaimer" class="disclaimer">数据源为外部企业公开招聘板。部分企业官网在不同网络环境下可能无法访问。岗位发布时间、工作类型、远程标记在接口未披露时不会推断，具体资格要求和投递方式请到企业官网核实。HHBA 不代表与招聘企业存在合作关系。</p></main><footer id="market-footer">HHBA · 全球职位索引 · 仅展示公开岗位资料与官网链接</footer>
<script>
let all=[],filtered=[],limit=30,totalFiltered=0,companyNames=[],latestRequest=0,searchTimer=null;
window.hhbaBoardCount=${payload.boards};
let lang='zh';
try{lang=localStorage.getItem('hhba-lang')==='en'?'en':'zh';}catch{}
const aliases=${JSON.stringify(searchAliases)};
const employerBrandSites=${JSON.stringify(employerBrandSites)};
const companyZh=${JSON.stringify(companyZh)};
const domesticEmployers=new Set(['Xiaomi','Meituan','Tencent','Baidu']);
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
 const sources=lang==='zh'?['全部来源','国内官方','海外 ATS']:['All sources','Mainland official','International ATS'];
 Array.from(document.querySelector('#country').options).forEach((o,i)=>o.textContent=sources[i]);
 const types=lang==='zh'?['全部招聘类型','社招','校招','实习']:['All recruitment types','Experienced','Graduate','Internship'];
 Array.from(document.querySelector('#recruitment').options).forEach((o,i)=>o.textContent=types[i]);
 document.querySelector('#company').options[0].textContent=lang==='zh'?'全部企业':'All companies';
 document.querySelector('#market-h1').textContent=lang==='zh'?'发现全球工作机会':'Explore global career opportunities';
 document.querySelector('#market-subtitle').textContent=lang==='zh'?'同一个市场搜索海外 ATS 岗位和国内企业官方招聘列表记录。历史岗位请到企业官网核实。':'Search international ATS jobs and historical observations from mainland employer job boards in one marketplace.';
 document.querySelector('#market-list-h2').textContent=lang==='zh'?'官方岗位列表':'Official job listings';
 document.querySelector('#translated-label').textContent=lang==='zh'?'已机器翻译职位名称':'Machine-translated job titles';
 document.querySelector('#clear-filters').textContent=lang==='zh'?'清除全部筛选':'Clear all filters';
 const labels=[
  ['#market-brand','招聘市场','Job Marketplace'],
  ['#market-lab','真实企业招聘索引 · 公测','Official employer jobs · Beta'],
  ['#market-kicker','全球职业机会 · 企业官方来源','GLOBAL CAREERS · OFFICIAL SOURCES'],
  ['#market-count-label','索引记录（含历史观察）','Indexed records (including historical observations)'],
  ['#market-board-label','海外招聘板','International ATS boards'],
  ['#market-source-label','有岗位记录的国内企业','Domestic employers with job records'],
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
 if(all.length)render();
}
document.querySelector('#toggle-zh').addEventListener('click',()=>setLanguage('zh'));
document.querySelector('#toggle-en').addEventListener('click',()=>setLanguage('en'));
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const q=document.querySelector("#q"),c=document.querySelector("#company"),country=document.querySelector("#country"),recruitment=document.querySelector("#recruitment"),remote=document.querySelector("#remote"),list=document.querySelector("#jobs");
function currentFilters(){
 const flags=[];
 if(country.value)flags.push(country.options[country.selectedIndex].text);
 if(recruitment.value)flags.push(recruitment.options[recruitment.selectedIndex].text);
 if(q.value.trim())flags.push((lang==='zh'?'关键词：':'Keyword: ')+q.value.trim());
 if(c.value)flags.push((lang==='zh'?'企业：':'Company: ')+c.value);
 if(remote.value)flags.push(lang==='zh'?'仅远程':'Remote only');
 return flags;
}
function syncFilterStatus(){
 const flags=currentFilters();
 document.querySelector('#clear-filters').hidden=!flags.length;
 document.querySelector('#filter-summary').textContent=flags.length?flags.join('  ·  '):(lang==='zh'?'搜索企业名称或职位关键词，例如 OpenAI':'Try a company or job title, e.g. OpenAI');
}
function clearFilters(){
 q.value='';c.value='';country.value='';recruitment.value='';remote.value='';limit=30;
 const u=new URL(window.location.href);u.searchParams.delete('q');window.history.replaceState(null,'',u.pathname+u.search+u.hash);
 void fetchJobs(true);
}
document.querySelector('#clear-filters').addEventListener('click',clearFilters);
function render(reset=true){
 if(reset)limit=30;
 filtered=all;
 syncFilterStatus();
 document.querySelector("#shown").textContent=(lang==="zh"?"显示 ":"Showing ")+Math.min(totalFiltered,limit)+" / "+totalFiltered+(lang==="zh"?" 条":" jobs");
 list.innerHTML=filtered.slice(0,limit).map(x=>{
  const href='/jobs/'+encodeURIComponent(x.id);
  const company=lang==='zh'?(x.companyZh||x.company):x.company;
  const title=x.domestic?(lang==='zh'?x.title:'Original title available in Chinese'):(lang==='zh'?(x.titleZh||'职位名称待翻译'):x.title);
  const location=x.domestic&&lang==='en'?'Mainland China':(lang==='zh'?(x.locationZh||x.location):x.location);
  const remoteText=x.domestic?(lang==='zh'?({SOCIAL:'社招',CAMPUS:'校招',INTERNSHIP:'实习'}[x.recruitmentType]||'类别待核实'):({SOCIAL:'Experienced',CAMPUS:'Graduate',INTERNSHIP:'Internship'}[x.recruitmentType]||'Type unverified')):x.remote===true?(lang==='zh'?'远程':'Remote'):x.remote===false?(lang==='zh'?'非远程':'Not remote'):(lang==='zh'?'远程未标注':'Remote not specified');
  return '<article class="job"><div class="job-main">'+logoMarkup(x.company)+'<div class="job-body"><a class="job-title" href="'+href+'">'+safe(title)+'</a><div class="company-name">'+safe(company)+'</div><div class="job-meta"><span>'+safe(location)+'</span><span>'+safe(remoteText)+'</span><span>'+(x.domestic&&x.company!=='Xiaomi'?(lang==='zh'?'官方职位 · 当前申请需核对':'Official job · Recheck availability'):x.domestic?(lang==='zh'?'历史列表 · 投递未核实':'Historical listing · Apply unverified'):(lang==='zh'?'官方招聘来源':'Official employer listing'))+'</span></div><div class="job-source">'+(x.domestic&&x.company!=='Xiaomi'?(lang==='zh'?(x.companyZh||x.company)+'官方职位 · '+x.observedAt:(x.company+' official job · '+x.observedAt)):x.domestic?(lang==='zh'?'小米官方招聘频道 · 2026-10-16':'Xiaomi official board · 2026-10-16'):safe(x.platform.toUpperCase()))+'</div></div></div><a class="visit" href="'+href+'">'+(x.domestic?(lang==='zh'?'查看岗位记录 ↗':'View observed record ↗'):(lang==='zh'?'查看岗位详情 ↗':'View job details ↗'))+'</a></article>';
 }).join("");
 if(!filtered.length)list.innerHTML='<div class="empty">'+(lang==='zh'?'没有找到符合当前筛选的岗位，请检查企业和远程筛选条件。':'No jobs match these filters. Check the company and remote filters.')+'<div><button type="button" id="reset-empty" class="filter-clear">'+(lang==='zh'?'清除筛选并重新搜索':'Clear filters and search again')+'</button></div></div>';
 document.querySelector('#reset-empty')?.addEventListener('click',clearFilters);
 if(totalFiltered>limit)list.innerHTML+='<div style="text-align:center;padding:20px"><button style="padding:12px 35px;border-radius:9px;border:1px solid #c7dacc;background:#fff;cursor:pointer" id="more">'+(lang==='zh'?'查看更多职位':'Load more jobs')+'</button></div>';
 document.querySelector("#more")?.addEventListener("click",()=>{limit+=30;void fetchJobs(false)});
}
async function fetchJobs(reset=true){
 if(reset)limit=30;
 const token=++latestRequest;
 const params=new URLSearchParams({limit:String(limit),offset:"0"});
 const query=q.value.trim();
 const requestedEmployer=Object.keys(employerBrandSites).find(name=>name.toLowerCase()===query.toLowerCase()||companyZh[name]===query);
 if(requestedEmployer&&domesticEmployers.has(requestedEmployer)&&country.value==='global')country.value='';
 if(requestedEmployer&&!domesticEmployers.has(requestedEmployer)&&country.value==='cn')country.value='';
 if(requestedEmployer&&c.value&&c.value!==requestedEmployer)c.value='';
 if(query)params.set("q",query);
 if(c.value)params.set("company",c.value);
 if(country.value)params.set("country",country.value);
 if(recruitment.value)params.set("recruitment_type",recruitment.value);
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
  if(token===latestRequest){
   all=[];totalFiltered=0;
   list.innerHTML='<div class="empty">'+(lang==="zh"?"搜索暂时失败，请重试。":"Search failed. Please retry.")+'<div><button type="button" id="retry-search" class="filter-clear">'+(lang==="zh"?"重新搜索":"Retry search")+'</button></div></div>';
   document.querySelector("#shown").textContent=lang==="zh"?"搜索暂时不可用":"Search temporarily unavailable";
   document.querySelector("#retry-search")?.addEventListener("click",()=>{void fetchJobs(true)});
  }
 }
}
function start(){
 try{
  const parms=new URLSearchParams(window.location.search),urlQuery=parms.get('q');
  if(urlQuery)q.value=urlQuery.slice(0,100);
  if(['cn','global'].includes(parms.get('country')))country.value=parms.get('country');
  if(['SOCIAL','CAMPUS','INTERNSHIP'].includes(parms.get('recruitment_type')))recruitment.value=parms.get('recruitment_type');
 }catch{}
 try{setLanguage(lang)}catch(e){console.error("HHBA_MOBILE_INIT_ERROR",e)}
 void fetchJobs(true);
}
q.addEventListener("input",()=>{
 if(searchTimer)clearTimeout(searchTimer);
 const u=new URL(window.location.href);
 if(q.value.trim())u.searchParams.set('q',q.value.trim());else u.searchParams.delete('q');
 window.history.replaceState(null,'',u.pathname+u.search+u.hash);
 searchTimer=setTimeout(()=>{void fetchJobs(true)},220);
});
c.addEventListener("change",()=>{
 if(c.value&&Object.keys(employerBrandSites).some(name=>name.toLowerCase()===q.value.trim().toLowerCase()&&name!==c.value)){
  q.value='';const u=new URL(window.location.href);u.searchParams.delete('q');window.history.replaceState(null,'',u.pathname+u.search+u.hash);
 }
 void fetchJobs(true);
});
remote.addEventListener("change",()=>{void fetchJobs(true)});
country.addEventListener("change",()=>{if(c.value&&((country.value==='cn'&&!domesticEmployers.has(c.value))||(country.value==='global'&&domesticEmployers.has(c.value))))c.value='';void fetchJobs(true)});
recruitment.addEventListener("change",()=>{void fetchJobs(true)});
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

const JD_READER_SIZE=900;
const JD_READER_MAX_CHARS=100000;
const JD_SYNC_DAILY_CHUNKS=Math.max(1,Math.min(2000,Number.parseInt(Bun.env.HHBA_JD_SYNC_DAILY_CHUNKS||"180",10)||180));
const JD_SYNC_INTERVAL_MS=30_000;
let durableJobStore:ReturnType<typeof openJobSyncStore>|null=null;
let lastCatalogRefresh=0;
let backgroundJdBusy=false;
try{
 // Enforce volume mount existence: never count ephemeral container storage as durable.
 if(Bun.env.HHBA_JD_SYNC_ENABLED==="1"&&existsSync("/sync-state"))
   durableJobStore=openJobSyncStore("/sync-state/overseas-jd.sqlite");
 else if(Bun.env.HHBA_JD_SYNC_ENABLED==="1")
   console.warn("HHBA_JD_SYNC_DISABLED_NO_PERSISTENT_VOLUME");
}catch(error){console.error("HHBA_JD_SYNC_DATABASE_UNAVAILABLE",error instanceof Error?error.message:"unknown");}

// In-memory private, short-lived translation cache keyed by exact official JD hash.
// No full third-party JD or unlicensed translations are exported to Pages or GitHub.
const readerChunkCache=new Map<string,{text:string,at:number,total:number}>();
const readerJobProgress=new Map<string,{parts:Set<number>,total:number,at:number,jobId:string}>();
const READER_CACHE_TTL=2*60*60*1000;
function pruneReaderCache(){
 const now=Date.now();
 for(const [key,value] of readerChunkCache)if(now-value.at>READER_CACHE_TTL)readerChunkCache.delete(key);
 for(const [key,value] of readerJobProgress)if(now-value.at>READER_CACHE_TTL)readerJobProgress.delete(key);
 while(readerChunkCache.size>900)readerChunkCache.delete(readerChunkCache.keys().next().value!);
 while(readerJobProgress.size>300)readerJobProgress.delete(readerJobProgress.keys().next().value!);
}
function markReaderPart(key:string,jobId:string,part:number,total:number){
 let x=readerJobProgress.get(key);
 if(!x||x.total!==total)x={parts:new Set<number>(),total,at:Date.now(),jobId};
 x.parts.add(part);x.at=Date.now();readerJobProgress.set(key,x);
}

const translationRequests=new Map<string,{count:number,expires:number}>();
let activeJdReaders=0;
function jdChunks(full:string):string[]{
 // A translation unit contains up to 5 complete semantic blocks. No HTML
 // and no arbitrary joining of a heading with unrelated requirements.
 const entries=full.replace(/\r\n?/g,"\n").split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
 const expanded:string[]=[];
 for(const entry of entries){
  const prefix=entry.startsWith("# ")?"# ":entry.startsWith("- ")?"- ":"";
  let remaining=prefix?entry.slice(2):entry;
  while(remaining.length>JD_READER_SIZE){
   let stop=remaining.lastIndexOf(" ",JD_READER_SIZE);
   if(stop<JD_READER_SIZE/2)stop=JD_READER_SIZE;
   expanded.push(prefix+remaining.slice(0,stop).trim());
   remaining=remaining.slice(stop).trimStart();
  }
  if(remaining.trim())expanded.push(prefix+remaining.trim());
 }
 const result:string[]=[],batch:string[]=[];
 let length=0;
 const flush=()=>{if(batch.length){result.push(batch.join("\n\n"));batch.length=0;length=0;}};
 for(const entry of expanded){
  if(batch.length&&(batch.length>=5||length+entry.length>JD_READER_SIZE+250))flush();
  batch.push(entry);length+=entry.length;
 }
 flush();
 return result;
}

function humanReaderAllowed(req:Request,u:URL):boolean{
 const origin=req.headers.get("origin");
 const host=req.headers.get("host");
 if(!host||!/^hhba-(?:live-jobs-preview-production|web-production-024c)\.up\.railway\.app(?::443)?$/i.test(host))return false;
 const sameOrigin=origin==="https://"+host.replace(/:443$/,"");
 const pagesOrigin=host.replace(/:443$/,"")==="hhba-web-production-024c.up.railway.app" &&
   origin==="https://yanm-jun.github.io" &&
   /^\/api\/jobs\/[A-Za-z0-9_-]{1,180}\/translate-part$/.test(u.pathname);
 return (sameOrigin||pagesOrigin) &&
   req.headers.get("content-type")?.startsWith("application/json")===true &&
   Number(req.headers.get("content-length")||0)<=300;
}
function readerRateLimit(req:Request):boolean{
 const ip=(req.headers.get("x-forwarded-for")||"anonymous").split(",").at(-1)?.trim()||"anonymous";
 const key=createHash("sha256").update(ip).digest("hex").slice(0,32);
 const now=Date.now();
 if(translationRequests.size>2500)for(const[k,v]of translationRequests)
  if(v.expires<now)translationRequests.delete(k);
 const hit=translationRequests.get(key);
 if(!hit||hit.expires<now){translationRequests.set(key,{count:1,expires:now+3600000});return true;}
 if(hit.count>=120)return false;
 hit.count++;
 return true;
}
type TranslatedChunk={text:string|null;error:string|null};
async function verifiedJdChunk(job:Job,one:string):Promise<TranslatedChunk>{
 const segments=one.split(/\n{2,}/).filter(Boolean).map(raw=>{
  const kind=raw.startsWith("# ")?"heading":raw.startsWith("- ")?"bullet":"paragraph";
  return {kind,original:kind==="paragraph"?raw:raw.slice(2)};
 });
 if(!segments.length||segments.length>8)return {text:null,error:"invalid_layout"};
 const output=await machineTranslations("jd",segments.map(s=>s.original));
 if(!output||output.length!==segments.length||output.some(x=>!x))
  return {text:null,error:"translation_unverified"};
 const translated:string[]=[];
 for(let i=0;i<segments.length;i++){
  const source=segments[i].original;
  const chinese=await ensureChineseProse(output[i]||"");
  if(!chinese)return {text:null,error:"translation_incomplete"};
  const corrected=stabilizeEmployerTerminology(job.company,restoreGroupedNumbers(source,chinese));
  if(hasLeakedJdTags(corrected))return {text:null,error:"translation_markup_leak"};
  let safe=preserveOfficialNumbers(source,corrected);
  if(!safe){
   // Re-translate only the failed section and force original numeric tokens,
   // never silently accept invented salaries, dates, percentages or years.
   const locked=await translateWithSourceNumbers(source,
     async fragments=>await machineTranslations("jd",fragments));
   if(locked){
    const repaired=await ensureChineseProse(locked);
    const fixed=repaired?stabilizeEmployerTerminology(job.company,repaired):null;
    if(fixed&&!hasLeakedJdTags(fixed))safe=preserveOfficialNumbers(source,fixed);
   }
  }
  if(!safe)return {text:null,error:"translation_numbers_mismatch"};
  const mark=segments[i].kind==="heading"?"# ":segments[i].kind==="bullet"?"- ":"";
  translated.push(mark+safe.trim());
 }
 return {text:translated.join("\n\n"),error:null};
}
let fullJdWorker:ReturnType<typeof createFullJdWorker>|null=null;
if(durableJobStore){
 try{
  fullJdWorker=createFullJdWorker({
   store:durableJobStore,
   source:load,
   readDetail:officialDetail,
   chunkJd:jdChunks,
   translateChunk:async(job:Job,chunk:string)=>{
    const result=await verifiedJdChunk(job,chunk);
    if(!result.text)throw Error(result.error||"TRANSLATION_UNAVAILABLE");
    return result.text;
   },
   maxPartsDaily:JD_SYNC_DAILY_CHUNKS,
   maxPartsPerTick:3,
   logger:(...args:any[])=>console.log(...args)
  });
  // Graceful startup: only one background worker; no unaudited automatic
  // ingestion or JD publishing to static GitHub Pages.
  const timer=setInterval(()=>void fullJdWorker?.tick(),JD_SYNC_INTERVAL_MS);
  timer.unref();
  setTimeout(()=>void fullJdWorker?.tick(),8_000).unref();
  console.log("HHBA_FULL_JD_SYNC_ENABLED",JSON.stringify({
   privateVolume:true,dailyChunkLimit:JD_SYNC_DAILY_CHUNKS,
   intervalSeconds:JD_SYNC_INTERVAL_MS/1000,platforms:["greenhouse","ashby","lever"]
  }));
 }catch(error){
  console.error("HHBA_FULL_JD_SYNC_NOT_STARTED",error instanceof Error?error.message:"unknown");
 }
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
 if(!Number.isInteger(part)||part<0||part>150||
    typeof sourceHash!=="string"||!/^[a-f0-9]{64}$/.test(sourceHash))
  return Response.json({error:"bad_reader_request"},{status:400,headers});
 const catalog=await load();
 // White-only verified ATS jobs use the same hash-bound translation path.
 const job=catalog?.rows.find(row=>row.id===match[1])||await fromWhiteIndex(match[1]);
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
  if(chunks.length>150)return Response.json({error:"source_too_many_parts"},{status:422,headers});
  if(part>=chunks.length)return Response.json({error:"part_out_of_range"},{status:404,headers});
  if(durableJobStore){
    try{
      durableJobStore.sourceVersion(job.id,digest,chunks.length);
      const persistent=durableJobStore.cachedPart(job.id,digest,part,chunks.length);
      if(persistent)return Response.json({
        jobId:job.id,part,total:chunks.length,text:persistent,sourceHash:digest,
        numbersVerified:true,sourceUrl:job.url,mode:"private_versioned_cached_translation",cached:true
      },{headers});
    }catch(e){console.warn("HHBA_DURABLE_TRANSLATION_READ",e instanceof Error?e.message:"unknown");}
  }
  const cacheKey=createHash("sha256").update(job.id+"\0"+digest+"\0"+part).digest("hex");
  pruneReaderCache();
  const cached=readerChunkCache.get(cacheKey);
  if(cached&&cached.total===chunks.length){
    markReaderPart(job.id+":"+digest,job.id,part,chunks.length);
    return Response.json({jobId:job.id,part,total:chunks.length,text:cached.text,sourceHash:digest,
      numbersVerified:true,sourceUrl:job.url,mode:"ephemeral_verified_translation",cached:true},{headers});
  }
  const translatedChunk=await verifiedJdChunk(job,chunks[part]);
  if(!translatedChunk.text)return Response.json({error:translatedChunk.error||"translation_unverified",
    part,total:chunks.length},{status:translatedChunk.error==="invalid_layout"?422:503,headers});
  const text=translatedChunk.text;
  if(durableJobStore){
    try{durableJobStore.saveVerifiedPart(job.id,digest,part,chunks.length,text);}
    catch(e){console.warn("HHBA_DURABLE_TRANSLATION_WRITE",e instanceof Error?e.message:"unknown");}
  }
  readerChunkCache.set(cacheKey,{text,at:Date.now(),total:chunks.length});
  markReaderPart(job.id+":"+digest,job.id,part,chunks.length);
  pruneReaderCache();
  return Response.json({jobId:job.id,part,total:chunks.length,text,sourceHash:digest,
    numbersVerified:true,sourceUrl:job.url,mode:"private_semantic_translation",cached:false},{headers});
 }catch(ex){
  console.log("HHBA_READER_ERROR",ex instanceof Error?ex.name:"unknown");
  return Response.json({error:"translation_temporarily_unavailable"},{status:503,headers});
 }finally{activeJdReaders--;}
}

// Only one validated background worker claims the shared SQLite job queue.
// The older duplicate worker caused contention and made progress unpredictable.

// Background-only English warmup of six audited front-page roles.
// Chinese completion uses the normal prioritized, daily-budgeted worker.
// No document leaves the private /sync-state volume or enters public indexes.
const BILINGUAL_FEATURED_IDS=[
 "ashby-openai-18e64608-5881-4b8f-b5cf-abd09a8ff086",
 "ashby-openai-7ba0b390-b198-4101-80bb-b49a6dd62607",
 "greenhouse-anthropic-5426627008",
 "greenhouse-anthropic-5391293008",
 "greenhouse-spacex-8885762002",
 "greenhouse-spacex-8621995002"
];
let warmupActive=false;
async function prewarmFeaturedEnglish(){
 if(!durableJobStore||warmupActive)return;
 warmupActive=true;let saved=0;
 try{
  for(const id of BILINGUAL_FEATURED_IDS){
   try{
    const job=await fromWhiteIndex(id);
    if(!job)continue;
    // Upsert only verified current jobs; never close unrelated source rows.
    durableJobStore.catalogSync([job],{complete:false});
    const detail=await officialDetail(job);
    if(!detail||detail.status!=="LIVE_CONTENT"||!detail.description)continue;
    const chunks=jdChunks(detail.description);
    if(!chunks.length||chunks.length>150)continue;
    const hash=createHash("sha256").update(detail.description).digest("hex");
    durableJobStore.sourceVersion(id,hash,chunks.length,detail.description);
    saved++;
   }catch(e){console.warn("HHBA_FEATURED_JD_WARMUP_SKIP",id,e instanceof Error?e.message:"unknown")}
  }
  console.log("HHBA_FEATURED_ENGLISH_PREWARM",JSON.stringify({saved,total:BILINGUAL_FEATURED_IDS.length}));
 }finally{warmupActive=false}
}
if(durableJobStore){
 setTimeout(()=>void prewarmFeaturedEnglish(),25_000).unref();
 setInterval(()=>void prewarmFeaturedEnglish(),12*3600_000).unref();
}

// The white HHBA React app is compiled into /app/white-site at Docker build.
// Until the independent ATS evidence job is migrated, the same public and
// time-limited evidence snapshots are read from Pages via a strict allowlist.
// Source failure fails closed. No user data, resumes or cookies are proxied.
const WHITE_PUBLIC_ROOT="/app/white-site";
const WHITE_SNAPSHOT_ORIGIN="https://yanm-jun.github.io";
const WHITE_SNAPSHOT_BASE="/hhba-talent/data/";
const WHITE_PUBLIC_DATA=new Set([
 "jobs.json","job-sync-status.json","job-sync-summary.json",
 "job-search-facets.json"
]);
const whiteSnapshotCache=new Map<string,{expires:number,bytes:Uint8Array}>();
const WHITE_MAX_SNAPSHOT_BYTES=32*1024*1024;
async function whiteSnapshot(name:string):Promise<Response>{
 const headers={"Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 if(!WHITE_PUBLIC_DATA.has(name))return Response.json({error:"INVALID_SNAPSHOT_PATH"},{status:404,headers});
 if(Bun.env.HHBA_NATIVE_INDEX_READ==="1"){
  try{
   const nativeCached=whiteSnapshotCache.get("native:"+name);
   if(nativeCached&&nativeCached.expires>Date.now())
    return new Response(nativeCached.bytes,{headers:{...headers,
     "X-HHBA-Index-Source":"railway-verified-volume"}});
   // No pointer on a fresh volume: existing Pages publisher stays available.
   // A corrupt/expired native index is rejected instead of silently serving bad data.
   const native=await readNativeIndex("/sync-state/public-index",name);
   if(native){
    if(whiteSnapshotCache.size>12)whiteSnapshotCache.clear();
    whiteSnapshotCache.set("native:"+name,{expires:Date.now()+30000,bytes:native.bytes});
    return new Response(native.bytes,{headers:{...headers,
     "X-HHBA-Index-Source":"railway-verified-volume"}});
   }
  }catch(e){
   console.error("HHBA_NATIVE_INDEX_REJECTED",e instanceof Error?e.message:"unknown");
   return Response.json({error:"RAILWAY_EVIDENCE_REJECTED"},{status:503,headers});
  }
 }
 const cached=whiteSnapshotCache.get(name);
 if(cached&&cached.expires>Date.now())return new Response(cached.bytes,{headers});
 try{
  const src=await fetch(WHITE_SNAPSHOT_ORIGIN+WHITE_SNAPSHOT_BASE+name,{
   method:"GET",redirect:"error",signal:AbortSignal.timeout(20000),
   headers:{"Accept":"application/json"}});
  if(!src.ok||Number(src.headers.get("content-length")||0)>WHITE_MAX_SNAPSHOT_BYTES)
   throw Error("REMOTE_SNAPSHOT_NOT_READY");
  const bytes=new Uint8Array(await src.arrayBuffer());
  if(!bytes.length||bytes.byteLength>WHITE_MAX_SNAPSHOT_BYTES)
   throw Error("SNAPSHOT_OUT_OF_BOUNDS");
  // Only public JSON objects are cached. Never proxy raw HTML or untrusted URLs.
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(!data||typeof data!=="object"||Array.isArray(data))
   throw Error("SNAPSHOT_INVALID_JSON");
  if(name==="jobs.json"){
   if(!Array.isArray(data.jobs)||!Number.isFinite(Date.parse(data.updated))||
      data.failures!==0||Math.abs(Date.now()-Date.parse(data.updated))>24*3600000)
     throw Error("UNVERIFIED_JOB_SNAPSHOT");
  }else if(name==="job-search-facets.json"){
   if(data.kind!=="HHBA_OFFICIAL_JD_SEARCH_FACETS_V1"||
     !Number.isFinite(Date.parse(data.indexed_as_of))||
     Math.abs(Date.now()-Date.parse(data.indexed_as_of))>24*3600000)
     throw Error("STALE_JOB_FACETS");
  }else if(name==="job-sync-status.json"){
   if(data.summary?.kind!=="HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1"||
      !Number.isFinite(Date.parse(data.summary.indexed_as_of))||
      Math.abs(Date.now()-Date.parse(data.summary.indexed_as_of))>24*3600000)
     throw Error("STALE_JOB_AUDIT");
  }
  if(whiteSnapshotCache.size>8)whiteSnapshotCache.clear();
  whiteSnapshotCache.set(name,{expires:Date.now()+90000,bytes});
  return new Response(bytes,{headers});
 }catch{
  return Response.json({error:"PUBLIC_EVIDENCE_TEMPORARILY_UNAVAILABLE"},{status:503,headers});
 }
}
// Same-service background indexer: only active with explicitly enabled Railway
// production settings, existing mounted durable volume and fixed bundled scripts.
let nativeIndexJobRunning=false;
function startNativeIndexSchedule(){
 if(Bun.env.HHBA_NATIVE_INDEX_PUBLISH!=="1"||
    !Bun.env.RAILWAY_ENVIRONMENT_ID||!existsSync("/sync-state"))return;
 const run=async()=>{
  if(nativeIndexJobRunning)return;
  nativeIndexJobRunning=true;
  const tasks=[
   ["bun","run","scripts/prepare-pages-jobs.mjs"],
   ["bun","run","scripts/audit-all-official-jds.mjs"],
   ["bun","run","/app/publish-official-index.mjs","dist/data","/sync-state/public-index"]
  ];
  try{
   for(const [step,argv] of tasks.entries()){
    const child=Bun.spawn(argv,{cwd:"/app/index-builder",
      stdout:"inherit",stderr:"inherit",env:{...Bun.env}});
    const exitCode=await child.exited;
    if(exitCode!==0)throw Error("NATIVE_INDEX_PHASE_"+(step+1)+"_FAILED_"+exitCode);
   }
   console.log("HHBA_NATIVE_RAILWAY_INDEX_PUBLISHED",{status:"verified_complete"});
  }catch(e){
   console.error("HHBA_NATIVE_INDEX_REFRESH_REJECTED",e instanceof Error?e.message:"unknown");
  }finally{nativeIndexJobRunning=false}
 };
 setTimeout(()=>void run(),45_000).unref();
 setInterval(()=>void run(),12*60*60*1000).unref();
 console.log("HHBA_NATIVE_RAILWAY_INDEX_SCHEDULED",{hours:12,source:"official_ats"});
}
startNativeIndexSchedule();

const WHITE_SPA_ROUTES=/^\/(?:companies(?:\/(?:openai|anthropic|spacex|id\/[A-Za-z0-9_-]{12,600}))?|candidate(?:\/.*)?|employer(?:\/.*)?|recruiter(?:\/.*)?|auth|workspace|public\/[^/?#]+|admin(?:\/.*)?)$/;
async function whiteSiteResponse(req:Request,u:URL):Promise<Response|null>{
 if(req.method!=="GET"&&req.method!=="HEAD")return null;
 const p=u.pathname;
 if(p==="/api/official-index/status"){
  try{
   const active=Bun.env.HHBA_NATIVE_INDEX_READ==="1";
   const native=await readNativeIndex("/sync-state/public-index","jobs.json");
   return Response.json({kind:"HHBA_OFFICIAL_INDEX_STATUS_V1",
    nativeReadEnabled:active,
    nativePublishEnabled:Bun.env.HHBA_NATIVE_INDEX_PUBLISH==="1",
    available:!!native,source:active&&native?"railway-verified-volume":"pages-verified-fallback",
    updated:native?.manifest.updated||null,
    jobs:native?.manifest.jobs||null,facets:native?.manifest.facets||null
   },{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({kind:"HHBA_OFFICIAL_INDEX_STATUS_V1",
    available:false,error:"NATIVE_INDEX_REJECTED"},{status:503});}
 }
 if(p.startsWith("/data/")){
  const match=p.match(/^\/data\/([a-z-]+\.json)$/);
  return match?whiteSnapshot(match[1]):
   Response.json({error:"NOT_FOUND"},{status:404});
 }
 // Serve only locally reviewed original vectors or official-site PNG/SVG icons.
 // Never turn this into an arbitrary filesystem path or URL proxy.
 if(p.startsWith("/brands/")){
  if(!/^\/brands\/(?:(?:openai|claude|spacex|si-[a-z0-9]{2,40})\.svg|brand-[a-z0-9]{2,60}\.(?:png|svg))$/.test(p))
   return new Response("Not found",{status:404});
  const verified=Bun.file(WHITE_PUBLIC_ROOT+p);
  if(!await verified.exists())return new Response("Brand asset not published",{status:404});
  return new Response(req.method==="HEAD"?null:verified,{headers:{
   "Content-Type":p.endsWith(".png")?"image/png":"image/svg+xml; charset=utf-8",
   "Cache-Control":"public, max-age=86400",
   "X-Content-Type-Options":"nosniff",
   "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox"
  }});
 }
 if(p.startsWith("/assets/")){
  if(!/^\/assets\/[A-Za-z0-9._-]{1,180}$/.test(p))
   return new Response("Not found",{status:404});
  const asset=Bun.file(WHITE_PUBLIC_ROOT+p);
  if(!await asset.exists())return new Response("Not found",{status:404});
  return new Response(req.method==="HEAD"?null:asset,{headers:{
   "Content-Type":asset.type||"application/octet-stream",
   "Cache-Control":"public, max-age=31536000, immutable",
   "X-Content-Type-Options":"nosniff"
  }});
 }
 if(p==="/"||p==="/jobs"||WHITE_SPA_ROUTES.test(p)){
  const index=Bun.file(WHITE_PUBLIC_ROOT+"/index.html");
  if(!await index.exists())return new Response("White frontend not built",{status:503});
  return new Response(req.method==="HEAD"?null:index,{headers:{
   "Content-Type":"text/html; charset=utf-8",
   "Cache-Control":"no-store",
   "X-Content-Type-Options":"nosniff",
   "Referrer-Policy":"no-referrer"
  }});
 }
 return null;
}

Bun.serve({port:Number(Bun.env.PORT||3000),hostname:"0.0.0.0",async fetch(req){
 const u=new URL(req.url);
 const adminResponse=await handlePrivateAdmin(req,u);
 if(adminResponse)return adminResponse;
 const engagementResponse=await handleEngagement(req,u);
 if(engagementResponse)return engagementResponse;
 const savedResponse=await handleSavedJobs(req,u,async id=>{
   if(await fromWhiteIndex(id))return true;
   if(/^campus27-(?:baidu|meituan)-[a-z0-9-]{4,80}$/.test(id)){
    try {const campus=await Bun.file(WHITE_PUBLIC_ROOT+"/campus-2027.json").json() as any;
      return campus?.kind==="HHBA_CAMPUS_2027_WAVE1_VERIFIED_DETAILS_V1"&&
        campus.jobs?.some((j:any)=>j.id===id)===true;
    }catch{return false}
   }
   // Domestic public listings share the existing source index and must also be saveable.
   const listings=await load();
   return Boolean(listings?.rows?.some((row:Job)=>row.id===id));
 });
 if(savedResponse)return savedResponse;
 // Preserve old /jobs/:id deep links on the NEW white hostname.
 const oldJobRoute=u.pathname.match(new RegExp("^/jobs/([A-Za-z0-9_-]{1,180})$"));
 if(req.method==="GET"&&oldJobRoute)
  return Response.redirect(u.origin+"/candidate/jobs/"+encodeURIComponent(oldJobRoute[1]),302);
 const whiteResponse=await whiteSiteResponse(req,u);
 if(whiteResponse)return whiteResponse;
 const headers:Record<string,string>={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer"};
 const pagesRequest=req.headers.get("origin")==="https://yanm-jun.github.io" &&
   /^\/api\/jobs\/[A-Za-z0-9_-]{1,180}(?:\/translate-part)?$/.test(u.pathname);
 const pagesSyncStatus=req.headers.get("origin")==="https://yanm-jun.github.io" && u.pathname==="/api/jd-sync/status";
 if(pagesRequest||pagesSyncStatus){
   headers["Access-Control-Allow-Origin"]="https://yanm-jun.github.io";
   headers["Vary"]="Origin";
   headers["Access-Control-Allow-Methods"]="GET, POST, OPTIONS";
   headers["Access-Control-Allow-Headers"]="Content-Type";
 }
 if(req.method==="OPTIONS"&&pagesRequest)
   return new Response(null,{status:204,headers});
 if(req.method==="POST"&&/^\/api\/jobs\/[a-zA-Z0-9_-]{1,180}\/translate-part$/.test(u.pathname))return readJobForTranslation(req,u,headers);
 if(req.method!=="GET")return new Response("Method not allowed",{status:405,headers});
 if(u.pathname==="/health"){const frontendReady=await Bun.file(WHITE_PUBLIC_ROOT+"/index.html").exists();return Response.json({ok:frontendReady,kind:"hhba-white-ats-railway",frontendReady},{status:frontendReady?200:503,headers});}
 // Public, reviewed 2027 campus positions: independent of overseas ATS snapshots.
 // No unverified application claim, no copying of full employer JD.
 if(u.pathname==="/api/campus-2027/jobs"){
  try{
   const file=Bun.file(WHITE_PUBLIC_ROOT+"/campus-2027.json");
   if(!await file.exists())return Response.json({error:"CAMPUS_INDEX_NOT_PUBLISHED"},{status:503,headers});
   const data=await file.json() as any;
   if(data?.kind!=="HHBA_CAMPUS_2027_WAVE1_VERIFIED_DETAILS_V1"||!Array.isArray(data.jobs)||
       data.jobs.length>100||!Number.isFinite(Date.parse(data.capturedAt||"")))
     throw Error("CAMPUS_SOURCE_INVALID");
   const seen=new Set<string>();
   for(const row of data.jobs){
    if(!row||typeof row.id!=="string"||!/^campus27-(?:baidu|meituan)-[a-z0-9-]{4,80}$/.test(row.id)||
       seen.has(row.id)||row.recruitmentType!=="CAMPUS"||row.graduationYear!==2027||
       row.currentApplicationVerified!==false||row.domestic!==true||
       row.recordKind!=="OFFICIAL_JOB_PAGE_OBSERVED"||
       !Number.isFinite(Date.parse(row.observedAt||""))||
       typeof row.title!=="string"||!row.title.trim()||
       typeof row.responsibilitiesSummary!=="string"||!row.responsibilitiesSummary.trim()||
       typeof row.requirementsSummary!=="string"||!row.requirementsSummary.trim())
      throw Error("CAMPUS_JOB_INVALID");
    seen.add(row.id);
    const url=new URL(row.url);
    const baidu=row.platform==="baidu-official"&&row.company==="Baidu"&&url.hostname==="talent.baidu.com"&&
       /^\/jobs\/detail\/GRADUATE\/[a-f0-9-]{36}$/.test(url.pathname);
    const meituan=row.platform==="meituan-official"&&row.company==="Meituan"&&url.hostname==="zhaopin.meituan.com"&&
       url.pathname==="/web/position/detail"&&/^\d{8,20}$/.test(url.searchParams.get("jobUnionId")||"");
    if(url.protocol!=="https:"||url.username||url.password||url.port||(!baidu&&!meituan))throw Error("CAMPUS_OFFICIAL_URL_INVALID");
   }
   return Response.json({kind:data.kind,capturedAt:data.capturedAt,jobs:data.jobs,total:data.jobs.length,
     claim:"OFFICIAL_JOB_DETAIL_ONLY_APPLICATION_STATUS_UNVERIFIED"},{headers});
  }catch(e){console.error("HHBA_CAMPUS_2027_REJECTED",e instanceof Error?e.message:"invalid");return Response.json({error:"CAMPUS_INDEX_VALIDATION_FAILED"},{status:503,headers})}
 }

 // A single fast read for private precomputed, hash-bound bilingual text.
 // This route MUST NOT invoke official ATS fetch or an MT service.
 const readyMatch=u.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]{1,180})\/ready-jd$/);
 if(readyMatch){
  if(!durableJobStore)return Response.json({ready:false,status:"PREPARING",reason:"STORAGE_UNAVAILABLE"},{status:503,headers});
  const id=readyMatch[1];
  const job=await fromWhiteIndex(id);
  if(!job)return Response.json({ready:false,error:"OFFICIAL_JOB_NOT_LISTED"},{status:404,headers});
  const doc=durableJobStore.readyDocument(id,job.url);
  if(!doc)return Response.json({ready:false,status:"PREPARING"},{status:202,headers});
  return Response.json({...doc,job:{id:job.id,url:job.url,title:job.title,company:job.company},
    status:doc.ready?"READY":"TRANSLATING",machineTranslated:!!doc.chineseText,
    note:"Unofficial machine translation; refer to the employer's original posting."
   },{headers});
 }
 if(u.pathname==="/api/jd-ready/status"){
  const items=BILINGUAL_FEATURED_IDS.map(id=>{
   const meta=durableJobStore?.metadata(id);
   const completed=durableJobStore?.readyDocument(id);
   return {id,englishReady:!!completed?.originalText,
     chineseReady:completed?.ready===true,
     done:completed?.done??meta?.done??0,total:completed?.total??meta?.total??0,
     state:meta?.state||"PREPARING"};
  });
  return Response.json({kind:"HHBA_PREPARED_BILINGUAL_V1",
   persistent:!!durableJobStore,featured:items,
   complete:items.filter(j=>j.chineseReady).length,total:items.length,
   noForegroundTranslation:true},{headers});
 }
 if(u.pathname==="/api/jd-sync/status"){
  return Response.json(durableJobStore?{...durableJobStore.coverage(),
   enabled:true,persistent:true,
   translationBudgetRemaining:durableJobStore.remainingBudget(JD_SYNC_DAILY_CHUNKS)}:
   {kind:"HHBA_OVERSEAS_JD_SYNC_V1",enabled:false,persistent:false,
    complete:0,total_current:0,reason:"PRIVATE_VOLUME_NOT_ENABLED"},{headers});
 }

 if(u.pathname==="/api/i18n/status"){
  const d=await load(),records=(d?.rows||[]).map(present);
  const categories={machine:0,rules:0,pending:0,original:0};
  for(const job of records){const state=job.titleStatus as keyof typeof categories;if(state in categories)categories[state]++;}
  return Response.json({total:records.length,boards:d?.boards||0,titleTranslations:categories,
   cachePersistent:!!translationDb,translationEngine:privateTranslatorUrl()?"libretranslate-private":"unconfigured",
   completeOriginalJdTranslationsAvailable:false,
    readerJobCompletionsInMemory:[...readerJobProgress.values()].filter(v=>v.parts.size===v.total).length,
    readerJobsPartiallyTranslatedInMemory:[...readerJobProgress.values()].filter(v=>v.parts.size<v.total).length,
    readerEphemeralCache:true,readerCacheHours:2,
    readerLimitCharacters:JD_READER_MAX_CHARS,
    backgroundFullJdSync:durableJobStore?durableJobStore.coverage():{
      kind:"HHBA_OVERSEAS_JD_SYNC_V1",enabled:false,
      reason:"PRIVATE_PERSISTENT_VOLUME_NOT_CONNECTED",
      complete:0,total_current:0
    },
    backgroundFullJdDailyChunkLimit:JD_SYNC_DAILY_CHUNKS,
    searchLanguages:["zh","en"]},{headers});
 }
 if(u.pathname==="/api/jobs/page"){
  const data=await load();const rows=data?.rows||[];
  if(rows.length)void fillTitleTranslations(rows);
  const q=String(u.searchParams.get("q")||"").toLowerCase().trim().slice(0,100);
  const company=String(u.searchParams.get("company")||"").slice(0,120);
  const remoteOnly=u.searchParams.get("remote")==="true";
  const country=u.searchParams.get("country")||"";
  const recruitmentType=u.searchParams.get("recruitment_type")||"";
  if(!["","cn","global"].includes(country)||!["","SOCIAL","CAMPUS","INTERNSHIP"].includes(recruitmentType))return Response.json({error:"invalid_filter"},{status:400,headers});
  const limit=Math.max(1,Math.min(60,Number.parseInt(u.searchParams.get("limit")||"30",10)||30));
  const offset=Math.max(0,Math.min(50000,Number.parseInt(u.searchParams.get("offset")||"0",10)||0));
  const related=Object.entries(searchAliases).filter(([cn])=>q.includes(cn)).flatMap(([,words])=>words);
  const filtered=rows.filter(j=>{
   if(company&&j.company!==company)return false;
   if(remoteOnly&&j.remote!==true)return false;
   if(country==="cn"&&!j.domestic||country==="global"&&j.domestic)return false;
   if(recruitmentType&&j.recruitmentType!==recruitmentType)return false;
   if(!q)return true;
   const fields=[j.title,j.company,j.domestic?(companyZh[j.company]||""):companyZh[j.company]||"",j.location,translateLocation(j.location),present(j).titleZh];
   return fields.some(v=>String(v||"").toLowerCase().includes(q))||
     related.some(t=>j.title.toLowerCase().includes(t));
  });
  const names=[...new Set(rows.map(j=>j.company))].sort((a,b)=>a.localeCompare(b));
  const companies=offset===0?names.map(name=>({name,zh:companyZh[name]||name})):[];
  const machineCount=offset===0?rows.reduce((n,j)=>n+(fromCache("title",j.title)?.mode==="machine"?1:0),0):null;
  return Response.json({
    jobs:filtered.slice(offset,offset+limit).map(present),total:filtered.length,
    allJobs:rows.length,limit,offset,companies,machineCount,
    boards:data?.boards||0,domesticObserved:domesticObserved.length,domesticVerifiedJobDetails:meituanObserved.length+additionalDomesticJobs.length,domesticEmployers:additionalDomesticJobs.length?4:2,failures:data?.failures||0,updated:data?.updated||""
  },{headers});
 }
 if(u.pathname==="/api/jobs"){const data=await load();if(data?.rows)void fillTitleTranslations(data.rows);return Response.json({jobs:(data?.rows||[]).map(present),total:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||"",persistentCache:!!translationDb,translationEngine:privateTranslatorUrl()?"libretranslate-private":"unconfigured"},{headers});}

 if(u.pathname.startsWith("/jobs/")||u.pathname.startsWith("/api/jobs/")){
  const nativeId=decodeURIComponent(u.pathname.split("/").pop()||"");
  if(nativeId.length>180||!/^[A-Za-z0-9_-]+$/.test(nativeId))
   return new Response("Not found",{status:404,headers});
  const market=await load();
  // Existing live catalog is preferred; white-only ATS boards use validated
  // public snapshot identity before any outbound ATS request is made.
  const job=market?.rows.find(x=>x.id===nativeId)||await fromWhiteIndex(nativeId);
  if(!job)return new Response("该岗位不在已核验的官方公开职位列表中",{status:404,headers});
  if(job.domestic){
   if(u.pathname.startsWith("/api/"))return Response.json({job:present(job),description:null,richHtml:null,applyUrl:null,recordKind:job.company==="Xiaomi"?"OFFICIAL_LIST_OBSERVED":"OFFICIAL_JOB_PAGE_OBSERVED",currentApplicationVerified:false,detailVerified:job.company!=="Xiaomi",officialListUrl:job.company==="Xiaomi"?job.url:null,officialJobUrl:job.company==="Xiaomi"?null:job.url,observedAt:job.observedAt},{headers});
   return new Response(domesticDetailHtml(job),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
  }
  const prepared=durableJobStore?.readyDocument(job.id,job.url);
  if(prepared && u.pathname.startsWith("/api/")){
   const offline:Detail={job,description:prepared.originalText,richHtml:"",applyUrl:job.url,
      status:"LIVE_CONTENT",checkedAt:prepared.checkedAt};
   return Response.json(offline,{headers});
  }
  const result=await officialDetail(job);
  if(!result)return new Response("官方职位详情暂不可用，请从招聘列表进入企业官网",{status:503,headers});
  if(durableJobStore&&result.status==="LIVE_CONTENT"&&result.description){
    // Opportunistically save the checked English original (never trigger MT).
    // A later GET can use it instantly, while the background worker fills zh.
    try{
     const sourceHash=createHash("sha256").update(result.description).digest("hex");
     const segments=jdChunks(result.description);
     if(segments.length>0&&segments.length<=150)
      durableJobStore.sourceVersion(job.id,sourceHash,segments.length,result.description);
    }catch(e){console.warn("HHBA_JD_SOURCE_CACHE_SKIPPED",e instanceof Error?e.message:"unknown");}
  }
  if(u.pathname.startsWith("/api/"))return Response.json(result,{headers});
  const zhJd=await translatedDetail(result);
  return new Response(detailHtml(result,zhJd),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
 }

 if(u.pathname!=="/")return new Response("Not found",{status:404,headers});
 const data=await load();return new Response(page({rows:data?.rows||[],total:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||""}),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
}});


void (async()=>{try{
 const p=String(Bun.env.PORT||3000),out:any={};
 for(const [name,expected] of [["Tencent",19],["Baidu",8],["Meituan",7],["Xiaomi",1010]] as const){
  const r=await fetch("http://127.0.0.1:"+p+"/api/jobs/page?company="+name+"&country=cn&limit=1",{signal:AbortSignal.timeout(15000)});
  const j=r.ok?await r.json():{};
  out[name]={total:j.total??null,ok:r.ok&&j.total===expected&&j.jobs?.[0]?.company===name};
 }
 console.log("HHBA_DOMESTIC_SEARCH_SELFTEST",JSON.stringify(out));
}catch(e){console.error("HHBA_DOMESTIC_SEARCH_SELFTEST_ERROR",e instanceof Error?e.message:"unknown");}})();
void (async()=>{try{
 const port=String(Bun.env.PORT||3000),checks=[];
 for(const [name,query,expected] of [["OpenAI","q=OpenAI","OpenAI"],["Tencent","q=%E8%85%BE%E8%AE%AF&country=cn","Tencent"],["Xiaomi","q=%E5%B0%8F%E7%B1%B3&country=cn","Xiaomi"],["Cursor","company=Cursor","Cursor"],["Mercor","company=Mercor","Mercor"]] as const){
   const r=await fetch("http://127.0.0.1:"+port+"/api/jobs/page?"+query+"&limit=1",{signal:AbortSignal.timeout(20000)}),data=r.ok?await r.json():{};
   checks.push({name,http:r.status,total:data.total||0,pass:r.ok&&data.total>0&&data.jobs?.[0]?.company===expected});
 }
 console.log("HHBA_SEARCH_KEYWORD_E2E",JSON.stringify({checks,pass:checks.every(x=>x.pass)}));
}catch(e){console.error("HHBA_SEARCH_KEYWORD_E2E_ERROR",e instanceof Error?e.message:"unknown")}})();
void load().then(data=>console.log("HHBA_SOURCE_SYNC",JSON.stringify({jobs:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,domesticObserved:domesticObserved.length})))
.catch(e=>console.error("HHBA_SOURCE_STARTUP_ERROR",e instanceof Error?e.name:"unknown"));

void (async()=>{try{
 const response=await fetch("http://127.0.0.1:"+String(Bun.env.PORT||3000)+"/",{signal:AbortSignal.timeout(20000)});
 const raw=await response.text(),html=raw.split("<script>")[0];
 let jsValid=true;try{new Function(raw.split("<script>")[1].split("</script>")[0])}catch(e){jsValid=false;console.log("HHBA_HOME_SCRIPT_PARSE",String(e))}
 const cards=(html.match(/<article class="job">/g)||[]).length;
 const clientSearchIndex=raw.includes('const companyZh=')&&raw.includes('const domesticEmployers=new Set(');
 const ok=response.status===200&&cards>=20&&html.includes('id="jobs"')&&!html.includes('id="employer-directory"');
 console.log("HHBA_HOME_LIST_RESTORED",JSON.stringify({http:response.status,serverRenderedJobCards:cards,directoryGridRemoved:true,scriptSyntaxValid:jsValid,clientSearchIndex,pass:ok&&jsValid&&clientSearchIndex}));
}catch(e){console.error("HHBA_HOME_LIST_RESTORED_ERROR",e instanceof Error?e.message:"unknown");}})();

/** Staging-only smoke: confirm semantic English JD and actual Chinese
 * translation endpoint, not merely that an upstream translator returned text.
 * Log metrics/error codes only; never print copyrighted JD content.
 */
void (async()=>{if(Bun.env.RAILWAY_SERVICE_NAME!=="hhba-web")return;
 try{
  const job=(await load())?.rows.find(j=>j.id==="greenhouse-airtable-8403107002");
  const detail=job?await officialDetail(job):null;
  const english=detail?.description||"",originalHtml=detail?.richHtml||"";
  const headingCount=(originalHtml.match(/<h3>/g)||[]).length;
  const bulletCount=(originalHtml.match(/<li>/g)||[]).length;
  const paragraphCount=(originalHtml.match(/<p>/g)||[]).length;
  const rawMarkup=hasLeakedJdTags(english)||hasEscapedJdTags(originalHtml);
  const chunks=jdChunks(english);
  const detailRoute=await fetch("http://127.0.0.1:"+String(Bun.env.PORT||3000)+
    "/jobs/greenhouse-airtable-8403107002");
  const renderedPage=detailRoute.ok?await detailRoute.text():"";
  const englishPanel=renderedPage.split('<div class="lang-panel" id="jd-en" hidden>')[1]?.split("</div></section>")[0]||"";
  const englishRenderedCorrectly=detailRoute.ok&&
   (englishPanel.match(/<h3>/g)||[]).length===headingCount&&
   (englishPanel.match(/<li>/g)||[]).length===bulletCount&&
   !/&lt;\\?\/?(?:p|li|h[1-6]|ul)\b/i.test(englishPanel)&&
   renderedPage.includes('id="detail-zh"')&&renderedPage.includes('id="detail-en"');
  const hasOfficialReferences=englishPanel.includes("https://airtable.com/careers/life-at-airtable");
  const host="hhba-web-production-024c.up.railway.app";
  const endpoint="https://"+host+"/api/jobs/greenhouse-airtable-8403107002/translate-part";
  const req=new Request(endpoint,{method:"POST",headers:{
   "host":host,"origin":"https://"+host,"content-type":"application/json"
  },body:JSON.stringify({part:0,sourceHash:createHash("sha256").update(english).digest("hex")})});
  const allowed=humanReaderAllowed(req,new URL(endpoint));
  const response=allowed&&detail?await readJobForTranslation(req,new URL(endpoint),{}):null;
  const payload=response?await response.json() as any:{};
  const translated=response?.ok&&typeof payload.text==="string";
  const clean=!!translated&&!hasLeakedJdTags(payload.text);
  const pass=allowed&&detail?.status==="LIVE_CONTENT"&&headingCount>=3&&bulletCount>=8&&
   paragraphCount>=3&&!rawMarkup&&chunks.length>1&&clean&&englishRenderedCorrectly&&hasOfficialReferences;
  console.log("HHBA_STAGING_JD_E2E",JSON.stringify({
   officialJD:detail?.status||"missing",headings:headingCount,bullets:bulletCount,
   paragraphs:paragraphCount,jdCharacters:english.length,chunks:chunks.length,
   escapedMarkup:rawMarkup,englishPageStatus:detailRoute.status,
   englishRenderedCorrectly,hasOfficialReferences,translationStatus:response?.status??null,
   translationError:payload.error||null,cleanTranslation:clean,pass
  }));
  if(!pass)return;
  const responses=[{part:0,http:response?.status??0,error:payload.error||null}];
  let translatedParts=1;
  let translatedText=String(payload.text||"");
  for(let part=1;part<chunks.length&&part<80;part++){
   const request=new Request(endpoint,{method:"POST",headers:{
    "host":host,"origin":"https://"+host,"content-type":"application/json"
   },body:JSON.stringify({part,sourceHash:createHash("sha256").update(english).digest("hex")})});
   const result=await readJobForTranslation(request,new URL(endpoint),{});
   const value=await result.json() as any;
   responses.push({part,http:result.status,error:value.error||null});
   if(!result.ok||typeof value.text!=="string"||hasLeakedJdTags(value.text))break;
   translatedParts++;
   translatedText+="\n\n"+value.text;
  }
  const headingsTranslated=(translatedText.match(/^# /gm)||[]).length;
  const bulletsTranslated=(translatedText.match(/^- /gm)||[]).length;
  const fullPass=translatedParts===chunks.length&&headingsTranslated===headingCount&&
   bulletsTranslated===bulletCount&&!hasLeakedJdTags(translatedText);
  console.log("HHBA_STAGING_JD_FULL_E2E",JSON.stringify({
   chunks:chunks.length,translatedParts,headingsTranslated,bulletsTranslated,
   originalHeadings:headingCount,originalBullets:bulletCount,
   translationCharacters:translatedText.length,responses,pass:fullPass
  }));
 }catch(e){console.log("HHBA_STAGING_JD_E2E_ERROR",e instanceof Error?e.message:"unknown");}
})();

void (async()=>{if(Bun.env.RAILWAY_SERVICE_NAME!=="hhba-web")return;
 try{
  const host="hhba-web-production-024c.up.railway.app";
  const origin="https://"+host;
  const endpoint=origin+"/api/jobs/greenhouse-airtable-8403107002/translate-part";
  const request=new Request(endpoint,{method:"POST",headers:{
   "host":host,"origin":origin,"content-type":"application/json"
  },body:JSON.stringify({part:0,sourceHash:"0".repeat(64)})});
  const permitted=humanReaderAllowed(request,new URL(endpoint));
  const job=(await load())?.rows.find(j=>j.id==="greenhouse-airtable-8403107002");
  const detail=job?await officialDetail(job):null;
  const chunk=detail?.description?jdChunks(detail.description)[0]:null;
  const raw=chunk?await machineTranslations("jd",[chunk]):null;
  const translated=raw?.[0]?await ensureChineseProse(raw[0]):null;
  const corrected=translated&&chunk?restoreGroupedNumbers(chunk,translated):null;
  const sourceMarkup=!!chunk&&hasLeakedJdTags(chunk);
  const translationMarkup=!!corrected&&hasLeakedJdTags(corrected);
  const numeralsPreserved=!!corrected&&!!chunk&&numbersRetained(chunk,corrected);
  const missingNumbers=chunk&&corrected?numberTokens(chunk).filter(x=>!numberTokens(corrected).includes(x)).slice(0,12):[];
  const paragraphBreaks=detail?.description?.includes("\n")||false;
  const pass=permitted&&detail?.status==="LIVE_CONTENT"&&!sourceMarkup&&!translationMarkup&&numeralsPreserved&&!!corrected;
  console.log("HHBA_STAGING_TRANSLATION_SMOKE",JSON.stringify({
   readerOriginAccepted:permitted,officialJD:detail?.status||"not_found",
   sourceChars:chunk?.length||0,backendTranslated:!!raw?.[0],
   sourceMarkup,translationMarkup,paragraphBreaks,numeralsPreserved,missingNumbers,
   verifiedChinese:!!corrected,pass
  }));
 }catch(ex){console.log("HHBA_STAGING_TRANSLATION_SMOKE_ERROR",ex instanceof Error?ex.message:"unknown")}
})();

void (async()=>{if(Bun.env.RAILWAY_SERVICE_NAME!=="hhba-web")return;
 const sample="&amp;lt;p&amp;gt;Welcome to the role.&amp;lt;/p&amp;gt;&amp;lt;ul&amp;gt;&amp;lt;li&amp;gt;Salary $182,800 to $238,100.&amp;lt;/li&amp;gt;&amp;lt;/ul&amp;gt;";
 const normalized=normalizeOfficialMarkup(sample);
 const rendered=convert(normalized,{wordwrap:false});
 const numberSample=restoreGroupedNumbers("$182,800 to $238,100","182 800美元至238 100美元");
 const unitNumbersPass=numbersRetained("More than 500,000 users","50多万用户")&&
  numbersRetained("Salary $182,800","薪资18.28万美元")&&
  numbersRetained("50-3,000 FTEs","50至3000名全职员工")&&
  numbersRetained("80% of Fortune 100","财富100强企业中的80％")&&
  !numbersRetained("500,000 users","40万用户")&&
  !numbersRetained("80%","70%")&&
  !numbersRetained("80%","80人");
 const pass=normalized.includes("<p>")&&normalized.includes("<li>")&&
  !hasLeakedJdTags(rendered)&&rendered.includes("Salary")&&
  unitNumbersPass&&numberSample==="182,800美元至238,100美元";
 console.log("HHBA_JD_HTML_NORMALIZER_TEST",JSON.stringify({
  structuralTagsRecovered:normalized.includes("<li>"),
  plainTextClean:!hasLeakedJdTags(rendered),
  numberGroupingRestored:numberSample==="182,800美元至238,100美元",unitNumbersPass,
  pass
 }));
})();
