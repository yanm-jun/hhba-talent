import { createHash } from 'node:crypto';

const PLATFORMS = new Set(['greenhouse', 'ashby', 'lever']);
const OFFICIAL_HOSTS = {
  greenhouse: new Set(['job-boards.greenhouse.io', 'boards.greenhouse.io', 'boards.eu.greenhouse.io']),
  ashby: new Set(['jobs.ashbyhq.com']),
  lever: new Set(['jobs.lever.co', 'jobs.eu.lever.co']),
};
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const safeString = (v, limit = 240) => typeof v === 'string' ? v.trim().slice(0, limit) : '';

export function officialAtsUrl(value, platform, slug) {
  if (!PLATFORMS.has(platform) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(slug)) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !OFFICIAL_HOSTS[platform].has(u.hostname)) return null;
    if (!u.pathname.split('/').includes(slug) || u.pathname === '/') return null;
    return u.origin + u.pathname;
  } catch { return null; }
}

export function canonicalId(platform, slug, safeUrl) {
  return 'J_' + createHash('sha256').update(`${platform}\0${slug}\0${safeUrl}`).digest('hex').slice(0, 32);
}

export function normalizeAts(row, { observedAt, now = Date.now(), maxAgeMs = MAX_AGE_MS } = {}) {
  if (!row || typeof row !== 'object' || row.domestic === true || row.status === 'stale') return null;
  const platform = safeString(row.platform, 30).toLowerCase();
  const slug = safeString(row.source, 100);
  const url = officialAtsUrl(row.url, platform, slug);
  const title = safeString(row.title, 220);
  const company = safeString(row.company, 180);
  const observed = Date.parse(row.observedAt || observedAt || '');
  if (!url || !title || !company || !Number.isFinite(observed) ||
      observed > now + 5 * 60_000 || now - observed > maxAgeMs) return null;
  const jobId = canonicalId(platform, slug, url);
  const titleZh = safeString(row.titleZh, 220);
  const locationZh = safeString(row.locationZh, 170);
  const translationMode = safeString(row.titleStatus, 30);
  const translationValid = Boolean(titleZh && titleZh !== title && translationMode !== 'pending');
  const oldId = safeString(row.id, 180);
  return {
    job_id: jobId,
    legacy_ids: oldId ? [{ system: 'green_market', id: oldId }] : [],
    company: { name: company, identity_verified: false },
    title: { original: title, original_lang: 'en', zh_CN: translationValid ? titleZh : null,
      zh_quality: !translationValid ? 'UNAVAILABLE' : translationMode === 'machine' ? 'MACHINE_UNREVIEWED' : 'GLOSSARY_UNREVIEWED' },
    location: { original: safeString(row.location, 170) || null, zh_CN: locationZh || null,
      country: null },
    recruitment_type: ['SOCIAL', 'CAMPUS', 'INTERNSHIP', 'SPECIAL'].includes(row.recruitmentType)
      ? row.recruitmentType : 'UNKNOWN',
    employment_type: null,
    work_mode: row.remote === true ? 'REMOTE' : 'UNKNOWN',
    education_min: null,
    experience_years_min: null,
    source: { type: 'OFFICIAL_ATS', platform, source_key: `${platform}:${slug}`,
      native_id: null, official_detail_url: url,
      last_observed_at: new Date(observed).toISOString() },
    availability: { state: 'RECENTLY_OBSERVED', checked_at: new Date(observed).toISOString(),
      application_link_status: 'OFFICIAL_DETAIL_ONLY', direct_apply_url: null,
      application_confirmed_open: false },
    description: { original_status: 'NOT_AVAILABLE_FOR_PUBLIC_DISPLAY',
      translated_status: 'NOT_AVAILABLE_FOR_PUBLIC_DISPLAY', rights_reviewed: false,
      source_hash: null },
    visibility: 'PUBLIC_METADATA_ONLY', matching_eligibility: 'NEEDS_REQUIREMENTS_EVIDENCE',
  };
}

