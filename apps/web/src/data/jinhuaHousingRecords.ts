import type {TalentHousingRecord} from './talentHousingRecords.ts';
/** No claim of available apartments or real-time inventory. */
export const JINHUA_HOUSING_RECORDS:TalentHousingRecord[]=[
  {
    "id": "jh-2023-rental-program",
    "city": "金华",
    "title": "金华人才租房货币补助制度（非空置房源）",
    "district": "金华市区人才住房保障制度，不对应某栋人才公寓",
    "address": "金华市区人才住房保障制度，不对应某栋人才公寓",
    "units": "旧规描述租房货币支持和受理程序，非公寓配租公告，不提供任何2026可租单元数。",
    "rent": "旧版个人租补从每月400元至最高1500元分类；现行标准与具体项目租价必须分别核验。",
    "eligibility": "受支持的人才需符合引进时间、学历/人才类别、在金华市区就业参保和实际租房等资格，住房福利互斥不得重复享受。",
    "sourceUrl": "https://www.jinhua.gov.cn/module/download/downfile.jsp?classid=0&filename=affcce0dbb74492cb88f0c535cf195f1.pdf",
    "published": "2023-05-20",
    "kind": "program",
    "housingCategory": "其他住房",
    "reviewedAt": "2026-10-31",
    "statusNote": "政府原文只证明政策或项目建设事实，不等于当前已开放配租、实时有空房。具体租金、房号和准入条件均以最新项目公示为准；申报入口待核验。",
    "steps": [
      "核对官方政府来源，确认是既有保障制度、历史住房资料还是在建项目",
      "向主管部门或项目业主核实当期房源是否投入运营、真实地段和房号及租价",
      "根据具体项目准入要求核对人才认定、就业参保和本人家庭住房条件",
      "只有政府当批受理通知公布后再从官方入口提交资格申请及相应材料",
      "经审核与公示确认选房资格后签约；在建工程不得视作可入住公寓"
    ]
  }
];
