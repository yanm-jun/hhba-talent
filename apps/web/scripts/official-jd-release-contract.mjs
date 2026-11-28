// Guard the GitHub Pages public-job build against mismatched official ATS JDs.
// Never depend on an unrelated hosting provider or log copyrighted JD content.
const ATS_HOSTS=new Set(['job-boards.greenhouse.io','boards.greenhouse.io','boards.eu.greenhouse.io']);
const NATIVE_ID=/^[A-Za-z0-9_-]{4,100}$/;
const CALL_NAME=/^[A-Za-z_$][\w$]{0,90}$/;

export function parseOfficialGreenhouseJsonp(text,callback){
 if(typeof text!=='string'||typeof callback!=='string'||!CALL_NAME.test(callback))throw Error('INVALID_JSONP');
 const cleaned=text.trim().replace(/^\/\*[\s\S]*?\*\/\s*/,'');
 const prefix=callback+'(';
 if(!cleaned.startsWith(prefix)||!/\)\s*;?\s*$/.test(cleaned))throw Error('JSONP_CALLBACK_MISMATCH');
 const raw=cleaned.slice(prefix.length).replace(/\)\s*;?\s*$/,'');
 try{return JSON.parse(raw)}catch{throw Error('INVALID_JSONP_BODY')}
}
export function verifyOfficialGreenhouseSample(selection,direct,jsonp){
 if(!selection||selection.platform!=='greenhouse'||selection.source!=='airtable'||
  !/^greenhouse-airtable-[A-Za-z0-9_-]+$/.test(selection.id||''))
  throw Error('INVALID_INDEXED_GREENHOUSE_SAMPLE');
 const native=selection.id.slice('greenhouse-airtable-'.length);
 if(!NATIVE_ID.test(native)||!direct||String(direct.id)!==native||
  !jsonp||String(jsonp.id)!==native)throw Error('OFFICIAL_JD_IDENTITY_MISMATCH');
 let listed,published;
 try{listed=new URL(selection.url);published=new URL(direct.absolute_url)}catch{throw Error('OFFICIAL_JD_URL_INVALID')}
 const valid=url=>url.protocol==='https:'&&ATS_HOSTS.has(url.hostname)&&
  url.pathname==='/airtable/jobs/'+native&&!url.port&&!url.username&&!url.password;
 if(!valid(listed)||!valid(published)||listed.pathname!==published.pathname)
  throw Error('OFFICIAL_JD_URL_MISMATCH');
 const hasFullContent=post=>typeof post.content==='string'&&post.content.length>=100&&
  /qualification|requirement|experience|skills|ability|responsibilit/i.test(
   post.content.replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/gi,' ').replace(/\s+/g,' '));
 if(typeof direct.title!=='string'||!direct.title.trim()||
  typeof jsonp.title!=='string'||jsonp.title!==direct.title||
  !hasFullContent(direct)||!hasFullContent(jsonp)||
  jsonp.content!==direct.content||jsonp.absolute_url!==direct.absolute_url)
  throw Error('OFFICIAL_JD_CONTENT_MISMATCH');
 return {provider:'greenhouse',jobId:selection.id,verified:true,
  originalChars:direct.content.length,jsonpConsistent:true};
}
