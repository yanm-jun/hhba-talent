import http from 'node:http';
import { buildSnapshot, searchSnapshot } from './contract.mjs';

const PREFIX = '/recruitment/api/v2';
const ALLOWED_HOSTS = new Set([
  'hhba-web-production-024c.up.railway.app',
  'hhba-live-jobs-preview-production.up.railway.app',
]);

export function upstreamUrl(value) {
  if (!value) return null;
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password ||
      parsed.search || parsed.hash || parsed.pathname !== '/' || !ALLOWED_HOSTS.has(parsed.hostname))
    throw new Error('Only explicitly reviewed HHBA read-only ATS upstreams are allowed');
  return parsed.origin;
}

export async function fetchAtsSnapshot(origin, { fetchImpl = fetch, limit = 100, maxPages = 200 } = {}) {
  if (!origin) throw new Error('ATS upstream not configured');
  const all = [];
  let total = null, updated = null, boards = null, failures = null;
  for (let page = 0; page < maxPages; page++) {
    const u = new URL('/api/jobs/page', origin);
    u.searchParams.set('limit', String(limit));
    u.searchParams.set('offset', String(all.length));
    const reply = await fetchImpl(u, { method: 'GET', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000), credentials: 'omit' });
    if (!reply.ok) throw new Error(`ATS upstream request failed (${reply.status})`);
    const body = await reply.json();
    const jobs = body.jobs;
    if (!Array.isArray(jobs) || !Number.isInteger(body.total) || body.total < 0 ||
        !Number.isInteger(body.boards) || !Number.isInteger(body.failures) ||
        typeof body.updated !== 'string') throw new Error('Malformed ATS page');
    if (total !== null && (total !== body.total || updated !== body.updated || boards !== body.boards || failures !== body.failures))
      throw new Error('ATS source changed during pagination');
    total = body.total; updated = body.updated; boards = body.boards; failures = body.failures;
    if (jobs.length > limit || (jobs.length === 0 && all.length < total)) throw new Error('Invalid ATS paging');
    all.push(...jobs);
    if (all.length === total) return { jobs: all, total, updated, boards, failures };
  }
  throw new Error('ATS snapshot incomplete; no partial publication');
}

export function createGateway({ source, now = () => Date.now() }) {
  let current = null, error = 'NOT_INITIALIZED';
  let updating = null;
  async function refresh() {
    if (updating) return updating;
    updating = (async () => {
      try {
        const candidate = buildSnapshot(await source(), { now: now() });
        current = candidate; error = null; return candidate;
      } catch (e) {
        error = e instanceof Error ? e.message : 'SYNC_FAILED';
        current = null;
        throw e;
      } finally { updating = null; }
    })();
    return updating;
  }
  function status() {
    return { ok: Boolean(current), read_only: true, fresh_only: true,
      as_of: current?.as_of || null, total: current?.items.length ?? 0,
      source_health: current?.source_health || null, error };
  }
  function resolve(id, legacySystem = 'green_market') {
    if (!current) return null;
    return current.byId.get(id) || current.byId.get(current.aliases.get(`${legacySystem}:${id}`)) || null;
  }
  function handle(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (code, value) => { res.writeHead(code); res.end(JSON.stringify(value)); };
    if (req.method !== 'GET') return send(405, { error: 'method_not_allowed' });
    const u = new URL(req.url || '/', 'http://localhost');
    if (u.pathname === PREFIX + '/health') return send(current ? 200 : 503, status());
    if (!u.pathname.startsWith(PREFIX + '/')) return send(404, { error: 'not_found' });
    if (!current) return send(503, { error: 'fresh_verified_snapshot_unavailable' });
    if (now() - Date.parse(current.as_of) > 24 * 60 * 60 * 1000) {
      current = null; error = 'SNAPSHOT_EXPIRED';
      return send(503, { error: 'fresh_verified_snapshot_unavailable' });
    }
    if (u.pathname === PREFIX + '/jobs') {
      try { return send(200, searchSnapshot(current, Object.fromEntries(u.searchParams))); }
      catch { return send(400, { error: 'invalid_filters' }); }
    }
    const matched = u.pathname.match(/^\/recruitment\/api\/v2\/jobs\/(J_[0-9a-f]{32}|[A-Za-z0-9_-]{1,180})(\/sources)?$/);
    if (!matched) return send(404, { error: 'not_found' });
    const job = resolve(matched[1]);
    if (!job) return send(404, { error: 'job_not_found_or_unverified' });
    if (matched[2]) return send(200, { job_id: job.job_id, source: job.source,
      availability: job.availability, legacy_ids: job.legacy_ids });
    return send(200, job);
  }
  return { refresh, status, resolve, handle, createServer: () => http.createServer(handle) };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const origin = upstreamUrl(process.env.HHBA_ATS_UPSTREAM_URL || '');
  const gateway = createGateway({ source: () => fetchAtsSnapshot(origin) });
  const server = gateway.createServer();
  server.listen(Number(process.env.PORT || 8789), '127.0.0.1', () => {
    gateway.refresh().catch(e => console.error('P2_STAGING_REFRESH_FAILED', e.message));
    setInterval(() => gateway.refresh().catch(e => console.error('P2_STAGING_REFRESH_FAILED', e.message)), 15 * 60_000).unref();
    console.log('HHBA_P2_READONLY_STAGING_READY');
  });
}
