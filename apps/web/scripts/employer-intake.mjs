import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function arg(name){const i=process.argv.indexOf('--'+name);return i<0?null:process.argv[i+1]||null}
const f=arg('profile'),logo=arg('logo'),first=arg('photo1'),second=arg('photo2');
if(![f,logo,first,second].every(Boolean)){
 console.error('Usage: node scripts/employer-intake.mjs --profile <json> --logo <file> --photo1 <file> --photo2 <file>');process.exit(2)
}
const data=JSON.parse(fs.readFileSync(f,'utf8'));
if(!/^cn-autumn-\d{3}$/.test(data.id)||data.schemaVersion!==1)throw Error('Invalid ID/schema');
const roster=JSON.parse(fs.readFileSync(path.join(root,'src/data/domesticAutumnScreenshot20261028.json'),'utf8'));
if(!roster.entries.some(e=>e.id===data.id&&e.name===data.name))throw Error('Roster ID/company name mismatch');
const inputs=[logo,first,second],names=['logo','photo1','photo2'];
const paths=inputs.map((input,i)=>{
 if(!fs.existsSync(input)||!fs.statSync(input).isFile())throw Error('Image missing: '+input);
 if(fs.statSync(input).size>5*1024*1024)throw Error('Compress image below 5MB: '+input);
 const ext=path.extname(input).toLowerCase();
 if(!['.png','.jpg','.jpeg','.webp','.svg'].includes(ext))throw Error('Unsupported image: '+input);
 return 'images/employer-profiles/'+data.id+'/'+names[i]+ext;
});
if(new Set(inputs.map(x=>path.resolve(x))).size!==3)throw Error('Three independent source images required');
if(!data.media||!Array.isArray(data.media.photos)||data.media.photos.length!==2)throw Error('Complete photo captions/notes first');
data.media.logo=paths[0];data.media.photos.forEach((photo,i)=>photo.path=paths[i+1]);
const destDir=path.join(root,'src/data/employerProfiles');
const dest=path.join(destDir,data.id+'.json');
if(fs.existsSync(dest)&&!process.argv.includes('--replace'))throw Error('Profile already exists; use --replace after review');
for(let i=0;i<3;i++){
 const output=path.join(root,'public',paths[i]);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(inputs[i],output)
}
fs.mkdirSync(destDir,{recursive:true});fs.writeFileSync(dest,JSON.stringify(data,null,2)+'\n');
console.log('EMPLOYER_INTAKE_READY',data.id,paths);
console.log('Run: node scripts/employer-factory-check.mjs && npm run build');
