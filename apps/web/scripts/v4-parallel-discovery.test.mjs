import test from 'node:test';
import assert from 'node:assert/strict';
import {runDiscoveryWave,nextDiscoveryWidth,admittedDiscoveryWidth,combineDiscovery,discoveryLaneContext} from '../functions/_lib/v4-parallel-discovery.js';
import {v4Match,renderCandidatePreview} from '../functions/_lib/simple-match-v4.js';
const resume='本人负责汽车经销商渠道运营，区域销售督导、团队培训、销售数据分析、项目管理和客户服务。';
const profile={summary:'汽车经销商渠道运营',roles:['区域销售督导','运营管理'],skills:[],facts:[{kind:'work',quote:'汽车经销商渠道运营'}],education:null};
const job=i=>({url:'https://careers.employer'+i+'.cn/jobs/'+i,company:'企业'+i,title:'运营岗位'+i,location:'上海',source_kind:'employer_official'});
const model=(value,urls=[])=>new Response(JSON.stringify({status:'completed',output:[...(urls.length?[{type:'web_search_call',action:{query:'企业官网运营岗位',sources:urls.map(url=>({url}))}}]:[]),{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}),{headers:{'Content-Type':'application/json'}});
test('actual V4 discovery overlaps three provider calls, deduplicates and preserves all successful lanes',async()=>{
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let inFlight=0,peak=0,calls=0;
 const fetcher=async(url,opts)=>{
  const payload=JSON.parse(opts.body),input=JSON.parse(payload.input);
  if(!payload.tools)return model({profile});
  calls++;inFlight++;peak=Math.max(peak,inFlight);
  await new Promise(r=>setTimeout(r,30));
  inFlight--;
  if(input.parallel_lane===2)return new Response('{}',{status:429});
  const jobs=input.parallel_lane?[job(1),job(2),job(3)]:[job(1),job(4)];
  return model({profile,jobs,research_complete:true,completion_reason:'test'},jobs.map(j=>j.url));
 };
 const first=await v4Match(fetcher,provider,resume,'',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true});
 const wave=await v4Match(fetcher,provider,resume,'',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:first.checkpoint});
 assert.equal(calls,3);assert.equal(peak,3);assert.equal(wave.status,'CONTINUE');
 assert.equal(wave.checkpoint.rows.length,4);assert.equal(wave.checkpoint.discoveryWidth,1);
 assert.equal(wave.checkpoint.diagnostics.PARALLEL_AI_PROVIDER_RATE_LIMITED,1);
 assert.ok(wave.checkpoint.rows.every(([,j])=>!j.match_score));
 assert.equal(wave.checkpoint.toolUrls.length,4);
});
test('enabled independent JD queue avoids a second in-process verifier inside discovery',async()=>{
 const {v4ManagedResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const runEnv={HHBA_MATCH_V4_READY:'1',HHBA_V4_PARALLEL_RESEARCH:'1',
  HHBA_V4_JOB_QUEUE_ENABLED:'1',HHBA_V4_JOB_EXECUTOR_ENABLED:'1'};
 const budget=v4ManagedResourceBudget({background:true});
 const original=job(1),source=job(2),calls=[],events=[],providerStages=[];
 const fetcher=async(u,options)=>{
  if(!u.endsWith('/responses')){calls.push({type:'source_read',url:u});return new Response('unavailable',{status:503});}
  const payload=JSON.parse(options.body);calls.push({type:'provider',payload});
  return model({research_complete:false,continue_search:true,jobs:[source],
   reviewed_sources:[],completion_reason:'synthetic wave'},[source.url]);
 };
 const cp={phase:'research',round:1,rows:[[original.url,original]],profile,
  sourceLeads:[],toolUrls:[original.url],liveDeliveryTurn:'verification',diagnostics:{}};
 const result=await v4Match(fetcher,{key:'synthetic',baseUrl:'https://provider.invalid/v1',model:'test',onCallState:(kind,stage)=>{if(kind==='start')providerStages.push(stage);}},
  resume,'全国',{env:runEnv,checkpoint:cp,resourceBudget:budget,
   curated:true,officialOnly:true,stepMode:true,parallelResearch:true,
   deferDiscoverySnapshots:true,onActivity:(stage,message)=>events.push({stage,message})});
 assert.equal(result.status,'CONTINUE');
 assert.equal(result.checkpoint.phase,'research');
 assert.ok(result.checkpoint.rows.some(([u])=>u===original.url),'existing candidate survives research');
 assert.ok(calls.some(c=>c.type==='provider'),'AI discovery still runs');
 assert.ok(providerStages.some(x=>x==='discovery'),'normal AI search and its public-source reading remain enabled');
 assert.ok(providerStages.every(x=>!['jd','verification','score','report'].includes(x)),
  'discovery never starts an internal JD/score/report model operation while dedicated workers own those jobs');
 assert.ok(events.every(x=>x.stage!=='reading'&&x.stage!=='scoring'),
  'same Pages phase must not spawn another internal JD verification coordinator');
 const core=(await import('node:fs/promises')).readFile;
 const sourceCode=await core(new URL('../functions/_lib/simple-match-v4.js',import.meta.url),'utf8');
 assert.ok(sourceCode.includes('if(fullResearch&&parallelResearch&&!pipelineChild&&!independentExecutor&&deferDiscoverySnapshots'),
  'regression must not silently re-enable the duplicate in-process research/verification pipeline');
});

test('discovery capacity grows with available hosting headroom instead of fixed three lanes',()=>{
 const roomy={remainingResearch:()=>36,availableFor:()=>32};
 const tight={remainingResearch:()=>9,availableFor:()=>2};
 assert.equal(admittedDiscoveryWidth(6,roomy),6);
 assert.equal(admittedDiscoveryWidth(6,tight),1);
 assert.equal(admittedDiscoveryWidth(6,roomy,{inFlight:2}),4);
 assert.equal(admittedDiscoveryWidth(4,null),4);
});
test('coordinator failure retains authentic independent search data and does not mark completion',async()=>{
 const p=await runDiscoveryWave(async()=>{throw Object.assign(Error(),{code:'AI_PROVIDER_UPSTREAM_ERROR'})},async()=>({data:{jobs:[job(1)],research_complete:true,reviewed_sources:[{url:'untrusted'}]},sources:[job(1).url],response:{status:'completed',output:[{type:'web_search_call'}]}}),3);
 const lanes=p.independent.map(x=>x.value);
 const merged=combineDiscovery(null,lanes,{coordinatorFailed:true});
 assert.equal(merged.data.jobs.length,2);assert.equal(merged.data.research_complete,false);assert.equal(merged.data.reviewed_sources,undefined);assert.equal(merged.response.output.length,2);
});
test('width adapts to provider health, no job or search round cap; roles are diversity hints',()=>{
 assert.equal(nextDiscoveryWidth(3,[]),4);assert.equal(nextDiscoveryWidth(6,['AI_PROVIDER_RATE_LIMITED']),3);assert.equal(nextDiscoveryWidth(1,[]),2);
 assert.equal(discoveryLaneContext({profile:{target_roles:['运营','销售']},round:1,lane:2,width:3}).independent_direction_hint,'销售');
});

test('pipeline merges a completed verification, preserving search state and changed candidate rechecks',async()=>{
 const {candidateRevision,pendingVerification,verificationSnapshot,mergePipelineCheckpoint}=await import('../functions/_lib/v4-research-pipeline.js');
 const a=job(1),b=job(2),changed={...a,requirements:'new JD evidence'};
 const old={phase:'research',rows:[[a.url,a],[b.url,b]],diagnostics:{A:1},publicEvidence:[{url:a.url,text:'old'}]};
 const attempt=pendingVerification(old).slice(0,1);
 const verify={...verificationSnapshot(old),phase:'verification',matches:[{official_url:a.url,research_candidate_url:a.url,match_score:88}],scored:1,read:1,diagnostics:{A:1,B:1},publicEvidence:[...old.publicEvidence,{url:b.url,text:'verified'}]};
 const discover={...old,rows:[[a.url,changed],[b.url,b],[job(3).url,job(3)]],diagnostics:{A:2},publicEvidence:[...old.publicEvidence,{url:b.url,text:'search'}]};
 const result=mergePipelineCheckpoint(old,discover,verify,attempt);
 assert.equal(result.priorState.scored,1);
 assert.equal(result.processedEvidence[0][1],candidateRevision(a));
 assert.equal(pendingVerification(result).length,3,'changed evidence must still be verified');
 assert.deepEqual(result.diagnostics,{A:2,B:1,PIPELINE_VERIFICATION_ATTEMPTS:1});
 assert.equal(result.publicEvidence.length,3);assert.equal(result.publicEvidence[1].text,'search');
 const next=mergePipelineCheckpoint(old,{...old,phase:'verification',next:0},verify,attempt);
 assert.equal(next.matches[0].match_score,88);assert.equal(next.scored,1);assert.equal(pendingVerification(next).length,1);
 assert.equal(old.processedEarlier,undefined);
});
test('pipeline retains successful search when verification fails, and filters rejected board results',async()=>{
 const {mergePipelineCheckpoint}=await import('../functions/_lib/v4-research-pipeline.js');
 const a=job(1),old={phase:'research',rows:[[a.url,a]]};
 const discovery={...old,rows:[...old.rows,[job(2).url,job(2)]]};
 assert.deepEqual(mergePipelineCheckpoint(old,discovery,null,[]),discovery);
 const result=mergePipelineCheckpoint(old,discovery,{rejectedBoards:[a.url],matches:[{official_url:a.url}],read:0},[[a.url,a]]);
 assert.equal(result.rows.length,1);assert.deepEqual(result.priorState.matches,[]);
});

test('candidate preview never claims a completed assessment or displays a search score',()=>{
 const j={...job(7),score:99,resume_quote:resume,reason:'search hypothesis',matched:['unverified']};
 const preview=renderCandidatePreview(j,j.url,resume,true,0,new Set([j.url]));
 assert.equal(preview.evidence_status,'RESEARCH_PENDING');assert.equal(preview.match_score,null);assert.equal(preview.reference_score,0);assert.equal(preview.recommendation_reason,'');assert.deepEqual(preview.matched,[]);assert.match(preview.score_basis,/尚未完成/);assert.equal(preview.jd_source_status,undefined);
});

test('pipeline allocates idle transport slots to verification backlog without reducing research target',async()=>{
 const {pipelineWidths,verificationSnapshot}=await import('../functions/_lib/v4-research-pipeline.js');
 assert.deepEqual(pipelineWidths({discoveryWidth:4},1),{discovery:4,verification:1});
 assert.deepEqual(pipelineWidths({discoveryWidth:4},5),{discovery:3,verification:2});
 assert.deepEqual(pipelineWidths({discoveryWidth:4},100),{discovery:2,verification:3});
 assert.deepEqual(pipelineWidths({discoveryWidth:4,pipelineVerificationWidth:1},100),{discovery:4,verification:1});
 assert.deepEqual(pipelineWidths({discoveryWidth:4,pipelineVerificationWidth:4},100),{discovery:1,verification:4});
 assert.equal(verificationSnapshot({},3).verificationBatch,3);
});
test('a fast independent JD is scored before a slow sibling page finishes',async()=>{
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const a=job(1),b=job(2);
 let fastScored=false,slowFinished=false,overlapObserved=false,releaseSlow;
 const slowGate=new Promise(resolve=>{releaseSlow=resolve;});
 const timer=setTimeout(releaseSlow,2000);
 const html=j=>'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:j.title,hiringOrganization:{name:j.company,url:new URL(j.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 const fetcher=async(u,opts)=>{
  if(!u.endsWith('/responses')){
   const j=u===a.url?a:b;
   if(j===b){await slowGate;slowFinished=true;}
   return new Response(html(j),{headers:{'content-type':'text/html'}});
  }
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.job?.title===a.title){fastScored=true;overlapObserved=!slowFinished;releaseSlow();}
  return model({suitable:true,score:88,reason:'渠道经验匹配',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营',matched:['渠道运营'],gaps:[]});
 };
 try{
 const result=await v4Match(fetcher,provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'verification',next:0,rows:[[a.url,a],[b.url,b]],profile,toolUrls:[a.url,b.url],verificationBatch:2}});
 assert.equal(result.checkpoint.phase,'reporting');
 assert.equal(result.checkpoint.scored,2);
 assert.ok(fastScored&&slowFinished&&overlapObserved);
 }finally{clearTimeout(timer);releaseSlow();}
});

test('batch scoring keeps full JD, independent evidence and only valid unique IDs',async()=>{
 const {batchScoringPayload,collectBatchAssessments,partitionReadyScores}=await import('../functions/_lib/v4-batch-scoring.js');
 const items=[{id:'a',job:{full_jd:'区域运营岗位完整原文甲',title:'甲'}},{id:'b',job:{full_jd:'区域运营岗位完整原文乙',title:'乙'}},{id:'c',job:{full_jd:'区域运营岗位完整原文丙',title:'丙'}}];
 const cv='真实汽车经销商渠道运营经历';
 const value={suitable:true,score:85,reason:'具有真实经验',resume_quote:'汽车经销商渠道运营'};
 const input=JSON.parse(batchScoringPayload(items,cv,'全国').input);
 assert.deepEqual(input.jobs,items.map(x=>({id:x.id,...x.job})));
 const results=collectBatchAssessments({assessments:[{...value,id:'a',jd_quote:'完整原文甲'},{...value,id:'b',jd_quote:'完整原文甲'},{...value,id:'c',jd_quote:'完整原文丙'},{...value,id:'c',jd_quote:'完整原文丙'},{...value,id:'fake',jd_quote:'完整原文乙'}]},items,cv);
 assert.deepEqual([...results.keys()],['a']);
 assert.deepEqual(partitionReadyScores(items,cv,1).flat(),items);
});
test('coalesced scoring makes one model request, sends invalid item alone to individual fallback',async()=>{
 const {makeBatchScorer}=await import('../functions/_lib/v4-batch-scoring.js');
 let calls=0;const notes=[];
 const score=makeBatchScorer({resume:'真实渠道运营经验',roleHint:'全国',delay:0,parse:x=>x.data,note:x=>notes.push(x),call:async payload=>{
  calls++;const input=JSON.parse(payload.input);assert.equal(input.jobs.length,2);
  return {status:'completed',data:{assessments:[{id:'a',score:87,suitable:true,reason:'匹配',resume_quote:'渠道运营',jd_quote:'原文甲'},{id:'b',score:88,suitable:true,reason:'匹配',resume_quote:'渠道运营',jd_quote:'原文甲'}]}};
 }});
 const result=await Promise.all([score('a',{full_jd:'原文甲'}),score('b',{full_jd:'原文乙'})]);
 assert.equal(calls,1);assert.equal(result[0].score,87);assert.equal(result[1],null);
 assert.ok(notes.includes('AI_SCORE_BATCH_INDIVIDUAL_FALLBACK'));
});
test('batch provider rejection or incomplete response falls back without inventing completed scores',async()=>{
 const {makeBatchScorer}=await import('../functions/_lib/v4-batch-scoring.js');
 for(const call of [async()=>{throw Error('context too large')},async()=>({status:'incomplete',data:{assessments:[]}})]){
  const score=makeBatchScorer({resume:'真实渠道运营经验',delay:0,parse:x=>x.data,call});
  assert.deepEqual(await Promise.all([score('a',{full_jd:'原文甲'}),score('b',{full_jd:'原文乙'})]),[null,null]);
 }
});

