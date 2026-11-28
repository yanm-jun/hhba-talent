// Recovery suggestions for repeated *evidence-stalled* research, not an
// allowlist of industries, employers, role types, model calls, or search rounds.
// The model may choose entirely different approaches. Each suggestion is used
// only if the same evidence pool stalled after independent source review.
export const EVIDENCE_EXPANSION_PATHS=Object.freeze([
 {key:'transferable_roles',prompt:'重新分析真实经历与可迁移技能，跨行业检索不同名称的工作职责和岗位别名；不要沿用上一轮关键词或局限已知行业。'},
 {key:'official_employers',prompt:'更换企业集合，通过企业官网招聘入口、公开招聘公告及其授权招聘系统查找尚未覆盖的真实职位。'},
 {key:'source_languages',prompt:'针对外资在华、集团子品牌及中英双语招聘，尝试岗位原文名称、公司别名、职位编号和不同语言的公开官方页面。'},
 {key:'fresh_evidence',prompt:'从尚未核验的公开来源、相邻职能、不同招聘批次及工作地点可接受范围探索新证据；遵守用户明确的地点硬约束。'}
]);
export function nextEvidenceExpansion(visited=[]){
 const seen=new Set(Array.isArray(visited)?visited:[]);
 const next=EVIDENCE_EXPANSION_PATHS.find(path=>!seen.has(path.key));
 return next?{...next,visited:[...seen,next.key]}:null;
}
export function ungroundedSearchCompletion({candidateCount=0,target=500,webSources=0,actualQueries=0,publicReads=0}={}){
 // A source-driven task has no numeric threshold: require real web/source
 // evidence before accepting a model's research-complete assertion. Existing
 // numeric-target tasks retain their original compatibility behavior.
 const notEnough=target===null?true:candidateCount<target;
 return notEnough&&webSources===0&&actualQueries===0&&publicReads===0;
}
