import type {TalentPolicyRecord} from './talentPolicyRecords';

export type MatchEducation='unknown'|'college'|'bachelor'|'master'|'doctor';
export type MatchGrad='unknown'|'2027'|'2026'|'2025'|'2024-older'|'not-graduate';
export type MatchWork='unknown'|'student'|'employed'|'unemployed'|'flexible'|'founder';
export type MatchAnswer='unknown'|'yes'|'no';
export type MatchDistrict='unknown'|'chaoyang'|'xuhui'|'pudong'|'cq-hightech'|'cq-12counties'|'other';
export type MatchAge='unknown'|'under35'|'over35';
export type MatchSocial='unknown'|'one-year-plus'|'less-year'|'none';
export type TalentMatchProfile={
 city:string;education:MatchEducation;grad:MatchGrad;work:MatchWork;
 hardship:MatchAnswer;localHukou:MatchAnswer;district:MatchDistrict;
 age:MatchAge;social:MatchSocial;housingNone:MatchAnswer;
};
export type TalentMatchStatus='focus'|'review'|'excluded'|'archive';
export type TalentMatchResult={
 record:TalentPolicyRecord;status:TalentMatchStatus;
 reasons:string[];toCheck:string[];notes:string[];score:number;
};
export const DEFAULT_TALENT_PROFILE:TalentMatchProfile={
 city:'北京',education:'unknown',grad:'unknown',work:'unknown',
 hardship:'unknown',localHukou:'unknown',district:'unknown',
 age:'unknown',social:'unknown',housingNone:'unknown'
};
export const MUNICIPAL_MATCH_CITIES=['北京','天津','上海','重庆'] as const;

const graduationThisYear=['2026','2027'];
const recentTwoYears=['2026','2025'];
const alumni=['2027','2026','2025','2024-older'];

