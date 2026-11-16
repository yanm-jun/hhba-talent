/** Public launch safeguards. Read-only declarations, not attestations of real-world compliance. */
export const complianceAreas=[
 {id:'terms',title:'格式条款与重大提示',now:'目前只能公开阅读说明，没有会员签约与支付，也没有虚构的同意记录。',required:'购买前必须显著、易懂地列明费用、每月交付、六期资格及中断后果、退款、额外律师费、免责与争议解决；提供解释渠道、可保存合同及版本留痕。仅一个勾选框不当然证明履行了提示义务。',basis:'《民法典》第496—498条、《合同编通则司法解释》第10条'},
 {id:'renewal',title:'续费与自主选择',now:'第一版仅规划用户主动逐月购买；自动续费和免密代扣保持关闭，不预收六期或36期费用。',required:'如以后引入自动续费，须独立、明确、自愿授权，逐笔解释续费金额和时间，在续费前依法显著提醒（适用时提前至少5日），提供随时取消和核验渠道及取消日志。',basis:'《消费者权益保护法实施条例》第10条、《网络交易监督管理办法》第18条'},
 {id:'prepayment',title:'预付式消费与合理退款',now:'未开放会员收费、月费预存及案件服务；没有已销售的36个月会员套餐。',required:'先完成每月服务清单和交付量化，建立订单、真实履约和退款账本，明确无法提供服务、重复扣款、终止合同和剩余费用退还流程；不得写「售出概不退款」。',basis:'《消费者权益保护法实施条例》第22条、《民法典》公平及违约责任规则'},
 {id:'sensitive',title:'敏感信息与劳动案件证据',now:'案件证据上传、律师委托和第三方AI案情处理继续关闭；原有简历系统另行受既有授权规则约束。',required:'先完成敏感个人信息处理影响评估，明确主体、目的、字段、保存期限、影响、数据接收方及权限，依法取得独立授权；做好分权、加密、审计、删除和应急处理，AI分析不得默认开启。',basis:'《个人信息保护法》第17、23、28—30、55—56条、《网络数据安全管理条例》'}
] as const;

export const launchChecks=[
 {id:'identity',label:'真实经营主体、联系人与发票信息',owner:'经营/财税',detail:'名称、统一社会信用代码、营业地址、客服投诉渠道、收款及开票主体一致且真实。'},
 {id:'regulatory',label:'招聘与法律服务业务监管性质审核',owner:'法务/经营',detail:'核查人力资源服务资质及会员连续缴费六期后的法律服务安排是否触及特殊许可或保险等监管边界。'},
 {id:'service',label:'每月职业服务的固定交付与验收标准',owner:'运营/产品',detail:'冻结次数、交付时间、人工/AI范围、当月未用权益、平台故障及纠错。'},
 {id:'lawfirms',label:'律所资质、合作合同及律师委托结构',owner:'律所/法务',detail:'逐项确认合法委托、执业主体、利益冲突审查、律师函额度、仲裁范围和额外费用。'},
 {id:'eligibility',label:'六期资格、争议日期、支付失败与终止规则',owner:'法务/产品',detail:'明确第六期生效时点、计费日、补缴、既有争议、已受理案件及36个月上限。'},
 {id:'terms',label:'重大格式条款的显著提示与说明证据',owner:'法务/技术',detail:'对费用、免责、退出、退款、律师代理和主要限制提供可阅读重点摘要、版本和实际提示日志。'},
 {id:'billing',label:'手动单月订单、真实收款与对账',owner:'财务/技术',detail:'不得默认自动扣费，实际支付需服务端校验、幂等订单、重复扣款核对和账单凭据。'},
 {id:'refund',label:'书面或可保存的电子合同与退费算法',owner:'财务/法务',detail:'明确真实已交付和未交付服务的核算方法，例外及法定退款、违约补救、处理时限与复核。'},
 {id:'privacy',label:'完整版隐私政策、收集清单及联系人',owner:'个人信息保护负责人',detail:'列出信息处理者、数据用途、分类、接收方、保存期限和用户权利实现方式。'},
 {id:'pia',label:'敏感信息处理影响评估与单独授权',owner:'个人信息保护负责人',detail:'对工伤、医疗、金融等材料完成影响评估；必要时区分敏感处理、向律所提供及非必要AI分析的同意。'},
 {id:'security',label:'案件独立存储、最小权限、留存与应急',owner:'技术/安全',detail:'实际验证律师与员工授权范围、加密、访问审计、删除/备份及数据安全事件预案。'},
 {id:'support',label:'投诉处理、人工复核与持续履约能力',owner:'运营',detail:'可使用的客服/投诉渠道、履约人员、材料/案件质量处理和服务中断补救。'}
] as const;

/** No checklist item can be marked complete until audited evidence exists.
 * Public web pages must never interpret this as a true launch authorization.
 */
export const membershipLaunchState={
 status:'blocked',
 acceptingPayment:false,
 autoRenew:false,
 multiMonthPrepay:false,
 acceptingCaseEvidence:false,
 caseAIProcessing:false,
 rulesAreBinding:false,
} as const;
