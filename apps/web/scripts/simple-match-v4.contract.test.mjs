import test from 'node:test';
import assert from 'node:assert/strict';
import {v4Provider,v4Call,v4ParseJson,v4GroundProfile,v4ToolSources,v4Sources,
 v4Match} from '../functions/_lib/simple-match-v4.js';
import {v4PublicJobUrl,v4ReadEmployerJob} from '../functions/_lib/v4-open-job-evidence.js';
import {onRequest} from '../functions/api/match-v4/[[path]].js';

const key='TEST_ONLY_FAKE_KEY_0123456789';
const provider=v4Provider({HHBA_AGENT_RELAY_API_KEY:key});
const model=(json,sources=[])=>Response.json({status:'completed',output:[
 {type:'web_search_call',action:{sources:sources.map(url=>({url}))}},
 {type:'message',content:[{type:'output_text',text:JSON.stringify(json)}]}
]});
const resume='我负责汽车经销商渠道运营和门店销售流程管理。负责销售人员培训和运营数据分析。';
const url='https://careers.other-motors.cn/recruitment/positions/9988';
const row={company:'其他汽车企业',title:'区域渠道运营',location:'上海',url,
 score:84,reason:'适合渠道运营与门店销售管理经验',resume_quote:'汽车经销商渠道运营',
 jd_quote:'渠道运营和经销商业务流程',matched:['有渠道运营经验'],gaps:['岗位具体要求待进一步核对']};

