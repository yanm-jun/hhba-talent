/**
 * HHBA Talent Intelligence Engine — provider adapters (POC).
 *
 * These adapters accept only a search query and provider credentials. They never
 * accept or transmit a raw resume. All returned URLs are untrusted candidates;
 * this module does not certify employer ownership or job validity.
 */

const DEFAULT_TIMEOUT_MS = 18000;
const MAX_RESPONSE_CHARS = 8_000_000;

export const TALENT_SEARCH_PROVIDER_IDS = Object.freeze([
  'baidu_agentic',
  'baidu_web',
  'deepseek',
  'brave_context',
  'exa',
  'tavily',
  'firecrawl',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function boundedInt(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, Math.floor(number)))
    : fallback;
}

function weightedBaiduLength(value) {
  let length = 0;
  for (const character of value) {
    length += /[\u3400-\u9fff\uf900-\ufaff]/u.test(character) ? 2 : 1;
  }
  return length;
}

function limitBaiduQuery(value, maxLength = 72) {
  const query = text(value);
  let output = '';
  let length = 0;
  for (const character of query) {
    const next = /[\u3400-\u9fff\uf900-\ufaff]/u.test(character) ? 2 : 1;
    if (length + next > maxLength) break;
    output += character;
    length += next;
  }
  return output.trim();
}

function safeHttpUrl(value) {
  const raw = text(value);
  if (!raw || raw.length > 8192) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (!url.hostname || url.username || url.password) return '';
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === 'metadata.google.internal'
    ) return '';
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return '';
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return '';
    if (host === '::1' || host === '[::1]' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|gclid|fbclid|mc_cid|mc_eid|ref_src|spm|from)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeHit(provider, item, index, metadata = {}) {
  if (!item || typeof item !== 'object') return null;
  const url = safeHttpUrl(item.url || item.link || item.source_url || item.sourceUrl);
  if (!url) return null;

  const snippetRows = Array.isArray(item.snippets)
    ? item.snippets
    : Array.isArray(item.highlights) ? item.highlights : [];
  const snippets = snippetRows.map(text).filter(Boolean);
  const snippet = text(item.snippet || item.description || item.summary) || snippets.join('\n');
  const content = text(
    item.content ||
    item.raw_content ||
    item.text ||
    item.markdown ||
    item.full_content
  ) || snippets.join('\n');

  const authority = Number(
    item.authority_score ?? item.authority ?? item.authorityScore
  );
  const score = Number(
    item.rerank_score ?? item.score ?? item.relevance_score ?? item.provider_score
  );

  return {
    id: `${provider}:${url}`,
    provider,
    title: text(item.title || item.name || item.web_anchor),
    url,
    snippet: snippet.slice(0, 5000),
    content: content.slice(0, 30000),
    source_name: text(item.website || item.site_name || item.source_name || item.domain),
    published_at: text(item.publish_date || item.published_date || item.publishedDate || item.date),
    authority_score: Number.isFinite(authority) ? authority : null,
    provider_score: Number.isFinite(score) ? score : null,
    raw_id: text(item.id || item.job_id),
    metadata,
  };
}

function normalizeRows(provider, rows, metadata = {}) {
  const seen = new Set();
  const output = [];
  for (const [index, item] of (Array.isArray(rows) ? rows : []).entries()) {
    const hit = normalizeHit(provider, item, index, metadata);
    if (!hit || seen.has(hit.url)) continue;
    seen.add(hit.url);
    output.push(hit);
  }
  return output;
}

function makeProviderError(provider, status, payload) {
  const error = new Error(`${provider.toUpperCase()}_HTTP_${status}`);
  error.provider = provider;
  error.status = status;
  // Never propagate arbitrary provider error text, which may include request
  // bodies, credentials or other untrusted details.
  error.retryable = status === 408 || status === 429 || status >= 500;
  if (status === 401 || status === 403) error.code = 'PROVIDER_AUTH_REJECTED';
  else if (status === 402) error.code = 'PROVIDER_BALANCE_INSUFFICIENT';
  else if (status === 429) error.code = 'PROVIDER_RATE_LIMITED';
  else if (status >= 500) error.code = 'PROVIDER_UNAVAILABLE';
  else error.code = 'PROVIDER_REQUEST_REJECTED';
  return error;
}

