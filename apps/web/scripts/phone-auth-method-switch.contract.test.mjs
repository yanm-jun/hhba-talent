import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../src/'+path, import.meta.url), 'utf8');
const login = read('pages/PhoneAuthPage.tsx');
const css = read('styles/role-auth.css');

test('SMS/password switch is a designed two-option control, not a browser default button', () => {
 assert.match(login, /className="hhba-phone-login-methods" role="group" aria-label="选择登录方式"/);
 assert.equal((login.match(/className=\{`hhba-phone-login-method/g)||[]).length, 2);
 assert.match(login, /aria-pressed=\{authMethod === 'code'\}/);
 assert.match(login, /aria-pressed=\{authMethod === 'password'\}/);
 assert.match(login, /changeAuthMethod\('code'\)/);
 assert.match(login, /changeAuthMethod\('password'\)/);
 assert.match(login, /验证码登录/);
 assert.match(login, /密码登录/);
 assert.doesNotMatch(login, /id="hhba-phone-switch-identity"/);
 for(const selector of ['.hhba-phone-login-methods{','.hhba-phone-login-method{','.hhba-phone-login-method.is-active','.hhba-phone-login-method:hover','.hhba-phone-login-method:focus-visible']){
  assert.ok(css.includes(selector), 'missing styled switch selector '+selector);
 }
 assert.match(css, /@media\(max-width:350px\).*?\.hhba-phone-login-method\{/);
});

test('switch is only exposed in the supported login state and never grants recruiter password access', () => {
 assert.ok(login.includes("const useRealAuth = realAuthReady && candidate;"));
 assert.ok(login.includes("const realPasswordLogin = useRealAuth && mode === 'login' && authMethod === 'password';"));
 assert.ok(login.includes("{useRealAuth && mode === 'login' && ("));
 const before=login.indexOf('className="hhba-phone-login-methods"');
 const after=login.indexOf("{mode === 'register' && (",before);
 assert.ok(before>0 && after>before, 'method switch should precede form fields');
 assert.ok(!login.slice(after).includes('id="hhba-phone-switch-identity"'));
 assert.ok(login.includes("if (nextMethod === 'password') setCode('');"));
 assert.ok(login.includes("else setPassword('');"));
});

test('existing SMS, password, registration and session endpoints remain unchanged', () => {
 for(const anchor of [
  'await realAuth.sendCode(phone, mode);',
  'await realAuth.register({ phone, code, username, password, password_confirm: passwordConfirm });',
  'await realAuth.loginPassword(username, password);',
  'await realAuth.loginSms(phone, code);',
  'const me = await realAuth.me();',
  'await api.phoneSession({ phone, code, mode, account_type: accountType',
  'setMode(initialMode);',
  'setAuthMethod(\'code\');',
 ]){
  assert.ok(login.includes(anchor), 'existing auth behavior must remain: '+anchor);
 }
});
