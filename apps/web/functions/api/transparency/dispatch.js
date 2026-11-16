import {
 json,failure,financeDb,isCurrentPublicationDay,priorMonth,sha256,
 publicReport,deliverEmail,unsubscribeToken,publicUrl,htmlEsc,fromAddress
} from '../../_lib/transparency.js';
import {publishReviewed} from '../../_lib/transparency-publish.js';

function constantTimeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let sum=0;for(let i=0;i<a.length;i++)sum|=a.charCodeAt(i)^b.charCodeAt(i);
 return sum===0;
}
function configured(env){
 return String(env.HHBA_FIN_SEND_ENABLED||'')==='1'&&!!financeDb(env)&&
  String(env.HHBA_FIN_DISPATCH_SECRET||'').length>=40&&
  String(env.HHBA_FIN_UNSUBSCRIBE_SECRET||'').length>=32&&
  !!env.RESEND_API_KEY&&!!fromAddress(env);
}
const money=n=>'¥'+(Number(n||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
function reportEmail({report,unsubscribe,link}){
 const u=htmlEsc(unsubscribe),r=htmlEsc(link),period=htmlEsc(report.period);
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body style="margin:0;background:#f1f7f3;padding:28px 12px;font:14px/1.8 Arial,Microsoft YaHei,sans-serif;color:#25432f"><div style="max-width:620px;margin:auto;padding:30px;background:white;border:1px solid #dce9df;border-radius:16px"><div style="font-weight:bold;color:#2e7750">HHBA · 财务透明中心</div><h1 style="font-size:24px"> ${period}月度财务公开报告 </h1><p>这份报告已在 HHBA 公开发布。您收到本邮件是因为此前自主验证了订阅邮箱。</p><p>本期营业收入：<strong>${htmlEsc(money(report.revenueFen))}</strong><br>月度经营结果：<strong>${htmlEsc(money(report.netResultFen))}</strong><br>本期依法确认的可分配利润基数：<strong>${htmlEsc(money(report.distributableProfitFen))}</strong><br>劳动者权益帮扶池本期计提：<strong>${htmlEsc(money(report.poolAccrualFen))}</strong><br>帮扶池期末结余：<strong>${htmlEsc(money(report.closingPoolFen))}</strong></p><p><a href="${r}" style="background:#267247;color:white;border-radius:7px;text-decoration:none;display:inline-block;padding:9px 17px">查看完整报告及计算说明</a></p><hr style="border:0;border-top:1px solid #dce9df"><p style="font-size:12px;color:#728276">60/40分配是依法核算后的可分配利润原则，不是营业流水分成。报告是否审计以文内标识为准。本邮件不包含招募营销。</p><p style="font-size:12px"><a href="${u}" style="color:#377858">不想再收到这类财务公开邮件？点此取消订阅</a></p></div></body></html>`;
}
async function sendNextBatch(db,env,period,report){
 const now=new Date().toISOString();
 const unsubSecret=String(env.HHBA_FIN_UNSUBSCRIBE_SECRET||'');
 if(unsubSecret.length<32)return {attempted:0,sent:0,failed:0};
 await db.prepare(`INSERT OR IGNORE INTO hhba_fin_deliveries(period,email_hash,status,attempts,updated_at)
  SELECT ?,email_hash,'pending',0,? FROM hhba_fin_subscribers WHERE status='verified' AND email IS NOT NULL`).bind(period,now).run();
 // No sending after unsubscription: only verified emails are in this JOIN.
 const queue=await db.prepare(`SELECT d.email_hash,s.email,d.status,d.attempts
  FROM hhba_fin_deliveries d JOIN hhba_fin_subscribers s ON s.email_hash=d.email_hash
  WHERE d.period=? AND s.status='verified' AND s.email IS NOT NULL AND d.attempts<3
   AND (d.status IN ('pending','failed') OR (d.status='sending' AND d.lease_until<?))
  ORDER BY d.updated_at ASC LIMIT 30`).bind(period,now).all();
 let attempted=0,sent=0,failed=0;
 for(const item of queue.results||[]){
  const lockTime=new Date(Date.now()+4*60000).toISOString();
  const claim=await db.prepare(`UPDATE hhba_fin_deliveries SET status='sending',attempts=attempts+1,
    lease_until=?,updated_at=? WHERE period=? AND email_hash=? AND attempts<3
    AND (status IN ('pending','failed') OR (status='sending' AND lease_until<?))`)
   .bind(lockTime,now,period,item.email_hash,now).run();
  if(Number(claim.meta?.changes||0)!==1)continue;
  attempted++;
  const raw=await unsubscribeToken(env,item.email_hash);
  if(!raw){failed++;continue;}
  const unsub=publicUrl(env)+'/api/transparency/unsubscribe?token='+encodeURIComponent(raw);
  const link=publicUrl(env)+'/transparency?period='+encodeURIComponent(period);
  const output=await deliverEmail(env,{
   to:item.email,
   subject:'HHBA '+period+'月度财务与劳动者权益帮扶报告',
   html:reportEmail({report,unsubscribe:unsub,link}),
   idempotencyKey:'hhba-fin-v1-'+period+'-'+item.email_hash.slice(0,48),
   headers:{'List-Unsubscribe':'<'+unsub+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}
  });
  const ended=new Date().toISOString();
  if(output.ok){
   await db.prepare(`UPDATE hhba_fin_deliveries SET status='sent',lease_until=NULL,
    provider_message_id=?,sent_at=?,last_error_code=NULL,updated_at=?
    WHERE period=? AND email_hash=?`)
    .bind(output.id,ended,ended,period,item.email_hash).run();
   sent++;
  }else{
   await db.prepare(`UPDATE hhba_fin_deliveries SET status='failed',lease_until=NULL,
    last_error_code=?,updated_at=? WHERE period=? AND email_hash=?`)
    .bind(output.code||'MAIL_PROVIDER_ERROR',ended,period,item.email_hash).run();
   failed++;
  }
 }
 return {attempted,sent,failed};
}

export async function onRequestPost({request,env}){
 const secret=String(env.HHBA_FIN_DISPATCH_SECRET||'');
 const candidate=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 if(secret.length<40||!constantTimeEqual(candidate,secret))return failure('UNAUTHORIZED',401);
 if(!configured(env))return failure('DISPATCH_NOT_CONFIGURED',503);
 if(!isCurrentPublicationDay())return failure('NOT_MONTHLY_PUBLICATION_WINDOW',409);
 const period=priorMonth(),db=financeDb(env);
 try{
  // Expired, unverified addresses are not kept forever. Keep a one-week
  // grace window for mail delivery while retaining no obsolete opt-in PII.
  const expiredAt=new Date(Date.now()-7*86400000).toISOString();
  await db.prepare("DELETE FROM hhba_fin_subscribers WHERE status='pending' AND verify_expires_at<?").bind(expiredAt).run();
  let row=await db.prepare('SELECT * FROM hhba_fin_reports WHERE period=?').bind(period).first();
  if(!row)return json({ok:true,code:'NO_APPROVED_REPORT_NO_EMAIL',period,attempted:0});
  if(row.status==='reviewed'&&row.reviewed_json){
   const published=await publishReviewed(db,{period,actor:'scheduled-dispatch'});
   if(!published.ok)return failure(published.code,409);
  }
  row=await db.prepare("SELECT period,status,revision,published_at,corrected_at,published_json FROM hhba_fin_reports WHERE period=? AND status='published'").bind(period).first();
  const report=publicReport(row);
  if(!report)return json({ok:true,code:'NO_PUBLISHED_REPORT_NO_EMAIL',period,attempted:0});
  const delivery=await sendNextBatch(db,env,period,report);
  return json({ok:true,period,code:'PUBLISHED_REPORT_DISPATCH',...delivery});
 }catch(e){console.error('HHBA_FIN_DISPATCH_FAILED',e?.name||'error');return failure('DISPATCH_TEMPORARILY_UNAVAILABLE',503);}
}
