// The former monthly finance mail campaign is retired.
// Do not publish, allocate, or dispatch funding reports. Legacy data stays in D1.
import {failure} from '../../_lib/transparency.js';

function constantTimeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let mismatch=0;
 for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
 return mismatch===0;
}

// Retained as a safe compatibility shim for internal callers and tests.
export async function sendNextBatch(){
 return {attempted:0,sent:0,failed:0};
}
export async function onRequestPost({request,env}){
 const secret=String(env.HHBA_FIN_DISPATCH_SECRET||'');
 const candidate=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 if(secret.length<40||!constantTimeEqual(candidate,secret))return failure('UNAUTHORIZED',401);
 return failure('FINANCE_DISPATCH_RETIRED',410);
}
