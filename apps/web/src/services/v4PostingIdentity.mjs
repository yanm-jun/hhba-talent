// Shared V4 posting identity: a URL can host more than one distinct vacancy.
// A stable discovered identity survives later JD/score patches. Never treat a
// title/company claim itself as verified evidence.
const clean=s=>typeof s==='string'?s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase():'';
const mask=(1n<<64n)-1n;
function hash(bytes,seed){let value=seed;for(const b of bytes)value=((value^BigInt(b))*1099511628211n)&mask;return value.toString(16).padStart(16,'0');}
export const isV4PostingKey=value=>typeof value==='string'&&/^v4-posting-[a-f0-9]{32}$/.test(value);
export function v4PostingKey(job,url=job?.official_url||job?.url){
 if(isV4PostingKey(job?.posting_key))return job.posting_key;
 let canonical=String(url||'');try{const u=new URL(canonical);u.hash='';canonical=u.href;}catch{}
 const tuple=JSON.stringify([canonical,clean(job?.company),clean(job?.title||job?.role||job?.title_zh),clean(job?.location||job?.city)]);
 const bytes=new TextEncoder().encode(tuple);
 return 'v4-posting-'+hash(bytes,14695981039346656037n)+hash(bytes,7809847782465536322n);
}
