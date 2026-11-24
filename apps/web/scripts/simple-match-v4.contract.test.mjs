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
 assert.match(route,/sendJobs\('final',matches\)/);
 assert.match(route,/officialOnly:true/);
 assert.match(service,/event==='research_report'/);
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

test('V4 retains a long original job title and employer name after a transient page error',async()=>{
 const title='高级区域运营与渠道发展综合管理岗位'.repeat(10),company='跨区域综合产业发展企业集团'.repeat(12);
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title,hiringOrganization:{name:company,url:'https://careers.other-motors.cn'},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责渠道运营与区域管理，完善门店运营业务流程并开展销售数据分析。</p><p>持续协调跨部门业务并提供管理支持。</p><p>任职要求</p><p>具有相关业务运营经验、沟通能力和项目管理经验。</p><p>具备独立分析和组织协调能力。</p>'})+'</script><h1>'+title+'</h1>';
 let calls=0,secondSignal;
 const jd=await v4ReadEmployerJob(url,{fetcher:async(u,options)=>{
  calls++;if(calls===1)return new Response('temporary',{status:503});
  secondSignal=options.signal;return new Response(html,{headers:{'content-type':'text/html'}});
 }});
 assert.equal(calls,2);assert.equal(secondSignal,undefined);
 assert.equal(jd.title,title);assert.equal(jd.company,company);
});
test('V4 history retains all sources and complete long content',async()=>{
 const {safeHistoryJobs,historyTextSegments}=await import('../functions/_lib/match-history.js');
 const sources=Array.from({length:12},(_,i)=>({url:'https://careers.other-motors.cn/details/'+i,kind:'EMPLOYER_PAGE_CANDIDATE'}));
 const long='公开岗位要求与评分依据'.repeat(30000);
 const job={...row,id:'v4-history',v4_source:true,official_url:url,title:'原始岗位名称'.repeat(35),company:'原始企业名称'.repeat(35),score_basis:long,recommendation_reason:long,evidence_excerpt:long,requirements_basis:long,evidence_sources:sources};
 const [saved]=safeHistoryJobs([job]);
 assert.equal(saved.title,job.title);assert.equal(saved.company,job.company);assert.equal(saved.evidence_sources.length,12);
 for(const field of ['score_basis','recommendation_reason','evidence_excerpt','requirements_basis'])assert.equal(saved[field],long);
 const serialized=JSON.stringify([saved]),segments=historyTextSegments(serialized);
 assert.ok(segments.length>1);assert.equal(segments.map(x=>JSON.parse(x)).join(''),serialized);
});
test('V4 interrupted task records are encrypted, isolated by owner and exact input, and recoverable',async()=>{
 const {matchTaskKey,saveMatchTask,readMatchTask}=await import('../functions/_lib/v4-match-checkpoint-storage.js');
 const objects=new Map(),bucket={async put(k,v){objects.set(k,v.slice())},async get(k){const v=objects.get(k);return v?{arrayBuffer:async()=>v.buffer}:null}};
 const env={HHBA_V4_MATCH_CHECKPOINT_STORAGE:'1',HHBA_MATCH_V4_CHECKPOINT_SECRET:'synthetic-key-for-recovery-testing-only',HHBA_PRIVATE_RESUMES:bucket};
 const id=crypto.randomUUID(),input={text:'synthetic resume',role:'全国'};
 const a=await matchTaskKey(env,'candidate-a',id,input),b=await matchTaskKey(env,'candidate-b',id,input),c=await matchTaskKey(env,'candidate-a',id,{...input,role:'上海'});
 assert.notEqual(a,b);assert.notEqual(a,c);
 const now=Date.now(),checkpoint={checkpoint:{phase:'research',rows:[[url,{title:'公开研究状态'}]]}};
 await saveMatchTask(env,a,checkpoint,now);
 assert.deepEqual(await readMatchTask(env,a,now),checkpoint);
 assert.equal(await readMatchTask(env,b,now),null);assert.equal(await readMatchTask(env,c,now),null);
 assert.ok(!new TextDecoder().decode([...objects.values()][0]).includes('公开研究状态'));
 await saveMatchTask(env,a,{result:{status:'COMPLETE',matches:[row]}},now);
 assert.equal((await readMatchTask(env,a,now)).result.status,'COMPLETE');
 assert.equal(await readMatchTask(env,a,now+23*3600000+1),null);
});

