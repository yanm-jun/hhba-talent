// Bundled into a local workerd-only fixture. This is the actual HHBA Pages
// Function entry point, not a mock version of its D1/R2/auth logic.
import {onRequestGet,onRequestPost} from '../functions/api/resume-word.js';
export default {
 async fetch(request,env) {
  if(request.method==='GET')return onRequestGet({request,env});
  if(request.method==='POST')return onRequestPost({request,env});
  return new Response('Method Not Allowed',{status:405});
 }
};
