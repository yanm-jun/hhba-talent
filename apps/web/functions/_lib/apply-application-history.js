// Separate, user-owned application history. No email inbox, ATS cookies,
// screenshots, applicant contact details, AI prompts or payment ledgers.
const NAME_MAX=100;
const RECEIPTS=new Set(['success_notice','receipt_marker']);
const STATES=new Set(['pending','confirmed','manual']);
const SOURCES=new Set(['edge','manual']);
const QUERY_KEYS=new Set(['jobid','job_id','positionid','position_id','reqid','requisitionid','gh_jid','job','jid','id']);
const iso=()=>new Date().toISOString();
const text=s=>typeof s==='string'?s.trim().replace(/\s+/g,' ').slice(0,NAME_MAX):'';
export function normalizeJobUrl(raw){
 if(typeof raw!=='string'||raw.length>1600)return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname.length>240||
   u.hostname==='localhost'||u.hostname.endsWith('.localhost')||
   u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||
   /^(?:\d+\.){3}\d+$/.test(u.hostname)||
   !u.hostname.includes('.'))return null;
  const p=new URLSearchParams();
  for(const [key,val] of u.searchParams){
   if(QUERY_KEYS.has(key.toLowerCase())&&/^[A-Za-z0-9_-]{1,110}$/.test(val)&&p.size<4)
    p.append(key.toLowerCase(),val);
  }
  u.hash='';u.search=p.toString();u.pathname=u.pathname.replace(/\/{2,}/g,'/');
  return u.origin+u.pathname+(u.search||'');
 }catch{return null}
}
export function validateApplication(input,{extension=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const company=text(input.company),position=text(input.position);
 if(company.length<2||position.length<2)return null;
 const applicationUrl=normalizeJobUrl(input.applicationUrl);
 if(!applicationUrl)return null;
 const status=input.status,source=extension?'edge':'manual';
 if(!STATES.has(status)||(extension&&status==='manual'))return null;
 const evidenceKind=typeof input.evidenceKind==='string'?input.evidenceKind:'none';
 if(status==='confirmed'&&(!extension||!RECEIPTS.has(evidenceKind)))return null;
 if(status==='manual'&&evidenceKind!=='self_report')return null;
 if(status==='pending'&&evidenceKind!=='none')return null;
 if(!['none','success_notice','receipt_marker','self_report'].includes(evidenceKind))return null;
 return {company,position,applicationUrl,status,source,evidenceKind};
}
async function jobKey(entry){
 const s=[entry.company.toLocaleLowerCase('zh-CN'),entry.position.toLocaleLowerCase('zh-CN'),entry.applicationUrl].join('\x1f');
 const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
 return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');
}
const select='SELECT id,company,position,application_url AS applicationUrl,status,source,evidence_kind AS evidenceKind,recorded_at AS recordedAt,updated_at AS updatedAt FROM hhba_candidate_applications';
export async function saveApplication(db,phone,input,extension=false){
 const e=validateApplication(input,{extension});
 if(!e)return {ok:false,status:400,error:'INVALID_APPLICATION'};
 const key=await jobKey(e);
 const existing=await db.prepare('SELECT id,status FROM hhba_candidate_applications WHERE phone=? AND job_key=?').bind(phone,key).first();
 if(!existing){
  const count=await db.prepare('SELECT COUNT(*) AS n FROM hhba_candidate_applications WHERE phone=?').bind(phone).first();
  if(Number(count?.n||0)>=200)return {ok:false,status:429,error:'APPLICATION_LIMIT'};
 }
 const now=iso(),id=existing?.id||crypto.randomUUID();
 // A later "pending" or self-report cannot erase a recorded success notice.
 await db.prepare(`INSERT INTO hhba_candidate_applications
 (id,phone,job_key,company,position,application_url,status,source,evidence_kind,recorded_at,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(phone,job_key) DO UPDATE SET
  status=CASE WHEN hhba_candidate_applications.status='confirmed' THEN 'confirmed' ELSE excluded.status END,
  source=CASE WHEN hhba_candidate_applications.status='confirmed' THEN hhba_candidate_applications.source ELSE excluded.source END,
  evidence_kind=CASE WHEN hhba_candidate_applications.status='confirmed' THEN hhba_candidate_applications.evidence_kind ELSE excluded.evidence_kind END,
  updated_at=excluded.updated_at`)
 .bind(id,phone,key,e.company,e.position,e.applicationUrl,e.status,e.source,e.evidenceKind,now,now).run();
 const record=await db.prepare(select+' WHERE phone=? AND job_key=?').bind(phone,key).first();
 return {ok:true,record};
}
export async function listApplications(db,phone){
 const rows=await db.prepare(select+' WHERE phone=? ORDER BY updated_at DESC LIMIT 200').bind(phone).all();
 return {ok:true,items:rows.results||[]};
}
export async function deleteApplication(db,phone,id){
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))return {ok:false,status:400,error:'INVALID_APPLICATION_ID'};
 const x=await db.prepare('DELETE FROM hhba_candidate_applications WHERE phone=? AND id=?').bind(phone,id).run();
 return {ok:true,deleted:Number(x?.meta?.changes||0)===1};
}
