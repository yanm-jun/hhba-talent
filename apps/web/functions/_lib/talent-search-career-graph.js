/**
 * HHBA Talent Intelligence Engine — evidence-grounded career graph.
 *
 * The model may propose any occupation. This module does not use a fixed
 * occupation catalog: each direction must be supported by exact excerpts from
 * the candidate's resume. Raw resume text is used only for local validation;
 * it is never included in generated search queries.
 */

const INTENTS = new Set(['direct', 'adjacent', 'transferable']);
const MAX_RESUME_CHARS = 40000;
const MAX_DIRECTION_CHARS = 64;
const MAX_QUERY_CHARS = 128;

function asText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeEvidence(value) {
  return asText(value, MAX_RESUME_CHARS)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function containsPersonalOrSecretData(value) {
  const input = asText(value, 500);
  return (
    /https?:\/\/|www\.|@|身份证|身份证号|手机号|手机号码|电话号码|电子邮箱|家庭住址|银行卡|password|api.?key|bearer|secret|token|sk-[a-z0-9_-]+/i.test(input) ||
    /(?:^|\D)(?:1[3-9]\d{9}|\d{7,18})(?:\D|$)/.test(input)
  );
}

function safeLabel(value, max = MAX_DIRECTION_CHARS) {
  const label = asText(value, max);
  if (label.length < 2 || containsPersonalOrSecretData(label)) return '';
  if (!/^[\p{Script=Han}a-zA-Z0-9+#./&（）()·\s_-]+$/u.test(label)) return '';
  return label.replace(/\s+/g, ' ');
}

function normalizeEvidenceRows(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const output = [];
  for (const item of rows.slice(0, 8)) {
    const quote = typeof item === 'string' ? asText(item, 300) : asText(item?.quote, 300);
    const normalized = normalizeEvidence(quote);
    if (normalized.length < 12 || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push({
      quote,
      kind: safeLabel(typeof item === 'object' ? item?.kind : '', 32) || 'resume_evidence',
      normalized,
    });
  }
  return output;
}

function intentWeight(intent) {
  if (intent === 'direct') return 100;
  if (intent === 'adjacent') return 82;
  return 64;
}

function sanitizeTerms(rows, max = 8) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const output = [];
  for (const item of rows.slice(0, 16)) {
    const term = safeLabel(item, 48);
    const key = term.toLocaleLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    output.push(term);
    if (output.length >= max) break;
  }
  return output;
}

export function validateCareerGraph(proposed, resumeText, options = {}) {
  const rawResume = typeof resumeText === 'string'
    ? resumeText.slice(0, MAX_RESUME_CHARS)
    : '';
  const normalizedResume = normalizeEvidence(rawResume);
  if (normalizedResume.length < 20 || !Array.isArray(proposed)) return [];

  const maxDirections = Math.max(1, Math.min(30, Math.trunc(Number(options.maxDirections) || 24)));
  const seenRoles = new Set();
  const validated = [];

  for (const item of proposed.slice(0, 80)) {
    if (!item || typeof item !== 'object') continue;

    const role = safeLabel(item.role || item.title);
    const roleKey = role.toLocaleLowerCase().replace(/[\s_-]+/g, '');
    if (!role || seenRoles.has(roleKey)) continue;

    const intent = INTENTS.has(item.intent) ? item.intent : '';
    if (!intent) continue;

    const evidenceRows = normalizeEvidenceRows(item.evidence || item.resume_evidence);
    const matchedEvidence = evidenceRows.filter(row =>
      normalizedResume.includes(row.normalized)
    );

    const minimumEvidence = intent === 'transferable' ? 2 : 1;
    if (matchedEvidence.length < minimumEvidence) continue;

    const industries = sanitizeTerms(item.industries, 6);
    const searchTerms = sanitizeTerms(item.search_terms || item.searchTerms, 8);
    const capabilities = sanitizeTerms(item.capabilities, 8);
    const rationale = asText(item.rationale || item.reason, 260);

    seenRoles.add(roleKey);
    validated.push({
      id: `career-${validated.length + 1}`,
      role,
      role_family: safeLabel(item.role_family || item.roleFamily, 48) || role,
      intent,
      industries,
      search_terms: searchTerms,
      capabilities,
      rationale,
      evidence: matchedEvidence.map(({ quote, kind }) => ({ quote, kind })),
      evidence_count: matchedEvidence.length,
      direction_confidence: Math.min(
        0.98,
        Number((0.55 + Math.min(matchedEvidence.length, 4) * 0.1 +
          (intent === 'direct' ? 0.08 : intent === 'adjacent' ? 0.03 : 0)).toFixed(2)),
      ),
      priority: intentWeight(intent),
    });

    if (validated.length >= maxDirections) break;
  }

  return validated.sort((a, b) => b.priority - a.priority || b.evidence_count - a.evidence_count);
}

function queryText(parts) {
  const clean = parts.map(x => asText(x, 48)).filter(Boolean).join(' ');
  return clean.replace(/\s+/g, ' ').slice(0, MAX_QUERY_CHARS).trim();
}

export function buildTalentSearchQueryPlan(careerGraph, options = {}) {
  const directions = Array.isArray(careerGraph) ? careerGraph : [];
  const maxQueries = Math.max(1, Math.min(72, Math.trunc(Number(options.maxQueries) || 36)));
  const nationwide = options.nationwide !== false;
  const seen = new Set();
  const queries = [];

  const add = (direction, parts, variant, bonus = 0) => {
    const query = queryText(parts);
    if (query.length < 4) return;
    const key = query.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({
      id: `q-${queries.length + 1}`,
      role: direction.role,
      intent: direction.intent,
      role_family: direction.role_family,
      variant,
      query,
      priority: direction.priority + bonus,
      evidence_count: direction.evidence_count,
      search_scope: nationwide ? 'CN_MAINLAND_NATIONWIDE' : 'CN_MAINLAND_USER_SCOPE',
      source_filters: [],
    });
  };

  const ordered = [...directions].sort((a, b) =>
    intentWeight(b.intent) - intentWeight(a.intent) ||
    (b.evidence_count || 0) - (a.evidence_count || 0)
  );

  for (const direction of ordered) {
    const role = safeLabel(direction.role);
    if (!role) continue;
    const scope = nationwide ? ['全国'] : [];
    const industries = sanitizeTerms(direction.industries, 4);
    const terms = sanitizeTerms([
      ...(Array.isArray(direction.search_terms) ? direction.search_terms : []),
      ...(Array.isArray(direction.capabilities) ? direction.capabilities : []),
    ], 5);

    add(direction, [role, ...scope, '招聘', '企业官网'], 'official_role', 5);
    add(direction, [role, '岗位职责', '任职要求', '社会招聘'], 'jd_detail', 3);

    if (terms.length) {
      add(direction, [role, terms[0], '招聘', '官网'], 'capability_role', 2);
    }
    if (industries.length) {
      add(direction, [industries[0], role, '招聘', '官网'], 'industry_role', 1);
    }
    if (industries.length > 1) {
      add(direction, [industries[1], role, '招聘', '官网'], 'industry_role', 0);
    }

    if (queries.length >= maxQueries) break;
  }

  return queries
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, maxQueries)
    .map((item, index) => ({ ...item, id: `q-${index + 1}` }));
}
