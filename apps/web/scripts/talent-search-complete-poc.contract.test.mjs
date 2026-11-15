import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCareerGraph} from '../functions/_lib/talent-search-career-graph.js';
import {createD1TalentEmployerResolver} from '../functions/_lib/talent-search-employer-store.js';
import {createTalentOfficialVerifier} from '../functions/_lib/talent-search-verifier-pipeline.js';
import {createEvidenceFitScorer} from '../functions/_lib/talent-search-evidence-fit.js';
import {runTalentIntelligenceSearch} from '../functions/_lib/talent-search-orchestrator.js';

let DatabaseSync;
try { ({DatabaseSync}=await import('node:sqlite')); } catch {}

const now=new Date('2026-11-15T06:00:00Z');
const company='示例连锁区域服务集团有限公司',host='example-retail.cn';
const officialJob='https://careers.example-retail.cn/jobs/supervisor-2026';
const atsJob='https://jobs.ashbyhq.com/example-retail/5627108d-665c-4711-a210-8e06dcd80d11';
const careers='https://www.example-retail.cn/careers';
const board='https://www.zhipin.com/job_detail/12345678.html';

const resumeLines=[
  '负责六家连锁门店的月度经营管理与销售目标复盘工作。',
  '参与销售顾问培训，组织门店巡检整改与标准化流程优化。',
  '利用客户线索转化数据提升经销商渠道经营效率。',
];
const resume=resumeLines.join('\n');
const duties=[
  '负责连锁门店经营管理以及区域销售目标制定与周期复盘。',
  '组织区域门店巡检整改，推进销售人员培训和运营流程优化。',
  '结合客户线索和业务转化数据提升渠道经营管理效率。',
];
const requirements='本科及以上学历。具备至少两年区域门店经营管理经验。能够开展业务分析与跨团队沟通合作。';

function posting(url,title) {
  return {
    '@context':'https://schema.org','@type':'JobPosting',title,
    url,hiringOrganization:{'@type':'Organization',name:company},
    jobLocation:{'@type':'Place',address:{
      '@type':'PostalAddress',addressLocality:'上海',addressCountry:'CN',
    }},
    responsibilities:duties.join('\n'),
    qualifications:requirements,
    datePosted:'2026-11-12',
    validThrough:'2026-12-15',
  };
}
const asHtml=node=>'<html><head><script type="application/ld+json">'+JSON.stringify(node)+'</script></head><body><h1>岗位详情</h1><p>企业招聘系统</p></body></html>';
const contents=new Map([
  [officialJob,asHtml(posting(officialJob,'区域督导'))],
  [atsJob,asHtml(posting(atsJob,'渠道运营经理'))],
  [careers,'<html><body><h1>示例连锁区域服务集团有限公司 官方招聘</h1><p>欢迎加入企业，更多职位请访问企业授权的招聘系统并阅读具体岗位条件。</p><a href="https://jobs.ashbyhq.com/example-retail">官方ATS招聘平台</a></body></html>'],
]);

test('complete synthetic proof-of-concept: CV -> career query -> web -> D1 proof -> JSON-LD -> JD -> fit', {skip:!DatabaseSync},async()=>{
  const sqlite=new DatabaseSync(':memory:');
  try {
    sqlite.exec(await readFile(new URL('../d1/0020_talent_official_source_proofs.sql',import.meta.url),'utf8'));
    const id='independent-audit-20261115-0001';
    sqlite.prepare('INSERT INTO hhba_talent_employer_proofs_v1 (id,company,official_domain,aliases_json,careers_url,issuer,status,evidence_url,evidence_quote,reviewer_id,verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      id,company,host,'[]',careers,'independent_company_audit','verified',
      'https://www.example-retail.cn/about',
      '示例连锁区域服务集团有限公司的独立官方网站与招聘授权关系经复核。',
      'reviewer-test-1','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'
    );
    sqlite.prepare('INSERT INTO hhba_talent_ats_tenants_v1 (id,employer_proof_id,ats_host,tenant_prefix,authorized_careers_url,official_link_url,status,reviewer_id,verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'ats-audit-20261115-0001',id,'jobs.ashbyhq.com','/example-retail',careers,
      'https://jobs.ashbyhq.com/example-retail','verified',
      'reviewer-test-2','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'
    );
    const db={prepare(sql){const stmt=sqlite.prepare(sql);return{
      bind(...args){return{first:async()=>stmt.get(...args)||null};},
    };}};
    const provenance=createD1TalentEmployerResolver(db,{now});
    const visited=[];
    const verifier=createTalentOfficialVerifier({
      ...provenance,now,
      fetcher:async url=>{
        visited.push(url);
        if(!contents.has(url))throw Error('Unapproved fixture URL: '+url);
        return new Response(contents.get(url),{status:200,headers:{'Content-Type':'text/html'}});
      },
    });
    const graph=validateCareerGraph([{
      role:'区域督导',intent:'direct',
      evidence:[resumeLines[0],resumeLines[1]],
      industries:['零售'],search_terms:['门店巡检', '经销商渠道'],
    }],resume);
    assert.equal(graph.length,1);
    const scorer=createEvidenceFitScorer({
      resumeText:resume,
      profile:{education:'BACHELOR',experience_years:3,skills:[]},
      evaluatePairs:async()=>({pairs:[
        {alignment:'direct',resume_quote:resumeLines[0],job_quote:duties[0],
         explanation:'实际门店经营和目标复盘经验与官方岗位职责之间存在直接业务对应关系。'},
        {alignment:'direct',resume_quote:resumeLines[1],job_quote:duties[1],
         explanation:'销售顾问培训、巡店整改与岗位的区域督导要求直接相关。'},
      ]}),
    });
    const result=await runTalentIntelligenceSearch({
      careerGraph:graph,providers:['deepseek'],maxWaves:1,queriesPerWave:2,
      minVerified:2,minRelevant:2,
      searchFn:async()=>({
        results:[officialJob,atsJob,board].map(url=>({provider:'mock',url,title:'搜索发现候选'})),
        diagnostics:{provider_count:1,successful_provider_count:1,raw_hit_count:3},
      }),
      verifyCandidate:verifier,
      scoreCandidate:scorer,
    });

    assert.equal(result.results.length,2);
    assert.equal(result.terminated,'QUALITY_TARGET_MET');
    assert.ok(result.results.every(x=>x.relevance>=0.75));
    assert.ok(result.results.every(x=>x.matched_evidence.length===2));
    assert.ok(result.results.every(x=>x.source_proof?.attestation_id===id));
    assert.deepEqual(new Set(result.results.map(x=>x.official_url)),new Set([officialJob,atsJob]));
    assert.ok(!visited.includes(board),'third-party job boards must not be fetched');
    assert.ok(visited.includes(careers),'ATS must have independently authenticated careers link');
    assert.ok(visited.includes(officialJob)&&visited.includes(atsJob));
  }finally{sqlite.close();}
});