test('conditional public JD cache reuses only matching strong origin validation, never applicant data',async()=>{
 const {v4ReadEmployerJob}=await import('../functions/_lib/v4-open-job-evidence.js');
 const objects=new Map(),bucket={get:async k=>objects.has(k)?{text:async()=>objects.get(k)}:null,put:async(k,v)=>objects.set(k,v)};
 const u='https://careers.cache-employer.cn/jobs/1',expected={company:'测试企业',title:'区域运营',location:'上海',resume:'must not persist'};
 const body='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'区域运营',hiringOrganization:{name:'测试企业',url:'https://careers.cache-employer.cn'},jobLocation:{address:{addressLocality:'上海'}},description:'<p>职责：渠道运营、经销商管理。</p><p>任职要求：真实业务分析经验。</p>'})+'</script>';
 let calls=0,conditional=0,changed=false;
 const fetcher=async(url,opts)=>{
  calls++;
  if(opts.headers['If-None-Match']){conditional++;assert.equal(opts.headers['If-None-Match'],'"v1"');if(!changed)return new Response(null,{status:304,headers:{etag:'"v1"'}});}
  return new Response(changed?body.replace('真实业务分析经验','新的独立研究经验'):body,{headers:{'content-type':'text/html',etag:changed?'"v2"':'"v1"'}});
 };
 const first=await v4ReadEmployerJob(u,{fetcher,expected,cacheBucket:bucket});
 const second=await v4ReadEmployerJob(u,{fetcher,expected,cacheBucket:bucket});
 assert.equal(second.full_jd,first.full_jd);assert.equal(calls,2);assert.equal(conditional,1);
 assert.ok([...objects.values()].every(x=>!x.includes('must not persist')));
 changed=true;
 const third=await v4ReadEmployerJob(u,{fetcher,expected,cacheBucket:bucket});
 assert.notEqual(third.full_jd,first.full_jd);assert.equal(conditional,2);
});
test('reuse a completed same-task report only for exact unchanged evidence and score',async()=>{
 const {preserveJobEvidence}=await import('../functions/_lib/v4-jd-research.js');
 const common={company:'企业',title:'区域运营',location:'上海',official_url:'https://careers.employer.cn/jobs/1',source_type:'站外官方招聘',jd_source_status:'VERIFIED_JD',score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',curated_suitable:true,evidence_excerpt:'完整JD',match_score:88};
 const old={...common,report_status:'COMPLETE',research_detail:{reason:'完整研究'},recommendation_reason:'详细理由'};
 assert.equal(preserveJobEvidence(old,{...common}).research_detail,old.research_detail);
 assert.equal(preserveJobEvidence(old,{...common,match_score:89}).research_detail,undefined);
 assert.equal(preserveJobEvidence(old,{...common,evidence_excerpt:'更新JD'}).research_detail,undefined);
 assert.equal(preserveJobEvidence(old,{...common,excluded_closed:true}).excluded_closed,true);
});

test('structured JobPosting retains independent duties, qualifications and skills outside description',async()=>{
 const {v4ReadEmployerJob}=await import('../functions/_lib/v4-open-job-evidence.js');
 const url='https://careers.split-employer.cn/jobs/100';
 const posting={'@type':'JobPosting',title:'区域运营',hiringOrganization:{name:'企业',url:'https://careers.split-employer.cn'},jobLocation:{address:{addressLocality:'上海'}},description:'负责地区运营管理。',responsibilities:['负责渠道建设。','负责团队培训。'],qualifications:'具备业务管理经验。',skills:['数据分析','组织协调']};
 const read=async value=>v4ReadEmployerJob(url,{fetcher:async()=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})});
 const jd=await read(posting);
 for(const value of ['负责地区运营管理。','负责渠道建设。','负责团队培训。','具备业务管理经验。','数据分析','组织协调'])assert.ok(jd.full_jd.includes(value),value);
 assert.equal(jd.source_confirmed,true);
 const partial=await read({...posting,description:'负责地区运营管理……'});
 assert.equal(partial.full_jd,'');assert.equal(partial.vacancy_confirmed,true);assert.ok(partial.partial_jd.includes('负责地区运营管理'));
});
test('complex JD coverage reconstructs the contiguous original rather than dropping intervening requirements',async()=>{
 const {completeJdSpan}=await import('../functions/_lib/v4-jd-completeness.js');
 const doc='导航\n岗位职责：负责渠道运营。\n必须有团队培训经验。\n任职要求：数据分析能力。\n工作安排：全职。\n返回首页';
 const parts=['岗位职责：负责渠道运营。','任职要求：数据分析能力。'];
 const full=completeJdSpan(doc,parts,parts[0],'工作安排：全职。');
 assert.equal(full,'岗位职责：负责渠道运营。\n必须有团队培训经验。\n任职要求：数据分析能力。\n工作安排：全职。');
 assert.equal(completeJdSpan(doc,parts,parts[0],'必须有团队培训经验。'),null);
 assert.equal(completeJdSpan(doc,parts,'虚构开头','工作安排：全职。'),null);
 assert.equal(completeJdSpan(doc+'\n'+parts[0],parts,parts[0],'工作安排：全职。'),null);
});

test('a verified vacancy without a complete JD retains an AI reference assessment in global selection without official evidence promotion',async()=>{
 const {eligibleCuratedScore,qualifiedReport}=await import('../functions/_lib/v4-curated-reports.js');
 const {verifiedMatchReports}=await import('../src/services/verifiedMatchPresentation.mjs');
 const {safeHistoryJobs}=await import('../functions/_lib/match-history.js');
 const reference={company:'测试企业',title:'渠道运营',location:'上海',official_url:'https://careers.ref-employer.cn/jobs/7',source_type:'站外官方招聘',reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'可能负责渠道管理。',reference_jd_basis:'依据岗位名称推断，非官方要求。',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:86,curated_suitable:true,report_status:'COMPLETE',research_detail:{comparisons:[],score_explanation:'真实经历与推断方向匹配。'},v4_source:true};
 assert.equal(eligibleCuratedScore(reference),true);assert.equal(qualifiedReport(reference),true);assert.deepEqual(verifiedMatchReports([reference]),[reference]);
 assert.equal(qualifiedReport({...reference,reference_vacancy_verified:false}),false);
 assert.equal(qualifiedReport({...reference,availability_status:'CLOSED_LISTED'}),false);
 assert.equal(qualifiedReport({...reference,reference_jd:''}),false);
 const saved=safeHistoryJobs([reference])[0];assert.equal(saved.reference_jd,reference.reference_jd);assert.equal(saved.jd_source_status,undefined);assert.equal(saved.score_evidence_status,undefined);assert.equal(saved.evidence_score_status,'AI_REFERENCE_JD_SCORED');
});

