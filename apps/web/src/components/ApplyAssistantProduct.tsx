import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BadgeCheck,CheckCircle2,ChevronRight,Clock3,FileCheck2,LockKeyhole,MousePointerClick,PlayCircle,RefreshCcw,ReceiptText,ShieldCheck,Sparkles,Wallet} from 'lucide-react';
import {Link} from '../router';
import {qrcodegen} from '../vendor/qrcodegen';
import {applyAccountAvailable,createApplyOrder,closeApplyOrder,getApplyConfig,queryApplyOrderStatus,getApplyOrders,getApplyTasks,getApplyWallet,listApplyRefundRequests,requestApplyRefund,getApplyPairStatus,startApplyPair,revokeApplyPairs,type ApplyConfig,type ApplyOrder,type ApplyTask,type ApplyWallet,type ApplyRefundRequest,type ApplyPairCode} from '../services/applyCredits';
import '../styles/apply-assistant-product.css';

const fallbackPackages=[{uses:10,amountFen:300},{uses:20,amountFen:600},{uses:50,amountFen:1500},{uses:100,amountFen:3000}];
const money=(fen:number)=>'¥'+(fen/100).toFixed(2);
const stateText:Record<ApplyOrder['status'],string>={pending:'等待支付',paid:'已到账',closed:'已关闭',refunded:'已退款'};
const taskText:Record<ApplyTask['status'],string>={reserved:'处理中（预占1次）',completed:'已使用1次',released:'未扣次'};
const archiveUrl=import.meta.env.BASE_URL+'downloads/hhba-apply-assistant-v0.4.zip';

function AlipayPaymentQR({value}:{value:string}){
 const qr=useMemo(()=>{try{return qrcodegen.QrCode.encodeText(value,qrcodegen.QrCode.Ecc.MEDIUM)}catch{return null}},[value]);
 if(!qr)return <p>二维码内容超过安全长度，请联系支持人员。</p>;
 const quiet=4,edge=qr.size+quiet*2,blocks:string[]=[];
 for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))blocks.push('M'+(x+quiet)+' '+(y+quiet)+'h1v1h-1z');
 return <svg xmlns="http://www.w3.org/2000/svg" width="210" height="210" viewBox={'0 0 '+edge+' '+edge}
  role="img" aria-label="支付宝付款二维码" shapeRendering="crispEdges">
   <rect width={edge} height={edge} fill="#fff"/>
   <path d={blocks.join('')} fill="#173e2b"/>
  </svg>;
}

