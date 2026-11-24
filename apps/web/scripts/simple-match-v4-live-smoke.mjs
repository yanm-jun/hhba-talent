/**
 * Synthetic-only real relay smoke test in V4 Cloudflare Pages Preview build.
 * No real candidate resumes, no credential, model text, or private URLs logged.
 */
import {v4Provider,v4Call,v4ParseJson,v4Sources,v4OutputText} from '../functions/_lib/simple-match-v4.js';
const label='HHBA_V4_LIVE_SMOKE=';
if(!['feat/simple-resume-match-v4-20261124','fix/v4-open-job-discovery-20261124','fix/v4-direct-ai-recommend-20261124','fix/v4-remove-residual-matching-caps','feat/v4-background-validation'].includes(process.env.CF_PAGES_BRANCH)){
 console.log(label+JSON.stringify({status:'SKIPPED_OTHER_BRANCH'}));process.exit(0);
}
const provider=v4Provider(process.env);
if(!provider){console.log(label+JSON.stringify({status:'MISSING_RELAY_KEY'}));process.exit(0)}
const report={status:'PARTIAL',model:provider.model,model_catalog:'NOT_TESTED',
 responses:'NOT_TESTED',web_search:'NOT_TESTED',cited_official_links:0,model_job_rows:0,format:'NOT_TESTED'};
try{
 const r=await fetch(provider.baseUrl+'/models',{
  headers:{authorization:'Bearer '+provider.key,
   'x-openai-actor-authorization':'local-image-extension'},
  redirect:'manual',signal:AbortSignal.timeout(12000)});
 if(r.status===200){
  const j=await r.json();
  report.model_catalog=Array.isArray(j?.data)&&j.data.some(x=>x?.id===provider.model)?
   'MODEL_LISTED':'MODEL_NOT_LISTED';
 }else report.model_catalog='HTTP_'+r.status;
}catch{report.model_catalog='NETWORK_OR_TIMEOUT'}
try{
 const d=await v4Call(fetch,provider,{
  instructions:'Only emit a JSON object with one boolean field ok, set to true.',
  input:'Synthetic API diagnostic. Respond with {"ok":true}.'
 });
 report.responses=v4ParseJson(d).ok===true?'JSON_OK':'JSON_UNEXPECTED';
}catch(e){report.responses=e?.code||'PROVIDER_ERROR'}
// Probe the relay using only synthetic content, independently of rollout flags.
for(const effort of ['xhigh','high']){
 try{
  let events=0;
  const result=await v4Call(fetch,{...provider,stream:true,reasoningEffort:effort},{
   instructions:'Return only a JSON object with ok:true.',input:'Synthetic compatibility check.'
  },{onEvent:()=>events++});
  if(v4ParseJson(result).ok===true&&result.status==='completed'){
   report.reasoning_probe=effort;report.native_stream=events>0?'EVENTS_OBSERVED':'JSON_ONLY';break;
  }
 }catch(e){report.reasoning_probe=e?.code||'PROVIDER_ERROR';}
}
try{
 const d=await v4Call(fetch,provider,{
  instructions:'You help job seekers in China. Use web_search to find currently hiring, real employer job pages for automotive channel supervisor or dealer operations roles in China. Return ONE VALID JSON OBJECT with profile:{roles:[...]}, jobs:[{company,title,location,url,score,reason,resume_quote}]. Do not invent links. Find as many as the research actually supports; no company allowlist or numerical cap.',
  input:JSON.stringify({resume_text:'曾负责汽车经销商销售运营、销售人员培训、渠道数据分析及终端督导。',preferred_city:'上海或全国',scope:'中国大陆真实岗位'}),
  tools:[{type:'web_search'}],tool_choice:'required',
  include:['web_search_call.action.sources']
 });
 report.web_search=d.output.some(x=>x?.type==='web_search_call')?'TOOL_CALLED':'TOOL_NOT_CALLED';
 report.cited_official_links=v4Sources(d).length;
 try{
  const value=v4ParseJson(d);
  report.format='JSON_OK';
  report.model_job_rows=Array.isArray(value.jobs)?value.jobs.length:0;
 }catch{report.format='JSON_INVALID'}
}catch(e){report.web_search=e?.code||'PROVIDER_ERROR'}
// A synthetic image-only PDF, not a real applicant document, exercises
// the same input_file path as scanned resumes.
if(['fix/v4-remove-residual-matching-caps','feat/v4-background-validation'].includes(process.env.CF_PAGES_BRANCH)){
 const patterns={
  'H':['10001','10001','10001','11111','10001','10001','10001'],
  'B':['11110','10001','10001','11110','10001','10001','11110'],
  'A':['01110','10001','10001','11111','10001','10001','10001']
 };
 const glyphs='HHBA';const scale=12,w=28*scale,h=11*scale;
 const raster=Buffer.alloc(w*h,255);
 for(let i=0;i<glyphs.length;i++)for(let y=0;y<7;y++)for(let x=0;x<5;x++)
  if(patterns[glyphs[i]][y][x]==='1')for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++)
   raster[(y*scale+dy+2*scale)*w+(i*6*scale+x*scale+dx+2*scale)]=0;
 const stream='q '+w+' 0 0 '+h+' 0 0 cm /Im0 Do Q';
 const objects=[
  Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
  Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
  Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>'),
  Buffer.from('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'),
  Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Length '+raster.length+' >>\nstream\n'),raster,Buffer.from('\nendstream')])
 ];
 let pdf=Buffer.from('%PDF-1.4\n');const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf=Buffer.concat([pdf,Buffer.from((i+1)+' 0 obj\n'),objects[i],Buffer.from('\nendobj\n')]);}
 const start=pdf.length;
 pdf=Buffer.concat([pdf,Buffer.from('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF')]);
 try{
  const ocr=await v4Call(fetch,provider,{instructions:'Transcribe visible text from this scanned PDF. Return text only.',input:[{role:'user',content:[{type:'input_file',filename:'scan.pdf',file_data:'data:application/pdf;base64,'+pdf.toString('base64')},{type:'input_text',text:'Read the scan.'}]}]});
  report.scanned_pdf=ocr.status==='completed'&&/HHBA/i.test(v4OutputText(ocr).replace(/\s/g,''))?'OCR_OK':'OCR_UNEXPECTED';
 }catch(e){report.scanned_pdf=e?.code||'PROVIDER_ERROR'}
}
report.status=report.responses==='JSON_OK'&&report.web_search==='TOOL_CALLED'&&report.format==='JSON_OK'&&report.model_job_rows>0&&(!report.scanned_pdf||report.scanned_pdf==='OCR_OK')?'READY':'PARTIAL';
console.log(label+JSON.stringify(report));
