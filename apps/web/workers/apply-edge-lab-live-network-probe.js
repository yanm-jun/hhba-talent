// One-shot, scheduled live HTTPS protocol test of the isolated HHBA Edge lab.
// There is deliberately NO public fetch trigger or admin/test bypass route.
// Each login/extension token is generated inside this Worker, never written
// into GitHub, a log, a webhook, or the persisted audit result.
//
// This worker is NEVER a production HHBA component. Bind ONLY Preview PNVS D1.
const LAB='https://hhba-edge-p0-lab.pages.dev';
const EXT='chrome-extension://fjkcpgikachmfhajlghgekeicgbdagej';
const RUN='p0-20261107-real-network-v1';
const FAKE_NAME='HHBA 内部虚构联调';
const FAKE_SCHOOL='测试样例学院';
const FAKE_MAIL='edge-lab@example.invalid';
const CODE_RE=/^[A-HJ-NP-Z2-9]{12}$/;
const randomHex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
const hex=arr=>Array.from(new Uint8Array(arr),x=>x.toString(16).padStart(2,'0')).join('');
async function sha256(s){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}
const iso=ms=>new Date(ms).toISOString();
const safe=(v)=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{2,80}$/.test(v)?v:'UNEXPECTED_RESPONSE';
const check=(ok,step,code)=>{if(!ok){const e=new Error(code||'ASSERTION');e.stage=step;throw e;}};
async function request(path,{method='GET',origin,token,body}={}){
 const headers=new Headers({'Accept':'application/json','Cache-Control':'no-cache'});
 if(origin)headers.set('Origin',origin);
 if(token)headers.set('Authorization','Bearer '+token);
 if(body!==undefined)headers.set('Content-Type','application/json');
 const response=await fetch(LAB+'/api/apply'+path,{
  method,headers,redirect:'error',cache:'no-store',
  ...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 const text=await response.text();
 if(text.length>6000)throw Object.assign(new Error('OVERSIZE_RESPONSE'),{stage:'REMOTE_PARSE'});
 let json;
 try{json=JSON.parse(text)}catch{throw Object.assign(new Error('INVALID_JSON'),{stage:'REMOTE_PARSE'});}
 return {status:response.status,result:json,headers:response.headers};
}
async function runProbe(db){
 const st=Date.now();
 let phone=null,step='INITIAL',cleaned=false;
 let stageCount=0;
 const assertions=[];
 const stage=name=>{step=name;stageCount++;assertions.push(name);};
 try{
  stage('CONFIG');
  const config=await request('/config');
  check(config.status===200&&config.result.pairingEnabled===true&&
   config.result.profileSyncEnabled===true&&
   config.result.paymentEnabled===false&&config.result.tasksEnabled===false,
   step,'CONFIG_NOT_ISOLATED');

  stage('SYNTHETIC_OWNER');
  for(let i=0;i<6;i++){
   const attempt='19999'+String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
   const exists=await db.prepare('SELECT phone FROM hhba_auth_users WHERE phone=?').bind(attempt).first();
   if(!exists){phone=attempt;break;}
  }
  check(!!phone,step,'UNABLE_TO_ALLOCATE_TEST_ID');
  const token=randomHex(32),hash=await sha256(token),resume=crypto.randomUUID(),start=iso(st),expires=iso(st+12*60*1000);
  await db.prepare('INSERT INTO hhba_auth_users(phone,username,role,created_at) VALUES(?,?,?,?)')
   .bind(phone,'edge_probe_'+randomHex(8),'candidate',start).run();
  await db.prepare('INSERT INTO hhba_auth_sessions(token_hash,phone,created_at,expires_at) VALUES(?,?,?,?)')
   .bind(hash,phone,start,expires).run();
  await db.prepare('INSERT INTO hhba_candidate_resumes(id,phone,storage_key,filename,media_type,size_bytes,sha256,storage_consent_version,storage_consent_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
   .bind(resume,phone,'synthetic-edge-probe/'+resume,'SYNTHETIC_NO_R2_OBJECT.pdf',
    'application/pdf',128,await sha256('synthetic:'+resume),'private-resume-storage-v1',start,start).run();

  stage('UNAUTH_DENIED');
  const anonymous=await request('/pair/start',{method:'POST',origin:LAB});
  check(anonymous.status===401,step,'UNAUTH_ACCEPTED');

  stage('PAIR_START');
  const created=await request('/pair/start',{method:'POST',origin:LAB,token});
  check(created.status===200&&created.result.ok===true&&CODE_RE.test(created.result.code),
   step,'PAIR_START_FAILED');
  const code=created.result.code;

  stage('WRONG_ORIGIN');
  const evil=await request('/extension/claim',{method:'POST',origin:'https://evil.invalid',body:{code}});
  check(evil.status===403,step,'WRONG_ORIGIN_ACCEPTED');

  stage('PAIR_REDEEM');
  const redeemed=await request('/extension/claim',{method:'POST',origin:EXT,body:{code}});
  check(redeemed.status===200&&/^hhbaext_[a-f0-9]{64}$/.test(redeemed.result.token),
   step,'PAIR_REDEEM_FAILED');
  const extToken=redeemed.result.token;

  stage('REPLAY_DENIED');
  const replay=await request('/extension/claim',{method:'POST',origin:EXT,body:{code}});
  check(replay.status===400,step,'PAIR_CODE_REPLAY_ACCEPTED');

  stage('DEVICE_WALLET');
  const wallet=await request('/extension/wallet',{method:'POST',origin:EXT,token:extToken});
  check(wallet.status===200&&wallet.result.wallet?.available===0&&
   wallet.result.wallet?.consumed===0,step,'DEVICE_WALLET_FAILED');

  stage('BAD_CONSENT');
  const denied=await request('/profile-transfer/prepare',{
   method:'POST',origin:LAB,token,body:{
    resumeId:resume,consentVersion:'extension-structured-profile-sync-v1',
    consent:false,profile:{fullName:FAKE_NAME}
   }
  });
  check(denied.status===400,step,'CONSENT_BYPASS');

  stage('ENCRYPTED_PREPARE');
  const payload={resumeId:resume,consent:true,
   consentVersion:'extension-structured-profile-sync-v1',
   profile:{fullName:FAKE_NAME,email:FAKE_MAIL,school:FAKE_SCHOOL,major:'视觉传达'}};
  const prepared=await request('/profile-transfer/prepare',{
   method:'POST',origin:LAB,token,body:payload
  });
  check(prepared.status===200&&prepared.result.ok===true,step,'PREPARE_FAILED');
  const cipher=await db.prepare('SELECT cipher_hex,nonce_hex FROM hhba_apply_profile_transfers WHERE phone=?').bind(phone).first();
  check(!!cipher&&cipher.cipher_hex.length>100&&
   !cipher.cipher_hex.includes(FAKE_NAME)&&/^[a-f0-9]{24}$/.test(cipher.nonce_hex),
   step,'PLAINTEXT_STORAGE');

  stage('WRONG_DEVICE_DENIED');
  const other=await request('/extension/profile/claim',{
   method:'POST',origin:EXT,token:'hhbaext_'+'0'.repeat(64)
  });
  check(other.status===401,step,'INVALID_DEVICE_ACCEPTED');

  stage('ONCE_CLAIM');
  const claimed=await request('/extension/profile/claim',{method:'POST',origin:EXT,token:extToken});
  check(claimed.status===200&&claimed.result.profile?.fullName===FAKE_NAME&&
   claimed.result.profile?.school===FAKE_SCHOOL&&
   claimed.result.profile?.email===FAKE_MAIL,step,'PROFILE_CLAIM_FAILED');
  const row=await db.prepare('SELECT phone FROM hhba_apply_profile_transfers WHERE phone=?').bind(phone).first();
  check(!row,step,'CIPHERTEXT_NOT_ERASED');

  stage('REPLAY_PROFILE_DENIED');
  const twice=await request('/extension/profile/claim',{method:'POST',origin:EXT,token:extToken});
  check(twice.status===404,step,'PROFILE_REPLAY_ACCEPTED');

  stage('REVOKE');
  const again=await request('/profile-transfer/prepare',{method:'POST',origin:LAB,token,body:payload});
  check(again.status===200,step,'SECOND_PREPARE_FAILED');
  const revoke=await request('/pair/revoke',{method:'POST',origin:LAB,token});
  check(revoke.status===200&&revoke.result.connectedDevices===0,step,'REVOKE_FAILED');
  const revoked=await request('/extension/wallet',{method:'POST',origin:EXT,token:extToken});
  check(revoked.status===401,step,'REVOKED_TOKEN_ACCEPTED');
  const pending=await db.prepare('SELECT phone FROM hhba_apply_profile_transfers WHERE phone=?').bind(phone).first();
  check(!pending,step,'REVOKED_TRANSFER_REMAINS');
  stage('FINISH');
  return {status:'passed',lastStep:step,checks:stageCount};
 }catch(e){
  return {status:'failed',lastStep:step,checks:stageCount,error:safe(e?.message)?e.message:'UNEXPECTED_RESPONSE'};
 }finally{
  if(phone){
   // The phone/resume/session/code are synthetic. Only delete the exact owner.
   try{
    await db.prepare('DELETE FROM hhba_apply_profile_transfers WHERE phone=?').bind(phone).run();
    await db.prepare('DELETE FROM hhba_apply_extension_sessions WHERE phone=?').bind(phone).run();
    await db.prepare('DELETE FROM hhba_apply_pair_codes WHERE phone=?').bind(phone).run();
    await db.prepare('DELETE FROM hhba_candidate_resumes WHERE phone=?').bind(phone).run();
    await db.prepare('DELETE FROM hhba_auth_sessions WHERE phone=?').bind(phone).run();
    await db.prepare('DELETE FROM hhba_auth_users WHERE phone=?').bind(phone).run();
    const checkRow=await db.prepare('SELECT phone FROM hhba_auth_users WHERE phone=?').bind(phone).first();
    cleaned=!checkRow;
   }catch{cleaned=false}
  }else cleaned=true;
  // Use a separate result record, never an account row, for audit:
  // only static step names, pass/fail and count. No transient credentials.
  try{
   await db.prepare('UPDATE hhba_apply_lab_e2e_runs SET finished_at=?,cleanup_verified=? WHERE run_id=?')
    .bind(iso(Date.now()),cleaned?1:0,RUN).run();
  }catch{}
 }
}
export default {
 async fetch(){return new Response('Not found',{status:404})},
 async scheduled(_event,env){
  const db=env?.HHBA_PNVS_AUTH_DB;
  if(env?.HHBA_EDGE_LAB_NETWORK_PROBE_ENABLED!=='1'||!db)return;
  await db.prepare('CREATE TABLE IF NOT EXISTS hhba_apply_lab_e2e_runs(run_id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,last_step TEXT,checks INTEGER NOT NULL DEFAULT 0,error_code TEXT,cleanup_verified INTEGER NOT NULL DEFAULT 0)').run();
  const created=await db.prepare('INSERT OR IGNORE INTO hhba_apply_lab_e2e_runs(run_id,started_at,status) VALUES(?,?,?)')
   .bind(RUN,iso(Date.now()),'running').run();
  if(created?.meta?.changes!==1)return; // one run only; no recurring accounts
  const result=await runProbe(db);
  await db.prepare('UPDATE hhba_apply_lab_e2e_runs SET finished_at=?,status=?,last_step=?,checks=?,error_code=? WHERE run_id=?')
   .bind(iso(Date.now()),result.status,result.lastStep,result.checks,result.error||null,RUN).run();
 }
};
