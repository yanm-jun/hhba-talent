import test from 'node:test';
import assert from 'node:assert/strict';

import { validateCareerGraph } from '../functions/_lib/talent-search-career-graph.js';
import { runTalentIntelligenceSearch } from '../functions/_lib/talent-search-orchestrator.js';
import { verifyOfficialJobEvidence } from '../functions/_lib/talent-search-official-proof.js';
import { readPublicEmployerPage } from '../functions/_lib/talent-search-page-reader.js';

const NOW = new Date('2026-11-15T03:00:00.000Z');
const employerHost = 'careers.samplecorp.example.cn';
const corporateHost = 'www.samplecorp.example.cn';
const employerJobUrl = `https://${employerHost}/jobs/region-supervisor-2026`;
const employerCareerUrl = `https://${corporateHost}/careers`;
const atsJobUrl = 'https://jobs.ashbyhq.com/samplecorp/ab123456-7ec8-41d5-893d-fc1234567890';
const rogueAtsUrl = 'https://jobs.ashbyhq.com/roguecorp/deadbeef-7ec8-41d5-893d-fc1234567890';
const boardUrl = 'https://www.zhipin.com/job_detail/fake0123.html';

const proof = {
  issuer: 'independent_company_audit',
  record_id: 'verified-source-audit-20261115',
  status: 'verified',
  company: '示例区域运营集团有限公司',
  aliases: ['示例区域运营集团'],
  official_domain: 'samplecorp.example.cn',
  verified_at: '2026-11-14T00:00:00Z',
};

const DUTIES = '负责区域经销商门店运营管理、制定销售目标、开展门店巡检与整改、协同跨职能团队推进销售漏斗优化。';
const REQUIREMENTS = '要求两年以上区域运营相关经验，具备经销商渠道协调、团队培训能力和区域市场运营数据分析能力。';
const DUTIES_ATS = '负责渠道运营及业务合作关系管理、分析渠道营销数据、规划合作商管理流程并推进销售团队日常赋能。';
const REQUIREMENTS_ATS = '任职要求至少两年渠道业务管理经验，具备较强的团队协调能力、市场分析能力与解决复杂问题的能力。';

function jdHtml(title, duties, requirements, company = proof.company) {
  return `<!doctype html><html><body><header>${company}</header>
    <h1>${title}</h1><p>工作地点：上海</p>
    <article><h2>岗位职责</h2><p>${duties}</p>
    <h2>任职要求</h2><p>${requirements}</p>
    <p>岗位性质：全职社会招聘。欢迎具备区域运营经验及跨职能协作经验的人才了解企业工作机会。
    具体岗位职责以这里展示的完整职位说明为准，投递时请核实申请通道是否开放。</p></article>
    </body></html>`;
}

const pages = new Map([
  [employerJobUrl, jdHtml('区域督导', DUTIES, REQUIREMENTS)],
  [atsJobUrl, jdHtml('渠道运营经理', DUTIES_ATS, REQUIREMENTS_ATS)],
  [rogueAtsUrl, jdHtml('渠道运营经理', DUTIES_ATS, REQUIREMENTS_ATS)],
  [employerCareerUrl, `<!doctype html><html><body><h1>示例区域运营集团有限公司官网招聘</h1>
    <p>欢迎加入我们，招聘包括区域运营、渠道管理、团队培训和经销商业务支持岗位。
    更多具体职位请通过企业授权的官方招聘系统查看。</p>
    <a href="https://jobs.ashbyhq.com/samplecorp">前往官方招聘系统</a>
    </body></html>`],
]);