test('V4 uses only configured server Secret, not Agent/Skill setup',()=>{
 assert.equal(v4Provider({}),null);
 assert.equal(provider.key,key);
 assert.equal(provider.model,'gpt-6.2-sol');
});
test('V4 holds model requests server-side, refuses redirects, sets store=false',async()=>{
 let captured;
 await v4Call(async(u,options)=>{captured={u,options};return model({ok:true})},
  provider,{store:true,input:'synthetic'});
 assert.equal(captured.u,'https://api-c.reqtoken.com/v1/responses');
 assert.equal(captured.options.headers.authorization,'Bearer '+key);
 assert.equal(JSON.parse(captured.options.body).store,false);
 assert.equal(captured.options.redirect,'manual');
 await assert.rejects(()=>v4Call(async()=>new Response(null,{status:302}),
  provider,{input:'synthetic'}),/AI_PROVIDER_REDIRECT_BLOCKED/);
});
test('V4 can parse JSON and extract only resume-quoted profile facts',()=>{
 const d=model({profile:{roles:['区域运营','渠道管理'],
  education:'博士',education_evidence:'博士毕业',
  facts:[{kind:'work',quote:'汽车经销商渠道运营'},{kind:'credential',quote:'硕士毕业'}],
  skills:[{name:'培训',evidence:'销售人员培训'}] }});
 return d.json().then(x=>{
  const j=v4ParseJson(x),p=v4GroundProfile(j,resume);
  assert.equal(p.education,null);
  assert.equal(p.facts.length,1);
  assert.equal(p.skills.length,1);
  assert.deepEqual(p.target_roles,['区域运营','渠道管理']);
 });
});
test('V4 no company/industry/path allowlist and public HTTPS safety unchanged',()=>{
 const other='https://recruitment.unknown-automotive.cn/vacancies/region/2026-889';
 assert.equal(v4PublicJobUrl(other),other);
 assert.equal(v4PublicJobUrl('https://www.zhipin.com/job_detail/12345.html'),
  'https://www.zhipin.com/job_detail/12345.html');
 assert.equal(v4PublicJobUrl('https://careers.other-motors.cn/'),
  'https://careers.other-motors.cn/');
 for(const x of ['http://127.0.0.1/private','https://localhost/admin',
   'https://metadata.google.internal/computeMetadata/v1',
   'https://user:pass@careers.other-motors.cn/positions/8',
   'http://careers.other-motors.cn/jobs/8','https://192.168.1.1/private'])
  assert.equal(v4PublicJobUrl(x),null,x);
});
test('V4 gathers tool citations and model-provided job links without dropping unfamiliar domains',()=>{
 const d={output:[
  {type:'web_search_call',action:{sources:[{url}]}},
  {type:'message',content:[{type:'output_text',text:JSON.stringify({
   jobs:[row,{...row,url:'https://careers.another-co.cn/positions/9'}]
  })}]}
 ]};
 assert.deepEqual(v4ToolSources(d),[url]);
 assert.equal(v4Sources(d).length,2);
});
test('V4 sends résumé directly to AI web search and preserves credible job lead when JD is unreadable',async()=>{
 let calls=0;
 const fetcher=async(u,options)=>{
  if(u.endsWith('/responses')){
   calls++;
   const payload=JSON.parse(options.body);
   assert.equal(payload.tools[0].type,'web_search');
   assert.ok(payload.input.includes('汽车经销商渠道运营'));
   assert.ok(payload.instructions.includes('不要限制企业'));
   return model({research_complete:true,profile:{summary:'适合区域渠道运营',roles:['渠道运营']},jobs:[row]},[url]);
  }
  return new Response('blocked',{status:403});
 };
 const progress=[];
 const r=await v4Match(fetcher,provider,resume,'上海',{onProgress:s=>progress.push(s)});
 assert.equal(calls,1);
 assert.equal(r.status,'COMPLETE');
 assert.equal(r.matches.length,1);
 assert.equal(r.matches[0].title,'区域渠道运营');
 assert.equal(r.matches[0].official_url,url);
 assert.equal(r.matches[0].match_score,84);
 assert.equal(r.matches[0].jd_source_status,undefined);
 assert.equal(r.matches[0].evidence_status,'SEARCH_SNIPPET_ONLY');
 assert.equal(r.matches[0].availability_status,'UNKNOWN');
 assert.equal(r.matches[0].recruitment_source_kind,'UNVERIFIED');
 assert.deepEqual(progress,['parsing','searching','reading','scoring']);
});
test('V4 does not silently cap recommendations at 10 or 20',async()=>{
 const rows=Array.from({length:25},(_,i)=>({...row,
  url:'https://recruitment.company'+i+'.cn/vacancies/'+i}));
 let modelCalls=0;
 const fetcher=async(u)=>{
  if(u.endsWith('/responses')){modelCalls++;return model({research_complete:true,profile:{roles:['区域督导']},jobs:rows});}
  return new Response('not accessible',{status:403});
 };
 const r=await v4Match(fetcher,provider,resume,'全国');
 assert.equal(modelCalls,1);
 assert.equal(r.matches.length,25);
 assert.equal(r.native_search.candidate_links,25);
 assert.equal(r.native_search.jd_verification.verified,0);
});
test('V4 independently confirms structured employer JD, when available, without requiring a known company',async()=>{
 const html='<html><head><script type="application/ld+json">'+JSON.stringify({
  '@context':'https://schema.org','@type':'JobPosting',title:'区域渠道运营',
  hiringOrganization:{name:'其他汽车企业',url:'https://careers.other-motors.cn'},
  jobLocation:{address:{addressLocality:'上海'}},
  description:'<p>岗位职责</p><p>负责区域渠道运营和经销商业务流程的标准化管理和优化。</p>'+
   '<p>负责区域销售人员培训和业务数据管理。</p>'+
   '<p>任职要求</p><p>熟悉渠道运营和经销商业务流程，能够提供门店运营管理改善建议。</p>'+
   '<p>具备项目沟通能力和业务数据分析能力。</p>'
 })+'</script></head><body><h1>区域渠道运营</h1></body></html>';
 const job=await v4ReadEmployerJob(url,{fetcher:async()=>new Response(html,{headers:{
  'content-type':'text/html'}})});
 assert.equal(job.title,'区域渠道运营');
 assert.equal(job.company,'其他汽车企业');
 assert.equal(job.location,'上海');
 assert.ok(job.full_jd.includes('任职要求'));
 assert.equal(job.source_confirmed,true);
});
test('V4 does not send a résumé if not authorized, cross-origin or unauthenticated',async()=>{
 const env={HHBA_AGENT_RELAY_API_KEY:key,HHBA_MATCH_V4_READY:'1',
  HHBA_PNVS_AUTH_DB:{prepare:()=>({first:async()=>null})}};
 const disabled=await onRequest({request:new Request('https://hhba.work/api/match-v4/status'),
  env:{...env,HHBA_MATCH_V4_READY:'0'}});
 assert.equal((await disabled.json()).enabled,false);
 const enabled=await onRequest({request:new Request('https://hhba.work/api/match-v4/status'),env});
 assert.equal((await enabled.json()).enabled,true);
 const input={consent:true,text:resume,options:{country:'CN'}};
 const noAuth=await onRequest({request:new Request('https://hhba.work/api/match-v4/resume',{
  method:'POST',headers:{Origin:'https://hhba.work','Content-Type':'application/json'},
  body:JSON.stringify(input)
 }),env});
 assert.equal(noAuth.status,401);
 const cross=await onRequest({request:new Request('https://hhba.work/api/match-v4/resume',{
  method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},
  body:JSON.stringify(input)
 }),env});
 assert.equal(cross.status,403);
});