async function requestJson(provider, url, init, options = {}) {
  const fetcher = options.fetcher || globalThis.fetch;
  if (typeof fetcher !== 'function') throw new Error('FETCH_UNAVAILABLE');

  const controller = new AbortController();
  const timeoutMs = boundedInt(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, 60000);
  const parentSignal = options.signal;
  const abortFromParent = () => controller.abort();

  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener?.('abort', abortFromParent, { once: true });

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Never forward bearer/API credentials across a provider redirect.
    const response = await fetcher(url, {
      ...init, redirect: 'manual', cache: 'no-store', signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const error = new Error(`${provider.toUpperCase()}_REDIRECT_BLOCKED`);
      error.provider = provider;
      error.code = 'PROVIDER_REDIRECT_BLOCKED';
      throw error;
    }

    const sizeError = () => {
      const error = new Error(`${provider.toUpperCase()}_RESPONSE_TOO_LARGE`);
      error.provider = provider;
      error.code = 'PROVIDER_RESPONSE_TOO_LARGE';
      return error;
    };
    const declared = Number(response.headers.get('content-length'));
    if (declared > MAX_RESPONSE_CHARS) throw sizeError();

    let raw = '';
    if (!response.body) {
      raw = await response.text();
      if (raw.length > MAX_RESPONSE_CHARS) throw sizeError();
    } else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > MAX_RESPONSE_CHARS) {
            await reader.cancel();
            throw sizeError();
          }
          raw += decoder.decode(part.value, { stream: true });
        }
        raw += decoder.decode();
      } catch (error) {
        if (error?.code === 'PROVIDER_RESPONSE_TOO_LARGE') throw error;
        const invalid = new Error(`${provider.toUpperCase()}_INVALID_RESPONSE_BYTES`);
        invalid.provider = provider;
        invalid.code = 'PROVIDER_INVALID_RESPONSE';
        throw invalid;
      } finally {
        reader.releaseLock();
      }
    }

    let payload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        // Non-JSON error bodies are common for gateways. Preserve the HTTP
        // status classification without echoing the raw body or credentials.
        if (!response.ok) throw makeProviderError(provider, response.status, {});
        const error = new Error(`${provider.toUpperCase()}_INVALID_JSON`);
        error.provider = provider;
        error.code = 'PROVIDER_INVALID_RESPONSE';
        throw error;
      }
    }

    if (!response.ok) throw makeProviderError(provider, response.status, payload);
    return payload;
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      const timeout = new Error(`${provider.toUpperCase()}_TIMEOUT`);
      timeout.provider = provider;
      timeout.code = 'PROVIDER_TIMEOUT';
      timeout.retryable = true;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener?.('abort', abortFromParent);
  }
}

function requireKey(apiKey, provider) {
  const key = text(apiKey);
  if (!key) {
    const error = new Error(`${provider.toUpperCase()}_KEY_MISSING`);
    error.provider = provider;
    error.code = 'PROVIDER_KEY_MISSING';
    throw error;
  }
  return key;
}

function resultEnvelope(provider, query, payload, rows, startedAt, usage = null) {
  return {
    provider,
    query,
    request_id: text(payload?.request_id || payload?.requestId),
    results: rows,
    usage: usage || payload?.usage || null,
    latency_ms: Math.max(0, Date.now() - startedAt),
    raw_result_count: Array.isArray(rows) ? rows.length : 0,
  };
}