test('actual V4 verification keeps a confirmed vacancy with no JD, generates a reference report and skips official archive',async()=>{
 const {qualifiedReport}=await import('../functions/_lib/v4-curated-reports.js');
 const candidate=job(77),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let providerCalls=0;
 const fetcher=async(url,opts)=>{
  if(url===candidate.url)return new Response(JSON.stringify({'@type':'JobPosting',title:candidate.title,hiringOrganization:{name:candidate.company,url:new URL(candidate.url).origin},jobLocation:{address:{addressLocality:'上海'}}}),{headers:{'content-type':'application/json'}});
  if(url.endsWith('/responses')){
   providerCalls++;const input=JSON.parse(JSON.parse(opts.body).input);
   assert.equal(input.job.vacancy_confirmed,true);assert.equal(input.job.title,candidate.title);
   return model({reference_jd:'可能负责汽车渠道运营及门店协作。可能需要渠道数据分析能力。',reference_basis:'岗位名称已确认，职责为AI职业方向推断。',reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'渠道数据分析能力'},quality_review:{status:'complete',explanation:'职责、能力和差距均已分析。',missing:[]},suitable:true,score:87,reason:'简历有实际渠道运营经历，与推断方向相关。',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车渠道运营',matched:['渠道运营'],gaps:['实际资格待企业确认'],comparisons:[{jd_quote:'汽车渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实经历对应推断方向'}],strengths:'渠道运营',risks:'实际职责尚未公开'});
  }
  throw Error('unexpected source '+url);
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 assert.equal(result.checkpoint.phase,'reporting');const saved=result.checkpoint.matches[0];
 assert.equal(providerCalls,1);assert.equal(saved.reference_vacancy_verified,true);assert.equal(saved.reference_jd_kind,'AI_GENERATED_REFERENCE');assert.equal(saved.match_score,87);assert.equal(saved.jd_source_status,undefined);assert.equal(saved.jd_version_id,undefined);assert.equal(saved.score_evidence_status,undefined);assert.equal(qualifiedReport(saved),true);assert.equal(result.checkpoint.scored,0);
});

test('reference score repairs missing evidence without dropping confirmed vacancy',async()=>{
 const candidate=job(78),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let calls=0;
 const fetcher=async(url,opts)=>{
  if(url===candidate.url)return new Response(JSON.stringify({'@type':'JobPosting',title:candidate.title,hiringOrganization:{name:candidate.company,url:new URL(candidate.url).origin},jobLocation:{address:{addressLocality:'上海'}}}),{headers:{'content-type':'application/json'}});
  const input=JSON.parse(JSON.parse(opts.body).input);calls++;
  if(calls>1)assert.ok(input.previous_validation_error);
  return model({reference_jd:'可能负责汽车渠道运营。可能需要渠道数据分析能力。',reference_basis:'方向推断。',reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'渠道数据分析能力'},quality_review:{status:'complete',explanation:'已覆盖可能职责、能力方向和真实经历差距；实际资格未知。',missing:[]},suitable:true,score:86,reason:'相关经历',resume_quote:calls===1?'虚构经历':'汽车经销商渠道运营',jd_quote:'汽车渠道运营',comparisons:[{jd_quote:'汽车渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实经历对应推断职责'},{jd_quote:'渠道数据分析能力',status:'missing',analysis:'尚无直接数据分析证据'}]});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 assert.equal(calls,2);assert.equal(result.checkpoint.matches[0].match_score,86);assert.equal(result.checkpoint.matches[0].reference_jd_kind,'AI_GENERATED_REFERENCE');
});

test('candidate research notes merge across parallel checkpoints without crossing candidate identity or revision',async()=>{
 const {candidateResearchMemory,candidateRevision,mergeCandidateResearchMemory}=await import('../functions/_lib/v4-research-pipeline.js');
 const a=job(1),b=job(2),rows=[[a.url,a],[b.url,b]];
 const left=candidateResearchMemory();left.notes(a.url,candidateRevision(a)).push('official public source a');
 left.notes(b.url,candidateRevision(b)).push('official public source b');
 const right=candidateResearchMemory(structuredClone(left.snapshot()));
 right.notes(a.url,candidateRevision(a),'analysisNotes').push('candidate a assessment');
 assert.deepEqual(right.notes(a.url,candidateRevision(a)),['official public source a']);
 assert.deepEqual(right.notes(b.url,candidateRevision(b),'analysisNotes'),['official public source b']);
 const merged=candidateResearchMemory(mergeCandidateResearchMemory(left.snapshot(),right.snapshot(),rows));
 assert.deepEqual(merged.notes(a.url,candidateRevision(a),'analysisNotes'),['official public source a','candidate a assessment']);
 assert.deepEqual(merged.notes(b.url,candidateRevision(b),'analysisNotes'),['official public source b']);
 const changed={...a,requirements:'updated requirements'};
 assert.deepEqual(merged.notes(a.url,candidateRevision(changed),'analysisNotes'),[]);
 assert.equal(mergeCandidateResearchMemory(left.snapshot(),right.snapshot(),[[a.url,changed],[b.url,b]]).length,1);
});

test('actual OpenAI global ranking reaches provider and persists pool-scoped notes, without polluting discovery notes',async()=>{
 const candidate=job(91),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const match={company:candidate.company,title:candidate.title,location:candidate.location,official_url:candidate.url,source_type:'站外官方招聘',reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'可能负责渠道管理。',reference_jd_basis:'方向推断',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:86,curated_suitable:true,report_status:'COMPLETE',research_detail:{comparisons:[],score_explanation:'真实经历匹配'}};
 let calls=0;
 const result=await v4Match(async(url,opts)=>{
  calls++;const input=JSON.parse(JSON.parse(opts.body).input);
  assert.deepEqual(input.pending_ids,['j1']);
  return model({ordered_ids:['j1'],research_notes:'pool-only ranking observation'});
 },provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,checkpoint:{phase:'reporting',rows:[[candidate.url,candidate]],profile,matches:[match],researchNotes:['discovery-only']}});
 assert.equal(calls,1);assert.deepEqual(result.checkpoint.globalOrder,[candidate.url]);
 assert.equal(result.checkpoint.globalRankState.done,true);assert.deepEqual(result.checkpoint.globalRankState.notes,['pool-only ranking observation']);assert.deepEqual(result.checkpoint.researchNotes,['discovery-only']);
});

test('OpenAI reviews confirmed vacancy for complete JD before falling back to reference',async()=>{
 const candidate=job(92),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let recovery=0,assessment=0;
 const fetcher=async(url,opts)=>{
  if(url===candidate.url)return Response.json({'@type':'JobPosting',title:candidate.title,hiringOrganization:{name:candidate.company,url:new URL(candidate.url).origin},jobLocation:{address:{addressLocality:'上海'}}});
  const input=JSON.parse(JSON.parse(opts.body).input);
  let value;
  if(input.original_url){recovery++;assert.equal(input.confirmed_vacancy,true);value={sources:[],research_complete:true,completion_reason:'公开原文未找到'};}
  else if(input.public_sources){assert.equal(input.job.vacancy_confirmed,true);value={facts:[],inference:'依据岗位方向准备渠道运营案例，非企业要求。',unknowns:['官方完整JD未取得']};}
  else {assessment++;assert.equal(input.job.vacancy_confirmed,true);value={reference_source_anchors:{duties:{kind:'title_direction',url:'',quote:input.job.title},capabilities:{kind:'title_direction',url:'',quote:input.job.title}},reference_jd:'可能负责汽车渠道运营。可能需要渠道数据分析能力。',reference_basis:'方向推断。',reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'渠道数据分析能力'},quality_review:{status:'complete',explanation:'已覆盖可能职责、能力方向和真实经历差距；实际资格未知。',missing:[]},suitable:true,score:86,reason:'相关经历',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车渠道运营',comparisons:[{jd_quote:'汽车渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实经历对应推断职责'},{jd_quote:'渠道数据分析能力',status:'missing',analysis:'尚无直接数据分析证据'}]};}
  return model(value);
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 assert.ok(recovery>=1);assert.equal(assessment,1);assert.equal(result.checkpoint.matches[0].reference_vacancy_verified,true);assert.equal(result.checkpoint.matches[0].match_score,86);assert.equal(result.checkpoint.matches[0].report_status,'COMPLETE');assert.match(result.checkpoint.matches[0].reference_jd,/渠道数据分析能力/);assert.ok(result.checkpoint.matches[0].research_detail.comparisons.length);
});

test('oversized memory records remain losslessly accessible in bounded JSON pages',async()=>{
 const {v4ResearchMemoryPage,v4RunResearchAction}=await import('../functions/_lib/v4-research-tools.js');
 const rows=[{url:'https://careers.company.cn/jobs/1',report:'职责🙂"\\'.repeat(1000)},{url:'second'}];
 const first=v4ResearchMemoryPage(rows,0,256);
 assert.equal(first.items[0].oversized_record,true);assert.equal(first.next_cursor,1);
 let offset=0,rebuilt='';
 do{
  const part=await v4RunResearchAction({type:'memory',collection:'candidates',index:0,offset},{collections:{candidates:rows},budget:256});
  assert.equal(part.ok,true);assert.ok(JSON.stringify([part.text]).length<=256);rebuilt+=part.text;offset=part.next_offset;
 }while(offset!==null);
 assert.deepEqual(JSON.parse(rebuilt),rows[0]);
});

test('OpenAI global ranking switches to focused recovery rather than discarding unfinished pool',async()=>{
 const candidate=job(93),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const match={company:candidate.company,title:candidate.title,location:candidate.location,official_url:candidate.url,source_type:'站外官方招聘',reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'可能负责渠道管理。',reference_jd_basis:'方向推断',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:86,curated_suitable:true,report_status:'COMPLETE',research_detail:{comparisons:[],score_explanation:'真实经历匹配'}};
 let calls=0;
 const fetcher=async(url,opts)=>{
  calls++;const input=JSON.parse(JSON.parse(opts.body).input);
  const value=input.focus_id?{insertions:[{id:input.focus_id,after_id:null}]}:{ordered_ids:[]};
  return model(value);
 };
 const opts={env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true};
 let checkpoint={phase:'reporting',rows:[[candidate.url,candidate]],profile,matches:[match]};
 for(const expected of ['insert','focused_insert','focused_insert']){
  const result=await v4Match(fetcher,provider,resume,'全国',{...opts,checkpoint});
  checkpoint=result.checkpoint;assert.equal(checkpoint.globalRankState.mode,expected);
 }
 assert.equal(calls,3);assert.equal(checkpoint.globalRankState.done,true);assert.deepEqual(checkpoint.globalOrder,[candidate.url]);
});

test('verification scheduler keeps useful concurrency during inexpensive JD recovery and backs off on observed pressure',async()=>{
 const {nextVerificationBatch}=await import('../functions/_lib/v4-jd-research.js');
 assert.equal(nextVerificationBatch(3,true,100,{externalRequests:18,completed:3}),4);
 assert.equal(nextVerificationBatch(3,true,100,{externalRequests:39,completed:3}),3);
 assert.equal(nextVerificationBatch(4,true,100,{externalRequests:48,completed:2}),1);
 assert.equal(nextVerificationBatch(3,false,1,{externalRequests:6,completed:3}),1);
 assert.equal(nextVerificationBatch(4,false,100,{externalRequests:8,completed:4}),6);
 assert.equal(nextVerificationBatch(6,false,100,{externalRequests:12,completed:6}),8);
 assert.equal(nextVerificationBatch(12,false,100,{externalRequests:24,completed:12}),12);
 assert.equal(nextVerificationBatch(8,true,100,{externalRequests:48,completed:8}),6);
 assert.equal(nextVerificationBatch(8,false,2,{externalRequests:16,completed:8}),2);
});

test('activated production V4 OpenAI route can globally compare all eligible candidates',async()=>{
 const candidate=job(94),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const match={company:candidate.company,title:candidate.title,location:candidate.location,official_url:candidate.url,source_type:'站外官方招聘',reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'可能负责渠道管理。',reference_jd_basis:'方向推断',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:86,curated_suitable:true,report_status:'COMPLETE',research_detail:{comparisons:[],score_explanation:'真实经历匹配'}};
 let calls=0;
 const result=await v4Match(async(url,opts)=>{
  calls++;assert.ok(url.endsWith('/responses'));const body=JSON.parse(opts.body),input=JSON.parse(body.input);
  assert.deepEqual(input.pending_ids,['j1']);assert.equal(body.store,false);
  assert.equal(Object.hasOwn(body,'max_output_tokens'),false);
  return model({ordered_ids:['j1'],research_notes:'OpenAI pool research'});
 },provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,checkpoint:{phase:'reporting',rows:[[candidate.url,candidate]],profile,matches:[match]}});
 assert.equal(calls,1);assert.deepEqual(result.checkpoint.globalOrder,[candidate.url]);assert.equal(result.checkpoint.globalRankState.done,true);
});
test('activated V4 OpenAI keeps researching confirmed vacancies before reference JD assessment',async()=>{
 const candidate=job(95),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let recovery=0,assessment=0;
 const fetcher=async(url,opts)=>{
  if(url===candidate.url)return Response.json({'@type':'JobPosting',title:candidate.title,hiringOrganization:{name:candidate.company,url:new URL(candidate.url).origin},jobLocation:{address:{addressLocality:'上海'}}});
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.original_url){recovery++;assert.equal(input.confirmed_vacancy,true);return model({sources:[],research_complete:true,completion_reason:'公开原文未找到'});}
  if(input.public_sources){assert.equal(input.job.vacancy_confirmed,true);return model({facts:[],inference:'依据岗位名称准备运营案例，非企业要求。',unknowns:['具体岗位职责未公开']});}
  assessment++;assert.equal(input.job.vacancy_confirmed,true);
  if(assessment===1)return model({reference_jd:'可能负责汽车渠道运营。',reference_basis:'方向推断，实际资格未知。',suitable:true,score:86,reason:'相关经历',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车渠道运营',comparisons:[]});
  assert.match(input.previous_validation_error,/quality_review_incomplete/);
  assert.match(input.previous_validation_error,/reference_duties_and_capabilities_coverage/);
  assert.match(input.previous_validation_error,/reference_source_duties/);
  return model({reference_source_anchors:{duties:{kind:'title_direction',url:'',quote:input.job.title},capabilities:{kind:'title_direction',url:'',quote:input.job.title}},reference_jd:'可能负责汽车渠道运营。可能需要渠道数据分析能力。',reference_basis:'方向推断。',reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'渠道数据分析能力'},quality_review:{status:'complete',explanation:'已覆盖可能职责、能力方向和真实经历差距；实际资格未知。',missing:[]},suitable:true,score:86,reason:'相关经历',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车渠道运营',comparisons:[{jd_quote:'汽车渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实经历对应推断职责'},{jd_quote:'渠道数据分析能力',status:'missing',analysis:'尚无直接数据分析证据'}]});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 assert.ok(recovery>=1);assert.equal(assessment,2);assert.equal(result.checkpoint.matches[0].reference_vacancy_verified,true);assert.equal(result.checkpoint.matches[0].match_score,86);
});

test('independently observed public API hints survive stage restart without becoming verified jobs',async()=>{
 const {v4KnownPublicResearchUrls,v4EvidencePage,v4StageResearchCall}=await import('../functions/_lib/v4-research-tools.js');
 const parent='https://careers.real-employer.cn/jobs/12',api='https://api.real-employer.cn/positions/12';
 const ledger=[{type:'read_page',mode:'static',url:parent,offset:0,text:'岗位页面',resource_hints:[{url:api,kind:'api'},{url:'http://localhost/private',kind:'api'}]}];
 const known=v4KnownPublicResearchUrls([],ledger);
 assert.ok(known.has(api));assert.ok(!known.has('http://localhost/private'));
 assert.equal(v4EvidencePage(ledger,{index:0},256).resource_hints[0].url,api);
 let calls=0,reads=0;
 const result=await v4StageResearchCall(async payload=>{
  calls++;const input=JSON.parse(payload.input);
  if(calls===1)return {value:{research_action:{type:'read_page',url:api}}};
  assert.equal(input.research_tool_results[0].ok,true);
  return {value:{done:true}};
 },{instructions:'test',input:'{}'},{parse:r=>r.value,ledger,fetcher:async u=>{reads++;assert.equal(u,api);return Response.json({title:'岗位原文'});}});
 assert.equal(reads,1);assert.equal(result.value.done,true);
});

test('global rank failure remains incomplete and reopens evidence review instead of silently finishing',async()=>{
 const candidate=job(96),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const match={company:candidate.company,title:candidate.title,location:candidate.location,official_url:candidate.url,source_type:'站外官方招聘',reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'可能负责渠道管理。',reference_jd_basis:'方向推断',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:86,curated_suitable:true,report_status:'COMPLETE',research_detail:{comparisons:[],score_explanation:'真实经历匹配'}};
 const opts={env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true};
 let checkpoint={phase:'reporting',rows:[[candidate.url,candidate]],profile,matches:[match]};
 const fetcher=async()=>model({ordered_ids:[]});
 for(const expected of ['insert','focused_insert','compare','compare']){
  const result=await v4Match(fetcher,provider,resume,'全国',{...opts,checkpoint});
  checkpoint=result.checkpoint;assert.equal(checkpoint.globalRankState.mode,expected);
 }
 assert.equal(checkpoint.globalRankState.done,false);assert.equal(checkpoint.globalRankState.exhausted,true);
 assert.equal(checkpoint.globalRankError,'AI_GLOBAL_RANK_INCOMPLETE');
 const review=await v4Match(fetcher,provider,resume,'全国',{...opts,checkpoint});
 assert.equal(review.checkpoint.phase,'research');assert.equal(review.checkpoint.globalRankState.exhausted,false);assert.equal(review.checkpoint.globalRankState.done,false);
 assert.equal(review.checkpoint.priorState.matches[0].match_score,86);
});
test('verified unresolved scores receive a durable independent recheck without repeating scored candidates',async()=>{
 const a=job(97),b=job(98),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const make=j=>({company:j.company,title:j.title,location:j.location,official_url:j.url,source_type:'站外官方招聘',jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',evidence_excerpt:'负责汽车经销商渠道运营',match_score:null});
 const good={...make(b),match_score:90,curated_suitable:true,score_evidence_status:'GROUNDED_JD_RESUME_QUOTES'};
 const result=await v4Match(async()=>{throw Error('unexpected provider request before durable scheduling')},provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,checkpoint:{phase:'reporting',rows:[[a.url,a],[b.url,b]],profile,matches:[make(a),good],scoreFailures:1}});
 assert.equal(result.checkpoint.phase,'verification');assert.deepEqual(result.checkpoint.explicitRechecks,[a.url]);assert.equal(result.checkpoint.scoreRecoveryKeys.length,1);
 assert.equal(result.checkpoint.matches[1].match_score,90);
});
test('discovery research overlaps independent public reads but preserves result order and dependent actions',async()=>{
 const {v4RunResearchActions}=await import('../functions/_lib/v4-research-tools.js');
 const a='https://careers.alpha.cn/jobs/1',b='https://careers.beta.cn/jobs/2';
 let active=0,peak=0;const ledger=[];
 const result=await v4RunResearchActions([{type:'read_page',url:a},{type:'read_page',url:b},{type:'memory',collection:'sources',cursor:0}],{collections:{sources:[a,b]},knownUrls:new Set([a,b]),ledger,parallelPublicReads:true,fetcher:async u=>{
  active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,u===a?25:5));active--;return Response.json({title:u});
 }});
 assert.equal(peak,2);assert.deepEqual(result.slice(0,2).map(r=>r.url),[a,b]);assert.equal(result[2].type,'memory');
});

test('score recovery switches evidence protocol for unchanged unresolved verified vacancy',async()=>{
 const candidate=job(99),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const match={company:candidate.company,title:candidate.title,location:candidate.location,official_url:candidate.url,source_type:'站外官方招聘',jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',evidence_excerpt:'负责汽车经销商渠道运营',match_score:null};
 const opts={env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true};
 const never=async()=>{throw Error('must schedule before provider call')};
 const first=await v4Match(never,provider,resume,'全国',{...opts,checkpoint:{phase:'reporting',rows:[[candidate.url,candidate]],profile,matches:[match]}});
 assert.deepEqual(first.checkpoint.scoreRecoveryModes,[[candidate.url,'independent']]);
 const second=await v4Match(never,provider,resume,'全国',{...opts,checkpoint:{...first.checkpoint,phase:'reporting'}});
 assert.deepEqual(second.checkpoint.explicitRechecks,[candidate.url]);assert.deepEqual(second.checkpoint.scoreRecoveryModes,[[candidate.url,'anchors']]);
 assert.equal(second.checkpoint.scoreRecoveryKeys.length,2);
});

test('a failed verification lane is moved behind fresh jobs, never removed from research',async()=>{
 const {pendingVerification,mergePipelineCheckpoint}=await import('../functions/_lib/v4-research-pipeline.js');
 const a=job(1),b=job(2),c=job(3),old={phase:'research',rows:[[a.url,a],[b.url,b],[c.url,c]]};
 const next=mergePipelineCheckpoint(old,old,{phase:'verification',matches:[],processedEarlier:[],processedEvidence:[]},[[a.url,a]],{verificationIncomplete:true});
 assert.deepEqual(pendingVerification(next).map(([u])=>u),[b.url,c.url,a.url]);
 assert.equal(next.rows.length,3);
});

test('activated OpenAI global ranking receives every one of 502 eligible candidates, not only the 50 highest raw scores',async()=>{
 const jobs=Array.from({length:502},(_,i)=>job(i+100)),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const matches=jobs.map((j,i)=>({company:j.company,title:j.title,location:j.location,official_url:j.url,source_type:'站外官方招聘',reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'可能负责渠道管理。',reference_jd_basis:'方向推断',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:60+i%40,curated_suitable:true,report_status:'COMPLETE',research_detail:{comparisons:[],score_explanation:'真实经历匹配'}}));
 let calls=0;
 const result=await v4Match(async(url,opt)=>{
  calls++;assert.ok(url.endsWith('/responses'));const body=JSON.parse(opt.body),input=JSON.parse(body.input);
  assert.equal(input.pending_ids.length,502);assert.equal(JSON.parse(input.public_document).length,502);
  assert.equal(Object.hasOwn(body,'max_output_tokens'),false);
  return model({ordered_ids:[...input.pending_ids].reverse(),research_notes:'full synthetic pool comparison'});
 },provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,checkpoint:{phase:'reporting',rows:jobs.map(j=>[j.url,j]),profile,matches}});
 assert.equal(calls,1);assert.equal(result.checkpoint.globalOrder.length,502);
 assert.equal(result.checkpoint.globalRankState.done,true);
 assert.equal(new Set(result.checkpoint.globalOrder).size,502);
});

test('activated V4 report coverage rejects empty comparisons, unresolved semantic review and duplicated reference evidence',async()=>{
 const {reportCoverageErrors,validateCuratedReport}=await import('../functions/_lib/v4-curated-reports.js');
 const jd='可能负责汽车渠道运营。可能需要渠道数据分析能力。';
 const valid={suitable:true,score:86,reason:'渠道经历与推断职责有关，数据分析能力需验证。',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车渠道运营',comparisons:[{status:'supported',jd_quote:'汽车渠道运营',resume_quote:'汽车经销商渠道运营',analysis:'对应真实经历'},{status:'missing',jd_quote:'渠道数据分析能力',analysis:'暂无直接证据'}],quality_review:{status:'complete',explanation:'覆盖职责能力及未知项',missing:[]},reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'渠道数据分析能力'}};
 assert.ok(validateCuratedReport(valid,resume,jd).ok);
 assert.deepEqual(reportCoverageErrors(valid,jd,{reference:true}),[]);
 assert.ok(reportCoverageErrors({...valid,comparisons:[]},jd,{reference:true}).includes('missing_requirement_comparisons'));
 assert.ok(reportCoverageErrors({...valid,quality_review:{status:'revise',explanation:'遗漏能力',missing:['能力']}},jd,{reference:true}).includes('quality_review_incomplete'));
 assert.ok(reportCoverageErrors({...valid,reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'汽车渠道运营'}},jd,{reference:true}).includes('reference_duties_and_capabilities_coverage'));
 assert.ok(reportCoverageErrors({...valid,reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'编造证书'}},jd,{reference:true}).length);
 assert.deepEqual(reportCoverageErrors({suitable:false},jd,{reference:true}),[]);
 assert.deepEqual(reportCoverageErrors(valid,jd),[]);
});

test('activated V4 official report repairs inadequate comparisons before completion',async()=>{
 const candidate=job(1000),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const jd='负责汽车经销商渠道运营，具备渠道数据分析能力。';
 const match={company:candidate.company,title:candidate.title,location:candidate.location,official_url:candidate.url,source_type:'站外官方招聘',jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',evidence_excerpt:jd,score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',match_score:86,curated_suitable:true};
 const options={env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true};
 let reports=0;
 const fetcher=async(url,opts)=>{
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.pending_ids)return model({ordered_ids:input.pending_ids});
  reports++;
  const basic={suitable:true,score:86,reason:'渠道经历相关，分析能力证据不足。',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营'};
  if(reports===1)return model({...basic,comparisons:[]});
  assert.match(input.previous_validation_error,/quality_review_incomplete/);
  return model({...basic,comparisons:[{jd_quote:'汽车经销商渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'有相关经历'},{jd_quote:'渠道数据分析能力',status:'missing',analysis:'暂无直接证据'}],quality_review:{status:'complete',explanation:'职责和资格逐项覆盖，未知项如实标注。',missing:[]}});
 };
 const ranked=await v4Match(fetcher,provider,resume,'全国',{...options,checkpoint:{phase:'reporting',rows:[[candidate.url,candidate]],profile,matches:[match]}});
 const done=await v4Match(fetcher,provider,resume,'全国',{...options,checkpoint:ranked.checkpoint});
 const report=done.checkpoint.matches[0];
 assert.equal(reports,2);assert.equal(report.report_status,'COMPLETE');assert.equal(report.research_detail.comparisons.length,2);assert.equal(report.evidence_excerpt,jd);
});

test('reference source anchors distinguish actual employer excerpts from role-title preparation advice',async()=>{
 const {referenceSourceErrors}=await import('../functions/_lib/v4-curated-reports.js');
 const title='渠道运营',url='https://careers.employer.cn/jobs/1';
 const job={title,jd_research:{facts:[{url,quote:'负责销售数据分析和门店协作',context:'same_job'}]}};
 const excerpt={kind:'public_excerpt',url,quote:'销售数据分析'};
 const direction={kind:'title_direction',url:'',quote:title};
 const v=(duties,capabilities)=>({reference_source_anchors:{duties,capabilities}});
 assert.deepEqual(referenceSourceErrors(v(excerpt,direction),job),[]);
 assert.ok(referenceSourceErrors(v(direction,direction),job).includes('reference_public_material_unused'));
 assert.ok(referenceSourceErrors(v({...excerpt,quote:'三年经验'},direction),job).includes('reference_source_duties'));
 assert.ok(referenceSourceErrors(v({...excerpt,url:'https://other.cn'},direction),job).length);
 assert.deepEqual(referenceSourceErrors(v(direction,direction),{title}),[]);
 assert.ok(referenceSourceErrors(v({...direction,quote:'其他职位'},direction),{title}).length);
});
test('OpenAI and Gemini both default to parallel research and clamp transport slots',async()=>{
 const {v4ParallelResearchEnabled,nextDiscoveryWidth}=await import('../functions/_lib/v4-parallel-discovery.js');
 assert.equal(v4ParallelResearchEnabled({HHBA_V4_JOB_PROVIDER:'openai'}),true);
 assert.equal(v4ParallelResearchEnabled({HHBA_V4_JOB_PROVIDER:'gemini'}),true);
 assert.equal(v4ParallelResearchEnabled({}),true);
 assert.equal(v4ParallelResearchEnabled({HHBA_V4_PARALLEL_RESEARCH:'0'}),false);
 assert.equal(nextDiscoveryWidth(6,['AI_PROVIDER_RESPONSE_INVALID'],{maxConnections:4}),4);
});
test('stalled research consumes unread pages and alternate browser evidence without repeating failed actions',async()=>{
 const {v4NextStallRead}=await import('../functions/_lib/v4-research-tools.js');
 const u='https://careers.example.cn/job/1',attempted=new Set();
 const pick=ledger=>v4NextStallRead([u],ledger,attempted,true);
 assert.equal(pick([]).mode,'static');attempted.add(JSON.stringify([u,'static',0]));
 const ledger=[{type:'read_page',url:u,mode:'static',offset:0,next_offset:200,text:'first'}];
 assert.equal(pick(ledger).offset,200);attempted.add(JSON.stringify([u,'static',200]));
 assert.equal(pick(ledger).mode,'browser');attempted.add(JSON.stringify([u,'browser',0]));
 assert.equal(pick(ledger),null);
});


test('invalid reference drafts never escape through progress or final candidate records',async()=>{
 const candidate=job(3100),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let assessments=0;const visible=[];
 const fetcher=async(url,opts)=>{
  if(url===candidate.url)return Response.json({'@type':'JobPosting',title:candidate.title,hiringOrganization:{name:candidate.company,url:new URL(candidate.url).origin},jobLocation:{address:{addressLocality:'上海'}}});
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.original_url)return model({sources:[],research_complete:true,completion_reason:'公开原文未找到'});
  if(input.public_sources)return model({facts:[],inference:'',unknowns:['官方完整JD未取得']});
  assessments++;
  return model({reference_jd:'虚构企业要求三年经验。',reference_basis:'无依据',suitable:true,score:90,reason:'不可靠',resume_quote:'汽车经销商渠道运营',jd_quote:'三年经验',comparisons:[]});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,parallelResearch:true,onPartial:jobs=>visible.push(JSON.parse(JSON.stringify(jobs))),checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 const saved=result.checkpoint.matches[0];
 assert.ok(assessments>=2);assert.equal(saved.reference_vacancy_verified,true);
 assert.equal(saved.reference_jd,undefined);assert.equal(saved.reference_jd_kind,undefined);
 assert.equal(saved.match_score,null);assert.notEqual(saved.report_status,'COMPLETE');
 assert.ok(visible.flat().every(j=>!j.reference_jd));
});

test('reviewed reference without a defensible score remains available as research only',async()=>{
 const candidate=job(3101),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let assessments=0;
 const fetcher=async(url,opts)=>{
  if(url===candidate.url)return Response.json({'@type':'JobPosting',title:candidate.title,hiringOrganization:{name:candidate.company,url:new URL(candidate.url).origin},jobLocation:{address:{addressLocality:'上海'}}});
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.original_url)return model({sources:[],research_complete:true,completion_reason:'公开原文未找到'});
  if(input.public_sources){assert.equal(input.job.vacancy_confirmed,true);return model({facts:[],inference:'依据岗位名称准备运营案例，非企业要求。',unknowns:['具体岗位职责未公开']});}
  assessments++;
  const direction={kind:'title_direction',url:'',quote:input.job.title};
  return model({reference_jd:'按岗位名称准备运营协调案例。建议准备业务流程分析案例。',reference_basis:'仅有岗位名称，具体职责未公开。',reference_source_anchors:{duties:direction,capabilities:direction},reference_coverage:{duties_quote:'运营协调案例',capabilities_quote:'业务流程分析案例'},quality_review:{status:'complete',explanation:'已说明职业准备方向及未知项',missing:[]},suitable:true,score:null,reason:'岗位职责未公布，无法可靠评分。',comparisons:[{jd_quote:'运营协调案例',status:'missing',analysis:'尚不能确认企业实际要求'}]});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 const saved=result.checkpoint.matches[0];
 assert.equal(assessments,2);assert.equal(saved.reference_jd_kind,'AI_GENERATED_REFERENCE');
 assert.match(saved.reference_jd,/运营协调案例/);assert.equal(saved.match_score,null);
 assert.equal(saved.report_status,'UNAVAILABLE');
 assert.equal((await import('../functions/_lib/v4-curated-reports.js')).qualifiedReport(saved),false);
});

test('report scheduler refills an idle lane before a slow sibling and never exceeds transport width',async()=>{
 const {runReadyWork}=await import('../functions/_lib/v4-parallel-discovery.js');
 let releaseSlow;const slow=new Promise(r=>{releaseSlow=r;});
 let active=0,peak=0,thirdBeforeSlow=false,slowDone=false;
 const timeout=setTimeout(releaseSlow,1000);
 try{
  const results=await runReadyWork([0,1,2,3],2,async id=>{
   active++;peak=Math.max(peak,active);
   try{
    if(id===0){await slow;slowDone=true;}
    if(id===2){thirdBeforeSlow=!slowDone;releaseSlow();}
    return id;
   }finally{active--;}
  });
  assert.equal(peak,2);assert.ok(thirdBeforeSlow);
  assert.deepEqual(results.map(r=>r.value),[0,1,2,3]);
 }finally{clearTimeout(timeout);releaseSlow();}
});
test('report scheduler stops admitting work on pressure or rejection, preserving completed outcomes',async()=>{
 const {runReadyWork}=await import('../functions/_lib/v4-parallel-discovery.js');
 let pressure=0;
 const limited=await runReadyWork([0,1,2,3],1,async id=>{pressure++;return id;},{canStart:()=>pressure<2});
 assert.deepEqual(limited.map(r=>r.value),[0,1]);
 const failure=await runReadyWork([0,1,2],1,async id=>{if(id===1)throw Error('upstream');return id;});
 assert.deepEqual(failure.map(r=>r.status),['fulfilled','rejected']);
 const controller=new AbortController();
 const cancelled=await runReadyWork([0,1,2],1,async id=>{controller.abort();return id;},{signal:controller.signal});
 assert.equal(cancelled.length,1);
});

test('large verification window yields under request pressure and resumes every untouched candidate',async()=>{
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const jobs=Array.from({length:12},(_,i)=>job(i+2000)),byUrl=new Map(jobs.map(j=>[j.url,j]));
 const scoreCalls=new Map(),pageCalls=new Map();
 const html=j=>'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:j.title,hiringOrganization:{name:j.company,url:new URL(j.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 const fetcher=async(url,opts)=>{
  if(!url.endsWith('/responses')){
   const j=byUrl.get(url);assert.ok(j);pageCalls.set(url,(pageCalls.get(url)||0)+1);
   return new Response(html(j),{headers:{'content-type':'text/html'}});
  }
  const input=JSON.parse(JSON.parse(opts.body).input),title=input.job.title;
  const n=(scoreCalls.get(title)||0)+1;scoreCalls.set(title,n);
  return model({suitable:true,score:88,reason:'独立评分 '+n,resume_quote:'汽车经销商渠道运营',jd_quote:n<=2?'无效引文 '+n:'汽车经销商渠道运营',matched:['渠道运营'],gaps:[]});
 };
 const options={curated:true,officialOnly:true,stepMode:true,parallelResearch:true};
 let checkpoint={phase:'verification',next:0,rows:jobs.map(j=>[j.url,j]),profile,toolUrls:jobs.map(j=>j.url),verificationBatch:12};
 const first=await v4Match(fetcher,provider,resume,'全国',{...options,checkpoint});
 checkpoint=first.checkpoint;
 assert.equal(checkpoint.phase,'verification');
 assert.ok(checkpoint.next>=4&&checkpoint.next<12);
 assert.equal(checkpoint.diagnostics.VERIFICATION_WINDOW_PRESSURE_PAUSE,1);
 assert.equal(checkpoint.matches.length,checkpoint.next);
 assert.equal(checkpoint.scored,checkpoint.next);
 assert.ok(checkpoint.diagnostics.VERIFICATION_EXTERNAL_REQUESTS>=30);
 const completed=new Set(checkpoint.matches.map(j=>j.official_url));
 for(let i=0;i<12&&checkpoint.phase==='verification';i++){
  const next=await v4Match(fetcher,provider,resume,'全国',{...options,checkpoint});
  checkpoint=next.checkpoint;
 }
 assert.equal(checkpoint.phase,'reporting');
 assert.equal(checkpoint.scored,12);
 assert.equal(new Set(checkpoint.matches.map(j=>j.official_url)).size,12);
 assert.ok(jobs.every(j=>scoreCalls.get(j.title)===3));
 assert.ok([...completed].every(u=>pageCalls.get(u)===1));
});

test('reference material independent of score: validates source anchors and rejects an invalid review or unsupported source',async()=>{
 const {referenceMaterialErrors,validateCuratedReport}=await import('../functions/_lib/v4-curated-reports.js');
 const j={title:'渠道运营',jd_research:{facts:[{url:'https://example.cn/job',quote:'负责渠道管理',context:'same_job'}]}};
 const value={reference_jd:'资料显示：负责渠道管理。建议准备数据分析能力。',reference_basis:'公开资料和求职建议分别标注。',reference_coverage:{duties_quote:'负责渠道管理',capabilities_quote:'数据分析能力'},reference_source_anchors:{duties:{kind:'public_excerpt',url:'https://example.cn/job',quote:'负责渠道管理'},capabilities:{kind:'title_direction',url:'',quote:'渠道运营'}},reference_material_review:{status:'complete',explanation:'已整理职责和建议，明确未知条件。',missing:[]},quality_review:{status:'revise',explanation:'评分待核实。',missing:['简历证据']},suitable:true,score:90,resume_quote:'不存在的简历内容'};
 assert.deepEqual(referenceMaterialErrors(value,j),[]);
 assert.equal(validateCuratedReport(value,resume,value.reference_jd).ok,false);
 assert.ok(referenceMaterialErrors({...value,reference_material_review:{status:'revise',explanation:'遗漏',missing:['来源']}},j).length);
 assert.ok(referenceMaterialErrors({...value,reference_source_anchors:{...value.reference_source_anchors,duties:{kind:'public_excerpt',url:'https://example.cn/job',quote:'不存在的招聘信息'}}},j).length);
});
test('production-mode confirmed vacancy receives additional public research and preserves reviewed reference when score cannot be grounded',async()=>{
 const {qualifiedReport}=await import('../functions/_lib/v4-curated-reports.js');
 const {safeHistoryJobs}=await import('../functions/_lib/match-history.js');
 const candidate=job(193),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'gpt-6.2-sol'};
 const proof=new URL('/business',candidate.url).href;
 let supplemented=0,assessments=0;
 const quote='企业公开介绍：为渠道门店提供运营支持。';
 const fetcher=async(url,opts)=>{
  if(url===candidate.url)return Response.json({'@type':'JobPosting',title:candidate.title,hiringOrganization:{name:candidate.company,url:new URL(candidate.url).origin},jobLocation:{address:{addressLocality:'上海'}}});
  if(url===proof)return new Response('<html><body><p>'+quote+'</p></body></html>',{headers:{'content-type':'text/html'}});
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.original_url)return model({sources:[],research_complete:true,completion_reason:'未公开完整正文'});
  if(input.public_sources){supplemented++;assert.equal(input.job.vacancy_confirmed,true);return model({facts:[{url:proof,quote,context:'related_context'}],inference:'结合公开业务准备门店运营案例。',unknowns:['实际任职资格未公开']},[proof]);}
  assessments++;assert.ok(input.independent_public_excerpts.some(f=>f.quote===quote));if(assessments>1)assert.ok(input.previous_validation_error);
  return model({reference_jd:'企业公开业务涉及门店运营支持。建议准备渠道运营数据分析能力。',reference_basis:'企业公开业务属于相关背景；能力为求职建议。',reference_coverage:{duties_quote:'门店运营支持',capabilities_quote:'渠道运营数据分析能力'},reference_source_anchors:{duties:{kind:'public_excerpt',url:proof,quote},capabilities:{kind:'title_direction',url:'',quote:candidate.title}},reference_material_review:{status:'complete',explanation:'资料与建议分开，未知要求未编造。',missing:[]},quality_review:{status:'revise',explanation:'简历证据仍需核对。',missing:['简历引用']},suitable:true,score:88,reason:'不可靠的评分',resume_quote:'不存在的简历经历',jd_quote:'门店运营支持',comparisons:[{jd_quote:'门店运营支持',resume_quote:'不存在的简历经历',status:'supported',analysis:'不可核对'}]});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,env:{HHBA_MATCH_V4_READY:'1'},checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 const saved=result.checkpoint.matches[0];
 assert.equal(supplemented,1);assert.equal(assessments,2);
 assert.equal(saved.reference_vacancy_verified,true);assert.equal(saved.report_status,'UNAVAILABLE');assert.equal(saved.match_score,null);assert.equal(saved.research_detail,undefined);assert.equal(qualifiedReport(saved),false);assert.equal(saved.jd_source_status,undefined);assert.match(saved.reference_jd,/门店运营支持/);assert.ok(saved.jd_research.facts.some(f=>f.quote===quote));
 const historical=safeHistoryJobs([{...saved,v4_source:true}])[0];assert.equal(historical.reference_jd,saved.reference_jd);assert.equal(historical.report_status,'UNAVAILABLE');assert.equal(historical.reference_vacancy_verified,true);assert.equal(historical.match_score,null);
});

test('pipeline window grows on measured inexpensive jobs without increasing concurrent sockets',async()=>{
 const {pipelineVerificationWindow,verificationSnapshot,pipelineWidths}=await import('../functions/_lib/v4-research-pipeline.js');
 const cp={discoveryWidth:4,pipelineVerificationWidth:4,pipelineVerificationCost:2};
 const plan=pipelineWidths(cp,100);
 assert.equal(plan.discovery+plan.verification,5);
 assert.equal(pipelineVerificationWindow(cp,100,plan.verification),8);
 const snapshot=verificationSnapshot(cp,plan.verification,8);
 assert.equal(snapshot.verificationBatch,8);assert.equal(snapshot.verificationLaneWidth,4);
 assert.equal(pipelineVerificationWindow({...cp,pipelineVerificationCost:6},100,4),4);
 assert.equal(pipelineVerificationWindow({},100,4),4);
 assert.equal(pipelineVerificationWindow(cp,2,4),2);
});
test('successful pressure yield keeps untouched pipeline jobs pending',async()=>{
 const {candidateRevision,pendingVerification,mergePipelineCheckpoint}=await import('../functions/_lib/v4-research-pipeline.js');
 const rows=Array.from({length:8},(_,i)=>['https://example.com/job/'+i,{company:'公司',title:'岗位'+i,location:'上海'}]);
 const cp={phase:'research',rows};
 const verify={phase:'verification',next:5,matches:[],diagnostics:{}};
 const next=mergePipelineCheckpoint(cp,cp,verify,rows);
 assert.deepEqual(next.processedEarlier,rows.slice(0,5).map(([u])=>u));
 assert.deepEqual(pendingVerification(next),rows.slice(5));
 assert.equal(next.diagnostics.PIPELINE_VERIFICATION_ATTEMPTS,5);
 const [url,job]=rows[0],old={...cp,processedEarlier:[url],processedEvidence:[[url,candidateRevision(job)]],explicitRechecks:[url]};
 const failed={phase:'verification',next:0,processedEarlier:[url],processedEvidence:old.processedEvidence,explicitRechecks:[url],matches:[]};
 const resumed=mergePipelineCheckpoint(old,old,failed,[rows[0]],{verificationIncomplete:true});
 assert.ok(pendingVerification(resumed).some(([u])=>u===url));
});
test('a full ready scoring group bypasses its coalescing timer',async()=>{
 const {makeBatchScorer}=await import('../functions/_lib/v4-batch-scoring.js');
 let calls=0;
 const score=makeBatchScorer({resume:'真实工作经验',maxReady:2,delay:60000,parse:r=>r.data,call:async()=>{calls++;return {status:'completed',data:{assessments:[]}};}});
 const first=score('a',{full_jd:'岗位甲'});
 assert.equal(calls,0);
 const second=score('b',{full_jd:'岗位乙'});
 assert.equal(calls,1);
 assert.deepEqual(await Promise.all([first,second]),[null,null]);
});

test('managed invocation plan expands cheap work and backs off after resource pressure',async()=>{
 const {phaseResourceBudget,managedWorkPlan,managedWorkSample}=await import('../functions/_lib/v4-phase-budget.js');
 const budget=phaseResourceBudget();
 assert.deepEqual(managedWorkPlan(budget,undefined,50,{initialCost:4}),{width:3,window:4});
 const start=budget.used;
 budget.take('fetch',4);
 const history=managedWorkSample(undefined,budget,start,2,2,{initialCost:4});
 assert.equal(history.cost,3);
 const fresh=phaseResourceBudget();
 const expanded=managedWorkPlan(fresh,{...history,width:3},50,{initialCost:4});
 assert.equal(expanded.width,4);
 assert.equal(expanded.window,5);
 const pressure=managedWorkSample(history,budget,start,0,3,{pressure:true,initialCost:4});
 assert.deepEqual(managedWorkPlan(fresh,pressure,50,{initialCost:4}),{width:1,window:1});
 assert.equal(managedWorkPlan(fresh,undefined,50,{maxLanes:2,reserve:6,initialCost:8}).width,1);
 assert.equal(managedWorkPlan(fresh,undefined,0).width,0);
});

test('managed verification invokes actual concurrent batch scoring and preserves measured state',async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const jobs=[job(3001),job(3002)],byUrl=new Map(jobs.map(j=>[j.url,j]));
 const html=j=>'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:j.title,hiringOrganization:{name:j.company,url:new URL(j.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 let batches=0,pages=0,active=0,peak=0;
 const budget=phaseResourceBudget();
 const fetcher=budget.fetch(async(url,opts)=>{
  if(!url.endsWith('/responses')){
   pages++;active++;peak=Math.max(peak,active);
   await new Promise(r=>setTimeout(r,15));active--;
   return new Response(html(byUrl.get(url)),{headers:{'content-type':'text/html'}});
  }
  const input=JSON.parse(JSON.parse(opts.body).input);
  assert.equal(input.jobs.length,2);batches++;
  return model({assessments:input.jobs.map(j=>({id:j.id,suitable:true,score:86,reason:'渠道运营匹配',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营',matched:['渠道运营'],gaps:[]}))});
 });
 const result=await v4Match(fetcher,provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,resourceBudget:budget,checkpoint:{phase:'verification',next:0,rows:jobs.map(j=>[j.url,j]),profile,toolUrls:jobs.map(j=>j.url)}});
 assert.equal(result.checkpoint.phase,'reporting');assert.equal(result.checkpoint.scored,2);
 assert.equal(batches,1);assert.equal(pages,2);assert.equal(peak,2);
 assert.equal(result.checkpoint.managedVerification.width,2);assert.equal(budget.denied,false);
});
test('managed production reporting really runs multiple independent reports in parallel',async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const jobs=Array.from({length:4},(_,i)=>job(3100+i)),jd='负责汽车经销商渠道运营，具备渠道数据分析能力。';
 const matches=jobs.map(j=>({company:j.company,title:j.title,location:j.location,official_url:j.url,source_type:'站外官方招聘',jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',evidence_excerpt:jd,score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',match_score:86,curated_suitable:true}));
 const options={env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,parallelResearch:true};
 let reports=0,active=0,peak=0;
 const fetcher=async(url,opts)=>{
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.pending_ids)return model({ordered_ids:input.pending_ids});
  reports++;active++;peak=Math.max(peak,active);
  await new Promise(r=>setTimeout(r,15));active--;
  return model({suitable:true,score:86,reason:'渠道经历相关，分析能力证据不足。',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营',comparisons:[{jd_quote:'汽车经销商渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'有相关经历'},{jd_quote:'渠道数据分析能力',status:'missing',analysis:'暂无直接证据'}],quality_review:{status:'complete',explanation:'职责和资格逐项覆盖，未知项如实标注。',missing:[]}});
 };
 let budget=phaseResourceBudget();
 const ranked=await v4Match(budget.fetch(fetcher),provider,resume,'全国',{...options,resourceBudget:budget,checkpoint:{phase:'reporting',rows:jobs.map(j=>[j.url,j]),profile,matches}});
 budget=phaseResourceBudget();
 const done=await v4Match(budget.fetch(fetcher),provider,resume,'全国',{...options,resourceBudget:budget,checkpoint:ranked.checkpoint});
 assert.equal(reports,4);assert.ok(peak>=2);assert.equal(done.checkpoint.matches.filter(j=>j.report_status==='COMPLETE').length,4);
 assert.equal(done.checkpoint.managedReport.width,3);assert.equal(budget.denied,false);
});
test('shared batch transport pressure yields instead of multiplying retry requests',async()=>{
 const {makeBatchScorer}=await import('../functions/_lib/v4-batch-scoring.js');
 const score=makeBatchScorer({resume:'渠道运营经验',maxReady:2,delay:100,parse:r=>r.data,call:async()=>{throw Object.assign(Error('yield'),{code:'AI_PHASE_RESOURCE_YIELD'});}});
 const result=await Promise.allSettled([score('a',{full_jd:'岗位甲'}),score('b',{full_jd:'岗位乙'})]);
 assert.ok(result.every(r=>r.status==='rejected'&&r.reason.code==='AI_PHASE_RESOURCE_YIELD'));
});

test('managed rate-limit yields, legacy batch transport keeps individual fallback',async()=>{
 const {makeBatchScorer}=await import('../functions/_lib/v4-batch-scoring.js');
 const call=async()=>{throw Object.assign(Error('rate-limited'),{code:'AI_PROVIDER_RATE_LIMITED'});};
 for(const managed of [false,true]){
  const score=makeBatchScorer({resume:'渠道运营经验',maxReady:2,delay:100,parse:r=>r.data,call,yieldOnPressure:managed});
  const out=await Promise.allSettled([score('a',{full_jd:'岗位甲'}),score('b',{full_jd:'岗位乙'})]);
  assert.ok(out.every(r=>managed?r.status==='rejected'&&r.reason.code==='AI_PROVIDER_RATE_LIMITED':r.status==='fulfilled'&&r.value===null));
 }
});

test('fast discovery lane publishes unscored recoverable leads before a slow coordinator completes',async()=>{
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const fast=job(4001),slow=job(4002);
 let release,ready=false,checkpoint,observed=false;
 const gate=new Promise(resolve=>{release=resolve;});
 const timeout=setTimeout(release,2000);
 const fetcher=async(url,opts)=>{
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.parallel_lane)return model({jobs:[fast]},[fast.url]);
  await gate;return model({profile,jobs:[slow],research_complete:true,completion_reason:'test'},[slow.url]);
 };
 try{
  const result=await v4Match(fetcher,provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles},discoveryWidth:2},
   onRecoveryState:get=>{checkpoint=get;},onPartial:jobs=>{if(!ready&&jobs.some(j=>j.official_url===fast.url)){ready=true;observed=checkpoint().rows.some(([u])=>u===fast.url)&&!checkpoint().rows.some(([u])=>u===slow.url)&&jobs.every(j=>j.match_score===null);release();}}});
  assert.equal(observed,true);assert.equal(result.checkpoint.rows.length,2);
 }finally{clearTimeout(timeout);release();}
});

