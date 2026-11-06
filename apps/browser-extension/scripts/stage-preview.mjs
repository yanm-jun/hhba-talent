// Internal-only Preview staging. This never publishes an extension nor changes
// the real Edge store package. The Preview origin must belong to HHBA's Pages
// project, and the output goes into a separate directory.
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {resolve,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets=['popup.css','content.js','core.mjs',
 'icons/icon16.png','icons/icon32.png','icons/icon48.png','icons/icon128.png'];
export function checkedPreviewOrigin(urlText){
 const url=new URL(urlText);
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||
  url.hash||url.pathname!=='/'||
  !/^[a-z0-9][a-z0-9-]{2,62}\.hhba-talent\.pages\.dev$/.test(url.hostname))
  throw Error('仅允许 HHBA Cloudflare Pages 独立 Preview 地址');
 return url.origin;
}
// Local preview only: a public key gives the unpacked Edge extension a stable
// Chromium ID across reloads, without committing a signing key or granting
// extra permissions. Never include manifest.key in the store ZIP.
export function extensionIdFromPublicKey(encoded){
 const bytes=createHash('sha256').update(Buffer.from(encoded,'base64')).digest().subarray(0,16);
 return Array.from(bytes,b=>String.fromCharCode(97+(b>>>4))+String.fromCharCode(97+(b&15))).join('');
}
async function stagingPublicKey(out){
 const path=join(out,'.preview-public-key');
 try{
  const existing=(await readFile(path,'utf8')).trim();
  if(existing.length>100&&existing.length<800&&/^[A-Za-z0-9+/]+={0,2}$/.test(existing))return existing;
  throw Error('Invalid existing preview public key; refuse ID rotation');
 }catch(e){
  if(e?.code!=='ENOENT')throw e;
 }
 const {publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'der'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const key=Buffer.from(publicKey).toString('base64');
 // Only the *public* key is persisted. The generated private key is discarded;
 // this extension is for unpacked Preview testing, not store signing.
 await writeFile(path,key+'\n',{flag:'wx'});
 return key;
}
export async function stagePreviewExtension(urlText,outputPath){
 const site=checkedPreviewOrigin(urlText),out=resolve(outputPath);
 if(out===sourceRoot||out.startsWith(sourceRoot+sep))throw Error('不能覆盖官方 Edge 插件源码');
 await mkdir(join(out,'icons'),{recursive:true});
 for(const path of assets)await copyFile(join(sourceRoot,path),join(out,path));
 const read=async name=>readFile(join(sourceRoot,name),'utf8');
 const account=await read('account.mjs');
 const prod=`export const HHBA_SITE='https://hhba.work';`;
 if(!account.includes(prod))throw Error('官网账户配置与预期不一致，请检查源码');
 const perm="export const HHBA_PERMISSION='https://hhba.work/*';";
 if(!account.includes(perm))throw Error('官网权限配置与预期不一致，请检查源码');
 const scoped=account.replace(prod,`export const HHBA_SITE='${site}';`)
  .replace(perm,`export const HHBA_PERMISSION='${site}/*';`);
 await writeFile(join(out,'account.mjs'),scoped);
 let popup=await read('popup.js');
 if(!popup.includes('https://hhba.work/candidate/account/resume'))throw Error('缺少原官网简历入口');
 popup=popup.replaceAll('https://hhba.work/',site+'/');
 await writeFile(join(out,'popup.js'),popup);
 let html=await read('popup.html');
 if(!html.includes('https://hhba.work/apply-extension-privacy.html'))throw Error('缺少原官网隐私入口');
 html=html.replaceAll('https://hhba.work/',site+'/');
 await writeFile(join(out,'popup.html'),html);
 const manifest=JSON.parse(await read('manifest.json'));
 manifest.name='HHBA 智能网申助手（隔离预览测试）';
 manifest.description='仅用于 HHBA Preview 测试：验证已配对账户的结构化资料同步和网页预填；不得上传 Edge 商店。';
 manifest.optional_host_permissions=[site+'/*'];
 const devKey=await stagingPublicKey(out);
 manifest.key=devKey;
 const extensionId=extensionIdFromPublicKey(devKey);
 await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(join(out,'REVIEW_ONLY.txt'),`HHBA Preview testing ONLY. Not for Edge Add-ons submission.\nAPI: ${site}\nDevelopment Edge extension ID: ${extensionId}\nThis ID belongs only to this local, unpacked Preview test extension. Store ID will be different.\nUse only isolated Preview secrets and synthetic accounts. Never share live candidate data.\n`);
 return {origin:site,output:out,extensionId};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4){console.error('Usage: node scripts/stage-preview.mjs https://<preview>.hhba-talent.pages.dev /absolute/output-directory');process.exitCode=2;}
 else stagePreviewExtension(process.argv[2],process.argv[3])
  .then(x=>console.log('Created isolated Edge preview test extension: '+x.output))
  .catch(e=>{console.error(String(e.message));process.exitCode=1;});
}