export async function searchBaiduAgentic(query, options = {}) {
  const provider = 'baidu_agentic';
  const apiKey = requireKey(options.apiKey, provider);
  const normalizedQuery = limitBaiduQuery(query);
  if (!normalizedQuery) throw new Error('SEARCH_QUERY_EMPTY');

  const startedAt = Date.now();
  const payload = await requestJson(
    provider,
    'https://qianfan.baidubce.com/v2/ai_search/agentic_search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        count: boundedInt(options.count, 50, 1, 50),
        freshness: text(options.freshness) || 'no_limit',
        ...(Array.isArray(options.include) && options.include.length
          ? { include: options.include.slice(0, 100).map(text).filter(Boolean) }
          : {}),
        ...(Array.isArray(options.exclude) && options.exclude.length
          ? { exclude: options.exclude.slice(0, 150).map(text).filter(Boolean) }
          : {}),
      }),
    },
    options,
  );

  const rows = payload?.web_page_result?.web_pages ||
    payload?.data?.web_page_result?.web_pages ||
    payload?.web_pages ||
    [];
  return resultEnvelope(
    provider,
    normalizedQuery,
    payload,
    normalizeRows(provider, rows),
    startedAt,
  );
}

export async function searchBaiduWeb(query, options = {}) {
  const provider = 'baidu_web';
  const apiKey = requireKey(options.apiKey, provider);
  const normalizedQuery = limitBaiduQuery(query);
  if (!normalizedQuery) throw new Error('SEARCH_QUERY_EMPTY');

  const count = boundedInt(options.count, 50, 1, 50);
  const searchFilter = {};
  const includeSites = Array.isArray(options.includeSites)
    ? options.includeSites.map(text).filter(Boolean).slice(0, 100)
    : [];
  const excludeSites = Array.isArray(options.excludeSites)
    ? options.excludeSites.map(text).filter(Boolean).slice(0, 150)
    : [];

  if (includeSites.length) searchFilter.match = { site: includeSites };
  if (excludeSites.length) searchFilter.block_websites = excludeSites;

  if (options.startDate && options.endDate) {
    searchFilter.range = {
      page_time: {
        gte: text(options.startDate),
        lte: text(options.endDate),
      },
    };
  }

  if (options.city) searchFilter.geo = { city: [text(options.city)] };

  const body = {
    messages: [{ role: 'user', content: normalizedQuery }],
    search_source: 'baidu_search_v2',
    edition: text(options.edition) || 'pro',
    resource_type_filter: [{ type: 'web', top_k: count }],
    query_policy: {
      enable_rewrite: options.enableRewrite !== false,
      ...(options.deep === false ? {} : { query_plan_type: 'deep' }),
    },
    ...(Object.keys(searchFilter).length ? { search_filter: searchFilter } : {}),
    ...(text(options.recency) ? { search_recency_filter: text(options.recency) } : {}),
  };

  const startedAt = Date.now();
  const payload = await requestJson(
    provider,
    'https://qianfan.baidubce.com/v2/ai_search/web_search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    options,
  );

  const rows = payload?.references || payload?.data?.references || [];
  return resultEnvelope(
    provider,
    normalizedQuery,
    payload,
    normalizeRows(provider, rows),
    startedAt,
  );
}

export async function searchDeepSeek(query, options = {}) {
  const provider = 'deepseek';
  const apiKey = requireKey(options.apiKey, provider);
  const normalizedQuery = text(query).slice(0, 128);
  if (!normalizedQuery) throw new Error('SEARCH_QUERY_EMPTY');

  const startedAt = Date.now();
  const payload = await requestJson(
    provider,
    'https://api.deepseek.com/v1/tools/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        count: boundedInt(options.count, 50, 1, 50),
        need_content: options.needContent !== false,
        ...(text(options.originalQuestion)
          ? { ori_question: text(options.originalQuestion).slice(0, 128) }
          : {}),
      }),
    },
    options,
  );

  return resultEnvelope(
    provider,
    normalizedQuery,
    payload,
    normalizeRows(provider, payload?.results || payload?.data?.results || []),
    startedAt,
  );
}

