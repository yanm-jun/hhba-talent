// HHBA private finance register UI. No synthetic finance entries, rates or profit.
(() => {
 const byId=id=>document.getElementById(id);
 const todayCN=()=>new Intl.DateTimeFormat('sv-SE',{
  timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'
 }).format(new Date());
 const moneyFen=v=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(v/100);
 const monthInput=byId('finance-month'),dayInput=byId('finance-day');
 const categories={cloudflare:'Cloudflare',deepseek:'DeepSeek / AI',domain:'域名',
  email:'邮件服务',infrastructure:'服务器与存储',operations:'日常运营',
  customer:'客户收入',other:'其他'};
 let data=null,loading=false;
 function reset(message='尚未手动读取该月份的账簿；未查询不等于零。'){
  data=null;
  for(const id of ['finance-income','finance-expense','finance-net'])byId(id).textContent='—';
  byId('finance-export').disabled=true;
  const tbody=byId('finance-rows');tbody.replaceChildren();
  const tr=document.createElement('tr'),td=document.createElement('td');
  td.colSpan=7;td.textContent=message;tr.append(td);tbody.append(tr);
  byId('finance-read-quality').textContent='尚未查询完整的本月登记明细；只有后台真实记录才计入金额。';
 }
 const showAlert=msg=>{byId('finance-alert').textContent=msg};
 const createCell=(tr,value)=>{
  const el=document.createElement('td');el.textContent=String(value??'—');tr.append(el);return el;
 };
 function renderRegister(result){
  data=result;
  const totals=result.totals;
  byId('finance-income').textContent=totals?moneyFen(totals.incomeFen):'—';
  byId('finance-expense').textContent=totals?moneyFen(totals.expenseFen):'—';
  byId('finance-net').textContent=totals?moneyFen(totals.netFen):'—';
  const tbody=byId('finance-rows');tbody.replaceChildren();
  if(!result.entries.length){
   const tr=document.createElement('tr');const td=createCell(tr,'该月尚无人工登记凭证，不等于业务收入或支出为零。');
   td.colSpan=7;tbody.append(tr);
  }
  for(const e of result.entries){
   const tr=document.createElement('tr');
   createCell(tr,e.day);
   createCell(tr,e.direction==='income'?'收入':'支出');
   createCell(tr,categories[e.category]||'未知');
   createCell(tr,moneyFen(e.amountFen));
   createCell(tr,e.evidenceRef);
   createCell(tr,e.voided?'已冲销（保留原始记录）':'手工登记 · 待核账');
   const action=document.createElement('td');
   if(!e.voided){
    const button=document.createElement('button');button.type='button';
    button.className='button-outline';button.textContent='冲销';
    button.addEventListener('click',()=>{void voidRecord(e.id)});
    action.append(button);
   }else action.textContent='—';
   tr.append(action);tbody.append(tr);
  }
  byId('finance-export').disabled=!result.entries.length;
  byId('finance-read-quality').textContent=
   '来源：人工录入 + 凭证引用（未与银行或供应商账单自动核对）。'+
   '登记事件 '+result.eventsCount+' 条，其中原始条目 '+result.recordedCount+
   ' 条、冲销 '+result.voidedCount+' 条；KV 写入可能短暂延迟显示。';
  showAlert(result.totals
   ?'已读取本月登记簿。这些金额只代表已记录的凭证，不代表全部真实经营收支或税务净利润。'
   :'本月尚无凭证记录。没有收支数据不代表真实收入、成本均为零。');
 }
 const validMonth=v=>/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(v||'');
 const validateResponse=(value,month)=>{
  if(value?.kind!=='HHBA_PRIVATE_FINANCE_REGISTER_V1'||value.month!==month||
   !['no_records_not_zero','owner_entered_unreconciled'].includes(value.quality)||
   !Array.isArray(value.entries)||!Number.isSafeInteger(value.recordedCount)||
   !Number.isSafeInteger(value.eventsCount)||value.eventsCount<value.recordedCount||
   !(value.totals===null||(Number.isSafeInteger(value.totals?.incomeFen)&&
     Number.isSafeInteger(value.totals?.expenseFen)&&
     Number.isSafeInteger(value.totals?.netFen)))||
   (value.quality==='no_records_not_zero'&&value.totals!==null))throw Error('财务记录格式或来源未通过验证');
 };
 async function load(){
  const month=monthInput.value;if(!validMonth(month)){showAlert('请选择正确的月份');return}
  if(loading)return;loading=true;
  const button=byId('finance-load');button.disabled=true;button.textContent='读取中…';
  reset('正在读取受保护的真实登记事件…');
  try{
   const res=await fetch('/admin-preview/api/finance?month='+encodeURIComponent(month),{
    cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
   if(!res.ok)throw Error('HTTP '+res.status);
   const body=await res.json();validateResponse(body,month);
   if(monthInput.value===month)renderRegister(body);
  }catch(e){
   reset('读取失败，不能显示不完整数据。');
   showAlert('财务登记簿暂不可用：'+String(e.message||e)+'。没有显示金额，不代表账户为零。');
  }finally{loading=false;button.disabled=false;button.textContent='重新读取该月'}
 }
 const post=async v=>{
  const res=await fetch('/admin-preview/api/finance',{method:'POST',credentials:'same-origin',
   cache:'no-store',headers:{'Content-Type':'application/json','X-HHBA-FINANCE-REQUEST':'1'},
   body:JSON.stringify(v)});
  const reply=await res.json().catch(()=>null);
  if(!res.ok||!reply?.ok)throw Error(reply?.error||'HTTP '+res.status);
  if(reply.kind!=='HHBA_PRIVATE_FINANCE_REGISTER_V1')throw Error('保存响应无法确认');
  return reply;
 };
 const amountFen=input=>{
  const s=String(input||'').trim();
  if(!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(s))return null;
  const [yuan,fen='']=s.split('.');
  const n=Number(yuan)*100+Number(fen.padEnd(2,'0'));
  return Number.isSafeInteger(n)&&n>=1&&n<=1000000000?n:null;
 };
 async function submit(e){
  e.preventDefault();
  if(loading)return;
  const month=monthInput.value,day=dayInput.value;
  if(!validMonth(month)||!day.startsWith(month+'-')){
   showAlert('发生日期必须属于当前选择月份');return
  }
  const amount=amountFen(byId('finance-amount').value);
  if(amount===null){showAlert('金额仅允许正数，最多保留两位小数');return}
  const evidence=byId('finance-evidence').value.trim();
  if(evidence.length<3){showAlert('请填写真实凭证编号或脱敏账单引用');return}
  loading=true;byId('finance-add').disabled=true;
  try{
   await post({action:'create',month,day,direction:byId('finance-direction').value,
    category:byId('finance-category').value,amountFen:amount,evidenceRef:evidence,
    note:byId('finance-note').value.trim()});
   reset('保存请求已受理；KV 传播可能延迟，请稍后手动重新读取核对。');
   byId('finance-amount').value='';byId('finance-evidence').value='';byId('finance-note').value='';
   showAlert('已追加凭证事件，但尚未再次核对列表。KV 更新可能延迟，请稍后手动读取并对照原始凭证。');
  }catch(err){showAlert('保存未得到成功确认：'+String(err?.message||err)+'。请先检查登记记录，避免重复提交。')}
  finally{loading=false;byId('finance-add').disabled=false}
 }
 async function voidRecord(id){
  if(loading)return;
  if(!data?.entries?.some(e=>e.id===id&&!e.voided))return;
  const reason=window.prompt('请输入冲销原因（至少 4 个字符）。原记录会保留以便审计。');
  if(reason===null)return;
  if(reason.trim().length<4||reason.length>160){showAlert('冲销原因需要 4–160 字符');return}
  loading=true;
  try{
   await post({action:'void',month:monthInput.value,targetId:id,reason:reason.trim()});
   reset('冲销事件已提交；再次读取前不显示过时的财务汇总。');
   showAlert('冲销已追加，原始记录不会删除。KV 传播可能延迟，请稍后重新读取确认。');
  }catch(err){showAlert('冲销未得到成功确认：'+String(err?.message||err)+'；请先重新读取后检查。')}
  finally{loading=false}
 }
 const csvSafe=v=>{
  const s=String(v??'');
  const safe=/^\s*[=+\-@]/.test(s)?"'"+s:s;
  return '"'+safe.replaceAll('"','""')+'"';
 };
 function exportCSV(){
  if(!data?.entries?.length||monthInput.value!==data.month)return;
  const rows=[
   ['HHBA 财务手工登记表','月份',data.month,'来源：管理员登记，未自动对账，KV 最终一致'],
   ['发生日期','方向','类别','金额（CNY）','凭证引用','状态','登记时间'],
   ...data.entries.map(e=>[e.day,e.direction==='income'?'收入':'支出',
    categories[e.category]||e.category,(e.amountFen/100).toFixed(2),e.evidenceRef,
    e.voided?'已冲销':'待核账',e.at])
  ];
  const content='\uFEFF'+rows.map(row=>row.map(csvSafe).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='HHBA-登记簿-'+data.month+'.csv';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const current=todayCN();
 monthInput.value=current.slice(0,7);dayInput.value=current;dayInput.max=current;
 byId('finance-load').addEventListener('click',()=>{void load()});
 monthInput.addEventListener('change',()=>{reset();dayInput.value=validMonth(monthInput.value)?
  monthInput.value===todayCN().slice(0,7)?todayCN():monthInput.value+'-01':''});
 byId('finance-form').addEventListener('submit',e=>{void submit(e)});
 byId('finance-export').addEventListener('click',exportCSV);
 window.hhbaFinance={open(){
  // No automatic KV / D1 reads: operator explicitly chooses a month and clicks Load.
 }};
})();