export function normalizeHistorical(row) {
  if (!row || typeof row !== 'object') return null;
  const id = safeString(row.job_id, 80), title = safeString(row.job_title, 220);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !title) return null;
  return { legacy_id: id, job_title: title, company: safeString(row.company_display_name, 180),
    historical_status: row.job_status || 'UNKNOWN',
    last_verified_at: row.last_verified_at || null, active_market_eligible: false };
}

export function buildSnapshot(raw, { now = Date.now(), maxAgeMs = MAX_AGE_MS } = {}) {
  if (!raw || !Array.isArray(raw.jobs) || !Number.isInteger(raw.total) || raw.total < 0 ||
      !Number.isInteger(raw.boards) || raw.boards < 1 ||
      !Number.isInteger(raw.failures ?? raw.failedBoards) || (raw.failures ?? raw.failedBoards) !== 0 ||
      !Number.isFinite(Date.parse(raw.updated || raw.updatedAt || '')) ||
      raw.total !== raw.jobs.length) {
    throw new Error('Untrusted or incomplete ATS snapshot; active market must not silently claim completeness');
  }
  const observedAt = raw.updated || raw.updatedAt;
  const snapshotTime = Date.parse(observedAt);
  if (snapshotTime > now + 5 * 60_000 || now - snapshotTime > maxAgeMs)
    throw new Error('Snapshot stale or future-dated');
  const byId = new Map(), aliases = new Map(), rejected = [];
  for (const row of raw.jobs) {
    const normalized = normalizeAts(row, { observedAt, now, maxAgeMs });
    if (!normalized) { rejected.push({ id: safeString(row?.id, 180) || null, reason: 'NOT_ELIGIBLE_OR_NOT_RECENT' }); continue; }
    const old = byId.get(normalized.job_id);
    if (old && (old.title.original !== normalized.title.original || old.company.name !== normalized.company.name)) {
      rejected.push({ id: safeString(row?.id, 180) || null, reason: 'CANONICAL_ID_CONFLICT' });
      continue;
    }
    if (!old) byId.set(normalized.job_id, normalized);
    else for (const alias of normalized.legacy_ids) {
      if (!old.legacy_ids.some(entry => entry.system === alias.system && entry.id === alias.id)) old.legacy_ids.push(alias);
    }
    for (const alias of normalized.legacy_ids) {
      const key = `${alias.system}:${alias.id}`;
      if (aliases.has(key) && aliases.get(key) !== normalized.job_id) {
        rejected.push({ id: alias.id, reason: 'LEGACY_ALIAS_COLLISION' });
      } else aliases.set(key, normalized.job_id);
    }
  }
  const items = [...byId.values()].sort((a,b) => a.company.name.localeCompare(b.company.name) ||
    a.title.original.localeCompare(b.title.original) || a.job_id.localeCompare(b.job_id));
  return { items, byId, aliases, rejected, as_of: new Date(Date.parse(observedAt)).toISOString(),
    source_health: { boards: raw.boards, failed_boards: 0, rejected_records: rejected.length,
      state: items.length ? 'READY' : 'EMPTY' } };
}

export function searchSnapshot(snapshot, query) {
  const norm = (v) => String(v || '').trim().toLocaleLowerCase();
  const q = norm(query.q), company = norm(query.company), city = norm(query.city);
  const type = String(query.recruitment_type || '').trim().toUpperCase();
  const remote = query.remote === 'true';
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const offset = Math.min(100000, Math.max(0, Number(query.offset || 0)));
  if (!Number.isInteger(limit) || !Number.isInteger(offset)) throw new Error('Invalid pagination');
  const items = snapshot.items.filter(j =>
    (!q || [j.title.original, j.title.zh_CN, j.company.name, j.location.original, j.location.zh_CN].some(v => norm(v).includes(q))) &&
    (!company || norm(j.company.name).includes(company)) &&
    (!city || [j.location.original, j.location.zh_CN].some(v => norm(v).includes(city))) &&
    (!type || j.recruitment_type === type) && (!remote || j.work_mode === 'REMOTE'));
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset,
    as_of: snapshot.as_of, source_health: snapshot.source_health,
    warnings: ['RECENTLY_OBSERVED does not guarantee successful application; confirm on official site'] };
}
