import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyOfficialJobEvidence } from '../functions/_lib/talent-search-official-proof.js';

const NOW = Date.parse('2026-11-15T02:00:00.000Z');
const proof = {
  issuer: 'independent_company_audit',
  record_id: 'employer-audit-20261115-001',
  status: 'verified',
  verified_at: '2026-11-14T09:00:00Z',
  company: '示例科技集团有限公司',
  aliases: ['示例科技集团'],
  official_domain: 'samplecorp.example.cn',
};

const title = '区域运营督导';
const duties = '负责区域门店经营管理、定期开展门店巡检与整改、组织销售顾问培训并跟进渠道运营数据。';
const requirements = '要求两年以上区域运营或连锁门店管理经验，具备沟通协调能力、数据分析能力与团队培训经验。';
const pageBody = [
  '示例科技集团有限公司',
  title,
  '工作地点：上海',
  '岗位职责',
  duties,
  '任职要求',
  requirements,
  '薪资：18K-25K',
  '欢迎关注企业招聘信息，并核实职位投递情况。该职位日常工作还涉及区域客户经营指标复盘、协助跨职能团队推进经营改善计划、建立标准化督导工作报告，以及对门店执行流程进行定期抽检和质量评估。投递前请仔细阅读职位要求。',
].join('\n');

const employerUrl = 'https://careers.samplecorp.example.cn/jobs/20261115-region-supervisor';
const atsUrl = 'https://jobs.ashbyhq.com/samplecorp/12abc345-def6-4789-abcd-123456789012';
const unrelatedAts = 'https://jobs.ashbyhq.com/anothercorp/34abc345-def6-4789-abcd-123456789014';

function jobFields(overrides = {}) {
  return {
    company: '示例科技集团有限公司',
    title, location: '上海', salary: '18K-25K',
    responsibilities: duties, requirements,
    ...overrides,
  };
}

function fetched(url, content = pageBody, extras = {}) {
  return {
    url, text: content, status: 200,
    fetched_at: '2026-11-15T01:00:00Z',
    ...extras,
  };
}

function evidence(url = employerUrl, overrides = {}) {
  return {
    employer_proof: proof,
    job_page: fetched(url),
    job_fields: jobFields(),
    ...overrides,
  };
}

const check = (url, proofData) => verifyOfficialJobEvidence(
  { url }, proofData, { now: NOW },
);

test('accepts a fully grounded vacancy on a dynamically attested employer domain', () => {
  const result = check(employerUrl, evidence());
  assert.equal(result.eligible, true);
  assert.equal(result.state, 'VERIFIED_EMPLOYER_DOMAIN');
  assert.equal(result.job.company, proof.company);
  assert.equal(result.job.title, title);
  assert.equal(result.job.location, '上海');
  assert.equal(result.job.salary, '18K-25K');
  assert.equal(result.job.official_url, employerUrl);
  assert.equal(result.job.availability_status, 'UNKNOWN');
  assert.equal(result.field_evidence.requirements, requirements);
  assert.equal(result.source_proof.attestation_id, proof.record_id);
});

test('accepts an ATS job when the attested corporate website links directly to the exact job', () => {
  const result = check(atsUrl, evidence(atsUrl, {
    official_careers_page: fetched(
      'https://careers.samplecorp.example.cn/careers',
      '示例科技集团有限公司官网职业发展页面，查看我们的社会招聘工作机会，欢迎具有区域运营和团队管理经验的求职者加入我们的团队。',
      { links: [{ href: atsUrl, text: '区域运营督导 投递' }] },
    ),
  }));
  assert.equal(result.eligible, true);
  assert.equal(result.state, 'VERIFIED_EMPLOYER_AUTHORIZED_ATS');
  assert.equal(result.source_proof.method, 'official_careers_direct_link');
});

test('accepts an ATS tenant when the employer links to the tenant root and the job stays in that tenant', () => {
  const result = check(atsUrl, evidence(atsUrl, {
    official_careers_page: fetched(
      'https://www.samplecorp.example.cn/careers',
      '示例科技集团有限公司官方招聘与人才发展入口，点击查看企业全部岗位信息；岗位职责、工作地点和任职要求以实际详情为准。',
      { links: ['https://jobs.ashbyhq.com/samplecorp'] },
    ),
  }));
  assert.equal(result.eligible, true);
  assert.equal(result.state, 'VERIFIED_EMPLOYER_AUTHORIZED_ATS');
  assert.equal(result.source_proof.method, 'official_careers_ats_tenant_link');
});

test('does not accept an ATS vendor merely because the hostname looks like an ATS', () => {
  const result = check(atsUrl, evidence(atsUrl));
  assert.equal(result.eligible, false);
  assert.equal(result.state, 'OFFICIAL_SOURCE_UNCONFIRMED');
  assert.equal(result.reason, 'NO_ATTESTED_EMPLOYER_CAREERS_PAGE');
});