test('profile cache reuses only a usable profile grounded in the current resume',async()=>{
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let calls=0,saved=null;
 const fetcher=async()=>{calls++;return model({profile});};
 const options={curated:true,officialOnly:true,stepMode:true,profileCache:{load:async()=>saved,save:async p=>{saved=p;}}};
 const first=await v4Match(fetcher,provider,resume,'全国',options);
 const second=await v4Match(fetcher,provider,resume,'全国',options);
 assert.equal(calls,1);assert.equal(second.checkpoint.diagnostics.AI_PROFILE_CACHE_HIT,1);
 assert.deepEqual(first.checkpoint.profile,second.checkpoint.profile);
 saved={summary:'fake',target_roles:['fake'],facts:[{kind:'work',quote:'does not exist in resume'}]};
 await v4Match(fetcher,provider,resume,'全国',options);assert.equal(calls,2);
});

test('read-ahead starts before slow sibling and leaves unadmitted work for ordinary processing',async()=>{
 const {discoveryReadAhead}=await import('../functions/_lib/v4-research-pipeline.js');
 let release,started=[];const gate=new Promise(r=>{release=r});
 const queue=discoveryReadAhead(async item=>{started.push(item);await gate;});
 queue.offer('a','a');queue.offer('a','a');queue.offer('b','b');
 await Promise.resolve();assert.deepEqual(started,['a']);
 const done=queue.close();release();await done;assert.deepEqual(started,['a']);
});
test('managed discovery reads grounded new JD before coordinator completes and reuses it in verification',async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const fast=job(4201);let release,readEarly=false,pages=0,slowDone=false;
 const gate=new Promise(r=>{release=r});const timer=setTimeout(release,1500);
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:fast.title,hiringOrganization:{name:fast.company,url:new URL(fast.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 const fetcher=async(url,opts)=>{
  if(url===fast.url){pages++;readEarly=!slowDone;release();return new Response(html,{headers:{'content-type':'text/html'}});}
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.parallel_lane)return model({jobs:[fast]},[fast.url]);
  if(input.job)return model({suitable:true,score:86,reason:'渠道运营匹配',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营',matched:['渠道运营'],gaps:[]});
  await gate;slowDone=true;return model({profile,jobs:[fast],research_complete:false,continue_search:true},[fast.url]);
 };
 const options={curated:true,officialOnly:true,stepMode:true,parallelResearch:true,env:{HHBA_MATCH_V4_READY:'1'}};
 try{
  let budget=phaseResourceBudget();
  const discovery=await v4Match(budget.fetch(fetcher),provider,resume,'全国',{...options,resourceBudget:budget,checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles},discoveryWidth:2}});
  assert.equal(readEarly,true);assert.equal(pages,1);assert.equal(discovery.checkpoint.diagnostics.JD_DISCOVERY_PREFETCH_READY,1);
  assert.equal(discovery.checkpoint.verificationReads.length,1);
  budget=phaseResourceBudget();
  const done=await v4Match(budget.fetch(fetcher),provider,resume,'全国',{...options,resourceBudget:budget,checkpoint:{...discovery.checkpoint,phase:'verification',next:0,verificationBatch:1}});
  assert.equal(pages,1);assert.equal(done.checkpoint.scored,1);assert.equal(done.checkpoint.diagnostics.JD_DISCOVERY_PREFETCH_REUSED,1);
  assert.equal(done.checkpoint.verificationReads.length,0);
  const expired=structuredClone(discovery.checkpoint);expired.verificationReads[0][1].jd.checked_at=new Date(Date.now()-11*60000).toISOString();
  budget=phaseResourceBudget();
  const refreshed=await v4Match(budget.fetch(fetcher),provider,resume,'全国',{...options,resourceBudget:budget,checkpoint:{...expired,phase:'verification',next:0,verificationBatch:1}});
  assert.equal(pages,2);assert.equal(refreshed.checkpoint.scored,1);assert.equal(refreshed.checkpoint.diagnostics.JD_DISCOVERY_PREFETCH_REUSED,undefined);
  const revised=structuredClone(discovery.checkpoint);revised.rows[0][1].requirements='updated requirement';
  budget=phaseResourceBudget();
  const changed=await v4Match(budget.fetch(fetcher),provider,resume,'全国',{...options,resourceBudget:budget,checkpoint:{...revised,phase:'verification',next:0,verificationBatch:1}});
  assert.equal(pages,3);assert.equal(changed.checkpoint.scored,1);assert.equal(changed.checkpoint.diagnostics.JD_DISCOVERY_PREFETCH_REUSED,undefined);
 }finally{clearTimeout(timer);release();}
});

