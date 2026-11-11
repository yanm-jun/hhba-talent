import test from 'node:test';
import assert from 'node:assert/strict';
import {
 EMPLOYER_ENRICH_VERSION,selectCompanyEvidenceResults,companyPageEvidence,
 validateBusinessProposals,enrichPublicCompany,stage3Enabled,
 queueEmployerCandidates,processOneEnrichment
} from '../functions/_lib/employer-enrichment-v1.js';
import {knowledgeCaptureCallbacks} from '../functions/_lib/knowledge-capture-v1.js';

const company='南芯科技';
const source='https://www.southchip.com/about';
const page=[
 '南芯科技是一家专注于电源管理芯片研发的半导体公司。',
 '主营业务是高效率电源管理芯片、集成电路设计及相关信号链产品。',
 '产品和解决方案包括车规汽车电子、智能座舱供电、USB Type-C充电、',
 '工业控制及工业自动化设备的电源模块、马达驱动以及传感器。',
 '南芯科技在消费电子电源和车规器件领域提供完整解决方案，',
 '发展先进嵌入式硬件研发能力，持续推进技术研究及产品研发。'
].join('\n');
const queryRows=[
 {url:'https://nanxin.zhiye.com/campus/',title:'南芯科技 校园招聘',summary:'招聘岗位'},
 {url:'https://www.zhipin.com/gongsi/123',title:'南芯科技 公司招聘',summary:'主营业务'},
 {url:source,title:'南芯科技公司介绍 官网',summary:'南芯科技主营半导体电源管理芯片与车规业务'},
 {url:'http://www.southchip.com/about',title:'南芯科技 官网',summary:'电源管理'}
];
const modelResult={primary_industry:[{tag_id:'semiconductors',quote:'主营业务是高效率电源管理芯片'}],
 additional_industries:[{tag_id:'automotive',quote:'车规汽车电子'}],
 business_lines:[{tag_id:'hardware-rd',quote:'嵌入式硬件研发能力'}],
 business_segments:[{tag_id:'automotive-electronics',quote:'智能座舱供电'}],
 technologies:[{tag_id:'industrial-control',quote:'工业控制及工业自动化设备'}]};
