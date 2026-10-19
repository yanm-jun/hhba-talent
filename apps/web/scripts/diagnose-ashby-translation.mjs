import {createHash} from 'node:crypto';
const base='https://hhba-web-production-024c.up.railway.app';
const job='ashby-deepgram-a6c59ee7-4d92-423c-a6e6-99adcd9e6ff3';
const detail=await fetch(base+'/api/jobs/'+job,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});
if(!detail.ok)throw Error('OFFICIAL_DETAIL_'+detail.status);
const body=await detail.json();
if(body.job?.id!==job||typeof body.description!=='string'||body.description.length<100)throw Error('OFFICIAL_JD_MISSING');
const sourceHash=createHash('sha256').update(body.description).digest('hex');
for(const part of [0,1]){
 const response=await fetch(base+'/api/jobs/'+job+'/translate-part',{
  method:'POST',headers:{Origin:'https://yanm-jun.github.io','Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify({part,sourceHash}),signal:AbortSignal.timeout(85000)
 });
 const result=await response.json().catch(()=>({error:'NON_JSON'}));
 console.log('ASHBY_JD_TRANSLATION_DIAGNOSTIC',JSON.stringify({
  platform:'ashby',jobId:job,part,http:response.status,error:result.error||null,
  total:result.total||null,numbersVerified:result.numbersVerified||false,
  textCharacters:typeof result.text==='string'?result.text.length:0,
  sourceCharacters:body.description.length
 }));
 if(response.status!==200)break;
}
