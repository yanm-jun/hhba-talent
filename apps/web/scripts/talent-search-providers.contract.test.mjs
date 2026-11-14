import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchBaiduAgentic,
  searchBaiduWeb,
  searchDeepSeek,
  searchBraveContext,
  searchExa,
  searchTavily,
  searchFirecrawl,
  searchAcrossProviders,
  mergeSearchProviderResults,
} from '../functions/_lib/talent-search-providers.js';

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('Baidu Agentic Search sends query-only payload and normalizes official page evidence', async () => {
  let call;
  const result = await searchBaiduAgentic('上海 区域督导 官方招聘', {
    apiKey: 'synthetic-secret-not-real',
    count: 50,
    include: ['careers.example.cn'],
    fetcher: async (url, options) => {
      call = { url, headers: options.headers, body: JSON.parse(options.body) };
      return jsonResponse({
        request_id: 'baidu-agentic-1',
        web_page_result: {
          web_pages: [{
            title: '区域督导招聘',
            url: 'https://careers.example.cn/jobs/region-supervisor',
            snippet: '负责区域门店运营、巡店和培训。',
            content: '岗位详情：负责区域门店运营、巡店和培训。',
            publish_date: '2026-11-10',
            website: '示例企业招聘',
            authority_score: 0.94,
          }],
        },
      });
    },
  });

  assert.equal(call.url, 'https://qianfan.baidubce.com/v2/ai_search/agentic_search');
  assert.equal(call.headers.Authorization, 'Bearer synthetic-secret-not-real');
  assert.equal(call.body.query, '上海 区域督导 官方招聘');
  assert.equal(call.body.count, 50);
  assert.deepEqual(call.body.include, ['careers.example.cn']);
  assert.equal('resume' in call.body, false);
  assert.equal(result.request_id, 'baidu-agentic-1');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].authority_score, 0.94);
  assert.match(result.results[0].content, /巡店和培训/);
});

test('Baidu Search v2 enables Pro deep query planning and supports official-site filters', async () => {
  let body;
  const result = await searchBaiduWeb('品牌督导 社会招聘 上海', {
    apiKey: 'synthetic-secret-not-real',
    includeSites: ['careers.example.cn', 'jobs.example.com'],
    excludeSites: ['zhipin.com'],
    startDate: '2026-10-01',
    endDate: '2026-11-15',
    city: '上海',
    fetcher: async (url, options) => {
      assert.equal(url, 'https://qianfan.baidubce.com/v2/ai_search/web_search');
      body = JSON.parse(options.body);
      return jsonResponse({
        request_id: 'baidu-web-1',
        references: [{
          id: 1,
          title: '品牌督导',
          url: 'https://careers.example.cn/jobs/brand-supervisor',
          snippet: '品牌督导招聘岗位详情',
          content: '负责品牌终端运营和经销商培训。',
          date: '2026-11-12',
          authority_score: 0.9,
          rerank_score: 0.88,
        }],
      });
    },
  });

  assert.equal(body.search_source, 'baidu_search_v2');
  assert.equal(body.edition, 'pro');
  assert.deepEqual(body.query_policy, { enable_rewrite: true, query_plan_type: 'deep' });
  assert.equal(body.resource_type_filter[0].top_k, 50);
  assert.deepEqual(body.search_filter.match.site, ['careers.example.cn', 'jobs.example.com']);
  assert.deepEqual(body.search_filter.block_websites, ['zhipin.com']);
  assert.deepEqual(body.search_filter.geo.city, ['上海']);
  assert.equal(result.results[0].provider_score, 0.88);
  assert.equal(result.results[0].authority_score, 0.9);
});

test('DeepSeek Search adapter uses the full 50-result range and requests page content', async () => {
  let body;
  const result = await searchDeepSeek('全国渠道运营经理 官方招聘', {
    apiKey: 'synthetic-secret-not-real',
    count: 50,
    needContent: true,
    originalQuestion: '寻找中国大陆真实官方招聘岗位',
    fetcher: async (url, options) => {
      assert.equal(url, 'https://api.deepseek.com/v1/tools/search');
      body = JSON.parse(options.body);
      return jsonResponse({
        request_id: 'deepseek-search-1',
        results: [{
          title: '渠道运营经理',
          url: 'https://jobs.example.cn/openings/channel-manager',
          summary: '负责渠道运营管理。',
          content: '职位详情：渠道规划、经销商运营、数据分析。',
          authority: 4,
          rerank_score: 2.4,
        }],
      });
    },
  });

  assert.equal(body.count, 50);
  assert.equal(body.need_content, true);
  assert.equal(body.ori_question, '寻找中国大陆真实官方招聘岗位');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].authority_score, 4);
  assert.match(result.results[0].content, /经销商运营/);
});

