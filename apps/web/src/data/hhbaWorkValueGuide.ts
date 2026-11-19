/** HHBA original editorial guide, China-mainland general workplace guidance.
 * These are newly written HHBA entries, not copied or adapted from third-party guide prose.
 * Legal claims must be checked against the linked source-backed rights topic.
 */
export type GuideStage='before'|'interview'|'offer'|'pay'|'work'|'change'|'leave'|'dispute';
export type GuideTip={
 id:string;stage:GuideStage;title:string;summary:string;steps:string[];
 minutes:string;effort:string;value:string;topic:string|null;keywords:string[];
};
export const GUIDE_UPDATED_ON='2026-11-19';
export const GUIDE_STAGES:{id:GuideStage;label:string;description:string}[]=[
  {
    "id": "before",
    "label": "求职之前",
    "description": "先减少信息不对称"
  },
  {
    "id": "interview",
    "label": "面试与录用",
    "description": "把关键条件问清楚"
  },
  {
    "id": "offer",
    "label": "合同与入职",
    "description": "从签字开始留好依据"
  },
  {
    "id": "pay",
    "label": "工资与假期",
    "description": "让每一笔劳动报酬可核对"
  },
  {
    "id": "work",
    "label": "日常工作",
    "description": "把工作做好，也保护自己"
  },
  {
    "id": "change",
    "label": "变化与协商",
    "description": "遇到变化先看清责任边界"
  },
  {
    "id": "leave",
    "label": "离职与跳槽",
    "description": "不匆忙、不遗漏"
  },
  {
    "id": "dispute",
    "label": "发生争议",
    "description": "分清事实、证据与渠道"
  }
];
export const GUIDE_TIPS:GuideTip[]=[
  {
    "id": "entity",
    "stage": "before",
    "title": "先核对劳动合同的真正用人单位",
    "summary": "招聘品牌不一定是签约主体，先识别要与你建立劳动关系的公司。",
    "steps": [
      "记下招聘公告中的企业全称与办公地点",
      "通过国家企业信用信息公示系统核对主体基本情况",
      "把签约主体与实际工作地点写入待确认问题"
    ],
    "minutes": "5分钟",
    "effort": "低",
    "value": "岗位",
    "topic": "labor-contracts",
    "keywords": [
      "主体",
      "公司",
      "实际用人单位"
    ]
  },
  {
    "id": "fees",
    "stage": "before",
    "title": "遇到入职前收费先停下来核实",
    "summary": "培训费、押金和代报名费用要单独审查，不为不清楚的承诺提前付款。",
    "steps": [
      "问清收费主体、依据和退款条件",
      "保存对方提供的付款账户及服务合同",
      "未核实前不要上传支付凭证或付款"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "钱",
    "topic": null,
    "keywords": [
      "培训费",
      "押金",
      "招聘收费"
    ]
  },
  {
    "id": "posting",
    "stage": "before",
    "title": "把岗位说明保存成可对照的版本",
    "summary": "岗位职责、城市和薪资描述可能会变化，留存最初版本方便核对。",
    "steps": [
      "保存职位标题、岗位编号、发布时间和网址",
      "记录要求的出差频率、班次及工作地点",
      "面试后把与原说明不一致的内容记下来"
    ],
    "minutes": "5分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "岗位截图",
      "招聘JD"
    ]
  },
  {
    "id": "offerbudget",
    "stage": "before",
    "title": "先算每月到手和真实生活成本",
    "summary": "名义薪资不是可支配收入，通勤与租房变化也属于选择成本。",
    "steps": [
      "分别列出固定工资、绩效和可能补贴",
      "估算房租通勤餐费并注明不确定项",
      "用最保守的稳定收入比较两份工作"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "钱",
    "topic": null,
    "keywords": [
      "到手工资",
      "租房",
      "通勤",
      "成本"
    ]
  },
  {
    "id": "source",
    "stage": "before",
    "title": "优先使用能核对招聘来源的渠道",
    "summary": "一份岗位信息越容易追溯到公司官网或正式公告，越容易再次核实。",
    "steps": [
      "找到企业官方招聘主页或正式公告",
      "核对岗位编号与工作地点是否相符",
      "把官方申请页链接留在个人求职记录中"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "官网",
      "直投",
      "官网投递"
    ]
  },
  {
    "id": "verifyregistration",
    "stage": "before",
    "title": "核对营业主体是否仍正常登记",
    "summary": "仅凭企业名称和写字楼照片难以判断经营情况，入职前先核验公开登记信息。",
    "steps": [
      "记录企业全称和统一社会信用代码",
      "查询公示系统登记状态和异常信息",
      "将发现的疑问写入面试确认清单"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": "labor-contracts",
    "keywords": [
      "企业登记",
      "企业信用"
    ]
  },
  {
    "id": "checklocation",
    "stage": "before",
    "title": "确认通勤地点是不是实际岗位地点",
    "summary": "招聘页面的城市标签不一定等于长期上班地点，务必先询问驻场和外派安排。",
    "steps": [
      "核对岗位说明中的工作地址和部门",
      "向招聘方确认驻场出差及调动频率",
      "按真实通勤成本与生活安排比较机会"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "时间",
    "topic": null,
    "keywords": [
      "工作地点",
      "驻场"
    ]
  },
  {
    "id": "verifyrecruiter",
    "stage": "before",
    "title": "核对招聘联系人和企业之间的关系",
    "summary": "陌生社交账号即使使用企业标志也不能直接证明身份，核验渠道更稳妥。",
    "steps": [
      "从公司官网找到招聘部门公开渠道",
      "核实是否由第三方服务机构代招",
      "对敏感材料和付款要求进行额外确认"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "招聘骗局",
      "招聘联系人"
    ]
  },
  {
    "id": "comparesalaries",
    "stage": "before",
    "title": "把招聘工资区间拆成可兑现部分",
    "summary": "最高薪酬往往附带浮动条件，选择机会时应先看稳定到账的收入结构。",
    "steps": [
      "询问工资区间对应经验与绩效条件",
      "区分基本工资浮动奖金与费用补贴",
      "按低中高三种情形列出实际收入区间"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "钱",
    "topic": "unpaid-wages",
    "keywords": [
      "招聘薪资",
      "工资区间"
    ]
  },
  {
    "id": "screenrequirements",
    "stage": "before",
    "title": "逐项确认硬性任职资格与培训要求",
    "summary": "岗位可能需要真实的证书体检或专业准入，面试前核对能避免无谓的往返。",
    "steps": [
      "把学历证书经验等要求分成硬软条件",
      "对不确定的证书向企业官方渠道确认",
      "准备对应真实材料而不购买不明课程"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "资格证书",
      "岗位要求"
    ]
  },
  {
    "id": "mapmobility",
    "stage": "before",
    "title": "估算跨城市求职的搬迁与过渡成本",
    "summary": "异地岗位薪资更高也可能伴随搬家和空窗开支，先计算能更平稳地选择。",
    "steps": [
      "整理交通押金租房和搬迁初期开支",
      "核对公司是否真实提供安家补助",
      "计算第一笔工资到账前需准备的现金"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "钱",
    "topic": null,
    "keywords": [
      "异地求职",
      "搬迁费用"
    ]
  },
  {
    "id": "reviewreferrals",
    "stage": "before",
    "title": "辨别内推与非官方收费服务的界限",
    "summary": "内推通常只是招聘信息渠道，任何所谓保录用收费都需要提高警惕并核验。",
    "steps": [
      "确认岗位仍在官方渠道公开招聘",
      "要求说明推荐人与公司实际关系",
      "拒绝未经核实的保录用和岗位购买承诺"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "内推",
      "保录用"
    ]
  },
  {
    "id": "checkworkmodel",
    "stage": "before",
    "title": "把远程混合与现场办公要求问清楚",
    "summary": "远程工作的口头说法可能与团队实际管理不同，提前了解交付安排更重要。",
    "steps": [
      "确认每周现场办公天数与考勤方式",
      "询问异地出差和临时到岗要求",
      "了解设备网络和信息安全责任边界"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "时间",
    "topic": null,
    "keywords": [
      "远程办公",
      "混合办公"
    ]
  },
  {
    "id": "comparegrowth",
    "stage": "before",
    "title": "核对岗位成长空间是否有真实支撑",
    "summary": "岗位描述里的快速晋升很吸引人，但具体培养方式和考核机制更值得确认。",
    "steps": [
      "询问团队岗位层级与典型晋升路径",
      "了解新人培训周期和指导资源",
      "记录可验证的成长机会而非口号"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "成长空间",
      "晋升"
    ]
  },
  {
    "id": "clarifycontracttype",
    "stage": "before",
    "title": "分清直签派遣外包与项目合作方式",
    "summary": "同在一栋办公楼工作也可能适用不同关系，先确认主体和合同安排。",
    "steps": [
      "问清直接签约的法律主体是谁",
      "核对工资和社保分别由谁承担",
      "将用工形式与招聘页面说明进行对照"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "权益",
    "topic": "flexible-work",
    "keywords": [
      "派遣",
      "外包"
    ]
  },
  {
    "id": "trackapplications",
    "stage": "before",
    "title": "为投递岗位建立去重和跟进记录",
    "summary": "连续投递时容易重复联系同一企业，简单台账能帮助掌握真实进度。",
    "steps": [
      "记录企业岗位编号城市与投递日期",
      "标明使用的官网入口和账号",
      "定期整理回复进度和下一步动作"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "时间",
    "topic": null,
    "keywords": [
      "投递管理",
      "求职台账"
    ]
  },
  {
    "id": "checklayoffsignals",
    "stage": "before",
    "title": "区分经营公开信息与未经证实的裁员传闻",
    "summary": "关于某企业裁员的讨论并不必然真实，求职决策应把可靠性放在前面。",
    "steps": [
      "查找公司公告和正式披露信息",
      "区分最近发生的事件与多年旧消息",
      "将待核实问题在招聘沟通中礼貌确认"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "企业经营",
      "裁员传闻"
    ]
  },
  {
    "id": "avoidmassdata",
    "stage": "before",
    "title": "避免把完整个人证件发给陌生招聘群",
    "summary": "求职中提供必要资料可以理解，但身份证号与账户信息需要严格控制接收对象。",
    "steps": [
      "核对收件人所在组织与收集目的",
      "能遮盖的非必要编号先作最小化处理",
      "不要通过不明短链上传全套私人证件"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "个人证件",
      "招聘隐私"
    ]
  },
  {
    "id": "readcontractnotice",
    "stage": "before",
    "title": "提前了解劳动合同应当包含哪些条款",
    "summary": "入职协议的抬头和格式不等于法律合规，预先了解必备项目可减少临时压力。",
    "steps": [
      "查看劳动合同法关于合同必备条款的规定",
      "列出工资岗位工作地点期限等问题",
      "面试时向招聘方确认是否提供完整文本"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "权益",
    "topic": "labor-contracts",
    "keywords": [
      "必备条款",
      "劳动合同"
    ]
  },
  {
    "id": "checktrialtask",
    "stage": "before",
    "title": "区分岗位技能测试与实际提供劳动",
    "summary": "面试作业可能只是能力测评，也可能涉及真实劳动或知识产权，提交前先明确边界。",
    "steps": [
      "询问测试目的预计耗时和交付范围",
      "避免使用前公司的商业秘密资料",
      "保存题目说明和提交时间等基本记录"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "权益",
    "topic": null,
    "keywords": [
      "无薪试岗",
      "面试作业"
    ]
  },
  {
    "id": "analyzeshifts",
    "stage": "before",
    "title": "把倒班夜班与休息安排纳入岗位比较",
    "summary": "夜班津贴和排班强度会影响实际生活成本，不能只用工资数字来对照。",
    "steps": [
      "确认每个班次的起止时间与轮换方式",
      "了解法定休息与单位实际调休安排",
      "核对交通安全和可持续通勤条件"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "健康",
    "topic": "overtime-leave",
    "keywords": [
      "倒班",
      "夜班"
    ]
  },
  {
    "id": "checkdatasecurity",
    "stage": "before",
    "title": "核对求职平台索取信息的必要范围",
    "summary": "不同求职入口的数据使用规则不一样，尤其需要防止简历未经同意被转给他人。",
    "steps": [
      "阅读简历上传页面的隐私告知",
      "只填和当前职位有关的必要项目",
      "保存删除或撤回授权的官方路径"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "简历保护",
      "信息授权"
    ]
  },
  {
    "id": "decidepriorities",
    "stage": "before",
    "title": "先定义自己不能让步的三项工作条件",
    "summary": "求职清单越长越难筛选，先明确最重要的边界有助于合理分配时间。",
    "steps": [
      "写出最低工资工作地区与时间底线",
      "把必须满足的条件和偏好分开",
      "每周根据真实面试反馈复核一次"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "求职条件",
      "职位筛选"
    ]
  },
  {
    "id": "researchteam",
    "stage": "before",
    "title": "关注具体团队而不只盯着集团品牌",
    "summary": "集团名气不能代表每个业务团队的工作体验，应核对实际岗位负责的业务范围。",
    "steps": [
      "询问所在业务线团队规模和职责",
      "了解岗位入职后前九十天目标",
      "查阅有来源的业务公开资料核验方向"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "团队背景",
      "业务线"
    ]
  },
  {
    "id": "preserveposting",
    "stage": "before",
    "title": "为重要岗位保留可追溯的发布时间信息",
    "summary": "公开岗位可能下架或更改薪资与地点，保留来源有助于后续准确沟通。",
    "steps": [
      "保存岗位原始页面和职位编号",
      "记录首次看到的日期与申请入口",
      "在面试中核对关键条件是否已经变化"
    ],
    "minutes": "5分钟",
    "effort": "低",
    "value": "时间",
    "topic": null,
    "keywords": [
      "职位下架",
      "JD留存"
    ]
  },
  {
    "id": "minimal",
    "stage": "interview",
    "title": "简历只提交必要的个人信息",
    "summary": "求职初期不需要把全部敏感证件信息暴露给陌生招聘联系人。",
    "steps": [
      "先提供与岗位相关的学历和经历",
      "面对索要证件照片或银行信息先核对必要性",
      "区分招聘沟通与正式入职资料收集"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "个人信息",
      "简历隐私"
    ]
  },
  {
    "id": "facts",
    "stage": "interview",
    "title": "用可核实的事实描述自己的成果",
    "summary": "比夸大头衔更有说服力的，是明确写出负责范围和可核验的结果。",
    "steps": [
      "用情境、动作和结果整理一段项目经历",
      "把团队成果与个人贡献分开描述",
      "删除无法解释或无法证明的数字"
    ],
    "minutes": "30分钟",
    "effort": "中",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "简历真实性",
      "面试成果"
    ]
  },
  {
    "id": "question",
    "stage": "interview",
    "title": "面试结束前确认三个关键问题",
    "summary": "工作地点、薪酬构成和汇报关系通常比空泛福利更影响日常体验。",
    "steps": [
      "问清固定薪资与浮动奖金分别是什么",
      "确认考勤、出差和调休如何安排",
      "核实岗位所属部门与直接汇报对象"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "面试问题",
      "薪酬",
      "出差"
    ]
  },
  {
    "id": "record",
    "stage": "interview",
    "title": "把重要口头承诺转成可追溯文字",
    "summary": "面试沟通未必构成确定承诺，但事后确认可以减少理解偏差。",
    "steps": [
      "把对方提到的条件归纳成简短文字",
      "通过正常招聘沟通渠道礼貌确认",
      "保存回复并注意个人信息保护"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "权益",
    "topic": null,
    "keywords": [
      "口头承诺",
      "录用条件"
    ]
  },
  {
    "id": "resignnotyet",
    "stage": "interview",
    "title": "正式确认新机会前不要冲动离职",
    "summary": "候选状态、口头录用和正式报到之间可能仍有变数，先确保重要条件已经明确。",
    "steps": [
      "确认是否收到清晰的录用文件和入职条件",
      "列出背调、体检等尚未完成的事项",
      "按自己的合同与资金情况确定离职窗口"
    ],
    "minutes": "15分钟",
    "effort": "中",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "offer",
      "录用通知",
      "离职时机"
    ]
  },
  {
    "id": "interviewslots",
    "stage": "interview",
    "title": "为面试确认时间与实际地点",
    "summary": "跨城市面试尤其需要明确形式和地址，避免因临时改动产生不必要的交通损失。",
    "steps": [
      "确认线上还是现场面试及实际负责人",
      "核对办公地点门禁与抵达方式",
      "在交通出票前保存最终约定信息"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "时间",
    "topic": null,
    "keywords": [
      "面试时间",
      "现场面试"
    ]
  },
  {
    "id": "videoprivacy",
    "stage": "interview",
    "title": "视频面试前检查录制与隐私告知",
    "summary": "线上面试可能录制音视频，涉及个人信息时应当关注对方的告知和处理范围。",
    "steps": [
      "询问是否会录音录像及保存目的",
      "关闭不必要的桌面通知和共享窗口",
      "使用个人可控的账号与设备参加面试"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "视频面试",
      "面试录制"
    ]
  },
  {
    "id": "introresults",
    "stage": "interview",
    "title": "把自我介绍改成三项可验证成果",
    "summary": "漫长地讲经历容易模糊贡献，先准备可说明背景、动作和结果的具体事实。",
    "steps": [
      "挑选与岗位要求直接相关的三项任务",
      "分别写清本人行动与团队合作范围",
      "预想追问并检查指标与证据是否一致"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "自我介绍",
      "STAR"
    ]
  },
  {
    "id": "interviewnotes",
    "stage": "interview",
    "title": "面试结束立即记录条件变化",
    "summary": "多轮沟通中不同面试官可能给出不同说法，及时记录能帮助后续书面核对。",
    "steps": [
      "会后写下岗位职责与团队预期",
      "记下待确认的薪酬条件和汇报对象",
      "通过正常渠道提出三项关键追问"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "面试笔记",
      "招聘沟通"
    ]
  },
  {
    "id": "salaryhistory",
    "stage": "interview",
    "title": "被问上份薪资时先界定信息边界",
    "summary": "现薪可能不是新岗位价值的可靠标尺，回答前可先讨论当前岗位的合理待遇。",
    "steps": [
      "了解对方核实历史薪酬的实际目的",
      "尽量把讨论落在本岗位职责与市场范围",
      "不提供未经授权的他人或单位财务资料"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "钱",
    "topic": null,
    "keywords": [
      "薪资证明",
      "历史薪资"
    ]
  },
  {
    "id": "marriagequestions",
    "stage": "interview",
    "title": "遇到婚育与私人生活追问时记录事实",
    "summary": "与岗位无关的个人问题可能涉及就业公平和隐私边界，先把问题及场景记清楚。",
    "steps": [
      "区分岗位客观要求和私人生活信息",
      "保留面试公告或后续文字往来",
      "必要时查询平等就业相关官方救济渠道"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "权益",
    "topic": null,
    "keywords": [
      "婚育歧视",
      "就业公平"
    ]
  },
  {
    "id": "interviewfinance",
    "stage": "interview",
    "title": "不要为所谓录用名额先行转账",
    "summary": "即使对方说费用可退，也应确认真实收费主体与法律依据，防止招聘欺诈。",
    "steps": [
      "核对对方提供的收款账户与公司主体",
      "拒绝通过私人账户支付不明保证金",
      "保留聊天与收费说明并向官方渠道求证"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "面试收费",
      "保证金"
    ]
  },
  {
    "id": "followupemail",
    "stage": "interview",
    "title": "给面试反馈设定一次礼貌跟进",
    "summary": "面试后没有立刻回复并不必然等于失败，明确跟进节奏有助于减少反复催问。",
    "steps": [
      "询问预计反馈日期和下一轮安排",
      "到约定时间后发送简短的进度询问",
      "记录回复并同时推进其他真实岗位"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "时间",
    "topic": null,
    "keywords": [
      "面试跟进",
      "招聘回复"
    ]
  },
  {
    "id": "skillsdemo",
    "stage": "interview",
    "title": "用公开或自有素材展示岗位能力",
    "summary": "作品集能说明能力，但把旧公司资料直接给新单位可能引发保密和知识产权问题。",
    "steps": [
      "选取可以公开展示的个人成果",
      "对内部客户与商业数据进行合法脱敏",
      "用过程讲清角色而不泄露源文件"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "安全",
    "topic": null,
    "keywords": [
      "作品集",
      "商业秘密"
    ]
  },
  {
    "id": "screeningmethod",
    "stage": "interview",
    "title": "问清测评与面试的评价维度",
    "summary": "不同面试方式衡量的能力不同，提前理解测评范围可以少花时间准备无关内容。",
    "steps": [
      "确认是否有笔试业务题或专业操作",
      "核对测评时间上限与是否需自备工具",
      "按岗位实际职责准备有证据的实例"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "人才测评",
      "笔试"
    ]
  },
  {
    "id": "backgroundconsent",
    "stage": "interview",
    "title": "背调前确认授权对象和核验范围",
    "summary": "背景调查会涉及个人信息，候选人应了解授权范围，避免空白授权带来过度收集。",
    "steps": [
      "阅读背调授权书所列项目和接收方",
      "纠正可能产生误解的工作时间记录",
      "如有异常主动询问更正与申诉途径"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "权益",
    "topic": null,
    "keywords": [
      "背调",
      "个人信息"
    ]
  },
  {
    "id": "managerexpectations",
    "stage": "interview",
    "title": "与直属负责人确认前九十天目标",
    "summary": "岗位名称往往不能反映上手难度，具体目标更有助于判断是否具备必要资源。",
    "steps": [
      "询问试用期主要成果与验收标准",
      "了解已有团队支持和培训安排",
      "记录关键目标是否与岗位说明一致"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "直属领导",
      "试用目标"
    ]
  },
  {
    "id": "travelexpenses",
    "stage": "interview",
    "title": "问清外地面试谁承担交通住宿",
    "summary": "跨城招聘的差旅成本可能不小，口头说报销时也应先确认标准和实际流程。",
    "steps": [
      "核对哪些面试轮次要求线下参加",
      "要求提供报销标准和票据要求",
      "自行评估没有补贴时能否承担成本"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "钱",
    "topic": null,
    "keywords": [
      "面试报销",
      "跨城面试"
    ]
  },
  {
    "id": "workconditions",
    "stage": "interview",
    "title": "询问实际工作时段和休息制度",
    "summary": "同样的薪水在不同工时安排下差异很大，正式录用前就应了解工作强度。",
    "steps": [
      "确认班次日常上下班时间与轮休",
      "询问出差驻场和节假日安排",
      "将实际工时与薪酬一起比较岗位"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "时间",
    "topic": "overtime-leave",
    "keywords": [
      "工作时间",
      "调休"
    ]
  },
  {
    "id": "recruiteridentity",
    "stage": "interview",
    "title": "将第三方猎头与企业直招区分清楚",
    "summary": "猎头沟通可以提供机会，但对是否取得授权和信息流向应有基本了解。",
    "steps": [
      "确认招聘职位所属的实际用人单位",
      "了解简历会提交给哪些用人主体",
      "不为未经核验的面试安排支付费用"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "猎头",
      "第三方招聘"
    ]
  },
  {
    "id": "interviewclaims",
    "stage": "interview",
    "title": "避免用自己无法解释的数字讲业绩",
    "summary": "面试官追问数据来源时，诚实解释指标定义往往比夸大数字更能建立信任。",
    "steps": [
      "写明数字对应周期和统计口径",
      "区分个人成绩团队成绩与估算值",
      "删除受保密限制或没有依据的表达"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "面试业绩",
      "数据真实性"
    ]
  },
  {
    "id": "remoteassessment",
    "stage": "interview",
    "title": "线上技能测试前明确成果的使用范围",
    "summary": "测试与商业生产任务存在边界，尤其是完整设计和策划交付应先确认用途。",
    "steps": [
      "询问题目预计投入时长和提交格式",
      "明确提交成果是否用于真实商业活动",
      "对异常大工作量的无偿要求保留沟通"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "权益",
    "topic": null,
    "keywords": [
      "无薪试岗",
      "线上笔试"
    ]
  },
  {
    "id": "questionsorder",
    "stage": "interview",
    "title": "把面试追问按必要性排列",
    "summary": "一次问太多问题容易错失关键条件，按重要程度排序更利于高效沟通。",
    "steps": [
      "优先确认职责主体薪酬和工作地点",
      "其次询问绩效周期培训与团队协作",
      "最后核对发展规划和可选福利项目"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "面试提问",
      "沟通技巧"
    ]
  },
  {
    "id": "offersilence",
    "stage": "interview",
    "title": "区分口头意向和正式录用文件",
    "summary": "有入职意向并不等于全部前置条件完成，重要职业决策最好等到关键内容明确。",
    "steps": [
      "确认是否完成用人部门最终审批",
      "核对是否仍有背调体检或预算条件",
      "记录预计出具书面录用通知的时间"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "录用意向",
      "offer"
    ]
  },
  {
    "id": "interviewrights",
    "stage": "interview",
    "title": "拒绝非法证件扣留及不明押金要求",
    "summary": "原件核验与扣押证件是不同事情，求职中不应让身份证件长期留在不明主体手中。",
    "steps": [
      "了解现场需要查验哪些身份证明",
      "对提出留存原件的要求索取依据",
      "涉及争议时查阅劳动合同法相关规定"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "权益",
    "topic": "labor-contracts",
    "keywords": [
      "扣押身份证",
      "劳动法"
    ]
  },
  {
    "id": "party",
    "stage": "offer",
    "title": "核对劳动合同甲方和实际工作主体",
    "summary": "劳动合同应对应清晰的用人单位，名称不一致时先问明原因。",
    "steps": [
      "把合同甲方与招聘主体逐字核对",
      "确认派遣、外包或集团关联公司的说明",
      "对不同主体的工资支付与社保缴纳提出问题"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "权益",
    "topic": "labor-contracts",
    "keywords": [
      "签约主体",
      "甲方",
      "劳务派遣"
    ]
  },
  {
    "id": "copy",
    "stage": "offer",
    "title": "签字之前看完并留存合同版本",
    "summary": "只有签名页、不完整的附件或未填写的关键栏位，都值得先补充确认。",
    "steps": [
      "检查岗位、地点、期限、报酬等关键条款",
      "查看保密、服务期和附件是否齐全",
      "依法取得并妥善保存自己的一份合同"
    ],
    "minutes": "20分钟",
    "effort": "低",
    "value": "权益",
    "topic": "labor-contracts",
    "keywords": [
      "劳动合同",
      "原件",
      "复印件"
    ]
  },
  {
    "id": "paystructure",
    "stage": "offer",
    "title": "把薪资结构拆成明确项目",
    "summary": "固定工资、奖金和补贴的性质不同，约定不清会影响后续核算。",
    "steps": [
      "分别写下基本工资、提成、绩效及发放周期",
      "确认奖金核算标准及变更条件",
      "把未明确的口头部分列成书面确认清单"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "钱",
    "topic": "unpaid-wages",
    "keywords": [
      "工资结构",
      "绩效",
      "提成"
    ]
  },
  {
    "id": "probation",
    "stage": "offer",
    "title": "核对试用期约定是否适用",
    "summary": "试用期期限与工资有法定规则，但适用结论要结合合同期限和事实。",
    "steps": [
      "核对劳动合同期限与试用期条款",
      "留意是否存在重复约定试用期",
      "打开知识库核对具体法条与处理渠道"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "权益",
    "topic": "labor-contracts",
    "keywords": [
      "试用期",
      "试用工资"
    ]
  },
  {
    "id": "socialcheck",
    "stage": "offer",
    "title": "入职后按官方记录核对参保情况",
    "summary": "社保办理情况应以相应官方记录为依据，不要只凭招聘时的口头承诺判断。",
    "steps": [
      "确认单位承诺的参保时间和主体",
      "通过当地官方社保服务渠道查询记录",
      "发现缺漏时保存沟通记录并按官方程序核实"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "权益",
    "topic": "social-insurance",
    "keywords": [
      "社保",
      "缴纳",
      "断缴"
    ]
  },
  {
    "id": "payslip",
    "stage": "pay",
    "title": "每个发薪周期核对工资明细",
    "summary": "把实际到账金额与可核对的薪酬规则比对，比到争议发生时再回忆可靠。",
    "steps": [
      "保存工资条、银行到账记录和考勤记录",
      "对照固定工资、奖金、扣款和报销项目",
      "发现差异时及时用文字向相关人员核实"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "钱",
    "topic": "unpaid-wages",
    "keywords": [
      "少发工资",
      "工资条",
      "扣款"
    ]
  },
  {
    "id": "hours",
    "stage": "pay",
    "title": "记录特殊班次与实际工作时间",
    "summary": "加班认定可能涉及安排、审批与工时制度，完整记录比单一截图更稳妥。",
    "steps": [
      "保存合法获取的排班和考勤记录",
      "按日期记录工作安排与完成情况",
      "对照已批准的工时制度核对休息和报酬"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "时间",
    "topic": "overtime-leave",
    "keywords": [
      "加班费",
      "考勤",
      "排班"
    ]
  },
  {
    "id": "commission",
    "stage": "pay",
    "title": "提前确认提成计算口径",
    "summary": "业绩数字与可支付提成不总是同一概念，先把条件看清楚。",
    "steps": [
      "确认成交、回款或验收哪个节点计提",
      "按月保留本人业绩与核算明细",
      "对存在争议的调整及时留痕反馈"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "钱",
    "topic": "unpaid-wages",
    "keywords": [
      "销售提成",
      "绩效",
      "奖金"
    ]
  },
  {
    "id": "vacation",
    "stage": "pay",
    "title": "把休假申请和审批结果留在同一处",
    "summary": "请假和实际休假应当有清楚记录，避免之后无法确认安排。",
    "steps": [
      "记录适用的假期类型和本人申请日期",
      "保存公司正式审批、回复及已休假日期的记录",
      "对照当地规定与实际出勤记录复核"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "时间",
    "topic": "overtime-leave",
    "keywords": [
      "年假",
      "休假",
      "调休"
    ]
  },
  {
    "id": "reimburse",
    "stage": "pay",
    "title": "把报销条件确认在发生费用之前",
    "summary": "出差、交通和住宿费用最好提前确认标准，减少个人垫付风险。",
    "steps": [
      "问清预算上限、审批和开票要求",
      "保留按规定取得的票据与业务说明",
      "按内部流程及时提交并记录处理状态"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "钱",
    "topic": null,
    "keywords": [
      "出差报销",
      "垫付",
      "发票"
    ]
  },
  {
    "id": "weekly",
    "stage": "work",
    "title": "每周存一份工作成果小结",
    "summary": "持续记录能让绩效沟通和将来的简历更新建立在真实事实之上。",
    "steps": [
      "每周记录自己负责的目标和行动",
      "只保存经授权可留存的非敏感成果摘要",
      "把下一步计划与需要支持的事项写清楚"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "周报",
      "业绩",
      "工作成果"
    ]
  },
  {
    "id": "agreement",
    "stage": "work",
    "title": "重大工作安排尽量取得清晰确认",
    "summary": "任务变更与责任边界不明确时，先确认目标和完成标准通常更有效。",
    "steps": [
      "把目标、时限和交付标准归纳给负责人",
      "在合适的工作渠道确认优先级变化",
      "涉及敏感资料时遵守企业保密和权限要求"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "职责",
      "沟通",
      "工作指令"
    ]
  },
  {
    "id": "workhealth",
    "stage": "work",
    "title": "为长期高负荷安排可执行的休息边界",
    "summary": "健康问题需要结合实际状况判断，别用无休止加班掩盖长期风险。",
    "steps": [
      "识别连续熬夜、长期久坐或高压的频次",
      "安排可持续的用餐、活动和休息间隔",
      "出现持续不适时及时咨询合格医疗人员"
    ],
    "minutes": "15分钟",
    "effort": "中",
    "value": "健康",
    "topic": null,
    "keywords": [
      "久坐",
      "熬夜",
      "健康"
    ]
  },
  {
    "id": "injury",
    "stage": "work",
    "title": "发生工作相关伤害时优先保护就医证据",
    "summary": "是否构成工伤需要主管部门依法认定，现场与就诊资料很重要。",
    "steps": [
      "发生危险时先确保安全并及时就医",
      "保留医疗文书、发生时间与合法取得的现场信息",
      "了解工伤认定申请途径和可能的期限要求"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "健康",
    "topic": "work-injury",
    "keywords": [
      "工伤",
      "受伤",
      "医疗"
    ]
  },
  {
    "id": "privacy",
    "stage": "work",
    "title": "不要将企业敏感文件带入私人资料库",
    "summary": "为了维权保存证据也应守住合法取证和信息最小化的底线。",
    "steps": [
      "区分个人薪酬考勤资料与企业商业秘密",
      "只合法保存必要的本人相关记录",
      "不擅自导出客户信息、源代码或内部系统数据"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "安全",
    "topic": null,
    "keywords": [
      "商业秘密",
      "保密",
      "客户数据"
    ]
  },
  {
    "id": "adjust",
    "stage": "change",
    "title": "收到调岗降薪通知先核对依据",
    "summary": "岗位和薪酬变动可能涉及合同约定及协商程序，不应仅凭口头争执处理。",
    "steps": [
      "保留原劳动合同与当前岗位安排",
      "确认新岗位、工作地点、薪酬及生效时间",
      "及时用文字陈述异议或疑问并查阅适用规定"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "权益",
    "topic": "transfer-paycuts",
    "keywords": [
      "调岗",
      "降薪",
      "异议"
    ]
  },
  {
    "id": "pressure",
    "stage": "change",
    "title": "面对被要求主动离职时先识别文件性质",
    "summary": "主动辞职、协商解除和单位解除可能影响后续权利，签署前应理解差别。",
    "steps": [
      "查看文件标题、离职原因及具体条款",
      "不要把尚未协商一致的方案当作已经生效",
      "如涉及争议先查阅法律专题并考虑专业咨询"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "权益",
    "topic": "unlawful-dismissal",
    "keywords": [
      "逼迫离职",
      "协商解除",
      "辞退"
    ]
  },
  {
    "id": "remote",
    "stage": "change",
    "title": "远程办公先确认考勤与沟通机制",
    "summary": "居家或异地办公也需要明确交付、工作时间和信息安全要求。",
    "steps": [
      "确认日常签到、会议和任务交付方式",
      "明确跨城市工作可能涉及的内部政策",
      "仅通过批准的系统处理工作资料"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "远程办公",
      "居家办公"
    ]
  },
  {
    "id": "checkin",
    "stage": "change",
    "title": "绩效争议尽量回到可量化的事实",
    "summary": "仅讨论主观印象容易僵住，清楚的目标与证据更能推动复核。",
    "steps": [
      "整理考核周期、目标和自己能够证明的成果",
      "提出具体指标差异、评分依据与对应事实",
      "请求书面解释或依正式渠道反馈"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "岗位",
    "topic": null,
    "keywords": [
      "绩效考核",
      "晋升",
      "打分"
    ]
  },
  {
    "id": "sidejob",
    "stage": "change",
    "title": "开展副业前先审查合同与合规边界",
    "summary": "兼职并非一概禁止，但竞业、保密及工作时间义务可能产生冲突。",
    "steps": [
      "核对劳动合同及保密竞业等约定",
      "避免使用现单位客户、资料或工作设备",
      "对可能冲突的业务先寻求适当法律意见"
    ],
    "minutes": "30分钟",
    "effort": "中",
    "value": "安全",
    "topic": null,
    "keywords": [
      "兼职",
      "副业",
      "竞业"
    ]
  },
  {
    "id": "written",
    "stage": "leave",
    "title": "决定离职后保留清晰的通知记录",
    "summary": "不同解除方式可能有不同法定条件，正式通知应符合适用规则。",
    "steps": [
      "先核对当前合同与自己的离职原因",
      "使用可证明送达的正常工作渠道提交",
      "保存发出时间、内容以及对方回复"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "权益",
    "topic": "labor-contracts",
    "keywords": [
      "辞职",
      "提前通知"
    ]
  },
  {
    "id": "settlement",
    "stage": "leave",
    "title": "离职前列出待结算款项",
    "summary": "离职结算可以逐项核对，不必把工资、报销、奖金混成一个总数。",
    "steps": [
      "整理最后工资、提成、报销与未休假期记录",
      "核对工资发放周期和内部结算说明",
      "保留对账明细并按法律规定确认权利"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "钱",
    "topic": "unpaid-wages",
    "keywords": [
      "离职结算",
      "工资报销"
    ]
  },
  {
    "id": "certificate",
    "stage": "leave",
    "title": "确认离职证明和社保转移事项",
    "summary": "离职证明内容可能影响再就业，及时核对比事后补材料更省心。",
    "steps": [
      "询问合法的离职证明出具流程",
      "检查证明中的主体、任职信息和离职日期",
      "核对档案、社保转移及个人资料交接安排"
    ],
    "minutes": "10分钟",
    "effort": "低",
    "value": "岗位",
    "topic": "labor-contracts",
    "keywords": [
      "离职证明",
      "社保转移"
    ]
  },
  {
    "id": "handover",
    "stage": "leave",
    "title": "为交接资料做一份双方可核对清单",
    "summary": "离职交接既保障业务连续，也能减少对遗失物品和工作责任的争议。",
    "steps": [
      "列明已移交的设备、账号和工作事项",
      "通过获批准的内部渠道交接",
      "请接收人确认并保留本人依法可以保存的记录"
    ],
    "minutes": "20分钟",
    "effort": "低",
    "value": "权益",
    "topic": null,
    "keywords": [
      "工作交接",
      "设备"
    ]
  },
  {
    "id": "transition",
    "stage": "leave",
    "title": "换工作前算清现金缓冲和日期",
    "summary": "空窗期的费用和社保衔接值得提前筹划，避免被仓促决策推着走。",
    "steps": [
      "列出手头可用资金和固定月支出",
      "核对新工作预计报到日及关键条件",
      "提前查看社保转移、失业登记等官方指引"
    ],
    "minutes": "30分钟",
    "effort": "中",
    "value": "钱",
    "topic": "social-insurance",
    "keywords": [
      "跳槽",
      "空窗期",
      "社保衔接"
    ]
  },
  {
    "id": "timeline",
    "stage": "dispute",
    "title": "把劳动争议整理成一条事实时间线",
    "summary": "事实、日期和证据对应起来后，咨询或正式维权才更有针对性。",
    "steps": [
      "按时间列出入职、变动和争议发生节点",
      "每一节点标出对应合法取得的材料",
      "把尚不确定的事实单独标注而不作推断"
    ],
    "minutes": "30分钟",
    "effort": "中",
    "value": "权益",
    "topic": null,
    "keywords": [
      "争议",
      "时间线",
      "证据"
    ]
  },
  {
    "id": "path",
    "stage": "dispute",
    "title": "先分清投诉、仲裁与其他行政程序",
    "summary": "工资监察、社会保险征缴、工伤认定和劳动争议仲裁并非同一种入口。",
    "steps": [
      "判断争议主要是欠薪、社保、工伤还是解除合同",
      "查看知识库中的法定程序和主管机关",
      "在提交之前核对地域管辖及所需材料"
    ],
    "minutes": "20分钟",
    "effort": "中",
    "value": "权益",
    "topic": "unpaid-wages",
    "keywords": [
      "仲裁",
      "投诉",
      "劳动监察"
    ]
  },
  {
    "id": "deadline",
    "stage": "dispute",
    "title": "尽早核对可能适用的时效或期限",
    "summary": "不同争议事项的期限及起算点可能不一样，拖延会增加难度。",
    "steps": [
      "记录知道权利受影响的时间与关键事件",
      "对照适用法条核对一般与特殊规则",
      "有重大金额或紧迫期限时及时咨询专业人士"
    ],
    "minutes": "15分钟",
    "effort": "低",
    "value": "权益",
    "topic": "unlawful-dismissal",
    "keywords": [
      "仲裁时效",
      "申请期限"
    ]
  },
  {
    "id": "math",
    "stage": "dispute",
    "title": "把金额计算和法律适用分开核对",
    "summary": "网上常见的补偿公式不能代替个案判断，先确认事实和解除方式。",
    "steps": [
      "列出劳动关系时长和依法可核验的工资明细",
      "区分经济补偿、违法解除赔偿等不同请求",
      "根据具体情形查阅官方法规或咨询专业人士"
    ],
    "minutes": "30分钟",
    "effort": "中",
    "value": "钱",
    "topic": "unlawful-dismissal",
    "keywords": [
      "N+1",
      "2N",
      "赔偿"
    ]
  },
  {
    "id": "help",
    "stage": "dispute",
    "title": "找专业帮助时先明确服务范围与费用",
    "summary": "咨询、写材料、代理仲裁与诉讼的服务范围可能不同，签约前问清楚。",
    "steps": [
      "核实服务提供者和执业资格",
      "明确书面交付、费用与额外收费条件",
      "不相信保证胜诉或先缴大额不明费用的承诺"
    ],
    "minutes": "20分钟",
    "effort": "低",
    "value": "钱",
    "topic": null,
    "keywords": [
      "律师",
      "咨询",
      "费用"
    ]
  }
];
