// Derive professional tenure only from clearly labelled employment timelines.
// Never interpret education/project/internship dates as verified full-time work.
const WORK_HEADING=/^\s*(?:#{1,5}\s*)?(?:\d{1,2}[.、]\s*)?(?:工作经历|工作履历|任职经历|职业经历|职业履历|professional experience|employment history|work experience)(?=\s|[:：]|$)/i;
const SECTION_END=/^\s*(?:#{1,5}\s*)?(?:\d{1,2}[.、]\s*)?(?:教育经历|教育背景|学习经历|项目经历|项目经验|实习经历|专业技能|技能清单|资格证书|获奖|在校经历|个人评价|自我评价|个人信息|education|projects|internships|skills|certificates)(?=\s|[:：]|$)/i;
const DATE_RANGE=/(?<sy>20\d{2})\s*(?:[./-]\s*|年\s*)(?<sm>0?[1-9]|1[0-2])\s*月?\s*(?:—|–|-|~|～|至|到)\s*(?:(?<ey>20\d{2})\s*(?:[./-]\s*|年\s*)(?<em>0?[1-9]|1[0-2])\s*月?|(?<present>至今|现在|目前|present|current))/gi;
const EMPLOYER_OR_ROLE=/(?:公司|集团|企业|科技|银行|事务所|研究院|工作室|工程师|开发|分析师|产品经理|运营|设计师|销售|顾问|教师|主管|总监|architect|developer|engineer|analyst|designer|manager)/i;
const NON_FULL_TIME=/(?:实习|兼职|志愿|学生会|学生组织|在校|intern(?:ship)?|part[\s-]?time|volunteer)/i;
const toMonth=(y,m)=>Number(y)*12+Number(m)-1;
export function deriveDocumentedWorkTenure(source,now=new Date()){
 if(typeof source!=='string'||!source.trim())return null;
 const today=now instanceof Date?now:new Date(now);
 if(!Number.isFinite(today.getTime()))return null;
 const currentMonth=toMonth(today.getUTCFullYear(),today.getUTCMonth()+1);
 const lines=source.slice(0,20000).replace(/\r/g,'').split('\n');
 let inWork=false;const ranges=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(WORK_HEADING.test(line))inWork=true;
  else if(SECTION_END.test(line))inWork=false;
  if(!inWork)continue;
  const near=[lines[i],lines[i+1]||'',lines[i+2]||''].join(' ').slice(0,340);
  for(const match of line.matchAll(DATE_RANGE)){
   const g=match.groups;
   if(!g)continue;
   const start=toMonth(g.sy,g.sm);
   const end=g.present?currentMonth:toMonth(g.ey,g.em)+1;
   // In-progress months are not counted as completed full months.
   if(start<toMonth(1990,1)||start>currentMonth||end<=start||
      end>currentMonth+1||end-start>600)continue;
   // The date alone is never enough: require nearby employer or job title.
   const context=near.slice(Math.max(0,match.index-60));
   if(!EMPLOYER_OR_ROLE.test(context)||NON_FULL_TIME.test(context))continue;
   ranges.push({start,end,evidence:match[0]});
  }
 }
 if(!ranges.length)return null;
 ranges.sort((a,b)=>a.start-b.start||a.end-b.end);
 let from=ranges[0].start,to=ranges[0].end,total=0;
 for(const row of ranges.slice(1)){
  if(row.start<=to)to=Math.max(to,row.end);
  else{total+=to-from;from=row.start;to=row.end;}
 }
 total+=to-from;
 if(total<=0||total>600)return null;
 return {years:Math.floor(total/12*10)/10,months:total,
  evidence:ranges[0].evidence,interval_count:ranges.length};
}
