/** HHBA: synthetic PoC only. No AI invented facts or automatic submission. */
const rules = [
  ['fullName', /(?:^|\b)(?:full\s*name|姓名|真实姓名|应聘人姓名)(?:\b|$)/i],
  ['phone', /(?:手机号|手机号码|联系电话|联系手机|mobile|phone)/i],
  ['email', /(?:电子邮箱|邮箱|e-?mail)/i],
  ['school', /(?:毕业院校|就读学校|大学名称|学校名称|university|school)/i],
  ['major', /(?:所学专业|专业名称|major|专业)/i],
  ['degree', /(?:最高学历|学历|degree|education level)/i],
];
const restricted = /(?:密码|验证码|短信码|动态码|身份证|护照|银行卡|出生|性别|民族|国籍|隐私|协议|授权|担保|承诺|captcha|otp|password|national.?id|passport|consent|agree|signature)/i;

export function prepareFillPlan(fields, profile) {
  const actions = [], needsUser = [], skipped = [];
  for (const field of fields) {
    const label = String(field.label || '').trim();
    const target = (label + ' ' + (field.name || '') + ' ' + (field.placeholder || '')).trim();
    if (!field.id || field.disabled || field.readOnly || field.value || field.kind === 'hidden') {
      skipped.push({ id: field.id, reason: 'unavailable-or-already-filled' }); continue;
    }
    if (restricted.test(target) || !['text', 'tel', 'email'].includes(field.kind)) {
      skipped.push({ id: field.id, reason: 'manual-or-sensitive' }); continue;
    }
    const matched = rules.filter(([, regex]) => regex.test(target));
    if (matched.length !== 1) {
      needsUser.push({ id: field.id, label, reason: 'unrecognized-or-ambiguous' }); continue;
    }
    const [key] = matched[0];
    const value = profile?.[key];
    if (typeof value !== 'string' || !value.trim()) {
      needsUser.push({ id: field.id, label, key, reason: 'missing-profile-value' }); continue;
    }
    actions.push({ id: field.id, key, value: value.trim(), label });
  }
  return { actions, needsUser, skipped };
}

export const transitions = Object.freeze({
  created: ['running', 'cancelled'],
  running: ['needs_user', 'review', 'failed', 'cancelled'],
  needs_user: ['running', 'cancelled', 'failed'],
  review: ['running', 'submission_pending', 'cancelled'],
  submission_pending: ['submitted_unverified', 'failed'],
  submitted_unverified: ['verified_submitted', 'failed', 'needs_user'],
  verified_submitted: [], failed: [], cancelled: [],
});
export function transition(from, to) {
  if (!transitions[from]?.includes(to)) throw new Error('Forbidden task transition: ' + from + ' -> ' + to);
  return to;
}
