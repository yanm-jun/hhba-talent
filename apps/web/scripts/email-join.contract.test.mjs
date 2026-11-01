import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost,onRequestGet} from '../functions/api/v1/join/applications.js';
import {JOIN_INBOX,mailReady,validEmail} from '../functions/_lib/mail.js';

class Db {
 constructor(){this.limits=new Map();this.applications=[];this.stats=new Map();}
 prepare(sql){const db=this;let args=[];
   return {bind(...a){args=a;return this;},
     async run(){
       if(sql.startsWith('INSERT INTO join_rate_limits')){const old=db.limits.get(args[0]);db.limits.set(args[0],{window_start:args[1],hits:old?old.hits+1:1});return {success:true};}
       if(sql.startsWith('INSERT INTO join_applications')){db.applications.push({id:args[0],name:args[1],contact:args[3],status:args[12]});return {success:true};}
       if(sql.startsWith('UPDATE join_applications')){const a=db.applications.find(x=>x.id===args.at(-1));if(a)a.status=args[0];return {success:true};}
       throw Error('unrecognized '+sql);
     },
     async first(){if(sql.startsWith('SELECT hits FROM join_rate_limits'))return db.limits.get(args[0]);throw Error('unrecognized '+sql);}
   };
 }
}
const url='https://preview.hhba-talent.pages.dev/api/v1/join/applications';
const details={name:'Sample Person',contactType:'邮箱',contact:'someone@example.test',direction:'backend',
 experience:'Test-only software development experience',portfolio:'https://example.com/',
 strength:'Improve verified recruitment workflows',weeklyTime:'每周 6–15 小时',mode:'远程协作',
 note:'A test request, not a real application',acknowledged:true,privacyAgreed:true};
const makeCtx=(env,data=details,origin=url)=>({env,request:new Request(url,{method:'POST',headers:{origin:new URL(origin).origin,'content-type':'application/json','cf-connecting-ip':'203.0.113.7'},body:JSON.stringify(data)})});
test('all common domestic and global mailbox domains are accepted by shared parser',()=>{
  for(const domain of ['qq.com','163.com','126.com','gmail.com','outlook.com','sina.com','sohu.com','foxmail.com','company.cn'])
    assert.equal(validEmail('hello@'+domain),true,domain);
  assert.equal(validEmail('hello@@qq.com'),false);
});
test('no sender configured: no applicant info is collected and no success',async()=>{
  const db=new Db(),env={HHBA_JOIN_DB:db,HHBA_JOIN_INTAKE_ENABLED:'1'};
  assert.equal(mailReady(env),false);
  const status=await onRequestGet({env});assert.equal((await status.json()).ready,false);
  const result=await onRequestPost(makeCtx(env));
  assert.equal(result.status,503);assert.equal(db.applications.length,0);
});
test('only configured owner Gmail receives a submitted application; response requires accepted mail',async()=>{
  const db=new Db(),messages=[];
  const env={HHBA_JOIN_DB:db,HHBA_JOIN_INTAKE_ENABLED:'1',HHBA_MAIL_FROM:'notifications@example.com',
    EMAIL:{send:async email=>{messages.push(email);return {messageId:'provider-test-id'}}}};
  const result=await onRequestPost(makeCtx(env));const body=await result.json();
  assert.equal(result.status,201);assert.equal(body.mail_status,'accepted');
  assert.match(body.application_id,/^HHBA-/);
  assert.equal(db.applications.length,1);
  assert.equal(db.applications[0].status,'accepted');
  assert.equal(messages.length,1);assert.equal(messages[0].to,JOIN_INBOX);
  assert.equal(messages[0].replyTo,details.contact);
  assert.match(messages[0].text,/Sample Person/);
});
test('mail provider rejection never returns successful delivery status',async()=>{
  const db=new Db(),env={HHBA_JOIN_DB:db,HHBA_JOIN_INTAKE_ENABLED:'1',HHBA_MAIL_FROM:'notifications@example.com',
    EMAIL:{send:async()=>{throw Error('provider failure')}}};
  const result=await onRequestPost(makeCtx(env));assert.equal(result.status,503);
  assert.equal(db.applications.length,1);assert.equal(db.applications[0].status,'failed');
});
test('origin mismatch and absent consent blocked',async()=>{
  const db=new Db(),env={HHBA_JOIN_DB:db,HHBA_JOIN_INTAKE_ENABLED:'1',HHBA_MAIL_FROM:'notifications@example.com',EMAIL:{send:async()=>({messageId:'id'})}};
  assert.equal((await onRequestPost(makeCtx(env,details,'https://elsewhere.invalid'))).status,403);
  assert.equal((await onRequestPost(makeCtx(env,{...details,privacyAgreed:false}))).status,400);
  assert.equal(db.applications.length,0);
});
