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


test('V4 preserves long resume and preference and does not stop on missing completion flag',async()=>{
 const longResume=resume+'经历'.repeat(15000)+'独特末尾经历';
 const hint='全国'.repeat(100)+'末尾意向';
 let calls=0;
 const result=await v4Match(async(u,options)=>{
  if(!u.endsWith('/responses'))return new Response('blocked',{status:403});
  const input=JSON.parse(JSON.parse(options.body).input);
  assert.equal(input.resume_text,longResume);
  assert.equal(input.preferred_job_or_city,hint);
  calls++;
  return model({...(calls===2?{research_complete:true}:{}),jobs:[row]},[url]);
 },provider,longResume,hint);
 assert.equal(calls,2);
 assert.equal(result.matches.length,1);
});
test('V4 removes local request and response size caps without changing legacy defaults',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {redactForModel}=await import('../functions/_lib/resume-match-core.js');
 const long='经历'.repeat(20000)+'末尾';
 assert.equal(redactForModel(long,{unbounded:true}),long);
 assert.equal(redactForModel(long).length,20000);
 const endpoint=await readFile(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(endpoint,/55000|22000|slice\\(0,20000\\)|slice\\(0,80\\)/);
 const service=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.match(service,/!MATCH_V4_PREVIEW&&buffer.length>320000/);
 assert.match(service,/!MATCH_V4_PREVIEW&&file.size>LIMIT/);
});


test('V4 is the ordinary HHBA matching route and document parsing opts out of business caps',async()=>{
 const {readFile}=await import('node:fs/promises');
 const service=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const {wordXmlToText}=await import('../src/services/docxProfile.mjs');
 const {extractPdfText}=await import('../src/services/pdfProfile.mjs');
 assert.doesNotMatch(service,/get\('v4'\)==='1'/);
 assert.match(page,/maxLength=\{MATCH_V4_PREVIEW\?undefined:20000\}/);
 assert.match(page,/maxLength=\{MATCH_V4_PREVIEW\?undefined:80\}/);
 const long='真实工作经历'.repeat(10000);
 const xml='<w:document><w:body><w:p><w:t>'+long+'</w:t></w:p></w:body></w:document>';
 assert.equal(wordXmlToText(xml,{unbounded:true}),long);
 const buffer=new Uint8Array(4*1024*1024);buffer.set(new TextEncoder().encode('%PDF-1.7'));
 const result=await extractPdfText(buffer.buffer,{unbounded:true,loadPdfJs:async()=>({getDocument:()=>({promise:Promise.resolve({numPages:16,getPage:async()=>({getTextContent:async()=>({items:[{str:long}]})})}),destroy:async()=>{}})})});
 assert.equal(result.pages,16);
 assert.ok(result.text.length>50000);
});
test('V4 continuation excludes every previously found URL and can be requested after completion',async()=>{
 const previous=Array.from({length:60},(_,i)=>'https://careers.company.cn/job/'+i);
 const newUrl='https://careers.company.cn/job/new';
 const result=await v4Match(async(u,options)=>{
  if(!u.endsWith('/responses'))return new Response('blocked',{status:403});
  const input=JSON.parse(JSON.parse(options.body).input);
  assert.equal(input.previous_search_urls.length,60);
  return model({research_complete:true,jobs:[{...row,url:previous[0]},{...row,url:newUrl}]},[previous[59],newUrl]);
 },provider,resume,'全国',{excludeUrls:previous});
 assert.deepEqual(result.matches.map(x=>x.official_url),[newUrl]);
 assert.equal(result.can_continue,true);
});
test('V4 JD extraction preserves long legitimate sections',async()=>{
 const {extractOfficialJdSections,htmlToText}=await import('../functions/_lib/official-job-evidence.js');
 const lines=['岗位职责',...Array.from({length:140},(_,i)=>'负责渠道运营工作 '+i+' 详细要求'.repeat(40)),'任职要求','具有真实工作经历和团队协作能力','具有销售数据分析经验'];
 const jd=extractOfficialJdSections(lines.join('\n'),{unbounded:true});
 assert.ok(jd.sections.length>120);
 assert.ok(jd.full_jd.length>24000);
 assert.ok(htmlToText('<p>'+('岗位职责'.repeat(30000))+'</p>',{unbounded:true}).length>100000);
});


