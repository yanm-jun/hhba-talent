import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTalentOfficialVerifier,
} from '../functions/_lib/talent-search-verifier-pipeline.js';

const at = new Date('2026-11-15T04:00:00Z');
const proof = {
  issuer: 'independent_company_audit',
  record_id: 'audited-employer-20261115-a',
  status: 'verified',
  company: '示例集团有限公司',
  official_domain: 'examplecorp.example.cn',
  verified_at: '2026-11-14T00:00:00Z',
};
const firstPartyJob = 'https://careers.examplecorp.example.cn/jobs/region-manager-2026';
const careerUrl = 'https://www.examplecorp.example.cn/careers';
const ats = 'https://jobs.ashbyhq.com/examplecorp/51e6e1b6-a482-4d5d-8497-f126a41b1a89';
const unrelatedAts = 'https://jobs.ashbyhq.com/roguecorp/51e6e1b6-a482-4d5d-8497-f126a41b1a89';
const responsibilities = '负责区域渠道销售业务运营、经销商门店巡检和运营质量整改，并按周复盘销售目标及运营表现。';
const requirements = '具备两年以上区域渠道运营经验，能组织团队培训、开展市场数据分析及与经销商合作伙伴沟通。';
const jobText = [
  '示例集团有限公司',
  '区域运营经理',
  '工作地点：上海',
  '岗位职责：', responsibilities,
  '任职要求：', requirements,
  '这是面向国内区域运营岗位的招聘详情，工作涉及市场指标管理、跨团队协调、经营数据跟踪及门店规范化运营。',
].join('\n');
const page = (url, text, links = []) => ({
  url, status: 200, fetched_at: at.toISOString(), text, links,
});
const fields = () => ({
  company: proof.company,
  title: '区域运营经理',
  location: '上海',
  responsibilities,
  requirements,
});

function factory(overrides = {}) {
  const pageCalls = [];
  const verifier = createTalentOfficialVerifier({
    now: at,
    getEmployerProof: async () => proof,
    getOfficialCareersUrl: async () => careerUrl,
    extractJobFields: async () => fields(),
    reader: async (url, opts) => {
      pageCalls.push({url,opts});
      if (url === careerUrl) return page(careerUrl, [
        '示例集团有限公司官方网站',
        '这是面向社会的官方招聘入口，岗位信息和渠道运营职位均通过企业授权招聘系统展示。',
      ].join('，'), [{href: 'https://jobs.ashbyhq.com/examplecorp'}]);
      return page(url, jobText);
    },
    ...overrides,
  });
  return { verifier, pageCalls };
}

test('first-party job reads one attested page and verifies its independently sourced JD facts', async () => {
  const { verifier, pageCalls } = factory();
  const result = await verifier({ url: firstPartyJob }, { role: '区域运营经理', intent: 'direct' });
  assert.equal(result.eligible, true);
  assert.equal(result.state, 'VERIFIED_EMPLOYER_DOMAIN');
  assert.equal(pageCalls.length, 1);
  assert.deepEqual(pageCalls[0].opts.allowHosts, ['careers.examplecorp.example.cn']);
});

test('ATS job reads the audited company careers page before reading the ATS job', async () => {
  const { verifier, pageCalls } = factory();
  const result = await verifier({ url: ats }, { role: '渠道运营经理', intent: 'adjacent' });
  assert.equal(result.eligible, true);
  assert.equal(result.state, 'VERIFIED_EMPLOYER_AUTHORIZED_ATS');
  assert.deepEqual(pageCalls.map(x => x.url), [careerUrl, ats]);
  assert.deepEqual(pageCalls[1].opts.allowHosts, ['jobs.ashbyhq.com']);
});

test('an ATS job in another vendor tenant is rejected before its URL is fetched', async () => {
  const { verifier, pageCalls } = factory();
  const result = await verifier({ url: unrelatedAts });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'ATS_TENANT_NOT_AUTHORIZED');
  assert.deepEqual(pageCalls.map(x => x.url), [careerUrl]);
});

test('third-party job boards cannot trigger even the employer registry or page fetch', async () => {
  let lookup = 0, read = 0;
  const { verifier } = factory({
    getEmployerProof: async () => { lookup++; return proof; },
    reader: async () => { read++; return page(firstPartyJob, jobText); },
  });
  const result = await verifier({ url: 'https://www.zhipin.com/job_detail/demo001.html' });
  assert.equal(result.eligible, false);
  assert.equal(result.state, 'THIRD_PARTY_BOARD_EXCLUDED');
  assert.equal(lookup, 0);
  assert.equal(read, 0);
});

test('an unknown company does not become official merely because the site says careers', async () => {
  let fetched = 0;
  const { verifier } = factory({
    getEmployerProof: async () => null,
    reader: async () => { fetched++; throw Error('unexpected fetch'); },
  });
  const result = await verifier({ url: firstPartyJob });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'EMPLOYER_DOMAIN_NOT_ATTESTED');
  assert.equal(fetched, 0);
});

test('model-invented job fields are rejected after real page extraction', async () => {
  const { verifier } = factory({
    extractJobFields: async () => ({
      ...fields(),
      title: '首席量子计算科学家',
    }),
  });
  const result = await verifier({ url: firstPartyJob });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'JOB_FIELDS_NOT_GROUNDED_IN_PAGE');
});

test('non-corporate careers page cannot authorize an ATS even with the right link', async () => {
  let fetched = 0;
  const { verifier } = factory({
    getOfficialCareersUrl: async () => 'https://attacker.example/careers',
    reader: async () => { fetched++; throw Error('unexpected'); },
  });
  const result = await verifier({ url: ats });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'CAREERS_SITE_NOT_EMPLOYER_CONTROLLED');
  assert.equal(fetched, 0);
});

test('missing required server dependencies fails before accepting a search result', () => {
  assert.throws(() => createTalentOfficialVerifier({}), /AUDITED_EMPLOYER_LOOKUP_REQUIRED/);
  assert.throws(
    () => createTalentOfficialVerifier({ getEmployerProof: async () => proof }),
    /OFFICIAL_CAREERS_LOCATOR_REQUIRED/,
  );
  assert.throws(
    () => createTalentOfficialVerifier({
      getEmployerProof: async () => proof,
      extractJobFields: async () => fields(),
    }),
    /OFFICIAL_CAREERS_LOCATOR_REQUIRED/,
  );
});
