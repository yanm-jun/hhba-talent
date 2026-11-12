import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { onRequest } from '../functions/api/join-apply.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function request(submissionId = '4c4c87d0-d5ba-4af8-99d1-c9f42b6edc57') {
  const form = new FormData();
  for (const [k, v] of Object.entries({
    name: '测试申请',
    email: 'example@example.com',
    direction: 'ai-data',
    experience: '多年实际研发与数据检索系统经验',
    weeklyTime: '每周 30 小时以上',
    mode: '远程协作',
    acknowledged: 'true',
    submissionId,
  })) form.append(k, v);
  return new Request('https://hhba.work/api/join-apply', {
    method: 'POST', body: form,
    headers: { 'cf-connecting-ip': '192.0.2.19' },
  });
}
function brokenDb(message) {
  return { prepare() { throw Error(message); } };
}
function goodDb() {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() { return { n: 0 }; },
            async run() { return { meta: { last_row_id: 123 }; },
          };
        },
      };
    },
  };
}
function env(db) {
  return {
    HHBA_PNVS_AUTH_DB: db,
    JOIN_OWNER_EMAIL: 'owner@example.com',
    JOIN_FROM_EMAIL: 'hello@notify.hhba.work',
    RESEND_API_KEY: 'fake-test-only',
  };
}
function sentEmails(status = 200) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const message = JSON.parse(options.body);
    calls.push({ message, key: options.headers['Idempotency-Key'] });
    return new Response(JSON.stringify({ id: 'test-only' }), { status });
  };
  return calls;
}

test('D1 daily row read limit: preserve mail sending and report no DB backup', async () => {
  const calls = sentEmails();
  const e = env(brokenDb("D1_ERROR: Your account has exceeded D1's free tier daily row read limit (7500)"));
  const res = await onRequest({ request: request(), env: e });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.record_saved, false);
  assert.equal(body.confirmation_sent, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(x => x.message.to), [['owner@example.com'], ['example@example.com']]);
  assert.equal(calls[0].key.includes('example@example.com'), false);
  assert.notEqual(calls[0].key, calls[1].key);
});

test('repeat delivery uses same idempotency keys and no duplicate-unique key', async () => {
  const calls = sentEmails();
  const e = env(brokenDb('daily rows read limit exceeded'));
  await onRequest({ request: request(), env: e });
  await onRequest({ request: request(), env: e });
  assert.equal(calls.length, 4);
  assert.equal(calls[0].key, calls[2].key);
  assert.equal(calls[1].key, calls[3].key);
});

test('normal D1 insert still happens before owner/receipt mail', async () => {
  const calls = sentEmails();
  const res = await onRequest({ request: request(), env: env(goodDb()) });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.record_saved, true);
  assert.equal(body.application_id, 123);
  assert.equal(calls.length, 2);
});

test('unknown D1 failure does not silently suppress record errors', async () => {
  const calls = sentEmails();
  const res = await onRequest({ request: request(), env: env(brokenDb('no such column')) });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'STORAGE_UNAVAILABLE');
  assert.equal(calls.length, 0);
});

test('email failure during D1 quota is reported as UNSAVED', async () => {
  const calls = sentEmails(422);
  const res = await onRequest({ request: request(), env: env(brokenDb('daily row read limit exceeded')) });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'EMAIL_DELIVERY_FAILED_UNSAVED');
  assert.equal(calls.length, 1);
});
