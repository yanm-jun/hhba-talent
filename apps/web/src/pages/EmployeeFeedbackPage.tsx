import {useState, type FormEvent} from 'react';
import {ArrowLeft, CheckCircle2, ClipboardCheck, HeartHandshake, LockKeyhole, ShieldCheck, UserRoundCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link, navigate} from '../router';
import {api, employeeFeedbackApiReady, employerApiReady, type User, type EmployeeFeedbackRatings} from '../services/api';
import '../styles/employee-feedback.css';

type Dimension = keyof EmployeeFeedbackRatings;
const questions: {key:Dimension;title:string;hint:string}[]=[
  {key:'pay',title:'薪酬支付体验',hint:'工资支付是否及时、信息是否清楚'},
  {key:'insurance',title:'社会保障体验',hint:'社保及基本劳动保障落实情况'},
  {key:'rest',title:'工时与休假体验',hint:'工作安排、休息和休假是否合理'},
  {key:'respect',title:'工作尊重与沟通',hint:'在工作中是否受到尊重，能否反馈问题'},
  {key:'development',title:'员工发展与成长',hint:'培训、职业发展和学习机会'}
];
const isUuid=(s:string)=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);

export function EmployeeFeedbackPage({user}:{user:User|null}) {
  // Organization ID must originate from a verified public employer profile.
  // It is NEVER proof of eligibility, which the server independently verifies.
  const orgId=new URLSearchParams(window.location.search).get('org')||'';
  const [answers,setAnswers]=useState<Partial<EmployeeFeedbackRatings>>({});
  const [consent,setConsent]=useState(false);
  const [ticket,setTicket]=useState('');
  const [period,setPeriod]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const enabled=employeeFeedbackApiReady&&!!user&&isUuid(orgId);
  if(employerApiReady&&!user&&employeeFeedbackApiReady){
    navigate('/candidate/login?next=%2Femployee%2Ffeedback');
    return null;
  }
  async function issue(){
    if(!enabled)return;
    setBusy(true);setError('');
    try{
      const data=await api.issueEmployeeFeedbackTicket(orgId);
      setTicket(data.ticket);setPeriod(data.period);
    }catch(e){setError(e instanceof Error?e.message:'无法核验员工资格');}
    finally{setBusy(false)}
  }
  async function submit(e:FormEvent){
    e.preventDefault();
    if(!enabled||!ticket||!consent||!questions.every(q=>Number.isInteger(answers[q.key])&&Number(answers[q.key])>=1&&Number(answers[q.key])<=5))return;
    setBusy(true);setError('');
    try{
      await api.submitEmployeeFeedback(orgId,ticket,answers as EmployeeFeedbackRatings);
      setTicket('');setSubmitted(true);
    }catch(e){setError(e instanceof Error?e.message:'无法提交反馈');}
    finally{setBusy(false)}
  }
  return <Shell user={user}><main className="ef-page">
    <Link to="/employer/public" className="ef-back"><ArrowLeft size={15}/> 返回企业公开档案</Link>
    <div className="ef-heading"><p>HHBA · 员工真实反馈</p><h1>让每一份真实的工作体验被尊重。</h1>
      <p>你的反馈将用于了解企业的员工关怀表现。此系统不会把原始个人评分或评价人身份提供给企业，也不会把主观体验直接当作已证实的违法事实。</p></div>
    <div className="ef-safety"><LockKeyhole size={23}/><div><strong>隐私保护说明</strong><p>正式版仅允许经独立核验的在职员工每季度提交一次。评分与身份凭据分开存储，不收集自由文本、姓名、部门或具体工作地点。只有季度结束且符合至少 10 份反馈的门槛，才展示汇总；小样本不公开。技术和运营措施仍无法保证绝对匿名，请勿输入可识别个人的信息。</p></div></div>
    {!employeeFeedbackApiReady&&<div role="status" className="ef-notice"><ShieldCheck size={18}/><div><strong>真实反馈服务尚未开放</strong><p>企业身份核验、独立员工关系验证、CSRF、安全运维与隐私制度接通前，当前静态预览不会采集或提交任何员工信息。</p></div></div>}
    {employeeFeedbackApiReady&&!isUuid(orgId)&&<p className="ef-notice">请从已认证企业的公开档案进入反馈页面。企业身份和在职资格均由后端复核。</p>}
    <form onSubmit={submit} className="ef-form">
      <div className="ef-panel ef-eligibility"><UserRoundCheck size={19}/><div><h2>员工关系独立核验</h2><p>核验结果仅用于发放一次性提交资格，企业管理员不能给员工生成或查看提交凭证。</p>
        <button type="button" disabled={!enabled||busy||!!ticket||submitted} onClick={()=>void issue()}>{ticket?'本季度资格已核验':enabled?'验证在职资格':'待可信员工认证服务接入'}</button>
        {ticket&&<span className="ef-verified"><CheckCircle2 size={16}/> 已获得本季度资格（{period}）。凭据仅暂存当前页面，不上传到企业。</span>}
      </div></div>
      <section className="ef-panel"><h2>员工体验问卷</h2><p className="ef-field-help">共五项，每项 1–5 分；1 分表示体验较差，5 分表示体验良好。未获得反馈资格时题目仅供预览。</p>
        {questions.map(q=><fieldset className="ef-question" key={q.key} disabled={!ticket||busy||submitted}><legend>{q.title}</legend><p>{q.hint}</p>
          <div className="ef-rating">{[1,2,3,4,5].map(n=><label key={n} className={answers[q.key]===n?'selected':''}><input type="radio" name={q.key} checked={answers[q.key]===n} onChange={()=>setAnswers(old=>({...old,[q.key]:n}))}/><span>{n}</span></label>)}</div>
        </fieldset>)}
      </section>
      <section className="ef-panel"><div className="ef-consent"><ClipboardCheck size={19}/><div><h2>提交前确认</h2><p>反馈应基于本人真实工作体验。提交后不会形成可由员工账户查询的逐条历史记录；因为去标识化设计，单条反馈撤回需要在实际隐私流程中另行明确能力与限制。</p></div></div>
        <label className="ef-check"><input type="checkbox" checked={consent} disabled={!ticket||busy||submitted} onChange={e=>setConsent(e.target.checked)}/>我了解隐私保护的局限，确认自愿提供真实体验。</label>
        {error&&<p role="alert" className="ef-error">{error}</p>}
        {submitted&&<p role="status" className="ef-success"><CheckCircle2 size={16}/> 本季度反馈已接收。公开展示需满足季度结束和小样本保护门槛。</p>}
        <button className="ef-submit" disabled={!enabled||!ticket||!consent||!questions.every(q=>Number.isInteger(answers[q.key])&&Number(answers[q.key])>=1&&Number(answers[q.key])<=5)||busy||submitted} type="submit">{submitted?'已接收':busy?'处理中…':employeeFeedbackApiReady?'提交本季度反馈':'尚未开放真实提交'}</button>
      </section>
    </form>
    <div className="ef-footer"><HeartHandshake size={20}/><div><p>HHBA 希望真实改善员工处境，而不是用好评数量决定企业命运。反馈将与独立的证据核验、申诉和评分规则配合使用。</p><Link to={"/employee/privacy-concerns"+(isUuid(orgId)?"?org="+encodeURIComponent(orgId):"")}>反馈过程有隐私疑虑？查看申诉入口</Link></div></div>
  </main></Shell>;
}
