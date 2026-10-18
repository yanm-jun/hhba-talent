import { convert } from "html-to-text@9";
import sanitizeHtml from "sanitize-html@2";

type Job={id:string;company:string;title:string;location:string;remote:boolean|null;url:string;platform:string;source:string;domestic?:boolean;recruitmentType?:string;observedAt?:string};

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
const employerBrandSites:Record<string,string>={"Xiaomi":"mi.com","Greenhouse":"greenhouse.com","Ashby":"ashbyhq.com","Spotify":"spotify.com","Canonical":"canonical.com","Airwallex":"airwallex.com","Palantir":"palantir.com","Figma":"figma.com","Anduril":"anduril.com","Discord":"discord.com","Reddit":"reddit.com","Airtable":"airtable.com","Flexport":"flexport.com","Robinhood":"robinhood.com","GitLab":"gitlab.com","Twilio":"twilio.com","Cloudflare":"cloudflare.com","Vercel":"vercel.com","Gusto":"gusto.com","Wise":"wise.com","Coursera":"coursera.org","OpenAI":"openai.com","Notion":"notion.so","Ramp":"ramp.com","Linear":"linear.app","Perplexity":"perplexity.ai","ElevenLabs":"elevenlabs.io","Vanta":"vanta.com","Harvey":"harvey.ai","Headway":"headway.co","Binance":"binance.com","Cognition":"cognition.ai","Replit":"replit.com","PostHog":"posthog.com","ClickUp":"clickup.com"};
function employerLogo(company:string):string{
 const domain=employerBrandSites[company];
 const initials=(company.trim().slice(0,2)||"?").toUpperCase();
 return '<span class="company-logo" aria-hidden="true"><span class="company-initials">'+esc(initials)+'</span>'+
 (domain?'<img src="https://'+esc(domain)+'/favicon.ico" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+'</span>';
}
function present(j:Job){
 if(j.domestic)return {...j,companyZh:"小米集团",titleZh:j.title,titleStatus:"original",locationZh:j.location,recordKind:"OFFICIAL_LIST_OBSERVED",currentApplicationVerified:false};
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

// 2026-10-16 official Xiaomi LIST snapshot, NOT proof of current openings or direct applications.
// Original JSONL hash 43f1937c0b2263a9e2334963f8f2becc074089f93ba26572ec2e11e8ea977d34; browser capture #38891842142.
function unpackXiaomi(packed:string,alphabet:string,codeCount:number):[string,string,string,string][]{
 const symbols=alphabet.split(""),codes:number[]=[];
 let bits=0,nbits=0;
 for(let i=0;i<packed.length&&codes.length<codeCount;i++){
  const v=packed.charCodeAt(i)-4096;if(v<0||v>32767)throw Error("Invalid compressed Xiaomi record");
  bits=(bits<<15)|v;nbits+=15;
  while(nbits>=14&&codes.length<codeCount){nbits-=14;codes.push((bits>>nbits)&16383);bits&=(1<<nbits)-1;}
 }
 if(codes.length!==codeCount)throw Error("Truncated Xiaomi data");
 let previous=symbols[codes[0]],segments=[previous];if(previous===undefined)throw Error("Missing Xiaomi dictionary entry");
 for(let i=1;i<codes.length;i++){
  const idx=codes[i];let current=symbols[idx];
  if(current===undefined){if(idx!==symbols.length)throw Error("Invalid Xiaomi compressed code");current=previous+previous[0];}
  segments.push(current);symbols.push(previous+current[0]);previous=current;
 }
 return JSON.parse(segments.join(""));
}
const xiaomiCompact:[string,string,string,string][]=unpackXiaomi("ကကဈဠဠჀႀ᐀ᨀ 䀀老瀄ဇဒဨၘჀჀᅀኀ᠊䈀Ⱘ耀 〇ဏဠ၄႐ᄰኁ㣀᪀☀ሀ氀⡑䂣ㅇ劑ᔦᩔ၀ᆀႀኂ岅⨀᠀Ⰰ桓肨瀌倚ံၰშᇠᏡ㭂枅䄊瘕ᰫ䀀瀆ငဌတနး㦠ᆁ䁀ሀᤀ᠀㰪⠄ဈ】ဣ၈႔ᄰተᔀᩀ─㬋☕倫⁑傳煉ዑᖦဨူၠႀጂ瀀ᰀᨕ砀䁔䀋ဖ倬ၒ႘ᅰደᘀ᱀⤀䌀砖〬恑肫其勎ᕪᯄ⚐Ⴠ溁㚀ጀ᠀ᰀ㐭㡓䂷煰勣ᗊეᆰ㻀榡䯃ᢅ⌌㘘搀桚₤瀅ኺᕄᨼᆸᎀᜠẃᖆ㌋氕怩ၢゼ煩個တ᫰၀㽰Ⴁ佂垀䬀蠁萃耇耋〔偀ႂᰬᄰᐠᝡ㣀ㆀ同⸙␳塤胎煬勓ဘၠ⛈㰐摠⅀㌀圀瘙尴聪Ⴭ冈ፗᗤ᱐Ⓒ䗀ႀᄀᰀᨀ␘怪⠉ဒ〥ጴᖒ႘ቘᓀ紁斂砆㠍樀瀩䀀肾ဂ倊ᕆᄴተᓰ粡溃䎆ᴋ⠙氯ၫჅဃ劔ဒ᳴၈ᆀ潠ጂ憆᐀瀂倅ᡬ䃞ᆚ厐ᚪ᳠Ⰰ㼰ს姂超洋䠚ᰀᡦ₩㇒倁ᘜᲐⵀ䎠ᆁ㜃冇⬀ᨀ㰩䁫储瀩ဢᗈᬬኘᕀᩡ擃掇⌍昗砷⡘⃮凌ဘᝠᅔᇘᕠ᫡獀ᾆ弍㈔䰅偲⃚㇔厺ᜎဤ⛈㯰拡媃弆ᔁ䈀怺⡯⃃ᇚ叟᛾Ụ⟐㾀瞠ᅀᒅ謌樞᠂​〖瀢叅ᝌỜ⹠䄰躁䀀ᔅ⌀∜瀀塔䀗ဧၝႼᮐ⻘䟠蜁甂縇伀☙䐳聥ニ瀀偟Ⴠᆄጐᘰ簡挃䰈∏䨟呁ね䃐兩ኘᛦ᷌◐㨰ᲀ⥀䌀眏䈡⠿ၹ䃉刕አᘶἀ⚨傰懡䠂脈℁怃㐆怄ယ瀝ၬᠦ‌⚘㧰殁㻃䞇⠋砕ᰆ砋僌㇚Ꮆᜤ⃨⢘哰緡䙃劅䬎瀙吆耍脖㈔ᑍဘ᭴⮈䠱ᵀዂ洀⠊嘞氶⢆烣爜ᐂᢸᴀ◈㽐ᄀዀለ伌䈕ᰮ⁴傲㈦ᑹᔢ↰⒘嚠挡㝄儀㌒᠟䱅恼჎凂匔ᜰἀ⥐啀懠Ⰰ䢅吁球尻『倝㈜卪ᡘᾐ⣈习猁㹃庅ἁ簃氇倏“ㆧၺჶ᪌㔐婀蔡㘀ᎀᔋ耘琀䁞債煑偻ჰᇰᏨ០ῢ㡄憈蠒娔水⁓䀆ሿᒻᗪḠ⑸堰ᝂကႉ䜓☥琭䁭胜牝劖ᔼ᪌ሠ᠁⏂㠄劅ἓ䐢籌灵䃏爌ဘ᜶᷈⛰㣰†や榉䔓戦㡎梗₤ㇲዝᔰᶴ㚠တហダ㦀䴂᠄␈䀐耢၄劫ᤌ⎰㗘ᆀ荁㺂稈贒栀ᐈ怑䄬㇬傌ᄚሸአᣰ∀㑄欉訒㘚瀩㡫愚剞ᒾᛤ᪌㠠惀敠㌀夁⌂㠄摒⢟℮ቊᏓᦠ⇨⧰႐抢宅ᐊᨓ∞Ⰵ⢒ー劓卝ᕀ⇼⥨㽡ᷡ㣀嬀紂㸧搉偕兎ቭ匒ᗨ᭔ူ㰐捁䖂縈倀ሚ䀷䂌腑㇯ᔹᙎ╨㙰㤠硂㻃澅㌂䈄砬ゎ惷က啧᪰▤㗸䫱⠁跄䞊ሂ䘄耸災煉ኢ劮ᫌ↠㋠㽀次㟂沆专〥谪⢦ᅕ刻哻᪲ဘ⹰埰杂㼃讇䀐⸠呇䂨脊ㆸ咨ᕶ᳸Ⓒ㧐潂╀㸆尕砕᱗䢲慞㇟ዺᢠ⌀◠㨰⎠ᴄ⬉䐔堫〭ᡞ僡煫ဋ᠒⇸㞀慰⋠㜄ដἎိ谩墏炯ሾጾᕆ⁸ገ櫀跀ᦅ涊朖瀭蠩碹悽煺勀 ᪌ᓰᐑ䉂藄谉椔娪そ桒シንጬᘸᨼ㲐桀褂硄ᆋ伓訙蠀悏惯券劏ᄞቼ㾐們䭂磂笈ᜐḖဵ碥患灐Ⴁჲ⚴䀐扡䭢⿄ᒉ怖⸣㰪⠔〢倻ၻᅆ➌㙈毑䑣ᓅᦆ耊䘬倨袪 ၒ傦ᬾ◔㾨梐滁㠃ㄆ⤀⠀㐩砀储灓储ᢔ⢰㹐楡⾡烂訅愋簠聞㠕‪切唵ᱺ◤◸嚠ტ䰆㜋簖㈄㑀袡熄ድᘡᲜ⟨⥐开獀ᅃ䀀嘂昅䁠袲冄㋑咻ᱨ✈㚐䜁侠၂猋⸋娭ၘ傔慟ጴ᏷᯴ᾐ㠐᫐ᆠ➀朌䰙㰭ᡌၫ惹ᅜ喜᠒➈ለ晀罂蘅萌〚ሔ豎硓ᅣ煑傯ᅆᰔ⻘ᬀ☣⊅漆㨋㘪聘胀愇ွ傗᳞႘ᖐሁᇠᦀ榀㤂砅搋⡔䀭偛傲ᴚ⩰ⓠ你歠ኄ脅ἂ耄␋堗》ずႅႦዬᅐ節⚠㇃㔁ᘀ昂尋僘倭ဖ嚭ၚႬᐸ窑散㭆枍䄚瘘汫㡓ㄼᇻ唗ᅸၸ㪠ᅁሣ㪆昍㸊⸅葧₹䃊冡Ꮎᖪ⦬⭸㨱䀃㤆䢍椎㰣㱕灞悤兑傾ᅸ⯐䅨纡㬠ዃ┌䔋ሞ屯䢬⃁灟僀៞⎨䌨㦠瞢娅ᤈ᜕谷塘ᣌ䆋匹圃ᗨᩬⷸ埐橣᷂垁儕㨚䀌 胙劺喯ḞⰌⰸ愠橂躂箉茀ህ᠌⢣烘ぢၱ᭴➜䡰畱爃⎂誅欗᠛吪⢬䀒㉻喼᫰⩬၀䐀殂㻅贅蠔㸯ᰪ壊憣Ꭴ危ᜲᬄⓈ㴡፣塀ႁ唀栅灡聱燀ዃ嚳ᖪ᫰㢐㵐櫢怂型挍⠹ず胠⅚㈌ᗄᗬ⋼㧰痠懣ↇᖎᴗ戴ၷのႽ兪ᐉ᣾‰ተᱠ⣠䈀抉ℝ琴簩悗ゴ煜厃ᵂᇠᔘᣐ⤢裄堈䜜搹葁偨჆㈅፳ᱪ᪌ᙐᒁ⣣的䬏Ⱍ踹倭桒⃥凝᝝ᚘⵌႠ危䃁與攋蘞䰝㱓裛ユ᎙Ⴥᅰጬ䣀裑竣樂縍氓〱怷㣨熢厝坾ὲ⫠⒠㧑㿁䙅ᮎ㌀㠆䀊ᣮᄉ獙埑ᜬ᩸Ⱘ䜑㋠⽀₀㸌Ḧⱽ梮燱ᅬዸᣠᴈ㧸洐懠䋀⺀ሃ⨃簌能⇭倩垸ᬒᩬ佨䥡詃宄焏┞㸃瀌裵ᇙᏛ埫ᮄ⓼⧨蝰满洂垍贐㈆倍ᣚ冹兑僒ᆦፐ䖘揰獁䴃䢎嬏縕ᱽ䡬⇾》ᝥẬ╸⛈旁弁䛃斉刃㨛ᑛ僱ㇺ㏾᜚᥸⇸ⷰ㰀滂㚀ႉ匞㰆㑅䃭臘玸嚳ᖤⴄ㍸㴠胡簀疁⌛☶䑬蠖䆴㍩囥ᶬᨼ䖀笢ᕂ⯃劐䨋䨣䱼恑耵偫嚤€⮜ဉᖑ憡徂權ဝሞ履⁘僓吳ኣᆰ፤卐偱ᵢⰄ澅刊⸄專㠐耭〖傳₠ሔ䙰紁橄ᗈ㮀ᄃ䐆簍瀛怷偯塪ᖀ〰⛨䛱➀ሂ憁瀃刁䁬⃘倮㍣ᛈᶔ⬰吩ᔢ᪄㉈䎑ᰢⱄ偔㤍∊冹哓ᕾ⺼Ⓢ慱ㆀ⢀脈℁蹀梇⡑耸灲ᚍᵰ₰◘㵱㯣岆愍㐃娇⠅“舩獫塚ᰆ㊼㞀埀縣ᔄḁ砡嘳ᑉ蠝∳ᅇ墩℞㉄児奠柢痂碅儒蘕ᰊ脌倗呭倁ᇔᎬᝠỐⷃ㍃洅┎ᨕ蠩袶炣獹吐ᗊ㋬ဈỰ⸀䱈褎ᔜ㠱尲磍凬瑵圙ᮖ⣐⨀埱⩃᥇㺁會瑇砂䀞䆵㐳壭⇞㏄圀䆠緢㫂溅權嘳䢏栄爅㑵堚‸㑰え䪰矃搂妌戢籀悋愢舆㐍売ᔤ⅄⮀䐀漃杅ሀ㤃刂岉愓刨瑃ᡓℐ㏴ហὑ㢤䝈文堃簇䀏䠟ቍ燁印⅞ᯨ☁⌂⛤伉⨅ἃ與䁔㠕倅は啅∲㏀㨨ᾠ⽤䲂涀ᨎ㰖္恢舦ᅇ嚢⇐ᏰᓁẲẤ椈蜒瘏⁉ゖ䤭∸ᅭ啠ᕀὄ叠တ⦠ὅጁ䐂码㐃股㈡ᒢ墦⇺⮤㨨ῐ⿀俈羑弔搱⑀塟ს㎼倁ᆾ᐀䜡◀ဤ㽉䲒⨕ᩋ萼儭ቚ剞ዙᬔ⣔Ⓒ㨰〠ㅁᄀ挡豄ႈ 䀸㑏倭ᄌሔᐩẰだ䒉䔊∋ሿ䰩㣄瀀もရሊጘ䕁Ⅲጁ㏀礂ᘃ䙋႖Ⅎ剥咱又⅚㙤㼀崑暡䜆䘆ᜏ䈕ᰎ倖聁瑹១ᖨ₼⮘蒱㗀ド⾒儢䙇㰐倝倷ႄ僓᪊㙌⹁⥒䋤誄ᐅ⸏嘔梗᠀‮ႅႵᅲሜᅐ₰ᔤ翉覒匡㉄ⲅ㤴剽哼᧺ថ㟰ኘ⃀⸀區紒漥衉梎ၚ㉊熖卂᯴⦰夙⨲䩀၉䰇堨䡐袢ည䉙㒍妙⁂♜◠㰑䢁㣃椀Ḏ硏Ⲟ奄䂮狍塠᧢╀፨犑啠᥀嘁䠀谁㠂怖䁃倩倂ሖ㈄ᐰᔰ⥠㳀檁ᘂᱍ蠈ㄱ舩㍩႑ᡮᐼᠰℂ⹁㺆氉㜐踯砪⣔剉偀ᄑᕆᑈ ℰ㊃㍇ኅ☎蹁ᑧ僢瀓生姨⓰╰怠澠搁彅ᮈ刌丗⠮偝エ甚᢬ᶰエ䆩㤰狣⏂沈Ⱖ硍梛儐∠瀖ᩛᅪ␠ᡐ悐⃤绉溓伧ቇ萑㠢牾琔Ꮘሮᑠᣈἀ㍂慀膁笄䘈联㤩⅑ゎ儞ᆴ፤ᣩⶒ䋥㴀舊唄三တ䤴艞瀩妪Ⴆ㖠撀ᬢ䔤蕅㊔倕ᨉᐂ䠤え畁ኞᘰ⮴◈耲⌤㛊㰔権䡒袦ᅂ䉉畩Ꮘ╔㬔昹㴲急㒂庅⼘簻㰯䁔䉨㒙ဦⓢ㧌掩㝲渁毈㸇㬍䡏䱫怅⁉၃儂␒⬄ᤨᡠ₄羉瀁䤁㘁⠅⠤熱做嬓ᄊየᐨ窠ᕅ㢅ᔓ瘫湆䰹偓慣獮卯Ẻဈᡰ≱枀᫈劀丂舁䐈䥊㋂疆媧☠ᒠᜀኒ猠㹀匔欛ကᲛ䣚⁊〩優⒦Ⴄᡑ㔁槠ㆆ瀂㬬乒ᒲᡥザ熮᜜ᬮ㠔娑㹢㣅ᔊ☂㰄㘁䢫天㉓咨ᥒ┤⁬Ⲩ橰箃⬈贅琂⠶ᱬ㣘芃呑ᨒ⚰㦌㎱㙒峥棇ἅ倣ᐺ砪⥢删႓債♘ᅌ榙䃡枅捊䰈⠊㐚聋档サ㉡ᚣ⇶ᒔᄱ⢰ㅅ㢀沍倢䩛䒊ᥪ艤㓒᧔⎬㟴廑㻂秃叄㦅⠍氱恆焤〇ᔷ堖◴ᨼ採㝢胢⠂謇ጊ㸩谯腁⁊㐿嫥⊈㦄櫉ᢢ嗀Ⓤᬓ褕ᩗ㰼兗ヲᕣ᫈ថ㔰廘ᔰ⭠ፀ蘗ᜊ㐬硊䡟㇗㑣ᣪቚ㓌慡㪢胣掃禅✒蘷粏堓儽㗖᫹ⓤ㺼柡䷲ᯣ儂清伊嘉䠒褌䁌႘᥵⇖㵬ᅱ仑灣冂怇琙㐕ⲇℴ刿璀季ᚺ⍀㫨囑㋥訋最ᄮ灗蒲ᣲ⃆免匩ᝠჴᖘᡀᔥ寀厂ᬄ⑜ᢰ煰勄ᖉᚻ␒ዐᡙ䐲䛤ㅋ㌖ⴀ蹅Ⴀ腰犤劥堺ↆᩰ怩䊂畀㹋☁䐬汙傳ↄ⋍〩儨ᵶ䃰烡㔢綄㟋䜍夭⠔䲤ᅏᅒ煏ᑢ៌㲜抩㗂獆᪉沑ጮ詗ⲏ祸⋲ဩ姃᪊㽀溑匠櫡䳂洅⌫之堉䤝ᆪᑾ尅⢞Ḕ⣀䅀满沅䂒刚塠䠄怣䌓甒ᝋ⋘⫠─㨰✃㭀劍娱⁡䱬女䉑瓒ᱟ①㡼揀㦠拡求嬋訤刔䰈堦≴ᓒᯆႦ㟸峁䩀捃㸂嬇琏㘪耪⠊怞ጕᤕ✺㮤ኙ偒袥㫋怓輪㐡䢉䡞脦㇘ᣈ⇐䃄椈㯁ᩥツ眎䈑㰢灎倀⌓噚呿ᔸᯜ㇠瓠摣訌猙堲谖籟灷ギㅮ嫶⍄ᮔ灱㫲映嚌墓嘦䨸⁈ᡑ耗゙᪀❆⳴䏀䆐疡孌瘓⼂耄尒㦝ኞᆊᘳᘲ⾈涸㣲蹤洉䬘Ḅ瘇氓㆞悧疁ኼᲲ⦰တ窠礆᠋⨖ἱᑧ吒㦉匱疐ᮤ᠊᫼叀㵒䏥橂芑䤯戕᳇榠䉏ᗰᠬᕆᰜᦨ⍣⺅㒆㚎ℏ帕為惍耣႓ᬚၚ㳨爹᧣℥氈戔⌭瘫撷㦞悯猒口ᵪ㸸灩亣ᇥ謍┚借㨙Ⱙ冤怌偸儷ჴ䋴洠獐溅墋ᄗ琀ቈ墯冁猄ᔼᏤ᥸∰Ⳁ佱ᎅ瑀ᄘ㰚衜氋倡熴偂尟⤐䄨硡刣㩦䪈ᚊ嬋䨙䓏怀∭㒭ဦ≼ᎄᄰ⎂薦憍㼕∎谔怫裷獉ᘦ塣ᄰᓤ᧑懠懦䝊椔蠵耪䐱恵䋼㏹Ⴙၒჼᇰᭂ撄悍墚圩籣ᢽ᢭ዿㅛᙩ᜶ὄ盁ᘠ⫥踌ᜂ⬀縅墼膲䌷犼ᶩᛢ⋰ㅩ嚑葦猀箌焣晥值倦䀶炝儼⭐ⱄ⥘橡侁䀄Ḇ蘒〞⢀您怴ရ啅ប䛤䢉ዀ輂獃『簕启⁐碲䄨勂媭ῶⷈ䠘䛑祡䷈梒簕⸔䱞⢆灏゛勈ᲒṀ㰸摐㟀忍甗䘐ᰜ桕禥炣狜ᕥ⮨ἠ翙涀窆蚄皆舙Ⱌ⑍℟က゠ᅁ᚜䊤纙溃儦躍踜ᬎ春豾磷㍼ᐟ兂Ⱚᇠ肸䷣匧ᇎᶋ䀷摇怫烣償牿匝ᢆᮔᗀᮀ眄劂夜㰔蘠〭₠ⅴ刏吤ᬆ⧼ⲙ玠换ቃㄚ✎ḕᰔ⠨厉ᜓᷧ⯶䟴䉰獁萂㕅亅㌃☀᠌㧀掆᜔幒ᴄᱤ㗠䜱Ⅳ㇄⬖㰛≠糟䣌兒᜝ᶘↀ╰ⓙ⧳Ⳇ蒄貛攷㸞ポ姅䃏㙓ᗂᘰ㖰⢡爐㢠憈⪙嘹㉰㳊䂟胡理ᑪᕆ䨈䱐⑰㤁納笜ᤷ訞岂袍㇚剞ᙬနჴ皀仳儇⸎ᔜ訫䰔瑣ℍ焆ᜲ嗖᭰ᅐშ⒓嵇Ḉ㾝㐊㨮ᡦ健愇႞ႚኔၐ苡牳寇㇇㲕渳♫⃨砨瀋炥庄៞䩌蔉熣抡䚃⚜嘓爠胨 怸を嚉Ἐ䩔䝸侂諦ⵃ栝ሂ谀惬偔䎲凤庢ᩌ䞨剘墁詃辅ᮝህ⠊䐇塶厞㝳幻ᷞṰ䉱峁箧䟎肁㔌☄䁐ウ慍瀀廳Ⳙ䯔⟙憐拆䔅ᄙ脀訁䃮⁑莹គᐔⷐ᱔⓰輁ᷡ氍⊀㼺ᐆⰁᇞ㎹垂効ᬔᯔ⚠㧠犤谋㊖圢ᐵ者⧎厚瞉幻⹆⋸壩焐㧀恈㈇缼㑲⃳ᢗ煰勡ᜇ⌾䨈ᤰ⌀Ⱗ叀႞ℼ偹僲⃆慊ᎍ叓⺂ᔘ䬑粓廧䥎媗耒␽၉姘偓炨὆⹴Ი袠㧰潢㧉ⴞ怗噶泮⧪受熫弔ᔦᱤ㏱滐蟁瞃᎞㸽晭㣳ᣩ炦ሄᕋⱾ❐⩨䞣恇橎娝ᜒ訛䱀䅤您瀁Ⴕ✪㱘㠹㨳揇ᗏ䬜䤹蘗烫䁨㉃ᝆ኏ⴄᰤჸᣀ㒠㸀覞ᄍ㑺㓳桗≬㈄喗ῄ䕤䭱蟱羦覎䬟ጺ嘸屍被厠៌唃ᄆ䝄舑葳絇礏䀜謎䐥簩ᡳℼኁṁ᚜◄荑蒃抧㊅䜎ጎ䀖恴〈⇦埀弐ၮ估⮑蘡ⓢ䲏␟Ḕ␇䐂蠪⏤ᅇ徒ⵢṬ峰䏐縄旇㺀ⴅ㐼㡷秒悽瑺媗ᘮヸᣈ┰㪀㦇㐟䈍瀝㱿臲艋煇嫖ኪ႘崈矃䇀庆㔝砸ယ籁慶您码倦⇐倡ၑ瞰抡孂稚✌谵ᐂ⧪㏨睊劺⹾㲌⣐㴓⧢䈇皟謻砼塙塟ㄞ燁妟⫸⁄畉≐⨨ኃ䚈縑踣聭悠㏷啒႒␒㛼ᅘ粢䲧ⵅ訛礊㸛偙灒叭剆嗱ᄒ䀈瘰菃牥袂礈紌䉋䒆覾⍸兕倦ቴᕄᔠ漱㣈⇆㜈踥灎⠭⦙炣炞偻ᆒ亴ᄰ╠㫧᥅粝眲㘥㴁壣䄔㓸ᐶᤸ⩐蕺ᘰ箢ᗃ历␓瀿吀᠒䁀㞖徻イ䤐璘埲ⲡ㜂笋Ⰺ嘊瀕塡␑ភ悌ឦ䠴莁瘑⋇泀⤡✟葵萅⨑䏘ሽ墳⪬〰〸蔔᭣紐䠠舝㩱㴊䣷儔ሯ啯ᙠრ᫐ᧁ⬇㰎䶉㠌氼塑㥀揫Ꮝ₯げ䦱ᔸ炁伤䃅焇礀灴褅程萱砩彏ᛖ匨⮀昑め准Ⴁ⡂屺䱻楏㈼疁唃ᄌჼ糠ዐ៧宍芠嘠抅塓梱䅗玳幊ᔞ႐᠘摄ⶇ㡍搕渐䁦㣈ᤪ儇ኂ⃐ᨈ䖜⩉䃀᪈ὀ▜穃暃ᤏ悚ᅗ厈ᜠ⵨᪌䯘胄⨨⠐䦡塄Ⱋ墻㦂傧玮兛ኸ⍡ᡚᯓ栢眊∇ጒ怕ᰀ耔䐴ᡣ℘ㆨ⇴⒊᪰財䱌粁ᤅ䨂琎㨚䐦㊟᾵⇨ᩕဈထ⣠极㾆幁䲈洋ᨎ凋玂卜ᗶ㎔峸☀㰠㈁䄆市㸆䁮ሏ瑃㕃ᾖἦ㩜䊐彔㣈䒑➢䰝⨜琻惭⊁㟐Ἅ㉚凅᧚ᷡ糡㖈舖ሌ䀕ᰇ託䀉㠰愤ₖ㖰㏨旂悡悄圞㹅萻㡋衵䍡眞姰ㆠ唝᭱蛁䆢䐍攚⤿ቾ外ၯ㑢碱慯㌞Ṙ㊀䊃㏠Ẅ玆ᤍⰀ᠖⠬䑖㛜憎ᙘ䣀碹Ⲡ㲀旁䊏䍀簭᱗憳⏱㡱弸Ⲟ吴䈉恠漧ፉ徙䬃㺍債⡓菜ᔂ᝝ᄮᕈᬪ᷄㽆㒅榇蜦氧傃ᡬ‰㙢叚ὒ儜丨毳䞃䷃栂瘅庅礋爺燣琀ᢱᰪ⑜ᇐ័ἃ虈⎣䠋瘔衮焜䊁ㅳ慶㎾垬⵨茓罁訂垑堿嚆蔘礄₯燩姇᠌㠔㜢Ⱡ㲢艎ㆡ渍琠ⲭ灮ↁ瓏嗇Ẩ劉ἀ綱ῃッ澎洓ṻミ儁㑮ᝀᘓᨀᵴ䫨犁巨耏媌┐樔瀻ဪ冑瀯⇀え㎐䨀蚡⡀⼃䂉匠ᱶべ樼Ⴆዶ᎚⣨ᵼ⑸匤⨇ᖒᶛ硄⩡棦℃犀厮幌㐴⾩∰楴ዡ䗂纛ᜊ嘋〇梼䒎ᣪ扏᝼⓼孠䗐櫡簒㬞䡈芒䱫䡮ᑌ務嚇㒚塉∰囱䯢㿆∋㤊⸖ 耔炪㊪吷⿊乑⍰㥄劥⫄⢀甅戅᳠㆘爍磈ᕊ⾠䁔⛈貐摠檁䖠⹈₏萱ば舥ㅎ፮᳘仨蟰⛀㶧碇縣㘘≁瓊ゝ脰㤠⊁ᅆ䪴ⶢ㡣圢㫒ᖆ簒搘汖ᩓ₲うፅჶᖹ⓪㓤握莈娅␔㒇峡 ⎵瀓≃㕲厸⟑ᰐ歡嗍ᮅ㌼籲䡂䧅န睃⋆ᤔ㶜䐡䞰懩㲏庂缄縛椫剕シ㉕哿ゖ⋱ᇉ⧰擩䂒爥漾㢗ᤢ壉煻ㅑ廯ჲ审ᖂ㺤氦蝂箋詁㹌质↾㏮祺扟៬⣔㍐灲傣慎∆豆⢔Ⱟ做䒈ㆹᝁᨮ媠⯒㱄嶉㺌戥褣稝䰪⠮ၔ᥂Ꮪ㘦坘䪀丱䔃坄Ḃ脅璘哹砮䀯祛唶〾屔⿀薡毉㓂憂萅኏紧悕䎇㒜Ꮊᗬ⯅┪㠤廧㻒劦〓〦塓衒ザᅑ抂㒄勁ᯐ䗀蟣䭋䲦圊嘋搄ᩣ撰禦捄㚠ⷙ⌹Ꮰឨ䥐莀传屦⡿扚㑒喁∻᧺⊠ⶀឰ⪢圀䶂啋䲚₻䁚熧㠌⌴ዬ區᮸᠒ᣉ㺒漝䐋瘰⴨቟掿劆⊸㋴㩍ᒀ揲㪧葂垦潃封㔎偩灞ዀ↰㜒㯄◠謁ᎀ洓䲠㜏䐁ဉ扥琻啉劑㙸ᯨⰸ净❠㸏Ⰱᰃ​琽䩰葵匚愞Ừ㢐モ㘰簡棑殥⼽⡥瀭᡿᎒ᅑ兺ᦈᇴ赢㳠踈䭑㔌䔔㡈䣍䧶蓛㊎ᖸ㝢弥ᣈ䦀笅⃌䨈Ⰵ蘅搋怖擤秊抑㔎∰珸㥐軧ᰍ㈒㐯䚘㔪棢䈏㒶ኑ⟾ềⷀᑡ⺩疊ⲇ眊蘝賛蠀⓪姖ᔄᨌ┈ᐺ䬔ㆡ㙃尅✖尖硑䩸䃓ዲ挟㠈応㜊Ꭲ傥虄ᢂ谀氈ᴃ㨲葿㨂娧ᥴᱥ᜚䰴䗩ℐ憦癏㪐䡙䧉ዔ㞔ႃᄌᒐ哹痄眂咂稅蔮⠝袜䩸〞ᦽ兽႐弝⢢䨱嚃臊辥䴣ᩜ䱁ᠧၟ傿搙㊒彔◩菱嚢䓆您唋婀放橜ᅄ凲Ꮐ㗈᭴⢺厄⮊ᥐ稓Ⰿပ汏⁶၎〨ᐏ⭢䔘礂䯁㟣ᴇ碎⼲㸀ᒆ⦏┚嘾ᶹῚ☰磊⻑ῂ嗉ᐂ栂瀌ᄀ恫凨ኰኔ㡬㯔⑹㕂孤翌㴙ᔴ艌僈煅危ဩ岝⭮㵸㨩汣䤂慁ᆁ䘆ራ〱戡烖砲ᖥ⠀倈ᄺ၀䁀漓帟缙⒥ၜ㉼烴祉嗡⟊倠梈ᔰ梀ᤀ䴂䅒橖褄夼㌤秷圖㥪㱈ᯈᐑ㪪㻓肋簫䰰぀妔懐ኰ怑ᅚწ䟨ᗐ䁨賅䰩《倗恅᨟劑婚ᶏ㥬㑉㘺寂咃謃ᰆ㨶☀ᔁᡪᅠᐸ捤⯎侕㛈泔貣‎䈩㙀᠚兆䇛ᔶ዆岥ᘨ戌⼸茡䀊䃀㦍贖Ⴆㄟ灖熌勡岣ᦦᯕቨတ菠㧀㶋ခ⺌ᡷ≒僦玁摛ᤐᾔ┘♠᭪䗅栙搒谨ဩℰ䅼᪈只ဨᘐᬨ噱㴊夓疋ḡ蚡浏䠄瑲㎹┤ᘦ䀤Ⲩ㴑嶈ᑆ␠⑓∢塂橊䎾ㆯᜲ〢劄䮐㾒☢秂紉戨᪁萅⨇苎癃ᛊ㨮■漈輁祡褆檅⠕劉Ⴖ怰恀烃ᅥ⸄䫀漉穣罁徑Ἢ煄剒㱎㈤ᕚᎀ帀㒸㻔㱙誂ⳁ愀㮁㜡ᙾ屝䉋ㅖᇋᐇ᝞擸ⰲ啱ᎉᣀ㼊攐㈠䱕㣇敡Ꮦ抾ῄ停䨘牲夀燁吪㈒㚬墠℄ㄟ埓⌾ဂ⢠䅒槀蹊瞄辙䠓〜磗抱䕣ㅲ冉ወ嚔㲪桀箢朂墉伊袏撟჌⇦倨ၙ᳂徬㼀煄⁣羐崜℃琅䄎惹胄㫢ፂ㘘⛌⚡螤⧃⡕Ⰺ䥗⸬䒚肗膌ᓏ唄ტᘩ㥪⾴⒡幋䲌礊䘣谾䤉凗㩩ጉეᘬ᱉翣瀂嶒䲟乗婧䐱䡲艠㆟ᙃᕆᴔ覰屳玠⪀熂帠粫擎窪ᔕ磓唗⹬➔䞪栵㼢婌ᔈ漊㰧ᰈၔ敩燜ῂ㗈➁㶸乥⒠ၕ ᰆ⪰琯ዃ䄚呩恥ᷲ埡䄈ᖴ啫ᥕ眆缶虎⣧磨ᅄ奸Ự⵸揁㾱纣衤匎㦔䨎踠腈憊爠炘ᦾ♺⬄ᘨᲰ᩠㌀ᄂ㘂ᙸᢋ碧↠嫛峋Ⳇᱜ㗐㨱䣦㫈躕昫䂲怿偗䔬壿婹⌾捈የ៓裤⅒弋╊貳Ჵ↻蓹㧽倱ጜᘼᜐ䘒ᄉ潖䜛᜙䘖愺䨋ᐶぁ挦㛞ᙀᲉ㘴瓄狀沁ᔘ誨磿㡚Ⓜ煎ἤᨄ⏕ᒺ湁℈Ṍ嬅ℱ㊉⡦灳腃ᤃ攉᝚䧸塩唑ᷢᛅᄨ砥簌奄懇Ⴎ圿ᢳᰪ榉⼱㸀ᖂ䘔㾅聚湃粙礭劎᥆ᱫ↎᎙㥪₥䦡幖洭䵁塟败⃍剜盘႘ᕆ櫠⢊籴漊⮈➆罍梢堂䂁斱ᬪ‹ἆㅴ㙱㚑癆⭉∔耶ᡪㅦ與⊤穦寔≘欱䛈ᴰ⨠┈沀搠㨂怙⪉㖥筑咾㏾⫔䈒煒貣㨖昆踂ᘗ債⁼㏭ㆋⅾ⁠ᨼᦀ輱煡䤁㎃␶〥㠀〲旁ᅸ⑏⟾᫼䖸抰滢桁嬁茺䪜襱偢⍕㙑掙ᨤ䋠癢疰⎀ፀ䆒蕜㒀㑥䋠旉嘊嗎⡦⍴㏨茠䋠攒䪉坜琁⥱㫢菹ថ✵ᙲ䁐⛘㵓≣㵉Ⱗ⬅簉砘嫨ᗄ管⋊㺈愭䨸澀拦䭊ሆ㨗Ⱌ株⡯儃〜冘၊泉䤪蒁祡煎綎␐䈹唷勪␴ᮡ惇㺲῝䭒㗱⟢ᘕ劍⸊嚦夫䃾蒪ㇸ杵‾恴☊劄ᤊ磁岃⩜㐁⠇候 Ⴭ农ᤸ⌝䬠㹕臀᠁㴂戅䰁⥱⋭ᅾᇟᘅ᜴忀⚲塠摠儀⪁砀娀蕆䂁藙箚✙᡾圵㛘埰潦㕌写艝ኻ嵦硑䗠癥岔ᖪⲽᷢ砠ᩢ北朜筞訿补抴⅏睙尗⏢ᎄ⦚讕立瞆缍ጷ䨼蠽ᨬ薖磣柅㺨滩为膑妣蕋ℇ戲㰳䁐狄䗕ㆠ❗᪎滴⒱㉄ᜨ仅皫踆䠈琈ဳ怒っ弝⸾ᵕ佲嶳⒁嗇稡䝑琊蠄᫿◾熽Ⴘጬᒔ╊漄葋缗肤瀸䩁䄘䦩惑᯺柷䀎䱹⨚迕猥猂漟唹踽肠㢼慸犚果ጨ澩䢲赅⦣涆ㄫ㵚䈹堵መ倎寣វ㼆✌㝩蛤碥㗅䂁伃䐃ᐊ㠏痴寵栬⸬䏘〹ዓ訆㧉䤁帒牻整䋣┲墧ើᡖ庠倘ឰ䏉ḗ嘯漼ᢼᰩ⃉狵㓤哞ᔴ᪌匘⧰䐌℘▅ὐ媼ᰩ⡔ᑦ凳匘⚨Ề传䘕丂ᥗ羯絜䊗ᅱ牠䒘᫛娅ፂ፠ᥡ踃豉瞘┯籞ᓃ聕竹咅㞽᎛␊崅丳឵瓂⑒㢒缩ᘰ⑗ီ叽篖柞㾦溽咰灲ᮤ័冢Ṣ䠊堉炠偨倾戆Ⴜ熩呓ᇕ瓁哈舛㰍䒡墙袒ᘬ㮺✙ᨤ␀単牔╂᜕耫牢⃃禈欖刓ልᦱ⁀䬌⑸莄䩫膘㼱乑䙰ႏゃᄿ刎ᄙጺ⹩噃ᬵ礃⏗䜈⥁∱恵砝ታ屏儺ⷾሌ㡠ᕀ䁀䨘攞ᅢ⋁䁤袍猔㉰圯ᠸ捉ᒠ䓅丁涘港䬀ኻ敖桺ⅳ㜿忏㋪嗝元὆⑁幊⎇蠜㠟⠯梅兀奸埦ၤ⅘⯃ᴶᨡ呏宜謘≤ၲ訨ⓛ㐙匊ᛴ潽冸㼆㏤᠓⠇蠗䡸琨蠱䁨点倵䈂澁声擢咂㗆ᨙ蠜琖‚〃㉮瓄⤷䄪琼涢衢䎈〃文ጊ嘋䐅瀕耧犪偨䊊猥塺琡肉檒㾈᝟幯ᶐ猛胉ᲂᑯᳰ⚌珺詅喃→䨁㙥㫇ᅩ梏愼ሷ恈₺厄┘ᨐ䒠䂁⸉圿滈䖓匡臒粿圭㿞⤼㏱猠ᑠ㌀䚃┄蒽䀅耒☥Ძ⥮ ᳵ㰨弄叡泂憕〪嘢榖猬♊玥愎៰疌㫙猓Ⲡ⽇嬆煋ᐁ⦕謔⏀粎楾⣬猴㷸耱䢤谖䖀⽤细憑肿⇓㎎᩺❪杸ᐛ⭖䍡䮙መ恖ᡘᑚ偳吳健Ꭱ㺦泍寫⛠荃瞊ⴤ怢㚕呼犟䙰糎揦⊪栨⚰礤臊၁亃㘔竎䕽ㇻ㌥㋯Ე᮸⦱ᇫⳖ㾌憖嶚昢溁禔猙葐倿榎䋚䲘堩㤱䆅湍崀ᄋ帀᠉⠅啍盱槂䀠瑹嶉躑╢腅岊優嘵豐䂠旙᳼榜䐔⤍囊譁ᧄ✆㤃㜀㣐榝孁ウ剆᎗⇈䧵ᆃば䊌覃洆樳嘺僳肢聍烊ᑊ䈸矨笋⤔⁡疙墇㬐䠍〄謚㗄籞椞㱐䖍岘䜐賂ᜃ㊐儞䊬ᐃ栄倄㳕⡅㺊磜壪㱱䡃涃᪡獤娂⠚姞☇ᴋ椏䍀ⲱᦊ㸂瀢桗宥脆損㰰歄⚂㲇娧 圴㢊匵㈋犗嘯ℎ亼慶㠄痤ㆂ偪᢬湭䳫⃥捤䂂窅蠏堰恫儭储炀ᆬᄾ玩弰淤䈪歊䒏䬙㐕㶦茠䙊煻暯㯒㑀獀茡唃㘆戲灨哈䱅≡䑌㣂垠ᨄ熝半蕀➠筁䦃㸊囕妣䢊㈒矧ኔᡸ㠔ᆸ⫶㍌ᵚ㄰簸擓䶨㣉咸㢔⥧᳘ᵀ䓀កᚋ蝗ᨳ㭧灢唞⪔ჹ㧅嚹ဂ珰᫋ῠ䄡涙螳἟倱ⓙ妻艋㉨ᦟ䓮炥᠈ሕ芦澀冂栃ᓏ⡠僆剏Ꮨᗏ㢸㗈ᚨ肠⠁掘㺳㵚䘳⳴猎ᅱᤩ唂፠ᆅ䲺皑苇㞗⤁ᰆ爋▣⪮嚍燍幰㘮♜汑嚠ာ㞘栱ど㛎䰩臼藇Ꮴ晳⇪᪍啨⬠䙡兑趵搽沲琳燸䅏砇劏㘌璡暛㸣緂犓ⴈ贜㠕當᠛ᚫ箠僓፨᪍樛⾦眢䯓簡桡滙趴᫪偭ホჟဪ᪍檃䑱砊⮄ᔊ屨虐▴茹灭烜⭖⇈䤝䩨㯳屇牑憧㱜瓘嶦ᡚႴ㋠呻㓠㲌䫨㱦ᴋ膍笶晫堸⥘㢫蚶嶮楼Ⴐᛥ檰䮡䧩匈‶䰔㻓禟単䀀㰶双䜆⊤䦂捀蘂璚崮蔒⑀赦⫽肰ᦤ⡦ᆮ緕汛䝶綁䱋搜謜ᘨ်袬⛟僝⭄ᔞ纭檱ផ筦⩋喵褀ዕₒ〷䀃㊪栧䕌笘➉迖⬢⽅䀋弐䢻ᰙ匆盎᤾岖∌堀甠盀⫌ᅘᴆ幠Ⓚ䀁⌁癀巋ᙛⲐⳄ䴀皱あᲙ掆蜾蛍烶獭烽ᇋ摼ῠ⌈䲰៖㍭垘䖳㱭Ḳ糿窖−吞᤽ᄆ祹柳⪶㕁妇㖗ᠤ肗⁍ᡞ肨瀹လ㨪翩棻䋑ፂ⼅踆洘᪩㔸㍦盇緱劶ᭌ䎄┊㲦咁㣃₴䙮哐粒碇攖᧙殝䜾眹炢扰疍䕅䒲㼔ᒜ腷⍦蛑熠ᲀᙺ秉䌨㧀摣㘚碵煰爕索᪖↖㊮唗䖚ዄ㼫䯆捡妅㴜焩戛䡠䃍僌㪥歇䢒熁榐緃⻁㣘⾀焍刡槄䍲煢噦ᤄ㢶ⷘ┘⯀Ꮐᦛ䨵䀶」薺瀀✚帨忙⍜ⴭ⏪蛀摠噀憷┎㙣椊楼䋸熯Ꮀ䗔ᰍ楘៵芬䬔ပ㍣瘂尴煢⚠綐♣䃦弰媩坑㰫ⷘᴴᡱḚ沞脅晷ᆋ嫲䚸罁俐ᄅ砭蓘ᚃᥭ軙炞聵储㳗掍ဂᎄᖨ⯣甥或㒘㤀詌㢘炡㊹㨖ႇᵸመ槸⥠ᖤ⿋⸂ᨊ噤跅ᦎ嗇ᆍᙸⓔ⑝子◧Ꭽ㧂欦ᬝ暪賸䉑䂨烟傧䇔႘ᗨᖀ䠎Ờ἟╉䠭⦎㢢圝჎捣ှᜄḋᗆ轭帔内⼔㐬沿穜军၇凂⛔汉歛峱䶁䘐㒗赥渺ᇆ⮌朙箠凃፨ᜐḨ␠摮兛㎅⤋瘸呴笢⛭ዩ吡ᛂ⻍妻俀竮卆⨡ℤ胟撙訛䀢㹊殖Ⲏ≔㗛⛱ᄧ䏏礤嵴䀕桸プᕆ㙷Ḯᝠ料撋㡁䶇⢏瞅䙂ၫ琪⮏耋偨准䤂箸⟸䀕誆䔄嘩娝⚖ⰿ恑蕘兲泫䠒糠⵻⒑菥Ẃ妓⼾蓞ⷐ焉რ禁ⅱᗸ㲝ᴘ懄皪ნἫ怍氟Ი᧯ㅅ煳寳ᎎ၍礐䤳苡缇ᦆ㜶″䀜倹⃁㳛欀᫘᭄聲瘡耪䏂憂蠁⸍㰜挽痷玞⮖ᮀ㍍䒒㗤ᴍᩚ岷縆㫦觏扴曏ኋ℞᝼⢐乛他橍埝☒䠽⣑蕵棸薘嵌឴䢸Ṍ咳岁㽇菌抌簇☋⡟讦朣ጦᜭ⤂似ⓢ爅輠茜䮆㘙⠽䦛ⅅᑜ㔂济䪌埼漚扱僨䯉蠨瘔竢◃ᎃ琸㑺吭㝦楩㑋映跋⍁嘃崃⋇巚桤煀ᣝᕌ㖬筩㚐ᒠ᭠莐䜆恩チㆀ讒爛ᤞ忽Ṛ哐䗀㨰泠楀碂幷㓪喴䨓㐃壡Ὺ䫾娴᭚贖啮嶈ဳ⹀䈞䰾㭑傣綖⫢ Რ叀佀繮訆䶌赝峜㶭㇀ᕷᜩ呏㠎氁徻傆路ច㸣紳橓䄡䤳蓍ョ凐䫢朹⎂节᥊ៈ⺠㙸峅妺⊲㉛婴Ṣᘪ␉䲸ⴐ䩂ᡙ芼ᩉ灴栻戟四塱林ⶐ蜁㼪⡓拣暙➅茊嘎將桬☫ゲ椀䜖肜䵹㼓撦お綒栊⻙〛⠉聵ဧ兛ၶⳡ㥫猧婇畓⠈渘粱氨裱ᆪᷢ斴䝺⺼䭚瘤 曍最ᄇ㨎楗诋癳廑⹾ᩖ᷉▀參蛡慃主蹸廰嵁諈ㄋ口媇ᨄ᝜ể万䏫蔆讇爜檄吻秄⁶㢻湑὜⸈䐘羑揆⩊ኆ怅䠊憡㮲垨ᅻṢ⧰↴懐㾴榉嶘玻捳葋䐯悃ᗂ爌ⱀᕆ᪤Ốⶰ㕏㲈粽䘔႘㰻烬虤兑浹䫶諕䨩湦佄㓇蜅䨐㱪ᄎ⡘灷ხ哘Ꮌ᝽蛘䏑迂䡇ἠ䥀娔䰬䌦蛗罴ᷬ㽀煑ᯣူ䣯㨞簀ᄛ拷崩䉨蜒牆⯷䤊␩䲪萔焏ኃ謉瀯剟貆桶ᝀ缯浽⋜ᯤ㶓䖧ᚂ桄布瀇勪疸毑㕹瑡夃䈐Ⳉ㺚㶗㭏ἆ䒏ᐊ䰭岄労䊢㯣ႏᅂ讠愸䠲ᆂ痂纩轌䐊偕㯕ⅰ㡁④㐚對ᨊ柰癮㥟⤎␟剟偰䫄៉ᷰ偪ᨈ癩蟛臤抅狃⾦轕蘀ᐄ栛ეဓ⹨䳚繑胫焱㭩懄躳渘簫ᐬ䃱ᚇ煑凢Ꮖ譭䩚㵖欅ㅛᴭぬ䫭ᆾ讱䖉厳早ゖ㦨⹹し紀䇟䔣襭ᣱ臷捑▘煮ᔾṤ踁谐တ䲏焞炎稐†Ȿ፿瑐㾈⧎ጒផ譲ㇰ荦䯐墩᠀ሏ⠞䠈偺ᇭ澘ᕆ躍譳荁崂㊙㘲氮擡␪⠽⟤Ἶ汞▸㰈儉恠摬ㆃ徉ⰃᲺ巣捈䕽眽壷᳖塝ᑳ⡕癀聃甴摸蠛墺历㓓狑攩㮮輼捐弆変苈㸎洇撙擿䠰〘缸垮ᡜ㵀树⇡稂傁⊁∂胫臭桧菽㈽ᙨ㠌㙽筻彵牧傀紃笇栁⠏䠽恻忷氽ᠲ璼媩田摠证蠃 㸄怟᯼䆁㹈ᗟ乔癄䰨㣷笯曔斏᭺倔臒䇹芞发⤱ဂ磼㥻◨ᇄ❏誜ᵜ今䅢Ꮏ偼價旣ᯒ淕䜀硄漣僕ឹ㭞㹁怊㰄扻ᤰ⪉⪪╭咐ᄧ瞃衋辑慥湁䶘㉱煁㉈ỿ㠂ᅍ◃螅䧌៞暢䅏滐ၦ诤瞰㒎匼䃦䢸躁さ壥弋㔍儱䙚煋䋈唣ဩ嬬ᄎሜᖙ曢摮䃉紽欼硋䡚䁲瑒煑噡䫟႕抱ⱳ⪏⾑ゃ萇稕☄⤤ᇓ帀匚〲᪍蓣秦桎ᦟᤏᑮ䘕ᑰ䊐曏縂涶䰼峀塩⬐潉翞∦䔇簏淣᎙瞟㦘⓿⪬䧹羳䏷筩⣇掇繴㻰帊䋼䇚ᜏ፝ᕆ礱㰃谧児㦎⠳ㅄ怦倪⠞㕅恇⽅䱹ኘ㥂乣冢肅ᄎ潎晽䘊㎾㛟ᕭ渢㡤倴益爵䓰᱃谛⥡∩㔆収肣ၝ儥僸ᩌ◙兀荢廟涅Ὑ縰考砅怚岌⢻丣ᇌ⵳䠲糬≉䜶㝢泸興谞勸巙᥮㯒⵴῀≐传ⓠ䂀捲若簅⠚ၾ彼椷⑩Ꮡ㛘嚥蚂狄碅㍻芸凔謅◷痥び᝺曜垡緇㦀ၖ䒆街瀨∏ᇮ堫聹渼Ⲑ䦄☈虱ᖐ䠅ሀ⬁㰁ဟ毖埝弝滁ₘ圹蛰乲蔡㏆䴌谐㋯ᥞ㤉吅珇厇ᡞ赝諈⿀ᾮ䙙Ⓖ⌺ⓩ確䉙ℴ煑倓ႼⰮሚ㥂ᝃ孈䶣ᔔᐱ㨕⏘ស㾩摮ᡞ㵀媣檘㯁枌嬡谛䡖脌耞ヨ䁨〱⁲暱㔉⃒圁㣚䖻ᦅ弆喰↨⚺᝼ኝ㾜ᘌጀ៱㆏㠍䂎‰籝棆壦㔴厜⋂䪠詑蛙昕⺡㕇栉✦丗⸇櫢䡂㊅Ⴓᏻᐝ䉄ᘸ䒎㺋ⶅ㌃䐅堟耞ᡦ剅圆ᤲ㖴椰㨵┧蹠⊅腆Ჴ屧䂌ᡆώㄻ來⺸臈擓秧貃瞈Ɫᰀ怙ၳ衯᎘嘱ᱦ⍉臀㣵冬枡㎏㹂Ȿ᱙悏曬甂汤䣌ၱ焨ቧᵌ漜䚼䰳⠺痬㈑瘾兑僡ᇂዡ翢蔗扰弞亝洨库ⰱ⡓䊁㕄煆包Ⴥ䩒殑劄㗑䎎䈍⢌怽掱㠌ᬓឭ◾㋉姬ᰂ炀ႏḹほ蛝ᗬ᱁芍爞峂⤆Ⴆ₨④玬巛嚬䄎䒽ሎ䃟㘶㯡槭䜕ᜑ聒猣蚢軃澵ᡠ㰀ᗯ墁蠈粛灑㯊⸄㍒螒㝏䄑瞅ὦ䀨㨗䀊⡠㻿渼䜶杬報䣄ᥡ㣁辄က勌㸄ⱉ儻㗚ᕚ䗪摽Ửⰶ㾑ἇ朷⬑两㇮悿匪ြⅶ㲗႕縱㞤劢會✓⼇㸆‘惱㏠塼牋㻔楥ኪᆅ⯀ၞ➃悂䃰尼ჰ㚙卯ᜬ儖Ꮬ ᠠ㲯⇛ 䡊♣㑣㆒旟ቪ傰勍ᤩ蘉肔楂䭗怐嬦伐㨦桨ᐋ熌↏᯹ᒑ棤㚱肇䎜㼤戨᫷琠‾⟎羰⻛㑶ᩐ慁⃤勯蕚╄㽋᫳葳褉唓巬務ᕆ漘‘ぇ武㦃瀌兮䚋蔰㰗₲䄝爍㮜䊘涫㺄㙂蜕䞮ⅻ蛰褉慺蔶燞彣⾍ᬽ嶳䢸小楃⾙㑱虓㡪᠏惔᫰ᓇ㩛ዪ⑲ᦣ䌁㜆サ᠑誻ᐄ灦⒊耇ₚᣛႤ㑚♱㰫澁䜯ၓ滏稯裩狀媇奬᜴淴ᇘ⑀傣犀䔀䨃䔗妭㇒璥ᆞ♢ᗪ䉒Ḕ↦㾎᧎孅䖀稿䒂碢腁ዱ狾⬐䳽㭩眃罂᜚䖽晃⼑䧙䍷懁燗ᜯ⼮䶉畛淠⤮矢㿅扛᱁䁲灓⏼妭圲䆸ፘላ営䕱壍縧㖍Ṍ褫ၔ䁑ၑ分ᄪ₍㰃軦葈々搱伳㳉䴫豑棔፶ᗠ䡐唁怄ᰧ䏠娃ᎄ᝘ᘐこ㦢㣔ᤆ⎧⦬淚ᄃᡧ剑剖侎硙ᐥ秕䥀憘䅋熙嚼槾ლ礡㥃⛘≅䮌缆呔摀蔠碥嬢ᕆ涑惻菁㔧Ꮗ妏㵥漅榚㐁ႂ㄀㋚啹ᱤ芠㭱㞋砅┊ላ幞疋᠄瀴筹偔ዸ比አ⎀᪁ኀ粭覍ᚨ蕗憨ᒔ夨᎘㹛᯹圱ὲ㇢耇弑眣挞⁅Ⴟ冻篃⪋⪜赾⴫㸡恇熠䮇乬萕籸䃱ᏻ臢ᑡ㬎病㼰慰㤀倞貊教✜䵷㩋脩繸堻ᾪ姈ဋ笗晭膢緇攴唐⡱ᤸ袄羬၌䗹ᠮ 箒㞃ん掐ㅇ檴览᫸碹嘄㊢≗፬甜䶰懮輣乇ង盽ለ䑈䀀㓲ᗖ劧᷵ከ㽔励ᴆ蘓⽬笠ᇁ⮯椃ᇍ泈䩍₭沘田ᯈ✡紇ⱐ瑌褥秎␶ᅑ淈䩬春葡䪈燇妉蠈晘Ⳓ䶥ᰳ᡽臈⏀ᖮ㻔䩼Ⲁ蘒ᓓ弁ᱳ脟㥫寐ᤃ娄㌍Ჾ獺⩼劈⭭禍瞦ḷ⹌谬䁁䁅竍⾍嘳፬贱㎑痆牃桁も哱嘿䑡⃫燖厮⎾棉ㅚ動ᗡ溜嗆㌐㰼喣ᎃ蛽竫㇙䍗‮㏸萐猃忎嬊焋᠐䅪᲍ᚙ冮╞㇄れ㞠彨樒ⲣ㼏圫猓粂⃝艼᧕ᐶ႞ᗠ⁨ム赫蔗┒簣ᜎ豳觵Ⴈ绾㏓奓ᢜ搨䜴㙄䂛ᴴ嬞㸛燒決梉稧圔ᱤ㚼怨⨠ᜠႀ痂ᙀ諐塐㋢〺㻸珫⦄宐㭫草ἁ㏞資㒍ᔘ㖅䇤戃壂椔凴粥躳徥應揎䆺㠠裻踞㎍ᙟᄇ刐妴ⱬ炙婦㷡䓂憊䎉攤穎Ⱙ剡ិ寿⏅ᗼᵘᚠ㦀洁䊆煽⸂臩貇䂼㔁ㇺᛤ整ⶀ䟀ᓅ觟䫉榍䴨㠲炶債午堤᪪猖③艉ㄮ旝熍缮磐ပ耼蚇舩曒Ⱳ姁⫝̸䶘䠩䘛肆庋㌦碅袯ㄘ噊∕佢ᚂ㥂跸棒崏瞫西䉀儫诱坪峕儡喏⑔⵲㔲腃葕砏ᚊ愧爳劤舞畿次偌瘖ᛊ算䦄吆紋褐ḕᷪ䱴太㦤ᥰᔼ⤉休⧶渣⡞ᑅ䱶哼血䉴胏翊㐑ဃᷮⅴ晃胰㇃砟礎炊ⵀ璐曇舅壄ᥐ⽔ト聇፠ᶣ岺蚕庋⸣譁肣篋僁䲡ᫎ⫰䉳帥⻆縏缜璼啹ⱅ瀣ီ傣䓖ᆨ⬈袧䰲ၖ礇␳呸烶胦㠅倝倦倰簸₈៙䓉孤ⶑ┊䚻㰩硢璗煑凍዁ᨶ⣈念ⴂ投貆簔㺀ᰊ考䀦肇冔↴㑈㰀Ṱ⊲㩐圲ℒ㲻甆㧎〟䀄⃐墌歁昩づ烇熕您貀弊痮貝〣ᄉሓ⸅➰⪨ᮆ⟁䱈䀞佥狩䲟ሒ倲ᄊᔜ⤈厔ᤸኗ◡舁㦁奕币⧔々⃟拸椞᜴⟨䱹躐蟢蟤蒰砽振倹⢒藰ᢔ␟ᰪề輀⟀㔁䧃㠚∕ἰ㧥∉䇷稷㐴⌊ᑐᛸ蕁瞓ᤞ攑璕⣶袚评咁Ⴉᗥ←墮䁊牨珎Έầ獫䐧‡㡂炅焌ჼኩ⣭膚揥蚇心帪上嘋尡夙㕋㟎癅ᐴᄑ笨㻩嗫礕⼝蠋㒖㤣瓊ႆ㉲㙅㙪报㕠畩孯ᔙ娆㠝ኄ呈‧禑㑤ማነ‼ᑠ幇⼡㋦䔍⸗䡟᡽⬺䦘学恜ာዶ䉋産壈㫞嚶ㄸ⩓蠂‧炲ᩜ惇島桌毌ဲᜡ㣉ᤄⰂ栕ᰡ硃禅㼙嵹㽈㸨灊輳⽠寅㪤ℏ猳紳珅㍞ዶ渤孞႙數ቡ㳬傦斗李♚億樋 䌨戄ᄹ⪦䓻眥㣈澋箎楼ᘯ♊䁃聙捃⺪ᣜ墦ᦈ羃吳⑒㛌㺘衚夈᡼凇㊟カ孠捈䇈䌘ᆌ蘦䵍材瑳葯䫰矕焐ሡ䂡⬊䙲炥㮢㙌妊熚爧敹檚ㅸ荻ဦ㳮忕蹴疩沣诣唓犑␘蕛≅䦰㆒㙻㿈⑄迫乡嶒篁炸眇ሑᧆ波妻寒ᰔ唤⧝䩑䔀摠⽂⇌砹朳絲榠囲㝋ᜲ姬ጭ㦸᎙榫礥㆙㈡偩㱵礌䂉მ倦ᑊᢘ├莉狯㡣㾨朼夋憳〈┈掑㘼㖒耽ከ泘衐ᕟ㵋䁱币⠢䡅Ⴈ莨眼㙺枚㏸䄰殓⢇啎ᢛ軱帇䰿極腪ᙬ᮪㗖䥩⛓凃螚萛ᜦ伆ᥩ䂽⦞玉ᤌ⿔蕵㢄甗შ⑧䡌䲝瑈蓆健充获₊廴裍㹁Ꮡ⧊㲦詎崀岦妥芾ᕋ莄瘼㥢㏌笚惱潑吂Ⓟᬋ᠛營᳍㍪㌴⼶⋜᱐㠓ἐ⎀果蒁紧ⱸ虩᧺璴῍⻚张朸䣚殠猍粆㺔ᖚ爖₿倅炊兣ᄡᎬṸ⅔菃触ⶐ㖒ᵥ炁耈⠗䉐ᒡᖒᄘႸ㖡耢䮳䤧棁孑檣᳣Ꮺ腁⏥ᨐ徚唞争㤙篊襛挑☗Ⴆ瑽賌㦺焕栛⹲䲂䳬櫀獬寥誊煹搂䶸峱觸䊑ᑻ⨲曜绩Ꮹ映⸀䶆师椴簨贀䧰宥浿偪謙匀㨸石跧秏爞㐣聆᪜蟢䌱ῷ㑖印䳤觔燁嫎ἳ⅗䡏傟ℨ㊾痘瞰忄䴰⥈罸謰䠕椁ⴁ贻ⱜ↰蔁獜ᓞ៮⦰ῐ㋑俬㪇㨚亠廮ᶦ⤞蓓繤ኙ峅ⷢ䜜温蘢ᖉ▟㩥♌蹥ᬶ榅␟嗁ᠬ斂⤠踉枔␣㚟䮘嚱⡜Ⓔ琤ㇼ▷㨡⺑䳘恀嗁ᯣ〇縁㤽㴼偹៦握ᵶ䪔傄瞳㶠嘀秛Ⓧ斞ᝁㄘ䒍↌ឌᜲ岢ᡲᘘ燺ᩤ殜⼆㬓牥⑵砶肌ㄙ㚎ቌ䏊冈绡誆缨ᖊ焆ᨍ扢棪娦䏡⶜䁴⭩Ⴙ議⨡᳡着㾢䰖洬䣀扱嫖㙢倱ㄢ䳩专Ẋ策失癰堍ဂ䀕圚葝㜼仞檔蓓䛡䋥⮙抁ᴜ脉ⵟᦘ珁⌵ᴙᘶ䁕⒠㵈辂汎彐簵㔽䄏凪模壈戊亀㢑倛Ẃ䧩ᭂ埐肣䌨痫䣁␆㴞淹ၐ犨᫴賰ὴᤦ䒾褋蛳ᣲ∌憓葵ᚦ᳸ᣐ↬虱菲ᠦᴤᵉ㤺䇵栉ᤦᇭ㛫戊觲削湖䈡䜗檢佌ᐨᡸ唍榵嫧ῴ㒠尸俴梊だỔ欁㈈糧⹹珯↗ᓣ᱓ᾒ㘔萐ሐ㛭⫗蹑ᘙኧ㆙⇵⧘⌱ᗕᘖᒠᤵᤑ⢱泩Å帖⒤ᴳ炕ギᎮ癑崄♎勭⏑⟁裡羵蔞ጧရⱦ响菶昦⪬⣙笻摵㈓货謩缾獀凾㏖菁舕ᔫ㤇⦉㳒橹嵏萆䰓爿䋍塖ᡆ肎ᗬ坔㡋㖜䴓ⷦ㑋媟䦛玝幣梨䇌ㄷ㥅㣪᱔␲卭⑵仩癔匝㔬ኘ䁱䓦您焜刺幸䇘兢乑糥ナኂ樈蜰尨譪橋姌垃㢯ᵉ贈㏀☀ᙃ蟓⮟耰▨橴慊稧徵㵪Ⓞ᩠㏐埓⹩ᖿ琘Ჹ籥扝煅据倦ὤ᪪娴窪㩭滈焉䩦㘨湫ᢡ僁犪华ቊጔᗘዅ䈓侩㺌ᔋ㤽婇䊺䎄㯋僼㕏ᰢ奴巁ⷴⴡ䴅㌇們躘ⴸᩏ㙫ᔬⳀ㵄姪䘄舠ῗ僓₎㛾⦙␃䉧焠ဳᒂᇤ赭➤談ⓉὍ樕⡼㐐殗聉ᓄ妋⌚㈀㡑䏰㘄㟠䇃㹿蛿藿贲ᠢ㍯❹咟Ṽည襸筠䡀疀㲥蓡蔖䫶塢ᅌ㜨む敜㨪改緳篩掤抏䉳袄懊割捘癑ὦሱ裕⬺㳤府⤌蚌Ȿ僽窀╳Ⓢⴥ嚎襘䓠净塀✅㪺缣⬹背橴懧姼涮⒎ኒ䊌賐塠庀含⪙䍎堸㡞㉛㍶᳗䛌ᨾ抩渵⛇を䪁ᰃ儦㉢⋇䎳⑃Ꮋ†Ῐ䟑㥲傠㻋ⴖ㰮ဨ⠃耐耊䃔ぢ✮ㇸ桩メ斠Ⓤ弖䰔⁘倈瀿″㞁᦬擟ᓄㅨ㥄䍉癊ኯ℟布賹瓬蒢状ⅎ㽪奌怩媖║⩀痕⨞㈻悾⬒♛蓝嗥ᅂሶ塔皣⻇录刅虫䍍籉瀑悑ဓሴአᤔᑭ⩊㞊襪梘␯咅リ偑聜ᄣᄪᒎᤢ旽ⴚ䚁䖪然䰊豎㐭䔷䏔倓቉ᒔ岢昀諪框冕貙㔚ᰔ䰤栦んႸ竍㢗㫀䈉⊴䦱謒⾾梞╖溭嵛䪳敵ᝀ区㭰养癪渏曪毕䥓㐉␋栞䏇䕴㣊㱌䏙緙蹱㊫絪笠纫䊙⩮絍莋煽睬ᦜ绒䢀ᢀ◒㦩⛔㲬‡䙏⦚窆ᄦ剎Ὲ⏖䑱翤綠─䶀谁㠾氅ぉ耇倪≖⸅㰙㹱彡὇誆䬊岞⍗萇ᵗဉ値傍敷㰒佥㓕⁰䥒怬᢬褭剫ⳓ榧⍏㢆ឥ㊰叁誣吠观∁刃℻ⴂ㎆勔圱揯㞴彰ᖪ宊⪵䩖⌠㑚誽⁺裛执狩卡岣㤆檋撧Ṉ樍蘧㤂脀㨀瓨婡ᏗⳈ⌂貈皼ሉ晭搛㤶搆紹舅桥㔍ℚᱵᨄṽ悘ᔰ῀ᡨ៕弔ᄭ籸ᢊᄅ爎㚱㦤᥀⊊㼚ᶨ㣫⪫甒⣶⢐䉧撥劁⛤暶濼䈀唖ャ⬦㢚€䥒聜硾儴㇎✜⧠␤⩑䄂䚅凌ᶖ刴瑘璱楣抩╃⦘ᅲ᪎凵㋊蛅႐㖎ⴓ丕᳗ᅳ㊓㔧尛枎㩾摀㨰㉠椂㤄掮‖熲᭫⣔疪嫡枑㽬⑽䷚诵衕落䥪ṟᓰ海匆蕂容❶㰲澭㡲肵誫罗炭㈖爩⪶衈䗝婝柩㻼᠕䰒狵脂蓗嚯荞㚽畿櫻㿴巯ᣀℸ琝伲爅㞀沗䨛Ὗ犾啿䀀䗦㮵ẞ亥⹙卡石⢧皀䠉㠤胰┢櫩ᔔᲓ勀梡◸Ჳ䎆Ⅰ䞓Ằ丅璳蠙䪀琩婏☜ᮬ庙ⵚ脄眏撤縐潕悟ᓹ怱〧穛未皁㋀䥙冋䗫㖀㙠码⠉⠜⓪剢晻杪☰⓭㉅篈佂憪皀䄻⪏ᰊ㏉咃῾ὶ劭䖭僪贶ᡊ䍗ᡍ₯㡥ᇾ斈⌨娽杩䅄咩烒踐ᑞ∊愕㘄᪜扖䅮☗㡻曺⚕ᩩ⇥塑⛓坓絃怜㢧賯⫢῭㧿⣪嬥ᇡ絔妵磫亡႕廫旤惫樀ᇚቕ姝㵅灰橢㷤籠疓瘧Ⰷ耘硔䨸蔖ᕫ⳼䞵摚㟗Ⲵ襧⸫怰㙵榍増炨焫ၶᒯ䋾吱㉴搡䱅貌┊坄Ḅ琪ᬓ苛犽末៨䣨折䥓拀ႅ瀉䀁ᰥ墲䉘㙐㳘ᾦ暶冒佺檡㏁㤃垟⨚剥䶊ᦚ坅ゝ杳ᴠ趻噰摠䥟櫙梯哉䷬Ⱔ㚫巏ᆠᕆ踾瘀疡絉搅㴸䵚笲呓᠙䆪瀔稸㱌Ḝ绻櫤ᐲ缄ḧ㸄琄亰㴪㕳暊燻ᘶ碑Ⳉ㨰啀蜪葘㾇Ჿ⣶㪭敾⍮凁ᗅ䈢樭岱瘓紃ᬜဨ蝈艑᠐㦽瀝盹橺႙拴翛⫶䳭⬈訕栲繿蓱㎡ၜᄥ斸剆禰棁ᩥႪᰁ䠂ᙜ咀䁡 偆偽Ⴉᵤእ⽱㚪㹀噚格ᕀ绑ユᕡ㐮坂㟷㲮窸≕⛁ᴁ咀携昦ổჩ琍葹瑬ᣠ壎箂孫㬁⚂㷚蠏圌┧ჲ⪆ᑫთ⤳≂弴⒃忥ᦥ浓答扫財ᆈ㨻垁᪼╼ᑶ砺蚲ᰁ蹫ᩙ洉ᘑ䑳ァ娼က摫楰炈嘢殖拁㣭憌⪶屄糑誎筪剰ᗏ䉞曩萘᮰⥠㸀⌄氄ᵒ䋌檍瘶㕃嫛⶷㛭湻ၧ⏡掖䯛ᒣ眨䘞橨艬兇晵䀐䩾㼍弻䨃曛輪ὔ抳擴䔮㭅ឃ嶉楝ቴⰨ㨹偮␨匝褖䈡㱄荦䪿⍯ျ႐ᗴ⩰័㨶赬㿗┻艎㑫吓戥劁㮜毩䟘⯐㗐㨣帇后膨杒芸秴燝⁯猏寒熠ᄰᶰ㏁㣮᭎䰱竫⸢䯘焳ㅑ剞ᐶጦ䊊㤊糋᱙ፅ⺉艍吪⢞怣菵緻峔ぁ奸慊㥊䩟ᲃ熟␁虋緃ㄿ卭㡟₹ᔰ┛笥粖椃㠆ᜊ孨嵣᮰㋿㷁噂䝨ᵀ墔師冧楈碑换娨湙砎⃁蒲筥書⍵ቋ㥖夂㙒濇㵛䈑畯⋕喽㭹ᄳ坷䡩⌸绡Ḇ嗈碅㎶⥇ᙴ㷉ㅦ搙ហ⚤筨ᇀ㗺芗ᱎဌ表⩨沆ᣍ悘✩㷼洄䦈⟠硇ၢ䕄垀䪝䭰䔠Ᏹ⃋匊∲Ớ䤂勝埫嘤ᡣ⎗㠡虪癫ᴛ詴က澴氵‱枤刈磵籂᳒唊噣劈䃁ᦄὡ墱氻⦈㠡幫怋ᦑ䣐⼞㑿惕婻䓷䖲㝧浼⻹榓荱䇓⢨凝䱗ⲋ嘛䁣ᚢ㠖吜内䬕ሪ⃋晩匂踘ᡉㄓ⠨褨ㅌ䛌ኣ㤲䜦蛐傐賧㶄蜽䱃碇櫉嗖䆷ጴ磳ᱠ䇉跡踙娲ᔪ☥蠥㰭◗袜⦘傓ᄥጭ䛰ᗅ秛枳轋樅䶴㫰募ⓦ姍傟ᆭ䕭䱆薜䶗埍殃ᤌ籲欃䢘莖傘〟ᛑ♠⬠瑘ᡲ矠㒊᜔漃⭹ⴁᅚ芶䞊ᑾứ❜㯓㶧▮㯬⶘刍ὓ耐怅↱疌儫♾Ⴐ屨篰ㅵ苬䫞␗樮䢃棋晓㛗梪䗹䬘曚疚ᡬ⡈⼁ጃ☉⩈㗒䫥㗱屿䣞⓹ᓴᒫ漵✏煑ㅚ㑠惴甝㨻⎔罏䐶堵棄ᄫ⛀椯㳌稔㊄磷ሰ撱犋偎ᄀᐔ⌕蜫枱夗┢瞪硽氒㣬လ䙃倔㍬呢讘聴跔䳖⿝㸹䈅熃㔐殾厃媆♌伖䲵㘰匰䍩⫝羾㲤⦝⦙㪎嶟慇၍䢒忝袻翶迈讳≗ば吡砨咦蟅⯰愌䨢冸淤Უᔩ淙㠍萓Ყ䡑诰⎞∀找㲍╛绩ፀ玑瑒覾朖嵟嬮⏪ᅎ怛ẻ䬌ᖭ䜊ᮖ率朡⩊詭簵洎娭瀓ቤᓊᬘ┝踻袆丧慖奄犢⁪㐾‮᭐紪漞⩹圱ሂ彑ᶏ蚄瘈㽬䙱䪖∋㈗嫞√瀎苍蘚槪㱔⬊筚瑐≩痶䁛䟚粡漞⍵聺谣蛧匀☄眄襯ᛝ嫗┊ᴳ悂➩䌔䗐ᤳ熸ᘏ㽚⽛ᶀ蕱衼䇣繍枷⸚ᇬᨖቫ辸ᝮ斢䋀冁䬁七⎿㙣㈙掤Ὄ池聴∊䚋膅㍹舠倇急ᆊ⒝翎灑⋝氙泶嬗㣧啍䎜㰔乱䔊䣎䐅响洪胜⑼䏶Ỵ䈭⩓㟁䈢哈ᱡ篋猯匳惵僌迵计ᗕ᱉忐蝬挙谅栊耐䐶耐噲脤䧺臹玦⫆乛勁噺䧲憝瓝䄾愷㜸Ꭴᴬ燰ᔓᡧ⚪䰖谿᥺⢏䦘岠忯ቐᵃቝ睵棁趐袏≬甊᪡崀⌱暃䁘ᵬ睅⠘䊉析搔蚇翂宄ᡏ诪咾኶昬ᖌ⍢㩅迒᥂盜砊⒨赩繫⮍患胴肂峘葭渉ሆၷ㤬榃ᶚ砕乫䋗−掺⴦≚蓲秝᷻⚀᦯營到㎁覂⃂慳礆咈婵䐖矤疴‖膇窝☗虌蹫ᳩ肚ᄴ劣營俴⫲㱺䖊古ⱚ䬀䘋䀳᭟害憢ᜃ㤆伈䖩⠛᫸亃⢂丈 ᰦ星畇䢀ጓ㞜⣚谣軋芸ᾃ㼠妺⢽⁹↤恣枾㽾㶤ᵸ怢桁孂稅ᅞ谉杇缈褵胐㎴䂳ᥗ⦊貥Ნᓸ午᠑愦䰖泝硔䃂㹑缆爾塔睲樒ᕡ嚂憁ᰃ怄吃栳娱奿㿚᜸ⱸ趥፳謨䣧搁嚡㊒‵⧎簼秽‘嬊汹蓘ⶀ嶀Ἓ賢䇃睶墑禷剎苈㷲叇䡑趠茫攘☖侺㶘〝䖝踭Ⱛ၎㦤၌ឮ㝰㣼㽘䳓掏蹔貖㢘ⷼ‬ᄶ永猍喼媻ᶚ毫⢓趑碦䈀 䘱ⓝㇺ琠⪁ᎂ跰仰巁⯱伡℞烶ⅴ粌〇ቬ㦦爪ᵱ摄晵䴇詄ḡᝂ⎈挀䄡哻糹᪃㜄ᨽ㤀挛羗≣㈯昰㩀ၙ犎⁓儸㤡旫 㟲藤婍㋋ᅓ䮩䅙輔䧕怼ホ脩᧼媸嚢䔋᫸茪沦絎消講殙ᓦ㒝ᠬ䝩㵞坠ቢ㉕旮捜渚ᐜ祟片戰᥼ዾဈၴ⎈ᮀ幖揰㙇䵈謽ၦ泞䩮裺ᮑṰᄆ窃僤⁄ὑ匟芚蠜㠬䃪容䡹戻䰬䡹㟼写娷㺌菓況圤崑殪芀憿᮪ᄞ᧌よ㝀ᛳ罧澵哃皡塔穒嗵螆዆琼⁄⎨㛜呲蠲⍀乍晿壇蹃沇煲檲䕩䱋↘薡佃䞮礽Ꮁ蠍丄瀧傝刚㳲堅㙼車䃠豪痱䒾⨓夌䛆拘犥᫮燕殉ⓨᄰ㝰弁㣲㻟贞ᡏ䇾チ▘蓝般瑳យ獞᰼ៃ焬㫆眔悊ᜎ粝〉儼志ᔟ姛⌍⃢瑤攃岈揉従挌ᮍ尹䈪ᑐᭌ蒽㫨䫫㘓咦櫚嗊᫕畨腱䘯襀㸔熴ဆ踞ᖆ㬥奠ᶙ娵薓廡》ၛ዗䊢甲噬捈侖卓叧啎弄櫣㼪繏㜱癑峕⊯娃Ⅸ㹜憶樖礌⑜侇㐲艮艜傺᥂樝㛿⌌榳緢眓⹟妱Ⱜ堒傠媛⥢君殼灍幍掰彀紱䕚ᐊ⾖欭ᑥ撾∥ᣓ捶躎἞㭧蔠觲砞䄗橖綸⹜⁹襬䋥疊⠜㏢侢糓緧啐Ⴘ㦑綫㣝ᯄ蠱晢欤艬笀脹殶乂垄謉視◳䣁Ⅹ猟潧獇㶗Ზ㿓圣␄㤙笏ጯ㚆緼貦䦉⾞⾆圶☝焼欠ၱ左ᠩ蜼壇㪞熛䦇ኣᓺᅣ⡀棳㪩耈孉秊簁⬘㸰貱㎄䇇擂忬㰅ℰὙ嵱包ῌ綘稾ᄥ冡ᑺ㡏ᐳᠪ䒔啃緑᧠璖憽➙㜮ほ曠䥌栻㨞蒘漝㸬甸琛偤煼縥㉛愉䊡兑禢旐᧸៾䘆嬂拌䨆㠔㾅椗偑賚䦰ᐿ株偝崄惹腏磉ᤀ㛍帟䷺晪脏肫啎⮝害⯪䕐忡〲蟧ሟ催△Ⴂ䩮葌皲樆᪎哮䣕㍒㓤庡ᖚ玛耏⋱怞瀪㦗猡帇⟫⺕ᄪᵂ悥肦犖ᥦ岻怟蜘㑔あ⚘檣⅃緳぀⇣㿃岽ᡆ炒苀᜸姰奣伷ᓘ境蠧⣑垭䵹垒纋灑訯⥌垓涹⻒တ茫囩眮ⷠ桗エ禈褭用▆华㛛ფᑠ㠐ⱀ⃂兖䓄畘慷墅蘮㕮坝忿劌⻖㥬挘⣚䢞耊縸┕薧䓕ぇ劃熳伇Ⓘ᷌჈ဌ䧑儿箂蜵紗᳍榡䆈矩䄡ḑ晃花豲ᦁᎺ蝽ጃ胝攟ᾠ甎是寘Ꮨ栌搙㢃绥㓐⫡㢓惥蟧検ᐑ瓀ᨿ⌆䶋᱔嘅⸦䱾㾓扎硔䴍䨗Ⰿក䲔䓱そᏴ㸴⪅ῐ羡⁥႕㗭䊾䐩ᗋ愀ဎ吭ዥ壔ᾤ渐檾笲င稜⑱⾛硰協膃䌠蟢傲䐈⇑㨀ᛋ亂豀∯䍮伒喤ᅑ䂒嬅ቀ厙᜴繫囃渐ⴘ畋噀㵎㵒ド伺笸姨蹤攒Ⅹᐱ㨐።㜁䂢ᝩ⓻⻅捣䖒⡑絟䷐䰄苡〈傡ቱ蒑礎☴胫᜴⎣岲详㇒ᶟ挤肃㨶袀ᨅᏎᨗḞ㣩㕐ᨦ䀝䚧謳ᤡჶ偺元်኷㪾㫘巹册┝䏥蕽䞋欗哪傣莪䒇ᜌ呸濾 ሸ橦榇渉戍琚灐賬䩓泮㟢暱超掺ယᾀ⌃統枦滿稐㕭瑗嵂昙䓮᪆➍⬡㏴糩ᝑ⺚⹛扳➉␴჉Ⴚᕬ⑂᥼末䆝䒉嵖萨呮男䫈薟竤旍廫㖥蛜ᄐ紤᳛᪭㸲恙⳺㴀堌▻ᣡㅼ䢆Ḱ懺㐴素⡻ᘧ蠶礣絃穵㕉示⒤凌䇡跹ᫀṦ搀Ꭴ荁䮷呓墓喥⪲湝簨⊫⋗⾱ᙖ⑶袿䱏↊⍻ጩ☣玹懹珫妙匢䭭瓚ጀ嵚䠨赩糶᩿篯᪔糲合㆘迸㏑眴校乇晤踟ⲝ⪡ခ窉忒›䲴灑᧔䣤菌禪杕交橪睅᥯␇㛭▰✡唀㏀嬎擁般籸⳴㕘ᨚ㧆弔蛸へ䓤藘許㖛㲝὚愉戦㳙擑叚瑞☂䷶㌭㢡䛞祓茏綔抋嘯江♕菴䃞莅ፃ籫懠ၛ狩躔攔⒐礭暢爎Ⓟ䐈ჷ㧍䅆峎ὄጚ熫湥㑎䇟瀿ᅂ儲ᔇ囫㏲Ί⧪㮕秘㦐澪䒐荈焔㌂ᦟ澬᳎癖佂傐╎㦯傡ᬬ吇淂偮ゖኣ箙捩᾵ᐱ褨ᯅ䂦⭉箉荏⣭䔟ᾕᚃ㘇㛬䅂䐜偃㠩げ䃐嵅滏晐奊嗓䅳䪮㵉萘ⓠⅨ䜯褟睉䪢ረ詮惬❼㔟䜙偮㵋筳䌦ᴆ㞧謍　簦ဤ‫ဓ㚎洓厚㲹蘸⩪璚愔堘断⌽ᢢ燖扅㣷ᔞᔐ⑉伽㽗轃㰜垌謖Ⴀ㻃䶇䥢䁘䘌❰彵⃤䄁㏘繍ẜ厏㜋Ჩ砆煹ᵺ⺹⹩漑炠ዠ","[\"C,760825314合规认证项目经理北京]9技术交付工程师人力资源专员-国际opsMi大模型数据架构招聘安全研发车载Aud软件汽上海系统框测试开小爱客户端训练投 /手互联南推者关用运营嵌入式操作显示渲染组织与才展应攻防智能支持武汉洗衣机性家电驱动算法外质量Igent产品冰箱（制冷保鲜）HR方向供商管影像服务结硬险稳定空控链计划网络战略平台整销风金融达lca雅加SrvO流东物分析热建调功B体验设器预P标K气械西语马德里池零售米兰布拉格直辖市GT盘巴黎广告放新岗杜塞尔多夫莫斯科后L迪拜埃比勒首伦敦主胡志明场Nw利社媒尼坡贝莱mh伊坦y慕黑派墨哥城曼谷约翰内堡罗那卡萨吉隆中香港fEDb(k&)波泰渠道F类维阿让挖掘学葡培生木图光深圳射频路天线芯片实现艺处拟可靠音封装态业容策区扫地基础事行政牌部署知识权+本化公共充触存储通信子声包材料高视配觉画云备相J意评萄牙会得创输优福文采购成耗集传播字底解液俄英习届V决究顶尖具身饰磁顾问毫自团美位估助终属仿真景莞埗卓足强驾驶州青岛长春宁温综澎常x官亚—密苏塔园言财世界值对室感附剪辑灵巧三到核心低压税申报接待太原座舱汕头惠都厦门沧郑短洛涅扬古健康案唤醒隐私拍摄WU欧因移.佩领导特档佛山束转表度指荷履圈协同绵阳活芜湖施休闲游戏级出变前无锡办尺寸徐效店重庆宿迁轻连论烟洲编译辅滑轨义总监簧跨境日照故钣穿戴椅悬弹费非造改覆缝纫油漆纤复先进增耐久哈根屋贵反钱資經职责印静逆栈易q介盐潍坊旅版镇江查副负华淄博响厂Q障宝龙形嘉兴淮泉临沂济昆索赔托盖修口板剧枫时下",13235);
const xiaomiType:Record<string,string>={S:"SOCIAL",C:"CAMPUS",I:"INTERNSHIP"};
const xiaomiUrls:Record<string,string>={S:"https://xiaomi.jobs.f.mioffice.cn/index/",C:"https://xiaomi.jobs.f.mioffice.cn/campus/",I:"https://xiaomi.jobs.f.mioffice.cn/internship/"};
const domesticObserved:Job[]=xiaomiCompact.map(([kind,native,title,city])=>{
 if(!xiaomiType[kind]||!/^\d{12,22}$/.test(native)||!title||title.length>220||!city||city.length>100)throw Error("Invalid Xiaomi list record");
 return {id:"xiaomi-"+kind+"-"+native,company:"Xiaomi",title,location:city,remote:null,url:xiaomiUrls[kind],platform:"xiaomi-official",source:xiaomiType[kind],domestic:true,recruitmentType:xiaomiType[kind],observedAt:"2026-10-16"};
});
if(domesticObserved.length!==1010||new Set(domesticObserved.map(j=>j.id)).size!==1010||domesticObserved.filter(j=>j.recruitmentType==="SOCIAL").length!==350||domesticObserved.filter(j=>j.recruitmentType==="CAMPUS").length!==350||domesticObserved.filter(j=>j.recruitmentType==="INTERNSHIP").length!==310)throw Error("Invalid Xiaomi total or channels");
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
  rows.push(...domesticObserved);
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
function domesticDetailHtml(j:Job):string{
 const names:Record<string,string>={SOCIAL:"社会招聘",CAMPUS:"校园招聘",INTERNSHIP:"实习招聘"};
 const kind=names[j.recruitmentType||""]||"分类未核实",title=esc(j.title),city=esc(j.location),url=esc(j.url);
 const note="本岗位是 2026 年 10 月 16 日小米官方招聘列表的真实观察记录。当前是否在招、完整职位描述与该岗位直达投递链接尚未核实。请在官方招聘频道核对。";
 const noteEn="Observed on the official Xiaomi job list on October 16, 2026. Current opening status, complete job description and position-specific application URL have not been verified.";
 return '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+title+' · HHBA</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f8f7;color:#1a3a29;font-family:system-ui,Arial,sans-serif}header{padding:20px 6%;background:white;border-bottom:1px solid #e2e9e3;font-size:24px;font-weight:800}main{max-width:920px;margin:28px auto;padding:0 20px 70px}.card{padding:clamp(20px,4vw,38px);background:#fff;border:1px solid #e2e9e3;border-radius:15px;margin-top:20px}h1{font-size:clamp(24px,4vw,37px)}.company{display:flex;align-items:center;gap:13px;font-weight:700}.mi{display:inline-flex;background:#ff6900;color:white;border-radius:9px;width:48px;height:48px;align-items:center;justify-content:center;font-weight:900}.notice{padding:17px;border:1px solid #eeddb4;background:#fff8e9;border-radius:10px;line-height:1.75;margin:24px 0}.tag{display:inline-block;margin-right:8px;padding:8px 11px;background:#edf4ee;border-radius:7px;color:#51715d}.action{display:inline-block;background:#236c46;color:#fff;text-decoration:none;border-radius:8px;padding:13px 19px}.note{font-size:12px;line-height:1.8;color:#738175}.back{color:#277048;text-decoration:none}.lang{text-align:right}.lang button{padding:8px 14px;margin-left:8px;border:1px solid #c8d9ce;background:white;border-radius:7px;cursor:pointer}.lang button.active{background:#216944;color:#fff}</style></head><body><header>HHBA</header><main><a class="back" href="/" data-zh="← 返回招聘市场" data-en="← Back to job marketplace">← 返回招聘市场</a><div class="card"><div class="lang"><button id="zh" class="active" type="button">中文</button><button id="en" type="button">English</button></div><div class="company"><span class="mi">MI</span><span data-zh="小米集团 · 官方列表观察" data-en="Xiaomi · Official list observation">小米集团 · 官方列表观察</span></div><h1 data-zh="'+title+'" data-en="Original title available in Chinese">'+title+'</h1><span class="tag" data-zh="'+city+'" data-en="Mainland China">'+city+'</span><span class="tag" data-zh="'+esc(kind)+'" data-en="'+esc(j.recruitmentType||"Unknown")+'">'+esc(kind)+'</span><p class="note" data-zh="列表观察于 2026-10-16" data-en="Official listing observed on 2026-10-16">列表观察于 2026-10-16</p><div class="notice" data-zh="'+esc(note)+'" data-en="'+esc(noteEn)+'">'+esc(note)+'</div><a class="action" href="'+url+'" target="_blank" rel="noopener noreferrer nofollow" data-zh="查看小米官方招聘频道 ↗" data-en="Open Xiaomi official recruitment board ↗">查看小米官方招聘频道 ↗</a><p class="note" data-zh="这不是该岗位已验证的直接投递链接。HHBA 与招聘企业不构成已声明的合作关系。" data-en="This is the official recruitment channel, not a verified direct application link. No affiliation is claimed.">这不是该岗位已验证的直接投递链接。HHBA 与招聘企业不构成已声明的合作关系。</p></div></main><script>(function(){function show(l){document.documentElement.lang=l==="en"?"en":"zh-CN";for(const el of document.querySelectorAll("[data-zh][data-en]"))el.textContent=el.dataset[l];for(const x of ["zh","en"])document.getElementById(x).classList.toggle("active",x===l);}for(const x of ["zh","en"])document.getElementById(x).addEventListener("click",()=>{try{localStorage.setItem("hhba-lang",x)}catch{}show(x)});let l="zh";try{l=localStorage.getItem("hhba-lang")==="en"?"en":"zh"}catch{}show(l);})();</script></body></html>';
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
.empty{padding:36px 22px;text-align:center;color:#68776b;background:white;border-radius:12px}.filter-tools{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin:-10px 0 20px;font-size:12px;color:#658070}.filter-clear{border:1px solid #c8d9ce;border-radius:8px;background:#fff;color:#1e6740;cursor:pointer;font:inherit;font-weight:700;padding:8px 14px}.filter-clear:hover{background:#e8f4ed}.filter-clear[hidden]{display:none}.empty .filter-clear{margin-top:15px}
footer{padding:25px;text-align:center;color:#8a9b8f;font-size:11px;border-top:1px solid #e5eae4}
@media(max-width:600px){.hero{padding:50px 22px}nav{padding:16px 22px;gap:10px;flex-wrap:wrap}.job{display:block;padding:17px}.job-main{gap:12px}.company-logo{width:48px;height:48px;flex-basis:48px}.job-title{font-size:16px}.visit{display:inline-flex;margin:15px 0 0 60px}.numbers{gap:23px}}
</style></head><body><nav><div class="logo">HHBA <em id="market-brand">招聘市场</em></div><div id="market-lab" class="lab">真实企业招聘索引 · 公测</div><div class="lang-switch" aria-label="岗位语言"><button id="toggle-zh" type="button">中文</button><button id="toggle-en" type="button">English</button></div></nav><section class="hero"><div class="wrap"><div id="market-kicker" class="eyebrow">全球职业机会 · 企业官方来源</div><h1 id="market-h1">发现全球工作机会</h1><p id="market-subtitle">搜索海外企业公开招聘岗位，在 HHBA 阅读岗位详情，再前往企业官网申请。岗位来自 Greenhouse、Lever、Ashby 的公开招聘接口。</p><div class="numbers"><div class="num"><b id="count">${payload.total}</b><span id="market-count-label">本次获取的岗位</span></div><div class="num"><b>${payload.boards}</b><span id="market-board-label">成功读取的招聘板</span></div><div class="num"><b>1</b><span id="market-source-label">国内企业（列表观察）</span></div><div class="num"><b id="translated-count">—</b><span id="translated-label">已机器翻译职位名称</span></div></div></div></section>
<main><div id="market-status" data-updated="${esc(payload.updated)}" data-failures="${payload.failures}" class="status">默认显示中文岗位名称。术语规则翻译属于初版，未完成的翻译会标注“待翻译”；切换英文可核对官方标题。公测版说明：本次已接入 ${payload.boards} 个企业招聘板，不代表全量全球职位。最近同步：${esc(payload.updated)}。职位是否仍接受申请以企业官网为准。${payload.failures?" 有 "+payload.failures+" 个来源本轮暂不可用。":""}</div>
<div class="filters"><input id="q" aria-label="搜索岗位或企业" placeholder="搜索岗位、公司、地点（支持英文）"><select id="company" aria-label="企业"><option value="">全部企业</option></select><select id="country" aria-label="招聘来源"><option value="">全部来源</option><option value="cn">国内官方</option><option value="global">海外 ATS</option></select><select id="recruitment" aria-label="招聘类型"><option value="">全部招聘类型</option><option value="SOCIAL">社招</option><option value="CAMPUS">校招</option><option value="INTERNSHIP">实习</option></select><select id="remote" aria-label="远程筛选"><option value="">全部工作方式</option><option value="yes">标注远程</option></select></div>
<div class="filter-tools"><span id="filter-summary" aria-live="polite"></span><button type="button" id="clear-filters" class="filter-clear" hidden>清除全部筛选</button></div><div class="section-title"><h2 id="market-list-h2">官方岗位列表</h2><span id="shown"></span></div><div class="list" id="jobs"></div><p id="market-disclaimer" class="disclaimer">数据源为外部企业公开招聘板。部分企业官网在不同网络环境下可能无法访问。岗位发布时间、工作类型、远程标记在接口未披露时不会推断，具体资格要求和投递方式请到企业官网核实。HHBA 不代表与招聘企业存在合作关系。</p></main><footer id="market-footer">HHBA · 全球职位索引 · 仅展示公开岗位资料与官网链接</footer>
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
  ['#market-source-label','国内企业（列表观察）','Domestic employer (observed listing)'],
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
  return '<article class="job"><div class="job-main">'+logoMarkup(x.company)+'<div class="job-body"><a class="job-title" href="'+href+'">'+safe(title)+'</a><div class="company-name">'+safe(company)+'</div><div class="job-meta"><span>'+safe(location)+'</span><span>'+safe(remoteText)+'</span><span>'+(x.domestic?(lang==='zh'?'历史列表 · 投递未核实':'Historical listing · Apply unverified'):(lang==='zh'?'官方招聘来源':'Official employer listing'))+'</span></div><div class="job-source">'+(x.domestic?(lang==='zh'?'小米官方招聘频道 · 2026-10-16':'Xiaomi official board · 2026-10-16'):safe(x.platform.toUpperCase()))+'</div></div></div><a class="visit" href="'+href+'">'+(x.domestic?(lang==='zh'?'查看岗位记录 ↗':'View observed record ↗'):(lang==='zh'?'查看岗位详情 ↗':'View job details ↗'))+'</a></article>';
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
 // An exact employer keyword begins a new company search instead of
 // intersecting with a previously selected, different employer.
 const requestedEmployer=Object.keys(employerBrandSites).find(name=>name.toLowerCase()===query.toLowerCase()||name==='Xiaomi'&&(query==='小米'||query==='小米集团'));
 if(requestedEmployer==='Xiaomi'&&country.value==='global')country.value='';
 if(requestedEmployer&&requestedEmployer!=='Xiaomi'&&country.value==='cn')country.value='';
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
  if(token===latestRequest)
   list.innerHTML='<div class="empty">'+(lang==="zh"?"岗位暂时无法加载，请重试。":"Jobs temporarily unavailable. Please retry.")+'</div>';
 }
}
function start(){
 try{
  const parms=new URLSearchParams(window.location.search),urlQuery=parms.get('q');
  if(urlQuery)q.value=urlQuery.slice(0,100);
  if(['cn','global'].includes(parms.get('country')))country.value=parms.get('country');
  if(['SOCIAL','CAMPUS','INTERNSHIP'].includes(parms.get('recruitment_type')))recruitment.value=parms.get('recruitment_type');
 }catch{}
 setLanguage(lang);
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
country.addEventListener("change",()=>{if(country.value==="cn"&&c.value&&c.value!=="Xiaomi")c.value="";if(country.value==="global"&&c.value==="Xiaomi")c.value="";void fetchJobs(true)});
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
  const categories={machine:0,rules:0,pending:0,original:0};
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
   const fields=[j.title,j.company,j.domestic?"小米集团":companyZh[j.company]||"",j.location,translateLocation(j.location),present(j).titleZh];
   return fields.some(v=>String(v||"").toLowerCase().includes(q))||
     related.some(t=>j.title.toLowerCase().includes(t));
  });
  const names=[...new Set(rows.map(j=>j.company))].sort((a,b)=>a.localeCompare(b));
  const companies=offset===0?names.map(name=>({name,zh:companyZh[name]||name})):[];
  const machineCount=offset===0?rows.reduce((n,j)=>n+(fromCache("title",j.title)?.mode==="machine"?1:0),0):null;
  return Response.json({
    jobs:filtered.slice(offset,offset+limit).map(present),total:filtered.length,
    allJobs:rows.length,limit,offset,companies,machineCount,
    boards:data?.boards||0,domesticObserved:domesticObserved.length,domesticEmployers:1,failures:data?.failures||0,updated:data?.updated||""
  },{headers});
 }
 if(u.pathname==="/api/jobs"){const data=await load();if(data?.rows)void fillTitleTranslations(data.rows);return Response.json({jobs:(data?.rows||[]).map(present),total:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||"",persistentCache:!!translationDb,translationEngine:privateTranslatorUrl()?"libretranslate-private":"unconfigured"},{headers});}

 if(u.pathname.startsWith("/jobs/")||u.pathname.startsWith("/api/jobs/")){
  const nativeId=decodeURIComponent(u.pathname.split("/").pop()||"");
  if(nativeId.length>180||!/^[A-Za-z0-9_-]+$/.test(nativeId))
   return new Response("Not found",{status:404,headers});
  const market=await load(),job=market?.rows.find(x=>x.id===nativeId);
  if(!job)return new Response("该岗位不在当前官方公开列表中",{status:404,headers});
  if(job.domestic){
   if(u.pathname.startsWith("/api/"))return Response.json({job:present(job),description:null,richHtml:null,applyUrl:null,recordKind:"OFFICIAL_LIST_OBSERVED",currentApplicationVerified:false,detailVerified:false,officialListUrl:job.url,observedAt:job.observedAt},{headers});
   return new Response(domesticDetailHtml(job),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
  }
  const result=await officialDetail(job);
  if(!result)return new Response("官方职位详情暂不可用，请从招聘列表进入企业官网",{status:503,headers});
  if(u.pathname.startsWith("/api/"))return Response.json(result,{headers});
  const zhJd=await translatedDetail(result);
  return new Response(detailHtml(result,zhJd),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
 }

 if(u.pathname!=="/")return new Response("Not found",{status:404,headers});
 const data=await load();return new Response(page({total:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,updated:data?.updated||""}),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
}});


// Source health is verified in GitHub Actions; avoid repeating expensive
// startup probes and multi-part translation jobs on each Railway restart.
void load().then(data=>console.log("HHBA_SOURCE_SYNC",JSON.stringify({jobs:data?.rows.length||0,boards:data?.boards||0,failures:data?.failures||0,domesticObserved:domesticObserved.length})))
.catch(e=>console.error("HHBA_SOURCE_STARTUP_ERROR",e instanceof Error?e.name:"unknown"));
