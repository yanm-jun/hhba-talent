import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(), read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const files=fs.readdirSync('src/data/employerProfiles').filter(x=>/^cn-autumn-\\d{3}\\.json$/.test(x)).sort();
const profiles=files.map(f=>JSON.parse(read('src/data/employerProfiles/'+f)));
const byId=new Map(profiles.map(p=>[p.id,p]));
const main=read('src/main.tsx');
const notes=[];
function issue(id,name,level,code,details){notes.push({id,name,level,code,details});}
const ids=manifest.entries.map(x=>x.id);
const unresolved=[];
const custom=[];
const generic=[];
let slots=0,missingMedia=0,unconfirmed=0,verifiedMedia=0,placeholders=0;
const mediaHashes=new Map();
for(const x of manifest.entries){
 const n=Number(x.id.split('-').at(-1));if(n>65)continue;
 const p=byId.get(x.id);
 if(!p){
   if(main.includes("route==='/companies/autumn/"+x.id+"'")){custom.push(x.id);issue(x.id,x.name,'P2','LEGACY_SEPARATE_TEMPLATE','Legacy standalone detail page, not using the same V2 four-block model');}
   else {generic.push(x.id);issue(x.id,x.name,'P1','NO_V2_PROFILE','Only generic fallback, lacks independent four-section V2 employer profile');}
   continue;
 }
 if(p.name!==x.name&&!p.aliases?.includes(x.name))issue(p.id,p.name,'P1','ROSTER_NAME_MISMATCH','Screenshot name '+x.name+' differs and is not captured by aliases');
 if((p.jobs||[]).length===0)issue(p.id,p.name,'P1','EMPTY_JOBS','No reviewed job/direction records');
 if((p.business||[]).length<6)issue(p.id,p.name,'P1','BUSINESS_UNDER_SIX','Only '+(p.business||[]).length+' business blocks');
 if((p.jobs||[]).some(j=>!j.title||!j.summary||!j.requirements||!j.city||!j.category||!j.evidenceUrl||!j.majorNames?.length))
   issue(p.id,p.name,'P1','INCOMPLETE_JOB_FIELDS','One or more job records have missing source/major/details');
 if(p.recruitment?.status==='unconfirmed'){unconfirmed++;issue(p.id,p.name,'P2','UNCONFIRMED_RECRUITMENT','2027 recruitment link or application status unconfirmed');}
 const media=[p.media?.logo,...(p.media?.photos||[]).map(m=>m.path)];
 if(media.length!==3){issue(p.id,p.name,'P1','MEDIA_SLOT_COUNT','Expected 1 logo+2 separate pictures, found '+media.length);continue;}
 for(const f of media){
   slots++;
   const local='public/'+f;
   if(!f||!fs.existsSync(local)||fs.statSync(local).size<500){missingMedia++;issue(p.id,p.name,'P1','MEDIA_FILE_MISSING','File missing or tiny: '+f);continue;}
   const hash=createHash('sha256').update(fs.readFileSync(local)).digest('hex');
   if(mediaHashes.has(hash))issue(p.id,p.name,'P2','REUSED_MEDIA_BYTES','Identical to '+mediaHashes.get(hash)+' at '+f);
   else mediaHashes.set(hash,p.id+':'+f);
   if(f.endsWith('.svg'))placeholders++;
   else verifiedMedia++;
 }
 const mediaDir='public/images/employer-profiles/'+p.id+'/media-audit.json';
 if(!fs.existsSync(mediaDir)){issue(p.id,p.name,'P2','MEDIA_AUDIT_MISSING','No local source provenance audit JSON');}
 else {
   const audit=JSON.parse(read(mediaDir));
   if(audit.realPhotos===false||audit.officialLogo===false)issue(p.id,p.name,'P2','EDITORIAL_MEDIA_ONLY','Media are explicitly nonofficial illustrations, not real photos/logo');
 }
 if((p.jobs||[]).some(j=>j.currentOpenVerified!==false))issue(p.id,p.name,'P1','OPEN_STATE_UNVERIFIED','One or more job records incorrectly presented as open');
 if(x.reviewStatus==='not_checked')issue(p.id,p.name,'P2','SOURCE_ROSTER_STALE','Original screenshot retains not_checked, separate reviewed profile exists');
}
const uniqueById=[...new Set(ids)];
const allMissing=Array.from({length:65},(_,i)=>i+1).filter(i=>!byId.has('cn-autumn-'+String(i).padStart(3,'0')));
const backlog=manifest.entries.filter(x=>Number(x.id.split('-').at(-1))>65&&x.id!=='cn-autumn-157');
const groups={P1:notes.filter(x=>x.level==='P1'),P2:notes.filter(x=>x.level==='P2')};
const lines=[
 '# HHBA 企业端完整性审计（2026-10-31）','',
 '范围：原始截图清单第1—65号 + 当前V2数据。仅静态代码与本地资源验证；不等于线上可用性及实时职位审核。','',
 '## 总体统计','',
 '- 原始截图记录：'+manifest.entries.length+'；唯一记录ID：'+uniqueById.length,
 '- V2独立企业档案文件：'+profiles.length+'（含插队企业）',
 '- 1—65号未有V2档案：'+allMissing.map(x=>String(x).padStart(3,'0')).join('、'),
 '- 其中旧版独立页面：'+custom.join('、'),
 '- 只有通用回退页面（缺V2）：'+generic.join('、'),
 '- 1—65号已引用的本地媒体槽位：'+slots+'；缺失或过小：'+missingMedia,
 '- 可识别的SVG视觉槽位：'+placeholders+'（需独立审查是否为示意图）；非SVG图像槽位：'+verifiedMedia+'（不保证已获企业官方授权）',
 '- 招聘状态未核实的企业数量：'+unconfirmed,
 '- 66号及以后的截图待开发（不计历史质量缺陷）：'+backlog.length,
 '- P1结构与数据问题：'+groups.P1.length+'；P2来源与体验问题：'+groups.P2.length,'',
 '## P1：档案缺失 / 内容不完整','',
 ...groups.P1.map(x=>'- **'+x.id+' '+x.name+'** · '+x.code+'：'+x.details),
 '',
 '## P2：旧模板 / 招聘链接 / 图片来源 / 数据元信息','',
 ...groups.P2.map(x=>'- '+x.id+' '+x.name+' · '+x.code+'：'+x.details),
 '',
 '## 判断原则','',
 '公司名、招聘主体、二级来源、官网及图片权属必须分开核验。缺失企业仍可能走原有通用秋招页面，不应误报为404。老版专属页面可以访问，但并非与现有V2四板块完全一致。示意图只能计入本地素材槽位，不能算真实企业实景。'
];
fs.mkdirSync('audit-output',{recursive:true});
fs.writeFileSync('audit-output/employer-completeness-20261031.md',lines.join('\\n')+'\\n');
fs.writeFileSync('audit-output/employer-completeness-20261031.json',JSON.stringify({summary:{roster:manifest.entries.length,profiles:profiles.length,missingV2:allMissing,legacy:custom,generic,slots,missingMedia,unconfirmed,backlog:backlog.length,issueCounts:{P1:groups.P1.length,P2:groups.P2.length}},issues:notes},null,2));
console.log('HHBA_ENTERPRISE_AUDIT_SUMMARY',JSON.stringify({roster:manifest.entries.length,profiles:profiles.length,missingV2:allMissing,legacy:custom,generic,slots,missingMedia,unconfirmed,backlog:backlog.length,issueCounts:{P1:groups.P1.length,P2:groups.P2.length}}));
for(const x of notes)if(x.level==='P1')console.log('HHBA_AUDIT_P1',x.id,x.name,x.code,x.details);
console.log('HHBA_ENTERPRISE_AUDIT_REPORT_READY audit-output/employer-completeness-20261031.md');
