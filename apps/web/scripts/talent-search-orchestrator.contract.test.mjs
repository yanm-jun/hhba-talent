import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runTalentIntelligenceSearch,
} from '../functions/_lib/talent-search-orchestrator.js';

const roles = [
  { role: '区域督导', intent: 'direct', evidence_count: 2, industries: ['零售'], search_terms: ['门店巡店'], capabilities: [] },
  { role: '连锁门店运营经理', intent: 'adjacent', evidence_count: 2, industries: ['零售'], search_terms: ['门店运营'], capabilities: [] },
  { role: '消费品渠道运营', intent: 'transferable', evidence_count: 2, industries: ['消费品'], search_terms: ['渠道运营'], capabilities: [] },
];

function searchResult(plan, wave, overrides = {}) {
  const id = encodeURIComponent(plan.query);
  const url = `https://careers.samplecorp.example.cn/jobs/official-${wave}-${id}`;
  const row = { provider: 'deepseek', title: '区域运营岗位', url, snippet: '模拟搜索结果', content: '' };
  return {
    query: plan.query,
    results: [row],
    diagnostics: {
      provider_count: 2,
      successful_provider_count: 1,
      failed_provider_count: 1,
      skipped_provider_count: 0,
      raw_hit_count: 1,
      unique_hit_count: 1,
    },
    ...overrides,
  };
}

function signedVerifier(hit, plan) {
  const marker = new URL(hit.url).pathname.split('/').pop();
  const job = {
    company: '测试集团' + marker,
    title: '区域运营经理',
    location: '上海',
    salary: null,
    requirements: '任职要求：具备区域业务运营和跨团队沟通能力，有相关工作经验。',
    responsibilities: '岗位职责：制定区域运营计划、开展经营数据分析并推进门店整改。',
    official_url: hit.url,
    availability_status: 'UNKNOWN',
  };
  return {
    eligible: true,
    state: 'VERIFIED_EMPLOYER_DOMAIN',
    source_proof: { method: 'attested_employer_domain', attestation_id: 'test-audit-001' },
    field_evidence: { title: job.title, source_page: job.official_url },
    job,
  };
}

test('requires evidence-grounded role directions and a genuine verification callback', async () => {
  await assert.rejects(
    runTalentIntelligenceSearch({ careerGraph: [], verifyCandidate: signedVerifier }),
    /CAREER_GRAPH_NOT_EVIDENCE_VALIDATED/,
  );
  await assert.rejects(
    runTalentIntelligenceSearch({ careerGraph: roles }),
    /OFFICIAL_VERIFIER_REQUIRED/,
  );
});

test('digs into subsequent waves when initial results are numerous but low quality', async () => {
  let callCount = 0;
  const progress = [];
  const wavesSeen = [];
  const run = await runTalentIntelligenceSearch({
    careerGraph: roles,
    providerConfigs: { deepseek: { apiKey: 'synthetic-secret-not-real' } },
    providers: ['deepseek'],
    maxWaves: 3,
    queriesPerWave: 3,
    minVerified: 3,
    minRelevant: 3,
    relevanceThreshold: 0.75,
    searchFn: async query => {
      callCount++;
      const wave = callCount <= 3 ? 1 : callCount <= 6 ? 2 : 3;
      wavesSeen.push(wave);
      return searchResult({ query }, wave);
    },
    verifyCandidate: signedVerifier,
    scoreCandidate: async (_, plan) => wavesSeen.length > 3 ? 0.92 : 0.25,
    onProgress: event => progress.push(event),
  });

  assert.equal(run.terminated, 'QUALITY_TARGET_MET');
  assert.equal(run.waves.length, 2, 'low quality first-wave links require a second search wave');
  assert.equal(run.quality.high_quality_count, 3);
  assert.equal(run.quality.missing_intents.length, 0);
  assert.ok(run.counters.verification_attempts >= 6);
  assert.ok(run.results.every(j => j.source_proof?.attestation_id === 'test-audit-001'));
  assert.ok(progress.some(x => x.stage === 'verifying'));
  assert.ok(progress.some(x => x.stage === 'wave_complete'));
  assert.ok(progress.some(x => x.stage === 'complete'));
});

