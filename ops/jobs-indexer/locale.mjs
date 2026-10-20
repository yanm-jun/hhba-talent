// Conservative labels for the Chinese-first preview.
// Original job titles, locations and official URLs remain untouched.
const phrases=[
 ["machine learning engineer","机器学习工程师"],
 ["artificial intelligence engineer","人工智能工程师"],
 ["software development engineer","软件开发工程师"],
 ["software engineer","软件工程师"],
 ["frontend engineer","前端工程师"],["front-end engineer","前端工程师"],
 ["backend engineer","后端工程师"],["back-end engineer","后端工程师"],
 ["full stack engineer","全栈工程师"],["full-stack engineer","全栈工程师"],
 ["data scientist","数据科学家"],["data engineer","数据工程师"],["data analyst","数据分析师"],
 ["product designer","产品设计师"],["product manager","产品经理"],
 ["program manager","项目群经理"],["project manager","项目经理"],
 ["account executive","客户经理"],["account manager","客户经理"],
 ["sales development representative","销售开发代表"],
 ["business development representative","业务拓展代表"],
 ["business development","业务拓展"],
 ["customer success manager","客户成功经理"],
 ["customer success","客户成功"],
 ["solutions architect","解决方案架构师"],["solution architect","解决方案架构师"],
 ["solutions engineer","解决方案工程师"],
 ["site reliability engineer","网站可靠性工程师"],
 ["security engineer","安全工程师"],["platform engineer","平台工程师"],
 ["infrastructure engineer","基础设施工程师"],
 ["research scientist","研究科学家"],["research engineer","研究工程师"],
 ["research assistant","研究助理"],
 ["marketing manager","市场营销经理"],["marketing specialist","市场营销专员"],
 ["operations manager","运营经理"],["operations analyst","运营分析师"],
 ["finance manager","财务经理"],["financial analyst","财务分析师"],
 ["recruiting coordinator","招聘协调员"],["human resources","人力资源"],
 ["product marketing","产品市场营销"],["growth marketing","增长营销"],
 ["quality assurance","质量保证"],["quality engineer","质量工程师"],
 ["technical support","技术支持"],["sales engineer","销售工程师"],
 ["engineering manager","工程经理"],["sales manager","销售经理"],
 ["customer support","客户支持"],["internship","实习"],["intern","实习生"],
 ["new grad","应届生"],["graduate","应届生"],
 ["director","总监"],["principal","首席"],["staff","专家级"],["senior","高级"],
 ["junior","初级"],["lead","负责人"],["head of","负责人"],
 ["vice president","副总裁"],["associate","助理"],["specialist","专员"],
 ["representative","代表"],["coordinator","协调员"],["consultant","顾问"],
 ["engineer","工程师"],["developer","开发工程师"],["designer","设计师"],
 ["scientist","科学家"],["architect","架构师"],["analyst","分析师"],
 ["manager","经理"],["sales","销售"],["marketing","市场营销"],
 ["operations","运营"],["finance","财务"],["legal","法务"],
 ["software","软件"],["hardware","硬件"],["data","数据"],["cloud","云"],
 ["security","安全"],["product","产品"],["growth","增长"],
 ["payments","支付"],["compliance","合规"],["partnerships","合作伙伴"],
 ["platform","平台"],["infrastructure","基础设施"],["global","全球"],
 ["regional","区域"],["international","国际"],["automation","自动化"],
 ["customer","客户"],["enterprise","企业"],["research","研究"],
 ["machine learning","机器学习"],["ai","人工智能"],["ml","机器学习"],
 ["remote","远程"],["contract","合同制"],["full-time","全职"],["part-time","兼职"],
 ["and","与"]
].sort((a,b)=>b[0].length-a[0].length);
const cities=[
 ["san francisco","旧金山"],["new york city","纽约"],["new york","纽约"],
 ["los angeles","洛杉矶"],["san jose","圣何塞"],["mountain view","山景城"],
 ["palo alto","帕洛阿尔托"],["san diego","圣迭戈"],
 ["singapore","新加坡"],["united states","美国"],["usa","美国"],
 ["united kingdom","英国"],["london","伦敦"],
 ["hong kong","中国香港"],["tokyo","东京"],["japan","日本"],
 ["toronto","多伦多"],["vancouver","温哥华"],["canada","加拿大"],
 ["sydney","悉尼"],["melbourne","墨尔本"],["australia","澳大利亚"],
 ["berlin","柏林"],["munich","慕尼黑"],["germany","德国"],
 ["paris","巴黎"],["france","法国"],["boston","波士顿"],
 ["seattle","西雅图"],["chicago","芝加哥"],["austin","奥斯汀"],
 ["beijing","北京"],["shanghai","上海"],["shenzhen","深圳"],
 ["remote","远程"],["hybrid","混合办公"],["multiple locations","多个地点"],
 ["not specified","未注明"],["worldwide","全球"]
].sort((a,b)=>b[0].length-a[0].length);
function replaceWhole(input,items){
 let s=input;
 for(const [english,chinese] of items){
  const expr=english.replace(/[\^$.|?*+()[\]{}]/g,"\\$&");
  s=s.replace(new RegExp("(^|[^a-z])("+expr+")(?=$|[^a-z])","gi"),(_match,start)=>start+chinese);
 }
 return s;
}
function cleanup(s){return s.replace(/[,;|]+/g," · ").replace(/[-–—]+/g," · ")
 .replace(/\s*\/\s*/g,"／").replace(/[ \t]{2,}/g," ").replace(/\s*·\s*/g," · ").trim();}
function safeChinese(raw,table){
 if(/[\u3400-\u9fff]/.test(raw)&&!/[a-z]{3,}/i.test(raw))return {text:raw,status:"original"};
 const out=cleanup(replaceWhole(String(raw||""),table));
 // Never present partly-translated English prose as a complete Chinese translation.
 if(/[a-z]{3,}/i.test(out))return {text:"",status:"needs-review"};
 return {text:out||"",status:out?"rules":"needs-review"};
}
export function localizeJob(job){
 const title=safeChinese(job.title,phrases);
 const location=safeChinese(job.location,cities);
 return {...job,
  titleZh:title.text||"职位名称待翻译",
  locationZh:location.text||"工作地点待翻译",
  titleTranslationStatus:title.status,
  locationTranslationStatus:location.status};
}
