import {readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const doc=JSON.parse(readFileSync(new URL('./domestic_tencent_baidu_verified_20261018.json',import.meta.url),'utf8'));
if(doc.entries.length!==27||doc.currentApplicationVerified!==false)throw Error('Approved domestic job count or status mismatch');
const records=JSON.stringify(doc.entries);
const digest=createHash('sha256').update(records).digest('hex');
if(digest!=='5bbae03c21888eff0765f8b8a34aa10b61b353caacea95702009e6272413ee49')throw Error('Tencent/Baidu approved SHA mismatch');
if(!process.env.GITHUB_ENV)throw Error('GITHUB_ENV unavailable');
for(let i=0;i<2;i++){const chunk=records.slice(i*3900,(i+1)*3900);if(!chunk)throw Error('Missing official source payload');appendFileSync(process.env.GITHUB_ENV,'HHBA_REVIEWED_OFFICIAL_'+i+'<<HHBA_END_'+i+'\n'+chunk+'\nHHBA_END_'+i+'\n');}
console.log('HHBA_REVIEWED_SOURCE_CI_PASS',JSON.stringify({total:27,companies:2,applicationVerified:false,digest}));