test('V4 search yields one round to renew the hosting request budget without a total round cap',async()=>{
 let requests=0;
 const result=await v4Match(async(u)=>{
  requests++;
  assert.ok(u.endsWith('/responses'),'no employer-page subrequests are spent during this search round');
  return model({research_complete:false,jobs:[row]},[url]);
 },provider,resume,'全国',{oneRound:true,skipEnrich:true});
 assert.equal(requests,1);
 assert.equal(result.research_pending,true);
 assert.equal(result.matches.length,1);
 const next=await v4Match(async()=>model({research_complete:true,jobs:[{...row,url:'https://jobs.other-motors.cn/second'}]}),
  provider,resume,'全国',{oneRound:true,skipEnrich:true,excludeUrls:[url]});
 assert.equal(next.research_pending,false);
 assert.equal(next.matches.length,1);
});

test('V4 saves independently fetched structured JD and the existing optimizer can hydrate it',async()=>{
 const {prepareV4JobForOptimization}=await import('../functions/_lib/v4-jd-bridge.js');
 const {hydrateVerifiedJobRequirements}=await import('../functions/_lib/job-jd-archive.js');
 const files=new Map();
 const env={HHBA_JOB_JD_DB:{prepare:()=>({bind:()=>({first:async()=>null})})},
  HHBA_JOB_JD_R2:{put:async(key,value)=>files.set(key,value),get:async key=>files.has(key)?{text:async()=>files.get(key)}:null}};
 const html='<script type="application/ld+json">'+JSON.stringify({
  '@type':'JobPosting',title:row.title,hiringOrganization:{name:row.company,url:'https://careers.other-motors.cn'},
  jobLocation:{address:{addressLocality:'上海'}},
  description:'<p>岗位职责</p><p>负责区域渠道运营和经销商业务流程管理。</p><p>负责销售人员培训以及经营数据的跟踪分析。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，能够提供门店改善方案。</p><p>具备跨团队沟通和业务数据分析能力。</p>'
 })+'</script>';
 const patch=await prepareV4JobForOptimization(env,url,{expectedTitle:row.title,fetcher:async()=>new Response(html,{headers:{'content-type':'text/html'}})});
 assert.match(patch.jd_version_id,/^jd_[a-f0-9]{32}$/);
 const trusted=await hydrateVerifiedJobRequirements(env,{title:'客户端文字',official_url:url,jd_version_id:patch.jd_version_id,jd_sha256:patch.jd_sha256,requirements:'虚构要求'});
 assert.equal(trusted.title,row.title);
 assert.ok(trusted.requirements.includes('渠道运营和经销商业务流程'));
 assert.doesNotMatch(trusted.requirements,/虚构要求/);
 await assert.rejects(()=>hydrateVerifiedJobRequirements(env,{official_url:url,jd_version_id:patch.jd_version_id,jd_sha256:'0'.repeat(64)}),/JD_JOB_IDENTITY_MISMATCH/);
});

test('V4 OCR requires candidate authorization and explicit file-sharing consent; transmits PDF and redacts recognized text',async()=>{
 const db={prepare(sql){return {bind(){return {
  async first(){if(sql.includes('hhba_auth_sessions'))return {phone:'13911110000',revoked:0,expires_at:new Date(Date.now()+60000).toISOString()};
   if(sql.includes('hhba_auth_users'))return {role:'candidate'};return null;},
  async run(){return {success:true}}
 }}}}};
 const env={HHBA_AGENT_RELAY_API_KEY:key,HHBA_MATCH_V4_READY:'1',HHBA_PNVS_AUTH_DB:db};
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(u,opts)=>{
  calls++;const payload=JSON.parse(opts.body);
  assert.equal(payload.input[0].content[0].type,'input_file');
  assert.match(payload.input[0].content[0].file_data,/^data:application\/pdf;base64,/);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'真实工作经历：负责渠道运营与人员培训。 synthetic@example.com'}]}]});
 };
 const make=(consent,auth=true)=>new Request('https://hhba.work/api/match-v4/ocr',{method:'POST',
  headers:{Origin:'https://hhba.work','Content-Type':'application/octet-stream','X-HHBA-Resume-Format':'pdf',
   ...(auth?{Authorization:'Bearer test-token'}:{}),...(consent?{'X-HHBA-OCR-Consent':'v4-resume-ocr-v1'}:{})},
  body:'%PDF-1.7\n'+('synthetic data '.repeat(4))+'\n%%EOF'});
 try{
  assert.equal((await onRequest({request:make(true,false),env})).status,401);
  assert.equal((await onRequest({request:make(false),env})).status,403);
  assert.equal(calls,0);
  const result=await (await onRequest({request:make(true),env})).json();
  assert.equal(result.ok,true);
  assert.equal(result.partial,false);
  assert.match(result.text,/邮箱已隐藏/);
  assert.equal(calls,1);
 }finally{globalThis.fetch=old}
});