export async function searchBraveContext(query, options = {}) {
  const provider = 'brave_context';
  const apiKey = requireKey(options.apiKey, provider);
  const normalizedQuery = text(query).slice(0, 600);
  if (!normalizedQuery) throw new Error('SEARCH_QUERY_EMPTY');

  const url = new URL('https://api.search.brave.com/res/v1/llm/context');
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('count', String(boundedInt(options.count, 50, 1, 50)));
  url.searchParams.set('maximum_number_of_urls', String(boundedInt(options.maxUrls, 50, 1, 50)));
  url.searchParams.set('maximum_number_of_tokens', String(boundedInt(options.maxTokens, 8192, 1024, 32768)));
  url.searchParams.set('enable_source_metadata', 'true');
  url.searchParams.set('country', text(options.country) || 'CN');
  url.searchParams.set('search_lang', text(options.searchLang) || 'zh');
  if (text(options.contextThresholdMode)) {
    url.searchParams.set('context_threshold_mode', text(options.contextThresholdMode));
  }
  if (options.freshness) url.searchParams.set('freshness', text(options.freshness));

  const startedAt = Date.now();
  const payload = await requestJson(
    provider,
    url.toString(),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    },
    options,
  );

  const sources = payload?.sources || {};
  const rows = (payload?.grounding?.generic || []).map(item => {
    const source = sources[item?.url] || {};
    return {
      ...item,
      source_name: source.site_name || source.name || source.hostname || '',
      date: source.published_at || source.last_fetched_at || '',
      content: Array.isArray(item?.snippets) ? item.snippets.join('\n') : '',
    };
  });

  return resultEnvelope(
    provider,
    normalizedQuery,
    payload,
    normalizeRows(provider, rows),
    startedAt,
  );
}

export async function searchExa(query, options = {}) {
  const provider = 'exa';
  const apiKey = requireKey(options.apiKey, provider);
  const normalizedQuery = text(query).slice(0, 2000);
  if (!normalizedQuery) throw new Error('SEARCH_QUERY_EMPTY');

  const startedAt = Date.now();
  const payload = await requestJson(
    provider,
    'https://api.exa.ai/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        numResults: boundedInt(options.count, 20, 1, 100),
        contents: { highlights: true },
      }),
    },
    options,
  );

  return resultEnvelope(
    provider,
    normalizedQuery,
    payload,
    normalizeRows(provider, payload?.results || []),
    startedAt,
  );
}

export async function searchTavily(query, options = {}) {
  const provider = 'tavily';
  const apiKey = requireKey(options.apiKey, provider);
  const normalizedQuery = text(query).slice(0, 2000);
  if (!normalizedQuery) throw new Error('SEARCH_QUERY_EMPTY');

  const startedAt = Date.now();
  const payload = await requestJson(
    provider,
    'https://api.tavily.com/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        search_depth: options.searchDepth === 'basic' ? 'basic' : 'advanced',
        max_results: boundedInt(options.count, 20, 1, 20),
        include_raw_content: options.includeRawContent !== false,
        include_published_date: true,
        include_usage: true,
        country: text(options.country) || 'china',
        language: text(options.language) || 'zh-cn',
        filter_by_language: false,
        ...(Array.isArray(options.excludeDomains) && options.excludeDomains.length
          ? { exclude_domains: options.excludeDomains.slice(0, 150).map(text).filter(Boolean) }
          : {}),
      }),
    },
    options,
  );

  return resultEnvelope(
    provider,
    normalizedQuery,
    payload,
    normalizeRows(provider, payload?.results || []),
    startedAt,
    payload?.usage || null,
  );
}

export async function searchFirecrawl(query, options = {}) {
  const provider = 'firecrawl';
  const apiKey = requireKey(options.apiKey, provider);
  const normalizedQuery = text(query).slice(0, 2000);
  if (!normalizedQuery) throw new Error('SEARCH_QUERY_EMPTY');

  const startedAt = Date.now();
  const payload = await requestJson(
    provider,
    'https://api.firecrawl.dev/v2/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        limit: boundedInt(options.count, 20, 1, 20),
        scrapeOptions: { formats: ['markdown'] },
      }),
    },
    options,
  );

  const rows = payload?.data?.web || payload?.data?.results || payload?.web || [];
  return resultEnvelope(
    provider,
    normalizedQuery,
    payload,
    normalizeRows(provider, rows),
    startedAt,
    payload?.data?.usage || payload?.usage || null,
  );
}