test('catalog hints are optional, fresh, public only and never promote cached entries to verified jobs',async()=>{
 const {publicCatalogHints,PUBLIC_CATALOG_KEY}=await import('../functions/_lib/v4-public-jd-catalog.js');
 const now=Date.now(),fresh=job(5001),expired=job(5002),board={...job(5003),url:'https://www.zhipin.com/job_detail/a.html'};
 const items=[{...fresh,checked_at:new Date(now-1000).toISOString(),private_field:'never returned'}, {...expired,checked_at:new Date(now-90000000).toISOString()},{...board,checked_at:new Date(now).toISOString()}];
 const env={HHBA_PUBLIC_JD_CATALOG_READ:'1',HHBA_JOB_JD_R2:{get:async key=>{assert.equal(key,PUBLIC_CATALOG_KEY);return {text:async()=>JSON.stringify({version:1,offset:0,jobs:items})};}}};
 const hints=await publicCatalogHints(env,{target_roles:['运营']},'上海',{now});
 assert.equal(hints.length,1);assert.equal(hints[0].url,fresh.url);assert.equal(hints[0].private_field,undefined);
 assert.deepEqual(await publicCatalogHints({...env,HHBA_PUBLIC_JD_CATALOG_READ:'0'},{},'',{now}),[]);
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let used=false;const response=await v4Match(async(url,opts)=>{
  const payload=JSON.parse(opts.body),input=JSON.parse(payload.input);
  assert.equal(payload.tool_choice,'required');assert.equal(input.public_catalog_hints[0].url,fresh.url);assert.equal(input.previously_discovered_jobs.length,0);used=true;
  return model({jobs:[fresh],research_complete:false},[fresh.url]);
 },provider,resume,'全国',{env:{...env,HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles}}});
 assert.ok(used);assert.equal(response.checkpoint.rows.length,1);assert.equal(response.checkpoint.matches,undefined);
});
test('catalog collector rotates public entries, archives actual same-origin JD and honors disabled switch',async()=>{
 const {runPublicJdCatalog,PUBLIC_CATALOG_KEY}=await import('../functions/_lib/v4-public-jd-catalog.js');
 const j=job(5101),entry=new URL(j.url).origin+'/careers',origin=new URL(entry).origin;
 const map=new Map();const bucket={get:async k=>map.has(k)?{text:async()=>map.get(k)}:null,put:async(k,v)=>map.set(k,v)};
 const db={prepare:()=>({bind:(limit,offset)=>({all:async()=>({results:offset?[]:[{enterprise:j.company,recruitment_url:entry}]})})})};
 const env={HHBA_JOB_JD_DB:db,HHBA_JOB_JD_R2:bucket};
 const now=new Date();const urls=[];
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:j.title,hiringOrganization:{name:j.company,url:origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 const fetcher=async u=>{urls.push(u);if(u.endsWith('/robots.txt'))return new Response('',{status:404});return new Response(u===entry?'<a href="'+j.url+'">岗位详情</a><a href="https://other.cn/job/1">other</a>':html,{headers:{'content-type':'text/html',etag:'"catalog-v1"'}});};
 assert.equal((await runPublicJdCatalog(env,{now,fetcher})).enabled,false);assert.equal(urls.length,0);
 const result=await runPublicJdCatalog({...env,HHBA_PUBLIC_JD_CATALOG_COLLECT:'1'},{now,fetcher});
 assert.equal(result.saved,1);assert.ok(urls.every(u=>new URL(u).origin===origin));
 const stored=JSON.parse(map.get(PUBLIC_CATALOG_KEY));assert.equal(stored.offset,1);assert.equal(stored.jobs[0].url,j.url);assert.ok(stored.jobs[0].jd_version_id);
 assert.equal(stored.jobs[0].full_jd,undefined);
 const {v4ReadEmployerJob}=await import('../functions/_lib/v4-open-job-evidence.js');
 const notes=[];let conditional=0;
 const live=await v4ReadEmployerJob(j.url,{now,expected:j,cacheBucket:bucket,onCache:code=>notes.push(code),fetcher:async(u,opts)=>{assert.equal(opts.headers['If-None-Match'],'"catalog-v1"');conditional++;return new Response(null,{status:304,headers:{etag:'"catalog-v1"'}});}});
 assert.equal(conditional,1);assert.ok(live.full_jd);assert.ok(notes.includes('JD_PUBLIC_CONDITIONAL_HIT'));
});

test('public reference assets persist only public material and expire on time or changed vacancy identity',async()=>{
 const {publicVacancyIdentity,normalizePublicReference,savePublicReferenceAsset,readPublicReferenceAsset}=await import('../functions/_lib/v4-public-job-assets.js');
 const j=job(6101),jd={...j,canonical_url:j.url,source_confirmed:true,independently_read:true,vacancy_confirmed:true,partial_jd:'负责门店运营支持'};
 const facts=[{url:j.url,quote:jd.partial_jd,context:'same_job'}];
 const value={reference_jd:'可能负责门店运营支持，梳理业务流程并推动改进。建议准备渠道数据分析能力，解释指标变化及改进方案。',reference_basis:'公开职责片段与职业方向建议，非官方完整JD。',reference_coverage:{duties_quote:'门店运营支持',capabilities_quote:'渠道数据分析能力'},reference_source_anchors:{duties:{kind:'public_excerpt',url:j.url,quote:jd.partial_jd},capabilities:{kind:'title_direction',url:'',quote:j.title}},reference_material_review:{status:'complete',explanation:'已分开公开原文、建议与未知条件。',missing:[]},resume_text:'PRIVATE_DO_NOT_STORE',score:90};
 const objects=new Map(),env={HHBA_V4_PUBLIC_ASSETS_ENABLED:'1',HHBA_JOB_JD_R2:{put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{text:async()=>objects.get(k)}:null}};
 const id=publicVacancyIdentity(jd),material=normalizePublicReference(value,id,facts);
 assert.ok(material);assert.equal(normalizePublicReference(value,id,[]),null);assert.equal(publicVacancyIdentity({...jd,vacancy_confirmed:false}),null);
 assert.equal(await savePublicReferenceAsset(env,id,material,1000),true);
 assert.equal((await readPublicReferenceAsset(env,id,2000)).data.reference_jd,value.reference_jd);
 assert.equal(await readPublicReferenceAsset(env,{...id,partial_jd:'changed'},2000),null);
 assert.equal(await readPublicReferenceAsset(env,id,86401000),null);
 assert.ok([...objects.values()].every(v=>!v.includes('PRIVATE_DO_NOT_STORE')&&!v.includes('"score"')));
});
test('public reference research excludes CV and reuses material but not score after current independent verification',async()=>{
 const j=job(6201),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'},proof=new URL('/business',j.url).href,quote='企业公开介绍：为渠道门店提供运营支持。';
 const objects=new Map(),bucket={put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{text:async()=>objects.get(k)}:null};
 const db={prepare:()=>({bind:()=>({run:async()=>({success:true})})})};
 const env={HHBA_MATCH_V4_READY:'1',HHBA_V4_PUBLIC_ASSETS_ENABLED:'1',HHBA_JOB_JD_DB:db,HHBA_JOB_JD_R2:bucket};
 const ref={reference_jd:'可能职责：企业业务涉及渠道门店运营支持。可能承担流程协调、销售数据跟踪及运营改进。能力方向：准备渠道数据分析能力，结合业务指标提出可实施的改进方案。',reference_basis:'依据企业公开业务；其他职责与能力为AI推断，非已公布要求。',reference_coverage:{duties_quote:'渠道门店运营支持',capabilities_quote:'渠道数据分析能力'},reference_source_anchors:{duties:{kind:'public_excerpt',url:proof,quote},capabilities:{kind:'title_direction',url:'',quote:j.title}},reference_material_review:{status:'complete',explanation:'已区分业务背景、可能职责与能力准备。',missing:[]}};
 let publicCalls=0,scoreCalls=0,liveReads=0;
 const fetcher=async(url,opts)=>{
  if(url===j.url){liveReads++;return Response.json({'@type':'JobPosting',title:j.title,hiringOrganization:{name:j.company,url:new URL(j.url).origin},jobLocation:{address:{addressLocality:'上海'}}});}
  if(url===proof)return new Response('<p>'+quote+'</p>',{headers:{'content-type':'text/html'}});
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.original_url)return model({sources:[],research_complete:true,completion_reason:'未公开完整正文'});
  if(input.public_sources){publicCalls++;assert.ok(!JSON.stringify(input).includes(resume));assert.equal(input.search_summary,'');return model({facts:[{url:proof,quote,context:'related_context'}],inference:'公开背景',unknowns:['实际任职资格未知'],...ref},[proof]);}
  scoreCalls++;assert.equal(input.public_reference_material.reference_jd,ref.reference_jd);
  return model({suitable:true,score:86,reason:'真实渠道经历',resume_quote:'汽车经销商渠道运营',jd_quote:'渠道门店运营支持',comparisons:[{jd_quote:'渠道门店运营支持',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'经历与参考方向一致'}],quality_review:{status:'complete',explanation:'匹配依据充分',missing:[]}});
 };
 const options={curated:true,officialOnly:true,stepMode:true,parallelResearch:true,env,checkpoint:{phase:'verification',next:0,rows:[[j.url,{...j,fit_summary:resume}]],profile,toolUrls:[j.url],verificationBatch:1}};
 for(let i=0;i<2;i++){const result=await v4Match(fetcher,provider,resume,'全国',options);assert.equal(result.checkpoint.matches[0].reference_jd,ref.reference_jd);assert.equal(result.checkpoint.matches[0].match_score,86);}
 assert.equal(publicCalls,1);assert.equal(scoreCalls,2);assert.ok(liveReads>=2);
 assert.ok([...objects.entries()].filter(([k])=>k.includes('reference-assets-v1')).every(([,v])=>!v.includes(resume)));
});

