import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatedPublicPageUrl,
  readPublicEmployerPage,
} from '../functions/_lib/talent-search-page-reader.js';

const domain = 'careers.samplecorp.example.cn';
const allowHosts = [domain];
const jobUrl = 'https://' + domain + '/jobs/region-supervisor-2026';
const html = [
  '<!doctype html><html><head><title>岗位详情</title>',
  '<style>.hidden{display:none}</style>',
  '<script>ignore_this_script_and_never_execute()</script></head><body>',
  '<h1>区域运营督导</h1>',
  '<p>工作地点：上海 &amp; 苏州</p>',
  '<section>岗位职责：负责多家门店的运营管理、经营数据复盘、销售顾问培训与整改跟进。</section>',
  '<section>任职要求：具有区域运营经验，能够推动跨部门协作并制定经营改善方案。</section>',
  '<a href="https://jobs.ashbyhq.com/samplecorp">企业官方 ATS</a>',
  '<a href="/jobs/other-role-2026">另一个岗位</a>',
  '</body></html>',
].join('');

function response(body = html, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}

test('reads bounded static HTML from an explicitly allowed employer host', async () => {
  const requests = [];
  const out = await readPublicEmployerPage(jobUrl, {
    allowHosts,
    now: new Date('2026-11-15T02:00:00Z'),
    fetcher: async (url, options) => {
      requests.push({ url, options });
      return response();
    },
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, 'manual');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.equal(out.url, jobUrl);
  assert.equal(out.status, 200);
  assert.equal(out.fetched_at, '2026-11-15T02:00:00.000Z');
  assert.match(out.text, /区域运营督导/);
  assert.match(out.text, /上海 & 苏州/);
  assert.match(out.text, /任职要求/);
  assert.doesNotMatch(out.text, /ignore_this_script/);
  assert.ok(out.links.some(item => item.href === 'https://jobs.ashbyhq.com/samplecorp'));
  assert.ok(out.links.some(item => item.href === 'https://' + domain + '/jobs/other-role-2026'));
});

test('strict allowHosts prevents private IPs, local sites, malicious lookalikes and non-HTTPS URLs', () => {
  for (const bad of [
    'http://' + domain + '/jobs/123',
    'https://127.0.0.1/private',
    'https://10.0.0.4/private',
    'https://localhost/private',
    'https://' + domain + '.attacker.example/jobs/123',
    'https://foo.internal/jobs/123',
    'https://' + domain + ':8443/jobs/123',
    'https://user:pass@' + domain + '/jobs/123',
    'javascript:alert(1)',
  ]) assert.equal(validatedPublicPageUrl(bad, allowHosts), null, bad);
  assert.equal(validatedPublicPageUrl(jobUrl, []), null);
  assert.equal(validatedPublicPageUrl(jobUrl, allowHosts).href, jobUrl);
});

test('an unallowed URL is rejected before any outbound request', async () => {
  let called = false;
  await assert.rejects(
    readPublicEmployerPage('https://www.zhipin.com/job_detail/123.html', {
      allowHosts,
      fetcher: async () => { called = true; return response(); },
    }),
    error => error.code === 'JOB_PAGE_URL_NOT_ALLOWED',
  );
  assert.equal(called, false);
});

test('redirects to private or unallowed domains are blocked without following them', async () => {
  let called = 0;
  await assert.rejects(
    readPublicEmployerPage(jobUrl, {
      allowHosts,
      fetcher: async () => {
        called++;
        return response('', 302, { Location: 'http://169.254.169.254/metadata' });
      },
    }),
    error => error.code === 'JOB_PAGE_REDIRECT_NOT_ALLOWED',
  );
  assert.equal(called, 1);
});

test('a same-host canonical HTTPS redirect is followed within a strict hop budget', async () => {
  const redirected = 'https://' + domain + '/jobs/canonical-001';
  const calls = [];
  const out = await readPublicEmployerPage(jobUrl, {
    allowHosts,
    fetcher: async url => {
      calls.push(url);
      return calls.length === 1
        ? response('', 302, { Location: '/jobs/canonical-001' })
        : response();
    },
  });
  assert.deepEqual(calls, [jobUrl, redirected]);
  assert.equal(out.url, redirected);
});

test('content type and oversized responses fail closed', async () => {
  await assert.rejects(
    readPublicEmployerPage(jobUrl, {
      allowHosts, fetcher: async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    }),
    error => error.code === 'JOB_PAGE_CONTENT_TYPE_NOT_SUPPORTED',
  );
  await assert.rejects(
    readPublicEmployerPage(jobUrl, {
      allowHosts,
      maxBytes: 1024,
      fetcher: async () => response('x'.repeat(2000), 200, { 'Content-Length': '2000' }),
    }),
    error => error.code === 'JOB_PAGE_RESPONSE_TOO_LARGE',
  );
  await assert.rejects(
    readPublicEmployerPage(jobUrl, {
      allowHosts,
      maxBytes: 1024,
      fetcher: async () => response('x'.repeat(2000), 200),
    }),
    error => error.code === 'JOB_PAGE_RESPONSE_TOO_LARGE',
  );
});

test('rejects malformed UTF-8 rather than inventing extracted job text', async () => {
  const badBytes = new Uint8Array([0xc3, 0x28, 0x41]);
  await assert.rejects(
    readPublicEmployerPage(jobUrl, {
      allowHosts,
      fetcher: async () => response(badBytes),
    }),
    error => error.code === 'JOB_PAGE_INVALID_ENCODING',
  );
});

test('a failed fetch does not claim a current job exists', async () => {
  await assert.rejects(
    readPublicEmployerPage(jobUrl, {
      allowHosts,
      fetcher: async () => response('<p>not found</p>', 404),
    }),
    error => error.code === 'JOB_PAGE_HTTP_ERROR',
  );
});

test('supports a page containing CJK text and HTML numeric entities', async () => {
  const out = await readPublicEmployerPage(jobUrl, {
    allowHosts,
    fetcher: async () => response('<main><h1>&#x533A;&#x57DF;督导</h1><p>上海</p></main>'),
  });
  assert.match(out.text, /区域督导/);
});