test('V4 lets the model continue across independent web-search rounds with no fixed round count',async()=>{
 const makeLead=i=>({...row,company:'雇主'+i,
  url:'https://careers.industry'+i+'.cn/roles/'+i});
 let rounds=0;const partials=[],progress=[];
 const fetcher=async(u)=>{
  if(u.endsWith('/responses')){
   rounds++;
   const jobs=rounds===1?[makeLead(1)]:[makeLead(2),makeLead(3)];
   return model({research_complete:rounds>=2,
    profile:{roles:['区域渠道管理'],summary:'相关汽车渠道经验'},
    jobs},jobs.map(x=>x.url));
  }
  return new Response('not readable',{status:403});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{
  onPartial:jobs=>partials.push(jobs.length),onProgress:p=>progress.push(p)
 });
 assert.equal(rounds,2,'AI returned the explicit stop decision, not a numeric cap');
 assert.deepEqual(partials,[1,3]);
 assert.equal(result.matches.length,3);
 assert.equal(result.native_search.searches,2);
 assert.deepEqual(progress,['parsing','searching','reading','scoring']);
});
test('V4 has no per-model-call timeout and respects explicit cancellation',async()=>{
 const controller=new AbortController();let options;
 const fetcher=async(u,opts)=>{options=opts;return model({ok:true})};
 await v4Call(fetcher,provider,{input:'test'},{signal:controller.signal});
 assert.equal(options.signal,controller.signal);
 const direct=async(u,opts)=>{options=opts;return model({ok:true})};
 await v4Call(direct,provider,{input:'test'});
 assert.equal(options.signal,undefined);
});
test('V4 frontend never rejects more than ten posts or cancels at the legacy five-minute deadline',async()=>{
 const {readFile}=await import('node:fs/promises');
 const service=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.match(service,/MATCH_V4_PREVIEW\|\|value\.matches\.length<=10/);
 assert.match(service,/!MATCH_V4_PREVIEW&&data\.matches\.length>10/);
 assert.match(service,/MATCH_V4_PREVIEW\?undefined:setTimeout/);
 assert.match(service,/!MATCH_V4_PREVIEW\?\{limit:/);
});

test('V4 missing completion decision preserves leads and offers continuation, without claiming research is done',async()=>{
 const r=await v4Match(async u=>u.endsWith('/responses')?model({jobs:[row]},[url]):new Response('blocked',{status:403}),provider,resume,'全国');
 assert.equal(r.matches.length,1);
 assert.equal(r.can_continue,true);
 assert.equal(r.native_search.research_error,'AI_RESEARCH_COMPLETION_UNCONFIRMED');
});
test('V4 later round replaces placeholder and keeps prior profile evidence; excluded results do not reappear',async()=>{
 const omitted='https://careers.omitted.cn/jobs/1';
 let rounds=0;
 const fetcher=async(u,options)=>{
  if(!u.endsWith('/responses'))return new Response('blocked',{status:403});
  rounds++;
  const payload=JSON.parse(options.body);
  assert.ok(payload.input.includes(omitted));
  if(rounds===1)return model({research_complete:false,profile:{facts:[{kind:'work',quote:'汽车经销商渠道运营'}]},jobs:[{...row,url:omitted}]},[url,omitted]);
  assert.ok(payload.input.includes('汽车经销商渠道运营'));
  return model({research_complete:true,profile:{roles:['区域运营']},jobs:[row]},[url]);
 };
 const r=await v4Match(fetcher,provider,resume,'全国',{excludeUrls:[omitted]});
 assert.equal(rounds,2);
 assert.equal(r.matches.length,1);
 assert.equal(r.matches[0].title,row.title);
 assert.equal(r.matches[0].match_score,84);
 assert.equal(r.profile.facts.length,1);
});
test('V4 production host uses V4 without a query parameter; final result can be streamed in parts',async()=>{
 const {readFile}=await import('node:fs/promises');
 const service=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const route=await readFile(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(service,/new URLSearchParams\(window\.location\.search\)\.get\('v4'\)==='1'/);
 assert.match(service,/event==='final_job'/);
 assert.match(service,/finalJobs\.length!==value\.match_count/);
 assert.match(route,/sendJobs\('final',result\.matches\)/);
});
test('V4 repeats scoring after reading an independently obtained full JD',async()=>{
 const html='<html><head><script type="application/ld+json">'+JSON.stringify({
  '@context':'https://schema.org','@type':'JobPosting',title:'区域渠道运营',
  hiringOrganization:{name:'其他汽车企业',url:'https://careers.other-motors.cn'},
  jobLocation:{address:{addressLocality:'上海'}},
  description:'<p>岗位职责</p><p>负责区域渠道运营和经销商业务流程的标准化管理和优化。</p>'+
   '<p>负责区域销售人员培训和业务数据管理。</p>'+
   '<p>任职要求</p><p>熟悉渠道运营和经销商业务流程，能够提供门店运营管理改善建议。</p>'+
   '<p>具备项目沟通能力和业务数据分析能力。</p>'
 })+'</script></head><body><h1>区域渠道运营</h1></body></html>';
 let scoreCalls=0;
 const r=await v4Match(async(u,options)=>{
  if(!u.endsWith('/responses'))return new Response(html,{headers:{'content-type':'text/html'}});
  const payload=JSON.parse(options.body);
  if(payload.tools)return model({research_complete:true,jobs:[row]},[url]);
  scoreCalls++;
  assert.ok(payload.input.includes('具备项目沟通能力'));
  return model({score:91,reason:'有明确渠道运营经验',resume_quote:'汽车经销商渠道运营',jd_quote:'渠道运营和经销商业务流程',matched:['渠道管理'],gaps:[]});
 },provider,resume,'上海');
 assert.equal(scoreCalls,1);
 assert.equal(r.matches[0].match_score,91);
 assert.equal(r.native_search.jd_verification.scored,1);
 assert.equal(r.matches[0].score_evidence_status,'GROUNDED_JD_RESUME_QUOTES');
});

test('V4 independent public JD archive supports an unfamiliar employer without asserting official ownership',async()=>{
 const {saveV4PublicJobJd,readJobJdById,hydrateVerifiedJobRequirements}=await import('../functions/_lib/job-jd-archive.js');
 const {extractOfficialJdSections}=await import('../functions/_lib/official-job-evidence.js');
 const jd=extractOfficialJdSections('岗位职责\n负责区域渠道运营和经销商业务流程的标准化管理和优化。\n负责区域销售人员培训和业务数据管理。\n任职要求\n熟悉渠道运营和经销商业务流程，能够提供门店运营管理改善建议。\n具备项目沟通能力和业务数据分析能力。');
 const objects=new Map();
 const env={HHBA_JOB_JD_DB:{prepare(){return {bind(){return this},async first(){return null}}}},
  HHBA_JOB_JD_R2:{async put(k,v){objects.set(k,v)},async get(k){return objects.has(k)?{text:async()=>objects.get(k)}:null}}};
 const raw={...jd,canonical_url:url,company:row.company,title:row.title,location:'上海',proof_method:'V4_STRUCTURED_JOBPOSTING',source_confirmed:true};
 const saved=await saveV4PublicJobJd(env,raw);
 assert.ok(saved.fresh);
 const found=await readJobJdById(env,saved.id);
 assert.equal(found.full_jd,jd.full_jd);
 const trusted=await hydrateVerifiedJobRequirements(env,{jd_version_id:saved.id,jd_sha256:saved.jd_sha256,official_url:url});
 assert.equal(trusted.source_status,'VERIFIED_PUBLIC_JD');
 assert.equal(trusted.requirements,jd.full_jd);
 await assert.rejects(saveV4PublicJobJd(env,{...raw,source_confirmed:false}),/JD_NOT_VERIFIED/);
 await assert.rejects(saveV4PublicJobJd(env,{...raw,canonical_url:'https://www.zhipin.com/job_detail/12345.html'}),/JD_NOT_VERIFIED/);
 const objectKey=[...objects.keys()][0];
 objects.set(objectKey,JSON.stringify({...JSON.parse(objects.get(objectKey)),jd_sha256:'0'.repeat(64)}));
 assert.equal(await readJobJdById(env,saved.id),null);
});
test('V4 history keeps more than ten independently labelled public recommendations',async()=>{
 const {safeHistoryJobs}=await import('../functions/_lib/match-history.js');
 const rows=Array.from({length:37},(_,i)=>({...row,id:'v4-'+i,v4_source:true,official_url:'https://careers.company'+i+'.cn/roles/'+i,match_score:84}));
 assert.equal(safeHistoryJobs(rows).length,37);
 assert.equal(safeHistoryJobs([...rows,{...rows[0],official_url:'http://localhost/a'}]).length,37);
});
test('V4 OCR requires specific explicit original-file authorization and redacts transcription',async()=>{
 const {recognizeV4Resume,V4_OCR_CONSENT}=await import('../functions/_lib/v4-resume-ocr.js');
 let calls=0;
 const req=consent=>new Request('https://hhba.work/api/match-v4/ocr',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-HHBA-Resume-Format':'pdf','X-HHBA-OCR-Consent':consent},body:'%PDF-1.7\nsynthetic resume test document\n%%EOF'});
 const fetcher=async(u,options)=>{
  calls++;
  const payload=JSON.parse(options.body);
  assert.equal(payload.input[0].content[0].type,'input_file');
  assert.ok(payload.input[0].content[0].file_data.startsWith('data:application/pdf;base64,'));
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'负责门店运营和数据分析 synthetic@example.com'}]}]});
 };
 await assert.rejects(recognizeV4Resume(req(''),provider,fetcher),/OCR_CONSENT_REQUIRED/);
 assert.equal(calls,0);
 const result=await recognizeV4Resume(req(V4_OCR_CONSENT),provider,fetcher);
 assert.equal(calls,1);
 assert.equal(result.text,'负责门店运营和数据分析 [邮箱已隐藏]');
 assert.equal(result.partial,false);
});
test('V4 automatically resumes after a missing completion flag when it has made progress',async()=>{
 let rounds=0;
 const fetcher=async(u,options)=>{
  if(!u.endsWith('/responses'))return new Response('blocked',{status:403});
  rounds++;
  if(rounds===1)return model({jobs:[row]},[url]);
  assert.ok(JSON.parse(options.body).input.includes('上轮未明确研究是否完成'));
  return model({research_complete:true,jobs:[row]},[url]);
 };
 const r=await v4Match(fetcher,provider,resume,'上海');
 assert.equal(rounds,2);
 assert.equal(r.matches.length,1);
 assert.equal(r.native_search.research_error,undefined);
});