export function ApplyAssistantProduct({userId}:{userId:string|number|undefined}){
 const [selected,setSelected]=useState(10);
 const [config,setConfig]=useState<ApplyConfig|null>(null);
 const [wallet,setWallet]=useState<ApplyWallet|null>(null);
 const [orders,setOrders]=useState<ApplyOrder[]>([]);
 const [tasks,setTasks]=useState<ApplyTask[]>([]);
 const [refunds,setRefunds]=useState<ApplyRefundRequest[]>([]);
 const [refundOrder,setRefundOrder]=useState<string|null>(null);
 const [refundReason,setRefundReason]=useState('');
 const [pairCode,setPairCode]=useState<ApplyPairCode|null>(null);
 const [pairedDevices,setPairedDevices]=useState<number|null>(null);
 const [pairBusy,setPairBusy]=useState(false);
 const [pairNotice,setPairNotice]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [checkout,setCheckout]=useState<ApplyOrder|null>(null);
 const [activeTab,setActiveTab]=useState<'orders'|'tasks'>('orders');
 const enabled=Boolean(config?.paymentEnabled&&applyAccountAvailable);
 const packages=config?.packages?.length?config.packages:fallbackPackages;
 const choice=packages.find(p=>p.uses===selected)||packages[0];
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const data=await getApplyConfig();
    if(!active)return;
    setConfig(data);
    if(applyAccountAvailable){
     const [nextWallet,nextOrders,nextTasks,nextRefunds]=await Promise.all([getApplyWallet(),getApplyOrders(),getApplyTasks(),listApplyRefundRequests()]);
     if(!active)return;
     setWallet(nextWallet);setOrders(nextOrders);setTasks(nextTasks);setRefunds(nextRefunds);
     if(data.pairingEnabled)try{const status=await getApplyPairStatus();if(active)setPairedDevices(status.connectedDevices)}catch{if(active)setPairNotice('暂时无法查询插件连接状态。')}
    }
   }catch(e){if(active)setNotice(e instanceof Error?e.message:'次数账户暂时不可用。')}
   finally{if(active)setLoading(false)}
  })();
  return()=>{active=false};
 },[userId]);
 async function refresh(){
  if(!applyAccountAvailable)return;
  setBusy(true);setNotice('');
  try{
   const [w,o,t,rs]=await Promise.all([getApplyWallet(),getApplyOrders(),getApplyTasks(),listApplyRefundRequests()]);
   setWallet(w);setOrders(o);setTasks(t);setRefunds(rs);
   if(checkout)setCheckout(await queryApplyOrderStatus(checkout.id));
  }catch(e){setNotice(e instanceof Error?e.message:'暂时无法查询支付状态。')}
  finally{setBusy(false)}
 }
 async function cancelUnpaid(){
  if(!checkout||checkout.status!=='pending'||busy)return;
  setBusy(true);setNotice('');
  try{
   const order=await closeApplyOrder(checkout.id);setCheckout(order);
  }catch(e){setNotice(e instanceof Error?e.message:'关单结果未确认，请查询订单。')}
  finally{setBusy(false)}
 }
 async function submitRefund(orderId:string){
  if(refundReason.trim().length<2||busy)return;
  setBusy(true);setNotice('');
  try{
   await requestApplyRefund(orderId,refundReason);
   setRefundOrder(null);setRefundReason('');
   setNotice('退款审核申请已登记，尚未执行真实退款，也没有改动次数。');
   setRefunds(await listApplyRefundRequests());
  }catch(e){setNotice(e instanceof Error?e.message:'退款申请失败')}
  finally{setBusy(false)}
 }
 async function createConnectionCode(){
  if(!config?.pairingEnabled||!applyAccountAvailable||pairBusy)return;
  setPairBusy(true);setPairNotice('');
  try{
   const result=await startApplyPair();setPairCode(result);
   setPairNotice('请在浏览器插件的「连接账户」中输入一次性连接码。5 分钟内有效，使用一次后失效。');
  }catch(e){setPairNotice(e instanceof Error?e.message:'生成连接码失败')}
  finally{setPairBusy(false)}
 }
 async function disconnectDevices(){
  if(!config?.pairingEnabled||pairBusy)return;
  if(typeof window!=='undefined'&&!window.confirm('确定撤销当前账户所有已连接的网申插件吗？'))return;
  setPairBusy(true);setPairNotice('');
  try{
   await revokeApplyPairs();setPairCode(null);setPairedDevices(0);
   setPairNotice('已撤销全部插件连接，后续需重新生成连接码。');
  }catch(e){setPairNotice(e instanceof Error?e.message:'撤销连接失败')}
  finally{setPairBusy(false)}
 }
 async function buy(){
  if(!choice||!enabled||busy)return;
  setBusy(true);setNotice('');
  try{const order=await createApplyOrder(choice.uses);setCheckout(order);await refresh();}
  catch(e){setNotice(e instanceof Error?e.message:'创建订单失败，没有扣款。')}
  finally{setBusy(false)}
 }
 const showWallet=(n:number|undefined)=>loading?'…':wallet?n:'—';
 return <section className="hhba-apply-product" aria-label="HHBA 一键网申产品介绍">
  <div className="hhba-apply-breadcrumb"><Link to="/candidate/account">个人工作台</Link><ChevronRight size={13}/>一键网申</div>
  <div className="hhba-apply-hero">
   <div className="hhba-apply-hero-copy">
    <span className="hhba-apply-kicker"><Sparkles size={14}/> HHBA AI APPLY ASSISTANT</span>
    <h2>网申，不必再<br/>重复填写。</h2>
    <p>让 AI 理解招聘表单和你的求职资料，帮助完成反复的信息录入。重要信息由你核对，正式申请由你确认。</p>
    <div className="hhba-apply-tags"><span><CheckCircle2 size={14}/>智能识别表单</span><span><CheckCircle2 size={14}/>逐项自动填写</span><span><CheckCircle2 size={14}/>人工最终确认</span></div>
    <a href="#hhba-apply-plans" className="hhba-apply-hero-button">查看次数套餐 <ArrowRight size={16}/></a>
   </div>
   <div className="hhba-apply-video" aria-label="产品演示视频预留位置">
    <div className="hhba-apply-video-icon"><PlayCircle size={45}/></div>
    <strong>真实网申演示视频</strong>
    <span>视频区域已预留 · 稍后上传你的操作演示</span>
    <small>不会播放模拟的自动投递录像</small>
   </div>
  </div>
  <div className="hhba-apply-benefits">
   <article><MousePointerClick size={21}/><strong>少做重复劳动</strong><p>识别常见姓名、学历、专业与工作经历等信息项。</p></article>
   <article><FileCheck2 size={21}/><strong>以真实简历为准</strong><p>不编造学历或经历；未知信息需要你自行确认。</p></article>
   <article><ShieldCheck size={21}/><strong>保护求职资料</strong><p>明确授权后才处理数据，验证码和最终提交保留人工操作。</p></article>
  </div>
  <section className="hhba-apply-wallet" aria-label="我的网申次数">
   <div className="hhba-apply-headline"><div><h3>我的网申次数</h3><p>按当前真实账户统计，不会因为刷新或重复点击而重复扣减。</p></div><button type="button" onClick={()=>void refresh()} disabled={busy||!applyAccountAvailable}><RefreshCcw size={14}/>刷新记录</button></div>
   <div className="hhba-apply-wallet-stats">
    <div><small>累计购买</small><strong>{showWallet(wallet?.purchased)}</strong><span>次</span></div>
    <div><small>已完成使用</small><strong>{showWallet(wallet?.consumed)}</strong><span>次</span></div>
    <div><small>可用次数</small><strong>{showWallet(wallet?.available)}</strong><span>次</span></div>
    <div><small>任务预占</small><strong>{showWallet(wallet?.reserved)}</strong><span>次</span></div>
   </div>
   {!wallet&&<p className="hhba-apply-safety-note"><LockKeyhole size={15}/>次数数据库尚未连接时只显示「—」，不会显示模拟余额。</p>}
  </section>
  <section className="hhba-apply-plans" id="hhba-apply-plans">
   <div className="hhba-apply-headline"><div><h3>按次购买，按次使用</h3><p>一次购买多次，使用时消耗对应次数。每次 ¥0.30，套餐无隐藏折扣。</p></div><span className="hhba-apply-unit">¥0.30 / 次</span></div>
   <div className="hhba-apply-package-grid">
    {packages.map(p=><button type="button" key={p.uses} className={'hhba-apply-package'+(choice.uses===p.uses?' selected':'')}
     aria-pressed={choice.uses===p.uses} onClick={()=>setSelected(p.uses)}>
      <span className="hhba-apply-package-top"><b>{p.uses} 次</b>{choice.uses===p.uses&&<CheckCircle2 size={18}/>}</span>
      <strong>{money(p.amountFen)}</strong>
      <small>每次 ¥0.30 · 可多次使用</small>
     </button>)}
   </div>
   <div className="hhba-apply-checkout">
    <div><small>当前选择</small><strong>{choice.uses} 次网申</strong></div>
    <div><small>总价</small><strong>{money(choice.amountFen)}</strong></div>
    <button type="button" onClick={()=>void buy()} disabled={!enabled||busy}>{busy?'正在处理…':enabled?'支付宝购买次数':'支付宝支付待开通'}<ArrowRight size={16}/></button>
   </div>
   <p className="hhba-apply-safety-note"><LockKeyhole size={15}/>支付宝「当面付」商户资质、应用密钥及通知验签尚未完成配置前，不会生成真实支付订单或收取费用。</p>
   {checkout&&<div className="hhba-apply-pending" role="status">
     <strong>订单 {checkout.id.slice(0,8)} · {stateText[checkout.status]}</strong>
     <p>已选择 {checkout.uses} 次，共 {money(checkout.amountFen)}。请以支付宝实际付款页面和此处状态为准。</p>
     {checkout.qrCode&&checkout.status==='pending'&&<div className="hhba-apply-qr-panel">
       <AlipayPaymentQR value={checkout.qrCode}/>
       <div><strong>请使用支付宝扫码支付</strong><p>二维码在当前设备本地生成，支付链接不会发送给第三方二维码网站。</p>
        {checkout.qrCode.startsWith('https://qr.alipay.com/')&&<a href={checkout.qrCode} target="_blank" rel="noopener noreferrer">手机端打开支付宝收银台 <ArrowRight size={14}/></a>}
        <small>请以支付宝实际收银台金额为准；付款后点击下方按钮查询到账。</small>
       </div></div>}
     <button type="button" disabled={busy} onClick={()=>void refresh()}>向支付宝查询订单状态</button>
     {checkout.status==='pending'&&<button type="button" disabled={busy} onClick={()=>void cancelUnpaid()}>取消未付款订单（需支付宝确认）</button>}
   </div>}
   {notice&&<p className="hhba-apply-notice" role="status">{notice}</p>}
  </section>
  <section className="hhba-apply-how">
   <h3>如何使用？</h3>
   <div className="hhba-apply-how-grid">
    <article><span>01</span><strong>完善真实求职资料</strong><p>准备简历、学历与工作经历；自动填写前明确授权。</p></article>
    <article><span>02</span><strong>选择并购买次数</strong><p>通过支付宝确认付款，订单经服务器验证成功后到账。</p></article>
    <article><span>03</span><strong>启动智能填写</strong><p>在支持的招聘页面预览 AI 建议、校验填写结果。</p></article>
    <article><span>04</span><strong>核对并提交申请</strong><p>由本人处理验证码、必要声明、附件和最后提交。</p></article>
   </div>
   <p className="hhba-apply-safety-note"><Clock3 size={15}/>自动填写引擎尚在升级，尚未开展正式收费网申。技术故障、未完成的预占次数不会计为成功使用。</p>
  </section>
  <section className="hhba-apply-connect" aria-label="连接浏览器插件">
   <div className="hhba-apply-headline"><div><h3>连接 HHBA 浏览器插件</h3>
    <p>登录 HHBA 后生成一次性连接码，再输入 Chrome / Edge 插件。插件只获得短期的次数查询权限，不会获得网站登录密码或令牌。</p>
   </div></div>
   <div className="hhba-apply-connect-grid">
    <div className="hhba-apply-connect-status"><LockKeyhole size={20}/>
     <strong>{config?.pairingEnabled?(pairedDevices===null?'正在检查连接状态…':'已连接 '+pairedDevices+' 个插件会话'):'账号连接暂未开放'}</strong>
     <small>连接码 5 分钟失效 · 插件凭证最长 12 小时 · 不支持插件扣费</small>
    </div>
    <div className="hhba-apply-connect-actions">
     <button type="button" disabled={!config?.pairingEnabled||pairBusy||!applyAccountAvailable} onClick={()=>void createConnectionCode()}>生成一次性连接码</button>
     <button type="button" disabled={!config?.pairingEnabled||pairBusy||(pairedDevices??0)<1} onClick={()=>void disconnectDevices()}>撤销所有连接</button>
    </div>
   </div>
   {pairCode&&<div className="hhba-apply-connect-code" role="status">
    <strong>{pairCode.code.slice(0,6)}-{pairCode.code.slice(6)}</strong>
    <span>有效期截至 {new Date(pairCode.expiresAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}。请勿分享给他人；到期后需重新生成。</span>
   </div>}
   {pairNotice&&<p className="hhba-apply-safety-note" role="status"><ShieldCheck size={15}/>{pairNotice}</p>}
   <p className="hhba-apply-safety-note"><ShieldCheck size={15}/>只读连接，不会付款、扣次、上传简历或自动投递。待完成扩展安全验收后开放。</p>
  </section>
  <section className="hhba-apply-history">
   <div className="hhba-apply-headline"><div><h3>使用与购买记录</h3><p>同一账号独立归属；不使用演示数据冒充真实记录。</p></div></div>
   <div className="hhba-apply-tabs">
    <button type="button" className={activeTab==='orders'?'active':''} onClick={()=>setActiveTab('orders')}><ReceiptText size={16}/>购买订单</button>
    <button type="button" className={activeTab==='tasks'?'active':''} onClick={()=>setActiveTab('tasks')}><Wallet size={16}/>使用记录</button>
   </div>
   {activeTab==='orders'?(orders.length?<div className="hhba-apply-records">{orders.map(o=><div key={o.id} className="hhba-apply-record-entry"><span><b>{o.uses} 次套餐</b><small>{o.createdAt.slice(0,10)} · {o.id.slice(0,8)}</small></span><span className="hhba-apply-record-right"><b>{money(o.amountFen)}</b><small>{stateText[o.status]}</small>{o.status==='paid'&&!refunds.some(x=>x.orderId===o.id)&&<button type="button" disabled={busy} onClick={()=>{setRefundOrder(o.id);setRefundReason('')}}>申请退款审核</button>}{refunds.some(x=>x.orderId===o.id)&&<small>退款审核：{refunds.find(x=>x.orderId===o.id)?.status==='requested'?'待审核':'处理中'}</small>}</span>{refundOrder===o.id&&<div className="hhba-apply-refund-form"><label>退款原因<textarea maxLength={300} value={refundReason} onChange={e=>setRefundReason(e.target.value)} placeholder="提交后进入人工审核，不会立即退款。"/></label><div><button type="button" onClick={()=>setRefundOrder(null)}>取消</button><button type="button" disabled={busy||refundReason.trim().length<2} onClick={()=>void submitRefund(o.id)}>提交审核申请</button></div></div>}</div>)}</div>:<p className="hhba-apply-empty">暂无真实购买订单。</p>):(tasks.length?<div className="hhba-apply-records">{tasks.map(t=><div key={t.id}><span><b>网申辅助填写任务</b><small>{t.createdAt.slice(0,10)} · {t.id.slice(0,8)}</small></span><small>{taskText[t.status]}</small></div>)}</div>:<p className="hhba-apply-empty">暂无真实网申任务记录。</p>)}
  </section>
  <details className="hhba-apply-faq"><summary>关于浏览器插件内测版和当前服务状态</summary>
   <p>V0.4 可在当前网页一键预填高置信度字段，也保留预览、手动确认和撤销。不支持复杂招聘系统全程自动填写，尚未接入云端 AI 或购买次数，正式收费功能没有开放。</p>
   <a href={archiveUrl} download="HHBA-智能网申助手-V0.4.zip">下载 V0.4 浏览器内测插件 <ArrowRight size={14}/></a>
  </details>
  <p className="hhba-apply-footer"><BadgeCheck size={15}/>不代替企业决定录用，也不保证投递成功。收费、有效任务认定、失败退回、使用期限及退款规则将在正式开通前公开明确；必要的个人信息处理和 AI 服务告知将独立完成。</p>
 </section>;
}
