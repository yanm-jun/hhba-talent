import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,ChevronDown,ClipboardCheck,ExternalLink,FileSearch,GraduationCap,Info,Search,ShieldCheck,TriangleAlert} from 'lucide-react';
import {Link} from '../router';
import {TALENT_POLICY_RECORDS,TALENT_POLICY_REVIEW_DATE} from '../data/talentPolicyRecords';
import {DEFAULT_TALENT_PROFILE,MUNICIPAL_MATCH_CITIES,evaluateTalentPolicies,
 type TalentMatchProfile,type TalentMatchStatus} from '../data/talentMatchEngine';
import '../styles/talent-matching.css';

const degrees=[
 ['unknown','暂不确定'],['college','专科'],['bachelor','本科'],['master','硕士'],['doctor','博士']
] as const;
const grads=[
 ['unknown','尚未确定'],['2027','2027届'],['2026','2026届'],['2025','2025届'],
 ['2024-older','2024届及更早'],['not-graduate','不属于高校毕业生']
] as const;
const occupations=[
 ['unknown','尚未确定'],['student','在校学生'],['employed','受雇就业'],['unemployed','离校未就业'],
 ['flexible','灵活就业'],['founder','自主创业']
] as const;
const labels:Record<TalentMatchStatus,string>={focus:'优先核对',review:'需要补充条件',archive:'历史或截止批次',excluded:'已知条件不一致'};
const descriptions:Record<TalentMatchStatus,string>={
 focus:'已填条件与部分规则相关，但未证明具备全部申请资格。',
 review:'目前信息不足，仍可进一步核对政策细则。',
 archive:'该批次已截止或历史规则尚未确认是否继续执行。',
 excluded:'填写的信息与至少一项明确条件存在冲突，可修改后重新比对。'
};
const cityDistricts:Record<string,readonly (readonly [TalentMatchProfile['district'],string])[]>={
 '北京':[['unknown','暂不确定'],['chaoyang','朝阳区'],['other','北京其他区']],
 '天津':[['unknown','暂不确定'],['other','天津其他区县']],
 '上海':[['unknown','暂不确定'],['xuhui','徐汇区'],['pudong','浦东新区'],['other','上海其他区']],
 '重庆':[['unknown','暂不确定'],['cq-hightech','重庆高新区'],['cq-12counties','政策12县之一'],['other','重庆其他区县']]
};
const statuses:TalentMatchStatus[]=['focus','review','archive','excluded'];
const paramsFromHistory=():TalentMatchProfile=>{
 const historyData=typeof window==='undefined'?null:window.history.state?.hhbaTalentMatchDraft;
 if(!historyData||typeof historyData!=='object')return DEFAULT_TALENT_PROFILE;
 const p=historyData as Record<string,unknown>;
 return {
 ...DEFAULT_TALENT_PROFILE,
 city:typeof p.city==='string'&&MUNICIPAL_MATCH_CITIES.includes(p.city as typeof MUNICIPAL_MATCH_CITIES[number])?p.city:'北京',
 education:degrees.some(x=>x[0]===p.education)?p.education as TalentMatchProfile['education']:'unknown',
 grad:grads.some(x=>x[0]===p.grad)?p.grad as TalentMatchProfile['grad']:'unknown'
 };
};
export function TalentMatchingPage({city}:{city:string}){
 const validCity=MUNICIPAL_MATCH_CITIES.includes(city as typeof MUNICIPAL_MATCH_CITIES[number]);
 const [form,setForm]=useState<TalentMatchProfile>(()=>{
  const initial=paramsFromHistory();
  return {...initial,city:validCity?city:'北京'};
 });
 const [showExtra,setShowExtra]=useState(false);
 const [showResults,setShowResults]=useState(false);
 const [tab,setTab]=useState<TalentMatchStatus|'all'>('all');
 const entries=useMemo(()=>evaluateTalentPolicies(TALENT_POLICY_RECORDS,form),[form]);
 const counts=useMemo(()=>statuses.reduce((map,k)=>({...map,[k]:entries.filter(r=>r.status===k).length}),{} as Record<TalentMatchStatus,number>),[entries]);
 const visible=tab==='all'?entries:entries.filter(x=>x.status===tab);
 const change=<K extends keyof TalentMatchProfile>(key:K,value:TalentMatchProfile[K])=>{
  setForm(previous=>{
   const other=key==='city'?{district:'unknown' as const}:null;
   return {...previous,[key]:value,...other};
  });
 };
 const submit=()=>{setShowResults(true);setTab('all');requestAnimationFrame(()=>document.getElementById('talent-match-results')?.scrollIntoView({behavior:'smooth',block:'start'}));};
 const field=(label:string,key:keyof TalentMatchProfile,options:readonly (readonly [string,string])[])=>
  <label className="tm-field" key={key}><span>{label}</span><div className="tm-field-wrap"><select value={form[key]} onChange={e=>change(key,e.target.value as never)}>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select><ChevronDown size={14}/></div></label>;
 if(!validCity)return <section className="tm-unsupported"><FileSearch size={24}/><h1>该城市尚未接入政策匹配</h1><p>智能预筛目前只覆盖北京、天津、上海、重庆。其他城市仍可查询政策列表，但未开发对应的资格规则。</p><Link to="/talent-service">返回人才服务首页 <ArrowRight size={15}/></Link></section>;
 return <div className="tm-page">
  <nav aria-label="当前位置" className="tm-breadcrumb"><Link to="/talent-service">人才服务首页</Link><span>›</span><Link to={'/talent-service/city/'+encodeURIComponent(form.city)}>{form.city}</Link><span>›</span>政策智能匹配</nav>
  <header className="tm-header"><div className="tm-intro"><span className="tm-kicker">HHBA / TALENT MATCHING</span><h1>看看你可能符合哪些人才政策？</h1>
   <p>填写几个基础条件，系统对比四个直辖市已收录的政府政策，标出明确限制与待核验事项。</p></div><GraduationCap size={36} strokeWidth={1.5}/></header>
  <section className="tm-form-box" aria-labelledby="tm-form-heading">
   <div className="tm-form-top"><h2 id="tm-form-heading">基础情况</h2><span>可只填写已知信息，其余保留“暂不确定”</span></div>
   <div className="tm-fields">
    {field('目标城市','city',MUNICIPAL_MATCH_CITIES.map(c=>[c,c+'市']))}
    {field('最高学历','education',degrees)}
    {field('毕业届别','grad',grads)}
    {field('当前就业状态','work',occupations)}
   </div>
   <button type="button" className="tm-expand" aria-expanded={showExtra} onClick={()=>setShowExtra(v=>!v)}>
    {showExtra?'收起':'补充'}资格信息（可选） <ChevronDown size={15} className={showExtra?'rotated':''}/>
   </button>
   {showExtra&&<div className="tm-fields tm-extra-fields">
    {field('是否属于规定的困难毕业生','hardship',[['unknown','暂不确定'],['yes','符合至少一类'],['no','不符合']])}
    {field('是否有本市户籍','localHukou',[['unknown','暂不确定'],['yes','有'],['no','没有']])}
    {field('工作或拟就业区县','district',cityDistricts[form.city]||[['unknown','暂不确定']])}
    {field('年龄区间','age',[['unknown','暂不确定'],['under35','35周岁及以下'],['over35','36周岁及以上']])}
    {field('连续参保情况','social',[['unknown','暂不确定'],['one-year-plus','已连续参保至少一年'],['less-year','已参保但不足一年'],['none','当前未参保']])}
    {field('是否符合无自有住房情况','housingNone',[['unknown','暂不确定'],['yes','当前无自有住房'],['no','有自有住房']])}
   </div>}
   <aside className="tm-privacy"><ShieldCheck size={16}/><span>本功能在浏览器内比对静态政策规则，不提交身份证、姓名、电话或账户资料；不会向政府发送申请。</span></aside>
   <div className="tm-form-actions"><button type="button" className="tm-submit" onClick={submit}><Search size={17}/> 查看政策预筛结果 <ArrowRight size={16}/></button>
    <button type="button" className="tm-clear" onClick={()=>{setForm({...DEFAULT_TALENT_PROFILE,city:form.city});setShowExtra(false);setShowResults(false)}}>重置条件</button></div>
  </section>
  {showResults&&<section id="talent-match-results" className="tm-results" aria-labelledby="tm-result-heading">
   <div className="tm-results-title"><div><span className="tm-kicker">SOURCE-BASED SCREENING / 政策预筛</span><h2 id="tm-result-heading">{form.city} · 政策核对结果</h2><p>已整理{entries.length}条当地政策参考记录。不是行政审批结果，也不保证能申领。</p></div><span className="tm-review-date">政策索引整理：{TALENT_POLICY_REVIEW_DATE}</span></div>
   <div className="tm-counts">{statuses.map(k=><button type="button" key={k} className={'tm-count '+(tab===k?'selected ':'')+k} onClick={()=>setTab(tab===k?'all':k)} aria-pressed={tab===k}><b>{counts[k]}</b><span>{labels[k]}</span></button>)}</div>
   <div className="tm-tabs"><button type="button" onClick={()=>setTab('all')} className={tab==='all'?'active':''}>全部（{entries.length}）</button>{statuses.map(k=><button key={k} type="button" onClick={()=>setTab(k)} className={tab===k?'active':''}>{labels[k]}（{counts[k]}）</button>)}</div>
   <div className="tm-result-list">
    {!visible.length?<div className="tm-no-result"><Info size={20}/><p>当前没有这一类别的政策，试试其他筛选或查看全部。</p></div>:visible.map(({record,status,reasons,toCheck,notes})=><article key={record.id} className="tm-result-card">
     <div className="tm-result-top"><span className={'tm-status '+status}>{labels[status]}</span><span>{record.category}{record.scope?' · '+record.scope:''}{record.district?' · '+record.district:''}</span></div>
     <h3>{record.title}</h3><p className="tm-benefit">{record.benefit}</p>
     <p className="tm-explanation">{descriptions[status]}</p>
     {reasons.length>0&&<div className={'tm-evidence '+(status==='excluded'?'conflict':'')}><strong>{status==='excluded'?'与条件不一致之处：':'已参考的条件：'}</strong><ul>{reasons.filter(x=>status==='excluded'||x!=='目标城市：'+form.city).slice(0,4).map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
     {toCheck.length>0&&<details className="tm-pending" open={status==='focus'}><summary>还需要核验的关键条件（{toCheck.length}项）</summary><ul>{toCheck.slice(0,7).map((x,i)=><li key={i}>{x}</li>)}</ul></details>}
     {notes.length>0&&<div className="tm-notes"><TriangleAlert size={14}/><span>{notes[0]}</span></div>}
     <footer><Link to={'/talent-service/policy/'+encodeURIComponent(record.id)}>查看申请资格和办理流程 <ArrowRight size={14}/></Link><a href={record.sourceUrl} target="_blank" rel="noopener noreferrer">政府原文 <ExternalLink size={14}/></a></footer>
    </article>)}
   </div>
   <div className="tm-caveat"><ShieldCheck size={19}/><p>匹配仅根据你填写的部分信息排除显著冲突并提示核验要点。政策未收录、资格细则缺失、批次变化和当地审批规则均可能导致误差。**任何结果都不是“符合申领条件”的确认**；申报前务必核对政府原文与经办机构。</p></div>
  </section>}
  <div className="tm-bottom-link"><Link to={'/talent-service/list/policies/'+encodeURIComponent(form.city)}><ArrowLeft size={15}/> 浏览{form.city}全部人才政策</Link></div>
 </div>;
}