test('V4 official-only research excludes known and newly identified commercial platforms and preserves unfamiliar employer',async()=>{
 const board='https://www.zhipin.com/job_detail/123.html',unknownBoard='https://new-market.cn/roles/55',unconfirmed='https://unknown-employer.cn/roles/77',official=url;
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:row.title,hiringOrganization:{name:row.company,url:'https://careers.other-motors.cn'},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责渠道运营和经销商业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 const reports=[],partials=[],reads=[];let queries=0;
 const result=await v4Match(async(u,opts)=>{
  if(!u.endsWith('/responses')){reads.push(u);return u===official?new Response(html,{headers:{'content-type':'text/html'}}):new Response('unavailable',{status:403});}
  const payload=JSON.parse(opts.body);
  if(payload.tools){queries++;assert.ok(payload.input.includes('zhipin.com'));assert.match(payload.instructions,/排除商业第三方招聘平台/);
   return model({research_complete:true,jobs:[{...row,url:board},{...row,url:unknownBoard,source_kind:'third_party_board'},{...row,url:unconfirmed},{...row,url:official}]},[board,unknownBoard,unconfirmed,official,'https://careers.other-motors.cn/about']);
  }
  if(payload.instructions.includes('职业画像'))return model({profile:{summary:'区域运营经验',roles:['渠道运营'],skills:[{name:'渠道管理',evidence:'汽车经销商渠道运营'}]}});
  return model({score:92,reason:'渠道经验匹配',resume_quote:'汽车经销商渠道运营',jd_quote:'渠道运营和经销商业务流程',matched:['渠道运营'],gaps:[]});
 },provider,resume,'全国',{officialOnly:true,onResearch:r=>reports.push(r),onPartial:j=>partials.push(j)});
 assert.equal(queries,1);assert.equal(result.matches.length,1);assert.equal(result.matches[0].official_url,official);
 assert.equal(result.matches[0].match_score,92);assert.equal(result.research_leads.length,1);assert.equal(result.research_leads[0].official_url,unconfirmed);
 assert.ok(!reads.includes(board)&&!reads.includes(unknownBoard));
 assert.ok(partials.flat().every(j=>![board,unknownBoard].includes(j.official_url)));
 assert.equal(result.research_report.excluded_count,2);assert.equal(result.research_report.discovered,2);
 assert.ok(reports.some(r=>r.profile.skills.some(s=>s.name==='渠道管理')));
});
test('commercial board exclusion is not an enterprise or industry whitelist',async()=>{
 const {isCommercialRecruitmentBoard}=await import('../functions/_lib/match-employer-source.js');
 assert.equal(isCommercialRecruitmentBoard('https://m.liepin.com/job/123'),true);
 assert.equal(isCommercialRecruitmentBoard('https://unknown-market.cn/jobs/123',{source_kind:'third_party_board'}),true);
 assert.equal(isCommercialRecruitmentBoard('https://careers.new-employer.cn/posting/123'),false);
 assert.equal(isCommercialRecruitmentBoard('https://university.edu.cn/hr/positions/123'),false);
 assert.equal(isCommercialRecruitmentBoard('https://company.myworkdayjobs.com/External/job/123'),false);
});
test('history research profile retains derived outcomes but not original resume quotations',async()=>{
 const {safeResearchReport}=await import('../functions/_lib/match-history.js');
 const report=safeResearchReport({profile:{summary:'渠道运营',skills:[{name:'渠道管理',evidence:'ORIGINAL_RESUME_QUOTE'}],facts:[{quote:'ORIGINAL_RESUME_QUOTE'}],target_roles:['运营']},rounds:[{round:1,queries:['企业官网 区域运营'],added:3}],excluded_count:2,discovered:3});
 assert.equal(report.profile.skills[0].name,'渠道管理');
 assert.ok(!JSON.stringify(report).includes('ORIGINAL_RESUME_QUOTE'));assert.equal(report.rounds[0].added,3);
});
test('four stage buttons show real reports without changing AI execution',async()=>{
 const {readFile}=await import('node:fs/promises');
 const panels=await readFile(new URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 const dialog=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 for(const label of ['识别简历','搜索企业岗位','核验岗位 JD','对照简历评分'])assert.ok(panels.includes(label));
 assert.match(panels,/onClick=\{\(\)=>\{setSelected\(i\);onSelectionChange\?\.\(i\)\}\}/);assert.match(panels,/report\?\.rounds/);
 assert.match(dialog,/!optimizedJobUrl&&<MatchResearchPanels/);
 assert.doesNotMatch(panels,/AbortController|fetch\(/);
});

test('V4 accepts a separate authorized recruitment system with independently read employer link',async()=>{
 const {v4EmployerAuthorization}=await import('../functions/_lib/v4-open-job-evidence.js');
 const target='https://new-ats.cn/tenant/roles/112',proof='https://brand-new-employer.cn/recruitment';
 const html='<html><head><meta property="og:site_name" content="新企业集团"><title>新企业集团官方招聘</title></head><body><a href="'+target+'">查看岗位</a></body></html>';
 const fetcher=async()=>new Response(html,{headers:{'content-type':'text/html'}});
 assert.equal(await v4EmployerAuthorization(target,'新企业集团',proof,{fetcher}),true);
 assert.equal(await v4EmployerAuthorization(target,'其他企业',proof,{fetcher}),false);
 assert.equal(await v4EmployerAuthorization(target,'新企业集团','https://www.zhipin.com/job/112',{fetcher}),false);
});
test('V4 excludes an unfamiliar commercial board discovered from the actual page identity',async()=>{
 const u='https://unknown-market.cn/jobs/32';
 const html='<meta property="og:site_name" content="全国商业招聘平台"><h1>职位招聘</h1>';
 await assert.rejects(v4ReadEmployerJob(u,{fetcher:async()=>new Response(html,{headers:{'content-type':'text/html'}})}),/V4_COMMERCIAL_BOARD_EXCLUDED/);
});

test('curated V4 retains all candidates beyond the 500 target and scores before globally selecting reports',async()=>{
 const jobs=Array.from({length:502},(_,i)=>({...row,company:'新企业'+(i+1),title:'区域运营岗位'+(i+1),url:'https://careers.new-employer.cn/roles/'+(i+1),fit_summary:'适合区域运营经验',requirements:'渠道运营和经销商业务流程'}));
 const board={...jobs[0],url:'https://www.zhipin.com/job_detail/123.html'},duplicate={...jobs[0],url:jobs[0].url+'?utm_source=search'},generic={company:'待核实',title:'职位详情待核实',location:'上海',url:'https://careers.new-employer.cn/'};
 let searches=0,deep=0,parsed=0;const readIds=new Set(),scoreIds=new Set(),reportIds=[];
 const report={suitable:true,score:92,reason:'真实区域渠道经验与岗位需求对应，评分来自职责与实际简历逐项比较。',resume_quote:'汽车经销商渠道运营',jd_quote:'渠道运营和经销商业务流程',matched:['渠道运营'],gaps:['具体产品经验待核实'],comparisons:[{jd_quote:'渠道运营和经销商业务流程',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'有真实渠道运营经历，与招聘职责直接相关。'}],strengths:'具备实际渠道管理能力。',risks:'没有具体产品经验的证据。',career_development:'可迁移到区域运营方向。',optimization_advice:'突出原有的渠道管理经历。',competition:'已有直接相关经历，但不能推断录用概率。',extra_sections:[{title:'补充研究',content:'岗位具体业务以官网为准。'}]};
 const fetcher=async(u,opts)=>{
  if(!u.endsWith('/responses')){
   const id=Number(new URL(u).pathname.split('/').pop());readIds.add(id);
   if(id===500)return new Response('职位已关闭',{headers:{'content-type':'text/html'}});
   const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'区域运营岗位'+id,hiringOrganization:{name:'新企业'+id,url:'https://careers.new-employer.cn'},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责渠道运营和经销商业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
   return new Response(html,{headers:{'content-type':'text/html'}});
  }
  const payload=JSON.parse(opts.body),input=JSON.parse(payload.input);
  if(payload.instructions.includes('公开招聘来源研究员'))return model({sources:[],research_complete:true,completion_reason:'无其他可靠来源'});
  if(payload.instructions.includes('专业求职研究 AI')){searches++;return model({research_complete:true,completion_reason:'已充分覆盖',jobs:[board,generic,jobs[0],duplicate,...jobs.slice(1)]},jobs.map(j=>j.url));}
  if(payload.instructions.includes('自主整理个人职业画像')){parsed++;return model({profile:{summary:'渠道运营经历',roles:['渠道运营'],facts:[{kind:'work',quote:'汽车经销商渠道运营'}]}});}
  const id=Number(input.job.title.replace('区域运营岗位',''));
  const score=id===498?99:id===497?98:70;
  if(input.established_score!==undefined){
   assert.equal(readIds.size,502,'every candidate attempted before reports');assert.equal(scoreIds.size,501,'every available JD scored before reports');
   deep++;reportIds.push(id);assert.equal(input.established_score,score);
   return model(id===497?{suitable:false,reason:'深度核验发现硬性差距'}:{...report,score});
  }
  scoreIds.add(id);return model({suitable:id!==499,score:id===499?40:score,reason:report.reason,resume_quote:report.resume_quote,jd_quote:report.jd_quote,matched:report.matched,gaps:report.gaps});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{officialOnly:true,curated:true});
 assert.equal(parsed,1);assert.equal(searches,2);
 assert.equal(result.research_report.discovered,502);assert.equal(result.matches.length,50);
 assert.equal(readIds.size,502);assert.equal(scoreIds.size,501);assert.equal(deep,51);
 assert.equal(reportIds[0],498);assert.equal(reportIds[1],497);
 assert.equal(result.native_search.jd_verification.scored,501);
 assert.equal(result.native_search.jd_verification.eligible,502);
 assert.ok(result.research_leads.some(j=>j.title==='区域运营岗位497'&&j.match_score===98));
 assert.equal(result.matches[0].title,'区域运营岗位498');
 assert.ok(result.matches.every(j=>j.research_detail?.comparisons?.length&&j.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'));
 assert.equal(result.can_continue,false);
 assert.equal(result.research_leads.length,451);
 assert.ok(result.research_leads.some(j=>j.title==='区域运营岗位499'&&j.match_score===40));
});
test('curated report rejects invented CV quotes but accepts flexible evidence-backed structure',async()=>{
 const {validateCuratedReport,curatedUrl,candidateKey,concreteCandidate}=await import('../functions/_lib/v4-curated-reports.js');
 const jd='负责渠道运营和经销商业务流程管理。';
 const v={suitable:true,score:88,reason:'依据原文',strengths:'优势',risks:'差距',career_development:'发展',optimization_advice:'建议',competition:'竞争力',resume_quote:'汽车经销商渠道运营',jd_quote:'渠道运营和经销商业务流程',comparisons:[{jd_quote:'渠道运营和经销商业务流程',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'对照原文'}]};
 assert.equal(validateCuratedReport(v,resume,jd).ok,true);
 assert.equal(validateCuratedReport({...v,comparisons:[{...v.comparisons[0],resume_quote:'虚构管理一百家企业'}]},resume,jd).ok,false);
 assert.equal(validateCuratedReport({...v,risks:''},resume,jd).ok,true);
 assert.equal(validateCuratedReport({suitable:false},resume,jd).declined,true);
 assert.equal(curatedUrl(url+'?utm_source=test'),url);
 assert.equal(candidateKey(row),candidateKey({...row,url:url+'?utm_source=x'}));
 assert.equal(concreteCandidate({company:'待核实',title:'职位详情待核实',location:'上海'}),false);
});
test('curated modal renders a single selected report with full detail and horizontal navigation',async()=>{
 const {readFile}=await import('node:fs/promises');
 const ui=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(ui,/singleReport&&i!==currentIndex\?null/);assert.match(ui,/onTouchEnd=/);assert.match(ui,/onWheel=/);assert.match(ui,/<CuratedJobReport detail=/);
 const report=await readFile(new URL('../src/components/CuratedJobReport.tsx',import.meta.url),'utf8');
 assert.match(report,/岗位要求与简历经历逐项对照/);assert.match(report,/detail\.comparisons\.map/);
 assert.doesNotMatch(report,/\.slice\(/);
});

test('refined stage workspace derives discovery animation solely from actual backend events',async()=>{
 const {readFile}=await import('node:fs/promises');
 const panels=await readFile(new URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 const dialog=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/styles/resume-match-dialog.css',import.meta.url),'utf8');
 assert.match(panels,/discovered=report\?\.discovered\?\?all\.length/);
 assert.match(panels,/key=\{discovered\}/);
 assert.match(panels,/width:ratio\+'%'/);
 assert.match(panels,/activity\?\.message/);
 assert.match(panels,/setArrival\(old=>/);
 assert.doesNotMatch(panels,/setInterval|setTimeout|Math\.random|fetch\(/);
 assert.match(dialog,/selection=\{selectedStage\}/);
 assert.match(dialog,/onFollow=\{\(\)=>selectStage\(null\)\}/);
 assert.match(dialog,/showResults&&<>/);
 assert.match(panels,/全部已收到候选岗位/);
 assert.match(panels,/<CuratedJobReport detail=\{scoreJob\.research_detail\}/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/hhba-search-progress>div\{[^}]*transition:width/);
});


test('curated V4 recovers an inaccessible official lead and expands insufficient results without re-scoring previous jobs',async()=>{
 const original='https://careers.recovery-employer.cn/jobs/one',alternate='https://careers.recovery-employer.cn/jobs/one-detail',second='https://careers.recovery-employer.cn/jobs/two';
 const make=(url,title)=>({company:'恢复企业',title,location:'上海',url,source_kind:'employer_official'});
 const one=make(original,'渠道运营一'),two=make(second,'渠道运营二');
 const jd='负责渠道运营和经销商业务流程管理。具有渠道运营经验，能够分析数据及协调业务。';
 let searches=0,recovered=0;const scored=[],reported=[];
 const fetcher=async(u,opts)=>{
  if(!u.endsWith('/responses')){
   if(u===original)return new Response('unavailable',{status:403});
   if(u!==alternate&&u!==second)return new Response('not found',{status:404});
   const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:u===alternate?one.title:two.title,hiringOrganization:{name:one.company,url:'https://careers.recovery-employer.cn'},jobLocation:{address:{addressLocality:'上海'}},description:jd})+'</script>';
   return new Response(html,{headers:{'content-type':'text/html'}});
  }
  const p=JSON.parse(opts.body),i=JSON.parse(p.input);
  if(p.instructions.includes('自主整理个人职业画像'))return model({profile:{summary:'渠道运营经历'}});
  if(p.instructions.includes('公开招聘来源研究员')){recovered++;return model({sources:[{url:alternate}],research_complete:true,completion_reason:'找到同一岗位的官方详情'},[alternate]);}
  if(p.instructions.includes('专业求职研究 AI')){
   searches++;
   const expanded=String(i.recovery_hint).includes('正式推荐')||String(i.recovery_hint).includes('最终仅有')||searches>=3;
   return model({research_complete:true,completion_reason:'已探索其他官方来源',jobs:expanded?[two]:[one]},[expanded?second:original]);
  }
  const assessment={suitable:true,score:i.job.title===two.title?97:85,reason:'原文支持渠道运营',resume_quote:'汽车经销商渠道运营',jd_quote:'渠道运营和经销商业务流程'};
  if(i.established_score!==undefined){reported.push(i.job.title);return model(assessment);}
  scored.push(i.job.title);return model(assessment);
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{officialOnly:true,curated:true});
 assert.ok(searches>=3);assert.equal(recovered,1);
 assert.equal(scored.filter(t=>t===one.title).length,1);
 assert.equal(scored.filter(t=>t===two.title).length,1);
 assert.equal(reported.length,2);
 assert.equal(result.matches.length,2);
 assert.equal(result.matches[0].title,two.title);
 assert.ok(result.matches.some(j=>j.official_url===alternate));
 assert.equal(result.native_search.stage,'partial');
 assert.ok(result.native_search.diagnostics.UNDERFILLED_EXPANSION>=1);
});


test('V4 curated provider interruption does not mark the current research as finished',async()=>{
 const {isV4RetryableProviderError}=await import('../functions/_lib/simple-match-v4.js');
 assert.equal(isV4RetryableProviderError('AI_PROVIDER_RATE_LIMITED'),true);
 assert.equal(isV4RetryableProviderError('AI_PROVIDER_KEY_REJECTED'),false);
 await assert.rejects(()=>v4Match(async()=>new Response(null,{status:429}),provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true}),/AI_PROVIDER_RATE_LIMITED/);
});


test('V4 independently verifies deeply nested public JSON and a multi-page employer authorization chain',async()=>{
 const {v4EmployerAuthorization}=await import('../functions/_lib/v4-open-job-evidence.js');
 const root='https://example-employer.cn/',portal='https://jobs.example-employer.cn/openings',detail='https://jobs.example-employer.cn/post/123';
 let nested={'@type':'JobPosting',title:'运营岗位',hiringOrganization:{name:'示例企业',url:'https://example-employer.cn'},jobLocation:{address:{addressLocality:'上海'}},description:'负责运营管理，具备沟通协调能力。'};
 for(let i=0;i<15;i++)nested={nested};
 const fetcher=async u=>u===root?new Response('<title>示例企业官网</title><a href="'+portal+'">招聘</a>',{headers:{'content-type':'text/html'}}):u===portal?new Response('<a href="'+detail+'">岗位详情</a>',{headers:{'content-type':'text/html'}}):Response.json(nested);
 const jd=await v4ReadEmployerJob(detail,{fetcher});
 assert.equal(jd.title,'运营岗位');assert.equal(jd.full_jd,'负责运营管理，具备沟通协调能力。');
 assert.equal(await v4EmployerAuthorization(detail,'示例企业',[root,portal],{fetcher}),true);
 assert.equal(await v4EmployerAuthorization(detail,'示例企业',root,{fetcher}),false);
});


test('curated V4 performs final AI review even when initial search finds zero candidates',async()=>{
 let searches=0,profileCalls=0;const fixture={...row};
 const jd='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:fixture.title,hiringOrganization:{name:fixture.company,url:'https://careers.other-motors.cn'},jobLocation:{address:{addressLocality:'上海'}},description:'负责渠道运营和经销商业务流程管理，具备沟通协调能力。'})+'</script>';
 const fetcher=async(u,opts)=>{
  if(!u.endsWith('/responses'))return new Response(jd,{headers:{'content-type':'text/html'}});
  const p=JSON.parse(opts.body),input=JSON.parse(p.input);
  if(p.instructions.includes('自主整理个人职业画像')){profileCalls++;return model({profile:{summary:'渠道运营经历'}});}
  if(p.instructions.includes('专业求职研究 AI')){
   searches++;
   const review=input.review_context!==null;
   return model({research_complete:true,completion_reason:'已复查官方招聘来源',jobs:review?[fixture]:[]},review?[url]:[]);
  }
  return model({suitable:true,score:85,reason:'原文支持',resume_quote:'汽车经销商渠道运营',jd_quote:'渠道运营和经销商业务流程'});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{officialOnly:true,curated:true});
 assert.equal(profileCalls,1);
 assert.ok(searches>=2);
 assert.equal(result.matches.length,1);
 assert.ok(result.native_search.diagnostics.AI_FINAL_REVIEW>=1);
 assert.equal(result.native_search.stage,'partial');
});


test('V4 dynamic page reading uses a public-origin-scoped, read-only browser action',async()=>{
 const {v4RenderPublicJobDocument}=await import('../functions/_lib/v4-open-job-evidence.js');
 let captured;
 const browser={quickAction:async(action,args)=>{captured={action,args};return new Response('<title>区域运营岗位</title><p>负责渠道运营及门店管理。</p>',{headers:{'content-type':'text/html'}})}};
 const result=await v4RenderPublicJobDocument(url,{browser});
 assert.equal(captured.action,'content');
 assert.equal(captured.args.url,url);
 assert.ok(new RegExp(captured.args.allowRequestPattern[0]).test(url));
 assert.ok(!new RegExp(captured.args.allowRequestPattern[0]).test('https://careers.other-motors.cn.evil.cn/'));
 assert.equal(result.rendered,true);
 assert.match(result.plain,/负责渠道运营/);
 await assert.rejects(()=>v4RenderPublicJobDocument('https://127.0.0.1/',{browser}),/V4_UNSAFE_URL/);
 await assert.rejects(()=>v4RenderPublicJobDocument(url,{browser:{quickAction:async()=>new Response(null,{status:429})}}),/V4_BROWSER_QUOTA_OR_RATE_LIMIT/);
});


test('research memory pages preserve every candidate without a hard count limit',async()=>{
 const {v4ResearchMemoryPage}=await import('../functions/_lib/v4-research-tools.js');
 const data=Array.from({length:730},(_,i)=>({id:i,text:'candidate '.repeat(50)}));
 const collected=[];let cursor=0;
 do{const page=v4ResearchMemoryPage(data,cursor,4000);collected.push(...page.items);cursor=page.next_cursor;}while(cursor!==null);
 assert.deepEqual(collected,data);
});
test('AI-selected tools can read public source windows and reject unrelated URLs',async()=>{
 const {v4RunResearchAction}=await import('../functions/_lib/v4-research-tools.js');
 const content='A'.repeat(3000000);
 const opts={collections:{candidates:[],sources:[url],unresolved:[]},knownUrls:new Set([url]),fetcher:async()=>new Response(content,{headers:{'content-type':'text/plain'}})};
 const first=await v4RunResearchAction({type:'read_page',mode:'window',url,offset:0},opts);
 assert.equal(first.ok,true);assert.equal(first.complete_document,false);assert.equal(first.next_offset,262144);
 const next=await v4RunResearchAction({type:'read_page',mode:'window',url,offset:first.next_offset},opts);
 assert.equal(next.offset,262144);assert.equal(next.text.length,262144);
 const rejected=await v4RunResearchAction({type:'read_page',url:'https://private.invalid/'},opts);
 assert.equal(rejected.ok,false);
});


test('V4 recognizes explicit upstream context overflow without claiming completion',async()=>{
 await assert.rejects(()=>v4Call(async()=>Response.json({error:{code:'context_length_exceeded'}},{status:400}),provider,{input:'synthetic'}),/AI_PROVIDER_CONTEXT_TOO_LARGE/);
});


test('V4 model-selected batches retain multiple candidate groups and support scoring/report research',async()=>{
 const second={...row,title:'区域运营支持',url:url+'-second'};
 const jd='负责渠道运营和经销商业务流程管理，要求具备渠道运营经验及销售人员培训能力。';
 let search=0,toolBatch=false,profileTools=false,scoreCount=0,reportCount=0;
 const fetcher=async(u,opts)=>{
  if(!u.endsWith('/responses'))return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:u===second.url?second.title:row.title,hiringOrganization:{name:row.company,url:'https://careers.other-motors.cn'},jobLocation:{address:{addressLocality:'上海'}},description:jd})+'</script>',{headers:{'content-type':'text/html'}});
  const p=JSON.parse(opts.body),i=JSON.parse(p.input);
  if(p.instructions.includes('自主整理个人职业画像')){
   if(!i.research_tool_results)return model({research_actions:[{type:'text_page',collection:'resume',offset:0}]});
   profileTools=i.research_tool_results[0].text===resume;return model({profile:{summary:'渠道运营经验'}});
  }
  if(p.instructions.includes('专业求职研究 AI')){
   search++;
   if(search===1)return model({research_complete:false,jobs:[row],positions:[second],research_actions:[{type:'memory',collection:'candidates',cursor:0},{type:'memory',collection:'sources',cursor:0}]},[url,second.url]);
   if(search===2)toolBatch=i.research_tool_result?.results?.length===2&&i.research_tool_result.results[0].items.length===2;
   return model({research_complete:true,completion_reason:'已充分复查',jobs:[]});
  }
  if(!i.research_tool_results)return model({research_actions:[{type:'text_page',collection:'resume',offset:0},{type:'text_page',collection:'jd',offset:0}]});
  assert.equal(i.research_tool_results.length,2);assert.equal(i.research_tool_results[0].text,resume);assert.equal(i.research_tool_results[1].text,jd);
  if(i.established_score!==undefined)reportCount++;else scoreCount++;
  return model({suitable:true,score:85,reason:'原文支持',resume_quote:'汽车经销商渠道运营',jd_quote:'渠道运营和经销商业务流程'});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{curated:true,officialOnly:true});
 assert.equal(result.matches.length,2);assert.equal(scoreCount,2);assert.equal(reportCount,2);assert.ok(toolBatch&&profileTools);
});
test('V4 stage pagination delivers all original pages before accepting a final assessment',async()=>{
 const {v4StageResearchCall}=await import('../functions/_lib/v4-research-tools.js');
 const longResume='简历原文'.repeat(30000),longJd='岗位要求'.repeat(30000),seen={resume:[],jd:[]};
 const r=await v4StageResearchCall(async p=>{
  const i=JSON.parse(p.input);
  if(!i.original_text_pages)throw Object.assign(Error('context'),{code:'AI_PROVIDER_CONTEXT_TOO_LARGE'});
  for(const page of i.research_tool_results||[])seen[page.collection].push(page.offset);
  return {status:'completed',output:[],value:{score:85}};
 },{instructions:'test',input:JSON.stringify({resume_text:longResume,job:{full_jd:longJd}})},{parse:r=>r.value,resume:longResume,jd:longJd});
 assert.equal(r.value.score,85);assert.ok(seen.resume.length>=2&&seen.jd.length>=2);
});


test('V4 public evidence ledger retains old tool pages and exposes exact text by record index',async()=>{
 const {v4RememberPublicResult,v4EvidencePage,v4EvidenceIndex}=await import('../functions/_lib/v4-research-tools.js');
 const ledger=[];
 const first={type:'read_page',ok:true,url,mode:'static',text:'第一轮招聘原文',offset:0};
 v4RememberPublicResult(ledger,first);v4RememberPublicResult(ledger,first);
 v4RememberPublicResult(ledger,{...first,text:'更新后的招聘原文'});
 assert.equal(ledger.length,2);assert.equal(v4EvidenceIndex(ledger).length,2);
 assert.equal(v4EvidencePage(ledger,{index:0,offset:0},1000).text,first.text);
 assert.equal(v4EvidencePage(ledger,{index:1,offset:0},1000).text,'更新后的招聘原文');
 v4RememberPublicResult(ledger,{type:'text_page',ok:true,collection:'resume',text:'私有原文'});
 assert.equal(ledger.length,2);
});


test('V4 stage retains earlier public evidence while later tool results arrive',async()=>{
 const {v4StageResearchCall}=await import('../functions/_lib/v4-research-tools.js');
 const ledger=[];let calls=0;
 const result=await v4StageResearchCall(async p=>{
  const i=JSON.parse(p.input);calls++;
  if(calls===1)return {value:{research_action:{type:'read_page',url,mode:'static'}}};
  if(calls===2)return {value:{research_action:{type:'text_page',collection:'resume',offset:0}}};
  if(calls===3){assert.equal(i.research_evidence.total,2);return {value:{research_action:{type:'evidence',index:0,offset:0}}};}
  assert.equal(i.research_tool_results[0].text,'官方岗位原文');return {value:{score:85}};
 },{instructions:'test',input:JSON.stringify({resume_text:resume})},{parse:r=>r.value,sourceUrls:[url],resume,ledger,fetcher:async()=>new Response('官方岗位原文',{headers:{'content-type':'text/plain'}})});
 assert.equal(result.value.score,85);assert.equal(ledger.length,1);assert.equal(ledger[0].text,'官方岗位原文');
});
