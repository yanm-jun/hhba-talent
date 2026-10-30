import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8003';
export default defineConfig({base:process.env.HHBA_PAGES_BASE|| (process.env.HHBA_GITHUB_PAGES==='1'?'/hhba-talent/':'/'),plugins:[react()],server:{host:'127.0.0.1',port:3000,proxy:{'/api':{target:apiProxyTarget,changeOrigin:true},'/live-recruitment':{
  target:process.env.VITE_LIVE_RECRUITMENT_TARGET || 'https://hhba-web-production-024c.up.railway.app',
  changeOrigin:true,
  secure:true,
  rewrite:(path)=>path.replace(/^\/live-recruitment/,''),
  configure:(proxy)=>{
    proxy.on('proxyReq',(request,req)=>{
      request.removeHeader('cookie');request.removeHeader('authorization');
      if(!['GET','HEAD'].includes(req.method || 'GET')) request.destroy(new Error('Read-only live recruitment proxy'));
    });
  }
},'/recruitment/api':{target:process.env.VITE_RECRUITMENT_PROXY_TARGET || 'http://127.0.0.1:8765',changeOrigin:true,rewrite:(path)=>path.replace(/^\/recruitment/,''),configure:(proxy)=>{proxy.on('proxyReq',(request)=>{request.removeHeader('cookie');request.removeHeader('authorization');});}}}}});
