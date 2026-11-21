import {
 json,failure,financeDb,validPeriod,publicFundReport,normalizeEmail,randomToken,sha256,
 safeOrigin,readJson,checkTurnstile,deliverEmail,publicUrl,htmlEsc,fromAddress,unsubscribeToken
} from '../../_lib/transparency.js';

const noStoreHeaders={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer'};
const subscribeReady=env=>String(env.HHBA_FIN_SUBSCRIPTIONS_ENABLED||'')==='1'&&
 !!financeDb(env)&&!!env.HHBA_FIN_TURNSTILE_SECRET&&
 !!env.HHBA_FIN_TURNSTILE_SITE_KEY&&!!env.RESEND_API_KEY&&!!fromAddress(env)&&
 String(env.HHBA_FIN_UNSUBSCRIBE_SECRET||'').length>=32;
const sqlFail=()=>failure('TRANSPARENCY_STORAGE_NOT_READY',503);
const actionPath=request=>new URL(request.url).pathname.replace(/\/+$/,'');
const days=(n)=>new Date(Date.now()+n*86400000).toISOString();
const renderUnsubscribe=(token)=>new Response(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>取消订阅 · HHBA权益帮扶透明中心</title></head><body style="background:#f3f8f5;color:#1e3f2b;font:15px/1.8 Arial,sans-serif;max-width:600px;margin:8vh auto;padding:26px"><main style="background:white;border:1px solid #dce9df;border-radius:18px;padding:28px"><h1 style="font-size:24px">取消帮扶资金公开邮件订阅</h1><p>此操作仅停止帮扶资金报告邮件，不影响您查看公开帮扶资金报告，也不影响其他独立服务。</p><form method="POST" action="/api/transparency/unsubscribe"><input type="hidden" name="token" value="${htmlEsc(token)}"><button type="submit" style="border:0;color:white;background:#28714a;padding:10px 22px;border-radius:8px;cursor:pointer">确认退订</button></form><p><a style="color:#28714a" href="/transparency">返回权益帮扶透明中心</a></p></main></body></html>`,{
 status:200,headers:{'Content-Type':'text/html; charset=utf-8',...noStoreHeaders,'X-Content-Type-Options':'nosniff'}
});
const renderConfirm=(token)=>new Response(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>确认订阅 · HHBA权益帮扶透明中心</title></head><body style="background:#f3f8f5;color:#1e3f2b;font:15px/1.8 Arial,sans-serif;max-width:600px;margin:8vh auto;padding:26px"><main style="background:white;border:1px solid #dce9df;border-radius:18px;padding:28px"><h1 style="font-size:24px">确认订阅帮扶资金公开邮件</h1><p>只有主动点击下方按钮后，才会开始接收 HHBA 帮扶资金公开邮件。点击邮件链接不会自动完成订阅。</p><form method="POST" action="/api/transparency/confirm"><input type="hidden" name="token" value="${htmlEsc(token)}"><button type="submit" style="border:0;color:white;background:#28714a;padding:10px 22px;border-radius:8px;cursor:pointer">我确认订阅</button></form><p><a href="/transparency" style="color:#28714a">返回权益帮扶透明中心</a></p></main></body></html>`,{
 status:200,headers:{'Content-Type':'text/html; charset=utf-8',...noStoreHeaders,'X-Content-Type-Options':'nosniff'}
});
const donePage=(text)=>new Response(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>HHBA 权益帮扶透明中心</title></head><body style="font:16px/1.9 Arial,sans-serif;color:#264c34;background:#f4f8f5;padding:60px 12px;text-align:center"><h1>${htmlEsc(text)}</h1><a href="/transparency" style="color:#28714a">返回权益帮扶透明中心</a></body></html>`,{status:200,headers:{'Content-Type':'text/html; charset=utf-8',...noStoreHeaders}});

export async function onRequest({request,env}){
 const path=actionPath(request),url=new URL(request.url),db=financeDb(env);
 // HHBA has retired its monthly funding pledge. Reject fresh subscription or
 // confirmation requests even if old environment secrets remain configured.
 // Existing opt-out links and historical read-only records stay available.
 if(path==='/api/transparency/subscribe')return failure('FINANCE_SUBSCRIPTIONS_RETIRED',410);
 if(path==='/api/transparency/confirm')return donePage('财务报告邮件订阅服务已停止');
 if(request.method==='GET'&&(path==='/api/transparency'||path==='/api/transparency/status')){
  return json({ok:true,plan:null,reportStatus:'retired',subscriptionEnabled:false,
   siteKey:null,configured:!!db});
 }
 // Public-only, already redacted publication tables. Separate from private case intake.
 // A missing schema is NOT evidence that no cases or payments ever occurred.
 if(request.method==='GET'&&path==='/api/transparency/cases'){
  if(!db)return json({ok:true,state:'not_ready',cases:[]});
  try{
   const result=await db.prepare(`SELECT id,title,category,case_stage,summary,process_summary,
    outcome_summary,published_at,revised_at
    FROM hhba_worker_public_cases
    WHERE publication_state='published' AND consent_confirmed=1
     AND fact_reviewed=1 AND privacy_reviewed=1
     AND approved_by IS NOT NULL AND published_at IS NOT NULL
    ORDER BY published_at DESC,id DESC LIMIT 60`).all();
   return json({ok:true,state:'ready',cases:(result.results||[]).map(r=>({
    id:r.id,title:r.title,category:r.category,stage:r.case_stage,
    summary:r.summary,processSummary:r.process_summary,outcomeSummary:r.outcome_summary,
    publishedAt:r.published_at,revisedAt:r.revised_at||null
   }))});
  }catch(error){
   if(/no such table/i.test(String(error?.message||error)))return json({ok:true,state:'not_ready',cases:[]});
   return failure('PUBLIC_CASES_UNAVAILABLE',503);
  }
 }
 if(request.method==='GET'&&path==='/api/transparency/ledger'){
  if(!db)return json({ok:true,state:'not_ready',entries:[]});
  try{
   const result=await db.prepare(`SELECT e.id,e.period,e.occurred_on,e.entry_kind,e.amount_fen,e.purpose_summary,
      CASE WHEN c.publication_state='published' AND c.consent_confirmed=1
       AND c.fact_reviewed=1 AND c.privacy_reviewed=1
       AND c.approved_by IS NOT NULL AND c.published_at IS NOT NULL
       THEN c.id ELSE NULL END AS public_case_id
    FROM hhba_fin_public_entries e
    JOIN hhba_fin_reports r ON r.period=e.period AND r.status='published'
    LEFT JOIN hhba_worker_public_cases c ON c.id=e.public_case_id
    WHERE e.publication_state='published' AND e.source_checked=1
     AND e.privacy_reviewed=1 AND e.approved_by IS NOT NULL
     AND e.published_at IS NOT NULL
    ORDER BY e.occurred_on DESC,e.id DESC LIMIT 100`).all();
   return json({ok:true,state:'ready',entries:(result.results||[]).map(r=>({
    id:r.id,period:r.period,date:r.occurred_on,
    kind:r.entry_kind,amountFen:r.amount_fen,
    purpose:r.purpose_summary,caseId:r.public_case_id||null
   }))});
  }catch(error){
   if(/no such table/i.test(String(error?.message||error)))return json({ok:true,state:'not_ready',entries:[]});
   return failure('PUBLIC_LEDGER_UNAVAILABLE',503);
  }
 }
 if(request.method==='GET'&&path==='/api/transparency/reports'){
  if(!db)return json({ok:true,reports:[],reason:'NOT_CONFIGURED'});
  try{
   const result=await db.prepare("SELECT period,status,revision,published_at,corrected_at,published_json FROM hhba_fin_reports WHERE status='published' ORDER BY period DESC LIMIT 48").all();
   return json({ok:true,reports:(result.results||[]).map(publicFundReport).filter(Boolean)});
  }catch{return sqlFail();}
 }
 if(request.method==='GET'&&path==='/api/transparency/report'){
  const period=url.searchParams.get('period');
  if(!validPeriod(period))return failure('INVALID_PERIOD',400);
  if(!db)return sqlFail();
  try{
   const revision=url.searchParams.get('revision');
   if(revision!==null){
    if(!/^[1-9][0-9]{0,5}$/.test(revision))return failure('INVALID_REVISION',400);
    const row=await db.prepare('SELECT published_json,published_at,revision FROM hhba_fin_publication_revisions WHERE period=? AND revision=?').bind(period,Number(revision)).first();
    if(!row)return failure('REPORT_NOT_FOUND',404);
    const report=publicFundReport({period,status:'published',revision:row.revision,published_at:row.published_at,published_json:row.published_json});
    if(!report)return failure('REPORT_NOT_FOUND',404);
    return json({ok:true,report});
   }
   const row=await db.prepare("SELECT period,status,revision,published_at,corrected_at,published_json FROM hhba_fin_reports WHERE period=? AND status='published'").bind(period).first();
   const report=publicFundReport(row);
   if(!report)return failure('REPORT_NOT_FOUND',404);
   return json({ok:true,report});
  }catch{return sqlFail();}
 }
 if(request.method==='POST'&&path==='/api/transparency/subscribe'){
  if(!subscribeReady(env))return failure('SUBSCRIPTIONS_NOT_OPEN',503);
  if(!safeOrigin(request))return failure('ORIGIN_NOT_ALLOWED',403);
  const body=await readJson(request,3500);
  const email=normalizeEmail(body?.email);
  if(!email||body?.consent!==true)return failure('INVALID_SUBSCRIPTION_REQUEST',400);
  if(!await checkTurnstile(env,body?.turnstileToken,new URL(request.url).hostname))return failure('HUMAN_VERIFICATION_REQUIRED',403);
  const hash=await sha256(email),now=new Date().toISOString();
  const generic={ok:true,code:'CHECK_EMAIL_IF_ELIGIBLE'};
  try{
   const previous=await db.prepare('SELECT status,last_verification_sent_at FROM hhba_fin_subscribers WHERE email_hash=?').bind(hash).first();
   if(previous?.status==='verified'||previous?.last_verification_sent_at&&Date.now()-Date.parse(previous.last_verification_sent_at)<86400000)return json(generic);
   const token=randomToken(),tokenHash=await sha256(token),unsubscribeRaw=await unsubscribeToken(env,hash);
   if(!unsubscribeRaw)return failure('SUBSCRIPTIONS_NOT_OPEN',503);
   const unsubscribeHash=await sha256(unsubscribeRaw);
   await db.prepare(`INSERT INTO hhba_fin_subscribers(email_hash,email,status,verify_token_hash,verify_expires_at,unsubscribe_token_hash,last_verification_sent_at,consent_version,consent_at,created_at,updated_at)
    VALUES(?,?,'pending',?,?,?,?,? ,?,?,?)
    ON CONFLICT(email_hash) DO UPDATE SET email=excluded.email,status='pending',verify_token_hash=excluded.verify_token_hash,verify_expires_at=excluded.verify_expires_at,
     unsubscribe_token_hash=excluded.unsubscribe_token_hash,last_verification_sent_at=excluded.last_verification_sent_at,consent_version=excluded.consent_version,consent_at=excluded.consent_at,updated_at=excluded.updated_at`)
    .bind(hash,email,tokenHash,days(2),unsubscribeHash,now,'transparency-email-v1',now,now,now).run();
   const link=publicUrl(env)+'/api/transparency/confirm?token='+encodeURIComponent(token);
   const html='<h1>HHBA 帮扶资金公开邮件订阅确认</h1><p>您申请订阅每月21日公开的财务报告。请点击以下链接，并在打开的页面主动确认订阅；若非本人申请，请忽略，未确认不会订阅。</p><p><a href="'+htmlEsc(link)+'">确认订阅财务报告</a></p><p>链接48小时内有效。不含招聘营销邮件。</p>';
   const sent=await deliverEmail(env,{to:email,subject:'请确认 HHBA 帮扶资金公开邮件订阅',html,idempotencyKey:'finance-optin-'+tokenHash.slice(0,36)});
   if(!sent.ok)console.error('HHBA_FIN_OPTIN_SEND_FAILED',sent.code);
   return json(generic);
  }catch(e){console.error('HHBA_FIN_SUBSCRIBE_FAILED',e?.name||'error');return failure('SUBSCRIPTION_TEMPORARILY_UNAVAILABLE',503);}
 }
 if(request.method==='GET'&&path==='/api/transparency/confirm'){
  const token=url.searchParams.get('token');
  if(!/^[a-f0-9]{64}$/.test(token||''))return donePage('确认链接无效或已过期');
  if(!db)return donePage('订阅暂不可用');
  // Email scanners commonly prefetch GET links. Rendering is read-only.
  return renderConfirm(token);
 }
 if(request.method==='POST'&&path==='/api/transparency/confirm'){
  if(!db)return donePage('订阅暂不可用');
  if(!safeOrigin(request))return failure('ORIGIN_NOT_ALLOWED',403);
  if(!(request.headers.get('Content-Type')||'').includes('application/x-www-form-urlencoded'))
   return failure('INVALID_CONFIRMATION_FORM',400);
  let token='';
  try{
   const form=await request.formData();
   token=String(form.get('token')||'');
  }catch{return failure('INVALID_CONFIRMATION_FORM',400);}
  if(!/^[a-f0-9]{64}$/.test(token))return donePage('确认链接无效或已过期');
  try{
   const digest=await sha256(token),now=new Date().toISOString();
   const result=await db.prepare("UPDATE hhba_fin_subscribers SET status='verified',verified_at=?,verify_token_hash=NULL,verify_expires_at=NULL,updated_at=? WHERE verify_token_hash=? AND status='pending' AND verify_expires_at>?").bind(now,now,digest,now).run();
   return donePage(Number(result.meta?.changes||0)>0?'邮箱已验证，成功订阅帮扶资金公开邮件':'确认链接已使用或过期');
  }catch{return donePage('订阅确认暂不可用');}
 }
 if(request.method==='GET'&&path==='/api/transparency/unsubscribe'){
  const token=url.searchParams.get('token');
  if(!/^[a-f0-9]{64}$/.test(token||''))return donePage('退订链接无效');
  return renderUnsubscribe(token);
 }
 if(request.method==='POST'&&path==='/api/transparency/unsubscribe'){
  if(!db)return donePage('退订暂不可用');
  // RFC 8058 one-click POST carries List-Unsubscribe=One-Click in the body;
  // the signed unsubscribe token remains in the URL query parameter.
  // Keep the same path working for the interactive confirmation form.
  let token=String(url.searchParams.get('token')||'');
  const type=request.headers.get('Content-Type')||'';
  if(type.includes('application/x-www-form-urlencoded')){
   const body=await request.formData();token=String(body.get('token')||token);
  }else if(type.includes('application/json')){
   const body=await readJson(request,1500);token=String(body?.token||token);
  }
  if(!/^[a-f0-9]{64}$/.test(token))return donePage('退订链接无效');
  try{
   const now=new Date().toISOString(),digest=await sha256(token);
   await db.prepare("UPDATE hhba_fin_subscribers SET status='unsubscribed',email=NULL,verify_token_hash=NULL,unsubscribe_token_hash=NULL,unsubscribed_at=?,updated_at=? WHERE unsubscribe_token_hash=? AND status IN ('pending','verified')").bind(now,now,digest).run();
   return donePage('已完成退订，后续不再发送月度帮扶资金报告邮件');
  }catch{return donePage('退订暂不可用，请稍后再试');}
 }
 return failure('NOT_FOUND',404);
}
