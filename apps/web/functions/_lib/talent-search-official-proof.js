/**
 * HHBA Talent Intelligence Engine — dynamic employer-source & job-detail proof.
 *
 * SECURITY BOUNDARY
 * The caller MUST fetch proof, the employer careers page and the job page using
 * trusted server-side services. Search results, model output, and arbitrary
 * user JSON are NEVER an employer attestation. In particular, caller-provided
 * booleans or career-looking hostnames do not prove company ownership.
 *
 * An attestation is a previously audited server record (verified employer
 * account, independent company-registry audit, or human reviewer), not a new
 * claim inferred here from text. This pure validator produces no network I/O.
 */

import { recruitmentSourceKind } from './match-employer-source.js';
import { isMainlandJobLocation } from './mainland-job-location.js';
import { classifyJobAvailability } from './match-job-quality.js';

const PROOF_ISSUERS = new Set([
  'verified_employer_account',
  'independent_company_audit',
  'human_review',
]);
const MAX_PROOF_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_PAGE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const HOSTS_REJECTED = /(?:^|\.)(?:localhost|local|internal|invalid|test)$/i;
const TOO_BROAD_DOMAINS = new Set([
  'com', 'cn', 'net', 'org', 'edu', 'gov', 'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'co.uk', 'com.hk', 'com.tw', 'co.jp', 'com.sg', 'myworkdayjobs.com',
  'workdayjobs.com', 'ashbyhq.com', 'greenhouse.io', 'lever.co',
  'smartrecruiters.com', 'oraclecloud.com', 'icims.com',
]);
const GENERIC_ROOT_PATH = /^(?:\/(?:careers?|jobs?|recruit(?:ment)?|positions?|openings?|talent|join(?:-us)?|social-recruitment)?\/?|\/index(?:\.[a-z0-9]+)?)$/i;
const JOB_QUERY_KEYS = new Set(['jobid', 'job_id', 'id', 'postid', 'positionid', 'requisitionid', 'jobunionid', 'advertisementid']);

function string(value, max = 512) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function compact(value) {
  return string(value, 100000)
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .toLocaleLowerCase();
}

function normalizeUrl(value) {
  const raw = string(value, 4096);
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (!/^[a-z0-9.-]+$/i.test(u.hostname) || HOSTS_REJECTED.test(u.hostname)) return null;
    if (/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(u.hostname)) return null;
    const m = u.hostname.match(/^172\.(\d+)\./);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return null;
    u.hash = '';
    return u;
  } catch {
    return null;
  }
}

function sameOrChild(host, domain) {
  return host === domain || host.endsWith('.' + domain);
}

function validCorporateDomain(value) {
  const domain = string(value, 240).toLowerCase();
  if (TOO_BROAD_DOMAINS.has(domain) || HOSTS_REJECTED.test(domain)) return '';
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)) return '';
  return domain;
}

function pageIsFresh(page, now) {
  if (!page || page.status !== 200) return false;
  const date = Date.parse(string(page.fetched_at, 80));
  return Number.isFinite(date) &&
    date <= now + 5 * 60 * 1000 &&
    now - date <= MAX_PAGE_AGE_MS;
}

function auditIsValid(proof, now) {
  if (!proof || typeof proof !== 'object' || !PROOF_ISSUERS.has(proof.issuer)) return false;
  if (proof.status !== 'verified') return false;
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(string(proof.record_id, 120))) return false;
  if (string(proof.company, 150).length < 2) return false;
  if (!validCorporateDomain(proof.official_domain)) return false;
  const date = Date.parse(string(proof.verified_at, 80));
  return Number.isFinite(date) &&
    date <= now + 5 * 60 * 1000 &&
    now - date <= MAX_PROOF_AGE_MS;
}

/**
 * Server-side trust preflight: call only with an attestation loaded from
 * HHBA's controlled audit store, never with search/model-provided JSON.
 */
export function isAuditedEmployerProof(proof, now = Date.now()) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  return Number.isFinite(timestamp) && auditIsValid(proof, timestamp);
}