test('first complete official report is published before a slow sibling JD and global ranking',async()=>{
 const {qualifiedReport}=await import('../functions/_lib/v4-curated-reports.js');
 const a=job(4101),b=job(4102),provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let releaseSlow,slowFinished=false,firstBeforeSlow=false,reportCalls=0,rankCalls=0;
 const gate=new Promise(resolve=>{releaseSlow=resolve;});
 const timer=setTimeout(releaseSlow,3000);
 const byUrl=new Map([[a.url,a],[b.url,b]]);
 const html=j=>'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:j.title,hiringOrganization:{name:j.company,url:new URL(j.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 const score={suitable:true,score:86,reason:'汽车渠道经历与岗位职责匹配，需核对组织协调能力。',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营',matched:['渠道运营'],gaps:[]};
 const report={...score,comparisons:[{jd_quote:'汽车经销商渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实渠道经历匹配'},{jd_quote:'具备独立分析和组织协调能力',status:'missing',analysis:'尚无直接证据'}],quality_review:{status:'complete',explanation:'职责资格已逐项核查，未确认的能力如实标注。',missing:[]}};
 const fetcher=async(url,opts)=>{
  if(!url.endsWith('/responses')){
   const j=byUrl.get(url);assert.ok(j);
   if(j===b){await gate;slowFinished=true;}
   return new Response(html(j),{headers:{'content-type':'text/html'}});
  }
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.pending_ids){rankCalls++;assert.equal(input.pending_ids.length,2);return model({ordered_ids:input.pending_ids});}
  if(input.jobs)return model({assessments:input.jobs.map(j=>({...score,id:j.id}))});
  if(input.established_score!==undefined){reportCalls++;return model(report);}
  return model(score);
 };
 const options={env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,parallelResearch:true};
 try{
  const result=await v4Match(fetcher,provider,resume,'全国',{...options,onPartial:jobs=>{
   if(jobs.some(j=>j.official_url===a.url&&qualifiedReport(j))&&!slowFinished){firstBeforeSlow=true;releaseSlow();}
  },checkpoint:{phase:'verification',next:0,rows:[[a.url,a],[b.url,b]],profile,toolUrls:[a.url,b.url],verificationBatch:2}});
  assert.equal(result.checkpoint.phase,'reporting');
  assert.equal(result.checkpoint.matches.filter(qualifiedReport).length,2);
  assert.equal(reportCalls,2);assert.equal(rankCalls,0);assert.ok(firstBeforeSlow,'first full report must appear before the slow sibling finishes');
  const ranked=await v4Match(fetcher,provider,resume,'全国',{...options,checkpoint:result.checkpoint});
  assert.equal(ranked.status,'CONTINUE');assert.equal(rankCalls,1);assert.equal(reportCalls,2);
  assert.equal(ranked.checkpoint.matches.filter(qualifiedReport).length,2);
 }finally{clearTimeout(timer);releaseSlow();}
});


test('single candidate event has stable replay identity, no fabricated score, and respects exclusions and cancellation',async()=>{
 const {createV4DiscoveryCandidateEvents}=await import('../functions/_lib/v4-discovery-candidate-events.js');
 const a=job(6101),b=job(6102),c=job(6103),controller=new AbortController(),received=[];
 const config={round:4,lane:2,signal:controller.signal,allow:j=>j.url!==b.url,onCandidate:e=>received.push(e)};
 const emit=createV4DiscoveryCandidateEvents(config);
 emit({...a,score:98,reason:'private reason',resume_quote:resume,requirements:'unverified details'});
 emit({...a,url:a.url+'?utm_source=duplicate'});emit(b);emit({...c,company:''});
 assert.equal(received.length,1);
 assert.deepEqual(received[0],{event_id:JSON.stringify([4,2,a.url]),round:4,lane:2,sequence:1,
  candidate:{company:a.company,title:a.title,location:a.location,official_url:a.url,source_status:'MODEL_SEARCH_REPORTED',evidence_status:'RESEARCH_PENDING',match_score:null}});
 const replay=createV4DiscoveryCandidateEvents(config);replay(a);
 assert.equal(received[1].event_id,received[0].event_id);
 controller.abort();emit(c);assert.equal(received.length,2);
});

test('actual V4 search emits individual SSE-derived candidate events before its response finishes, with no additional AI call', {timeout:5000},async()=>{
 const a=job(6201),b=job(6202),excluded=job(6203);
 const p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 const raw=JSON.stringify({jobs:[a,b,excluded],research_complete:true,completion_reason:'test'});
 const firstEnd='{"jobs":['.length+JSON.stringify(a).length;
 const resultBody={status:'completed',output:[{type:'web_search_call',action:{sources:[a,b,excluded].map(j=>({url:j.url}))}},{type:'message',content:[{type:'output_text',text:raw}]}]};
 let controller,calls=0,finished=false,early=false,releaseFirst;
 const first=new Promise(resolve=>{releaseFirst=resolve;});
 const received=[];
 const stream=new ReadableStream({start(c){controller=c;}});
 const send=e=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));
 const pending=v4Match(async()=>{calls++;return new Response(stream,{headers:{'content-type':'text/event-stream'}});},p,resume,'全国',
  {curated:true,officialOnly:true,stepMode:true,parallelResearch:false,excludeUrls:[excluded.url],
   checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles}},
   onDiscoveryCandidate:e=>{received.push(e);if(received.length===1){early=!finished;releaseFirst();}}});
 let timer;
 try{
  send({type:'response.output_text.delta',delta:raw.slice(0,firstEnd)});
  await Promise.race([first,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('candidate event waited for the terminal response')),1500);})]);
  assert.equal(early,true);assert.equal(received.length,1);
  assert.equal(received[0].candidate.official_url,a.url);
  send({type:'response.output_text.delta',delta:raw.slice(firstEnd)});
  finished=true;send({type:'response.completed',response:resultBody});
  const result=await pending;
  assert.equal(calls,1);assert.deepEqual(received.map(e=>e.candidate.official_url),[a.url,b.url]);
  assert.deepEqual(received.map(e=>e.sequence),[1,2]);assert.ok(received.every(e=>e.round===1&&e.lane===0));
  assert.deepEqual(result.checkpoint.rows.map(([url])=>url),[a.url,b.url]);
 }finally{clearTimeout(timer);try{controller.close();}catch{}await pending.catch(()=>{});}
});

test('parallel search emits individual lane events while retaining the original authoritative merge',async()=>{
 const a=job(6301),b=job(6302),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const received=[];let calls=0;
 const result=await v4Match(async(_url,opts)=>{
  calls++;const input=JSON.parse(JSON.parse(opts.body).input);
  return input.parallel_lane?model({jobs:[b]},[b.url]):model({jobs:[a],research_complete:true,completion_reason:'test'},[a.url]);
 },p,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,
  checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles},discoveryWidth:2},
  onDiscoveryCandidate:e=>received.push(e)});
 assert.equal(calls,2);
 assert.deepEqual(received.map(e=>e.lane).sort(),[0,1]);
 assert.deepEqual(received.map(e=>e.candidate.official_url).sort(),[a.url,b.url].sort());
 assert.deepEqual(result.checkpoint.rows.map(([url])=>url).sort(),[a.url,b.url].sort());
 assert.ok(received.every(e=>e.candidate.match_score===null&&e.sequence===1));
});


test('shared live discovery snapshot combines interleaved agents before either response completes', {timeout:5000},async()=>{
 const a=job(6401),b=job(6402),c=job(6403);
 const p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 const controllers=new Map(),snapshots=[],events=[];
 let calls=0,recovery,notifyReady,notifyMerged,finished=0;
 const ready=new Promise(resolve=>{notifyReady=resolve;});
 const merged=new Promise(resolve=>{notifyMerged=resolve;});
 const fetcher=async(_url,opts)=>{
  calls++;const input=JSON.parse(JSON.parse(opts.body).input);
  const lane=input.parallel_lane||0;
  return new Response(new ReadableStream({start(controller){
   controllers.set(lane,controller);if(controllers.size===2)notifyReady();
  }}),{headers:{'content-type':'text/event-stream'}});
 };
 const send=(lane,e)=>controllers.get(lane).enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));
 const delta=(lane,text)=>send(lane,{type:'response.output_text.delta',delta:text});
 const finish=(lane,jobs)=>{
  finished++;send(lane,{type:'response.completed',response:{status:'completed',output:[
   {type:'web_search_call',action:{sources:jobs.map(j=>({url:j.url}))}},
   {type:'message',content:[{type:'output_text',text:JSON.stringify({jobs,research_complete:true,completion_reason:'test'})}]}]}});
 };
 const pending=v4Match(fetcher,p,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,
  checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles},discoveryWidth:2},
  onRecoveryState:get=>{recovery=get;},onDiscoveryCandidate:e=>events.push(e),
  onPartial:jobs=>{
   snapshots.push(jobs.map(j=>j.official_url));
   if(jobs.some(j=>j.official_url===a.url)&&jobs.some(j=>j.official_url===b.url)&&!finished)notifyMerged();
  }});
 let timer;
 try{
  await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('agents not started')),1500);})]);clearTimeout(timer);
  delta(0,'{"jobs":['+JSON.stringify(a));
  delta(1,'{"jobs":['+JSON.stringify({...a,url:a.url+'?utm_source=second_lane'})+','+JSON.stringify(b));
  await Promise.race([merged,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('live merge waited for a completed agent')),1500);})]);clearTimeout(timer);
  assert.equal(finished,0);
  assert.deepEqual(snapshots[0],[a.url]);
  assert.deepEqual(snapshots[1],[a.url,b.url]);
  assert.deepEqual(recovery().rows.map(([url])=>url),[a.url,b.url]);
  assert.deepEqual(recovery().toolUrls,[],'partial JSON is not independent evidence');
  delta(0,','+JSON.stringify(c)+']}');
  delta(1,']}');
  finish(0,[{...a,title:'最终核对后的名称'},c]);finish(1,[b]);
  const result=await pending;
  assert.equal(calls,2);
  assert.deepEqual(result.checkpoint.rows.map(([url])=>url).sort(),[a.url,b.url,c.url].sort());
  assert.equal(new Map(result.checkpoint.rows).get(a.url).title,'最终核对后的名称');
  assert.equal(events.length,3);
  assert.equal(result.checkpoint.diagnostics.LIVE_DISCOVERY_CANDIDATE_MERGED,3);
 }finally{clearTimeout(timer);for(const c of controllers.values())try{c.close();}catch{}await pending.catch(()=>{});}
});

test('shared discovery retains closed objects from a failed agent as unverified leads without claiming its citations',async()=>{
 const a=job(6501),b=job(6502),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 const snapshots=[];
 const result=await v4Match(async(_u,opts)=>{
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(!input.parallel_lane)return model({jobs:[a],research_complete:true,completion_reason:'test'},[a.url]);
  const partial='data: '+JSON.stringify({type:'response.output_text.delta',delta:'{"jobs":['+JSON.stringify(b)})+'\n\n';
  return new Response(partial,{headers:{'content-type':'text/event-stream'}});
 },p,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,
  checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles},discoveryWidth:2},
  onPartial:jobs=>snapshots.push(jobs)});
 assert.deepEqual(result.checkpoint.rows.map(([url])=>url).sort(),[a.url,b.url].sort());
 assert.equal(result.checkpoint.toolUrls.includes(b.url),false);
 assert.ok(snapshots.some(jobs=>jobs.some(j=>j.official_url===b.url&&j.match_score===null)));
 assert.ok(result.checkpoint.diagnostics.PARALLEL_AI_PROVIDER_RESPONSE_INVALID);
});


test('discovery identity collapses tracking and query order without conflating distinct requisitions',async()=>{
 const {createV4DiscoveryIdentityIndex,v4DiscoveryCandidateKey}=await import('../functions/_lib/v4-discovery-candidate-events.js');
 const base='https://careers.other-motors.cn/jobs/detail?jobId=101&city=shanghai';
 const duplicate='https://careers.other-motors.cn/jobs/detail?utm_source=search&city=shanghai&jobId=101#apply';
 const distinct='https://careers.other-motors.cn/jobs/detail?jobId=102&city=shanghai';
 const otherCity='https://careers.other-motors.cn/jobs/detail?jobId=101&city=beijing';
 assert.equal(v4DiscoveryCandidateKey(base),v4DiscoveryCandidateKey(duplicate));
 assert.notEqual(v4DiscoveryCandidateKey(base),v4DiscoveryCandidateKey(distinct));
 assert.notEqual(v4DiscoveryCandidateKey(base),v4DiscoveryCandidateKey(otherCity));
 const index=createV4DiscoveryIdentityIndex([duplicate]);
 assert.equal(index.claim(base),false);
 assert.equal(index.claim(distinct),true);
 assert.equal(index.claim(distinct+'&utm_medium=search'),false);
 assert.equal(index.claim(otherCity),true);
 assert.equal(index.claim('https://localhost/jobs/101'),false);
});

