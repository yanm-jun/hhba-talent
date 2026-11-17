// HHBA single-admin AI bookkeeper. Untrusted model output is always plain text.
(()=>{
 const root=document.getElementById('hhba-fin-ai-root');if(!root)return;
 const $=id=>root.querySelector('#'+id);
 const endpoint='/admin-preview/api/finance-ai';
 const yuan=fen=>Number.isSafeInteger(fen)?new Intl.NumberFormat('zh-CN',{
  style:'currency',currency:'CNY'
 }).format(fen/100):'—';
 const curMonth=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',
  year:'numeric',month:'2-digit'}).format(new Date());
 const labels={aiCostFen:'AI 模型费用',infrastructureFen:'服务器、域名及基础设施',
  operationsFen:'邮件及运营费用'};
 let activeMonth=curMonth(),last=null,busy=false;
 const note=s=>$('hhba-fin-ai-status').textContent=s;
 const text=(id,v)=>$(id).textContent=String(v);
 const setBusy=b=>{busy=b;$('hhba-fin-ai-run').disabled=b;$('hhba-fin-ai-load').disabled=b};
 function clear(){
  last=null;
  for(const id of ['hhba-ai-income','hhba-ai-expense','hhba-ai-count'])text(id,'—');
  text('hhba-ai-readiness','未整理');
  text('hhba-ai-alert-count','');
  text('hhba-ai-alerts','尚无该月的真实凭证审查记录。');
  text('hhba-ai-fields','当前没有可确认的费用建议。');
  text('hhba-fin-ai-model','模型尚未产生审阅意见。');
  $('hhba-fin-ai-apply').disabled=true;
 }
 function render(report,meta={}){
  if(!report||report.kind!=='HHBA_FINANCE_ASSISTANT_V1'||
   report.period!==activeMonth||report.canPublish!==false||
   report.canAutoSaveDraft!==false||!Array.isArray(report.alerts)){
   clear();note('审查结果格式不合法，已拒绝展示任何推算金额。');return;
  }
  last=report;
  text('hhba-ai-income',yuan(report.recorded?.incomeFen));
  text('hhba-ai-expense',yuan(report.recorded?.expensesFen));
  text('hhba-ai-count',Number.isSafeInteger(report.recorded?.entryCount)?report.recorded.entryCount:'—');
  text('hhba-ai-readiness','待你核对');
  text('hhba-ai-alert-count',' · '+report.alerts.length+' 项');
  const alerts=$('hhba-ai-alerts');alerts.replaceChildren();
  for(const a of report.alerts){
   const item=document.createElement('div');item.className='hhba-fin-ai-alert'+(a.level==='block'?' is-block':'');
   const title=document.createElement('strong');title.textContent=a.level==='block'?'需要补证 / 对账':'建议检查';
   const p=document.createElement('p');p.textContent=String(a.message||'待复核');
   item.append(title,p);alerts.append(item);
  }
  const fields=$('hhba-ai-fields');fields.replaceChildren();
  const found=Object.keys(labels).filter(key=>Number.isSafeInteger(report.suggestedExpenseFields?.[key])&&report.suggestedExpenseFields[key]>0);
  if(!found.length)fields.textContent='无可安全归类的支出；没有凭证不能补填零。';
  for(const key of found){
   const div=document.createElement('div');div.className='hhba-fin-ai-field-row';
   const a=document.createElement('span');a.textContent=labels[key];
   const b=document.createElement('strong');b.textContent=yuan(report.suggestedExpenseFields[key]);
   div.append(a,b);fields.append(div);
  }
  $('hhba-fin-ai-apply').disabled=!found.length;
  const model=report.model||{state:'not_bound'};
  const map={
   completed:'以下只是 AI 提出的补证和对账建议，不能作为会计或法律结论：',
   disabled:'模型未开启，确定性规则已完成数据整理和异常检测。',
   not_bound:'模型尚未连接，规则检查已经完成，不代表发生过 AI 推理。',
   no_source:'没有原始凭证，模型不会编造财务报告。',
   temporarily_unavailable:'模型调用失败，已保留确定性规则的核查结果。',
   invalid_response:'模型输出无效，已丢弃其建议。'
  };
  text('hhba-fin-ai-model',model.state==='completed'&&model.text?
   map.completed+'\n'+model.text:(map[model.state]||'模型暂未提供可用建议'));
  text('hhba-fin-ai-source',report.basis||'仅来源于登记凭证，仍未完成独立对账');
  text('hhba-fin-ai-last','最近整理：'+new Date(report.generatedAt).toLocaleString('zh-CN')+
   ' · '+(report.trigger==='automatic_daily'?'每日自动任务':'管理员主动整理')+
   (report.cached?' · 已复用同版凭证':'')+
   ' · 每日任务 '+(meta.dailyAutomationEnabled?'已配置':'未开启'));
  note('已取得 '+activeMonth+' 的真实登记凭证分析：仍需对账后才能确认实际收支、税额与可分配利润。');
 }
 async function read(run=false){
  if(busy)return;
  activeMonth=$('hhba-fin-ai-month').value;
  if(!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(activeMonth)||activeMonth>curMonth()){
   note('月份无效或属于未来，不能执行。');return;
  }
  setBusy(true);
  note(run?'正在整理登记凭证并分析异常……':'正在读取已保存的自动整理结果……');
  try{
   const res=await fetch(endpoint+(run?'':'?month='+encodeURIComponent(activeMonth)),{
    method:run?'POST':'GET',cache:'no-store',credentials:'same-origin',
    headers:run?{'Content-Type':'application/json','X-HHBA-FINANCE-REQUEST':'1'}:{Accept:'application/json'},
    body:run?JSON.stringify({month:activeMonth}):undefined
   });
   const data=await res.json().catch(()=>null);
   if(!res.ok||data?.ok!==true)throw Error(data?.code||'HTTP_'+res.status);
   if(!run&&!data.found){clear();note('该月还没有自动整理快照。每日任务会在凭证更新后重新整理，也可点击「立即整理」。');return;}
   render(data.report,{dailyAutomationEnabled:data.dailyAutomationEnabled});
  }catch(e){clear();note('审查读取失败：'+String(e.message||e)+'。未显示任何编造金额。')}
  finally{setBusy(false);}
 }
 $('hhba-fin-ai-month').value=activeMonth;
 $('hhba-fin-ai-month').addEventListener('change',()=>{clear();void read()});
 $('hhba-fin-ai-load').addEventListener('click',()=>void read());
 $('hhba-fin-ai-run').addEventListener('click',()=>{
  if(window.confirm('仅分析已登记的凭证。模型只收到脱敏聚合信息，不发送姓名、原始票据或付款信息；不会自动记账或发布。继续？'))void read(true);
 });
 $('hhba-fin-ai-apply').addEventListener('click',()=>{
  if(!last||last.period!==activeMonth)return;
  const editor=document.getElementById('hhba-fin-report-root');
  if(editor?.querySelector('#freport-period')?.value!==activeMonth){
   note('请先选择与本次分析相同的月报月份。');return;
  }
  if(!window.confirm('只将待核对的费用建议填入月报空白字段，不覆盖、不保存、不公开。继续？'))return;
  let count=0;
  for(const key of Object.keys(labels)){
   const v=last.suggestedExpenseFields?.[key];
   const input=editor?.querySelector('[data-fin-key="'+key+'"]');
   if(input&&!String(input.value||'').trim()&&Number.isSafeInteger(v)&&v>0){
    input.value=(v/100).toFixed(2);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    count++;
   }
  }
  note('已填入 '+count+' 项费用参考（尚未保存）。必须核对原始凭证、完整退款/税费/收入和法定利润，再由你审核发布。');
 });
 // A cached KV read on login is cheap; paid AI inference never runs on page load.
 void read();
})();