test('V4 checkpoint continues across separate invocations without reducing the number of jobs',async()=>{
 const jobs=Array.from({length:37},(_,i)=>({...row,url:'https://careers.v4-company'+i+'.cn/roles/'+i}));
 let modelCalls=0,pageCalls=0;
 const fetcher=async(u,opts)=>{
  if(u.endsWith('/responses')){
   modelCalls++;
   return model({research_complete:modelCalls===2,jobs:modelCalls===1?jobs.slice(0,20):jobs.slice(20)});
  }
  pageCalls++;
  return new Response('unavailable',{status:403});
 };
 let checkpoint=null,result,requests=0;
 do{
  const before=pageCalls;
  result=await v4Match(fetcher,provider,resume,'全国',{stepMode:true,checkpoint});
  requests++;
  assert.ok(pageCalls-before<=2,'at most two distinct unfamiliar pages read per invocation');
  checkpoint=result.checkpoint;
 }while(result.status==='CONTINUE'&&requests<60);
 assert.equal(result.status,'COMPLETE');
 assert.equal(modelCalls,2);
 assert.equal(result.matches.length,37);
 assert.equal(new Set(result.matches.map(j=>j.official_url)).size,37);
 assert.equal(result.native_search.candidate_links,37);
 assert.equal(pageCalls,37);
 assert.ok(requests>10);
});
test('V4 checkpoint signatures reject other accounts, changed resume, or modified state',async()=>{
 const {issueCheckpoint,verifyCheckpoint}=await import('../functions/_lib/resume-rewrite-checkpoint.js');
 const args={env:{HHBA_RESUME_AGENT_CHECKPOINT_SECRET:'synthetic-v4-checkpoint-secret-only-for-tests'},
  account:'candidate-a',blocks:[resume],job:{role:'上海'},draft:{phase:'research',rows:[[url,row]]}};
 const token=await issueCheckpoint(args);
 assert.equal(await verifyCheckpoint({...args,token}),true);
 await assert.rejects(verifyCheckpoint({...args,token,account:'candidate-b'}));
 await assert.rejects(verifyCheckpoint({...args,token,blocks:['不同简历']}));
 await assert.rejects(verifyCheckpoint({...args,token,draft:{phase:'verification',rows:[]}}));
});

