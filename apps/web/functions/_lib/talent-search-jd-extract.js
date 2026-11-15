/**
 * HHBA Talent Intelligence — conservative JD extraction from fetched pages.
 *
 * All content is untrusted. This module makes no external calls and never
 * treats a search snippet, AI response, or JSON-LD alone as employer proof.
 * It can only extract from a page that has already been read by the server.
 */
import { findMainlandCity } from './mainland-job-location.js';

function text(value, max = 30000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function normalized(value) {
  return text(value, 40000).normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]+/gu, '').toLowerCase();
}
function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–' };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, code) => {
    const k = code.toLowerCase();
    if (!k.startsWith('#')) return named[k] ?? ' ';
    const hex = k.startsWith('#x');
    const n = parseInt(k.slice(hex ? 2 : 1), hex ? 16 : 10);
    return n > 0 && n <= 0x10ffff && (n < 0xd800 || n > 0xdfff) ? String.fromCodePoint(n) : ' ';
  });
}
function stripMarkup(value) {
  return decodeEntities(String(value || '')
    .replace(/<(?:script|style|iframe|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|svg)\s*>/gi, ' ')
    .replace(/<\/(?:p|li|div|h[1-6]|section|article|br)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
  ).replace(/[\t\r ]+/g, ' ').replace(/\n[ \t]*/g, '\n').trim().slice(0, 30000);
}
function flatten(items) {
  const found = [];
  function visit(item, depth) {
    if (depth > 5 || found.length >= 50 || item == null) return;
    if (Array.isArray(item)) {
      for (const x of item.slice(0, 50)) visit(x, depth + 1);
      return;
    }
    if (typeof item !== 'object') return;
    const type = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
    if (type.some(t => typeof t === 'string' && /(?:^|\/|#)JobPosting$/i.test(t))) {
      found.push(item);
      return;
    }
    if (item['@graph']) visit(item['@graph'], depth + 1);
    if (item.mainEntity) visit(item.mainEntity, depth + 1);
    if (item.itemListElement) visit(item.itemListElement, depth + 1);
    if (item.item) visit(item.item, depth + 1);
  }
  visit(items, 0);
  return found;
}
function valueText(value, max = 5000) {
  if (typeof value === 'string') return stripMarkup(value).slice(0, max);
  if (Array.isArray(value)) return value.slice(0, 15).map(x => valueText(x, max)).filter(Boolean).join('\n').slice(0, max);
  if (typeof value === 'object' && value) {
    return valueText(value.name || value.value || value.description || '', max);
  }
  return '';
}
function locationFromNode(node) {
  const rows = Array.isArray(node.jobLocation) ? node.jobLocation : [node.jobLocation];
  for (const row of rows) {
    const address = typeof row === 'object' && row ? row.address || row : null;
    if (!address) continue;
    const city = valueText(address.addressLocality || address.addressRegion || row.name || '', 200);
    if (findMainlandCity(city)) return findMainlandCity(city);
  }
  return '';
}
function structuredSalary(value) {
  if (typeof value === 'string') return valueText(value, 160);
  if (!value || typeof value !== 'object') return '';
  const amount = value.value ?? value;
  if (typeof amount === 'string' && /\d/.test(amount)) return text(amount, 160);
  if (typeof amount === 'number') {
    // Do not present a number lacking a valid unit/currency as a salary.
    return '';
  }
  if (amount && typeof amount === 'object') {
    const low = amount.minValue;
    const high = amount.maxValue;
    const unit = text(amount.unitText || value.unitText, 50);
    const currency = text(value.currency, 12);
    if (Number.isFinite(Number(low)) && Number.isFinite(Number(high)) && unit && currency) {
      return String(low) + '-' + String(high) + ' ' + currency + '/' + unit;
    }
  }
  return '';
}
const DUTY_HEADING = /^(?:岗位职责|工作职责|职位职责|主要职责|工作内容|职责描述|工作描述|responsibilities|job responsibilities|what you(?:'|’)ll do)\s*[:：]?\s*/i;
const REQUIREMENT_HEADING = /^(?:任职要求|任职资格|岗位要求|职位要求|任职条件|资格要求|应聘要求|qualifications|requirements|what we(?:'|’)re looking for)\s*[:：]?\s*/i;
const END_HEADING = /^(?:工作地点|招聘流程|薪资待遇|薪酬福利|职位福利|公司介绍|about us|benefits|salary|location|申请方式|投递方式)\s*[:：]?/i;

function extractLabeledParts(raw, maximum = 9000) {
  const source = stripMarkup(raw).slice(0, maximum);
  const lines = source.split(/\n+/).map(x => x.trim()).filter(Boolean);
  let section = '';
  const duties = [], requirements = [];
  for (const line of lines) {
    if (DUTY_HEADING.test(line)) {
      section = 'duties';
      const rest = line.replace(DUTY_HEADING, '').trim();
      if (rest) duties.push(rest);
      continue;
    }
    if (REQUIREMENT_HEADING.test(line)) {
      section = 'requirements';
      const rest = line.replace(REQUIREMENT_HEADING, '').trim();
      if (rest) requirements.push(rest);
      continue;
    }
    if (END_HEADING.test(line)) {
      section = '';
      continue;
    }
    if (section === 'duties') duties.push(line);
    else if (section === 'requirements') requirements.push(line);
  }
  return {
    responsibilities: duties.join('\n').slice(0, 6000).trim(),
    requirements: requirements.join('\n').slice(0, 6000).trim(),
  };
}

function cleanStructuredPosting(node, index, baseUrl) {
  const title = valueText(node.title || node.name, 160);
  const company = valueText(node.hiringOrganization?.name || node.hiringOrganization, 200);
  const location = locationFromNode(node);
  const description = valueText(node.description, 30000);
  const extracted = extractLabeledParts(description);
  const responsibilities = valueText(node.responsibilities || node.jobResponsibilities, 8000)
    || extracted.responsibilities;
  const requirements = valueText(node.qualifications || node.skills || node.experienceRequirements, 8000)
    || extracted.requirements;
  let jobUrl = '';
  if (typeof node.url === 'string') {
    try {
      const u = new URL(node.url, baseUrl);
      if (u.protocol === 'https:' && !u.username && !u.password) {
        u.hash = '';
        jobUrl = u.href;
      }
    } catch { /* absent URL is not automatic rejection if one unambiguous job */ }
  }
  return {
    index, title, company, location, responsibilities, requirements,
    salary: structuredSalary(node.baseSalary),
    valid_through: text(node.validThrough, 50),
    published_at: text(node.datePosted, 50),
    url: jobUrl,
  };
}

/**
 * Only JSON-LD application/ld+json blocks are considered. Reject large or
 * malformed blocks; cap both parse work and number of returned postings.
 */
export function extractStructuredJobPostings(html, baseUrl) {
  const source = typeof html === 'string' ? html.slice(0, 1_500_000) : '';
  const postings = [];
  let seenScripts = 0;
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (++seenScripts > 60 || postings.length >= 20) break;
    const attrs = match[1] || '';
    if (!/\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)(?:\s|$)/i.test(attrs)) continue;
    const payload = (match[2] || '').trim();
    if (!payload || payload.length > 400000) continue;
    try {
      const value = JSON.parse(payload);
      for (const node of flatten(value)) {
        if (postings.length >= 20) break;
        const result = cleanStructuredPosting(node, postings.length, baseUrl);
        if (result.title && result.company) postings.push(result);
      }
    } catch { /* malformed JSON-LD cannot become job evidence */ }
  }
  return postings;
}

function sameJobUrl(row, pageUrl) {
  if (!row.url) return false;
  try {
    const a = new URL(row.url), b = new URL(pageUrl);
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '')
      && a.search === b.search;
  } catch { return false; }
}
function singleStructuredPosting(page) {
  const rows = Array.isArray(page?.structured_jobs) ? page.structured_jobs : [];
  if (!rows.length) return null;
  const matched = rows.filter(row => sameJobUrl(row, page.url));
  if (matched.length === 1) return matched[0];
  if (matched.length > 1) return null;
  // No explicit per-posting URLs: permit a single unambiguous JobPosting only.
  if (rows.length === 1 && !rows[0].url) return rows[0];
  return null;
}
function extractVisibleJobFields(page, employer) {
  const source = text(page?.text, 40000);
  if (source.length < 130) return null;
  const parts = extractLabeledParts(source, 35000);
  if (parts.responsibilities.length < 25 || parts.requirements.length < 25) return null;
  const lines = source.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const firstDuty = lines.findIndex(x => DUTY_HEADING.test(x));
  const headingBlock = lines.slice(0, firstDuty < 0 ? 12 : Math.min(firstDuty, 12));
  const title = (Array.isArray(page?.headings) ? page.headings : [])
    .map(x => text(x, 160))
    .find(x => x.length >= 3 && !DUTY_HEADING.test(x) && !REQUIREMENT_HEADING.test(x) &&
      !/^(?:招聘|社会招聘|职位详情|job details|招聘岗位|招聘职位)$/i.test(x))
    || headingBlock.find(x => x.length >= 3 && x.length <= 90 &&
      !/^(?:公司|工作地点|薪资|任职要求|职位信息)/.test(x) &&
      !normalized(employer).includes(normalized(x)))
    || '';
  const locationLine = lines.find(x => /^(?:工作地点|工作城市|办公地点|职位地点|工作地址|location)\s*[:：]/i.test(x)) || '';
  const location = findMainlandCity(locationLine);
  const salaryLine = lines.find(x => /^(?:薪资|薪酬|月薪|薪资待遇|salary)\s*[:：]/i.test(x)) || '';
  const salary = (salaryLine.match(/[:：]\s*(.{3,90})/) || [])[1] || '';
  if (!title || !location) return null;
  return {
    company: text(employer, 200), title, location, responsibilities: parts.responsibilities,
    requirements: parts.requirements, salary: salary.trim(), source_kind: 'visible_page',
  };
}

/**
 * Returns field evidence from a concrete fetched job page, not search/model
 * output. Structured data wins only when bound to this exact job URL.
 */
export function extractJobFieldsFromPage(page, options = {}) {
  const row = singleStructuredPosting(page);
  if (row && row.title && row.company && row.location &&
      row.responsibilities.length >= 25 && row.requirements.length >= 25) {
    return {
      company: row.company, title: row.title, location: row.location,
      responsibilities: row.responsibilities, requirements: row.requirements,
      salary: row.salary, source_kind: 'jsonld', source_index: row.index,
    };
  }
  return extractVisibleJobFields(page, options.employer) || null;
}
