import {mkdir,writeFile} from "node:fs/promises";
const candidates=[{"platform":"greenhouse","company":"Stripe","slug":"stripe","industry":"fintech"},{"platform":"greenhouse","company":"Figma","slug":"figma","industry":"design"},{"platform":"greenhouse","company":"Duolingo","slug":"duolingo","industry":"education"},{"platform":"greenhouse","company":"Warby Parker","slug":"warbyparker","industry":"retail"},{"platform":"greenhouse","company":"Anduril","slug":"andurilindustries","industry":"manufacturing"},{"platform":"greenhouse","company":"DoorDash","slug":"doordash","industry":"logistics"},{"platform":"greenhouse","company":"Samsara","slug":"samsara","industry":"industrial"},{"platform":"greenhouse","company":"Databricks","slug":"databricks","industry":"data"},{"platform":"greenhouse","company":"Reddit","slug":"reddit","industry":"community"},{"platform":"greenhouse","company":"Discord","slug":"discord","industry":"media"},{"platform":"greenhouse","company":"Robinhood","slug":"robinhood","industry":"finance"},{"platform":"greenhouse","company":"Coinbase","slug":"coinbase","industry":"finance"},{"platform":"greenhouse","company":"Asana","slug":"asana","industry":"software"},{"platform":"greenhouse","company":"Airtable","slug":"airtable","industry":"software"},{"platform":"greenhouse","company":"Instacart","slug":"instacart","industry":"grocery"},{"platform":"greenhouse","company":"Flexport","slug":"flexport","industry":"logistics"},{"platform":"greenhouse","company":"Block","slug":"block","industry":"fintech"},{"platform":"greenhouse","company":"Rippling","slug":"rippling","industry":"hr"},{"platform":"greenhouse","company":"GitLab","slug":"gitlab","industry":"software"},{"platform":"greenhouse","company":"Cloudflare","slug":"cloudflare","industry":"cloud"},{"platform":"greenhouse","company":"Okta","slug":"okta","industry":"security"},{"platform":"greenhouse","company":"Elastic","slug":"elastic","industry":"cloud"},{"platform":"greenhouse","company":"Twilio","slug":"twilio","industry":"communications"},{"platform":"greenhouse","company":"Zoom","slug":"zoom","industry":"communications"},{"platform":"greenhouse","company":"Grammarly","slug":"grammarly","industry":"education"},{"platform":"greenhouse","company":"Brex","slug":"brex","industry":"fintech"},{"platform":"greenhouse","company":"Vercel","slug":"vercel","industry":"cloud"},{"platform":"greenhouse","company":"Snyk","slug":"snyk","industry":"security"},{"platform":"greenhouse","company":"Waymo","slug":"waymo","industry":"mobility"},{"platform":"greenhouse","company":"Cruise","slug":"cruise","industry":"mobility"},{"platform":"greenhouse","company":"Zoox","slug":"zoox","industry":"mobility"},{"platform":"greenhouse","company":"Hinge Health","slug":"hingehealth","industry":"healthcare"},{"platform":"greenhouse","company":"Oscar Health","slug":"oscarhealth","industry":"healthcare"},{"platform":"greenhouse","company":"Gusto","slug":"gusto","industry":"hr"},{"platform":"greenhouse","company":"Plaid","slug":"plaid","industry":"fintech"},{"platform":"greenhouse","company":"Wise","slug":"wise","industry":"finance"},{"platform":"greenhouse","company":"Fullstory","slug":"fullstory","industry":"software"},{"platform":"greenhouse","company":"Cockroach Labs","slug":"cockroachlabs","industry":"cloud"},{"platform":"greenhouse","company":"HashiCorp","slug":"hashicorp","industry":"software"},{"platform":"greenhouse","company":"Benchling","slug":"benchling","industry":"bio"},{"platform":"greenhouse","company":"Spring Health","slug":"springhealth","industry":"healthcare"},{"platform":"greenhouse","company":"Talkspace","slug":"talkspace","industry":"healthcare"},{"platform":"greenhouse","company":"Axiom","slug":"axiom","industry":"legal"},{"platform":"greenhouse","company":"Webflow","slug":"webflow","industry":"design"},{"platform":"greenhouse","company":"Coursera","slug":"coursera","industry":"education"},{"platform":"greenhouse","company":"Hugging Face","slug":"huggingface","industry":"ai"},{"platform":"greenhouse","company":"Nuro","slug":"nuro","industry":"mobility"},{"platform":"ashby","company":"OpenAI","slug":"openai","industry":"ai"},{"platform":"ashby","company":"Notion","slug":"notion","industry":"software"},{"platform":"ashby","company":"Ramp","slug":"ramp","industry":"fintech"},{"platform":"ashby","company":"Mercury","slug":"mercury","industry":"fintech"},{"platform":"ashby","company":"Linear","slug":"linear","industry":"software"},{"platform":"ashby","company":"Perplexity","slug":"perplexity","industry":"ai"},{"platform":"ashby","company":"Retool","slug":"retool","industry":"software"},{"platform":"ashby","company":"ElevenLabs","slug":"elevenlabs","industry":"audio"},{"platform":"ashby","company":"Cursor","slug":"anysphere","industry":"ai"},{"platform":"ashby","company":"Anthropic","slug":"anthropic","industry":"ai"},{"platform":"ashby","company":"Replit","slug":"replit","industry":"software"},{"platform":"ashby","company":"Cognition","slug":"cognition","industry":"ai"},{"platform":"ashby","company":"Vanta","slug":"vanta","industry":"security"},{"platform":"ashby","company":"PostHog","slug":"posthog","industry":"data"},{"platform":"ashby","company":"Deel","slug":"deel","industry":"hr"},{"platform":"ashby","company":"Remote","slug":"remote","industry":"hr"},{"platform":"ashby","company":"Harvey","slug":"harvey","industry":"legal"},{"platform":"ashby","company":"Glean","slug":"glean","industry":"software"},{"platform":"ashby","company":"ClickUp","slug":"clickup","industry":"software"},{"platform":"ashby","company":"Chime","slug":"chime","industry":"finance"},{"platform":"ashby","company":"Scale AI","slug":"scaleai","industry":"ai"},{"platform":"ashby","company":"Revolut","slug":"revolut","industry":"finance"},{"platform":"ashby","company":"Luma AI","slug":"luma","industry":"ai"},{"platform":"ashby","company":"Windsurf","slug":"windsurf","industry":"ai"},{"platform":"ashby","company":"Headway","slug":"headway","industry":"education"},{"platform":"lever","company":"Netflix","slug":"netflix","industry":"media"},{"platform":"lever","company":"Canva","slug":"canva","industry":"design"},{"platform":"lever","company":"Affirm","slug":"affirm","industry":"finance"},{"platform":"lever","company":"Binance","slug":"binance","industry":"finance"},{"platform":"lever","company":"BitGo","slug":"bitgo","industry":"fintech"},{"platform":"lever","company":"Kraken","slug":"kraken","industry":"finance"},{"platform":"lever","company":"Postman","slug":"postman","industry":"software"},{"platform":"lever","company":"Atlassian","slug":"atlassian","industry":"software"},{"platform":"lever","company":"Unity","slug":"unity","industry":"gaming"},{"platform":"lever","company":"Yelp","slug":"yelp","industry":"services"},{"platform":"lever","company":"Nuro","slug":"nuro","industry":"mobility"},{"platform":"lever","company":"Ripple","slug":"ripple","industry":"fintech"},{"platform":"lever","company":"Lalamove","slug":"lalamove","industry":"logistics"},{"platform":"lever","company":"Zomato","slug":"zomato","industry":"food"},{"platform":"lever","company":"Miro","slug":"miro","industry":"design"},{"platform":"lever","company":"Mixpanel","slug":"mixpanel","industry":"data"},{"platform":"lever","company":"Twitch","slug":"twitch","industry":"media"},{"platform":"lever","company":"Braze","slug":"braze","industry":"marketing"},{"platform":"lever","company":"Supercell","slug":"supercell","industry":"gaming"},{"platform":"lever","company":"AppLovin","slug":"applovin","industry":"advertising"},{"platform":"lever","company":"Nielsen","slug":"nielsen","industry":"media"}];
const BASE="https://hhba-live-jobs-preview-production.up.railway.app";
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
function boardUrl(b){return b.platform==="greenhouse"?"https://boards-api.greenhouse.io/v1/boards/"+b.slug+"/jobs":
 b.platform==="ashby"?"https://api.ashbyhq.com/posting-api/job-board/"+b.slug:
 "https://api.lever.co/v0/postings/"+b.slug+"?mode=json";}
