#!/usr/bin/env node
// Build a compact, deterministic library from existing reviewed HHBA sources.
// Run: node apps/web/scripts/build-employer-library.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const load=name=>JSON.parse(readFileSync(join(root,'src/data',name),'utf8'));
const halls=[
 ['automotive','汽车馆'],['semiconductor','电子半导体馆'],
 ['internet-ai','互联网与AI馆'],['energy','能源电力馆'],
 ['manufacturing','智能制造馆'],['finance','金融馆'],
 ['telecom','通信馆'],['biomed','医药生物馆'],
 ['aerospace','航空航天馆'],['logistics','交通物流馆'],
 ['construction','建筑工程馆'],['consumer-hardware','家电与智能硬件馆'],
 ['chem-materials','化工新材料馆'],['retail','商贸零售馆'],
 ['agri-food','农业食品馆'],['culture-media','文化传媒馆'],
 ['education-research','教育科研馆']
];
const named={
 automotive:'比亚迪 德赛西威 华域视觉科技（上海）有限公司 华域汽车 上汽集团 潍柴动力 广汽集团 长安汽车 江淮汽车 宇通客车 赛力斯 长城汽车 吉利汽车 理想汽车 蔚来汽车 零跑汽车 小鹏汽车 极氪 奇瑞汽车 东风汽车集团 福耀玻璃 莲花集团 上海申沃客车有限公司 上汽集团乘用车分公司',
 semiconductor:'京东方Ａ 兆易创新 北方华创 歌尔股份 立讯精密 汇顶科技 海康威视',
 'internet-ai':'腾讯 阿里巴巴 字节跳动 百度 美团 金蝶国际 用友网络 携程集团 科大讯飞 浪潮信息 紫光股份',
 energy:'阳光电源 亿纬锂能 隆基绿能 宁德时代 思源电气 许继电气 正泰电器 国电南瑞 平高电气 晶科能源 欣旺达 阳光电动力 亿纬氢能 中国石油 中国石化 中国海油 中国神华',
 manufacturing:'汇川技术 雷赛智能 英威腾 埃斯顿 海康机器人 中控技术 拓斯达 三一重工 上海电气 美的楼宇科技',
 finance:'农业银行 建设银行 工商银行 中国银行 招商银行 浦发银行 中国平安 广发证券 中信证券 光大证券 华泰证券 东方证券 华安证券 交通银行 兴业银行 中信银行 中国人寿 杭州银行 南京银行 北京银行 上海银行 成都银行 邮储银行',
 telecom:'中国移动 中国电信 中国联通 中兴通讯 华为',
 biomed:'药明康德 爱尔眼科 迈瑞医疗 恒瑞医药 智飞生物 泰格医药 联影医疗',
 aerospace:'大疆创新',
 logistics:'中国中车 顺丰控股 中国邮政 上海机场 中国国航 东方航空 南方航空',
 construction:'中国建筑',
 'consumer-hardware':'美的集团 海尔智家 格力电器 小米集团 联想集团 安克创新 TCL科技 海信视像 石头科技 OPPO 荣耀 vivo',
 'chem-materials':'宝钢股份',
 retail:'京东集团 泡泡玛特',
 'agri-food':'贵州茅台 伊利股份 海天味业 牧原股份 温氏股份 海大集团'
};
const key=value=>String(value).normalize('NFKC').replace(/[\s·•]/g,'').toLowerCase();
function classify(name,industry=''){
 const normalized=key(name);
 for(const [id,entries] of Object.entries(named))
  if(entries.split(' ').some(n=>key(n)===normalized))return id;
 const s=String(industry);
 if(/汽车|乘用车|电动汽车|商用车|客车|车身|车灯|车载|车用|底盘|动力总成|变速器|传动轴|汽车零部件|汽车模具/.test(s))return 'automotive';
 if(/轨道交通|铁路|物流|供应链|运输/.test(s))return 'logistics';
 if(/医疗|医药|生物|制药/.test(s))return 'biomed';
 if(/智能家电|家用电器|消费电子/.test(s))return 'consumer-hardware';
 if(/电网|新能源|储能|能源系统|发电|动力电池|光伏/.test(s))return 'energy';
 if(/机器人|工业自动化|工业驱动|工业设备|机械|核心部件|自动化制造/.test(s))return 'manufacturing';
 if(/电子|芯片|集成电路|半导体|显示面板/.test(s))return 'semiconductor';
 return 'uncategorized'; // Flag uncertain categories instead of forcing an incorrect hall.
}
const files=['domesticRecruitmentRegistry.json','domesticRecruitment200Registry.json'];
const relations=load('domesticCompanyRelations.json');
const entries=new Map();
for(const filename of files){
 const source=load(filename),dataset=filename.slice(0,-5);
 for(const [name,portal] of Object.entries(source.entries)){
  const id=key(name);
  const row=entries.get(id)||{id,name,industry_id:classify(name),parent_name:null,relation:null,aliases:[],portals:[],source_datasets:[]};
  for(const alias of portal.aliases||[])if(alias&&!row.aliases.includes(alias))row.aliases.push(alias);
  if(!row.source_datasets.includes(dataset))row.source_datasets.push(dataset);
  if(typeof portal.url==='string'&&/^https:\/\//.test(portal.url)&&!row.portals.some(x=>x.url===portal.url))
   row.portals.push({url:portal.url,label:portal.label||'官方招聘入口',
    scope:portal.kind==='official_recruitment_announcements'?'official_announcement':'employer_portal',
    status:'legacy_reviewed',reviewed_on:portal.verifiedOn||source.reviewedOn||source.verifiedOn||null});
  entries.set(id,row);
 }
}
for(const rel of relations.relations){
 const id=key(rel.child);
 const row=entries.get(id)||{id,name:rel.child,industry_id:classify(rel.child,rel.industry),
  parent_name:null,relation:null,aliases:[],portals:[],source_datasets:[]};
 if(!row.parent_name){row.parent_name=rel.parent;row.relation=rel.relation||'集团成员';}
 if(row.industry_id==='uncategorized')row.industry_id=classify(rel.child,rel.industry);
 for(const alias of rel.aliases||[])if(alias&&!row.aliases.includes(alias))row.aliases.push(alias);
 if(!row.source_datasets.includes('domesticCompanyRelations'))row.source_datasets.push('domesticCompanyRelations');
 // Never turn an inherited group portal into an independent child-company portal.
 entries.set(id,row);
}
const items=[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
const unknown=items.filter(e=>e.industry_id==='uncategorized').map(e=>e.name);
const output={schema_version:1,
 description:'HHBA 历史招聘入口及集团关系分类索引；不是实时岗位库。legacy_reviewed 为历史审核，不保证今日仍在招。集团入口不等于子公司独立入口。',
 source_revision:'2026-11-12',halls:halls.map(([id,name])=>({id,name})),items,
 statistics:{entities:items.length,legacy_portals:items.reduce((n,e)=>n+e.portals.length,0),
  group_relations:items.filter(e=>e.parent_name).length,unclassified:unknown.length,
  by_hall:Object.fromEntries(halls.map(([id])=>[id,items.filter(e=>e.industry_id===id).length]))}};
writeFileSync(join(root,'public/data/employer-library.json'),JSON.stringify(output,null,2)+'\n');
console.log('HHBA_EMPLOYER_LIBRARY',JSON.stringify({...output.statistics,unknown}));
