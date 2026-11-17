/** HHBA Cloudflare Browser Run synthetic-only smoke client; NOT a production task runner. */
const TEST_MARKER = 'HHBA 测试招聘网申（虚构）';
const FIXTURE_VALUES = Object.freeze({
  fullName: '测试用户', mobile: '13800000000', email: 'demo@example.org',
  school: '示例大学', major: '计算机科学', degree: '本科'
});

function fixtureOnly(html) {
  if (typeof html !== 'string' || !html.includes(TEST_MARKER) || html.length > 15000)
    throw new Error('Only the small, explicit HHBA synthetic fixture is permitted');
  return html;
}
function safeSessionId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{24,64}$/i.test(id))
    throw new Error('Invalid browser session ID');
  return id;
}
function syntheticFill(values) {
  let written = 0;
  for (const input of document.querySelectorAll('#apply input')) {
    if (!Object.hasOwn(values, input.name)) continue;
    if (!['text', 'email', 'tel'].includes(input.type) || input.disabled || input.readOnly || input.value) continue;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!set) continue;
    set.call(input, values[input.name]);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (input.value === values[input.name]) written++;
  }
  document.documentElement.setAttribute('data-hhba-cloud-writes', String(written));
  document.documentElement.setAttribute('data-hhba-cloud-submitted', String(document.querySelector('#submission')?.textContent !== '未提交'));
  document.documentElement.setAttribute('data-hhba-cloud-manual', String([...document.querySelectorAll('#apply input')].filter(x => !Object.hasOwn(values, x.name)).length));
}
function buildSyntheticFillScript() {
  return '(' + syntheticFill.toString() + ')(' + JSON.stringify(FIXTURE_VALUES) + ')';
}
export function createBrowserRunClient({accountId, apiToken, fetchImpl = globalThis.fetch}) {
  if (!/^[0-9a-f]{32}$/i.test(accountId || '')) throw new Error('Invalid Cloudflare account ID');
  if (typeof apiToken !== 'string' || apiToken.trim().length < 10) throw new Error('Missing Browser Run API token');
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required');
  const root = 'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/browser-rendering';
  async function request(method, path, {query, body} = {}) {
    const url = new URL(root + path);
    for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, String(value));
    const response = await fetchImpl(url.toString(), {
      method,
      headers: {Authorization: 'Bearer ' + apiToken, ...(body ? {'Content-Type': 'application/json'} : {})},
      ...(body ? {body: JSON.stringify(body)} : {}),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error('Browser Run ' + method + ' failed: HTTP ' + response.status);
    const data = await response.json();
    if (data?.success === false) throw new Error('Browser Run rejected: code ' + (data.errors?.[0]?.code ?? 'unknown'));
    return data?.result ?? data;
  }
  async function withSession(work) {
    if (typeof work !== 'function') throw new Error('work callback required');
    const created = await request('POST', '/devtools/browser', {query: {keep_alive: 60000}});
    const id = safeSessionId(created.sessionId);
    try {
      return await work({
        async openFixtureTab(html) {
          const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(fixtureOnly(html));
          const opened = await request('PUT', '/devtools/browser/' + id + '/json/new', {query: {url: dataUrl}});
          return {created: Boolean(opened?.id), type: opened?.type || null};
        },
        async inspectTabs() {
          const tabs = await request('GET', '/devtools/browser/' + id + '/json/list');
          if (!Array.isArray(tabs)) throw new Error('Unexpected target list');
          return {
            count: tabs.length,
            hasFixture: tabs.some(x => x.url?.startsWith('data:text/html') && x.url.includes('HHBA')),
            hasLiveView: tabs.some(x => Boolean(x.devtoolsFrontendUrl))
          };
        }
      });
    } finally {
      // A short keep_alive is the fallback if network failure prevents cleanup.
      try { await request('DELETE', '/devtools/browser/' + id); } catch { /* best effort */ }
    }
  }
  async function runSyntheticContentSmoke(html) {
    const doc = await request('POST', '/content', {
      body: {html: fixtureOnly(html), addScriptTag: [{content: buildSyntheticFillScript()}]}
    });
    if (typeof doc !== 'string') throw new Error('Unexpected Browser Run HTML result');
    const count = /data-hhba-cloud-writes="(\d+)"/.exec(doc);
    const submitted = /data-hhba-cloud-submitted="(true|false)"/.exec(doc);
    const manual = /data-hhba-cloud-manual="(\d+)"/.exec(doc);
    if (!count || !submitted || !manual) throw new Error('Cloud result is missing post-fill evidence');
    const result = {verifiedFields: Number(count[1]), manualFields: Number(manual[1]), submitted: submitted[1] === 'true'};
    if (result.verifiedFields !== 6 || result.submitted) throw new Error('Cloud form-fill safety assertion failed');
    return result;
  }
  return {withSession, runSyntheticContentSmoke};
}
