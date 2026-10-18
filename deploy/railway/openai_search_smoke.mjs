const base=process.env.HHBA_PREVIEW_URL||"https://hhba-live-jobs-preview-production.up.railway.app";
const fetchJson=async(path)=>{let error;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(base+path,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error("HTTP_"+r.status);return await r.json();}catch(e){error=e;if(attempt<2)await new Promise(r=>setTimeout(r,1800));}}throw error;};
const all=await fetchJson("/api/jobs/page?limit=1");
const results=[];
for(const label of ["openai","OpenAI","OPENAI"]){
 const data=await fetchJson("/api/jobs/page?q="+encodeURIComponent(label)+"&limit=3");
 const correct=Array.isArray(data.jobs)&&data.total>0&&data.jobs.every(x=>x.company==="OpenAI");
 results.push({query:label,total:data.total,returned:data.jobs?.length,allOpenAI:correct});
 if(!correct)throw Error("OpenAI text search failed: "+JSON.stringify(results.at(-1)));
}
const filtered=await fetchJson("/api/jobs/page?company=OpenAI&limit=3");
if(!filtered.total||!filtered.jobs.every(x=>x.company==="OpenAI"))throw Error("Company select OpenAI failed "+JSON.stringify({total:filtered.total}));
const one=filtered.jobs[0];
const detail=await fetchJson("/api/jobs/"+encodeURIComponent(one.id));
if(detail.job?.company!=="OpenAI"||detail.job?.id!==one.id||typeof detail.description!=="string"||detail.description.length<100)throw Error("OpenAI detail or original JD missing");
const page=await fetch(base+"/",{signal:AbortSignal.timeout(30000)});
const html=await page.text();
if(!page.ok||!html.includes('id="q"')||!html.includes('id="company"')||!html.includes("logoMarkup(x.company)"))throw Error("Search page or new logo-card template missing");
console.log("HHBA_OPENAI_SEARCH_SMOKE",JSON.stringify({allJobs:all.allJobs,connectedBoards:all.boards,queries:results,companyFilterTotal:filtered.total,originalJdChars:detail.description.length,firstDetailId:one.id,frontendTemplate:"present",status:"PASS"}));
