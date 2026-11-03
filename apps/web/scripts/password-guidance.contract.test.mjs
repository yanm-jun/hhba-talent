import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {okPassword,okUsername} from '../functions/_lib/real-auth.js';

const file = path => readFileSync(new URL('../src/'+path, import.meta.url), 'utf8');
const component = file('pages/PhoneAuthPage.tsx');
const service = file('services/realAuth.ts');
const css = file('styles/role-auth.css');

test('real backend accepts symbols in passwords while enforcing length, letters and digits', () => {
  for(const password of ['Abc12345@','abc1234!','Z9######','boss2026@password','#Aa123456']){
    assert.equal(okPassword(password),true,'valid password must be accepted: '+password);
  }
  for(const password of ['Abcdefg@','12345678!','abc123@','a'.repeat(63)+'1@']){
    assert.equal(okPassword(password),false,'invalid password must be rejected');
  }
  assert.equal(okPassword('a'.repeat(62)+'1@'),true,'64-character limit should be inclusive');
  assert.equal(okUsername('boss@'),false,'username has a different character policy');
  assert.equal(okUsername('boss'),true);
});

test('frontend password validator is consistent with actual backend policy, not a symbol blacklist', () => {
  assert.match(service,/password\.length >= 8/);
  assert.match(service,/password\.length <= 64/);
  assert.match(service,/\[A-Za-z\]/);
  assert.match(service,/\[0-9\]/);
  assert.match(service,/case 'WEAK_PASSWORD':/);
  assert.match(service,/支持 @、!、# 等常见符号/);
  assert.doesNotMatch(service,/password\.match\(\/\^\[A-Za-z0-9/);
});

test('registration visibly explains password requirements without submitting or exposing the password', () => {
  assert.match(component,/密码须为 8–64 位，同时包含字母和数字；支持 @、!、# 等常见符号。/);
  assert.match(component,/id="hhba-auth-password-rules"/);
  assert.match(component,/aria-describedby=\{password\.length > 0 \? 'hhba-auth-password-rules hhba-auth-password-feedback'/);
  assert.match(component,/type="password" required autoComplete="new-password"/);
  assert.match(component,/id="hhba-auth-password-feedback" role="status" aria-live="polite"/);
  assert.match(component,/const passwordIssues = \[/);
  assert.match(component,/至少包含一个字母/);
  assert.match(component,/至少包含一个数字/);
  assert.match(component,/const passwordFeedback = password\.length > 0/);
  assert.match(component,/const passwordConfirmFeedback = passwordConfirm\.length > 0/);
  assert.match(component,/id="hhba-auth-password-confirm-feedback" role="status" aria-live="polite"/);
  assert.match(component,/!realAuthPasswordValid\(password\)/);
  assert.match(component,/password === passwordConfirm/);
});

test('usernames with @ show their own rule, separate from passwords that allow @', () => {
  assert.match(component,/id="hhba-auth-username-feedback"/);
  assert.match(component,/不支持 @/);
  assert.match(component,/realAuthUsernameValid\(name\)/);
  assert.match(component,/aria-invalid=\{useRealAuth && name\.length > 0 && !realAuthUsernameValid\(name\)\}/);
});

test('inline help is readable, keyboard-safe and does not change existing registration/API workflow', () => {
  for(const selector of [
    '.hhba-phone-field-group{','.hhba-phone-password-rules{',
    '.hhba-phone-inline-feedback{','.hhba-phone-inline-feedback.is-valid{',
    '.hhba-phone-inline-feedback.is-invalid{'
  ]) assert.ok(css.includes(selector),'missing layout class '+selector);
  assert.match(component,/await realAuth\.register\(\{ phone, code, username, password, password_confirm: passwordConfirm \}\)/);
  assert.match(component,/await realAuth\.loginPassword\(username, password\)/);
  assert.match(component,/await realAuth\.loginSms\(phone, code\)/);
  assert.match(component,/const codeLength = useRealAuth \? 4 : 6;/);
});