function validUrl(x,b){
 try{const u=new URL(x);const allowed=b.platform==="ashby"?["jobs.ashbyhq.com"]:
 b.platform==="lever"?["jobs.lever.co","jobs.eu.lever.co"]:
 ["boards.greenhouse.io","job-boards.greenhouse.io","boards.eu.greenhouse.io"];
 return u.protocol==="https:"&&allowed.includes(u.hostname)&&u.pathname.split("/").includes(b.slug)}
 catch{return false;}
}
function normalize(b,x){
 if(!x||x.isListed===false)return null;
 const id=x.id;
 const title=b.platform==="lever"?x.text:x.title;
 const url=b.platform==="lever"?x.hostedUrl:b.platform==="ashby"?x.jobUrl:x.absolute_url;
 return id&&typeof title==="string"&&validUrl(url,b)?{id,title,url}:null;
}
async function request(url,retries=2){
 for(let i=0;i<retries;i++){
  try{const r=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"HHBA-ATS-board-verification/0.3"},
   signal:AbortSignal.timeout(22000),redirect:"error"});
   if(!r.ok){if((r.status===429||r.status>=500)&&i+1<retries){await delay(900);continue;}return {error:"HTTP "+r.status};}
   if(Number(r.headers.get("content-length")||0)>18000000)return {error:"response_too_large"};
   return {data:await r.json()};
  }catch(e){if(i+1===retries)return {error:e.name||"request_error"};await delay(700);}
 }
 return {error:"unknown"};
}
async function probe(b){
 const fetched=await request(boardUrl(b));
 if(!fetched.data)return {...b,status:"FAIL",reason:fetched.error};
 const raw=Array.isArray(fetched.data)?fetched.data:fetched.data.jobs;
 if(!Array.isArray(raw))return {...b,status:"FAIL",reason:"invalid_json_jobs"};
 const normalized=raw.map(x=>normalize(b,x)).filter(Boolean);
 if(!normalized.length)return {...b,status:"FAIL",reason:"no_valid_public_jobs",rawCount:raw.length};
 const item=normalized[0];
 let detailStatus="not_checked",detailChars=0;
 if(b.platform==="greenhouse"||b.platform==="lever"){
  const url=b.platform==="greenhouse"?
    boardUrl(b)+"/"+encodeURIComponent(String(item.id))+"?content=true":
    "https://api.lever.co/v0/postings/"+b.slug+"/"+encodeURIComponent(String(item.id))+"?mode=json";
  const d=await request(url,1);
  if(d.data&&String(d.data.id)===String(item.id)){
   const value=b.platform==="greenhouse"?d.data.content:(d.data.description||d.data.descriptionPlain||"");
   detailChars=typeof value==="string"?value.length:0;
   detailStatus=detailChars>100?"PASS":"SHORT";
  }else detailStatus=d.error||"not_found";
 }else{
  const x=raw.find(x=>String(x?.id)===String(item.id));
  const text=x?.descriptionPlain||x?.descriptionHtml||"";
  detailChars=typeof text==="string"?text.length:0;
  detailStatus=detailChars>100?"PASS":"SHORT";
 }
 const count=normalized.length;
 return {...b,status:detailStatus==="PASS"?"VERIFIED":"REVIEW",validJobs:count,
  firstJob:{id:item.id,title:item.title.slice(0,90),url:item.url},
  detailStatus,detailChars,api:boardUrl(b)};
}
const out=[];
let offset=0;
async function worker(){while(offset<candidates.length){const i=offset++;const item=await probe(candidates[i]);out[i]=item;
 console.log("HHBA_BOARD_PROBE",JSON.stringify({slug:item.slug,company:item.company,platform:item.platform,status:item.status,jobs:item.validJobs||0,detail:item.detailStatus||item.reason}));}}
await Promise.all(Array.from({length:5},()=>worker()));
const accepted=out.filter(x=>x.status==="VERIFIED");
const total=accepted.reduce((n,x)=>n+(x.validJobs||0),0);
await mkdir("board-candidates",{recursive:true});
await writeFile("board-candidates/probe.json",JSON.stringify({generated:new Date().toISOString(),candidates:out,verified:accepted.length,total},null,2));
await writeFile("board-candidates/verified.json",JSON.stringify(accepted,null,2));
console.log("HHBA_BOARD_PROBE_SUMMARY",JSON.stringify({tested:out.length,verified:accepted.length,needsReview:out.filter(x=>x.status==="REVIEW").length,failed:out.filter(x=>x.status==="FAIL").length,verifiedJobs:total,byPlatform:Object.fromEntries(["greenhouse","ashby","lever"].map(p=>[p,accepted.filter(x=>x.platform===p).length]))}));