export function evaluateTalentPolicy(
 record:TalentPolicyRecord,profile:TalentMatchProfile,today:string=new Date().toISOString().slice(0,10)
):TalentMatchResult{
 const reasons:string[]=[];const toCheck:string[]=[];const notes:string[]=[];const failures:string[]=[];
 if(record.city!==profile.city)return {record,status:'excluded',reasons:[],toCheck:[],notes:['这条政策属于其他城市'],score:-100};
 reasons.push('目标城市：'+profile.city);
 let checked=0;
 const question=(field:keyof TalentMatchProfile,allowed:string[],yes:string,no:string,unknown:string)=>{
  const value=profile[field];
  if(value==='unknown'){toCheck.push(unknown);return}
  if(allowed.includes(value)){checked++;reasons.push(yes)}else failures.push(no);
 };
 const compareGraduation=(allowed:string[],yes:string,no:string)=>{
  if(profile.grad==='unknown'){toCheck.push('确认具体毕业日期、毕业学年及是否属于政策要求的届别');return}
  if(allowed.includes(profile.grad)){checked++;reasons.push(yes)}
  else failures.push(no);
 };
 const anyEducation=()=>{
  if(profile.education==='unknown')toCheck.push('核验学历及学信网/教育部认证情况');
  else if(profile.education==='college'||profile.education==='bachelor'||profile.education==='master'||profile.education==='doctor'){
   checked++;reasons.push('已提供学历层次，仍须核验学历认证与政策要求');
  }
 };
 switch(record.id){
  case 'bj-jobseeker-grant':
   anyEducation();compareGraduation(graduationThisYear,'属于当前或下届毕业学年候选范围','政策限定毕业学年申请，填写的毕业届别不符');
   question('hardship',['yes'],'自述符合至少一类困难情形','不属于规定的六类困难毕业生','需满足低保、零就业、助学贷款、残疾等至少一项困难条件');
   toCheck.push('就读院校须在北京地区，且过去未重复领取该补贴；由学校审核申报');
   break;
  case 'tj-2027-jobseek-grant':
   anyEducation();compareGraduation(['2027'],'已选2027届','该批次仅面向2027届毕业生');
   question('hardship',['yes'],'自述符合困难情形','未满足公告所列困难群体条件','需具备至少一项规定的困难群体证明');
   toCheck.push('院校是否属于天津市公告规定的普通高校或职业教育院校');
   break;
  case 'sh-2026-jobseek-grant':
   anyEducation();compareGraduation(['2026'],'已选2026届','该公告面向2026届毕业生');
   question('hardship',['yes'],'自述符合困难情形','未满足困难毕业生申请条件','核实是否属于上海当届规定的困难毕业生群体');
   toCheck.push('学校当届集中申报窗口与是否已领取过同类补贴');
   break;
  case 'cq-2026-jobseek':
   anyEducation();compareGraduation(graduationThisYear,'已提供毕业学年信息','政策要求毕业学年符合条件的毕业生');
   question('hardship',['yes'],'自述符合困难情形','未满足困难毕业生申请条件','核实困难身份及材料');
   toCheck.push('所在重庆高校的当届申请窗口及是否重复申领');
   break;
  case 'bj-flex-insurance':
  case 'tj-graduate-flex-insurance':
  case 'sh-2026-flex-insurance':
   anyEducation();compareGraduation(recentTwoYears,'毕业年份可能属于离校两年内','毕业年份超出通常的离校两年期限；仍应按精确毕业日期复核');
   question('work',['flexible'],'填写了灵活就业身份','政策面向灵活就业者，当前填写的就业身份不一致','需确认本人以灵活就业身份登记并就业');
   question('social',['one-year-plus','less-year'],'填写了参保情况','尚未个人参保，不满足当前申领缴费条件','需确认本人按规定以个人身份缴纳相应社会保险');
   toCheck.push('核验失业登记或首次灵活就业、缴费年限、户籍及就读地限制');
   break;
  case 'sh-2026-first-startup':
   anyEducation();compareGraduation(recentTwoYears,'毕业时间可能落在毕业两年内','已填写的毕业届别通常不在毕业两年内');
   question('localHukou',['yes'],'自述具有上海户籍','该政策要求上海户籍','需要确认上海户籍');
   question('work',['founder'],'当前填写为创业者','政策面向首次创业者，当前填写的就业身份不符','需在沪首次创办符合条件的创业组织');
   toCheck.push('创业组织实际经营满1年且至少为1人缴纳职工社保满6个月');
   break;
  case 'cq-2026-shortage-job':
   question('age',['under35'],'年龄位于35周岁及以下档','政策限定35周岁及以下人员','需核实年龄是否不超过35周岁');
   question('work',['employed'],'当前填写为受雇就业','政策面向在岗就业人员，当前填写的就业身份不符','需要在重庆企业的紧缺岗位就业');
   question('social',['one-year-plus'],'自述连续参保1年以上','连续参保未满1年或未参保，当前不满足年限','须在重庆连续参保满1年且保持参保');
   toCheck.push('所在岗位是否列入制造业或生产性服务业官方紧缺岗位清单');
   break;
  case 'cq-xinfeng-2026':
   question('district',['cq-hightech'],'工作区域选为重庆高新区','该项优惠仅面向重庆高新区规定范围','需确认用人单位和工作地点在重庆高新区政策范围');
   anyEducation();toCheck.push('新凤人才类别认定、首次在渝全职就业、3年以上劳动合同和补贴互斥规则');
   question('housingNone',['yes'],'自述无自有住房','涉及住房支持时通常要求符合无房条件','按具体住房支持类别核验个人及家庭住房资格');
   break;
  case 'cq-2025-twelve-counties':
   question('district',['cq-12counties'],'已选12个指定县之一','政策仅适用公告列举的12县','是否在政策所列的12个指定县企业就业并参保');
   anyEducation();toCheck.push('历史对象认定截止日为2025-12-31，2026是否有新批次尚未核实');
   break;
  case 'sh-2026-hukou':
   compareGraduation(['2026'],'2026届符合当届限定','当前不是2026届应届毕业生');
   question('localHukou',['no'],'填写为非上海户籍','该事项面向非上海生源应届毕业生','需确认非上海生源及用人单位申报资质');
   toCheck.push('就业单位是否具备当年申报资格、具体评分和申报窗口');
   break;
  case 'bj-chaoyang-2026':
   question('district',['chaoyang'],'填写在朝阳区就业','专项配租仅适用于规定的朝阳就业人群','在朝阳区就业和缴纳社保的资格');
   question('housingNone',['yes'],'自述无自有住房','该住房专项要求家庭符合无房资格','家庭在朝阳及北京住房条件');
   compareGraduation(alumni,'提供毕业年份供专项审核','学历和毕业年限不符该专项一般要求');
   break;
  case 'sh-xuhui-rent':
   question('district',['xuhui'],'已选徐汇区','该项优惠限定徐汇区符合条件的就业青年','需核对就业单位是否在徐汇区');
   question('age',['under35'],'年龄处于青年档','优惠限定符合当期青年年龄门槛','核实年龄与新就业、参保情况');
   question('housingNone',['yes'],'填写为无房','政策住房优惠通常要求无房','核实本人在沪房产及社保基数条件');
   break;
  case 'sh-pudong-housing':
   question('district',['pudong'],'填写浦东新区','该优惠主要面向浦东政策适用人群','需核对浦东工作单位、学历及产业人才认定');
   question('housingNone',['yes'],'填写无房','住房资格可能不满足','需核对家庭住房、当前房源与运营方当期要求');
   break;
  case 'tj-grad-business-loan':
   question('work',['founder'],'当前从事创业活动','该项目面向创业经营者，当前就业状态与之不符','需确认是否属于在天津的创业主体');
   anyEducation();toCheck.push('首次创业年限、经营满1年、就业带动和贷款资信条件（贷款需要偿还）');
   break;
  case 'bj-youth-rental-2026':
   question('age',['under35'],'符合青年年龄范围','该专项要求年龄符合青年人才门槛','核实年龄及是否属于公告规定的毕业生类别');
   question('housingNone',['yes'],'填写无房','住房专项要求符合无房条件','核实在京无房、工作及社保条件');
   break;
  case 'tj-talent-2025':
   anyEducation();toCheck.push('这是一揽子人才引育制度，需先选定落户、住房或服务事项并逐项认定');
   break;
  case 'cq-youth-jobs-2026':
   toCheck.push('这是多项补贴的政策汇总入口，不代表所有补贴可以同时领取；请逐项确认');
   break;
  default:
   anyEducation();
   toCheck.push('该政策尚未录入完整结构化资格规则，请逐条查看政府原文');
 }
 if(record.district&&record.id!=='cq-2025-twelve-counties'&&record.id!=='cq-xinfeng-2026'&&record.id!=='bj-chaoyang-2026'&&record.id!=='sh-xuhui-rent'&&record.id!=='sh-pudong-housing'){
  toCheck.push('政策适用区县：'+record.district+'，需要核对是否属于覆盖范围');
 }
 if(record.scope==='年度批次')toCheck.push('属于年度专项，不代表当前全部院校都开放申报');
 if(record.reviewNote)notes.push(record.reviewNote);
 if(record.temporal==='historical'||record.temporal==='past-window'||(record.deadline!==undefined&&record.deadline<today)){
  if(record.deadline&&record.deadline<today)notes.unshift('本批次已于 '+record.deadline+' 截止，不可视为仍可申请');
  else notes.unshift('属于历史政策或批次，当前是否可以申报需要查询最新政府公告');
  return {record,status:'archive',reasons,toCheck:unique(toCheck),notes,score:-20};
 }
 if(failures.length){
  return {record,status:'excluded',reasons:failures,toCheck:unique(toCheck),notes,score:-10};
 }
 const isOverview=record.id==='cq-youth-jobs-2026'||record.id==='tj-talent-2025';
 if(isOverview)checked=0;
 return {record,status:checked>=2?'focus':'review',reasons,toCheck:unique(toCheck),notes,score:checked*5-toCheck.length};
}
function unique(items:string[]){return [...new Set(items)]}
export function evaluateTalentPolicies(records:TalentPolicyRecord[],profile:TalentMatchProfile,today?:string){
 const rank:Record<TalentMatchStatus,number>={focus:0,review:1,archive:2,excluded:3};
 return records.filter(r=>r.city===profile.city)
  .map(r=>evaluateTalentPolicy(r,profile,today))
  .sort((a,b)=>rank[a.status]-rank[b.status]||b.score-a.score||b.record.published.localeCompare(a.record.published));
}
