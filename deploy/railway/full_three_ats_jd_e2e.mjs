import {mkdir,writeFile} from 'node:fs/promises';
const BASE='https://hhba-live-jobs-preview-production.up.railway.app';
async function json(url,options={}){
 for(let attempt=0;attempt<3;attempt++){
  const res=await fetch(url,{...options,signal:AbortSignal.timeout(95000)});
  if([429,502,503,504].includes(res.status)&&attempt<2){
   await new Promise(ok=>setTimeout(ok,3000*(attempt+1)));continue;
  }
  let body=null;try{body=await res.json()}catch{}
  return {status:res.status,body};
 }
}
function assert(cond,message){if(!cond)throw Error(message)}
async function run(){
 const listing=await json(BASE+'/api/jobs');
 assert(listing.status===200&&Array.isArray(listing.body?.jobs),'official HHBA catalog unavailable');
 const jobs=listing.body.jobs;
 const chosen={
  greenhouse:jobs.find(j=>j.platform==='greenhouse'&&j.source==='canonical'),
  greenhouse_board:jobs.find(j=>j.platform==='greenhouse'&&j.source==='greenhouse'),
  ashby:jobs.find(j=>j.platform==='ashby'&&j.source==='airwallex'&&j.title.includes('Staff Data Scientist')),
  ashby_board:jobs.find(j=>j.platform==='ashby'&&j.source==='ashby'),
  lever:jobs.find(j=>j.platform==='lever'&&j.source==='palantir'),
  lever_spotify:jobs.find(j=>j.platform==='lever'&&j.source==='spotify')
 };
 const outputs=[];
 const requiredBoards=Object.keys(chosen).length;
 for(const [platform,job]of Object.entries(chosen)){
  assert(job,'no current verified real job for '+platform);
  const r=await fetch(BASE+'/jobs/'+encodeURIComponent(job.id),{signal:AbortSignal.timeout(24000)});
  assert(r.ok,'detail page failed '+platform+' HTTP '+r.status);
  const html=await r.text();
  const match=html.match(new RegExp('id="personal-reader" data-job="'+job.id+'" data-hash="([a-f0-9]{64})"'));
  assert(match,'missing ID-bound translation reader '+platform);
  const sourceHash=match[1],results=[];
  let part=0,total=1,failed=null;
  while(part<total){
   const response=await json(BASE+'/api/jobs/'+encodeURIComponent(job.id)+'/translate-part',{
    method:'POST',headers:{'Content-Type':'application/json',Origin:BASE},
    body:JSON.stringify({part,sourceHash})
   });
   const body=response.body;
   if(response.status!==200||body?.jobId!==job.id||body?.part!==part||
      body?.sourceHash!==sourceHash||!Number.isInteger(body?.total)||
      body.total<1||body.total>80||typeof body.text!=='string'){
    failed={index:part,http:response.status,reason:body?.error||'bad_identity'};
    break;
   }
   if(part===0)total=body.total;
   if(body.total!==total){failed={index:part,reason:'source_version_changed'};break;}
   if(!body.text.trim()){failed={index:part,reason:'blank_translated_segment'};break;}
   if(!/[\u3400-\u9fff]/.test(body.text)){failed={index:part,reason:'no_chinese_in_translation'};break;}
   const suspicious=(body.text.match(/(?:[A-Za-z]{3,}[ \t]+){7,}[A-Za-z]{3,}/g)||[]);
   results.push({len:body.text.length,numericReview:body.numbersVerified===false,
     englishWordRuns:suspicious.length,
     englishHeadings:(body.text.match(/(?:^|\n)\s*(?:Responsibilities|Requirements|Qualifications|Benefits|About the role|What you will do)\s*:?(?=\n|$)/gmi)||[]).length});
   part++;
  }
  const record={platform,jobId:job.id,segmentsExpected:total,
   segmentsCompleted:results.length,complete:!failed&&results.length===total,
   totalTranslatedChars:results.reduce((acc,x)=>acc+x.len,0),
   numbersNeedComparison:results.filter(x=>x.numericReview).length,
   englishWordRuns:results.reduce((acc,x)=>acc+x.englishWordRuns,0),
   englishHeadings:results.reduce((acc,x)=>acc+x.englishHeadings,0),
   error:failed};
  outputs.push(record);
  console.log('HHBA_COMPLETE_JD_BY_PLATFORM',JSON.stringify(record));
 }
 await mkdir('three-ats-translation',{recursive:true});
 await writeFile('three-ats-translation/results.json',JSON.stringify({jobs:jobs.length,outputs},null,2));
 const failed=outputs.filter(x=>!x.complete||x.englishWordRuns>0||x.englishHeadings>0);
 console.log('HHBA_COMPLETE_JD_ALL',JSON.stringify({tested:outputs.length,passed:outputs.length-failed.length,failed:failed.length}));
 if(failed.length||outputs.length!==requiredBoards)process.exitCode=1;
}
run().catch(e=>{console.error('HHBA_COMPLETE_JD_FATAL',e.message);process.exitCode=1});