test('V4 segments large match histories without losing order or Unicode',async()=>{
 const {historySegments}=await import('../functions/_lib/match-history.js');
 const jobs=Array.from({length:1000},(_,i)=>({id:'job-'+i,reason:'岗位匹配依据'.repeat(100)}));
 const chunks=historySegments(jobs);
 assert.ok(chunks.length>1);
 assert.ok(chunks.every(x=>new TextEncoder().encode(x).byteLength<=500000));
 assert.deepEqual(chunks.flatMap(x=>JSON.parse(x)),jobs);
});
test('V4 continuation claim is one-time and a failed step can release the claim',async()=>{
 const {claimAiCheckpoint}=await import('../functions/_lib/ai-checkpoint-claim.js');
 const held=new Map();
 const db={prepare(sql){return {bind(...args){return {async run(){
  if(sql.startsWith('INSERT OR IGNORE')){
   if(held.has(args[0]))return {success:true,meta:{changes:0}};
   held.set(args[0],args[1]);return {success:true,meta:{changes:1}};
  }
  if(sql.includes('token_hash=?'))held.delete(args[0]);
  return {success:true,meta:{changes:1}};
 }}}}}};
 const token='synthetic-signed-checkpoint';
 const first=await claimAiCheckpoint(db,token);
 assert.ok(first);
 assert.equal(await claimAiCheckpoint(db,token),null);
 assert.equal([...held.keys()][0].length,64);
 assert.notEqual([...held.keys()][0],token);
 await first.release();
 assert.ok(await claimAiCheckpoint(db,token));
});
test('V4 entire-document optimization advances across multiple invocation budgets',async()=>{
 const {optimizeResumeDocument}=await import('../functions/_lib/resume-optimization-task.js');
 const blocks=Array.from({length:77},(_,i)=>({id:'word-'+i,section:'experience',text:'负责真实项目'+i}));
 const input={env:{HHBA_MATCH_V4_READY:'1'},blocks,context:blocks.map(b=>b.text).join('\n'),
  job:{title:'项目管理',requirements:'真实项目经验'},signal:new AbortController().signal};
 const deps={plan:async({blocks})=>{assert.equal(blocks.length,77);return {focus:['真实经历']}},
  generate:async({blocks})=>({provider:'synthetic',suggestions:blocks.map(b=>({blockId:b.id}))}),
  audit:async({suggestions})=>suggestions};
 const ids=[];let wanted;
 do{
  const result=await optimizeResumeDocument({...input,wanted},deps);
  ids.push(...result.suggestions.map(x=>x.blockId));
  wanted=result.pendingIds;
 }while(wanted.length);
 assert.deepEqual([...ids].sort(),blocks.map(b=>b.id).sort());
});

