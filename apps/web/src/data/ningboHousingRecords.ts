import type {TalentHousingRecord} from './talentHousingRecords.ts';
/** 宁波: housing programs and historical projects are NOT available units. */
export const NINGBO_HOUSING_RECORDS:TalentHousingRecord[]=[
  {
    "id": "nb-fh-rental-program",
    "city": "宁波",
    "district": "奉化区住房保障制度",
    "title": "奉化区人才租房保障制度与2026申领渠道",
    "address": "奉化区住房保障制度，不是具体公寓地址",
    "published": "2026-10-16",
    "sourceUrl": "https://qf.ningbo.gov.cn/qykj/easy-public/2747",
    "units": "2026申领按2021/2024政策版本分别匹配，历史租赁期间及家庭保障互斥需按公告核算；租补并非实际可选公寓空房。",
    "rent": "大专500、本科1000、硕士1500、博士2000元/月等分类最高限额，实报实销不超过实际租金。",
    "eligibility": "在奉化就业且符合毕业或职称、劳动合同、本地社保个税、家庭无房的申请人，其他县区不自动适用。",
    "kind": "program",
    "housingCategory": "其他住房",
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
