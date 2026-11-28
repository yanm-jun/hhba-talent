// Read-only source-of-truth smoke for GitHub Pages release.
// Check the official Greenhouse API and its browser-compatible JSONP form.
// The retired Railway JD translation bridge is not part of this Pages gate.
// Do not log or persist full copyrighted employer job descriptions.
import {readFile} from 'node:fs/promises';
import {parseOfficialGreenhouseJsonp,verifyOfficialGreenhouseSample} from './official-jd-release-contract.mjs';

const snapshot=JSON.parse(await readFile('dist/data/jobs.json','utf8'));
const candidates=snapshot.jobs.filter(j=>j.platform==='greenhouse'&&j.source==='airtable'&&
 /^greenhouse-airtable-[A-Za-z0-9_-]+$/.test(j.id));
if(candidates.length===0)throw Error('Airtable official Greenhouse sample missing from current public index');
const selection=candidates.find(j=>/Account Executive, Corporate/i.test(j.title))||candidates[0];
const native=selection.id.slice('greenhouse-airtable-'.length);
const endpoint='https://boards-api.greenhouse.io/v1/boards/airtable/jobs/'+encodeURIComponent(native)+'?content=true';
const reply=await fetch(endpoint,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(25000)});
if(!reply.ok)throw Error('Airtable official detail unavailable: HTTP '+reply.status);
const direct=await reply.json();

const callback='hhbaOfficialJdProbe';
const jsonp=new URL(endpoint);
jsonp.searchParams.set('callback',callback);
const reader=await fetch(jsonp,{redirect:'error',signal:AbortSignal.timeout(12000)});
if(!reader.ok)throw Error('Official Greenhouse JSONP endpoint unavailable: HTTP '+reader.status);
const jsonpText=await reader.text();
const publicJd=parseOfficialGreenhouseJsonp(jsonpText,callback);
const integrity=verifyOfficialGreenhouseSample(selection,direct,publicJd);
console.log('HHBA_PAGES_OFFICIAL_JD_PASS',JSON.stringify({
 ...integrity,source:'Greenhouse official Job Board API',
 browserReadMode:'official JSONP',legacyRailwayRequired:false
}));