test('V4 native Responses streaming consumes verified final response and forwards only event types',async()=>{
 const eventTypes=[];const data={status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]};
 const events=[{type:'response.web_search_call.searching',private_text:'not forwarded'},
  {type:'response.output_text.delta',delta:'private model output'},
  {type:'response.completed',response:data}];
 const streamed=await v4Call(async(_url,options)=>{
  assert.equal(JSON.parse(options.body).stream,true);
  assert.equal(options.headers.accept,'text/event-stream');
  return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
 },{...provider,stream:true},{input:'synthetic'}, {onEvent:event=>eventTypes.push(event)});
 assert.deepEqual(streamed,data);
 assert.deepEqual(eventTypes,['response.web_search_call.searching','response.output_text.delta']);
 await assert.rejects(v4Call(async()=>new Response('data: '+JSON.stringify(events[0])+'\n\n',{headers:{'content-type':'text/event-stream'}}),
  {...provider,stream:true},{input:'synthetic'}),/AI_PROVIDER_RESPONSE_INVALID/);
});

test('V4 reassessment accepts complete document evidence beyond legacy limits',async()=>{
 const {validReassessmentInput}=await import('../functions/_lib/resume-reassessment.js');
 const blocks=Array.from({length:35},(_,i)=>({id:'block-'+i,section:'experience',text:'真实经历'+i+'甲'.repeat(1700)}));
 const input={job_id:'jd_'+'a'.repeat(32),consent_reassessment:true,confirm_real:true,
  profile:{education:null,experience_years:5,target_roles:Array.from({length:12},(_,i)=>'岗位'+i),
   skills:Array.from({length:40},(_,i)=>({name:'技能'+i}))},before_blocks:blocks,after_blocks:blocks};
 assert.equal(validReassessmentInput(input),false);
 assert.equal(validReassessmentInput(input,{v4:true}),true);
 assert.equal(validReassessmentInput({...input,after_blocks:blocks.slice(1)},{v4:true}),false);
});
test('V4 Word score replay accepts more than eight verified revisions',async()=>{
 const {checkedWordScoreBlocks}=await import('../src/services/resumeWordScoreBridge.mjs');
 const original=[{id:'one',section:'experience',text:'真实项目第0阶段'}];
 const history=Array.from({length:15},(_,i)=>({revision:i+1,original:'真实项目第'+i+'阶段',text:'真实项目第'+(i+1)+'阶段'}));
 assert.equal(checkedWordScoreBlocks(original,history,15).ok,false);
 const result=checkedWordScoreBlocks(original,history,15,true);
 assert.equal(result.ok,true);assert.equal(result.blocks[0].text,'真实项目第15阶段');
});

