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
if(!jsonpText.trimStart().startsWith(callback+'('))
  throw new Error('Official Greenhouse API did not honor the JSONP callback');
const cors=reply.headers.get('access-control-allow-origin')||'NOT_DECLARED';
console.log('OFFICIAL_JD_SMOKE',JSON.stringify({
  company:selection.company,job_id:selection.id,
  has_full_description:true,html_chars:body.content.length,
  requirement_indicators:true,cors_origin:cors,
  jsonp_supported:true,source:'Greenhouse official board API'
}));
