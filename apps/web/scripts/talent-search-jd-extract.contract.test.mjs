import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStructuredJobPostings, extractJobFieldsFromPage } from '../functions/_lib/talent-search-jd-extract.js';
import { readPublicEmployerPage } from '../functions/_lib/talent-search-page-reader.js';
import { verifyOfficialJobEvidence } from '../functions/_lib/talent-search-official-proof.js';
import { createTalentOfficialVerifier } from '../functions/_lib/talent-search-verifier-pipeline.js';

const NOW = new Date('2026-11-15T04:00:00.000Z');
const URL_JOB = 'https://careers.illustrative.example.cn/jobs/long-retail-20261115';
const COMPANY = '示例零售集团有限公司';
const DUTIES = '负责全国区域门店经营管理工作，组织开展常态化巡店整改、销售运营指标复盘与渠道团队人员培训。';
const REQUIREMENTS = '具有两年以上区域门店管理或渠道运营工作经验，能独立推进跨部门协调、业务数据分析与店面运营改善项目。';
const PROOF = {
  issuer:'independent_company_audit',
  record_id:'audited-illustrative-20261115',
  status:'verified',
  company:COMPANY,
  official_domain:'illustrative.example.cn',
  verified_at:'2026-11-14T00:00:00Z',
};

const makeJob = (overrides = {}) => ({
  '@context':'https://schema.org',
  '@type':'JobPosting',
  title:'全国区域督导',
  hiringOrganization:{'@type':'Organization',name:COMPANY},
  jobLocation:{'@type':'Place',address:{
    '@type':'PostalAddress',addressLocality:'上海',addressCountry:'CN',
  }},
  responsibilities:DUTIES,
  qualifications:REQUIREMENTS,
  description:'岗位职责：'+DUTIES+'\n任职要求：'+REQUIREMENTS,
  url:URL_JOB,
  datePosted:'2026-11-12',
  validThrough:'2026-12-15',
  baseSalary:{'@type':'MonetaryAmount',currency:'CNY',value:{
    '@type':'QuantitativeValue',minValue:16000,maxValue:26000,unitText:'MONTH',
  }},
  ...overrides,
});

const html = node => '<html><head><script type="application/ld+json">' +
  JSON.stringify(node) + '</script></head><body><h1>官方招聘页面</h1><p>企业招聘岗位详情</p></body></html>';

function readOptions(body) {
  return {
    allowHosts:['careers.illustrative.example.cn'],
    now:NOW,
    fetcher:async()=>new Response(body,{
      status:200,headers:{'Content-Type':'text/html; charset=utf-8'},
    }),
  };
}

test('read HTML JSON-LD JobPosting and keep detailed evidence separate from visible text', async () => {
  const page=await readPublicEmployerPage(URL_JOB,readOptions(html(makeJob())));
  assert.equal(page.structured_jobs.length,1);
  assert.equal(page.structured_jobs[0].title,'全国区域督导');
  assert.equal(page.structured_jobs[0].company,COMPANY);
  assert.equal(page.structured_jobs[0].location,'上海');
  assert.equal(page.structured_jobs[0].salary,'16000-26000 CNY/MONTH');
  assert.ok(page.structured_jobs[0].requirements.includes('业务数据分析'));
  assert.doesNotMatch(page.text,/16000-26000/);
  assert.equal(page.headings[0],'官方招聘页面');
  const fields=extractJobFieldsFromPage(page,{employer:COMPANY});
  assert.equal(fields.source_kind,'jsonld');
  assert.equal(fields.source_index,0);
  assert.equal(fields.title,'全国区域督导');
});

test('first-party official JD validator accepts URL-bound JSON-LD with all facts grounded', async () => {
  const page=await readPublicEmployerPage(URL_JOB,readOptions(html(makeJob())));
  const result=verifyOfficialJobEvidence({url:URL_JOB},{
    employer_proof:PROOF,
    job_page:page,
    job_fields:extractJobFieldsFromPage(page,{employer:COMPANY}),
  },{now:NOW.getTime()});
  assert.equal(result.eligible,true);
  assert.equal(result.job.title,'全国区域督导');
  assert.equal(result.field_evidence.evidence_kind,'jsonld');
  assert.equal(result.job.salary,'16000-26000 CNY/MONTH');
  assert.equal(result.job.availability_status,'UNKNOWN');
});

test('a forged JSON-LD vacancy with another application URL cannot verify this URL', async () => {
  const source=makeJob({url:'https://careers.illustrative.example.cn/jobs/different-opening-012345'});
  const page=await readPublicEmployerPage(URL_JOB,readOptions(html(source)));
  const fields=extractJobFieldsFromPage(page,{employer:COMPANY});
  assert.equal(fields,null);
});

