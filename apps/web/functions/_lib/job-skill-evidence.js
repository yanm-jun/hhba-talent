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
const REQUIRED=/(?:必须|必备|必需|硬性要求|强制要求|须(?:具备|熟练|掌握|会)|要求|精通|熟练|掌握|熟悉|需要|应当|具备|能够|使用|应用|具有|proficient|must|required|experience with|familiar with)/i;
const STRICT_MANDATORY=/(?:必须|必备|必需|硬性要求|强制要求|mandatory|must(?:\s+have)?|strictly\s+required)/i;
const OPTIONAL=/(?:不要求|无需|不必|无须|不需要|不是必须|非必备|not required|not necessary|not mandatory)/i;
const ALTERNATIVE=/(?:至少(?:一项|一种|一门)|其中(?:一项|一种)|之一|任意一种|二选一|\sor\s|或者|或\s*(?:java|python|sql|go|c\+\+|linux))/i;
function hasSkill(clause,skill){
 const escaped=skill.replace(/[+?.()]/g,'\\$&');
 if(/^[A-Za-z][A-Za-z0-9 ]*$/.test(skill))
  return new RegExp('(^|[^A-Za-z0-9])'+escaped+'(?=$|[^A-Za-z0-9])','i').test(clause);
 return new RegExp(escaped,'i').test(clause);
}
export function extractSkillRequirements(text){
 if(typeof text!=='string'||text.length<25)
  return {required:[],mandatory:[],preferred:[],unclassified:[],evidence_available:false};
 const source=text.slice(0,5500).normalize('NFKC');
 // Split into clauses so a later "优先" does not turn preceding mandatory
 // competencies into preferences. Keep commas/Chinese enumeration together.
 const clauses=source.split(/[\n；;。，,]+/).map(s=>s.trim()).filter(Boolean);
 const required=new Set(),mandatory=new Set(),preferred=new Set(),unclassified=new Set();
 for(const raw of clauses){
  const clause=raw.slice(0,450);
  if(OPTIONAL.test(clause))continue;
  const skills=CATALOG.filter(s=>hasSkill(clause,s));
  if(!skills.length)continue;
  const group=PREFERRED.test(clause)?preferred:
   REQUIRED.test(clause)&&!ALTERNATIVE.test(clause)?required:unclassified;
  for(const skill of skills)group.add(skill);
  if(group===required&&STRICT_MANDATORY.test(clause))
   for(const skill of skills)mandatory.add(skill);
 }
 // Explicit must-have takes precedence when the JD repeats an optional skill
 // in a separate must-have clause; preferences never negate mandatory text.
 for(const s of required){preferred.delete(s);unclassified.delete(s);}
 for(const s of preferred)unclassified.delete(s);
 return {required:[...required],mandatory:[...mandatory],preferred:[...preferred],
  unclassified:[...unclassified],evidence_available:true};
}


/**
 * Extract only unambiguous explicit mandatory skill groups from an official JD.
 * Requiring "Python、SQL" means ALL_OF; "Python 或 Java 任意一种" means
 * ANY_OF; "三项中至少两项" becomes AT_LEAST. Ambiguous prose remains
 * unclassified in extractSkillRequirements and must not block candidates.
 */
export function extractStructuredSkillConditions(text){
 if(typeof text!=='string'||text.length<12)return [];
 const clauses=text.slice(0,5500).normalize('NFKC')
  .split(/[\n。；;，,]+/).map(s=>s.trim()).filter(Boolean);
 const groups=[],seen=new Set();
 for(const raw of clauses){
  if(!STRICT_MANDATORY.test(raw)||OPTIONAL.test(raw))continue;
  const skills=CATALOG.filter(s=>hasSkill(raw,s));
  if(!skills.length)continue;
  const alternative=/(?:或者|或|二选一|任选|任一|之一|至少(?:一项|一种|一门)|其中(?:一项|一种)|\bor\b)/i.test(raw);
  const countMatch=raw.match(/(?:至少|任选|任意)(\d{1,2}|[两二三四五六七八])(?:项|种|门)/);
  const zh={两:2,二:2,三:3,四:4,五:5,六:6,七:7,八:8};
  const n=countMatch?(Number(countMatch[1])||zh[countMatch[1]]):null;
  const operator=n&&n>1?'AT_LEAST':alternative?'ANY_OF':'ALL_OF';
  if(operator==='AT_LEAST'&&n>skills.length)continue;
  const fingerprint=operator+'|'+skills.join('|')+'|'+(n||'');
  if(seen.has(fingerprint))continue;
  seen.add(fingerprint);
  groups.push({
   operator,values:skills,
   ...(operator==='AT_LEAST'?{min_count:n}:{}),
   evidence:raw.slice(0,300),
   certainty:'EXPLICIT'
  });
 }
 return groups.slice(0,15);
}