test('V4 provider origin can be configured by the server only',()=>{
 const custom=v4Provider({HHBA_AGENT_RELAY_API_KEY:key,HHBA_V4_BASE_URL:'https://api.example.net/v1/'});
 assert.equal(custom.baseUrl,'https://api.example.net/v1');
 assert.equal(v4Provider({HHBA_AGENT_RELAY_API_KEY:key,HHBA_V4_BASE_URL:'http://api.example.net/v1'}),null);
});

test('V4 suggestion parser preserves more than twelve distinct suggestions',async()=>{
 const {parseSuggestions}=await import('../functions/_lib/resume-ai-provider.js');
 const items=Array.from({length:20},(_,i)=>({id:'s'+i,blockId:'b'+i,action:'replace',original:'原文字',proposed:'真实经历'.repeat(450),rationale:'依据原文',jobRequirement:'岗位要求'}));
 assert.equal(parseSuggestions({suggestions:items},items.map(x=>x.blockId),{unbounded:true}).length,20);
});


test('V4 carries research summary and actual round number into a new hosting request',async()=>{
 const first=await v4Match(async()=>model({research_complete:false,research_summary:'已探索汽车渠道岗位，下一步研究零售运营。',profile:{roles:['区域运营']},jobs:[row]},[url]),provider,resume,'全国',{oneRound:true,skipEnrich:true});
 const next=await v4Match(async(u,opts)=>{
  const input=JSON.parse(JSON.parse(opts.body).input);
  assert.equal(input.research_round,2);assert.match(input.previous_research.summary,/零售运营/);
  assert.ok(input.previous_search_urls.includes(url));
  return model({research_complete:true,jobs:[]},[]);
 },provider,resume,'全国',{oneRound:true,skipEnrich:true,researchContext:first.research_context,excludeUrls:[url]});
 assert.equal(next.research_context.round,2);assert.equal(next.research_pending,false);
});
test('V4 provider selection cannot silently fall back to a legacy provider',async()=>{
 const {selectProvider}=await import('../functions/_lib/resume-ai-provider.js');
 assert.throws(()=>selectProvider({HHBA_MATCH_V4_READY:'1',HHBA_MATCH_DEEPSEEK_KEY:'fake-key'}),/AI_PROVIDER_NOT_CONFIGURED/);
});


test('V4 reassessment readiness never depends on the legacy daily quota ledger',async()=>{
 const {onRequestGet}=await import('../functions/api/resume-reassess.js');
 const env={HHBA_MATCH_V4_READY:'1',HHBA_AGENT_RELAY_API_KEY:key,
  HHBA_JOB_JD_DB:{prepare(){throw Error('Unexpected quota query')}},
  HHBA_JOB_JD_R2:{get(){},put(){}},
  HHBA_PNVS_AUTH_DB:{prepare(){throw Error('Unexpected quota query')}}};
 const data=await (await onRequestGet({env})).json();
 assert.equal(data.kind,'HHBA_RESUME_REASSESS_V4');
 assert.equal(data.ranking_version,'HHBA_AI_VERIFIED_JD_V4');
});

test('V4 authoring keeps all real source quotations while rejecting invented evidence',async()=>{
 const {validateAuthoring,numberTokens}=await import('../functions/_lib/resume-rewrite-provider.js');
 const quotes=Array.from({length:25},(_,i)=>'真实工作证据'+i);
 const block={id:'source',text:quotes.join('；')};
 assert.equal(validateAuthoring(block,block.text,quotes,numberTokens(block.text),{unbounded:true}),null);
 assert.equal(validateAuthoring(block,block.text,[...quotes,'虚构资格'],numberTokens(block.text),{unbounded:true}),'SOURCE_QUOTE_NOT_FOUND');
});
