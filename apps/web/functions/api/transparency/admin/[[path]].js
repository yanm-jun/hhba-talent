import {verifyAdmin} from '../../../_lib/admin-access.js';
import {
 json,failure,financeDb,validPeriod,cleanPeriodPayload,readJson,safeOrigin,
 priorMonth,safeParse,publicReport
} from '../../../_lib/transparency.js';
import {publishReviewed} from '../../../_lib/transparency-publish.js';

const pathOf=request=>new URL(request.url).pathname.replace(/\/+$/,'');
const timestamp=()=>new Date().toISOString();
const toPrivateReport=row=>row?{
 period:row.period,status:row.status,revision:row.revision,preparedBy:row.prepared_by,
 reviewedBy:row.reviewed_by,reviewedAt:row.reviewed_at,publishedAt:row.published_at,
 correctionReason:row.correction_reason||null,reviewNote:row.review_note||null,
 draft:safeParse(row.draft_json),published:row.status==='published'?publicReport(row):null
}:null;

export async function onRequest({request,env}){
 // Cloudflare Access identity must be cryptographically verified AND use
 // a dedicated audience/email for the finance console.
 const admin=await verifyAdmin(request,env);
 if(!admin.ok)return failure(admin.code,admin.status);
 const db=financeDb(env);
 if(!db)return failure('TRANSPARENCY_DATABASE_NOT_BOUND',503);
 const path=pathOf(request),now=timestamp();
 if(request.method==='GET'){
  try{
   if(path==='/api/transparency/admin/status'){
    const rows=await db.prepare('SELECT * FROM hhba_fin_reports ORDER BY period DESC LIMIT 36').all();
    const counts=await db.prepare("SELECT status,COUNT(*) AS n FROM hhba_fin_subscribers GROUP BY status").all();
    return json({ok:true,admin:admin.email,checks:{database:true,access:true,
      financialSource:'MANUAL_DOCUMENTED_INPUT',automation:'APPROVED_REPORTS_ONLY'},
      reports:(rows.results||[]).map(toPrivateReport),
      subscribers:Object.fromEntries((counts.results||[]).map(r=>[r.status,Number(r.n)]))});
   }
   if(path==='/api/transparency/admin/report'){
    const period=new URL(request.url).searchParams.get('period');
    if(!validPeriod(period))return failure('INVALID_PERIOD',400);
    const row=await db.prepare('SELECT * FROM hhba_fin_reports WHERE period=?').bind(period).first();
    return row?json({ok:true,report:toPrivateReport(row)}):failure('REPORT_NOT_FOUND',404);
   }
  }catch(e){console.error('HHBA_FIN_ADMIN_READ_FAILED',e?.name||'error');return failure('DATABASE_ERROR',503);}
  return failure('NOT_FOUND',404);
 }
 if(request.method!=='POST')return failure('METHOD_NOT_ALLOWED',405);
 if(!safeOrigin(request))return failure('ORIGIN_DENIED',403);
 const body=await readJson(request,28000);
 if(!body)return failure('INVALID_JSON',400);
 const period=body.period;
 if(!validPeriod(period))return failure('INVALID_PERIOD',400);
 try{
  const old=await db.prepare('SELECT * FROM hhba_fin_reports WHERE period=?').bind(period).first();
  if(path==='/api/transparency/admin/draft'||path==='/api/transparency/admin/correction'){
   const payload=cleanPeriodPayload(body.report);
   if(!payload||payload.period!==period)return failure('FINANCIAL_FIELDS_INVALID_OR_INCONSISTENT',400);
   // Avoid future and current months passing as completed finance statements.
   if(period>priorMonth())return failure('MONTH_NOT_CLOSED',400);
   const isCorrection=path.endsWith('/correction');
   if(isCorrection&&old?.status!=='published')return failure('ONLY_PUBLISHED_REPORTS_CAN_BE_CORRECTED',409);
   if(!isCorrection&&old?.status==='published')return failure('USE_CORRECTION_WITH_REASON',409);
   const reason=String(body.correctionReason||'').trim();
   if(isCorrection&&(reason.length<20||reason.length>1000))return failure('CORRECTION_REASON_REQUIRED',400);
   const text=JSON.stringify(payload);
   if(old){
    const result=await db.prepare(`UPDATE hhba_fin_reports SET
      draft_json=?,reviewed_json=NULL,reviewed_at=NULL,reviewed_by=NULL,review_note=NULL,
      status=?,correction_reason=?,prepared_by=?,updated_at=?
      WHERE period=? AND revision=?`)
      .bind(text,isCorrection?'published':'draft',isCorrection?reason:null,admin.email,now,period,old.revision).run();
    if(Number(result.meta?.changes||0)!==1)return failure('REVISION_CONFLICT',409);
   }else{
    if(isCorrection)return failure('REPORT_NOT_FOUND',404);
    await db.prepare(`INSERT INTO hhba_fin_reports
      (period,status,draft_json,revision,prepared_by,created_at,updated_at)
      VALUES(?,'draft',?,0,?,?,?)`).bind(period,text,admin.email,now,now).run();
   }
   await db.prepare('INSERT INTO hhba_fin_audit(period,action,actor,event_note,created_at) VALUES(?,?,?,?,?)')
     .bind(period,isCorrection?'correction_draft':'saved_draft',admin.email,isCorrection?reason:'草稿录入或更新',now).run();
   return json({ok:true,code:isCorrection?'CORRECTION_DRAFT_SAVED':'DRAFT_SAVED'});
  }
  if(path==='/api/transparency/admin/review'){
   if(!old)return failure('REPORT_NOT_FOUND',404);
   if(old.status!=='draft'&&old.status!=='published')return failure('INVALID_STATE',409);
   if(old.status==='published'&&!old.correction_reason)return failure('NOT_A_CORRECTION_DRAFT',409);
   if(body.ledgerReconciled!==true||body.privacyReviewed!==true||
     body.legalDistributionBasisChecked!==true||body.noFabricationAttested!==true)return failure('REVIEW_CHECKLIST_INCOMPLETE',400);
   const note=String(body.reviewNote||'').trim();
   if(note.length<30||note.length>1500)return failure('REVIEW_NOTE_REQUIRED',400);
   const data=cleanPeriodPayload(safeParse(old.draft_json));
   if(!data)return failure('INVALID_DRAFT',409);
   if(data.isAudited===true)return failure('INDEPENDENT_AUDIT_EVIDENCE_MODULE_NOT_READY',409);
   const updated=await db.prepare(`UPDATE hhba_fin_reports SET status=?,reviewed_json=draft_json,
     reviewed_by=?,review_note=?,reviewed_at=?,updated_at=?
     WHERE period=? AND revision=? AND draft_json=?`)
     .bind(old.status==='published'?'published':'reviewed',admin.email,note,now,now,period,old.revision,old.draft_json).run();
   if(Number(updated.meta?.changes||0)!==1)return failure('REVISION_CONFLICT',409);
   await db.prepare('INSERT INTO hhba_fin_audit(period,action,actor,event_note,created_at) VALUES(?,?,?,?,?)')
     .bind(period,'reviewed',admin.email,note,now).run();
   return json({ok:true,code:'REPORT_REVIEWED_NOT_PUBLIC'});
  }
  if(path==='/api/transparency/admin/publish'){
   if(body.confirmPublish!==true)return failure('EXPLICIT_PUBLICATION_CONFIRMATION_REQUIRED',400);
   if(period>priorMonth())return failure('MONTH_NOT_CLOSED',400);
   // A human may manually release a delayed month but not early-publish the
   // previous month's report before the 21st Beijing time.
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const inCurrentPriorMonth=period===priorMonth();
   if(inCurrentPriorMonth&&Number(today.slice(-2))<21)return failure('REPORT_PUBLICATION_NOT_DUE',409);
   const result=await publishReviewed(db,{period,actor:admin.email,at:now});
   return result.ok?json(result):failure(result.code,409);
  }
 }catch(e){console.error('HHBA_FIN_ADMIN_WRITE_FAILED',e?.name||'error');return failure('DATABASE_ERROR',503);}
 return failure('NOT_FOUND',404);
}
