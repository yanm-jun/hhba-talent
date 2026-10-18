import {mkdir,writeFile} from "node:fs/promises";
const candidates=[{"platform":"greenhouse","company":"Oklo","slug":"oklo","industry":"energy"},{"platform":"greenhouse","company":"Openwork","slug":"openwork","industry":"staffing"},{"platform":"greenhouse","company":"Algolia","slug":"algolia","industry":"software"},{"platform":"greenhouse","company":"Intercom","slug":"intercom","industry":"software"},{"platform":"greenhouse","company":"MongoDB","slug":"mongodb","industry":"software"},{"platform":"greenhouse","company":"SoFi","slug":"sofi","industry":"finance"},{"platform":"greenhouse","company":"Zillow","slug":"zillow","industry":"real-estate"},{"platform":"greenhouse","company":"Smartsheet","slug":"smartsheet","industry":"software"},{"platform":"greenhouse","company":"SpaceX","slug":"spacex","industry":"aerospace"},{"platform":"greenhouse","company":"Relativity Space","slug":"relativityspace","industry":"aerospace"},{"platform":"greenhouse","company":"Astranis","slug":"astranis","industry":"hardware"},{"platform":"greenhouse","company":"Planet Labs","slug":"planetlabs","industry":"aerospace"},{"platform":"greenhouse","company":"Rocket Lab","slug":"rocketlab","industry":"aerospace"},{"platform":"greenhouse","company":"Skydio","slug":"skydio","industry":"robotics"},{"platform":"greenhouse","company":"Shield AI","slug":"shieldai","industry":"robotics"},{"platform":"greenhouse","company":"Bloom Energy","slug":"bloomenergy","industry":"energy"},{"platform":"greenhouse","company":"Form Energy","slug":"formenergy","industry":"energy"},{"platform":"greenhouse","company":"Redwood Materials","slug":"redwoodmaterials","industry":"manufacturing"},{"platform":"greenhouse","company":"Zipline","slug":"zipline","industry":"logistics"},{"platform":"greenhouse","company":"Aurora","slug":"aurora","industry":"mobility"},{"platform":"greenhouse","company":"Rivian","slug":"rivian","industry":"automotive"},{"platform":"greenhouse","company":"Datadog","slug":"datadog","industry":"cloud"},{"platform":"greenhouse","company":"Fivetran","slug":"fivetran","industry":"data"},{"platform":"greenhouse","company":"Confluent","slug":"confluent","industry":"data"},{"platform":"greenhouse","company":"Applied Intuition","slug":"appliedintuition","industry":"mobility"},{"platform":"greenhouse","company":"Pinterest","slug":"pinterest","industry":"media"},{"platform":"greenhouse","company":"Lyft","slug":"lyft","industry":"mobility"},{"platform":"greenhouse","company":"HubSpot","slug":"hubspot","industry":"marketing"},{"platform":"greenhouse","company":"Lattice","slug":"lattice","industry":"hr"},{"platform":"greenhouse","company":"Allbirds","slug":"allbirds","industry":"retail"},{"platform":"greenhouse","company":"Toast","slug":"toast","industry":"food"},{"platform":"greenhouse","company":"Etsy","slug":"etsy","industry":"retail"},{"platform":"greenhouse","company":"Opendoor","slug":"opendoor","industry":"real-estate"},{"platform":"greenhouse","company":"Sweetgreen","slug":"sweetgreen","industry":"food"},{"platform":"greenhouse","company":"Health Catalyst","slug":"healthcatalyst","industry":"healthcare"},{"platform":"greenhouse","company":"Lemonade","slug":"lemonade","industry":"insurance"},{"platform":"greenhouse","company":"Astra","slug":"astra","industry":"aerospace"},{"platform":"greenhouse","company":"Nuro","slug":"nuro","industry":"mobility"},{"platform":"greenhouse","company":"Verkada","slug":"verkada","industry":"security"},{"platform":"greenhouse","company":"Oura","slug":"oura","industry":"healthcare"},{"platform":"greenhouse","company":"Whoop","slug":"whoop","industry":"fitness"},{"platform":"greenhouse","company":"Niantic","slug":"niantic","industry":"gaming"},{"platform":"ashby","company":"Tonal","slug":"tonal","industry":"fitness"},{"platform":"ashby","company":"Turquoise Health","slug":"turquoise-health","industry":"healthcare"},{"platform":"ashby","company":"Clasp","slug":"clasp-group","industry":"education"},{"platform":"ashby","company":"Innatera","slug":"innatera","industry":"hardware"},{"platform":"ashby","company":"Mistral AI","slug":"mistral.ai","industry":"ai"},{"platform":"ashby","company":"Fuel Cycle","slug":"fuel-cycle","industry":"research"},{"platform":"ashby","company":"Domera Labs","slug":"domera-labs","industry":"consumer"},{"platform":"ashby","company":"Rula","slug":"rula","industry":"healthcare"},{"platform":"ashby","company":"Instawork","slug":"instawork","industry":"staffing"},{"platform":"ashby","company":"Hightouch","slug":"hightouch","industry":"data"},{"platform":"ashby","company":"Modal","slug":"modal","industry":"cloud"},{"platform":"ashby","company":"Together AI","slug":"together-ai","industry":"ai"},{"platform":"ashby","company":"Baseten","slug":"baseten","industry":"ai"},{"platform":"ashby","company":"Lightricks","slug":"lightricks","industry":"media"},{"platform":"ashby","company":"Runway","slug":"runway","industry":"media"},{"platform":"ashby","company":"Pika","slug":"pika","industry":"media"},{"platform":"ashby","company":"Fal","slug":"fal","industry":"cloud"},{"platform":"ashby","company":"Calendly","slug":"calendly","industry":"productivity"},{"platform":"ashby","company":"Sentry","slug":"sentry","industry":"software"},{"platform":"ashby","company":"Supabase","slug":"supabase","industry":"cloud"},{"platform":"ashby","company":"Resend","slug":"resend","industry":"communications"},{"platform":"ashby","company":"Convex","slug":"convex","industry":"software"},{"platform":"ashby","company":"Pinecone","slug":"pinecone","industry":"database"},{"platform":"ashby","company":"Redpanda","slug":"redpanda","industry":"database"},{"platform":"ashby","company":"Maven","slug":"maven","industry":"education"},{"platform":"ashby","company":"Modern Health","slug":"modernhealth","industry":"healthcare"},{"platform":"ashby","company":"Abridge","slug":"abridge","industry":"healthcare"},{"platform":"ashby","company":"Bilt","slug":"bilt","industry":"fintech"},{"platform":"ashby","company":"Function Health","slug":"functionhealth","industry":"healthcare"},{"platform":"ashby","company":"Hims & Hers","slug":"hims","industry":"healthcare"},{"platform":"ashby","company":"Newfront","slug":"newfront","industry":"insurance"},{"platform":"lever","company":"Ninja Van","slug":"ninjavan","industry":"logistics"},{"platform":"lever","company":"IRCA Group","slug":"ircagroup","industry":"food-manufacturing"},{"platform":"lever","company":"Kpler","slug":"kpler","industry":"maritime"},{"platform":"lever","company":"GoGoX","slug":"gogox","industry":"logistics"},{"platform":"lever","company":"Geotab","slug":"geotab","industry":"automotive"},{"platform":"lever","company":"Equinix","slug":"equinix","industry":"datacenters"},{"platform":"lever","company":"Grab","slug":"grab","industry":"mobility"},{"platform":"lever","company":"Gojek","slug":"gojek","industry":"mobility"},{"platform":"lever","company":"AirAsia","slug":"airasia","industry":"aviation"},{"platform":"lever","company":"Carousell","slug":"carousell","industry":"retail"},{"platform":"lever","company":"PropertyGuru","slug":"propertyguru","industry":"real-estate"},{"platform":"lever","company":"Agoda","slug":"agoda","industry":"travel"},{"platform":"lever","company":"Deliveroo","slug":"deliveroo","industry":"food"},{"platform":"lever","company":"Weee!","slug":"weee","industry":"grocery"},{"platform":"lever","company":"Cartus","slug":"cartus","industry":"relocation"},{"platform":"lever","company":"Lalamove","slug":"lalamove","industry":"logistics"},{"platform":"lever","company":"Remitly","slug":"remitly","industry":"finance"},{"platform":"lever","company":"Klook","slug":"klook","industry":"travel"},{"platform":"lever","company":"Thoughtworks","slug":"thoughtworks","industry":"consulting"},{"platform":"lever","company":"Lucid Motors","slug":"lucidmotors","industry":"automotive"}];
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
 console.log("HHBA_WAVE2_PROBE",JSON.stringify({slug:item.slug,company:item.company,platform:item.platform,status:item.status,jobs:item.validJobs||0,detail:item.detailStatus||item.reason}));}}
await Promise.all(Array.from({length:5},()=>worker()));
const accepted=out.filter(x=>x.status==="VERIFIED");
const total=accepted.reduce((n,x)=>n+(x.validJobs||0),0);
await mkdir("board-candidates-wave2",{recursive:true});
await writeFile("board-candidates-wave2/probe.json",JSON.stringify({generated:new Date().toISOString(),candidates:out,verified:accepted.length,total},null,2));
await writeFile("board-candidates-wave2/verified.json",JSON.stringify(accepted,null,2));
console.log("HHBA_WAVE2_PROBE_SUMMARY",JSON.stringify({tested:out.length,verified:accepted.length,needsReview:out.filter(x=>x.status==="REVIEW").length,failed:out.filter(x=>x.status==="FAIL").length,verifiedJobs:total,byPlatform:Object.fromEntries(["greenhouse","ashby","lever"].map(p=>[p,accepted.filter(x=>x.platform===p).length]))}));
