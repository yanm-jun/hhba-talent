/**
 * HHBA Talent Intelligence — bounded, allowlisted public HTML reader (POC).
 *
 * IMPORTANT: Before calling this module, the backend must validate the
 * employer domain/ATS authorization and pass a narrowly scoped allowHosts
 * list. This is a fast static-HTML reader, not a browser renderer. Do not
 * call it directly on arbitrary user-supplied URLs.
 *
 * Host allowlisting + rejecting IP literals protect against most accidental
 * private-network fetches, but DNS rebinding requires a network egress policy
 * or trusted gateway outside this module. Do not treat this as a complete SSRF
 * protection boundary when deployed without restricted outbound networking.
 */

import { extractStructuredJobPostings } from './talent-search-jd-extract.js';

const MAX_BYTES = 1_500_000;
const DEFAULT_TIMEOUT = 12000;

function clean(value, max = 4096) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function permittedHost(url, allowHosts) {
  if (!Array.isArray(allowHosts) || !allowHosts.length) return false;
  const hostname = url.hostname.toLowerCase();
  return allowHosts.some(entry => {
    const host = clean(entry, 255).toLowerCase();
    return host && hostname === host;
  });
}

export function validatedPublicPageUrl(raw, allowHosts = []) {
  try {
    if (typeof raw !== 'string' || raw.length > 4096) return null;
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const hostname = url.hostname.toLowerCase();
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(hostname)) return null;
    if (/(?:^|\.)(?:localhost|local|internal|invalid|test|onion)$/i.test(hostname)) return null;
    if (/^(?:\d+\.){3}\d+$/.test(hostname)) return null;
    if (!permittedHost(url, allowHosts)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function decodeEntities(text) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    nbsp: ' ', ndash: '–', mdash: '—', copy: '©',
    laquo: '«', raquo: '»',
  };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
    const name = entity.toLowerCase();
    if (name.startsWith('#')) {
      const hex = name.startsWith('#x');
      const code = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : ' ';
    }
    return named[name] ?? ' ';
  });
}

function extractPage(html, baseUrl, allowHosts) {
  // Deliberately conservative extraction: no scripts, styles, SVG or iframes.
  // Links are only recovered from real anchor markup in the static HTML.
  const safe = html
    .replace(/<\s*(script|style|svg|iframe|noscript|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const headings = [];
  for (const match of safe.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)) {
    const heading = decodeEntities(match[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (heading.length >= 2 && heading.length <= 160) headings.push(heading);
    if (headings.length >= 12) break;
  }
  const links = [];
  const seen = new Set();
  for (const match of safe.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi)) {
    const raw = decodeEntities(match[1] || match[2] || '');
    let target;
    try { target = new URL(raw, baseUrl); } catch { continue; }
    if (target.protocol !== 'https:' || target.username || target.password) continue;
    if (target.href.length > 4096 || seen.has(target.href)) continue;
    seen.add(target.href);
    links.push({ href: target.href });
    if (links.length >= 600) break;
  }
  const text = decodeEntities(
    safe
      .replace(/<\s*br\b[^>]*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*(?:p|div|li|h[1-6]|section|article|tr|table|header|footer)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/[ \t\r\f\v]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return { text: text.slice(0, 300000), links, headings };
}

function readerError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

/**
 * Fetches one allowed HTTPS static HTML page, manually following up to two
 * same-allowlist redirects without forwarding any credentials.
 */
export async function readPublicEmployerPage(rawUrl, options = {}) {
  const allowHosts = options.allowHosts;
  let url = validatedPublicPageUrl(rawUrl, allowHosts);
  if (!url) throw readerError('JOB_PAGE_URL_NOT_ALLOWED');

  const fetcher = options.fetcher || globalThis.fetch;
  if (typeof fetcher !== 'function') throw readerError('FETCH_UNAVAILABLE');
  const timeout = Number.isFinite(options.timeoutMs)
    ? Math.max(1000, Math.min(30000, options.timeoutMs))
    : DEFAULT_TIMEOUT;
  const maxBytes = Number.isFinite(options.maxBytes)
    ? Math.max(1024, Math.min(MAX_BYTES, options.maxBytes))
    : MAX_BYTES;

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener?.('abort', abort, { once: true });
  const timer = setTimeout(abort, timeout);

  try {
    for (let hop = 0; hop <= 2; hop++) {
      const response = await fetcher(url.href, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        headers: { Accept: 'text/html,application/xhtml+xml' },
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        if (hop === 2) throw readerError('JOB_PAGE_TOO_MANY_REDIRECTS');
        const location = clean(response.headers.get('location') || '');
        let redirect;
        try { redirect = new URL(location, url); } catch { throw readerError('JOB_PAGE_BAD_REDIRECT'); }
        const safeRedirect = validatedPublicPageUrl(redirect.href, allowHosts);
        if (!safeRedirect) throw readerError('JOB_PAGE_REDIRECT_NOT_ALLOWED');
        url = safeRedirect;
        continue;
      }

      if (response.status !== 200) throw readerError('JOB_PAGE_HTTP_ERROR');
      const mime = clean(response.headers.get('content-type') || '', 256).toLowerCase();
      if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/.test(mime)) {
        throw readerError('JOB_PAGE_CONTENT_TYPE_NOT_SUPPORTED');
      }
      const headerBytes = Number(response.headers.get('content-length'));
      if (Number.isFinite(headerBytes) && headerBytes > maxBytes) {
        throw readerError('JOB_PAGE_RESPONSE_TOO_LARGE');
      }
      const chunks = [];
      let usedBytes = 0;
      const reader = response.body?.getReader();
      if (!reader) throw readerError('JOB_PAGE_BODY_MISSING');

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          usedBytes += value.byteLength;
          if (usedBytes > maxBytes) {
            await reader.cancel();
            throw readerError('JOB_PAGE_RESPONSE_TOO_LARGE');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const whole = new Uint8Array(usedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        whole.set(chunk, offset);
        offset += chunk.byteLength;
      }

      let html;
      try {
        html = new TextDecoder('utf-8', { fatal: true }).decode(whole);
      } catch {
        throw readerError('JOB_PAGE_INVALID_ENCODING');
      }
      const extracted = extractPage(html, url.href, allowHosts);
      const structuredJobs = extractStructuredJobPostings(html, url.href);
      const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
      return {
        url: url.href,
        status: 200,
        content_type: mime,
        fetched_at: now,
        content_length: usedBytes,
        text: extracted.text,
        links: extracted.links,
        headings: extracted.headings,
        structured_jobs: structuredJobs,
      };
    }
    throw readerError('JOB_PAGE_TOO_MANY_REDIRECTS');
  } catch (error) {
    if (controller.signal.aborted) throw readerError('JOB_PAGE_TIMEOUT_OR_CANCELLED');
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener?.('abort', abort);
  }
}
