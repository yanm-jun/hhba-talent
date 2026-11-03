// Rebuild the account-save allowlist from the same approved V2 source used by
// the public recruitment market. Never accept an arbitrary client-supplied ID.
import {createServer} from 'vite';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'public/data/saveable-domestic-job-ids.json');
const server=await createServer({
 root,appType:'custom',logLevel:'error',
 server:{middlewareMode:true,hmr:false}
});
try {
 const {domesticV2Records,assertDomesticRebuildIntegrity}=
  await server.ssrLoadModule('/src/services/domesticRebuildJobs.ts');
 assertDomesticRebuildIntegrity();
 const ids=domesticV2Records.map(row=>row.id);
 if(!ids.length||new Set(ids).size!==ids.length||
   ids.some(id=>!/^cn-v2-[A-Za-z0-9_-]{2,170}$/.test(id)))
  throw Error('INVALID_DOMESTIC_BOOKMARK_ALLOWLIST');
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify({
  kind:'HHBA_SAVEABLE_DOMESTIC_JOBS_V1',
  count:ids.length,ids:ids.sort()
 })+'\n');
 console.log('HHBA_SAVEABLE_DOMESTIC_IDS',ids.length);
}finally{
 await server.close();
}
