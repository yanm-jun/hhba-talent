// HHBA Pages 短信认证纯逻辑单测：node --test apps/web/scripts/real-auth-pnvs.test.mjs
// 只测不依赖 D1 的纯函数；真实 PNVS 调用与 D1 接线留到有 Secret 的预览环境再测，
// 本文件绝不调用短信商、不编造“已发码成功”的结论。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  okPhone,
  okUsername,
  okPassword,
  decideSend,
  sessionValid,
  decideLoginSms,
  sha256Hex,
  hashPassword,
  verifyPassword,
  SEND_COOLDOWN_MS,
} from '../functions/_lib/real-auth.js';
import { PNVS_SIGN_NAME, PNVS_TEMPLATE_CODE, createSmsProvider } from '../functions/_lib/sms-provider.js';

test('手机号格式：仅中国大陆 11 位、1[3-9] 开头', () => {
  assert.equal(okPhone('13800138000'), true);
  assert.equal(okPhone('12345678901'), false);
  assert.equal(okPhone('1380013800'), false);
  assert.equal(okPhone('138001380000'), false);
  assert.equal(okPhone(''), false);
  assert.equal(okPhone(null), false);
});

test('称呼与密码规则与前端 realAuth.ts 一致', () => {
  assert.equal(okUsername('张三'), true);
  assert.equal(okUsername('a'), false);
  assert.equal(okUsername('1abc'), false);
  assert.equal(okUsername('a-b'), false);
  assert.equal(okUsername('a'.repeat(21)), false);
  assert.equal(okPassword('abc12345'), true);
  assert.equal(okPassword('abcdefgh'), false);
  assert.equal(okPassword('12345678'), false);
  assert.equal(okPassword('a1'), false);
});

test('发码风控：60 秒冷却、手机号 1 小时 5 次、IP 1 小时 20 次', () => {
  const now = 1_000_000_000_000;
  assert.deepEqual(decideSend({ lastSendAtMs: now - SEND_COOLDOWN_MS + 1000, phoneCountLastHour: 0, ipCountLastHour: 0 }, now), { allowed: false, reason: 'COOLDOWN' });
  assert.deepEqual(decideSend({ lastSendAtMs: now - SEND_COOLDOWN_MS, phoneCountLastHour: 5, ipCountLastHour: 0 }, now), { allowed: false, reason: 'PHONE_LIMIT' });
  assert.deepEqual(decideSend({ lastSendAtMs: null, phoneCountLastHour: 0, ipCountLastHour: 20 }, now), { allowed: false, reason: 'IP_LIMIT' });
  assert.deepEqual(decideSend({ lastSendAtMs: null, phoneCountLastHour: 4, ipCountLastHour: 19 }, now), { allowed: true, reason: null });
});

test('注册与登录严格分开：登录验码通过但无账号时拒绝，绝不建号', () => {
  assert.deepEqual(decideLoginSms({ codeOk: false, user: { phone: '13800138000' } }), { error: 'CODE_INVALID_OR_EXPIRED', status: 401 });
  assert.deepEqual(decideLoginSms({ codeOk: true, user: null }), { error: 'USER_NOT_REGISTERED', status: 403 });
  assert.deepEqual(decideLoginSms({ codeOk: true, user: { phone: '13800138000' } }), { error: null, status: 200 });
});

test('会话：过期或已撤销一律无效，未过期未撤销才有效', () => {
  const now = 1_000_000_000_000;
  assert.equal(sessionValid({ revoked: 0, expires_at: new Date(now + 1000).toISOString() }, now), true);
  assert.equal(sessionValid({ revoked: 0, expires_at: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(sessionValid({ revoked: 1, expires_at: new Date(now + 1000).toISOString() }, now), false);
  assert.equal(sessionValid(null, now), false);
});

test('会话只存哈希：SHA-256 确定且不等于原始 token', async () => {
  const token = 'test-token-value';
  const hash = await sha256Hex(token);
  assert.equal(hash, await sha256Hex(token));
  assert.notEqual(hash, token);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('密码哈希：正确密码通过、错误密码失败、不同盐结果不同', async () => {
  const a = await hashPassword('abc12345');
  const b = await hashPassword('abc12345');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('abc12345', a), true);
  assert.equal(await verifyPassword('abc12346', a), false);
  assert.equal(await verifyPassword('abc12345', 'not-a-hash'), false);
});

test('短信商适配器：无 Secret 时明确未配置，绝不假装可发码；PNVS 签名模板固定', () => {
  assert.equal(PNVS_SIGN_NAME, '恒创联众');
  assert.equal(PNVS_TEMPLATE_CODE, '100001');
  const provider = createSmsProvider({});
  assert.equal(provider.configured, false);
  assert.equal(provider.name, 'pnvs');
  const unknown = createSmsProvider({ HHBA_SMS_PROVIDER: 'some-other-vendor' });
  assert.equal(unknown.configured, false);
});