const PROVIDER_FUNCTIONS = Object.freeze({
  baidu_agentic: searchBaiduAgentic,
  baidu_web: searchBaiduWeb,
  deepseek: searchDeepSeek,
  brave_context: searchBraveContext,
  exa: searchExa,
  tavily: searchTavily,
  firecrawl: searchFirecrawl,
});

export function mergeSearchProviderResults(providerResults = []) {
  const merged = [];
  const byUrl = new Map();

  for (const providerResult of providerResults) {
    for (const hit of providerResult?.results || []) {
      const key = safeHttpUrl(hit.url);
      if (!key) continue;
      const existing = byUrl.get(key);
      if (existing) {
        if (!existing.providers.includes(hit.provider)) existing.providers.push(hit.provider);
        if (!existing.title && hit.title) existing.title = hit.title;
        if (!existing.source_name && hit.source_name) existing.source_name = hit.source_name;
        if ((!existing.content || existing.content.length < hit.content.length) && hit.content) {
          existing.content = hit.content;
        }
        if ((!existing.snippet || existing.snippet.length < hit.snippet.length) && hit.snippet) {
          existing.snippet = hit.snippet;
        }
        if (existing.authority_score === null && hit.authority_score !== null) {
          existing.authority_score = hit.authority_score;
        }
        if (existing.published_at === '' && hit.published_at) existing.published_at = hit.published_at;
        continue;
      }

      const copy = {
        ...hit,
        url: key,
        providers: [hit.provider],
      };
      byUrl.set(key, copy);
      merged.push(copy);
    }
  }

  return merged;
}

/**
 * Executes enabled providers concurrently. A failed provider never discards
 * successful results from the other providers.
 *
 * configs = {
 *   deepseek: { apiKey: '...', options: { count: 50 } },
 *   baidu_agentic: { apiKey: '...', options: {} }
 * }
 */
export async function searchAcrossProviders(query, configs = {}, options = {}) {
  const normalizedQuery = text(query);
  if (!normalizedQuery) throw new Error('SEARCH_QUERY_EMPTY');

  const requested = Array.isArray(options.providers) && options.providers.length
    ? options.providers
    : Object.keys(PROVIDER_FUNCTIONS);

  const tasks = requested.map(async provider => {
    const search = PROVIDER_FUNCTIONS[provider];
    if (!search) {
      return { provider, status: 'unsupported', results: [], error_code: 'PROVIDER_UNSUPPORTED' };
    }

    const config = configs[provider] || {};
    if (!text(config.apiKey)) {
      return { provider, status: 'skipped', results: [], error_code: 'PROVIDER_KEY_MISSING' };
    }

    const startedAt = Date.now();
    try {
      const result = await search(normalizedQuery, {
        ...options,
        ...(config.options || {}),
        apiKey: config.apiKey,
        fetcher: options.fetcher || config.fetcher,
      });
      return {
        ...result,
        status: 'success',
        latency_ms: Math.max(0, Date.now() - startedAt),
      };
    } catch (error) {
      return {
        provider,
        status: 'error',
        results: [],
        latency_ms: Math.max(0, Date.now() - startedAt),
        error_code: text(error?.code) || 'PROVIDER_UNKNOWN_ERROR',
        retryable: Boolean(error?.retryable),
      };
    }
  });

  const providers = await Promise.all(tasks);
  const successful = providers.filter(item => item.status === 'success');
  const results = mergeSearchProviderResults(successful);

  return {
    query: normalizedQuery,
    providers,
    results,
    diagnostics: {
      provider_count: requested.length,
      successful_provider_count: successful.length,
      failed_provider_count: providers.filter(item => item.status === 'error').length,
      skipped_provider_count: providers.filter(item => item.status === 'skipped').length,
      raw_hit_count: successful.reduce((sum, item) => sum + item.results.length, 0),
      unique_hit_count: results.length,
    },
  };
}
