// Ground skill classification ONLY in a verified JD excerpt, never model guesses.
// "Required" here means the JD actually states a skill expectation. Explicit
// preference and alternative skill groups must not become non-negotiable gates.
const CATALOG=Object.freeze([
 'Python','SQL','JavaScript','TypeScript','React','Vue','Node.js','Java','C++','C#','Go',
 'Git','pandas','Excel','Power BI','Tableau','Linux','Docker','Kubernetes','AWS',
 '机器学习','深度学习','数据分析','用户研究','Figma','Photoshop','Illustrator','剪辑',
 '项目管理','沟通能力','财务分析','市场营销'
]);
const PREFERRED=/(?:优先(?:考虑|录用)?|加分|更佳|更好|bonus|nice[\s-]?to[\s-]?have|preferred|a plus|加分项)/i;
const REQUIRED=/(?:必须|必需|须(?:具备|熟练|掌握|会)|要求|精通|熟练|掌握|熟悉|需要|应当|具备|能够|使用|应用|具有|proficient|must|required|experience with|familiar with)/i;
const OPTIONAL=/(?:不要求|无需|不必|无须|不需要|not required|not necessary)/i;
const ALTERNATIVE=/(?:至少(?:一项|一种|一门)|其中(?:一项|一种)|之一|任意一种|二选一|\sor\s|或者|或\s*(?:java|python|sql|go|c\+\+|linux))/i;
function hasSkill(clause,skill){
 const escaped=skill.replace(/[+?.()]/g,'\\$&');
 if(/^[A-Za-z][A-Za-z0-9 ]*$/.test(skill))
  return new RegExp('(^|[^A-Za-z0-9])'+escaped+'(?=$|[^A-Za-z0-9])','i').test(clause);
 return new RegExp(escaped,'i').test(clause);
}
export function extractSkillRequirements(text){
 if(typeof text!=='string'||text.length<25)
  return {required:[],preferred:[],unclassified:[],evidence_available:false};
 const source=text.slice(0,2600).normalize('NFKC');
 // Split into clauses so a later "优先" does not turn preceding mandatory
 // competencies into preferences. Keep commas/Chinese enumeration together.
 const clauses=source.split(/[\n；;。]+/).flatMap(s=>
  /(?:优先|加分|preferred|must|无需|不要求|但是|但)/i.test(s)?
   s.split(/[，,]+/):[s]).map(s=>s.trim()).filter(Boolean);
 const required=new Set(),preferred=new Set(),unclassified=new Set();
 for(const raw of clauses){
  const clause=raw.slice(0,450);
  if(OPTIONAL.test(clause))continue;
  const skills=CATALOG.filter(s=>hasSkill(clause,s));
  if(!skills.length)continue;
  const group=PREFERRED.test(clause)?preferred:
   REQUIRED.test(clause)&&!ALTERNATIVE.test(clause)?required:unclassified;
  for(const skill of skills)group.add(skill);
 }
 // Explicit must-have takes precedence when the JD repeats an optional skill
 // in a separate must-have clause; preferences never negate mandatory text.
 for(const s of required){preferred.delete(s);unclassified.delete(s);}
 for(const s of preferred)unclassified.delete(s);
 return {required:[...required],preferred:[...preferred],unclassified:[...unclassified],
  evidence_available:true};
}
