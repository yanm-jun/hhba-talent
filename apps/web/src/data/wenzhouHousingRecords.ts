import type {TalentHousingRecord} from './talentHousingRecords.ts';
/** 温州: housing programs and historical projects are NOT available units. */
export const WENZHOU_HOUSING_RECORDS:TalentHousingRecord[]=[
  {
    "id": "wz-rental-housing-policy",
    "city": "温州",
    "district": "人才住房分布各城区",
    "title": "温州市分类人才住房配租配售与人才公寓制度",
    "address": "人才住房分布各城区；本条为制度，不是具体项目门牌",
    "published": "2024-06-27",
    "sourceUrl": "https://wzast.wenzhou.gov.cn/art/2024/6/27/art_1229798508_58920300.html",
    "units": "已公布人才住房配售、配租分类及相关优惠标准；未核实任何2026当期可申请房号和实时空置量。",
    "rent": "符合类别ABC可免租；DE与F类在条件符合时按评估租金约30%配租，独立项目收费以公示为准。",
    "eligibility": "以温州人才分类认定、全职就业、社保个税、家庭无房及未享政府其他购租房优惠为前提，且各区项目不混用。",
    "kind": "program",
    "housingCategory": "人才公寓",
    "reviewedAt": "2026-10-31",
    "statusNote": "本条为政府公开住房制度或历史项目资料；具体2026年在租房号、即时空房、实际租金、申请期以主管部门和运营方最新公告为准。申报入口待核验，不能将政策制度当作当前可申请房源。",
    "steps": [
      "查找项目主管部门最新公告并核对所在区县、具体房源项目及期限",
      "核对人才分类、劳动关系、社保与本人家庭住房及互斥资格",
      "取得官方当批受理的真实申请入口、表单、材料与具体咨询电话",
      "按政府及实际运营机构的规定提交资格申请、等待住房和人才条件审核",
      "只有取得明确选房资格及实际房号后才核对租金、押金和签约入住事项"
    ]
  }
];
