// Network smoke test run inside GitHub Actions.
// No JD bodies are stored in git or Pages artifacts. Only metadata checks are logged.
import {readFile} from 'node:fs/promises';
const snapshot=JSON.parse(await readFile('dist/data/jobs.json','utf8'));
const candidates=snapshot.jobs.filter(j=>j.platform==='greenhouse'&&j.source==='airtable'&&
  /^greenhouse-airtable-[A-Za-z0-9_-]+$/.test(j.id));
if(candidates.length===0)throw Error('Airtable official Greenhouse sample missing from current public index');
const selection=candidates.find(j=>/Account Executive, Corporate/i.test(j.title)) || candidates[0];
const native=selection.id.slice('greenhouse-airtable-'.length);
const endpoint='https://boards-api.greenhouse.io/v1/boards/airtable/jobs/'+encodeURIComponent(native)+'?content=true';
const reply=await fetch(endpoint,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(25000)});
if(!reply.ok)throw Error('Airtable official detail unavailable: HTTP '+reply.status);
const body=await reply.json();
if(String(body.id)!==native||typeof body.content!=='string'||body.content.length<100)
  throw Error('Official detail ID mismatch or job requirements missing');
const readable=body.content.replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/gi,' ').replace(/\s+/g,' ').trim();
const hasRequirements=/qualification|requirement|experience|skills|ability|responsibilit/i.test(readable);
if(!hasRequirements)throw Error('Real Airtable JD does not contain recognizable requirements');
const callback='hhbaOfficialJdProbe';
const jsonp=new URL(endpoint);
jsonp.searchParams.set('callback',callback);
const publicReader=await fetch(jsonp,{redirect:'error',signal:AbortSignal.timeout(12000)});
if(!publicReader.ok)throw new Error('Official Greenhouse JSONP endpoint unavailable');
const jsonpText=await publicReader.text();
const prefix=jsonpText.trim().replace(/^\/\*[\s\S]*?\*\/\s*/, '');
console.log('OFFICIAL_JSONP_PROBE',JSON.stringify({contentType:publicReader.headers.get('content-type'),firstCharacters:prefix.slice(0,70),length:jsonpText.length}));
if(!prefix.startsWith(callback+'('))
  throw new Error('Official Greenhouse API did not honor the JSONP callback');
const liveDetail='https://hhba-web-production-024c.up.railway.app/api/jobs/'+encodeURIComponent(selection.id);
const corsOrigin='https://yanm-jun.github.io';
const existing=await fetch(liveDetail,{headers:{Origin:corsOrigin,Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(30000)});
if(!existing.ok || existing.headers.get('access-control-allow-origin')!==corsOrigin)
  throw new Error('Green detail service has not opened the exact Pages read origin');
const json=await existing.json();
if(json?.job?.id!==selection.id || typeof json?.description!=='string'||json.description.length<100)
  throw new Error('Green detail reader did not return the same original full JD');
const preflight=await fetch(liveDetail+'/translate-part',{
  method:'OPTIONS',headers:{Origin:corsOrigin,
    'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},
  redirect:'error',signal:AbortSignal.timeout(8000)});
if(preflight.status!==204 || preflight.headers.get('access-control-allow-origin')!==corsOrigin)
  throw new Error('Green Chinese reader CORS preflight is not correctly configured');
console.log('HHBA_PAGES_GREEN_BRIDGE',JSON.stringify({detail:true,sourceMatches:true,
  originalChars:json.description.length,translationPreflight:true,corsAllowedOrigin:corsOrigin}));
const cors=reply.headers.get('access-control-allow-origin')||'NOT_DECLARED';
console.log('OFFICIAL_JD_SMOKE',JSON.stringify({
  company:selection.company,job_id:selection.id,
  has_full_description:true,html_chars:body.content.length,
  requirement_indicators:true,cors_origin:cors,
  jsonp_supported:true,source:'Greenhouse official board API'
}));
