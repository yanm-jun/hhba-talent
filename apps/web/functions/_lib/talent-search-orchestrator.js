/**
 * HHBA Talent Intelligence Engine — bounded multi-wave search planner (POC).
 *
 * This module does not call models or parse resumes. It takes a previously
 * evidence-validated career graph; only server-owned verifier callbacks may
 * promote external search hits to verified jobs.
 *
 * Search candidates, page snippets, and model assertions are NEVER treated as
 * official vacancies. All early output is internal diagnostic data.
 */

import { buildTalentSearchQueryPlan } from './talent-search-career-graph.js';
import { searchAcrossProviders } from './talent-search-providers.js';

const VALID_STATES = new Set([
  'VERIFIED_EMPLOYER_DOMAIN',
  'VERIFIED_EMPLOYER_AUTHORIZED_ATS',
]);
const INTENTS = ['direct', 'adjacent', 'transferable'];

function positiveInt(value, fallback, max) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

function compact(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .toLocaleLowerCase();
}

function jobKey(job) {
  const employer = compact(job.company || job.employer);
  const title = compact(job.title);
  const location = compact(job.location);
  return [employer, title, location].join('|');
}

function validQuality(value) {
  const candidate = typeof value === 'number' ? value :
    value && typeof value === 'object' ? value.relevance : NaN;
  return Number.isFinite(candidate) && candidate >= 0 && candidate <= 1
    ? candidate
    : null;
}

function summarize(jobs, graph, threshold) {
  const counts = Object.fromEntries(INTENTS.map(x => [x, 0]));
  const strong = Object.fromEntries(INTENTS.map(x => [x, 0]));
  let evaluated = 0;
  let highQuality = 0;
  for (const item of jobs) {
    const intent = item.intent;
    if (Object.hasOwn(counts, intent)) counts[intent]++;
    if (item.relevance !== null) {
      evaluated++;
      if (item.relevance >= threshold) {
        highQuality++;
        if (Object.hasOwn(strong, intent)) strong[intent]++;
      }
    }
  }
  const targets = new Set(graph.map(item => item.intent));
  return {
    verified_count: jobs.length,
    evaluated_count: evaluated,
    high_quality_count: highQuality,
    by_intent: counts,
    high_quality_by_intent: strong,
    requested_intents: [...targets],
    missing_intents: [...targets].filter(intent => strong[intent] === 0),
  };
}

function scheduleWave(allQueries, executed, roleHits, summary, cap) {
  const remaining = allQueries.filter(item => !executed.has(item.id));
  if (!remaining.length) return [];

  const missing = new Set(summary.missing_intents);
  const selected = [];
  const usedRoles = new Set();
  const sorted = remaining.sort((a, b) => {
    const aMissing = missing.has(a.intent) ? 1 : 0;
    const bMissing = missing.has(b.intent) ? 1 : 0;
    const aStrong = summary.high_quality_by_intent[a.intent] || 0;
    const bStrong = summary.high_quality_by_intent[b.intent] || 0;
    const aHits = roleHits.get(a.role) || 0;
    const bHits = roleHits.get(b.role) || 0;
    return bMissing - aMissing || aStrong - bStrong || aHits - bHits ||
      b.priority - a.priority || a.id.localeCompare(b.id);
  });

  // Guarantee at least one query per outstanding intent when possible.
  for (const intent of INTENTS) {
    if (selected.length >= cap) break;
    const candidate = sorted.find(row => row.intent === intent && !selected.includes(row));
    if (candidate) {
      selected.push(candidate);
      usedRoles.add(candidate.role);
    }
  }

  for (const item of sorted) {
    if (selected.length >= cap) break;
    if (selected.includes(item) || usedRoles.has(item.role)) continue;
    selected.push(item);
    usedRoles.add(item.role);
  }

  for (const item of sorted) {
    if (selected.length >= cap) break;
    if (!selected.includes(item)) selected.push(item);
  }
  return selected;
}

/**
 * @param {object} input
 * @param {Array} input.careerGraph Evidence-validated career directions.
 * @param {object} input.providerConfigs Server-side API secrets/configs, never browser data.
 * @param {Function} input.verifyCandidate Server-owned detail read + official-source proof.
 * @param {Function} input.scoreCandidate Optional evidence-backed fit evaluator, [0,1].
 * @param {Function} input.searchFn Injected search adapter for tests (defaults to multi-provider).
 * @param {Function} input.onProgress Optional diagnostic event sink.
 */
