// A delivery unit is an AI planning hint, never a hard cap on web searches,
// tokens, candidates or task-wide rounds. Reuse the existing search lanes:
// no extra probe request and no synthetic progress.
export function discoveryDeliveryPlan({known=0,round=1,lane=0,width=1,review=false,previousElapsed}={}){
 const first=known===0;
 const slow=Number.isFinite(previousElapsed)&&previousElapsed>=60000;
 const mode=review?'source_review':first?'first_delivery':slow?'focused_continuation':'continuous_discovery';
 const focus=review?'独立复查本轮实际选取的来源或工具资料':lane===0?'自主选择最有希望的具体职业方向及官方招聘来源':'独立选择与主 Agent 不同的具体岗位方向、企业或官方入口';
 return {mode,round,lane,width,focus,global_target_is_not_request_target:true,
  soft_delivery_hint:review?'本次工具资料核对完成即交付':first?'优先交付首个或首批少量有真实来源的具体岗位':slow?'本次聚焦一个能够及时交付的新搜索方向':'本次完成一个连贯的搜索方向后及时交付',
  preserve_all_real_candidates:true};
}
export function discoveryDeliveryInstructions(plan,{coordinator=false}={}){
 const base='【增量交付协议】本次响应是持续研究中的一个交付单元，不是整个任务；全局候选目标不是本次请求需要一次完成的数量。'+plan.focus+'。'+plan.soft_delivery_hint+'。';
 const fast=plan.mode==='first_delivery'?'首批交付优先：只要发现首个或首批可追溯的具体岗位，即形成当前响应并交还调度器；不要为了扩大这一批而连续探索所有方向或预先研究完整JD。':'每完成当前具体方向的有效发现或来源复查，及时交还调度器；把尚未研究的方向留给后续连续研究。';
 return base+fast+'已有真实具体岗位全部保留，不按数量截断，不凑数，不禁止必要的联网检索。仅提交真实公司、原岗位名称、地点、具体链接及来源线索；完整JD、证据评分、长篇研究报告由后续独立流程完成。输出有效JSON，jobs字段放在根对象的第一项，先输出已发现的完整单条岗位对象，再输出其余元数据；不要先输出冗长职业画像、研究计划或解释文字。'+(coordinator?'已有职业画像可直接使用，除非发现有原文依据的新事实，否则无需重复生成；仍按真实整体覆盖判断research_complete，不能把本次交付单元结束当作全局研究完成。必要的工具动作、来源复查及后续研究提示照常保留。':'无需替主Agent判断整个任务是否完成；本次局部交付不影响后续搜索。');
}
