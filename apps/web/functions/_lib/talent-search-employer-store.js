/**
 * HHBA Talent Intelligence — D1 read-only audited employer-source resolver.
 *
 * No registration forms, search snippets, jobs/AI outputs or candidate-provided
 * flags can create/approve proof. An independent authorized process must audit
 * and add records after the opt-in D1 migration has been reviewed/applied.
 *
 * This repository never writes to D1 and is safe to use for shadow tests.
 */
import { recruitmentSourceKind } from './match-employer-source.js';
import { isAuditedEmployerProof } from './talent-search-official-proof.js';

function safeHost(url) {
  try {
    if (typeof url !== 'string' || url.length > 4096) return null;
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname)) return null;
    return u;
  } catch { return null; }
}
function hostUnder(host, root) {
  const hostname = String(host||'').toLowerCase();
  const domain = String(root||'').toLowerCase();
  return !!hostname && !!domain && (hostname===domain || hostname.endsWith('.'+domain));
}
function aliasesOf(value) {
  if (typeof value !== 'string' || value.length > 3000) return [];
  try {
    const list=JSON.parse(value);
    return Array.isArray(list)?list.filter(x=>typeof x==='string'&&x.length>=2&&x.length<=150).slice(0,8):[];
  } catch { return []; }
}
function normalizedRecord(row, at) {
  if(!row || typeof row!=='object')return null;
  const proof={
    record_id:row.id,
    company:row.company,
    aliases:aliasesOf(row.aliases_json),
    official_domain:row.official_domain,
    careers_url:row.careers_url,
    issuer:row.issuer,
    status:row.status,
    verified_at:row.verified_at,
    evidence_url:row.evidence_url,
    evidence_quote:row.evidence_quote,
    ats_tenant_prefix:row.tenant_prefix || null,
    ats_host:row.ats_host || null,
    authorized_careers_url:row.authorized_careers_url || null,
  };
  if(!isAuditedEmployerProof(proof,at))return null;
  if(!safeHost(proof.careers_url) ||
    !hostUnder(new URL(proof.careers_url).hostname,proof.official_domain))return null;
  if(proof.ats_host){
    if(typeof proof.ats_tenant_prefix!=='string'||
      !proof.ats_tenant_prefix.startsWith('/')||
      proof.ats_tenant_prefix.length<3)return null;
    const authorized=safeHost(proof.authorized_careers_url);
    if(!authorized || !hostUnder(authorized.hostname,proof.official_domain))return null;
  }
  return proof;
}

const FIRST_PARTY_SQL=[
  'SELECT id,company,aliases_json,official_domain,careers_url,issuer,status,',
  'verified_at,evidence_url,evidence_quote',
  'FROM hhba_talent_employer_proofs_v1',
  "WHERE status='verified'",
  "AND (official_domain=?1 OR ?1 LIKE '%.' || official_domain)",
  'ORDER BY LENGTH(official_domain) DESC LIMIT 1'
].join(' ');
const ATS_SQL=[
  'SELECT e.id,e.company,e.aliases_json,e.official_domain,e.careers_url,',
  'e.issuer,e.status,e.verified_at,e.evidence_url,e.evidence_quote,',
  't.ats_host,t.tenant_prefix,t.authorized_careers_url',
  'FROM hhba_talent_ats_tenants_v1 t',
  'JOIN hhba_talent_employer_proofs_v1 e ON e.id=t.employer_proof_id',
  "WHERE t.status='verified' AND e.status='verified'",
  'AND t.ats_host=?1',
  "AND (?2=t.tenant_prefix OR ?2 LIKE t.tenant_prefix || '/%')",
  'ORDER BY LENGTH(t.tenant_prefix) DESC LIMIT 1'
].join(' ');

export function createD1TalentEmployerResolver(db,options={}){
  if(!db || typeof db.prepare!=='function')throw Error('TALENT_PROVENANCE_D1_REQUIRED');
  const at=options.now instanceof Date?options.now:options.now?new Date(options.now):null;
  // Deliberately no long-lived cache. Revocations should become effective
  // with the next lookup; a distributed cache can be added with invalidation.
  async function getEmployerProof(hit) {
    const job=safeHost(hit?.url);
    if(!job || recruitmentSourceKind(job.href)==='THIRD_PARTY_BOARD')return null;
    try {
      let row;
      if(recruitmentSourceKind(job.href)==='EMPLOYER_ATS'){
        row=await db.prepare(ATS_SQL).bind(job.hostname,job.pathname).first();
      } else {
        row=await db.prepare(FIRST_PARTY_SQL).bind(job.hostname).first();
      }
      const proof=normalizedRecord(row,at||new Date());
      if(!proof)return null;
      // An ATS tenant authorizes only the audited path, never the vendor host.
      if(proof.ats_host){
        if(job.hostname!==proof.ats_host ||
          (job.pathname!==proof.ats_tenant_prefix &&
           !job.pathname.startsWith(proof.ats_tenant_prefix+'/')))return null;
      }else if(!hostUnder(job.hostname,proof.official_domain))return null;
      return proof;
    }catch{
      // Missing migrations, revoked rows, D1 limit, or transient errors
      // must fail closed; do not silently convert unverified sources to official.
      return null;
    }
  }
  async function getOfficialCareersUrl(proof) {
    if(!isAuditedEmployerProof(proof,at||new Date()))return null;
    const url=safeHost(proof.authorized_careers_url||proof.careers_url);
    return url && hostUnder(url.hostname,proof.official_domain)?url.href:null;
  }
  return {getEmployerProof,getOfficialCareersUrl};
}
