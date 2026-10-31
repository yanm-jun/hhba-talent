import type {TalentHousingRecord} from './talentHousingRecords.ts';
/** Housing is monetary subsidy PROGRAM, never a live apartment listing. */
export const LESHAN_HOUSING_RECORDS:TalentHousingRecord[]=[
  {
    "id": "sc-leshan-gaoxin-rent-support-202405",
    "city": "乐山",
    "district": "乐山高新区人才安居政策适用单位（非乐山市全域）",
    "title": "乐山高新区首次引才租房补贴制度（无实时房源）",
    "address": "政策为货币租房补贴而非具体楼栋；在乐山市内自行租住，房屋地址由租赁合同和经办部门核验",
    "units": "仅公开每年分类租赁补助标准，不公开具体项目、剩余可租套数或房号",
    "rent": "根据人才类别发放2000、3000、5000或8000元/年租房补贴，非政府出租房间的实际租金报价",
    "eligibility": "适用单位须在乐山高新区注册并纳税，首次全职引进人才须在高新区工作满一年且自行租住在乐山市；人才类别需备案认定，合租同一间住房同一时间段只支持一次，已有租补或安家补助不得重复计算。",
    "sourceUrl": "https://www.leshan.gov.cn/lsswszf/zfwj/90053490/2024060709322216460200000.html",
    "published": "2024-06-07",
    "statusNote": "这是一项2024年有效期3年的区级货币支持制度，不是实时房源或可入住人才公寓项目；非实时空房，具体申报入口待核实。2026是否开放新批次及名额应向高新区主管部门核验。",
    "steps": [
      "阅读高新区人才政策八条第七条，确认自身分类与单位高新区注册纳税资格",
      "向人才服务经办部门核实当期租房补贴申报流程及受理批次，不将过往兑现作为现时受理证明",
      "提供人才分类备案、劳动合同、个税、在高新区满一年工作与乐山市真实租赁合同",
      "核实合租单套仅一次与租补安家补助就高补差规则，按当期公告经单位或主管部门提交申请",
      "由相关单位审核、决定、兑付；制度条款不包含实物空房或具体可选房屋"
    ],
    "kind": "program",
    "reviewedAt": "2026-10-31",
    "housingCategory": "其他住房"
  }
];