test('blocks unrelated ATS tenants even when the employer links to the legitimate tenant', () => {
  const result = check(unrelatedAts, evidence(unrelatedAts, {
    official_careers_page: fetched(
      'https://careers.samplecorp.example.cn/careers',
      '示例科技集团官方招聘与人才发展入口，欢迎查询岗位详情；工作地点、薪资和任职资格以具体岗位介绍为准。',
      { links: ['https://jobs.ashbyhq.com/samplecorp'] },
    ),
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'ATS_LINK_NOT_AUTHORIZED_BY_EMPLOYER');
});

test('a generic ATS homepage link cannot authorize all tenants on a shared vendor host', () => {
  const result = check(atsUrl, evidence(atsUrl, {
    official_careers_page: fetched(
      'https://careers.samplecorp.example.cn/careers',
      '示例科技集团官方招聘与人才发展页面，欢迎查询岗位详情；请根据个人经历选择符合条件的职位并核实申请状态。',
      { links: ['https://jobs.ashbyhq.com/'] },
    ),
  }));
  assert.equal(result.eligible, false);
});

test('no employer attestation means no official recommendation, even with a careers-looking domain', () => {
  const result = check(employerUrl, evidence(employerUrl, {
    employer_proof: null,
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'EMPLOYER_DOMAIN_NOT_ATTESTED');
});

test('a model-provided domain with a simple verified flag does not count as provenance', () => {
  const result = check(employerUrl, evidence(employerUrl, {
    employer_proof: {
      ...proof,
      issuer: 'search_model',
      verified: true,
    },
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'EMPLOYER_DOMAIN_NOT_ATTESTED');
});

test('rejects expired provenance record, expired page fetch and final URL mismatch', () => {
  const oldProof = check(employerUrl, evidence(employerUrl, {
    employer_proof: { ...proof, verified_at: '2025-01-01T00:00:00Z' },
  }));
  const oldPage = check(employerUrl, evidence(employerUrl, {
    job_page: fetched(employerUrl, pageBody, { fetched_at: '2026-10-01T00:00:00Z' }),
  }));
  const redirected = check(employerUrl, evidence(employerUrl, {
    job_page: fetched('https://zhipin.com/job_detail/1.html'),
  }));
  assert.equal(oldProof.eligible, false);
  assert.equal(oldPage.eligible, false);
  assert.equal(redirected.eligible, false);
});

test('third-party job boards are excluded before trying to interpret the job detail', () => {
  const result = check('https://www.zhipin.com/job_detail/abcdef.html', evidence());
  assert.equal(result.eligible, false);
  assert.equal(result.state, 'THIRD_PARTY_BOARD_EXCLUDED');
});

test('cannot use a corporate recruiting homepage as a specific job URL', () => {
  const result = check('https://careers.samplecorp.example.cn/careers', evidence());
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'NOT_A_SPECIFIC_HTTPS_JOB_URL');
});

test('rejects invented job title, salary, duties, or qualifications absent from actual page', () => {
  const titleResult = check(employerUrl, evidence(employerUrl, {
    job_fields: jobFields({ title: '首席人工智能科学家' }),
  }));
  const salaryResult = check(employerUrl, evidence(employerUrl, {
    job_fields: jobFields({ salary: '100K-200K' }),
  }));
  const dutiesResult = check(employerUrl, evidence(employerUrl, {
    job_fields: jobFields({ responsibilities: '在企业负责完全不存在的人工智能大模型训练及全球技术团队管理。' }),
  }));
  const requirementsResult = check(employerUrl, evidence(employerUrl, {
    job_fields: jobFields({ requirements: '要求具备二十年以上的全球团队管理经验，以及独立开发并运营核聚变反应堆的实践经验。' }),
  }));
  for (const result of [titleResult, salaryResult, dutiesResult, requirementsResult]) {
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'JOB_FIELDS_NOT_GROUNDED_IN_PAGE');
  }
});

test('rejects overseas-only job locations even on a trusted employer domain', () => {
  const result = check(employerUrl, evidence(employerUrl, {
    job_page: fetched(employerUrl, pageBody.replace('工作地点：上海', '工作地点：新加坡')),
    job_fields: jobFields({ location: '新加坡' }),
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'JOB_FIELDS_NOT_GROUNDED_IN_PAGE');
});

test('rejects page that explicitly says the vacancy is closed', () => {
  const result = check(employerUrl, evidence(employerUrl, {
    job_page: fetched(employerUrl, '该职位已关闭，不再接受申请。\n' + pageBody),
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.state, 'CLOSED_OR_EXPIRED');
});

test('generic apply button alone cannot mark a job currently hiring', () => {
  const result = check(employerUrl, evidence(employerUrl, {
    job_page: fetched(employerUrl, pageBody + '\n立即申请'),
  }));
  assert.equal(result.eligible, true);
  assert.equal(result.job.availability_status, 'UNKNOWN');
});

test('source proof never uses generic jobs navigation instead of exact ATS authorization', () => {
  const result = check(atsUrl, evidence(atsUrl, {
    official_careers_page: fetched(
      'https://careers.samplecorp.example.cn/careers',
      '这里是示例科技集团官方招聘导航页面，包括职位目录、招聘流程介绍及相关招聘资讯，但没有授权具体的外部托管岗位。',
      { links: [{ href: 'https://www.zhipin.com/' }, { href: 'https://jobs.ashbyhq.com/' }] },
    ),
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'ATS_LINK_NOT_AUTHORIZED_BY_EMPLOYER');
});
