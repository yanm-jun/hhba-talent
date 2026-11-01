import {JOIN_INBOX,mailReady,sendMail,validEmail} from '../../../_lib/mail.js';
const enc=new TextEncoder();
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const err=(s,detail)=>response({detail},s);
const directions=new Set(['tech-lead','backend','ai-data','governance','business','product','other']);
const contacts=new Set(['邮箱','微信','手机号','其他']);
const weeks=new Set(['每周 1–5 小时','每周 6–15 小时','每周 16–30 小时','每周 30 小时以上','待进一步沟通']);
const modes=new Set(['远程协作','线上线下结合','未来正式岗位','灵活协商']);
const str=(x,max,min=0)=>typeof x==='string'&&x.trim().length>=min&&x.trim().length<=max;
const clean=x=>String(x||'').trim();
const now=()=>Math.floor(Date.now()/1000);
async function ipHash(v){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function onRequestPost({request,env}) {
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return err(403,'请求来源无效。');
 if(!env.HHBA_JOIN_DB || env.HHBA_JOIN_INTAKE_ENABLED!=='1' || !mailReady(env))return err(503,'在线申请邮件接收服务尚未开通。可稍后再试。');
 if(!request.headers.get('content-type')?.startsWith('application/json'))return err(415,'请使用 JSON 发送申请。');
 if(Number(request.headers.get('content-length')||0)>16384)return err(413,'申请内容过长。');
 const raw=await request.text();
 if(enc.encode(raw).length>16384)return err(413,'申请内容过长。');
 let data;
 try{data=JSON.parse(raw);}catch{return err(400,'申请格式错误。');}
 if(!data||typeof data!=='object'||Array.isArray(data))return err(400,'申请格式错误。');
 if(data.website)return response({ok:true},202); // honeypot, do not persist
 const {name,contactType,contact,direction,experience,portfolio,strength,weeklyTime,mode,note,acknowledged,privacyAgreed}=data;
 if(!str(name,80,2)||!contacts.has(contactType)||!str(contact,180,3)||!directions.has(direction)||
    !str(experience,1200,10)||!str(portfolio||'',400)||!str(strength||'',600)||
    !weeks.has(weeklyTime)||!modes.has(mode)||!str(note||'',600)||acknowledged!==true||privacyAgreed!==true)
    return err(400,'请检查表单必填信息与长度。');
 if(contactType==='邮箱'&&!validEmail(clean(contact)))return err(400,'联系邮箱格式错误。');
 if(portfolio){try{const u=new URL(portfolio);if(u.protocol!=='https:'||u.username||u.password)return err(400,'作品链接必须使用安全 HTTPS 地址。');}catch{return err(400,'作品链接不正确。');}}
 const db=env.HHBA_JOIN_DB,ts=now(),ip=request.headers.get('cf-connecting-ip')||'unknown';
 try{
   const key=await ipHash('join:'+ip),cutoff=ts-3600;
   await db.prepare('INSERT INTO join_rate_limits(rate_key,window_start,hits) VALUES(?,?,1) ON CONFLICT(rate_key) DO UPDATE SET hits=CASE WHEN window_start<? THEN 1 ELSE hits+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END').bind(key,ts,cutoff,cutoff,ts).run();
   const count=await db.prepare('SELECT hits FROM join_rate_limits WHERE rate_key=?').bind(key).first();
   if(count?.hits>4)return err(429,'申请提交过于频繁，请稍后再试。');
   const id='HHBA-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
   await db.prepare('INSERT INTO join_applications(id,name,contact_type,contact,direction,experience,portfolio,strength,weekly_time,collaboration_mode,note,created_at,mail_status,consent_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,clean(name),contactType,clean(contact),direction,clean(experience),clean(portfolio),clean(strength),weeklyTime,mode,clean(note),ts,'pending','join-privacy-2026-11').run();
   const text=[
    'HHBA 加入我们 / 合作申请','申请编号：'+id,'提交时间（UTC）：'+new Date().toISOString(),
    '姓名/称呼：'+clean(name),'联系方式类型：'+contactType,'联系方式：'+clean(contact),
    '合作方向：'+direction,'相关经验：'+clean(experience),'希望解决的问题：'+clean(strength),
    '作品链接：'+clean(portfolio),'每周投入：'+weeklyTime,'合作方式：'+mode,'补充说明：'+clean(note),
    '同意事项：已同意 join-privacy-2026-11','请仅通过申请人自愿提供的联系方式联系。'
   ].join('\n\n');
   try{
    const mailId=await sendMail(env,{to:JOIN_INBOX,subject:'[HHBA加入申请] '+id+' · '+clean(name),text,
      replyTo:contactType==='邮箱'?clean(contact):undefined});
    await db.prepare('UPDATE join_applications SET mail_status=?,mail_provider_id=?,mail_updated_at=? WHERE id=?').bind('accepted',mailId,now(),id).run();
    return response({ok:true,application_id:id,mail_status:'accepted'},201);
   }catch(error){
    console.error('HHBA_JOIN_NOTIFICATION_ERROR',String(error).slice(0,200));
    await db.prepare('UPDATE join_applications SET mail_status=?,mail_updated_at=? WHERE id=?').bind('failed',now(),id).run();
    return err(503,'申请已安全记录，但邮件通知尚未发送成功。请记下申请时间并稍后联系管理员，避免重复提交。');
   }
 }catch(error){console.error('HHBA_JOIN_DB_ERROR',String(error).slice(0,200));return err(503,'申请系统暂不可用，未确认提交成功。');}
}
export const onRequestGet=({env})=>response({ready:env.HHBA_JOIN_INTAKE_ENABLED==='1'&&!!env.HHBA_JOIN_DB&&mailReady(env),recipient_configured:true});
export const onRequestOptions=()=>new Response(null,{status:405});
