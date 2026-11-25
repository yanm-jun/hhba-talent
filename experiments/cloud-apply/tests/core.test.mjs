import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareFillPlan, transition } from '../src/core.mjs';
const field = (id, label, kind = 'text', value = '') => ({
  id, label, kind, value, name: '', placeholder: '', disabled: false, readOnly: false
});
test('fill known values, avoid restricted and ambiguous fields', () => {
  const plan = prepareFillPlan([
    field('a', '姓名'), field('b', '手机号', 'tel'),
    field('c', '身份证号码'), field('d', '验证码'),
    field('e', '未知问答'), field('f', '邮箱', 'email', 'already@example.com')
  ], { fullName: '测试用户', phone: '13800000000' });
  assert.deepEqual(plan.actions.map(x => x.key), ['fullName', 'phone']);
  assert.equal(plan.skipped.length, 3);
  assert.equal(plan.needsUser.length, 1);
});
test('never invent missing resume details', () => {
  const plan = prepareFillPlan([field('a', '最高学历')], {});
  assert.equal(plan.actions.length, 0);
  assert.equal(plan.needsUser[0].reason, 'missing-profile-value');
});
test('task state transitions require approval and evidence', () => {
  assert.equal(transition('created', 'running'), 'running');
  assert.equal(transition('running', 'review'), 'review');
  assert.throws(() => transition('review', 'verified_submitted'), /Forbidden/);
  assert.throws(() => transition('submitted_unverified', 'review'), /Forbidden/);
});