test('streaming request rejection falls back to JSON without repeating completed requests',async()=>{
 const attempts=[];
 const result=await v4Call(async(url,opts)=>{
  attempts.push(JSON.parse(opts.body).stream);
  if(attempts.length===1)return new Response('stream not supported',{status:400});
  return model({ok:true});
 },{...provider,stream:true},{input:'synthetic'});
 assert.deepEqual(attempts,[true,false]);
 assert.equal(v4ParseJson(result).ok,true);
});

test('V4 changes search strategy after duplicate discoveries and finds further jobs',async()=>{
 let rounds=0;const fresh={...row,url:'https://careers.further-employer.cn/vacancies/22'};
 const result=await v4Match(async(u,options)=>{
  if(!u.endsWith('/responses'))return new Response('unavailable',{status:403});
  rounds++;
  if(rounds===3)assert.ok(JSON.parse(options.body).input.includes('换搜索策略'));
  return model({research_complete:rounds===3,jobs:rounds===3?[fresh]:[row]},[rounds===3?fresh.url:url]);
 },provider,resume,'全国');
 assert.equal(rounds,3);assert.equal(result.matches.length,2);
});
test('V4 recovers a temporary network failure before any job has been discovered',async()=>{
 let attempts=0;
 const result=await v4Match(async(u)=>{
  if(!u.endsWith('/responses'))return new Response('unavailable',{status:403});
  if(++attempts===1)throw Error('synthetic network failure');
  return model({research_complete:true,jobs:[row]},[url]);
 },provider,resume,'全国');
 assert.equal(attempts,2);assert.equal(result.matches.length,1);
});

