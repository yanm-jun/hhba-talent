// Internal-only Preview staging. This never publishes an extension nor changes
// the real Edge store package. The Preview origin must belong to HHBA's Pages
// project, and the output goes into a separate directory.
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
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
 await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(join(out,'REVIEW_ONLY.txt'),`HHBA Preview testing ONLY. Not for Edge Add-ons submission.\nAPI: ${site}\nTo use account pairing, set a strictly isolated Preview Edge extension ID and secrets. Never share live candidate data.\n`);
 return {origin:site,output:out};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4){console.error('Usage: node scripts/stage-preview.mjs https://<preview>.hhba-talent.pages.dev /absolute/output-directory');process.exitCode=2;}
 else stagePreviewExtension(process.argv[2],process.argv[3])
  .then(x=>console.log('Created isolated Edge preview test extension: '+x.output))
  .catch(e=>{console.error(String(e.message));process.exitCode=1;});
}