function normalizeCompany(value) {
  return compact(value).replace(
    /(?:股份有限公司|有限责任公司|股份公司|有限公司|集团股份公司|集团公司|集团|公司)$/,
    '',
  );
}

function companyMatch(value, attestation) {
  const aliases = [attestation.company, ...(Array.isArray(attestation.aliases) ? attestation.aliases.slice(0, 8) : [])];
  const candidate = normalizeCompany(value);
  return candidate.length >= 2 &&
    aliases.some(alias => candidate === normalizeCompany(alias));
}

function exactQuotedValue(sourceText, quote, minimumLength = 2) {
  const target = compact(quote);
  return target.length >= minimumLength && compact(sourceText).includes(target);
}

function structuredFieldProof(page, jobUrl, fields, now) {
  if (fields?.source_kind !== 'jsonld' || !Number.isInteger(fields.source_index)) return null;
  const rows = Array.isArray(page?.structured_jobs) ? page.structured_jobs : [];
  const record = rows.find(row => row.index === fields.source_index);
  if (!record) return null;

  // JobPosting records on a page can describe many unrelated vacancies.
  // Require the exact URL, or a single JobPosting that omits its URL entirely.
  if (record.url) {
    if (normalizeUrl(record.url)?.href !== jobUrl.href) return null;
  } else if (rows.length !== 1) return null;

  const equal = (left, right) => compact(left).length > 0 && compact(left) === compact(right);
  if (!equal(record.company, fields.company) || !equal(record.title, fields.title) ||
      !equal(record.location, fields.location) ||
      !equal(record.responsibilities, fields.responsibilities) ||
      !equal(record.requirements, fields.requirements) ||
      (fields.salary && !equal(record.salary, fields.salary))) return null;

  if (record.valid_through) {
    const deadline = Date.parse(record.valid_through);
    if (Number.isFinite(deadline) && deadline < now - 24 * 60 * 60 * 1000) {
      return { record, expired: true };
    }
  }
  return { record, expired: false };
}

function linkTarget(row) {
  return normalizeUrl(typeof row === 'string' ? row : row?.href || row?.url);
}

function exactJobReference(officialPage, target) {
  for (const item of Array.isArray(officialPage.links) ? officialPage.links : []) {
    const link = linkTarget(item);
    if (link && link.href === target.href) return {
      method: 'official_careers_direct_link', source_url: officialPage.url, link_url: link.href,
    };
  }
  return null;
}

function sameTenantReference(officialPage, target) {
  // An official careers-page link to an identifiable ATS tenant can authorize
  // jobs within that tenant, not unrelated jobs on the same shared ATS host.
  for (const item of Array.isArray(officialPage.links) ? officialPage.links : []) {
    const link = linkTarget(item);
    if (!link || recruitmentSourceKind(link.href) !== 'EMPLOYER_ATS') continue;
    if (link.hostname !== target.hostname) continue;

    const prefix = link.pathname.replace(/\/+$/, '');
    if (!prefix || prefix === '/' || prefix.length < 3) continue;

    // Shared-host ATS providers must be bound to a tenant name in the URL.
    // A bare /jobs or /positions index cannot authorize an entire provider.
    const segments = prefix.split('/').filter(Boolean);
    if (
      ['ashbyhq.com', 'greenhouse.io', 'lever.co', 'recruitee.com'].some(d => sameOrChild(link.hostname, d)) &&
      (segments.length < 1 || /^(?:jobs?|positions?|careers?|openings?)$/i.test(segments[0]))
    ) continue;

    if (target.pathname === prefix || target.pathname.startsWith(prefix + '/')) {
      return {
        method: 'official_careers_ats_tenant_link',
        source_url: officialPage.url,
        link_url: link.href,
      };
    }
  }
  return null;
}

/**
 * Preflight link check for preventing unnecessary fetches to unrelated ATS
 * tenants. The official careers page itself must still be authenticated by
 * an independent employer proof before this check is called.
 */