test('V4 encrypted R2 checkpoint removes growing research state from browser request',async()=>{
 const {storeMatchCheckpoint,loadMatchCheckpoint,deleteMatchCheckpoint}=await import('../functions/_lib/v4-match-checkpoint-storage.js');
 const objects=new Map(),bucket={async put(k,v){objects.set(k,v.slice())},async get(k){const v=objects.get(k);return v?{arrayBuffer:async()=>v.buffer}:null},async delete(k){objects.delete(k)}};
 const env={HHBA_V4_MATCH_CHECKPOINT_STORAGE:'1',HHBA_MATCH_V4_CHECKPOINT_SECRET:'synthetic-key-for-encrypted-test-only',HHBA_PRIVATE_RESUMES:bucket};
 const state={rows:Array.from({length:500},(_,i)=>['https://jobs.co.cn/'+i,{reason:'测试研究资料'.repeat(200)}])};
 const now=Date.now(),pointer=await storeMatchCheckpoint(env,state,now);
 assert.ok(JSON.stringify(pointer).length<100);
 assert.deepEqual(await loadMatchCheckpoint(env,pointer,now),state);
 const bytes=[...objects.values()][0];
 assert.ok(!new TextDecoder().decode(bytes).includes('测试研究资料'));
 await assert.rejects(loadMatchCheckpoint(env,pointer,now+3600001),/AI_CHECKPOINT_EXPIRED/);
 await assert.rejects(loadMatchCheckpoint({...env,HHBA_MATCH_V4_CHECKPOINT_SECRET:'another-synthetic-key-not-authorized'},pointer,now),/AI_CHECKPOINT_INVALID/);
 await deleteMatchCheckpoint(env,pointer);
 assert.equal(objects.size,0);
});
