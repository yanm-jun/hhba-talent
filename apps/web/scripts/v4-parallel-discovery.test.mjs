import test from 'node:test';
import assert from 'node:assert/strict';
import {runDiscoveryWave,nextDiscoveryWidth,combineDiscovery,discoveryLaneContext} from '../functions/_lib/v4-parallel-discovery.js';
import {v4Match,renderCandidatePreview} from '../functions/_lib/simple-match-v4.js';
const resume='本人负责汽车经销商渠道运营，区域销售督导、团队培训、销售数据分析、项目管理和客户服务。';
const profile={summary:'汽车经销商渠道运营',roles:['区域销售督导','运营管理'],skills:[],facts:[],education:null};
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

test('actual Gemini global ranking reaches provider and persists pool-scoped notes, without polluting discovery notes',async()=>{
 const candidate=job(91),provider={kind:'gemini',key:'synthetic-only',baseUrl:'https://provider.invalid',model:'test'};
 const match={company:candidate.company,title:candidate.title,location:candidate.location,official_url:candidate.url,source_type:'站外官方招聘',reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'可能负责渠道管理。',reference_jd_basis:'方向推断',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:86,curated_suitable:true,report_status:'COMPLETE',research_detail:{comparisons:[],score_explanation:'真实经历匹配'}};
 let calls=0;
 const result=await v4Match(async(url,opts)=>{
  calls++;const input=JSON.parse(JSON.parse(opts.body).contents[0].parts[0].text);
  assert.deepEqual(input.pending_ids,['j1']);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({ordered_ids:['j1'],research_notes:'pool-only ranking observation'})}]}}]});
 },provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true,checkpoint:{phase:'reporting',rows:[[candidate.url,candidate]],profile,matches:[match],researchNotes:['discovery-only']}});
 assert.equal(calls,1);assert.deepEqual(result.checkpoint.globalOrder,[candidate.url]);
 assert.equal(result.checkpoint.globalRankState.done,true);assert.deepEqual(result.checkpoint.globalRankState.notes,['pool-only ranking observation']);assert.deepEqual(result.checkpoint.researchNotes,['discovery-only']);
});

test('Gemini reviews confirmed vacancy for complete JD before falling back to reference',async()=>{
 const candidate=job(92),provider={kind:'gemini',key:'synthetic-only',baseUrl:'https://provider.invalid',model:'test'};
 let recovery=0,assessment=0;
 const fetcher=async(url,opts)=>{
  if(url===candidate.url)return Response.json({'@type':'JobPosting',title:candidate.title,hiringOrganization:{name:candidate.company,url:new URL(candidate.url).origin},jobLocation:{address:{addressLocality:'上海'}}});
  const input=JSON.parse(JSON.parse(opts.body).contents[0].parts[0].text);
  let value;
  if(input.original_url){recovery++;assert.equal(input.confirmed_vacancy,true);value={sources:[],research_complete:true,completion_reason:'公开原文未找到'};}
  else {assessment++;assert.equal(input.job.vacancy_confirmed,true);value={reference_jd:'可能负责汽车渠道运营。可能需要渠道数据分析能力。',reference_basis:'方向推断。',reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'渠道数据分析能力'},quality_review:{status:'complete',explanation:'已覆盖可能职责、能力方向和真实经历差距；实际资格未知。',missing:[]},suitable:true,score:86,reason:'相关经历',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车渠道运营',comparisons:[{jd_quote:'汽车渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实经历对应推断职责'},{jd_quote:'渠道数据分析能力',status:'missing',analysis:'尚无直接数据分析证据'}]};}
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 assert.ok(recovery>=1);assert.equal(assessment,2);assert.equal(result.checkpoint.matches[0].reference_vacancy_verified,true);assert.equal(result.checkpoint.matches[0].match_score,86);assert.equal(result.checkpoint.matches[0].report_status,'COMPLETE');assert.match(result.checkpoint.matches[0].reference_jd,/渠道数据分析能力/);assert.ok(result.checkpoint.matches[0].research_detail.comparisons.length);
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

test('Gemini global ranking switches to focused recovery rather than discarding unfinished pool',async()=>{
 const candidate=job(93),provider={kind:'gemini',key:'synthetic-only',baseUrl:'https://provider.invalid',model:'test'};
 const match={company:candidate.company,title:candidate.title,location:candidate.location,official_url:candidate.url,source_type:'站外官方招聘',reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'可能负责渠道管理。',reference_jd_basis:'方向推断',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:86,curated_suitable:true,report_status:'COMPLETE',research_detail:{comparisons:[],score_explanation:'真实经历匹配'}};
 let calls=0;
 const fetcher=async(url,opts)=>{
  calls++;const input=JSON.parse(JSON.parse(opts.body).contents[0].parts[0].text);
  const value=input.focus_id?{insertions:[{id:input.focus_id,after_id:null}]}:{ordered_ids:[]};
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
 };
 const opts={curated:true,officialOnly:true,stepMode:true};
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
  assessment++;assert.equal(input.job.vacancy_confirmed,true);
  if(assessment===1)return model({reference_jd:'可能负责汽车渠道运营。',reference_basis:'方向推断，实际资格未知。',suitable:true,score:86,reason:'相关经历',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车渠道运营',comparisons:[]});
  assert.match(input.previous_validation_error,/quality_review_incomplete/);
  assert.match(input.previous_validation_error,/reference_duties_and_capabilities_coverage/);
  assert.match(input.previous_validation_error,/reference_source_duties/);
  return model({reference_source_anchors:{duties:{kind:'title_direction',url:'',quote:input.job.title},capabilities:{kind:'title_direction',url:'',quote:input.job.title}},reference_jd:'可能负责汽车渠道运营。可能需要渠道数据分析能力。',reference_basis:'方向推断。',reference_coverage:{duties_quote:'汽车渠道运营',capabilities_quote:'渠道数据分析能力'},quality_review:{status:'complete',explanation:'已覆盖可能职责、能力方向和真实经历差距；实际资格未知。',missing:[]},suitable:true,score:86,reason:'相关经历',resume_quote:'汽车经销商渠道运营',jd_quote:'汽车渠道运营',comparisons:[{jd_quote:'汽车渠道运营',resume_quote:'汽车经销商渠道运营',status:'supported',analysis:'真实经历对应推断职责'},{jd_quote:'渠道数据分析能力',status:'missing',analysis:'尚无直接数据分析证据'}]});
 };
 const result=await v4Match(fetcher,provider,resume,'全国',{env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:{phase:'verification',next:0,rows:[[candidate.url,candidate]],profile,toolUrls:[candidate.url],verificationBatch:1}});
 assert.ok(recovery>=1);assert.equal(assessment,1);assert.equal(result.checkpoint.matches[0].reference_vacancy_verified,true);assert.equal(result.checkpoint.matches[0].match_score,86);
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
