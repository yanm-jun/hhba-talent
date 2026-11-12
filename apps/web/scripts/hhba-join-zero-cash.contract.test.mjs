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

test('public page does not promise unbudgeted salary, benefits or guaranteed returns', () => {
  assert.doesNotMatch(page, /title: '有竞争力的薪资'/);
  assert.doesNotMatch(page, /title: '六险二金的保障目标'/);
  assert.doesNotMatch(page, /title: '更充分的休息'/);
  assert.match(page, /目前没有稳定工资和福利预算/);
  assert.match(page, /若实际建立劳动关系，必须依法支付工资/);
  assert.match(page, /不承诺现成股份或收入/);
  assert.match(page, /core.*核心共建/);
  assert.match(page, /零现金创业伙伴招募/);
});

test('existing application form and receipt wiring remain intact', () => {
  assert.match(page, /body\.append\('direction', form\.direction\)/);
  assert.match(page, /body\.append\('submissionId', submissionIdRef\.current\)/);
  assert.match(page, /fetch\('\/api\/join-apply'/);
  assert.match(intake, /const DIRECTIONS = new Set/);
  assert.match(intake, /record_saved: recordSaved/);
  assert.match(email, /renderJoinOwnerEmail/);
});
