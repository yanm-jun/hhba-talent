import {useEffect,useState} from 'react';
import {CheckCircle2,FileCheck2,LockKeyhole,ShieldCheck} from 'lucide-react';
import {Link} from '../router';
import {api,ApiError,employerApiReady,type CandidateJobPreview,type User} from '../services/api';
import '../styles/employer-applications.css';
function err(e:unknown){
 if(e instanceof ApiError){if(e.status===409)return '资料状态发生变化或已申请该岗位，请刷新再试。';if(e.status===404)return '岗位已下架或招聘授权失效，无法继续申请。';return e.message}
 return '申请暂时不可用，请稍后再试。';
}
export function EmployerJobApplicationForm({id,user}:{id:string;user:User|null}){
 const [preview,setPreview]=useState<CandidateJobPreview|null>(null);
 const [loading,setLoading]=useState(false);
 const [consent,setConsent]=useState(false);
 const [note,setNote]=useState('');
 const [notice,setNotice]=useState('');
 const [success,setSuccess]=useState(false);
 useEffect(()=>{setPreview(null);setConsent(false);setSuccess(false);setNotice('')},[id]);
 async function getPreview(){
  setLoading(true);setNotice('');
  try{const data=await api.applicationPreview(id);setPreview(data)}
  catch(e){setNotice(err(e))}finally{setLoading(false)}
 }
 async function submit(){
  if(!preview?.eligible||!consent||!employerApiReady)return;
  setLoading(true);setNotice('');
  try{
   await api.applyEmployerJob(id,true,note);
   setSuccess(true);setConsent(false);
   setNotice('申请已提交，仅向该企业分享你确认的本次资料。企业可以更新处理进度，你也可以随时撤回申请。');
  }catch(e){setNotice(err(e))}finally{setLoading(false)}
 }
 return <section className="hhba-apply-panel">
  <div className="hhba-apply-heading"><FileCheck2 size={20}/><div><h2>通过 HHBA 申请这份岗位</h2>
   <p>你决定分享哪些经过核对的信息。不会提交原始简历、手机号或邮箱，也不会自动加入企业人才搜索。</p></div></div>
  {!employerApiReady?<div className="hhba-apply-offline"><LockKeyhole size={17}/> 目前为前端预览，企业招聘与用户账户服务尚未上线，站内申请暂时不可用。仍可以查看该岗位提供的企业官网投递链接。</div>:
   !user?<p className="hhba-apply-note">请先 <Link to="/candidate/login">登录求职者账户</Link>，确认你的个人能力档案后再申请。</p>:
   success?<div className="hhba-apply-success"><CheckCircle2 size={18}/>{notice} <Link to="/candidate/my-applications">查看申请进度 →</Link></div>:
   <div className="hhba-apply-form">
    {!preview&&<button type="button" disabled={loading} className="hhba-apply-primary" onClick={()=>void getPreview()}>
     {loading?'正在检查岗位与个人档案…':'先预览我将分享的资料'}</button>}
    {preview&&!preview.eligible&&<div className="hhba-apply-note">
     {preview.reason==='ALREADY_APPLIED'?<>你已经申请过该岗位，请前往 <Link to="/candidate/my-applications">我的申请</Link> 查看进度。</>:
      <>需要先完成并确认个人能力档案。<Link to="/candidate/profile">查看我的能力档案 →</Link></>}
    </div>}
    {preview?.eligible&&preview.shared_fields&&<>
     <div className="hhba-apply-share">
      <h3>以下资料将发送给这家企业，请逐项核对</h3>
      <p><b>姓名展示：</b>{preview.shared_fields.display_name||'不披露'}</p>
      <p><b>职业方向：</b>{preview.shared_fields.headline||'不披露'}</p>
      <p><b>技能：</b>{preview.shared_fields.skills.length?preview.shared_fields.skills.join('、'):'不披露'}</p>
      <p><b>地区：</b>{preview.shared_fields.location||'不披露'}</p>
      <p><b>工作经验：</b>{preview.shared_fields.work_years===null?'不披露':preview.shared_fields.work_years+' 年'}</p>
      <small>此处不包含原始 PDF/DOCX、完整履历、身份证、电话号码、邮箱或简历解析证据。</small>
     </div>
     <label className="hhba-apply-label">申请说明（可选，最多 500 字；请不要填写联系方式或精确住址）
      <textarea value={note} maxLength={500} rows={4} onChange={e=>setNote(e.target.value)} placeholder="可以介绍与该岗位直接相关的经历、项目或应聘动机。"/>
     </label>
     <label className="hhba-apply-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
      <span>我已确认以上内容，自愿仅针对「{preview.posting.company} · {preview.posting.title}」向招聘企业分享该次有限档案和申请说明。我知道可以在“我的申请”中撤回，撤回后企业无法继续在 HHBA 查看本次资料。</span></label>
     <button type="button" className="hhba-apply-primary" disabled={!consent||loading} onClick={()=>void submit()}>{loading?'正在提交…':'确认授权并提交申请'}</button>
    </>}
    {notice&&<p className="hhba-apply-error" role="status">{notice}</p>}
   </div>}
  <p className="hhba-apply-footer"><ShieldCheck size={14}/> 每次申请单独授权，不等于同意任何企业搜索或公开个人资料；不自动向外部 ATS 投递。</p>
 </section>;
}