export async function runTalentIntelligenceSearch(input = {}) {
  const graph = Array.isArray(input.careerGraph)
    ? input.careerGraph.filter(x => x && INTENTS.includes(x.intent) && x.evidence_count > 0)
    : [];

  if (!graph.length) throw new Error('CAREER_GRAPH_NOT_EVIDENCE_VALIDATED');
  if (typeof input.verifyCandidate !== 'function') {
    throw new Error('OFFICIAL_VERIFIER_REQUIRED');
  }

  const maxWaves = positiveInt(input.maxWaves, 3, 6);
  const queriesPerWave = positiveInt(input.queriesPerWave, 6, 12);
  const maxVerify = positiveInt(input.maxVerify, 100, 300);
  const minVerified = positiveInt(input.minVerified, 10, 50);
  const minRelevant = positiveInt(input.minRelevant, 8, 50);
  const relevanceThreshold = Number.isFinite(input.relevanceThreshold)
    ? Math.max(0.5, Math.min(1, input.relevanceThreshold))
    : 0.75;

  const allQueries = buildTalentSearchQueryPlan(graph, {
    maxQueries: Math.min(72, maxWaves * queriesPerWave + 12),
  });
  if (!allQueries.length) throw new Error('CAREER_QUERY_PLAN_EMPTY');

  const searchFn = input.searchFn || searchAcrossProviders;
  const providerConfigs = input.providerConfigs || {};
  const requestedProviders = Array.isArray(input.providers)
    ? input.providers.slice(0, 7)
    : Object.keys(providerConfigs);
  const onProgress = typeof input.onProgress === 'function' ? input.onProgress : () => {};
  const signal = input.signal;
  const emitted = (stage, extra = {}) => onProgress({
    stage,
    timestamp: new Date().toISOString(),
    ...extra,
  });

  const usedQueryIds = new Set();
  const inspectedUrls = new Set();
  const roleHits = new Map();
  const byJobKey = new Map();
  const waves = [];
  const errors = [];
  const counters = {
    search_calls: 0,
    successful_provider_calls: 0,
    failed_provider_calls: 0,
    skipped_provider_calls: 0,
    raw_hits: 0,
    unique_search_hits: 0,
    verification_attempts: 0,
    verified_jobs: 0,
    rejected_jobs: 0,
    verification_errors: 0,
  };
  const emitQuality = () => summarize([...byJobKey.values()], graph, relevanceThreshold);
  let terminated = 'MAX_WAVES_REACHED';

  emitted('planning', { planned_queries: allQueries.length, directions: graph.length });

  for (let waveNo = 1; waveNo <= maxWaves; waveNo++) {
    if (signal?.aborted) {
      terminated = 'CANCELLED';
      break;
    }

    const summaryBefore = emitQuality();
    const batch = scheduleWave(
      allQueries, usedQueryIds, roleHits, summaryBefore, queriesPerWave,
    );
    if (!batch.length) {
      terminated = 'NO_MORE_UNTRIED_QUERIES';
      break;
    }

    for (const query of batch) usedQueryIds.add(query.id);
    const trace = {
      wave: waveNo,
      queries: batch.map(({ id, query, intent, role }) => ({ id, query, intent, role })),
      hits_discovered: 0,
      verified_jobs_added: 0,
      provider_errors: 0,
      missing_intents_before: summaryBefore.missing_intents,
    };

    emitted('searching', { wave: waveNo, queries: batch.length });
    const outcomes = await Promise.all(batch.map(async plan => {
      try {
        const result = await searchFn(plan.query, providerConfigs, {
          providers: requestedProviders,
          signal,
        });
        return { plan, result, status: 'fulfilled' };
      } catch (error) {
        return {
          plan, status: 'rejected',
          error_code: typeof error?.code === 'string' ? error.code : 'SEARCH_FAILED',
        };
      }
    }));

    const toVerify = [];
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        trace.provider_errors++;
        errors.push({ wave: waveNo, query_id: outcome.plan.id, error_code: outcome.error_code });
        continue;
      }
      const result = outcome.result;
      counters.search_calls += (result?.diagnostics?.provider_count || 0);
      counters.successful_provider_calls += (result?.diagnostics?.successful_provider_count || 0);
      counters.failed_provider_calls += (result?.diagnostics?.failed_provider_count || 0);
      counters.skipped_provider_calls += (result?.diagnostics?.skipped_provider_count || 0);
      counters.raw_hits += result?.diagnostics?.raw_hit_count || 0;
      trace.provider_errors += result?.diagnostics?.failed_provider_count || 0;

      for (const hit of result?.results || []) {
        if (!hit || typeof hit.url !== 'string' || inspectedUrls.has(hit.url)) continue;
        inspectedUrls.add(hit.url);
        counters.unique_search_hits++;
        toVerify.push({ hit, plan: outcome.plan });
      }
    }

    trace.hits_discovered = toVerify.length;
    emitted('verifying', { wave: waveNo, new_candidates: toVerify.length });

    // Keep concurrent verification bounded; future implementation may use a
    // durable queue, but this POC never launches hundreds of browser sessions.
    const verificationConcurrency = positiveInt(input.verifyConcurrency, 5, 12);
    for (let i = 0; i < toVerify.length; i += verificationConcurrency) {
      if (signal?.aborted || counters.verification_attempts >= maxVerify) break;
      const chunk = toVerify.slice(i, Math.min(i + verificationConcurrency, i +
        Math.max(0, maxVerify - counters.verification_attempts)));
      counters.verification_attempts += chunk.length;
      const verified = await Promise.allSettled(chunk.map(async item => {
        const result = await input.verifyCandidate(item.hit, item.plan, { signal });
        if (!result?.eligible || !VALID_STATES.has(result.state) || !result.job) {
          return { ...item, status: 'rejected', reason: result?.reason || 'OFFICIAL_PROOF_FAILED' };
        }

        const job = result.job;
        if (!job.company || !job.title || !job.location || !job.official_url) {
          return { ...item, status: 'rejected', reason: 'INCOMPLETE_OFFICIAL_JOB' };
        }
        if (!job.requirements || !job.responsibilities) {
          return { ...item, status: 'rejected', reason: 'MISSING_JOB_DETAIL_EVIDENCE' };
        }

        let relevance = null;
        if (typeof input.scoreCandidate === 'function') {
          try {
            relevance = validQuality(await input.scoreCandidate(job, item.plan, result));
          } catch {
            relevance = null;
          }
        }
        return { ...item, status: 'verified', result, relevance };
      }));

      for (let n = 0; n < verified.length; n++) {
        const entry = verified[n];
        if (entry.status === 'rejected') {
          counters.verification_errors++;
          continue;
        }
        const value = entry.value;
        if (value.status !== 'verified') {
          counters.rejected_jobs++;
          continue;
        }
        const identity = jobKey(value.result.job);
        if (!identity || identity === '||') {
          counters.rejected_jobs++;
          continue;
        }
        const next = {
          ...value.result.job,
          relevance: value.relevance,
          intent: value.plan.intent,
          search_role: value.plan.role,
          source_proof: value.result.source_proof,
          field_evidence: value.result.field_evidence,
        };
        const existing = byJobKey.get(identity);
        if (!existing || (next.relevance ?? -1) > (existing.relevance ?? -1)) {
          byJobKey.set(identity, next);
          if (!existing) {
            trace.verified_jobs_added++;
            roleHits.set(value.plan.role, (roleHits.get(value.plan.role) || 0) + 1);
          }
        }
      }
    }

    const quality = emitQuality();
    counters.verified_jobs = quality.verified_count;
    trace.quality = quality;
    waves.push(trace);
    emitted('wave_complete', { wave: waveNo, quality });

    // No premature halt on a full batch of search links: count only jobs
    // with independently checked employer provenance and grounded JD fields.
    const sufficient = quality.verified_count >= minVerified &&
      quality.high_quality_count >= minRelevant;
    const coverage = quality.missing_intents.length === 0 ||
      quality.requested_intents.length <= 1;
    if (sufficient && coverage) {
      terminated = 'QUALITY_TARGET_MET';
      break;
    }
    if (counters.verification_attempts >= maxVerify) {
      terminated = 'VERIFICATION_BUDGET_REACHED';
      break;
    }
  }

  if (signal?.aborted) terminated = 'CANCELLED';

  const results = [...byJobKey.values()]
    .sort((a, b) => (b.relevance ?? -1) - (a.relevance ?? -1) ||
      String(a.company).localeCompare(String(b.company), 'zh-CN'));

  const quality = emitQuality();
  emitted('complete', { quality, terminated });
  return {
    version: 'HHBA_TALENT_INTELLIGENCE_POC_V1',
    scope: 'CN_MAINLAND_ONLY',
    status: terminated === 'CANCELLED' ? 'cancelled' : 'completed',
    terminated,
    results,
    quality,
    counters,
    waves,
    errors,
    disclaimer: '仅输出经过独立官方来源及岗位详情核验的候选岗位；尚未评分的岗位不代表推荐质量或录用概率。',
  };
}
