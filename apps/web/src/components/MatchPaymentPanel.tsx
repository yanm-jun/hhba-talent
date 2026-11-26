import {useEffect,useMemo,useState} from 'react';
import {qrcodegen} from '../vendor/qrcodegen';
import {matchPaymentRequest,type MatchPaymentOrder,type MatchPaymentState} from '../services/matchPayment';
export function MatchPaymentPanel({onOrder,disabled,refreshKey}:{onOrder:(order:MatchPaymentOrder|null)=>void;disabled:boolean;refreshKey:number}){
 const [state,setState]=useState<MatchPaymentState|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{const abort=new AbortController();setState(null);onOrder(null);void matchPaymentRequest('status',undefined,abort.signal).then(data=>{if(!abort.signal.aborted){setState(data);onOrder(data.order);setMessage('');}}).catch(e=>{if(!abort.signal.aborted)setMessage(e.message);});return()=>abort.abort();},[refreshKey,onOrder]);
 const order=state?.order;
 const qr=useMemo(()=>{try{return order?.status==='pending'&&order.qrCode?qrcodegen.QrCode.encodeText(order.qrCode,qrcodegen.QrCode.Ecc.MEDIUM):null}catch{return null}},[order?.qrCode,order?.status]);
 const blocks:string[]=[];if(qr)for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))blocks.push('M'+(x+4)+' '+(y+4)+'h1v1h-1z');
 async function act(action:'order'|'query'|'close'|'status'){
  if(busy||disabled)return;setBusy(true);setMessage('');
  try{const data=await matchPaymentRequest(action,order?.id);setState(data);onOrder(data.order);}
  catch(e){setMessage(e instanceof Error?e.message:'支付状态暂不可用，请稍后查询。');}
  finally{setBusy(false);}
 }
 return <section className="hhba-ai-payment-panel" aria-label="智能匹配支付">
  <header><h3>智能匹配服务</h3><strong>{state?'¥'+(state.amountFen/100).toFixed(2):'正在确认价格'}</strong></header>
  <p>支付确认后，开始本次智能匹配。同一研究任务断线恢复不重复收费。</p>
  {order?.status==='paid'&&!order.closed?<p role="status"><strong>已到账</strong> · {order.bound?'已绑定原任务，可恢复同一任务。':'可以开始智能匹配。'}</p>:null}
  {order?.status==='pending'&&<div>
   <p>订单 {order.id.slice(0,8)} · 等待支付宝确认</p>
   {qr&&<svg width="190" height="190" viewBox={'0 0 '+(qr.size+8)+' '+(qr.size+8)} role="img" aria-label="支付宝付款二维码" shapeRendering="crispEdges"><rect width={qr.size+8} height={qr.size+8} fill="#fff"/><path d={blocks.join('')} fill="#102A5A"/></svg>}
   {order.qrCode?.startsWith('https://qr.alipay.com/')&&<p><a href={order.qrCode} target="_blank" rel="noopener noreferrer">打开支付宝收银台</a></p>}
   <button type="button" disabled={disabled||busy||!state?.enabled} onClick={()=>void act('query')}>查询支付状态</button>
   {!order.qrCode&&<button type="button" disabled={disabled||busy||!state?.enabled} onClick={()=>void act('order')}>恢复原订单二维码</button>}
   <button type="button" disabled={disabled||busy||!state?.enabled} onClick={()=>void act('close')}>关闭未支付订单</button>
  </div>}
  {(!order||order.closed||['closed','refunded'].includes(order.status))&&<button type="button" disabled={disabled||busy||!state?.enabled} onClick={()=>void act('order')}>支付宝购买本次服务</button>}
  {!state?.enabled&&<p>支付暂未开放。尚未产生新收费。</p>}
  {message&&<p role="alert">{message} <button type="button" disabled={disabled||busy} onClick={()=>void act('status')}>重新查询</button></p>}
 </section>;
}
