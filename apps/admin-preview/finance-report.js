// HHBA's ONE finance management workspace: existing expense register + verified disclosure.
// Browser never calls the public finance-admin Access application or bypasses password auth.
(()=> {
 const root=document.getElementById('hhba-fin-report-root');if(!root)return;
 const path='/admin-preview/api/financial/';
 const by=id=>root.querySelector('#'+id);
 const fields=[
  ['营业收入','revenueFen'],['退款及冲减','refundFen'],['AI 模型费用','aiCostFen'],
  ['服务器与存储','infrastructureFen'],['人员成本','personnelFen'],['经营管理费用','operationsFen'],
  ['相关税费','taxesFen'],['其他成本','otherCostFen'],['账务调整（可负）','adjustmentsFen'],
  ['依法确认的可分配利润','distributableProfitFen'],['帮扶池期初余额','openingPoolFen'],
  ['实际入池金额','poolReceivedFen'],['实际帮扶支出','poolSpentFen'],['帮扶池期末余额','closingPoolFen']
 ];
 const noteFields=[
  ['basisNote','可分配利润计算依据及法定程序'],
  ['methodNote','实际收入、费用、调整项目的计量口径'],
  ['poolNote','帮扶池实际划拨、帮扶事项和余额说明'],
  ['privacyReviewNote','隐私与商业秘密审阅结论']
 ];
 const amountKeys=fields.map(x=>x[1]);
 const lastClosedMonth=()=>{
  const d=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date());
  const [y,m]=d.split('-').map(Number);
  return m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0');
 };
 const currency=v=>Number.isSafeInteger(v)?new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(v/100):'—';
 const fen=(value,allowNegative=false)=>{
  const raw=String(value||'').trim();
  if(!new RegExp(allowNegative?'^-?\\d{1,10}(?:\\.\\d{1,2})?$':'^\\d{1,10}(?:\\.\\d{1,2})?$').test(raw))return null;
  const n=Number(raw);
  return Number.isSafeInteger(Math.round(n*100))&&Math.abs(n*100-Math.round(n*100))<0.00001?Math.round(n*100):null;
 };
 const intoYuan=v=>Number.isSafeInteger(v)?(v/100).toFixed(2):'';
 const defaultPeriod=lastClosedMonth();
 const valAttr=' inputmode="decimal" placeholder="0.00" autocomplete="off"';
 root.innerHTML=`
  <div class="hhba-freport-heading">
   <div><p class="eyebrow">FINANCIAL DISCLOSURE · SINGLE MANAGEMENT CONSOLE</p>
    <h2>月报审核与劳动者帮扶池</h2>
    <p>与上方「真实收支登记簿」共处同一个后台；月报使用独立财务 D1，必须核对凭证并人工发布。</p>
   </div>
   <button type="button" class="button-outline" id="freport-reload">读取月报与订阅状态</button>
  </div>
  <p class="hhba-freport-alert" id="freport-message" role="status">尚未读取财务月报；未经发布的数据不显示为零元。</p>
  <div class="hhba-freport-kpis" id="freport-kpis" aria-label="最新一期已公开财务报告"></div>
  <p class="hhba-freport-status" id="freport-deliveries">邮件订阅与发送状态尚未读取。</p>
  <div class="hhba-freport-layout">
   <aside class="hhba-freport-history">
    <div class="hhba-freport-history-head"><h3>月度报告</h3><button class="button-outline" type="button" id="freport-new">新建</button></div>
    <div id="freport-history">手动读取后显示记录；空白不代表经营金额为零。</div>
   </aside>
   <section class="hhba-freport-editor" aria-label="月报录入和审核">
    <h3>月报草稿与审核</h3>
    <label>报告月份（YYYY-MM）<input id="freport-period" type="month" value="${defaultPeriod}" required></label>
    <div class="hhba-freport-source">
     <p><strong>已有成本无需重复登记。</strong>先在本页上方「财务成本」读取相同月份的凭证登记簿，再按需带入未填写的费用参考。来源金额未经对账确认，不会自动保存、审核或公开。</p>
     <button class="button-outline" type="button" id="freport-prefill-expenses">从已读取的登记簿带入费用参考</button>
    </div>
    <p>全部金额以人民币元填写，系统转换为整数分。未发生的真实项目可填写 0，但不能用模拟金额代替凭证。</p>
    <div class="hhba-freport-fields">
     ${fields.map(([label,key])=>`<label>${label}<input data-fin-key="${key}"${valAttr}></label>`).join('')}
    </div>
    <div class="hhba-freport-calculated">
     <div><span>根据各项收支计算的月度经营结果</span><strong id="freport-net">—</strong></div>
     <div><span>按可分配利润的 40% 计提（并非实际到账）</span><strong id="freport-pool">—</strong></div>
    </div>
    <label>本月实际帮扶事项数<input id="freport-beneficiaries" type="number" min="0" step="1" placeholder="按事实填写"></label>
    ${noteFields.map(([key,label])=>`<label>${label}<textarea data-fin-note="${key}" rows="3" minlength="12" maxlength="3000" placeholder="请说明真实凭证与核对依据"></textarea></label>`).join('')}
    <label>已发布报告的更正理由（至少20字，首次发布不用填写）
     <textarea id="freport-correction" rows="2" maxlength="1000" placeholder="更正已发布报告必须留下可审计理由"></textarea>
    </label>
    <div class="hhba-freport-actions"><button type="button" class="button-primary" id="freport-save">保存草稿</button></div>
    <div class="hhba-freport-review">
     <h3>人工审核（不等于独立审计）</h3>
     ${[
       ['ledgerReconciled','已与原始账单和凭证逐项核对'],
       ['privacyReviewed','已检查不泄露个人信息与商业秘密'],
       ['legalDistributionBasisChecked','已核实合法可分配利润计算依据'],
       ['noFabricationAttested','确认无模拟、估计或编造账目']
      ].map(([key,label])=>`<label class="hhba-freport-check"><input data-fin-check="${key}" type="checkbox">${label}</label>`).join('')}
     <label>审核依据与结论（至少30字）<textarea id="freport-review-note" rows="3" maxlength="1500"></textarea></label>
     <div class="hhba-freport-actions">
      <button type="button" class="button-outline" id="freport-review">确认审核（不公开）</button>
      <button type="button" class="button-primary" id="freport-publish">确认正式公开</button>
     </div>
    </div>
    <p class="hhba-freport-caution">审阅后并不会自动公开。发布前必须再次确认数据真实性；已发布报告修改将生成不可覆盖的新版本。未经独立审计的报告不能标注为已审计。</p>
   </section>
  </div>`;
 let state=null,current=null,busy=false;
 const tell=(message)=>{by('freport-message').textContent=message;};
 const api=async(operation,body)=>{
  const response=await fetch(path+operation,{method:body?'POST':'GET',cache:'no-store',
   credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{'Accept':'application/json'},
   body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true)throw Error(result?.code||'HTTP_'+response.status);
  return result;
 };
 function recalc(){
  const nums=Object.fromEntries(amountKeys.map(key=>[key,fen(root.querySelector('[data-fin-key="'+key+'"]').value,key==='adjustmentsFen')]));
  const need=['revenueFen','refundFen','aiCostFen','infrastructureFen','personnelFen','operationsFen','taxesFen','otherCostFen','adjustmentsFen'];
  const net=need.every(k=>nums[k]!==null)?nums.revenueFen-nums.refundFen-nums.aiCostFen-nums.infrastructureFen-
    nums.personnelFen-nums.operationsFen-nums.taxesFen-nums.otherCostFen+nums.adjustmentsFen:null;
  const pool=nums.distributableProfitFen!==null?Math.floor(nums.distributableProfitFen*.4):null;
  by('freport-net').textContent=currency(net);
  by('freport-pool').textContent=currency(pool);
  return {nums,net};
 }
 function prefillExpenses(){
  const month=by('freport-period').value;
  if(!/^20\\d{2}-(?:0[1-9]|1[0-2])$/.test(month)||month>lastClosedMonth()){
   tell('请选择已结束、需要核对的正确月份。');return;
  }
  if(current&&current.period===month&&current.status!=='draft'){
   tell('审核或公开中的月报不能直接带入费用；请先按合法修订流程处理。');return;
  }
  const source=window.hhbaFinance?.getLoadedRegister?.(month);
  if(!source||source.month!==month||source.quality!=='owner_entered_unreconciled'||
   !Array.isArray(source.entries)||source.entries.length>50){
   tell('请先在上方「财务成本」点击读取相同月份的真实凭证登记簿。空账簿不能当作零费用。');return;
  }
  const categories={deepseek:'aiCostFen',cloudflare:'infrastructureFen',
   domain:'infrastructureFen',infrastructure:'infrastructureFen',
   email:'operationsFen',operations:'operationsFen'};
  const suggested={};
  for(const entry of source.entries){
   if(entry.voided||entry.direction!=='expense')continue;
   const field=Object.hasOwn(categories,entry.category)?categories[entry.category]:null;
   if(!field)continue; // other / income / taxes are not deterministically categorized.
   if(!Number.isSafeInteger(entry.amountFen)||entry.amountFen<=0||
    entry.amountFen>1_000_000_000){tell('登记金额格式不合法，已停止带入。');return;}
   suggested[field]=(suggested[field]||0)+entry.amountFen;
   if(!Number.isSafeInteger(suggested[field])){tell('登记金额溢出，已停止带入。');return;}
  }
  const blank=Object.entries(suggested).filter(([key])=>{
   const node=root.querySelector('[data-fin-key="'+key+'"]');
   return node&&!String(node.value||'').trim();
  });
  if(!blank.length){tell('没有可带入的空白费用科目；已有金额不会覆盖，其他类别需要人工核对。');return;}
  if(!window.confirm('只将相同月份已登记、未冲销的费用参考填入空白字段。不会自动保存、审核或公开；仍须核对原始凭证。继续？'))return;
  for(const [key,value] of blank){
   root.querySelector('[data-fin-key="'+key+'"]').value=intoYuan(value);
  }
  recalc();
  tell('已带入 '+blank.length+' 项待核对费用参考（尚未保存）。请核对银行及供应商凭证、会计期间、其他费用、税款、退款及利润后再保存月报草稿。');
 }
 function payload(){
  const period=by('freport-period').value;
  if(!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(period))throw Error('请输入有效的 YYYY-MM 月份');
  if(period>lastClosedMonth())throw Error('当月或未来月份尚未结账');
  const {nums,net}=recalc();
  if(Object.values(nums).some(x=>x===null)||net===null)throw Error('请逐项填写凭证核实后的金额，含未发生项目的 0');
  const beneficiaries=Number(by('freport-beneficiaries').value);
  if(!Number.isSafeInteger(beneficiaries)||beneficiaries<0||by('freport-beneficiaries').value.trim()==='')throw Error('请填写真实帮扶事项数量');
  const notes={};
  for(const [key,label] of noteFields){
   const raw=root.querySelector('[data-fin-note="'+key+'"]').value.trim();
   if(raw.length<12||raw.length>3000)throw Error(label+'需要至少12字的说明');
   notes[key]=raw;
  }
  if(nums.openingPoolFen+nums.poolReceivedFen-nums.poolSpentFen!==nums.closingPoolFen)
   throw Error('帮扶池期末余额必须等于期初＋实际入池－实际支出');
  if(nums.poolSpentFen>nums.openingPoolFen+nums.poolReceivedFen)
   throw Error('实际帮扶支出不能超过可用池余额');
  return {period,...nums,netResultFen:net,beneficiaries,...notes,isAudited:false};
 }
 function hydrate(row){
  current=row||null;
  if(row?.period)by('freport-period').value=row.period;
  const obj=row?.draft||null;
  for(const key of amountKeys)root.querySelector('[data-fin-key="'+key+'"]').value=intoYuan(obj?.[key]);
  by('freport-beneficiaries').value=obj?.beneficiaries===undefined?'':String(obj.beneficiaries);
  for(const [key] of noteFields)root.querySelector('[data-fin-note="'+key+'"]').value=obj?.[key]||'';
  by('freport-correction').value=row?.correctionReason||'';
  by('freport-review-note').value=row?.reviewNote||'';
  root.querySelectorAll('[data-fin-check]').forEach(x=>{x.checked=false;});
  by('freport-save').textContent=row?.status==='published'?'保存更正草稿':'保存草稿';
  recalc();
  tell(row?'已载入 '+row.period+' · '+(row.status==='published'?'已公开':row.status==='reviewed'?'已审核':'草稿')+' · V'+row.revision:'新建空白月报：请填写真实账目。');
 }
 function kpi(data){
  const published=data.reports.find(row=>row.status==='published'&&row.published)?.published||null;
  const keyValues=[
   ['营业收入','revenueFen'],['经营结果','netResultFen'],
   ['可分配利润','distributableProfitFen'],['40%帮扶池计提','poolAccrualFen'],
   ['实际入池','poolReceivedFen'],['帮扶池期末余额','closingPoolFen']
  ];
  const cards=by('freport-kpis');cards.replaceChildren();
  for(const [label,key] of keyValues){
   const div=document.createElement('div'),a=document.createElement('span'),b=document.createElement('strong');
   a.textContent=label;b.textContent=published?currency(published[key]):'—';div.append(a,b);cards.append(div);
  }
  const d=data.deliveries||{},sub=data.subscribers||{};
  by('freport-deliveries').textContent=
   '报表：'+data.reports.filter(x=>x.status==='draft').length+' 份草稿、'+
   data.reports.filter(x=>x.status==='reviewed').length+' 份待公开；'+
   '订阅：'+(sub.verified||0)+' 已验证，'+(sub.pending||0)+' 待确认；'+
   '月报邮件：'+(d.sent||0)+' 已发送、'+(d.failed||0)+' 失败、'+(d.pending||0)+' 待发送。'+
   ' 当前公众订阅 '+(data.subscriptionsEnabled?'开启':'关闭')+'，批量发信 '+(data.sendEnabled?'开启':'关闭')+'。';
 }
 function showList(reports){
  const list=by('freport-history');list.replaceChildren();
  if(!reports.length){list.textContent='尚无已录入的财务月报，不代表实际经营金额为零。';return;}
  for(const row of reports){
   const btn=document.createElement('button');btn.type='button';btn.className='button-outline hhba-freport-month';
   btn.textContent=row.period+' · '+(row.status==='published'?'已公开':row.status==='reviewed'?'待发布':'草稿')+' · V'+row.revision;
   btn.addEventListener('click',()=>hydrate(row));list.append(btn);
  }
 }
 async function refresh(){
  if(busy)return;
  busy=true;by('freport-reload').disabled=true;tell('读取独立财务数据库中…');
  try{
   const d=await api('status');state=d;kpi(d);showList(d.reports||[]);
   if(current){const newer=d.reports.find(r=>r.period===current.period);if(newer)hydrate(newer);}
   tell('已核验财务月报及邮件统计；仅已正式公开快照显示金额。');
  }catch(e){tell('月报读取失败：'+e.message+'；不展示推算金额。');by('freport-kpis').replaceChildren();}
  finally{busy=false;by('freport-reload').disabled=false;}
 }
 async function act(action){
  if(busy)return;
  const period=by('freport-period').value;
  let data={period};
  try{
   if(action==='draft'||action==='correction'){
    data.report=payload();
    if(action==='correction'){
     const reason=by('freport-correction').value.trim();
     if(reason.length<20||reason.length>1000)throw Error('更正已公开月报须填写20—1000字理由');
     data.correctionReason=reason;
    }
   }
   if(action==='review'){
    for(const key of ['ledgerReconciled','privacyReviewed','legalDistributionBasisChecked','noFabricationAttested']){
     const ok=root.querySelector('[data-fin-check="'+key+'"]').checked;
     if(!ok)throw Error('必须完成全部真实凭证、隐私、法律及非模拟数据审核');
     data[key]=true;
    }
    const note=by('freport-review-note').value.trim();
    if(note.length<30||note.length>1500)throw Error('审核依据需要30—1500字');data.reviewNote=note;
   }
   if(action==='publish'){
    if(!window.confirm('确认公开 '+period+' 的真实财务月报？操作会生成公开版本及不可改写历史，且不能作为外部审计证明。'))return;
    data.confirmPublish=true;
   }
  }catch(e){tell('检查未通过：'+e.message);return;}
  busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   await api(action,data);
   current={period};
   tell(action==='publish'?'已提交公开请求；可到公众透明中心核验。':action==='review'?'已审核但尚未公开。':'草稿已保存，尚未公开。');
  }catch(e){tell('操作未完成：'+e.message+'。请先重新读取，避免重复提交。');}
  finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}
  await refresh();
 }
 by('freport-prefill-expenses').addEventListener('click',prefillExpenses);
 by('freport-reload').addEventListener('click',()=>void refresh());
 by('freport-new').addEventListener('click',()=>{hydrate(null);by('freport-period').value=lastClosedMonth();});
 by('freport-save').addEventListener('click',()=>void act(current?.status==='published'?'correction':'draft'));
 by('freport-review').addEventListener('click',()=>void act('review'));
 by('freport-publish').addEventListener('click',()=>void act('publish'));
 root.querySelectorAll('[data-fin-key]').forEach(x=>x.addEventListener('input',recalc));
 hydrate(null);by('freport-period').value=defaultPeriod;
})();
