/**
 * HHBA Talent Intelligence — trusted official-job verification pipeline.
 *
 * This module connects public search hints to real employer evidence. It is
 * server-only; none of its injected callbacks can be supplied by an end user.
 *
 * Required dependencies:
 *   getEmployerProof: resolve or dynamically audit a company's official domain,
 *     returning an attestation from the trusted HHBA audit store.
 *   extractJobFields: parse only the fetched JD page, never untrusted search
 *     snippets as final facts. Output must pass exact-page evidence validation.
 *   getOfficialCareersUrl: locate an employer-controlled careers page for ATS
 *     authorization (the URL is checked against the attested corporate domain).
 *
 * The POC uses a static HTML reader; dynamic/JS pages will need a separate
 * fallback (e.g., browser rendering) with the same trust and redirect gates.
 */

import { recruitmentSourceKind } from './match-employer-source.js';
import {
  isAuditedEmployerProof,
  authorizedEmployerAtsLink,
  verifyOfficialJobEvidence,
} from './talent-search-official-proof.js';
import {
  readPublicEmployerPage,
  validatedPublicPageUrl,
} from './talent-search-page-reader.js';

function hostUnder(host, root) {
  const name = String(host || '').toLowerCase();
  const domain = String(root || '').toLowerCase();
  return !!name && !!domain && (name === domain || name.endsWith('.' + domain));
}

function fail(state, reason) {
  return { eligible: false, state, reason, job: null, source_proof: null, field_evidence: null };
}

function tryUrl(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 4096) return null;
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    return u;
  } catch {
    return null;
  }
}

export function createTalentOfficialVerifier(dependencies = {}) {
  const getEmployerProof = dependencies.getEmployerProof;
  const extractJobFields = dependencies.extractJobFields;
  const getOfficialCareersUrl = dependencies.getOfficialCareersUrl;
  const reader = dependencies.reader || readPublicEmployerPage;
  const fetcher = dependencies.fetcher;
  const now = dependencies.now;

  if (typeof getEmployerProof !== 'function') throw new Error('AUDITED_EMPLOYER_LOOKUP_REQUIRED');
  if (typeof extractJobFields !== 'function') throw new Error('JOB_DETAIL_EXTRACTOR_REQUIRED');
  if (typeof getOfficialCareersUrl !== 'function') throw new Error('OFFICIAL_CAREERS_LOCATOR_REQUIRED');

  return async (hit, plan = {}, context = {}) => {
    const jobUrl = tryUrl(hit?.url);
    if (!jobUrl) return fail('OFFICIAL_SOURCE_UNCONFIRMED', 'INVALID_JOB_URL');

    if (recruitmentSourceKind(jobUrl.href) === 'THIRD_PARTY_BOARD') {
      return fail('THIRD_PARTY_BOARD_EXCLUDED', 'JOB_BOARD_SOURCE');
    }

    let proof;
    const at = now instanceof Date ? now : now ? new Date(now) : new Date();
    try {
      // This function must only return server-owned, independently audited
      // employer-domain records. Unverified "model found company URL" hints
      // cannot mint an attestation.
      proof = await getEmployerProof(hit, plan, context);
    } catch {
      return fail('OFFICIAL_SOURCE_UNCONFIRMED', 'EMPLOYER_PROOF_LOOKUP_FAILED');
    }
    if (!isAuditedEmployerProof(proof, at)) {
      return fail('OFFICIAL_SOURCE_UNCONFIRMED', 'EMPLOYER_DOMAIN_NOT_ATTESTED');
    }

    const sourceKind = recruitmentSourceKind(jobUrl.href);
    const isOwned = hostUnder(jobUrl.hostname, proof.official_domain);
    if (!isOwned && sourceKind !== 'EMPLOYER_ATS') {
      return fail('OFFICIAL_SOURCE_UNCONFIRMED', 'NOT_AN_EMPLOYER_DOMAIN_OR_APPROVED_ATS');
    }

    let careersPage = null;
    if (!isOwned) {
      let careersUrl;
      try {
        careersUrl = await getOfficialCareersUrl(proof, hit, plan, context);
      } catch {
        return fail('OFFICIAL_SOURCE_UNCONFIRMED', 'EMPLOYER_CAREERS_LOOKUP_FAILED');
      }
      const corp = tryUrl(careersUrl);
      if (!corp || !hostUnder(corp.hostname, proof.official_domain)) {
        return fail('OFFICIAL_SOURCE_UNCONFIRMED', 'CAREERS_SITE_NOT_EMPLOYER_CONTROLLED');
      }

      try {
        careersPage = await reader(corp.href, {
          allowHosts: [corp.hostname],
          fetcher,
          signal: context.signal,
          now: at,
        });
      } catch {
        return fail('FETCH_FAILED', 'EMPLOYER_CAREERS_PAGE_FETCH_FAILED');
      }

      if (!validatedPublicPageUrl(careersPage?.url, [corp.hostname]) ||
          !authorizedEmployerAtsLink(careersPage, jobUrl.href)) {
        return fail('OFFICIAL_SOURCE_UNCONFIRMED', 'ATS_TENANT_NOT_AUTHORIZED');
      }
    }

    let jobPage;
    try {
      jobPage = await reader(jobUrl.href, {
        allowHosts: [jobUrl.hostname],
        fetcher,
        signal: context.signal,
        now: at,
      });
    } catch {
      return fail('FETCH_FAILED', 'JOB_PAGE_READ_FAILED');
    }

    let fields;
    try {
      // HTML text is untrusted data. No instructions from the page are followed
      // by this coordinator. Each extracted field must be an exact page quote.
      fields = await extractJobFields(jobPage.text, {
        job_url: jobPage.url,
        employer: proof.company,
        intent: plan.intent || null,
      }, context);
    } catch {
      return fail('OFFICIAL_SOURCE_UNCONFIRMED', 'JOB_FIELD_EXTRACTION_FAILED');
    }

    return verifyOfficialJobEvidence({ url: hit.url }, {
      employer_proof: proof,
      job_page: jobPage,
      official_careers_page: careersPage,
      job_fields: fields,
    }, { now: at.getTime() });
  };
}
