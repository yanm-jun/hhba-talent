import {mkdir,writeFile} from 'node:fs/promises';
const BASE='https://hhba-live-jobs-preview-production.up.railway.app';
const companies=['Figma','Flexport','Coursera','OpenAI','Headway','Binance'];
async function get(url,opts={}){
 for(let trial=0;trial<2;trial++){
  try{
   const r=await fetch(url,{...opts,signal:AbortSignal.timeout(80000)});
   let data=null;
   if(r.headers.get('content-type')?.includes('application/json'))data=await r.json();
   else data=await r.text();
   if([429,502,503].includes(r.status)&&trial===0)continue;
   return {status:r.status,data};
  }catch(e){if(trial)return {status:0,error:e.name};}
 }
}
const catalog=await get(BASE+'/api/jobs');
if(catalog.status!==200||!Array.isArray(catalog.data?.jobs))throw Error('Catalog unavailable');
const records=catalog.data.jobs;
const results=[];
for(const company of companies){
 const options=records.filter(x=>x.company===company);
 const job=options.find(x=>/manager|scientist|analyst|engineer|therapist|specialist|designer|counsel|finance|sales/i.test(x.title))||options[0];
 const result={company,found:options.length,jobId:job?.id||null,source:job?.platform};
 if(!job){result.error='job_not_found';results.push(result);continue;}
 const page=await get(BASE+'/jobs/'+encodeURIComponent(job.id));
 if(page.status!==200||typeof page.data!=='string'){result.error='detail_http_'+page.status;results.push(result);continue;}
 const html=page.data;
 const marker='id="personal-reader" data-job="'+job.id+'" data-hash="';
 const i=html.indexOf(marker);
 if(i<0){result.error='chinese_reader_missing';results.push(result);continue;}
 const hash=html.slice(i+marker.length,i+marker.length+64);
 if(!/^[a-f0-9]{64}$/.test(hash)){result.error='invalid_hash';results.push(result);continue;}
 const original=await get(BASE+'/api/jobs/'+encodeURIComponent(job.id));
 if(original.status!==200||original.data.job?.url!==job.url||original.data.job?.title!==job.title){
  result.error='official_identity_mismatch';results.push(result);continue;
 }
 result.originalCharacters=String(original.data.description||'').length;
 const translation=await get(BASE+'/api/jobs/'+encodeURIComponent(job.id)+'/translate-part',{
  method:'POST',headers:{'Content-Type':'application/json',Origin:BASE},
  body:JSON.stringify({part:0,sourceHash:hash})
 });
 const data=translation.data;
 if(translation.status!==200||data?.jobId!==job.id||data?.sourceHash!==hash||data?.part!==0||
    typeof data.text!=='string'||!/[\u3400-\u9fff]/.test(data.text)){
  result.error='translation_http_'+translation.status+'_'+String(data?.error||translation.error||'missing');
 }else{
  result.translatedCharacters=data.text.length;result.parts=data.total;result.status='PASS';
 }
 results.push(result);
 console.log('HHBA_NEW_COMPANY_JD',JSON.stringify(result));
}
const passed=results.filter(x=>x.status==='PASS').length;
console.log('HHBA_NEW_COMPANY_JD_SUMMARY',JSON.stringify({tested:companies.length,passed,failed:companies.length-passed}));
await mkdir('new-company-jd',{recursive:true});
await writeFile('new-company-jd/samples.json',JSON.stringify({companies:results,at:new Date().toISOString()},null,2));
if(passed!==companies.length)process.exitCode=1;
