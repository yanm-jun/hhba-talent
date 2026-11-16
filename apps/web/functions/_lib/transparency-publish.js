import {safeParse,publicReport,validPeriod} from './transparency.js';

// Publication is a separate auditable action. Never publish unreviewed data.
// The published snapshot remains live if a subsequent correction draft is opened.
export async function publishReviewed(db,{period,actor,at=new Date().toISOString()}){
 if(!validPeriod(period))return {ok:false,code:'INVALID_PERIOD'};
 const row=await db.prepare('SELECT * FROM hhba_fin_reports WHERE period=?').bind(period).first();
 if(!row||!row.reviewed_json||!row.reviewed_at)return {ok:false,code:'REPORT_NOT_REVIEWED'};
 if(row.status!=='reviewed'&&row.status!=='published')return {ok:false,code:'INVALID_REPORT_STATE'};
 if(row.status==='published'&&!row.correction_reason)return {ok:false,code:'CORRECTION_REASON_REQUIRED'};
 const currentRevision=Number(row.revision||0);
 const nextRevision=currentRevision+1;
 const reviewed=safeParse(row.reviewed_json);
 if(!reviewed)return {ok:false,code:'INVALID_REVIEW_SNAPSHOT'};
 const oldPublished=row.published_json;
 const update=db.prepare(`UPDATE hhba_fin_reports SET
  status='published',published_json=reviewed_json,reviewed_json=NULL,revision=?,
  published_at=?,corrected_at=?,correction_reason=NULL,updated_at=?
  WHERE period=? AND revision=? AND reviewed_json=?`)
  .bind(nextRevision,at,oldPublished?at:null,at,period,currentRevision,row.reviewed_json);
 const history=db.prepare(`INSERT INTO hhba_fin_publication_revisions(period,revision,published_json,published_at,correction_reason,approved_by)
 VALUES(?,?,?,?,?,?)`)
  .bind(period,nextRevision,row.reviewed_json,at,oldPublished?row.correction_reason:'首期发布',String(row.reviewed_by||actor));
 const audit=db.prepare('INSERT INTO hhba_fin_audit(period,action,actor,event_note,created_at) VALUES(?,?,?,?,?)')
  .bind(period,oldPublished?'corrected':'published',actor,oldPublished?row.correction_reason:'首期月报发布',at);
 try{
  const results=await db.batch([update,history,audit]);
  if(Number(results?.[0]?.meta?.changes||0)!==1)return {ok:false,code:'PUBLICATION_CONFLICT'};
 }catch{return {ok:false,code:'PUBLICATION_STORAGE_FAILED'};}
 const latest=await db.prepare("SELECT period,status,revision,published_at,corrected_at,published_json FROM hhba_fin_reports WHERE period=? AND status='published'").bind(period).first();
 return {ok:true,report:publicReport(latest)};
}