test('task discovery deduplicates events across agent lanes and continuation rounds, without losing final evidence',async()=>{
 const a=job(6601),b={...a,url:'https://careers.employer6601.cn/jobs/6602'},c={...a,url:'https://careers.employer6601.cn/jobs/6603'};
 const excluded=job(6604),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const seen=[];let calls=0;
 const options={curated:true,officialOnly:true,stepMode:true,excludeUrls:[excluded.url+'?utm_source=history'],
  onDiscoveryCandidate:e=>seen.push(e.candidate.official_url)};
 const first=await v4Match(async(_u,opts)=>{
  calls++;const input=JSON.parse(JSON.parse(opts.body).input);
  const jobs=input.parallel_lane?[{...a,url:a.url+'?utm_source=lane',requirements:'新增公开资料线索'},b,excluded]:[a];
  return model({jobs,research_complete:false},jobs.filter(j=>j.url!==excluded.url).map(j=>j.url));
 },p,resume,'全国',{...options,parallelResearch:true,checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles},discoveryWidth:2}});
 assert.equal(calls,2);
 assert.deepEqual([...seen].sort(),[a.url,b.url].sort());
 assert.deepEqual(first.checkpoint.rows.map(([url])=>url).sort(),[a.url,b.url].sort());
 assert.equal(new Map(first.checkpoint.rows).get(a.url).requirements,'新增公开资料线索');
 assert.equal(first.checkpoint.round,1);
 const second=await v4Match(async()=>{
  calls++;return model({jobs:[{...a,url:a.url+'?utm_campaign=round2',requirements:'第二轮补充证据'},b,c,excluded],research_complete:false},[a.url,b.url,c.url]);
 },p,resume,'全国',{...options,parallelResearch:false,checkpoint:first.checkpoint});
 assert.equal(calls,3);
 assert.deepEqual([...seen].sort(),[a.url,b.url,c.url].sort());
 assert.deepEqual(second.checkpoint.rows.map(([url])=>url).sort(),[a.url,b.url,c.url].sort());
 assert.equal(new Map(second.checkpoint.rows).get(a.url).requirements,'第二轮补充证据');
 assert.equal(second.checkpoint.round,2);
});


test('serial discovery transport interruption retries the unfinished round while preserving complete candidate objects',async()=>{
 const a=job(6701),b=job(6702),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 let recovery;const seen=[];
 const opts={curated:true,officialOnly:true,stepMode:true,parallelResearch:false,onRecoveryState:get=>{recovery=get;},
  onDiscoveryCandidate:e=>seen.push(e.candidate.official_url),
  checkpoint:{phase:'research',round:1,rows:[],profile:{...profile,target_roles:profile.roles}}};
 const partial='data: '+JSON.stringify({type:'response.output_text.delta',delta:'{"jobs":['+JSON.stringify(a)+',{"company":"incomplete'})+'\n\n';
 await assert.rejects(v4Match(async()=>new Response(partial,{headers:{'content-type':'text/event-stream'}}),p,resume,'全国',opts),{code:'AI_PROVIDER_NETWORK_ERROR'});
 const checkpoint=recovery();
 assert.deepEqual(checkpoint.rows.map(([u])=>u),[a.url]);
 assert.deepEqual(checkpoint.toolUrls,[]);
 assert.deepEqual(seen,[a.url]);
 const result=await v4Match(async(_u,req)=>{
  const input=JSON.parse(JSON.parse(req.body).input);
  assert.ok(input.previously_discovered_jobs.some(j=>j.url===a.url));
  return model({jobs:[a,b],research_complete:false},[a.url,b.url]);
 },p,resume,'全国',{...opts,checkpoint});
 assert.deepEqual(result.checkpoint.rows.map(([u])=>u).sort(),[a.url,b.url].sort());
 assert.deepEqual(seen,[a.url,b.url]);
});


test('managed incremental discovery avoids full snapshot rebuilding for a 60-candidate streamed burst', {timeout:5000},async()=>{
 const jobs=Array.from({length:60},(_,i)=>job(6800+i));
 const p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 const events=[],snapshots=[];let controller,resolveFirst,resolveAll,calls=0,recovery;
 const first=new Promise(resolve=>{resolveFirst=resolve;});
 const all=new Promise(resolve=>{resolveAll=resolve;});
 const stream=new ReadableStream({start(c){controller=c;}});
 const send=e=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));
 const raw=JSON.stringify({jobs,research_complete:false});
 const pending=v4Match(async()=>{calls++;return new Response(stream,{headers:{'content-type':'text/event-stream'}});},p,resume,'全国',{
  curated:true,officialOnly:true,stepMode:true,parallelResearch:false,deferDiscoverySnapshots:true,
  checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles}},
  onRecoveryState:get=>{recovery=get;},onPartial:rows=>snapshots.push(rows),
  onDiscoveryCandidate:(event,meta)=>{events.push({event,meta});if(events.length===1)resolveFirst();if(events.length===jobs.length)resolveAll();}
 });
 let timer;
 try{
  const firstEnd='{"jobs":['.length+JSON.stringify(jobs[0]).length;
  send({type:'response.output_text.delta',delta:raw.slice(0,firstEnd)});
  await Promise.race([first,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('missing first incremental event')),1500);})]);clearTimeout(timer);
  assert.equal(events[0].meta.discovered,1);
  assert.equal(events[0].meta.source,'delta');
  assert.equal(snapshots.length,0);
  send({type:'response.output_text.delta',delta:raw.slice(firstEnd)});
  await Promise.race([all,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('missing streamed candidates')),1500);})]);clearTimeout(timer);
  assert.equal(events.length,60);
  assert.deepEqual(events.map(e=>e.meta.discovered),jobs.map((_,i)=>i+1));
  assert.equal(snapshots.length,0,'no full snapshot per candidate');
  assert.equal(recovery().rows.length,60);
  assert.equal(recovery().toolUrls.length,0);
  send({type:'response.completed',response:{status:'completed',output:[
   {type:'web_search_call',action:{sources:jobs.map(j=>({url:j.url}))}},
   {type:'message',content:[{type:'output_text',text:raw}]}]}});
  const result=await pending;
  assert.equal(calls,1);assert.equal(result.checkpoint.rows.length,60);
  assert.equal(events.length,60);
  assert.ok(snapshots.some(rows=>rows.length===60));
  assert.ok(snapshots.length<5,'only aggregate reconciliation');
 }finally{clearTimeout(timer);try{controller.close();}catch{}await pending.catch(()=>{});}
});


test('discovery observer consumes actual completed tool items and message parts without treating a citation as a job',async()=>{
 const {createV4DiscoveryJobObserver}=await import('../functions/_lib/v4-stream-job-parser.js');
 const a=job(7301),b=job(7302),sources=[],jobs=[];
 const observer=createV4DiscoveryJobObserver((j,m)=>jobs.push({url:j.url,source:m.source}),(u,m)=>sources.push({url:u,source:m.source}));
 const tool={type:'web_search_call',action:{sources:[{url:a.url},{url:a.url+'?utm_source=test'},{url:'https://www.zhipin.com/job_detail/a.html'},{url:'https://localhost/jobs/1'}]}};
 observer.event({type:'response.output_item.done',item:tool});
 assert.deepEqual(sources,[{url:a.url,source:'done'}]);
 assert.equal(jobs.length,0);
 observer.event({type:'response.content_part.done',part:{type:'output_text',text:JSON.stringify({jobs:[a]}),annotations:[{type:'url_citation',url:a.url}]}});
 observer.event({type:'response.output_item.done',item:{type:'reasoning',content:[{type:'output_text',text:JSON.stringify({jobs:[b]})}]}});
 assert.deepEqual(jobs,[{url:a.url,source:'done'}]);
 observer.event({type:'response.output_item.done',item:{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({jobs:[a,b]})}]}});
 assert.deepEqual(jobs.map(j=>j.url),[a.url,b.url]);
 observer.response({output:[tool,{type:'message',content:[{type:'output_text',text:JSON.stringify({jobs:[a,b]})}]}]});
 assert.equal(jobs.length,2);assert.equal(sources.length,1);
});

test('actual search consumes streamed citations before terminal output while preserving the original search instructions', {timeout:5000},async()=>{
 const a=job(7303),b=job(7304),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 let controller,recovery,resolveEvent,calls=0;
 const seen=new Promise(r=>{resolveEvent=r;});
 const stream=new ReadableStream({start(c){controller=c;}});
 const send=e=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));
 const pending=v4Match(async(_u,opts)=>{
  calls++;
  const payload=JSON.parse(opts.body);
  assert.match(payload.instructions,/不要限制企业、行业、岗位方向；搜索轮次不设人为上限/);
  assert.equal(payload.max_output_tokens,undefined);assert.equal(payload.max_tool_calls,undefined);
  return new Response(stream,{headers:{'content-type':'text/event-stream'}});
 },p,resume,'全国',{
  curated:true,officialOnly:true,stepMode:true,parallelResearch:false,
  checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles}},
  onRecoveryState:get=>{recovery=get;},onDiscoveryCandidate:e=>{if(e.candidate.official_url===a.url)resolveEvent();}
 });
 let timer;
 try{
  send({type:'response.output_item.done',item:{type:'web_search_call',action:{sources:[{url:a.url},{url:b.url}]}}});
  send({type:'response.content_part.done',part:{type:'output_text',text:JSON.stringify({jobs:[a]})}});
  await Promise.race([seen,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('completed item not consumed before terminal response')),1500);})]);clearTimeout(timer);
  assert.deepEqual(recovery().rows.map(([u])=>u),[a.url]);
  assert.ok(recovery().sourceLeads.includes(b.url));
  assert.deepEqual(recovery().toolUrls,[a.url]);
  send({type:'response.completed',response:{status:'completed',output:[
   {type:'web_search_call',action:{sources:[{url:a.url},{url:b.url}]}},
   {type:'message',content:[{type:'output_text',text:JSON.stringify({jobs:[a],research_complete:false})}]}]}});
  const result=await pending;assert.equal(calls,1);
  assert.equal(result.checkpoint.rows.length,1);assert.ok(result.checkpoint.sourceLeads.includes(b.url));
 }finally{clearTimeout(timer);try{controller.close();}catch{}await pending.catch(()=>{});}
});


test('managed discovery extracts a specific source-confirmed public vacancy before AI output without another model request', {timeout:8000},async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const a=job(7401),b=job(7402),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 let controller,recovery,resolveEvent,calls=0,pages=0;
 const events=[],seen=new Promise(r=>{resolveEvent=r;});
 const stream=new ReadableStream({start(c){controller=c;}});
 const send=e=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',url:a.url,title:a.title,hiringOrganization:{name:a.company,url:new URL(a.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 const budget=phaseResourceBudget();
 const pending=v4Match(budget.fetch(async(u,opts)=>{
  if(u===a.url){pages++;return new Response(html,{headers:{'content-type':'text/html'}});}
  if(u===b.url){pages++;return new Response('<html><h1>招聘列表</h1>'+html+'</html>',{headers:{'content-type':'text/html'}});}
  calls++;assert.match(JSON.parse(opts.body).instructions,/不要限制企业、行业、岗位方向；搜索轮次不设人为上限/);
  return new Response(stream,{headers:{'content-type':'text/event-stream'}});
 }),p,resume,'全国',{
  curated:true,officialOnly:true,stepMode:true,parallelResearch:false,env:{HHBA_MATCH_V4_READY:'1'},resourceBudget:budget,
  checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles}},
  onRecoveryState:get=>{recovery=get;},onDiscoveryCandidate:(e,m)=>{events.push({e,m});if(e.candidate.official_url===a.url)resolveEvent();}
 });
 let timer;
 try{
  send({type:'response.output_item.done',item:{type:'web_search_call',action:{sources:[{url:a.url},{url:b.url}]}}});
  await Promise.race([seen,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('no independently extracted vacancy before AI completion')),2500);})]);clearTimeout(timer);
  assert.equal(events.length,1);assert.equal(events[0].m.source,'source_read');
  assert.equal(events[0].e.candidate.match_score,null);
  assert.deepEqual(recovery().rows.map(([u])=>u),[a.url]);
  assert.ok(recovery().sourceLeads.includes(b.url));
  send({type:'response.completed',response:{status:'completed',output:[
   {type:'web_search_call',action:{sources:[{url:a.url},{url:b.url}]}},
   {type:'message',content:[{type:'output_text',text:JSON.stringify({jobs:[a],research_complete:false})}]}]}});
  const result=await pending;assert.equal(calls,1);assert.ok(pages>=1);
  assert.equal(events.length,1);assert.equal(result.checkpoint.rows.length,1);
  assert.ok(result.checkpoint.sourceLeads.includes(b.url));assert.equal(budget.denied,false);
 }finally{clearTimeout(timer);try{controller.close();}catch{}await pending.catch(()=>{});}
});

test('speculative citation read requires an exact structured vacancy URL, not a recruiting list or unrelated JobPosting',async()=>{
 const {v4ReadEmployerJob}=await import('../functions/_lib/v4-open-job-evidence.js');
 const a=job(7410),list='https://careers.employer7410.cn/jobs';
 const posting={'@type':'JobPosting',url:a.url,title:a.title,hiringOrganization:{name:a.company,url:new URL(a.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'负责销售运营和渠道管理。'};
 const fetcher=async()=>new Response('<script type="application/ld+json">'+JSON.stringify(posting)+'</script>',{headers:{'content-type':'text/html'}});
 assert.equal((await v4ReadEmployerJob(a.url,{fetcher,requireSpecificPosting:true})).canonical_url,a.url);
 await assert.rejects(v4ReadEmployerJob(list,{fetcher,requireSpecificPosting:true}),/V4_SPECIFIC_POSTING_NOT_CONFIRMED/);
 assert.equal((await v4ReadEmployerJob(list,{fetcher})).title,a.title,'ordinary verification behavior is unchanged');
});


test('rolling live verifier replenishes windows while discovery is still open, retaining revisions and deferring pressure',async()=>{
 const {createLiveVerificationCoordinator,pendingVerification,candidateRevision}=await import('../functions/_lib/v4-research-pipeline.js');
 const a=job(7501),b=job(7502),c=job(7503);
 let live={phase:'research',rows:[],toolUrls:[],profile,diagnostics:{}},admitted=true,done=0,resolveSecond;
 const second=new Promise(r=>{resolveSecond=r;});
 const observed=[];
 const coordinator=createLiveVerificationCoordinator({
  getDiscovery:()=>live,canStart:()=>admitted,choose:()=>({width:1,window:1}),
  run:async cp=>{
   const [[u,j]]=pendingVerification(cp);
   observed.push(u);
   return {status:'CONTINUE',checkpoint:{...cp,phase:'reporting',matches:[...cp.matches,{official_url:u,research_candidate_url:u,match_score:85}],read:cp.read+1,scored:cp.scored+1}};
  },
  onChange:()=>{done++;if(done===2)resolveSecond();}
 });
 live={...live,rows:[[a.url,a],[b.url,b]]};coordinator.wake();
 let timer;
 try{
  await Promise.race([second,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('rolling verifier did not refill')),1500);})]);clearTimeout(timer);
  admitted=false;
  live={...live,rows:[[a.url,{...a,requirements:'new evidence'}],[b.url,b],[c.url,c]]};
  coordinator.wake();
  const result=await coordinator.close();
  assert.deepEqual(observed,[a.url,b.url]);
  assert.equal(result.windows,2);assert.equal(result.checkpoint.priorState.scored,2);
  assert.equal(new Map(result.checkpoint.processedEvidence).get(a.url),candidateRevision(a));
  assert.deepEqual(pendingVerification(result.checkpoint).map(([u])=>u),[a.url,c.url]);
 }finally{clearTimeout(timer);await coordinator.close();}
});