function simulatedProvider({answer=modelResult,hasCompany=true}={}){
 const calls=[];
 return {calls,fetcher:async (url,opts)=>{
  calls.push({url,body:JSON.parse(opts.body)});
  if(url.endsWith('/search'))return {ok:true,async json(){return {results:queryRows}}};
  if(url.endsWith('/fetch'))return {ok:true,async json(){return {content:hasCompany?page:page.replaceAll('南芯科技','某其他主体')}}};
  if(url.endsWith('/responses'))return {ok:true,async json(){return {
   output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answer)}]}]
  }}};
  throw Error('unexpected API');
 }};
}
test('safe company-page discovery ignores career ATS, boards and non-https URLs',()=>{
 const selected=selectCompanyEvidenceResults(company,queryRows);
 assert.deepEqual(selected,[source]);
 assert.deepEqual(selectCompanyEvidenceResults('13800138000',queryRows),[]);
});
test('no company identity on fetched page means no evidence',()=>{
 assert.equal(companyPageEvidence(company,source,page.replaceAll('南芯科技','其他企业')),null);
 assert.equal(companyPageEvidence(company,'http://www.southchip.com/about',page),null);
 assert.equal(companyPageEvidence(company,source,'南芯科技招人'),null);
 assert.equal(companyPageEvidence(company,source,page)?.page_name_matched,true);
});
test('industry, additional businesses, technology remain distinct and source-quoted',()=>{
 const evidence=companyPageEvidence(company,source,page);
 const tags=validateBusinessProposals(modelResult,evidence);
 assert.ok(tags.some(t=>t.dimension==='PRIMARY_INDUSTRY'&&t.tag_id==='semiconductors'));
 assert.ok(tags.some(t=>t.dimension==='ADDITIONAL_INDUSTRY'&&t.tag_id==='automotive'));
 assert.ok(tags.some(t=>t.dimension==='BUSINESS_LINE'&&t.tag_id==='hardware-rd'));
 assert.ok(tags.some(t=>t.dimension==='BUSINESS_SEGMENT'&&t.tag_id==='automotive-electronics'));
 assert.ok(tags.some(t=>t.dimension==='TECHNOLOGY'&&t.tag_id==='industrial-control'));
 assert.ok(tags.every(t=>t.review_status==='PROPOSED'));
 assert.ok(tags.every(t=>page.includes(t.evidence_excerpt)));
});
test('unknown tags, model hallucinations and nonverbatim references are discarded',()=>{
 const evidence=companyPageEvidence(company,source,page);
 assert.deepEqual(validateBusinessProposals({primary_industry:[
  {tag_id:'invented',quote:'主营业务是高效率电源管理芯片'},
  {tag_id:'semiconductors',quote:'这是一家很厉害的公司'}
 ]},evidence),[]);
});
test('DeepSeek public Search/Fetch/Responses classify without resume text and do not verify source',async()=>{
 const mock=simulatedProvider();
 const got=await enrichPublicCompany(company,'abcdefghijklmnop',{fetcher:mock.fetcher});
 assert.equal(mock.calls.length,3);
 assert.ok(mock.calls[0].url.endsWith('/search'));
 assert.ok(mock.calls[1].url.endsWith('/fetch'));
 assert.ok(mock.calls[2].url.endsWith('/responses'));
 assert.equal(mock.calls[1].body.url,source);
 assert.ok(got.proposals.length>=4);
 const s=JSON.stringify(mock.calls);
 assert.ok(!s.includes('简历正文'));
 assert.ok(!s.includes('13800138000'));
 assert.ok(!('verified' in got));
});
test('failed employer-name evidence blocks classification and model call',async()=>{
 const mock=simulatedProvider({hasCompany:false});
 await assert.rejects(enrichPublicCompany(company,'abcdefghijklmnop',{fetcher:mock.fetcher}),/ENRICH_NO_COMPANY_EVIDENCE/);
 assert.equal(mock.calls.length,2);
});
test('only explicit preview flag + key permit enrichment',()=>{
 const base={HHBA_MATCH_DEEPSEEK_KEY:'abcdefghijklmnop',HHBA_PNVS_AUTH_DB:{prepare(){}}};
 assert.equal(stage3Enabled({...base,HHBA_EMPLOYER_ENRICHMENT_ENABLED:'1'}),false);
 assert.equal(stage3Enabled({...base,HHBA_AUTH_ROLLOUT:'preview'}),false);
 assert.equal(stage3Enabled({...base,HHBA_AUTH_ROLLOUT:'preview',HHBA_EMPLOYER_ENRICHMENT_ENABLED:'1'}),true);
});
test('capture callback remains disabled without Stage2 feature flag',()=>{
 const callbacks=knowledgeCaptureCallbacks({HHBA_AUTH_ROLLOUT:'preview',
  HHBA_EMPLOYER_ENRICHMENT_ENABLED:'1',HHBA_PNVS_AUTH_DB:{prepare(){}}},()=>{});
 assert.deepEqual(callbacks,{});
});
test('queue receives only normalized public company+host keys, not user text',async()=>{
 const submitted=[];
 const db={prepare(sql){return {bind(...args){
  submitted.push({sql,args});return {async run(){return {meta:{changes:1}}}};
 }}}};
 const count=await queueEmployerCandidates(db,[{
  company:'南芯科技',title:'电路工程师',location:'上海',
  official_url:'https://careers.example.com/jobs/123',
  private_resume:'PRIVATE_CONTENT',phone:'13812345678',score:99
 }],{now:new Date('2026-11-11T07:00:00Z')});
 assert.equal(count,1);
 const str=JSON.stringify(submitted);
 assert.ok(!str.includes('PRIVATE_CONTENT'));
 assert.ok(!str.includes('13812345678'));
 assert.ok(!str.includes('电路工程师'));
 assert.ok(str.includes('南芯科技'));
});
test('one queued candidate uses a daily budget and never upgrades source ownership',async()=>{
 const log=[];let attempts=0;
 const db={
  prepare(sql){return {bind(...params){return {sql,params,
   async first(){
    if(sql.includes('SELECT q.employer_observation_id'))return {id:'emp-demo',company};
    if(sql.includes('SELECT attempts'))return {attempts};
    return null;
   },
   async run(){log.push({sql,params});if(sql.includes('attempts=attempts+1'))attempts++;
    return {success:true,meta:{changes:1}};}
  }}}},
  async batch(stmts){log.push(...stmts);return stmts.map(()=>({success:true}))}
 };
 const mock=simulatedProvider();
 const done=await processOneEnrichment(db,'abcdefghijklmnop',{fetcher:mock.fetcher,
  now:new Date('2026-11-11T07:00:00Z')});
 assert.equal(done.status,'PROPOSED');
 assert.ok(done.tags>=4);
 assert.equal(mock.calls.length,3);
 const sql=log.map(x=>x.sql).join(' ');
 assert.ok(sql.includes('hhba_knowledge_employer_tag_proposals'));
 assert.ok(sql.includes('last_seen_at=excluded.last_seen_at'));
 assert.ok(!sql.includes("SET review_status='VERIFIED'"));
 assert.ok(!sql.includes("SET identity_status='REVIEWED'"));
 assert.ok(!sql.includes("SET evidence_status='DETAIL_REVIEWED'"));
});
