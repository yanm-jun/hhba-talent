import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { directionName } from '../functions/_lib/hhba-brand-email.js';

const page = readFileSync(new URL('../src/pages/JoinUsPage.tsx', import.meta.url), 'utf8');
const intake = readFileSync(new URL('../functions/api/join-apply.js', import.meta.url), 'utf8');
const email = readFileSync(new URL('../functions/_lib/hhba-brand-email.js', import.meta.url), 'utf8');
const rolesBlock = page.split('const roles = [')[1].split('] as const;')[0];
const ids = [...rolesBlock.matchAll(/\bid:'([a-z-]+)'/g)].map(m => m[1]);
const expected = ['tech-lead', 'backend', 'ai-data', 'ai-match', 'edge-apply', 'content-growth', 'governance', 'business', 'product', 'other'];

test('10 unique role codes, matching server whitelist and email labels', () => {
  assert.deepEqual([...ids].sort(), [...expected].sort());
  assert.equal(new Set(ids).size, expected.length);
  for(const id of expected) {
    assert.match(intake, new RegExp("'" + id + "'"));
    assert.ok(directionName(id) !== '开放合作方向', id);
  }
  assert.match(email, /content-growth/);
});

test('all roles grouped exactly once: core, specialist, flexible', () => {
  const groups = page.split('const roleGroups = [')[1].split('] as const;')[0];
  const groupIds = [...groups.matchAll(/ids:\s*\[([^\]]+)\]/g)].flatMap(x =>
    [...x[1].matchAll(/'([a-z-]+)'/g)].map(m => m[1]));
  assert.equal(groupIds.length, expected.length);
  assert.deepEqual([...groupIds].sort(), [...expected].sort());
});

test('founding partner invitation offers genuine future equity without fictional benefits', () => {
  assert.doesNotMatch(page, /title: '有竞争力的薪资'/);
  assert.doesNotMatch(page, /title: '六险二金的保障目标'/);
  assert.doesNotMatch(page, /title: '更充分的休息'/);
  assert.doesNotMatch(page, /零现金创业伙伴招募|没有现成福利|零现金阶段/);
  assert.match(page, /创业合伙人招募/);
  assert.match(page, /核心合伙人，共同持股/);
  assert.match(page, /按双方约定落实实际股权/);
  assert.match(page, /公司尚未完成设立/);
  assert.match(page, /若实际形成劳动关系，我们仍会依法支付工资/);
  assert.match(page, /实际持有公司股权/);
  assert.equal((page.match(/join-disclosure-final/g) || []).length, 1);
  assert.doesNotMatch(page, /className="join-role-compensation"/);
  assert.match(page, /VITE_HHBA_JOIN_STATIC_PREVIEW/);
});

test('existing application form and receipt wiring remain intact', () => {
  assert.match(page, /body\.append\('direction', form\.direction\)/);
  assert.match(page, /body\.append\('submissionId', submissionIdRef\.current\)/);
  assert.match(page, /fetch\('\/api\/join-apply'/);
  assert.match(intake, /const DIRECTIONS = new Set/);
  assert.match(intake, /record_saved: recordSaved/);
  assert.match(email, /renderJoinOwnerEmail/);
});
