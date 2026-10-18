import {readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const doc=JSON.parse(readFileSync(new URL('./domestic_xiaomi_20261016.compact.json',import.meta.url),'utf8'));
if(doc.jobs.length!==1010||doc.verified_details!==0||doc.verified_current_apply!==0)throw Error('Unapproved Xiaomi snapshot');
const value=JSON.stringify(doc.jobs);
const digest=createHash('sha256').update(value).digest('hex');
if(digest!=='97ef1d92751c7726225f98fdd0797d22e45eb07553029452697b54dd208def8e')throw Error('Pinned tuple digest mismatch');
if(!process.env.GITHUB_ENV)throw Error('Expected GitHub Actions CI environment');
for(let i=0;i<11;i++){
 const chunk=value.slice(i*4500,(i+1)*4500);
 if(!chunk)throw Error('Missing Xiaomi environment chunk');
 appendFileSync(process.env.GITHUB_ENV,'HHBA_XIAOMI_CHUNK_'+i+'<<HHBA_RECORD_'+i+'_END\n'+chunk+'\nHHBA_RECORD_'+i+'_END\n');
}
console.log('HHBA_DOMESTIC_CI_CHUNKS_READY',JSON.stringify({chunks:11,totalRecords:1010,digestVerified:true}));
