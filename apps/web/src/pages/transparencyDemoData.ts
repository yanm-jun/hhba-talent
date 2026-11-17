import {aidArchiveProfiles,type DemoCaseProfile} from './aidArchiveProfiles';
/** Product demonstration only; must NEVER be imported into finance D1 or real published-case APIs. */
export const WORKER_ARCHIVE_DEMO_MODE=import.meta.env.VITE_HHBA_PUBLIC_ARCHIVE_MODE!=='official';
export const WORKER_ARCHIVE_DEMO_NOTICE='此页面展示的数据为虚构演示数据。';
export type WorkerDemoCase=DemoCaseProfile&{id:string;title:string;date:string;status:'已完成'|'处理中';expense:number};
export type WorkerDemoEntry={id:string;date:string;name:string;amount:number;caseId?:string};
const expenseSamples=[1200,800,930,600,540,450,430,400,380,360,350,330,320,300,280,260,250,240,230];
const caseTitles=[
 "离职后工资未结清",
 "未签订书面劳动合同",
 "节假日加班工资争议",
 "试用期工资差额",
 "绩效工资扣减争议",
 "离职工资结算延期",
 "解除劳动合同补偿争议",
 "劳动关系证明不足",
 "工时记录不完整",
 "年休假待遇争议",
 "报酬支付周期争议",
 "加班审批与工资核算",
 "外包岗位劳动关系咨询",
 "企业扣款规则争议",
 "调岗降薪协商问题",
 "社会保险缴纳咨询",
 "离职交接与结算争议",
 "口头工资约定差额",
 "劳动合同到期续签",
 "工伤相关材料准备",
 "销售提成核算争议",
 "试用期解除争议",
 "社保缴费基数咨询",
 "排班与休息日争议",
 "竞业限制条款咨询",
 "劳动合同变更争议",
 "项目奖金发放争议",
 "劳动仲裁证据整理"
];

if(aidArchiveProfiles.length!==28||caseTitles.length!==28)throw new Error('Expected 28 case scenarios');
export const workerDemoCases:WorkerDemoCase[]=aidArchiveProfiles.map((profile,index)=>({
 ...profile,id:'HHBA-DEMO-'+String(index+1).padStart(3,'0'),
 title:caseTitles[index],date:new Date(Date.UTC(2026,10,3-index*2)).toISOString().slice(0,10),
 status:index<19?'已完成':'处理中',expense:expenseSamples[index]||0
}));
const datePlus=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export const workerDemoLedger:WorkerDemoEntry[]=[
 {id:'HHBA-DEMO-IN-001',date:'2026-09-01',name:'权益帮扶专项资金入池',amount:100000},
 {id:'HHBA-DEMO-IN-002',date:'2026-10-01',name:'权益帮扶专项资金追加',amount:20000},
 ...workerDemoCases.filter(r=>r.expense>0).map(r=>({
  id:'HHBA-DEMO-OUT-'+r.id.slice(-3),date:datePlus(r.date,8),
  name:r.title+' · 权益支持事项',amount:-r.expense,caseId:r.id
 }))
].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
const spent=workerDemoCases.reduce((sum,x)=>sum+x.expense,0);
export const workerDemoTotals={received:120000,spent,balance:120000-spent,
 cases:workerDemoCases.length,completed:workerDemoCases.filter(x=>x.status==='已完成').length,inProgress:workerDemoCases.filter(x=>x.status==='处理中').length};
export const workerDemoMonths=(()=>{
 let balance=0;const map=new Map<string,{period:string;opening:number;received:number;spent:number;closing:number}>();
 for(const item of workerDemoLedger){const period=item.date.slice(0,7);
  if(!map.has(period))map.set(period,{period,opening:balance,received:0,spent:0,closing:balance});
  const entry=map.get(period)!;if(item.amount>=0)entry.received+=item.amount;else entry.spent+=Math.abs(item.amount);
  balance+=item.amount;entry.closing=balance;
 }return [...map.values()].reverse();
})();
export const workerDemoCurrency=(n:number)=>'¥'+n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});