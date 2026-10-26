import type {RecruitmentResponsibility} from '../services/api';
import '../styles/recruitment-responsibility.css';
const outcomes:Record<string,string>={continued:'继续推进',declined:'本次暂不匹配',cancelled:'招聘已取消'};
export function RecruitmentDue({record}:{record:RecruitmentResponsibility|undefined}){
 if(!record)return <div className="hhba-sla-unavailable">该申请尚无经过服务器核实的招聘责任记录，不能确认企业是否已处理或逾期。</div>;
 const timestamp=Date.parse(record.response_due_at);
 const deadline=Number.isFinite(timestamp)?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric'}).format(timestamp):'期限数据不可用';
 const done=record.state==='responded',late=record.state==='overdue',withdrawn=record.state==='withdrawn';
 return <div className={'hhba-sla '+(late?'hhba-sla-late':'')} aria-label="招聘责任处理记录">
  <div className="hhba-sla-top"><strong>{late?'回应期限已过':done?'初步处理已完成':withdrawn?'申请已撤回':record.state==='paused'?'招聘已暂停':'等待企业完成初步处理'}</strong>
   <span>{done&&record.response_kind?outcomes[record.response_kind]:late?'待核查':withdrawn?'已结束':'处理中'}</span></div>
  <p>{done?'企业已记录处理结果，不代表已完成录用。':late?'该记录超时，需要核查企业处理情况及系统通知情况。':withdrawn?'该次申请不再计算新的回应期限。':'企业必须给出实际处理结果；仅标记审阅中不算完成回应责任。'}</p>
  {!withdrawn&&<small>初步处理期限：{deadline}（服务端工作日规则）</small>}
 </div>;
}
