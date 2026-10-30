import {UnifiedPolicyList,type CityPolicyConfig} from '../components/talent/UnifiedPolicyList';
import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from '../data/talentPolicyRecords';
import './talentJinanPolicyPreview.css';

const selectedIds=['qd-rent-25','sd-qingdao-2026-free-housing','qd-home-25','qd-start-25','qd-laoshan-202610'] as const;
const policies=selectedIds.map(id=>TALENT_POLICY_RECORDS.find(p=>p.id===id)).filter((p):p is TalentPolicyRecord=>Boolean(p));
const summaries:Record<string,{category:string;benefit:string;unit:string;detail:string;condition:string;status:string;guide?:string}>={
 'qd-rent-25':{category:'住房补贴',benefit:'¥500—1,200',unit:'／月 · 最长36个月',detail:'本科500元、硕士800元、博士1200元/月，具体按本人学历、就业与政策条件审核。',condition:'毕业年限 · 青岛户籍（另有例外） · 在青就业创业与参保',status:'政策依据有效期至2027年3月，个别受理状态以平台为准',guide:'housing'},
 'sd-qingdao-2026-free-housing':{category:'免租金住宿',benefit:'最长12个月',unit:'按求职与就业状态计算',detail:'来青求职累计最多6个月；在青就业创业后可按规定合并计算，最长12个月，须有可选房源。',condition:'毕业3年内（含毕业学年） · 认证与选房 · 区分求职和就业参保',status:'2026年新规已施行 · 房源与预约实时核实',guide:'stay'},
 'qd-home-25':{category:'购房安家',benefit:'¥10万／15万',unit:'一次性 · 分硕博',detail:'在青创新创业落户并购买唯一商品住宅，符合条件硕士10万元、博士15万元。',condition:'硕士35周岁以下／博士40周岁以下 · 在青创业就业落户 · 唯一住房',status:'申请情况与补贴互斥规则待官方核验'},
 'qd-start-25':{category:'就业创业',benefit:'¥2,000／1.2万',unit:'一次性 · 分创业主体',detail:'首次创办个体工商户最高2000元；符合条件的小微企业首次创业补贴1.2万元。',condition:'符合毕业生等群体要求 · 经营满一年 · 按创业类别缴纳社保',status:'按当期申报通知核验'},
 'qd-laoshan-202610':{category:'人才住房',benefit:'492套',unit:'2026年10月公告规模',detail:'崂山区午山馨苑及海逸公馆当期公布492套；公告数量不等于当前空房。',condition:'崂山区租赁型人才住房准入 · 单位与个人申请时间限制',status:'区级限时批次 · 单位/个人截止时间须核对'}
};

const qingdaoConfig:CityPolicyConfig={city:'青岛',
 tiles:selectedIds.map(id=>({id,category:summaries[id].category,
  amount:summaries[id].benefit,unit:summaries[id].unit,
  description:summaries[id].detail,condition:summaries[id].condition,
  status:summaries[id].status,
  detailPath:summaries[id].guide?'/talent-service/policy-guide-preview/qingdao/'+summaries[id].guide:
   id==='qd-laoshan-202610'?'/talent-service/policy-guide-preview/qingdao/laoshan':undefined
 })),
 subtitle:'同一套全国模板，不重复造页面；将生活、住房、购房和创业真实政策分别展示。',
 notes:'免租住宿与每月现金住房补贴是不同项目；崂山人才住房配租不等于实时有空房。'
};
export function TalentQingdaoPolicyPreview(){return <UnifiedPolicyList config={qingdaoConfig}/>;}
