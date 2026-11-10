import test from 'node:test';
import assert from 'node:assert/strict';
import { directionName, escapeEmailHtml, renderJoinOwnerEmail, renderJoinReceiptEmail, renderInboundReceiptEmail } from '../functions/_lib/hhba-brand-email.js';

const fixture = {
  name: '张同学', email: 'candidate@example.com', direction: 'tech-lead',
  experience: '我参与过多个 Web 产品的完整开发与交付。',
  strength: '希望改进岗位推荐质量。',
  portfolio: 'https://example.com/portfolio',
  weeklyTime: '每周 6–15 小时', mode: '远程协作',
  note: '工作日晚上方便交流', resumeName: '个人简历.pdf',
  applicationId: 12, createdAt: '2026-11-10T07:30:00Z',
};

test('official Chinese directions replace internal codes', () => {
  assert.equal(directionName('tech-lead'), '技术负责人 / 全栈架构工程师');
  assert.equal(directionName('unknown'), '开放合作方向');
});

test('V1 brand, slogan, original photo and accessible text appear in both emails', () => {
  const owner = renderJoinOwnerEmail(fixture);
  const reply = renderJoinReceiptEmail(fixture);
  for (const message of [owner, reply]) {
    assert.match(message.html, /汇方职场/);
    assert.match(message.html, /让机会与人才，找到彼此/);
    assert.match(message.html, /hhba-mail-logo.png/);
    assert.match(message.html, /hhba-mail-banner.jpg/);
    assert.match(message.html, /max-width:600px;height:auto/);
    assert.match(message.html, /<!doctype html>/i);
    assert.match(message.subject, /HHBA/);
    assert.ok(message.text.length > 40);
  }
  assert.match(reply.html, /WE HAVE RECEIVED YOUR APPLICATION/);
  assert.match(reply.html, /张同学/);
  assert.match(reply.html, /技术负责人/);
  assert.doesNotMatch(reply.html, /预览稿/);
  assert.doesNotMatch(reply.html, /1–3 个工作日/);
});

test('internal notification retains complete fields and CV attachment reference', () => {
  const owner = renderJoinOwnerEmail(fixture);
  assert.match(owner.html, /个人简历.pdf/);
  assert.match(owner.html, /example.com\/portfolio/);
  assert.match(owner.html, /希望改进岗位推荐质量/);
  assert.match(owner.html, /mailto:candidate%40example.com/);
  const receipt = renderJoinReceiptEmail(fixture);
  assert.doesNotMatch(receipt.html, /个人简历.pdf/);
  assert.doesNotMatch(receipt.html, /希望改进岗位推荐质量/);
});

test('untrusted form input is HTML escaped and unsafe links are not clickable', () => {
  const malicious = {
    ...fixture, name: '<script>alert(1)</script>', experience: '<img src=x onerror=alert(2)>',
    portfolio: 'javascript:alert(3)', note: 'foo" onmouseover="evil',
  };
  const owner = renderJoinOwnerEmail(malicious);
  assert.doesNotMatch(owner.html, /<script>alert/);
  assert.doesNotMatch(owner.html, /<img src=x onerror/);
  assert.doesNotMatch(owner.html, /href="javascript:/);
  assert.match(owner.html, /&lt;script&gt;alert/);
  assert.match(owner.html, /onmouseover=&quot;evil/);
  assert.equal(escapeEmailHtml("'\"<>"), '&#39;&quot;&lt;&gt;');
});

test('plain inbound email acknowledgment cannot be mistaken for an application confirmation', () => {
  const result = renderInboundReceiptEmail({ name: '李先生' });
  assert.match(result.text, /来信/);
  assert.match(result.html, /WE HAVE RECEIVED YOUR EMAIL/);
  assert.doesNotMatch(result.html, /已收到你的合作申请/);
});