test('Brave LLM Context requests Chinese mainland context and parses grounded sources', async () => {
  let requestUrl;
  const result = await searchBraveContext('中国大陆 区域运营 招聘 官网', {
    apiKey: 'synthetic-secret-not-real',
    fetcher: async (url, options) => {
      requestUrl = new URL(url);
      assert.equal(options.headers['X-Subscription-Token'], 'synthetic-secret-not-real');
      return jsonResponse({
        grounding: {
          generic: [{
            url: 'https://careers.example.cn/jobs/area-operations',
            title: '区域运营招聘',
            snippets: ['岗位职责：区域运营管理。', '任职要求：渠道和团队管理经验。'],
          }],
        },
        sources: {
          'https://careers.example.cn/jobs/area-operations': {
            site_name: '示例企业招聘',
            hostname: 'careers.example.cn',
            fetched_content_timestamp: '2026-11-15T00:00:00Z',
          },
        },
      });
    },
  });

  assert.equal(requestUrl.searchParams.get('country'), 'CN');
  assert.equal(requestUrl.searchParams.get('search_lang'), 'zh');
  assert.equal(requestUrl.searchParams.get('count'), '50');
  assert.equal(requestUrl.searchParams.get('maximum_number_of_urls'), '50');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].source_name, '示例企业招聘');
  assert.match(result.results[0].content, /渠道和团队管理经验/);
});

test('Exa Search normalizes semantic-search results and highlights', async () => {
  let body;
  const result = await searchExa('跨行业可迁移的区域运营管理岗位', {
    apiKey: 'synthetic-secret-not-real',
    count: 30,
    fetcher: async (url, options) => {
      assert.equal(url, 'https://api.exa.ai/search');
      body = JSON.parse(options.body);
      return jsonResponse({
        requestId: 'exa-search-1',
        results: [{
          title: '全国区域运营经理',
          url: 'https://careers.example.cn/jobs/national-operations',
          highlights: ['负责区域运营体系搭建与团队赋能。'],
          publishedDate: '2026-11-01',
          score: 0.91,
        }],
      });
    },
  });

  assert.equal(body.numResults, 30);
  assert.equal(body.contents.highlights, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].provider_score, 0.91);
  assert.match(result.results[0].content, /团队赋能/);
});

test('Tavily advanced search requests China/Chinese results and returns credit usage', async () => {
  let body;
  const result = await searchTavily('上海 品牌督导 企业官网招聘', {
    apiKey: 'synthetic-secret-not-real',
    fetcher: async (url, options) => {
      assert.equal(url, 'https://api.tavily.com/search');
      body = JSON.parse(options.body);
      return jsonResponse({
        request_id: 'tavily-1',
        usage: { credits: 2 },
        results: [{
          title: '品牌督导招聘',
          url: 'https://careers.example.cn/jobs/brand-supervisor',
          content: '负责品牌终端运营、渠道巡店与培训。',
          raw_content: '完整职位描述。',
          published_date: '2026-11-05',
          score: 0.87,
        }],
      });
    },
  });

  assert.equal(body.search_depth, 'advanced');
  assert.equal(body.max_results, 20);
  assert.equal(body.country, 'china');
  assert.equal(body.language, 'zh-cn');
  assert.equal(body.include_raw_content, true);
  assert.deepEqual(result.usage, { credits: 2 });
  assert.equal(result.results.length, 1);
  assert.match(result.results[0].content, /渠道巡店/);
});

test('Firecrawl search requests markdown extraction and normalizes web results', async () => {
  let body;
  const result = await searchFirecrawl('全国连锁运营督导招聘 官网', {
    apiKey: 'synthetic-secret-not-real',
    fetcher: async (url, options) => {
      assert.equal(url, 'https://api.firecrawl.dev/v2/search');
      body = JSON.parse(options.body);
      return jsonResponse({
        success: true,
        data: {
          web: [{
            title: '连锁运营督导',
            url: 'https://careers.example.cn/jobs/retail-operations',
            description: '负责连锁门店运营和督导。',
            markdown: '岗位详情：负责门店运营、巡店、培训与整改。',
          }],
        },
      });
    },
  });

  assert.equal(body.limit, 20);
  assert.deepEqual(body.scrapeOptions.formats, ['markdown']);
  assert.equal(result.results.length, 1);
  assert.match(result.results[0].content, /巡店、培训与整改/);
});