test('production managed search verifies and scores a newly streamed candidate before the search response terminates', {timeout:10000},async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const a=job(7510),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 let controller,searchDone=false,searchCalls=0,scoreCalls=0,pages=0,resolveScored,liveRecovery;
 const scored=new Promise(r=>{resolveScored=r;});
 const stream=new ReadableStream({start(c){controller=c;}});
 const send=e=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',url:a.url,title:a.title,hiringOrganization:{name:a.company,url:new URL(a.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 const budget=phaseResourceBudget();
 const pending=v4Match(budget.fetch(async(u,opts)=>{
  if(u===a.url){assert.equal(searchDone,false);pages++;return new Response(html,{headers:{'content-type':'text/html'}});}
  const payload=JSON.parse(opts.body),input=JSON.parse(payload.input);
  if(input.job){assert.equal(searchDone,false);scoreCalls++;return model({suitable:false,score:45,reason:'有渠道经历但岗位要求不完全相符',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营',matched:['渠道运营'],gaps:[]});}
  searchCalls++;assert.match(payload.instructions,/不要限制企业、行业、岗位方向；搜索轮次不设人为上限/);
  assert.equal(payload.max_tool_calls,undefined);assert.equal(payload.max_output_tokens,undefined);
  return new Response(stream,{headers:{'content-type':'text/event-stream'}});
 }),p,resume,'全国',{
  curated:true,officialOnly:true,stepMode:true,parallelResearch:true,deferDiscoverySnapshots:true,env:{HHBA_MATCH_V4_READY:'1'},resourceBudget:budget,
  checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles},discoveryWidth:1},
  onRecoveryState:get=>{liveRecovery=get;},
  onPartial:rows=>{if(rows.some(j=>j.official_url===a.url&&j.match_score===45))resolveScored();}
 });
 let timer;
 try{
  const raw=JSON.stringify({jobs:[a],research_complete:false});
  send({type:'response.output_text.delta',output_index:0,content_index:0,delta:raw});
  await Promise.race([scored,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('verification waited for terminal search response')),4000);})]);clearTimeout(timer);
  assert.equal(searchDone,false);assert.equal(pages,1);assert.equal(scoreCalls,1);
  assert.equal(liveRecovery().priorState.matches[0].match_score,45);
  searchDone=true;
  send({type:'response.completed',response:{status:'completed',output:[{type:'web_search_call',action:{sources:[{url:a.url}]}},{type:'message',content:[{type:'output_text',text:raw}]}]}});
  const result=await pending;
  assert.equal(searchCalls,1);assert.equal(result.checkpoint.rows.length,1);
  assert.equal(result.checkpoint.priorState.scored,1);assert.equal(result.checkpoint.priorState.matches[0].match_score,45);
  assert.equal(result.checkpoint.diagnostics.LIVE_VERIFICATION_WINDOWS,1);
  assert.equal(budget.denied,false);
 }finally{clearTimeout(timer);try{controller.close();}catch{}await pending.catch(()=>{});}
});


test('independent report queue leaves unadmitted assessments available for durable continuation',async()=>{
 const {createLiveReportQueue}=await import('../functions/_lib/v4-research-pipeline.js');
 const a=job(7601),b=job(7602);
 let release,admitted=true;
 const gate=new Promise(r=>{release=r;}),started=[];
 const q=createLiveReportQueue({canStart:()=>admitted,keyOf:j=>j.url,run:async j=>{started.push(j.url);await gate;}});
 assert.equal(q.offer(a),true);assert.equal(q.offer(a),false);assert.equal(q.offer(b),true);
 await Promise.resolve();assert.deepEqual(started,[a.url]);
 admitted=false;const settled=q.settle();release();
 assert.deepEqual(await settled,{failure:null,deferred:1});
 assert.deepEqual(started,[a.url]);
});

test('managed scoring advances the next official vacancy while the first complete report is still generating', {timeout:8000},async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const a=job(7610),b=job(7611),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const html=j=>'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',url:j.url,title:j.title,hiringOrganization:{name:j.company,url:new URL(j.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 let release,firstReportStarted=false,firstReportDone=false,secondScoredDuringReport=false,reports=0,scoreCalls=0;
 const gate=new Promise(r=>{release=r;});
 const timer=setTimeout(release,2000);
 const assessments={suitable:true,score:86,reason:'渠道运营匹配',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营',matched:['渠道运营'],gaps:[]};
 const budget=phaseResourceBudget();
 try{
 const result=await v4Match(budget.fetch(async(u,opts)=>{
  if(u===a.url||u===b.url)return new Response(html(u===a.url?a:b),{headers:{'content-type':'text/html'}});
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.established_score!==undefined){
   reports++;
   if(input.job.title===a.title){firstReportStarted=true;await gate;firstReportDone=true;}
   return model({...assessments,comparisons:[{jd_quote:'汽车经销商渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实渠道运营经历与工作要求相关'}],quality_review:{status:'complete',explanation:'已对实际职责与要求完成分析',missing:[]}});
  }
  if(input.job){
   scoreCalls++;
   if(input.job.title===b.title){secondScoredDuringReport=firstReportStarted&&!firstReportDone;release();}
   return model(assessments);
  }
  throw Error('unexpected model request');
 }),p,resume,'全国',{
  curated:true,officialOnly:true,stepMode:true,parallelResearch:true,pipelineChild:true,env:{HHBA_MATCH_V4_READY:'1'},resourceBudget:budget,
  checkpoint:{phase:'verification',next:0,rows:[[a.url,a],[b.url,b]],profile,toolUrls:[a.url,b.url],verificationBatch:2,verificationLaneWidth:1,managedVerification:{cost:2,width:1}}
 });
 assert.equal(scoreCalls,2);assert.equal(reports,2);
 assert.equal(secondScoredDuringReport,true);
 assert.equal(result.checkpoint.matches.filter(j=>j.report_status==='COMPLETE').length,2);
 assert.equal(budget.denied,false);
 }finally{clearTimeout(timer);release();}
});


test('live delivery telemetry distinguishes provider output, engine results and durable publication without sensitive contents',async()=>{
 const {createV4DeliveryTelemetry}=await import('../functions/_lib/v4-live-delivery-telemetry.js');
 let t=1000;const logs=[];
 const d=createV4DeliveryTelemetry({now:()=>t,trace:'test-trace',log:(event,record)=>logs.push({event,record})});
 const provider=d.provider('discovery');
 t+=20;provider.observe('headers','sse');
 t+=10;provider.observe('first_chunk');provider.observe('first_frame');
 t+=100;provider.observe('first_search_complete');provider.observe('first_source');
 t+=200;provider.observe('first_text');provider.observe('first_candidate');
 t+=5;provider.observe('first_candidate');provider.observe('private-resume-content','secret-key');
 d.result('candidate');d.result('jd_engine');d.blocked('candidate');
 t+=50;d.result('score_engine');d.result('report_engine');d.result('report');
 const failed=d.write('report',{candidateCount:2,reportCount:1});t+=10;failed.finish(false);
 assert.equal(d.snapshot().first.saved_report,undefined);
 const written=d.write('report',{candidateCount:2,reportCount:1});t+=30;written.finish(true);
 t+=5;provider.observe('terminal');provider.finish('completed');d.finish();
 const summary=d.snapshot();
 assert.equal(summary.first.provider_first_candidate,330);
 assert.equal(summary.first.result_candidate,335);
 assert.equal(summary.first.saved_report,425);
 assert.equal(summary.counts.blocked_candidate,1);
 assert.equal(summary.counts.write_failed,1);
 assert.equal(summary.counts.write_ok,1);
 assert.equal(summary.last_provider.transport,'sse');
 assert.equal(summary.last_provider.counts.first_candidate,2);
 assert.equal(written.stamp.version,2);
 assert.equal(logs.filter(x=>x.event==='provider_milestone'&&x.record.name==='first_candidate').length,1);
 assert.doesNotMatch(JSON.stringify({logs,summary}),/private-resume-content|secret-key/);
});

test('actual V4 provider call records first complete candidate before terminal response, and distinguishes JSON fallback', {timeout:5000},async()=>{
 const {createV4DeliveryTelemetry}=await import('../functions/_lib/v4-live-delivery-telemetry.js');
 const {v4Call}=await import('../functions/_lib/simple-match-v4.js');
 const a=job(7701),logs=[];let t=2000,controller,resolveCandidate;
 const observed=new Promise(r=>{resolveCandidate=r;});
 const d=createV4DeliveryTelemetry({now:()=>t,log:(event,record)=>logs.push({event,record})});
 const p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true,deliveryTelemetry:d};
 const stream=new ReadableStream({start(c){controller=c;}});
 const send=e=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));
 const payload={instructions:'private prompt never logged',input:'private resume never logged',tools:[{type:'web_search'}]};
 const pending=v4Call(async()=>{t+=25;return new Response(stream,{headers:{'content-type':'text/event-stream'}});},p,payload,{
  stage:'discovery',onDiscoveryJob:()=>resolveCandidate(),onDiscoverySource:()=>{}
 });
 let timer;
 try{
  t+=100;send({type:'response.output_item.done',item:{type:'web_search_call',action:{sources:[{url:a.url}]}}});
  const raw=JSON.stringify({jobs:[a],research_complete:false});
  t+=200;send({type:'response.output_text.delta',delta:raw});
  await Promise.race([observed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('candidate not observed before terminal')),1500);})]);clearTimeout(timer);
  assert.ok(d.snapshot().first.provider_first_source>=0);
  assert.ok(d.snapshot().first.provider_first_candidate>=0);
  assert.equal(d.snapshot().last_provider,null);
  assert.ok(logs.some(x=>x.event==='provider_milestone'&&x.record.name==='first_candidate'));
  t+=500;send({type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:raw}]}]}});
  await pending;
  assert.equal(d.snapshot().last_provider.transport,'sse');
  assert.ok(d.snapshot().last_provider.times.terminal>d.snapshot().last_provider.times.first_candidate);
  let calls=0;
  await v4Call(async()=>++calls===1?new Response('{}',{status:422,headers:{'content-type':'application/json'}}):model({jobs:[a]},[a.url]),p,payload,{stage:'discovery',onDiscoveryJob:()=>{}});
  assert.equal(calls,2);assert.equal(d.snapshot().last_provider.transport,'json');
  assert.equal(d.snapshot().last_provider.counts.fallback,1);
  assert.doesNotMatch(JSON.stringify(logs),/private prompt|private resume|synthetic-only|careers\.employer/);
 }finally{clearTimeout(timer);try{controller.close();}catch{}await pending.catch(()=>{});}
});

 test('live report queue admits two independently, preserves sibling after failure and defers the rest',async()=>{
 const {createLiveReportQueue}=await import('../functions/_lib/v4-research-pipeline.js');
 let release,fail;const gate=new Promise(r=>{release=r;}),bad=new Promise((_,r)=>{fail=r;});
 const started=[],complete=[];const q=createLiveReportQueue({width:2,keyOf:j=>j.url,run:async j=>{started.push(j.url);await (j.url==='a'?bad:gate);complete.push(j.url);}});
 for(const url of ['a','b','c'])q.offer({url});await Promise.resolve();assert.deepEqual(started,['a','b']);
 fail(Error('temporary'));await new Promise(r=>setTimeout(r,0));release();const result=await q.settle();
 assert.equal(result.failure.message,'temporary');assert.deepEqual(complete,['b']);assert.equal(result.deferred,2);
 });
 test('phase report reserve does not reduce logical research allowance twice',async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const b=phaseResourceBudget({initial:22,soft:24,hard:34,progressReserve:4});const before=b.remainingResearch();assert.equal(b.tryProgress('report'),true);assert.equal(b.remainingResearch(),before);
 });


test('live verifier exposes intermediate results for only its current admitted revision',async()=>{
 const {createLiveVerificationCoordinator}=await import('../functions/_lib/v4-research-pipeline.js');
 const u='https://example.com/jobs/1',j={company:'A',title:'运营',location:'上海',requirements:'经验'};
 let cp={phase:'research',rows:[[u,j]],priorState:{matches:[]}};
 let ready,release;const waiting=new Promise(r=>{release=r;});const started=new Promise(r=>{ready=r;});
 const coordinator=createLiveVerificationCoordinator({getDiscovery:()=>cp,choose:()=>({width:1,window:1}),run:async(_verify,cb)=>{cb.onPartial([{official_url:u,research_candidate_url:u,jd_source_status:'VERIFIED_JD',evidence_excerpt:'原文'}]);ready();await waiting;return {checkpoint:{..._verify,phase:'reporting'}};}});
 coordinator.wake();await started;
 assert.equal(coordinator.liveJobs()[0].evidence_excerpt,'原文');
 cp={...cp,rows:[[u,{...j,requirements:'新要求'}]]};assert.equal(coordinator.liveJobs().length,0);
 release();await coordinator.close();
});

test('dedicated delivery continuation completes a discovered job before another search and preserves the remaining pool', {timeout:8000},async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const a=job(7630),b=job(7631),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 const html=j=>'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',url:j.url,title:j.title,hiringOrganization:{name:j.company,url:new URL(j.url).origin},jobLocation:{address:{addressLocality:'上海'}},description:'<p>岗位职责</p><p>负责汽车经销商渠道运营和业务流程管理及销售数据分析。</p><p>负责业务沟通和门店管理。</p><p>任职要求</p><p>熟悉渠道运营和经销商业务流程，具备项目沟通能力。</p><p>具备独立分析和组织协调能力。</p>'})+'</script>';
 let reads=0,scored=0,reports=0,seenJd=false,seenScore=false,seenReport=false;
 const assessment={suitable:true,score:86,reason:'渠道运营匹配',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车经销商渠道运营',matched:['渠道运营'],gaps:[]};
 const budget=phaseResourceBudget();
 const result=await v4Match(budget.fetch(async(u,opts)=>{
  if(u===a.url){reads++;return new Response(html(a),{headers:{'content-type':'text/html'}});}
  if(u===b.url)throw Error('second candidate not admitted in this continuation');
  const input=JSON.parse(JSON.parse(opts.body).input);
  if(input.established_score!==undefined){assert.ok(seenScore);reports++;return model({...assessment,comparisons:[{jd_quote:'汽车经销商渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实渠道运营经历与工作要求相关'}],quality_review:{status:'complete',explanation:'已对实际职责与要求完成分析',missing:[]}});}
  if(input.job){assert.ok(seenJd);scored++;return model(assessment);}
  throw Error('new discovery must wait for this dedicated delivery continuation');
 }),p,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,deferDiscoverySnapshots:true,env:{HHBA_MATCH_V4_READY:'1'},resourceBudget:budget,
  checkpoint:{phase:'research',rows:[[a.url,a],[b.url,b]],profile,toolUrls:[a.url,b.url],pipelineActive:true,liveDeliveryTurn:'verification'},
  onPartial:jobs=>{const j=jobs.find(j=>j.official_url===a.url);if(j?.evidence_excerpt)seenJd=true;if(j?.match_score===86)seenScore=true;if(j?.report_status==='COMPLETE')seenReport=true;}
 });
 assert.equal(reads,1);assert.equal(scored,1);assert.equal(reports,1);assert.ok(seenJd&&seenScore&&seenReport);
 assert.equal(result.checkpoint.phase,'research');assert.equal(result.checkpoint.liveDeliveryTurn,'search');
 assert.equal(result.checkpoint.rows.length,2);assert.equal(result.checkpoint.priorState.matches.find(j=>j.official_url===a.url).report_status,'COMPLETE');
 assert.deepEqual(result.checkpoint.processedEarlier,[a.url]);
});

test('live search source and commercial exclusion counts are published before any candidate object or terminal response', {timeout:5000},async()=>{
 const a=job(7650),p={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test',stream:true};
 let controller,release,finished=false;const received=new Promise(r=>{release=r;});const stats=[];
 const stream=new ReadableStream({start(c){controller=c;}}),send=e=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));
 const run=v4Match(async()=>new Response(stream,{headers:{'content-type':'text/event-stream'}}),p,resume,'全国',{
  curated:true,officialOnly:true,stepMode:true,parallelResearch:false,checkpoint:{phase:'research',rows:[],profile:{...profile,target_roles:profile.roles}},
  onDiscoveryStats:s=>{stats.push(s);if(s.search_source_count===2&&s.excluded_count===1)release();}});
 let timeout;try{
  const tool={type:'web_search_call',action:{sources:[{url:a.url},{url:'https://www.zhipin.com/job_detail/a.html'},{url:a.url+'?utm_source=repeat'}]}};
  send({type:'response.output_item.done',item:tool});
  await Promise.race([received,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('source counts waited for model completion')),1500);})]);
  assert.equal(finished,false);assert.equal(stats.at(-1).discovered,0);assert.equal(stats.at(-1).search_source_count,2);
  finished=true;send({type:'response.completed',response:{status:'completed',output:[tool,{type:'message',content:[{type:'output_text',text:JSON.stringify({jobs:[a],research_complete:false})}]}]}});
  const result=await run;assert.equal(result.checkpoint.observedSearchSources.length,2);assert.equal(result.checkpoint.rejectedBoards.length,1);
 }finally{clearTimeout(timeout);try{controller.close();}catch{}await run.catch(()=>{});}
});