export function authorizedEmployerAtsLink(officialPage, jobUrl) {
  const target = normalizeUrl(jobUrl);
  if (!target || recruitmentSourceKind(target.href) !== 'EMPLOYER_ATS') return null;
  return exactJobReference(officialPage, target) ||
    sameTenantReference(officialPage, target);
}

function hasSpecificJobPath(url) {
  if (!url || GENERIC_ROOT_PATH.test(url.pathname)) {
    if (!url) return false;
    return [...url.searchParams.entries()].some(([key, value]) =>
      JOB_QUERY_KEYS.has(key.toLowerCase()) && value.trim().length >= 3);
  }
  const path = url.pathname.split('/').filter(Boolean);
  if (!path.length) return false;
  return path.length >= 2 || /\d{4,}|[0-9a-f]{8}-[0-9a-f-]{12,}/i.test(url.pathname);
}

function reject(state, reason, checkedAt) {
  return {
    eligible: false, state, reason,
    checked_at: checkedAt,
    job: null, source_proof: null, field_evidence: null,
  };
}

export function verifyOfficialJobEvidence(candidate, evidence = {}, options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() :
    Number.isFinite(options.now) ? options.now : Date.now();
  const checkedAt = new Date(now).toISOString();

  const jobUrl = normalizeUrl(candidate?.url);
  if (!jobUrl || !hasSpecificJobPath(jobUrl)) {
    return reject('OFFICIAL_SOURCE_UNCONFIRMED', 'NOT_A_SPECIFIC_HTTPS_JOB_URL', checkedAt);
  }
  if (recruitmentSourceKind(jobUrl.href) === 'THIRD_PARTY_BOARD') {
    return reject('THIRD_PARTY_BOARD_EXCLUDED', 'JOB_BOARD_SOURCE', checkedAt);
  }

  const proof = evidence.employer_proof;
  if (!auditIsValid(proof, now)) {
    return reject('OFFICIAL_SOURCE_UNCONFIRMED', 'EMPLOYER_DOMAIN_NOT_ATTESTED', checkedAt);
  }
  const officialDomain = validCorporateDomain(proof.official_domain);

  const page = evidence.job_page;
  const actualJobUrl = normalizeUrl(page?.url);
  if (!pageIsFresh(page, now) || !actualJobUrl || actualJobUrl.href !== jobUrl.href) {
    return reject('FETCH_FAILED', 'JOB_PAGE_NOT_FETCHED_OR_URL_MISMATCH', checkedAt);
  }

  const pageText = string(page.text || page.content, 100000);
  const structured = structuredFieldProof(page, jobUrl, evidence.job_fields, now);
  // Short, position-specific static HTML can still contain fully grounded
  // duties and requirements. Require both exact sections below instead of
  // rejecting legitimate concise postings solely by document length.
  if (pageText.length < 100 && !structured) {
    return reject('FETCH_FAILED', 'JOB_PAGE_HAS_INSUFFICIENT_DETAIL', checkedAt);
  }
  if (structured?.expired) {
    return reject('CLOSED_OR_EXPIRED', 'STRUCTURED_POSTING_EXPIRED', checkedAt);
  }

  const isEmployerDomain = sameOrChild(jobUrl.hostname, officialDomain);
  let sourceProof = null;
  let sourceState;

  if (isEmployerDomain) {
    sourceState = 'VERIFIED_EMPLOYER_DOMAIN';
    sourceProof = {
      method: 'attested_employer_domain',
      attestation_id: proof.record_id,
      official_domain: officialDomain,
      verified_at: proof.verified_at,
      evidence_url: jobUrl.href,
    };
  } else {
    const officialPage = evidence.official_careers_page;
    const officialUrl = normalizeUrl(officialPage?.url);

    if (recruitmentSourceKind(jobUrl.href) !== 'EMPLOYER_ATS') {
      return reject('OFFICIAL_SOURCE_UNCONFIRMED', 'NOT_A_RECOGNIZED_ATS', checkedAt);
    }
    if (!pageIsFresh(officialPage, now) || !officialUrl ||
        !sameOrChild(officialUrl.hostname, officialDomain) ||
        string(officialPage.text || officialPage.content, 100000).length < 40) {
      return reject('OFFICIAL_SOURCE_UNCONFIRMED', 'NO_ATTESTED_EMPLOYER_CAREERS_PAGE', checkedAt);
    }

    const authorization = authorizedEmployerAtsLink(officialPage, jobUrl.href);
    if (!authorization) {
      return reject('OFFICIAL_SOURCE_UNCONFIRMED', 'ATS_LINK_NOT_AUTHORIZED_BY_EMPLOYER', checkedAt);
    }

    sourceState = 'VERIFIED_EMPLOYER_AUTHORIZED_ATS';
    sourceProof = {
      ...authorization,
      attestation_id: proof.record_id,
      official_domain: officialDomain,
      verified_at: proof.verified_at,
      evidence_url: jobUrl.href,
    };
  }

  const field = evidence.job_fields || {};
  const employer = string(field.company || candidate.company, 150);
  if (!companyMatch(employer, proof)) {
    return reject('OFFICIAL_SOURCE_UNCONFIRMED', 'EMPLOYER_NAME_MISMATCH', checkedAt);
  }
  // Employer-hosted ATS tenants are shared infrastructure. Even after a
  // legitimate cross-domain link, demand the employer brand in the fetched
  // position page rather than accepting a model-supplied company field.
  if (!isEmployerDomain && ![proof.company, ...(Array.isArray(proof.aliases) ? proof.aliases : [])]
    .some(alias => exactQuotedValue(pageText, alias, 2) ||
      (structured && exactQuotedValue(structured.record.company, alias, 2)))) {
    return reject('OFFICIAL_SOURCE_UNCONFIRMED', 'ATS_JOB_EMPLOYER_NOT_GROUNDED', checkedAt);
  }

  const title = string(field.title, 140);
  const location = string(field.location, 100);
  const responsibilities = string(field.responsibilities || field.duties, 12000);
  const requirements = string(field.requirements || field.qualifications, 12000);
  const salary = string(field.salary, 160);

  const grounded = structured || (
    exactQuotedValue(pageText, title, 3) &&
    exactQuotedValue(pageText, location) &&
    exactQuotedValue(pageText, responsibilities, 20) &&
    exactQuotedValue(pageText, requirements, 20) &&
    (!salary || exactQuotedValue(pageText, salary))
  );
  if (!title || !location || !isMainlandJobLocation(location) ||
      responsibilities.length < 25 || requirements.length < 25 || !grounded) {
    return reject('OFFICIAL_SOURCE_UNCONFIRMED', 'JOB_FIELDS_NOT_GROUNDED_IN_PAGE', checkedAt);
  }

  // A search snippet, an application button or a 200 response cannot establish
  // current hiring status. Reuse the conservative page-level classifier.
  const availability = classifyJobAvailability(
    { content: pageText }, { fetched: true, checkedAt },
  );
  if (availability.status === 'CLOSED_LISTED') {
    return reject('CLOSED_OR_EXPIRED', 'OFFICIAL_PAGE_SHOWS_CLOSED', checkedAt);
  }

  const titleEvidence = title;
  const fieldEvidence = {
    company: employer,
    title: titleEvidence,
    location,
    salary: salary || null,
    responsibilities: responsibilities.slice(0, 1000),
    requirements: requirements.slice(0, 1000),
    source_page: jobUrl.href,
    fetched_at: page.fetched_at,
    evidence_kind: structured ? 'jsonld' : 'visible_page',
  };

  return {
    eligible: true,
    state: sourceState,
    reason: 'OFFICIAL_DETAIL_GROUNDED',
    checked_at: checkedAt,
    source_proof: sourceProof,
    field_evidence: fieldEvidence,
    job: {
      employer,
      company: proof.company,
      title,
      location,
      salary: salary || null,
      responsibilities,
      requirements,
      official_url: jobUrl.href,
      source_type: '站外官方招聘',
      recruitment_source_status: sourceState,
      availability_status: availability.status,
      availability_evidence: availability.evidence,
      checked_at: checkedAt,
    },
  };
}