function htmlResponse(html) {
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

test('integrated mocked provider -> safe page reader -> official proof -> multi-wave engine', async () => {
  const resume = '负责经销商渠道运营与市场数据分析。负责区域经销商门店运营管理、制定销售目标、开展门店巡检与整改、协同跨职能团队推进销售漏斗优化。';
  const graph = validateCareerGraph([{
    role: '区域督导',
    intent: 'direct',
    evidence: ['负责区域经销商门店运营管理、制定销售目标、开展门店巡检与整改、协同跨职能团队推进销售漏斗优化。'],
    industries: ['汽车', '零售'],
    search_terms: ['经销商管理', '门店运营'],
  }], resume);
  assert.equal(graph.length, 1);

  const fetches = [];
  const fakeNetwork = async url => {
    fetches.push(url);
    const html = pages.get(url);
    if (!html) throw new Error('unexpected URL ' + url);
    return htmlResponse(html);
  };

  const verify = async hit => {
    // A board link must never be fetched just to discover whether it is safe.
    if (hit.url === boardUrl) {
      return verifyOfficialJobEvidence({ url: hit.url }, {}, { now: NOW.getTime() });
    }

    const isAts = hit.url.includes('ashbyhq.com');
    // Only audited employer-owned hosts or known ATS vendor hosts enter the
    // network allowlist. Never derive allowHosts from an arbitrary search hit.
    const allowedJobHosts = isAts ? ['jobs.ashbyhq.com'] : [employerHost];
    const jobPage = await readPublicEmployerPage(hit.url, {
      allowHosts: allowedJobHosts,
      now: NOW,
      fetcher: fakeNetwork,
    });
    const officialPage = isAts
      ? await readPublicEmployerPage(employerCareerUrl, {
          allowHosts: [corporateHost],
          now: NOW,
          fetcher: fakeNetwork,
        })
      : null;
    const employerHosted = hit.url === employerJobUrl;
    const job_fields = {
      company: proof.company,
      title: employerHosted ? '区域督导' : '渠道运营经理',
      location: '上海',
      responsibilities: employerHosted ? DUTIES : DUTIES_ATS,
      requirements: employerHosted ? REQUIREMENTS : REQUIREMENTS_ATS,
    };

    return verifyOfficialJobEvidence({ url: hit.url }, {
      employer_proof: proof,
      job_page: jobPage,
      job_fields,
      official_careers_page: officialPage,
    }, { now: NOW.getTime() });
  };

  let queries = 0;
  const result = await runTalentIntelligenceSearch({
    careerGraph: graph,
    providers: ['deepseek', 'baidu_agentic'],
    maxWaves: 3,
    queriesPerWave: 2,
    minVerified: 2,
    minRelevant: 2,
    searchFn: async () => {
      queries++;
      const hits = [employerJobUrl, atsJobUrl, boardUrl, rogueAtsUrl];
      return {
        results: hits.map(url => ({ provider: 'mock', url, title: '候选招聘信息', content: '' })),
        diagnostics: {
          provider_count: 2,
          successful_provider_count: 2,
          failed_provider_count: 0,
          skipped_provider_count: 0,
          raw_hit_count: hits.length,
          unique_hit_count: hits.length,
        },
      };
    },
    verifyCandidate: verify,
    scoreCandidate: async () => 0.86,
  });

  assert.equal(queries, 2);
  assert.equal(result.results.length, 2);
  assert.equal(result.terminated, 'QUALITY_TARGET_MET');
  assert.equal(result.quality.high_quality_count, 2);
  assert.deepEqual(new Set(result.results.map(x => x.recruitment_source_status)),
    new Set(['VERIFIED_EMPLOYER_DOMAIN', 'VERIFIED_EMPLOYER_AUTHORIZED_ATS']));
  assert.ok(result.results.every(x => x.field_evidence?.source_page));
  assert.ok(result.results.some(x => x.official_url === atsJobUrl));
  assert.ok(result.results.some(x => x.official_url === employerJobUrl));
  assert.ok(!result.results.some(x => x.official_url === boardUrl || x.official_url === rogueAtsUrl));
  assert.ok(!fetches.includes(boardUrl), 'mass job board must never be fetched');
  assert.ok(!fetches.some(url => url.includes('zhipin')));
});
