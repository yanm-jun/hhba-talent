import {UnifiedPolicyList,type CityPolicyConfig} from '../components/talent/UnifiedPolicyList';
import './talentJinanPolicyPreview.css';

const all=TALENT_POLICY_RECORDS.filter(x=>x.city==='济南');
const highlights:Record<string,{title:string;amount:string;unit?:string;note:string;condition:string}>={
 'sd-jinan-2026-talent-living':{
  title:'济南 · 高层次人才生活补贴',
  amount:'¥1,000–5,000',unit:'/月',
  note:'A—E类人才按类别分档，最长3—5年；以上为不同档次的范围',
  condition:'在济就业 · 人才类别认定 · 按要求参保'
 },
 'jn-home-26':{
  title:'济南 · 人才首次购房补贴',
  amount:'房款50%',unit:'分类设上限',
  note:'仅B/C/D类人才按房款比例计算，上限分别为100万/70万/40万元；博士硕士另有分类规定',
  condition:'指定人才类别 · 符合首套购房规定 · 在济工作与参保'
 },
 'jn-graduate-housing':{
  title:'高校毕业生住房与生活补贴（2024版）',
  amount:'¥500–1,500',unit:'/月',
  note:'历史文件分别列有毕业生生活补贴和租房补贴；不是统一按此金额发放',
  condition:'需核对现行学历分类、在济就业与社保资格'
 },
 'jn-transport':{
  title:'泉城人才交通卡（2024版）',
  amount:'公交·地铁',unit:'出行优惠',
  note:'旧版文件涉及部分人才类别和符合要求的在济就业应届毕业生',
  condition:'需核对现行人才类别、办理条件及有效期限'
 }
};

const jinanConfig:CityPolicyConfig={city:'济南',
 tiles:all.map(record=>({id:record.id,
  category:record.category==='购房补贴'?'购房安家':record.category,
  amount:highlights[record.id]?.amount||'按政策分档',
  unit:highlights[record.id]?.unit||'条件核定',
  description:highlights[record.id]?.note||record.benefit,
  condition:highlights[record.id]?.condition||record.eligibility,
  detailPath:record.id==='sd-jinan-2026-talent-living'?'/talent-service/policy-guide-preview/jinan':undefined
 })),
 subtitle:'分类展示核心待遇与条件。完整申请资格、材料、六步办理和官方原文均在详情。',
 notes:'现行申领状态需要官方确认；2024年历史政策单独展示，不与2026年资料混排。'
};
export function TalentJinanPolicyPreview(){return <UnifiedPolicyList config={jinanConfig}/>;}