test('provider merge deduplicates canonical URLs but retains all provider provenance', () => {
  const merged = mergeSearchProviderResults([
    {
      provider: 'deepseek',
      results: [{
        provider: 'deepseek',
        url: 'https://careers.example.cn/jobs/one?utm_source=deepseek#apply',
        title: '区域督导',
        snippet: '负责区域运营。',
        content: '区域督导详情。',
        authority_score: null,
        published_at: '',
      }],
    },
    {
      provider: 'baidu_agentic',
      results: [{
        provider: 'baidu_agentic',
        url: 'https://careers.example.cn/jobs/one?utm_source=baidu',
        title: '区域督导招聘',
        snippet: '岗位职责包括门店运营。',
        content: '更完整的区域督导职位详情。',
        authority_score: 0.92,
        published_at: '2026-11-10',
      }],
    },
  ]);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].providers, ['deepseek', 'baidu_agentic']);
  assert.equal(merged[0].authority_score, 0.92);
  assert.match(merged[0].content, /更完整/);
  assert.equal(merged[0].url, 'https://careers.example.cn/jobs/one');
});

test('multi-provider search isolates provider failures and skips providers without keys', async () => {
  const result = await searchAcrossProviders(
    '中国大陆区域运营招聘官网',
    {
      deepseek: { apiKey: 'synthetic-secret-not-real' },
      tavily: { apiKey: 'synthetic-secret-not-real' },
    },
    {
      providers: ['deepseek', 'brave_context', 'tavily'],
      fetcher: async (url, options) => {
        if (url === 'https://api.deepseek.com/v1/tools/search') {
          return jsonResponse({
            results: [{
              title: '区域运营',
              url: 'https://careers.example.cn/jobs/region-ops',
              summary: '官方岗位详情',
            }],
          });
        }
        if (url === 'https://api.tavily.com/search') return jsonResponse({ error: { code: 'UPSTREAM' } }, 503);
        throw new Error('unexpected provider URL');
      },
    },
  );

  assert.equal(result.providers.length, 3);
  assert.equal(result.providers.find(item => item.provider === 'deepseek').status, 'success');
  assert.equal(result.providers.find(item => item.provider === 'brave_context').status, 'skipped');
  assert.equal(result.providers.find(item => item.provider === 'tavily').status, 'error');
  assert.equal(result.providers.find(item => item.provider === 'tavily').error_code, 'PROVIDER_UNAVAILABLE');
  assert.equal(result.results.length, 1);
  assert.equal(result.diagnostics.successful_provider_count, 1);
  assert.equal(result.diagnostics.failed_provider_count, 1);
  assert.equal(result.diagnostics.skipped_provider_count, 1);
});

test('untrusted or local-network URLs are rejected before they enter the result pool', async () => {
  const result = await searchDeepSeek('测试招聘岗位', {
    apiKey: 'synthetic-secret-not-real',
    fetcher: async () => jsonResponse({
      results: [
        { title: 'bad scheme', url: 'javascript:alert(1)' },
        { title: 'localhost', url: 'http://127.0.0.1/internal' },
        { title: 'local host', url: 'https://localhost/private' },
        { title: 'valid', url: 'https://careers.example.cn/jobs/valid' },
      ],
    }),
  });

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].url, 'https://careers.example.cn/jobs/valid');
});

test('missing credentials fail closed and do not make an outbound request', async () => {
  let calls = 0;
  await assert.rejects(
    searchBaiduAgentic('岗位招聘', {
      fetcher: async () => {
        calls++;
        return jsonResponse({});
      },
    }),
    /BAIDU_AGENTIC_KEY_MISSING/,
  );
  assert.equal(calls, 0);
});

test('provider errors never echo API credentials or raw response bodies', async () => {
  await assert.rejects(
    searchDeepSeek('岗位招聘', {
      apiKey: 'synthetic-secret-not-real',
      fetcher: async () => new Response(
        'Authorization: Bearer synthetic-secret-not-real',
        { status: 401 },
      ),
    }),
    error => {
      assert.equal(error.code, 'PROVIDER_AUTH_REJECTED');
      assert.doesNotMatch(error.message, /synthetic-secret-not-real/);
      return true;
    },
  );
});
