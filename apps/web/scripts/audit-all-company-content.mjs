import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const load=path=>JSON.parse(readFileSync(path,'utf8'));
const roster=load('src/data/domesticListedCompanies.json');
const relation=load('src/data/domesticCompanyRelations.json');
const profiles=load('src/data/domesticCareerProfiles.json');
const editorial=load('src/data/domesticCompanyEditorial.json');
const curated=load('src/data/aiCompanyCatalog.json');
const norm=s=>String(s||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s·・（）()\-—_]/g,'');
const profileMap=new Map(Object.entries(profiles).map(([name,p])=>[norm(name),{name,p}]));
const editorialMap=new Map(Object.entries(editorial).map(([name,p])=>[norm(name),{name,p}]));
const dataset=new Map();
function register(name,category,meta={}){
 const key=norm(name);if(!key)return;
 const record=dataset.get(key)||{name,categories:[],code:'',source:'',industry:'',career:''};
 if(!record.categories.includes(category))record.categories.push(category);
 if(meta.code&&!record.code)record.code=meta.code;
 if(meta.source&&!record.source)record.source=meta.source;
 if(meta.industry&&!record.industry)record.industry=meta.industry;
 dataset.set(key,record);
}
for(const c of roster.companies)register(c.name,'listed', {code:c.code,source:roster.sourceUrls[c.exchange]||'',industry:c.industry||''});
for(const r of relation.relations)register(r.child,'relationship',{source:r.sourceUrl,industry:r.industry});
for(const [name,p] of Object.entries(editorial))register(name,'editorial',{source:p.sourceUrl});
for(const [name,p] of Object.entries(profiles))register(name,'profile',{source:p.officialSource});
for(const c of curated.companies||[])if(c.provenance==='official_recruitment_entry_only')register(c.name,'recruitment-entry',{source:c.evidenceUrl});
const rows=[];
for(const [key,r] of dataset){
 const p=profileMap.get(key)?.p;
 const e=editorialMap.get(key)?.p;
 const description=(p?.description||[]).join('');
 const hasEditorial=Boolean(e?.overview);
 const hasLongform=Boolean(p?.officialSource&&p.description?.length>=3&&
     description.length>=280&&p.business?.length>=3&&p.majorSlugs?.length>=4);
 const issues=[
   !hasLongform?'no_source_backed_substantive_introduction':null,
   !p?.majorSlugs?.length?'no_verified_major_mapping':null,
   p?.brandAssetStatus!=='official_logo_visually_verified'?'formal_logo_unverified':null,
   !(p?.photos?.length)?'no_official_photo_evidence':null,
   !p?.officeLocations?.length?'no_verified_office':null,
   !p?.careersUrl?'independent_recruitment_url_unverified':null,
 ].filter(Boolean);
 const tier=hasLongform?'SOURCE_BACKED_INTRO':hasEditorial?'SHORT_EDITORIAL':'DIRECTORY_ONLY';
 rows.push({name:r.name,code:r.code,source:r.source,tier,issues,mediaComplete:!issues.includes('formal_logo_unverified')&&!issues.includes('no_official_photo_evidence'),
  hasEditorial,hasProfile:Boolean(p),categories:r.categories});
}
const summary={
 generatedAt:'2026-10-23',method:'union of 2026-10-23 A-share roster, affiliated businesses, editorial profiles and official-entry registry; not a claim of exhaustive verification',
 listedTotal:roster.companies.length,distinctSearchIdentities:rows.length,
 sourceBackedIntroductions:rows.filter(r=>r.tier==='SOURCE_BACKED_INTRO').length,
 shortEditorial:rows.filter(r=>r.tier==='SHORT_EDITORIAL').length,
 directoryOnly:rows.filter(r=>r.tier==='DIRECTORY_ONLY').length,
 officialLogoAndPhotoComplete:rows.filter(r=>r.mediaComplete).length,
 lackingSubstantiveIntroduction:rows.filter(r=>r.tier!=='SOURCE_BACKED_INTRO').length,
 candidatesForUrgentFix:rows.filter(r=>r.tier!=='SOURCE_BACKED_INTRO'&&r.categories.includes('listed')).length,
 exactNamedCase:rows.find(r=>r.name==='华安证券')||null
};
rows.sort((a,b)=>(a.tier==='SOURCE_BACKED_INTRO'?1:0)-(b.tier==='SOURCE_BACKED_INTRO'?1:0)||b.issues.length-a.issues.length||a.name.localeCompare(b.name,'zh-CN'));
mkdirSync('preview-reports',{recursive:true});
writeFileSync('preview-reports/all-company-content-audit.json',JSON.stringify({summary,rows},null,2));
writeFileSync('preview-reports/company-content-audit.md',[
 '# HHBA 全量企业内容质量清查',
 '',
 '注意：这是覆盖现有企业身份记录的**内容完整度静态审计**，不等于逐家打开官网的人工核验。',
 '',
 '| 指标 | 数量 |','|---|---:|',
 ...Object.entries(summary).filter(([_,v])=>typeof v==='number').map(([k,v])=> '| '+k+' | '+v+' |'),
 '',
 '企业深度介绍标准：有独立来源、至少三段描述且正文 ≥280 字、至少三个特定业务方向、至少四项业务关联专业。媒体与招聘入口另行计量。',
 '',
 '未达到标准的企业不再在前端标为完整介绍，显示“上市主体基本信息”及可核验的名录事实，不生成虚假的历史、专业或官网。',
 '',
 '## 重点负面案例：华安证券',
 '',
 '华安证券状态：'+(summary.exactNamedCase?.tier||'未找到')
].join('\n')+'\n');
console.log('HHBA_ALL_EMPLOYER_CONTENT_AUDIT',JSON.stringify(summary));
test('Every listed issuer is assessed and not silently removed by quality gating',()=>{
 assert.equal(roster.companies.length,5576);
 const keys=new Set(rows.map(r=>norm(r.name)));
 for(const c of roster.companies)assert(keys.has(norm(c.name)),c.name+' not audited');
 assert.equal(rows.length,summary.sourceBackedIntroductions+summary.shortEditorial+summary.directoryOnly);
});
test('Known weak profile example has been replaced by a substantial source-backed article',()=>{
 const row=rows.find(x=>x.name==='华安证券');
 assert(row,'Missing 华安证券');
 assert.equal(row.tier,'SOURCE_BACKED_INTRO');
 const p=profiles['华安证券'];
 assert(p.officialSource.startsWith('https://www.hazq.com/'));
 assert(p.description.join('').includes('紫云路1018号'));
 assert(p.majorSlugs.includes('finance'));
 assert(!p.careersUrl,'Do not fabricate 华安证券 recruitment URL');
});
test('No short directory summaries are mislabeled as complete company profiles',()=>{
 const page=readFileSync('src/pages/DomesticCompanyPage.tsx','utf8');
 const cards=readFileSync('src/components/DomesticCompanyResults.tsx','utf8');
 assert(page.includes('上市主体基本信息'));
 assert(page.includes('!article?<section'));
 assert(!page.includes('已收录至 HHBA 企业资料库'));
 assert(!page.includes('资料状态：基础档案'));
 assert(cards.includes('仅名录信息 · 不冒充深度介绍'));
 assert(cards.includes('查看名录事实'));
});
