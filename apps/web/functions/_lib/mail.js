// Transactional mail adapter. Never load API keys into the Vite browser bundle.
// Configure a verified from-domain and either Cloudflare EMAIL send binding
// or RESEND_API_KEY. Refuse to collect personal details when no sender exists.
export const JOIN_INBOX = 'mingjunyan94@gmail.com';
export function mailReady(env) {
 return !!(env.HHBA_MAIL_FROM && (env.EMAIL?.send || env.RESEND_API_KEY));
}
export function validEmail(value) {
 return typeof value==='string' && value.length<=254 && value.length>=5 &&
 /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>.]+$/.test(value);
}
export function testAddress(email) {
 return /@example\.(?:test|invalid)$/i.test(email);
}
function textSafe(s) { return String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').slice(0,10000); }
export async function sendMail(env, {to,subject,text,replyTo}) {
 if(!mailReady(env))throw new Error('mail_not_configured');
 if(!validEmail(to) || !validEmail(env.HHBA_MAIL_FROM))throw new Error('bad_mail_address');
 const payload={from:env.HHBA_MAIL_FROM,to,subject:textSafe(subject).slice(0,150),text:textSafe(text),...(replyTo&&validEmail(replyTo)?{replyTo}:{})};
 if(env.EMAIL?.send) {
   const result=await env.EMAIL.send(payload);
   if(!result?.messageId)throw new Error('mail_no_provider_message_id');
   return result.messageId;
 }
 const result=await fetch('https://api.resend.com/emails',{method:'POST',
   headers:{'content-type':'application/json','authorization':`Bearer ${env.RESEND_API_KEY}`},
   body:JSON.stringify({from:payload.from,to:[payload.to],subject:payload.subject,text:payload.text,...(replyTo&&validEmail(replyTo)?{reply_to:replyTo}:{})})});
 if(!result.ok)throw new Error('mail_provider_rejected_'+result.status);
 const data=await result.json();
 if(!data?.id)throw new Error('mail_no_provider_message_id');
 return data.id;
}
