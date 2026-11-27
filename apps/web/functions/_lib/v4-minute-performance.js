// UTC-minute observations only. The rows contain neither identifiers nor
// URLs. Main phase and independently completed job events stay separate:
// otherwise a JD delivered twice (worker then main merge) looks like two JDs.
const sources=new Set(['phase','independent']);
const kinds=new Set(['candidate','jd','score','report']);
const validTime=v=>Number.isSafeInteger(v)&&v>0&&Number.isFinite(new Date(v).getTime());
export function v4MinuteSamples(events,{source='phase',finished=Date.now()}={}){
 if(!sources.has(source)||!Array.isArray(events))return [];
 const grouped=new Map();
 for(const e of events){
  if(!e||!kinds.has(e.kind))continue;
  const at=validTime(e.at)?e.at:finished;
  if(!validTime(at))continue;
  const minute=new Date(Math.floor(at/60000)*60000).toISOString().slice(0,16)+'Z';
  const key=minute+':'+source+':'+e.kind;
  grouped.set(key,{minute_utc:minute,source,kind:e.kind,events:(grouped.get(key)?.events||0)+1});
 }
 return [...grouped.values()];
}
export async function recordV4MinuteOps(db,events,options={}){
 if(!db?.prepare)return false;
 const rows=v4MinuteSamples(events,options);
 if(!rows.length)return true;
 try{
  const q=`INSERT INTO hhba_v4_minute_ops(minute_utc,source,kind,events)
   VALUES(?,?,?,?) ON CONFLICT(minute_utc,source,kind)
   DO UPDATE SET events=events+excluded.events`;
  for(const r of rows)await db.prepare(q).bind(r.minute_utc,r.source,r.kind,r.events).run();
  return true;
 }catch{console.warn('HHBA_V4_MINUTE_METRICS_UNAVAILABLE');return false;}
}
export async function readV4MinuteOps(db,since,until){
 if(!db?.prepare)return {quality:'unavailable'};
 try{
  const result=await db.prepare(`SELECT minute_utc,source,
   SUM(CASE WHEN kind='candidate' THEN events ELSE 0 END) candidates,
   SUM(CASE WHEN kind='jd' THEN events ELSE 0 END) jds,
   SUM(CASE WHEN kind='score' THEN events ELSE 0 END) scores,
   SUM(CASE WHEN kind='report' THEN events ELSE 0 END) reports
   FROM hhba_v4_minute_ops
   WHERE minute_utc>=? AND minute_utc<?
   GROUP BY minute_utc,source ORDER BY minute_utc DESC,source LIMIT 120`)
   .bind(since+'T00:00',new Date(Date.parse(until+'T00:00:00Z')+86400000).toISOString().slice(0,10)+'T00:00').all();
  const rows=result?.results||[];
  return {quality:rows.length?'collected':'no_records',
   scope:'ANONYMOUS_UTC_MINUTE_OBSERVATIONS_SEPARATE_PHASE_AND_INDEPENDENT_NOT_UNIQUE_JOBS',
   rows};
 }catch{return {quality:'unavailable'};}
}
