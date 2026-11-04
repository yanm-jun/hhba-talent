import type {DetailedGuide} from '../components/OverseasDetailedGuide';
import {pack} from './overseasNzGuidesV2a.ts';
import {jpPathways,jpOfficialSources} from './overseasJapan.ts';
import {japanGuideNotes} from './overseasJapanGuideNotesA.ts';
import {japanGuideNotesB} from './overseasJapanGuideNotesB.ts';
import {japanGuideNotesC} from './overseasJapanGuideNotesC.ts';
import type {JapanGuideNotes} from './overseasJapanGuideNotesA.ts';

const notes:Record<string,JapanGuideNotes>={...japanGuideNotes,...japanGuideNotesB,...japanGuideNotesC};
type P=[string,string,string];
const point=(label:string,explain:string,action:string):P=>[label,explain,action];
const description=(v:string)=>v.endsWith('。')?v:v+'。';
const sourceTitles:Record<string,string>={
 ssw:'日本出入国在留管理厅 · 特定技能1号/2号行业清单',
 steps:'日本入管 · 特定技能从考试到COE申请的操作流程',
 test:'日本入管 · 特定技能各行业考试',
 requirements:'入管 · 特定技能法定在留资格',
 engineer:'日本入管 · 技人国审查与2026年补充解释',
 hsp:'日本出入国在留管理厅 · 高度人才积分与相关手续',
 jskip:'日本入管 · J-Skip和J-Find 2026年在线申请说明',
 jfind:'日本入管 · J-Find未来创造人才指定活动',
 student:'JASSO留学日本 · COE、资金、签证手续',
 grad:'JASSO留学日本 · 毕业求职及就业身份变更',
 designated46:'日本入管 · 特定活动46号日本大学等毕业者',
 status:'JASSO · 不同就业在留资格的活动范围',
 visa:'日本外务省 · 驻外签证申请及费用',
 costs:'JASSO留学日本 · 真实学费说明',
 living:'JASSO留学日本 · 生活成本和地区差异',
 faq:'日本入管 · 在留审查常见问题'
};
function build(id:string):DetailedGuide{
 const path=jpPathways.find(x=>x.id===id);const note=notes[id];
 if(!path||!note)throw new Error('Japanese guide source or specific notes missing: '+id);
 const req=path.requirement.map((line,i)=>point('门槛 '+(i+1)+' · '+line.split('，')[0].slice(0,23),
  description(line),description(note.reqActions[i]||'请按照该类别对应的官方申请表逐项核实个人证据，不接受凭空猜测。')));
 const docs=path.documents.map((line,i)=>point('文件 '+(i+1)+' · '+line.slice(0,21),
  '这一类文件在本路径用于证明你的真实身份、资格、合同或财力。当前需核对的是“'+line+'”；具体是否要翻译、原件或时效，须按适用在留手续与发证机构的最新清单准备。',
  description(note.docActions[i]||'向发证机构获取正规文件，保留编号、原件与翻译，确保与个人申请信息一致。')));
 const steps=path.steps.map((line,i)=>point('第 '+(i+1)+' 步 · '+line.split('，')[0].slice(0,22),
  description(line),description(note.stepOutputs[i]||'每一步都应有明确输出材料，不能只保存咨询聊天记录。')));
 const fee=note.fees.map(([name,explain,action])=>point(name,explain,action));
 const timing=note.timing.map(([name,explain,action])=>point(name,explain,action));
 const rights=note.rights.map(([name,explain,action])=>point(name,explain,action));
 const future=note.next.map(([name,explain,action])=>point(name,explain,action));
 const chapters:[string,P[]][]=[
  ['先识别日本对应的法律身份：在留资格与入境签证是两个手续。不能只凭“日本工作签证”四个字决定个人是否合格。',[
   point('这条路径是什么',path.summary,'请先记下官方英文或日文资格名称，再打开该资格的政府说明，确认不是同名中介产品。'),
   point('适合谁',path.audience,note.keyQuestion),
   point('最容易误解的地方',note.avoid,'把个人情况分为“已经满足”“还缺证据”“目前不能走”三栏；不满足时别先付高额咨询费。')
  ]],
  ['以下条件需要结合个人和岗位逐项核实。符合其中一条不等于已经获批全部在留资格。',req],
  ['把文件分为本人身份、学历/考试、雇主或学校材料和资金/家属材料；知道向谁索取、为何需要，比简单列证件名重要。',docs],
  ['境外申请一般要区分日本境内的COE、驻外使领馆签证，以及入境后的在留手续；在日本境内变更身份者则适用不同流程。',steps],
  ['不要把工资、生活资金、考试费、学校学费和政府签证手续费合在一起；以下说明它们分别如何核算。',fee],
  ['没有政府保证的统一审批天数。学校、考试、企业材料、COE、签证、在留更新各自需要安排时间。',timing],
  ['获批后要遵守日本在留资格允许的具体活动、雇佣条件和家属限制；它不是任意工作、无限续签或自动永住。',rights],
  ['后续换职业、变更在留资格、继续留学、家属团聚或申请永住都有独立规则。请根据真实的下一步计划逐项核查。',future]
 ];
 const sources=note.sourceKeys.map((key):[string,string,string]=>[sourceTitles[key]||key,
  jpOfficialSources[key as keyof typeof jpOfficialSources],key==='visa'?'查看正式签证申请与驻当地使领馆手续':'政府原始制度、实际申请条件和具体证明清单']);
 const risks=[...path.risks, note.avoid,'信息核验日期为2026-11-04。考试、行业开放、学校名单、官方费用和在留材料会更新；所有金额和资格应在正式递交前按对应政府渠道重新查验。'];
 if(chapters.length!==8||chapters.some(x=>x[1].length<3))throw new Error('Incomplete Japanese guide: '+id);
 return pack(id,'一句话：'+path.summary+' '+note.avoid,'先做这件事：'+note.keyQuestion,chapters,note.faq,risks,note.terms,sources);
}
export const jpCompleteGuidesV1:Record<string,DetailedGuide>=Object.fromEntries(jpPathways.map(x=>[x.id,build(x.id)]));