test('multiple JSON-LD jobs without exact URL matching cannot be treated as a single position', async () => {
  const body=html({'@context':'https://schema.org','@graph':[
    makeJob({url:'',title:'区域督导'}),
    makeJob({url:'',title:'区域运营经理'}),
  ]});
  const page=await readPublicEmployerPage(URL_JOB,readOptions(body));
  assert.equal(page.structured_jobs.length,2);
  assert.equal(extractJobFieldsFromPage(page,{employer:COMPANY}),null);
});

test('validThrough in the past rejects expired JSON-LD despite a 200 page response', async () => {
  const page=await readPublicEmployerPage(URL_JOB,readOptions(html(makeJob({validThrough:'2026-10-01'}))));
  const result=verifyOfficialJobEvidence({url:URL_JOB},{
    employer_proof:PROOF,
    job_page:page,
    job_fields:extractJobFieldsFromPage(page,{employer:COMPANY}),
  },{now:NOW.getTime()});
  assert.equal(result.eligible,false);
  assert.equal(result.state,'CLOSED_OR_EXPIRED');
  assert.equal(result.reason,'STRUCTURED_POSTING_EXPIRED');
});

test('a model cannot claim a fake salary or company when JSON-LD says otherwise', async () => {
  const page=await readPublicEmployerPage(URL_JOB,readOptions(html(makeJob())));
  const normal=extractJobFieldsFromPage(page,{employer:COMPANY});
  for(const fields of [
    {...normal,salary:'100000-200000 CNY/MONTH'},
    {...normal,company:'另一个集团有限公司'},
    {...normal,title:'量子计算科学家'},
    {...normal,requirements:'必须具有核聚变反应堆经验，招聘条件与实际网页完全不同。'},
  ]){
    const result=verifyOfficialJobEvidence({url:URL_JOB},{
      employer_proof:PROOF,job_page:page,job_fields:fields,
    },{now:NOW.getTime()});
    assert.equal(result.eligible,false);
  }
});

test('visible Chinese JD sections can be extracted without a fixed occupation dictionary', async () => {
  const body='<html><body><header>'+COMPANY+'</header><h1>区域门店巡店培训管理岗</h1>' +
    '<p>工作地点：上海</p><h2>岗位职责</h2><p>'+DUTIES+'</p>' +
    '<h2>任职要求</h2><p>'+REQUIREMENTS+'</p></body></html>';
  const page=await readPublicEmployerPage(URL_JOB,readOptions(body));
  const fields=extractJobFieldsFromPage(page,{employer:COMPANY});
  assert.ok(fields);
  assert.equal(fields.source_kind,'visible_page');
  assert.equal(fields.title,'区域门店巡店培训管理岗');
  assert.equal(fields.location,'上海');
  assert.match(fields.responsibilities,/常态化巡店整改/);
  assert.match(fields.requirements,/两年以上区域门店管理/);
  const result=verifyOfficialJobEvidence({url:URL_JOB},{
    employer_proof:PROOF,job_page:page,job_fields:fields,
  },{now:NOW.getTime()});
  assert.equal(result.eligible,true);
});

test('automated official verifier pipeline uses its built-in JD parser, not search snippets', async () => {
  const verifier=createTalentOfficialVerifier({
    now:NOW,
    getEmployerProof:async()=>PROOF,
    getOfficialCareersUrl:async()=>'https://www.illustrative.example.cn/careers',
    fetcher:readOptions(html(makeJob())).fetcher,
  });
  const result=await verifier({
    url:URL_JOB,
    title:'首席科学家（不可信搜索标题）',
    snippet:'这个岗位已经拿到Offer',
  });
  assert.equal(result.eligible,true);
  assert.equal(result.job.title,'全国区域督导');
});

test('broken JSON-LD cannot be coerced into JD evidence', async () => {
  const broken='<html><head><script type="application/ld+json">{invalid json}</script></head>' +
    '<body><h1>欢迎来到招聘信息</h1></body></html>';
  const page=await readPublicEmployerPage(URL_JOB,readOptions(broken));
  assert.equal(page.structured_jobs.length,0);
  assert.equal(extractJobFieldsFromPage(page,{employer:COMPANY}),null);
});

test('only a JobPosting @type, not an Organization or generic ItemList, becomes JD evidence', () => {
  const input=html({'@context':'https://schema.org','@graph':[
    {'@type':'Organization',name:COMPANY,url:URL_JOB},
    {'@type':'WebSite',name:'某企业招聘首页',url:URL_JOB},
  ]});
  assert.deepEqual(extractStructuredJobPostings(input,URL_JOB),[]);
});
