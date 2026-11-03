import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  okSmsCode, verifySmsCode, AuthError, VERIFY_MAX_PER_HOUR,
} from '../functions/_lib/real-auth.js';
import { PnvsSmsProvider } from '../functions/_lib/sms-provider.js';

const PHONE = '13800138000'; // A synthetic test number; no live SMS is sent.
const CODE = '0123';

function providerWith(response) {
  const provider = new PnvsSmsProvider({});
  let calls = 0;
  provider.rpc = async (action, body) => {
    calls++;
    assert.equal(action, 'CheckSmsVerifyCode');
    assert.equal(body.PhoneNumber, PHONE);
    assert.equal(body.VerifyCode, CODE);
    return response;
  };
  return { provider, calls: () => calls };
}

function fakeDb({ attempts = 0 } = {}) {
  let consumed = false;
  const events = [];
  let updates = 0;
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith('SELECT COUNT(*) AS n')) return {n: attempts};
              if (sql.includes('FROM hhba_sms_events') && sql.includes('consumed=0'))
                return consumed ? null : {id: 1};
              throw Error('unexpected test SELECT: '+sql);
            },
            async run() {
              if (sql.startsWith('INSERT INTO hhba_auth_verify_events')) {
                events.push({ purpose: args[1], success: args[2] });
                return {success:true,meta:{changes:1}};
              }
              if (sql.startsWith('UPDATE hhba_sms_events')) {
                assert.match(sql, /WHERE id=\? AND consumed=0/);
                updates++;
                if (consumed) return {success:true,meta:{changes:0}};
                consumed=true;
                return {success:true,meta:{changes:1}};
              }
              throw Error('unexpected test RUN: '+sql);
            },
          };
        },
      };
    },
  };
  return {db, events, consumed:()=>consumed,updates:()=>updates};
}

test('provider must reject upstream OK/Success responses unless VerifyResult is explicitly PASS', async () => {
  const responses=[
    {Code:'OK',Success:true,Model:{VerifyResult:'PASS'}},
    {Code:'OK',Success:true,Model:{VerifyResult:'UNKNOWN'}},
    {Code:'OK',Success:true,Model:{}},
    {Code:'OK',Success:true},
    {Code:'OK',Success:false,Model:{VerifyResult:'PASS'}},
    {Code:'ERROR',Success:true,Model:{VerifyResult:'PASS'}},
    {Code:'OK',Success:true,Model:{VerifyResult:'FAIL'}},
    {Code:'OK',Success:true,Model:{VerifyResult:'pass'}},
    {},
    null,
  ];
  for (const [i,response] of responses.entries()) {
    const {provider,calls}=providerWith(response);
    assert.equal(await provider.verifyCode(PHONE,CODE), i===0, 'provider case '+i);
    assert.equal(calls(),1);
  }
});

test('provider rejects malformed codes without contacting Alibaba', async () => {
  const {provider,calls}=providerWith({Code:'OK',Success:true,Model:{VerifyResult:'PASS'}});
  for (const code of ['','123','12345','123456','abcd','12a4',null,1234]) {
    assert.equal(await provider.verifyCode(PHONE,code),false);
  }
  assert.equal(calls(),0);
  assert.equal(okSmsCode('0000'),true);
  assert.equal(okSmsCode(CODE),true);
  assert.equal(okSmsCode('9999'),true);
  assert.equal(okSmsCode('123456'),false);
});

test('wrong code or missing explicit PASS must never consume an SMS or authorize a session', async () => {
  const {db,events,consumed,updates}=fakeDb();
  const provider={verifyCode:async()=>false};
  assert.equal(await verifySmsCode(db,provider,PHONE,'register',CODE,Date.now()),false);
  assert.equal(consumed(),false);
  assert.equal(updates(),0);
  assert.deepEqual(events.map(x=>x.success),[0]);
});

test('correct four-digit code is consumed once; replay is denied', async () => {
  const fake=fakeDb();
  const provider={verifyCode:async()=>true};
  assert.equal(await verifySmsCode(fake.db,provider,PHONE,'register',CODE,Date.now()),true);
  assert.equal(fake.consumed(),true);
  assert.equal(await verifySmsCode(fake.db,provider,PHONE,'register',CODE,Date.now()),false);
  assert.equal(fake.updates(),1);
});

test('simultaneous successful PNVS calls cannot consume the same send twice', async () => {
  const fake=fakeDb();
  const provider={verifyCode:async()=>true};
  const results=await Promise.all([
    verifySmsCode(fake.db,provider,PHONE,'login',CODE,Date.now()),
    verifySmsCode(fake.db,provider,PHONE,'login',CODE,Date.now()),
  ]);
  assert.deepEqual(results.sort(),[false,true]);
  assert.equal(fake.consumed(),true);
});

test('invalid formats still count against the one-hour attempt budget; no API verification call', async () => {
  const fake=fakeDb();
  let verifyCalls=0;
  const provider={verifyCode:async()=>{verifyCalls++;return true;}};
  for (const code of ['123456','123']) {
    assert.equal(await verifySmsCode(fake.db,provider,PHONE,'reset',code,Date.now()),false);
  }
  assert.equal(verifyCalls,0);
  assert.deepEqual(fake.events.map(x=>x.success),[0,0]);
  const limited=fakeDb({attempts:VERIFY_MAX_PER_HOUR});
  await assert.rejects(verifySmsCode(limited.db,provider,PHONE,'register',CODE,Date.now()),
    error=>error instanceof AuthError && error.code==='RATE_LIMITED' && error.status===429);
  assert.equal(verifyCalls,0);
});

test('registration and login UI match PNVS four-digit codes without changing legacy recruiter gateway', () => {
  const component=readFileSync(new URL('../src/pages/PhoneAuthPage.tsx',import.meta.url),'utf8');
  assert.ok(component.includes('const codeLength = useRealAuth ? 4 : 6;'));
  assert.ok(component.includes("const codeValid = useRealAuth ? /^[0-9]{4}$/.test(code) : /^[0-9]{6}$/.test(code);"));
  assert.ok(component.includes('maxLength={codeLength}'));
  assert.ok(component.includes('placeholder={`${codeLength} 位短信验证码`}'));
  assert.ok(component.includes("await realAuth.register({ phone, code, username, password, password_confirm: passwordConfirm });"));
  assert.ok(component.includes("await realAuth.loginSms(phone, code);"));
});

test('Alibaba sending template and signature stay unchanged; no credential or real SMS is used',async()=>{
  const provider=new PnvsSmsProvider({});
  let sendCalls=0;
  provider.rpc=async(action,data)=>{
    sendCalls++;
    assert.equal(action,'SendSmsVerifyCode');
    assert.equal(data.SignName,'恒创联众');
    assert.equal(data.TemplateCode,'100001');
    assert.equal(data.CodeType,1);
    assert.equal(data.CodeLength,undefined); // preserve PNVS default four-digit output
    assert.deepEqual(JSON.parse(data.TemplateParam),{code:'##code##',min:'5'});
    return {BizId:'synthetic'};
  };
  assert.deepEqual(await provider.sendCode(PHONE),{bizId:'synthetic'});
  assert.equal(sendCalls,1);
});