test('unverified search hits never count towards the ten-job goal', async () => {
  let calls = 0;
  const out = await runTalentIntelligenceSearch({
    careerGraph: roles,
    providers: ['deepseek'],
    maxWaves: 3,
    queriesPerWave: 3,
    minVerified: 10,
    minRelevant: 8,
    searchFn: async query => {
      calls++;
      return {
        ...searchResult({ query }, calls),
        results: Array.from({length: 10}, (_, i) => ({
          provider: 'deepseek',
          url: `https://www.zhipin.com/job_detail/${calls}-${i}.html`,
          title: '不可信职位',
        })),
      };
    },
    verifyCandidate: async () => ({
      eligible: false,
      state: 'THIRD_PARTY_BOARD_EXCLUDED',
      reason: 'JOB_BOARD_SOURCE',
    }),
  });

  assert.equal(out.results.length, 0);
  assert.equal(out.quality.high_quality_count, 0);
  assert.ok(out.waves.length >= 2);
  assert.ok(out.counters.rejected_jobs > 0);
  assert.notEqual(out.terminated, 'QUALITY_TARGET_MET');
});

test('without a real quality evaluator, official jobs are not mislabeled as good matches', async () => {
  const out = await runTalentIntelligenceSearch({
    careerGraph: roles.slice(0, 1),
    maxWaves: 2,
    queriesPerWave: 1,
    minVerified: 1,
    minRelevant: 1,
    searchFn: async (query, _configs, _opts) => searchResult({ query }, 1),
    verifyCandidate: signedVerifier,
  });
  assert.equal(out.quality.evaluated_count, 0);
  assert.equal(out.quality.high_quality_count, 0);
  assert.ok(out.results.every(row => row.relevance === null));
  assert.notEqual(out.terminated, 'QUALITY_TARGET_MET');
});

test('provider query exceptions are isolated and do not destroy good results', async () => {
  let calls = 0;
  const out = await runTalentIntelligenceSearch({
    careerGraph: roles,
    maxWaves: 1,
    queriesPerWave: 3,
    minVerified: 2,
    minRelevant: 2,
    searchFn: async query => {
      calls++;
      if (calls === 2) {
        const error = new Error('upstream network exception');
        error.code = 'PROVIDER_UNAVAILABLE';
        throw error;
      }
      return searchResult({ query }, calls);
    },
    verifyCandidate: signedVerifier,
    scoreCandidate: async () => 0.9,
  });

  assert.equal(out.results.length, 2);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].error_code, 'PROVIDER_UNAVAILABLE');
  assert.equal(out.counters.verified_jobs, 2);
});

test('deduplicates the same employer-role-location even across distinct verified URLs', async () => {
  const out = await runTalentIntelligenceSearch({
    careerGraph: roles,
    maxWaves: 2,
    queriesPerWave: 3,
    minVerified: 1,
    minRelevant: 1,
    searchFn: async query => searchResult({ query }, 1),
    verifyCandidate: async (hit, plan) => {
      const result = signedVerifier(hit, plan);
      result.job.company = '同一集团';
      return result;
    },
    scoreCandidate: async () => 0.9,
  });
  assert.equal(out.results.length, 1);
});

test('search cancellation fails closed and starts no request', async () => {
  const controller = new AbortController();
  controller.abort();
  let called = 0;
  const out = await runTalentIntelligenceSearch({
    careerGraph: roles,
    signal: controller.signal,
    searchFn: async () => { called++; throw Error('unexpected'); },
    verifyCandidate: signedVerifier,
  });
  assert.equal(called, 0);
  assert.equal(out.status, 'cancelled');
  assert.equal(out.terminated, 'CANCELLED');
  assert.equal(out.results.length, 0);
});

test('verification budget stops search waves even when the source has many URLs', async () => {
  let calls = 0;
  const out = await runTalentIntelligenceSearch({
    careerGraph: roles,
    maxWaves: 6,
    queriesPerWave: 3,
    maxVerify: 3,
    minVerified: 10,
    minRelevant: 10,
    searchFn: async query => {
      calls++;
      return searchResult({ query }, calls);
    },
    verifyCandidate: async () => ({ eligible: false, state: 'OFFICIAL_SOURCE_UNCONFIRMED', reason: 'NOT_ATTESTED' }),
  });
  assert.equal(out.counters.verification_attempts, 3);
  assert.equal(out.terminated, 'VERIFICATION_BUDGET_REACHED');
  assert.equal(out.results.length, 0);
});

test('untrusted verifier output is excluded even with a plausible job object', async () => {
  const out = await runTalentIntelligenceSearch({
    careerGraph: roles.slice(0, 1),
    maxWaves: 1,
    queriesPerWave: 1,
    minVerified: 1,
    minRelevant: 1,
    searchFn: async query => searchResult({ query }, 1),
    verifyCandidate: async (hit, plan) => ({
      ...signedVerifier(hit, plan),
      state: 'OFFICIAL_SOURCE_UNCONFIRMED',
    }),
    scoreCandidate: async () => 1,
  });
  assert.equal(out.results.length, 0);
  assert.equal(out.quality.verified_count, 0);
});
