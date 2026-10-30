import {test,expect,beforeAll,afterAll} from 'bun:test';
import {Database} from 'bun:sqlite';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handlePrivateAdmin,normalizePeriod,privateGrowth} from '../admin-console.ts';
const root=mkdtempSync(join(tmpdir(),'hhba-private-growth-'));
const secret='CI_ONLY_DO_NOT_USE_LIVE_credential_24_chars';
const today=new Date().toISOString().slice(0,10);
const yesterday=new Date(Date.now()-86400_000).toISOString().slice(0,10);
beforeAll(()=>{Bun.env.HHBA_ADMIN_PASSWORD=secret;Bun.env.HHBA_ENGAGEMENT_DIR=root;});
afterAll(()=>rmSync(root,{recursive:true,force:true}));
test('all private analytics and former public summary endpoints require admin auth',async()=>{
 for(const path of ['/api/admin/growth','/api/admin/jobs','/api/engagement/summary','/api/saved/summary']){
  const response=await handlePrivateAdmin(new Request('https://local.test'+path),new URL('https://local.test'+path));
  expect(response?.status).toBe(401);
 }
 const response=await handlePrivateAdmin(new Request('https://local.test/management/'),new URL('https://local.test/management/'));
 expect(response?.status).toBe(200);expect((await response?.text())?.includes('管理员访问密码')).toBe(true);
});
test('login always verifies password, even when Origin is missing or forwarded incorrectly',async()=>{
 const url=new URL('https://local.test/management/login');
 for(const headers of [
  {'origin':'https://evil.test','content-type':'application/x-www-form-urlencoded'},
  {'content-type':'application/x-www-form-urlencoded'},
  {'origin':'null','content-type':'application/x-www-form-urlencoded'}
 ]){
  const wrong=await handlePrivateAdmin(new Request(url,{method:'POST',headers,body:'password=wrong'}),url);
  expect(wrong?.status).toBe(200);
  expect(wrong?.headers.get('set-cookie')).toBeNull();
 }
 const malformed=await handlePrivateAdmin(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),url);
 expect(malformed?.status).toBe(415);
});
test('valid session cookie works for protected API and expires on logout',async()=>{
 const url=new URL('https://local.test/management/login');
 const response=await handlePrivateAdmin(new Request(url,{method:'POST',headers:{origin:url.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:secret})}),url);
 expect(response?.status).toBe(303);
 const token=response?.headers.get('set-cookie')?.split(';')[0]||'';
 expect(token).toContain('hhba_admin_v1=');
 expect(response?.headers.get('set-cookie')).toContain('HttpOnly');
 expect(response?.headers.get('set-cookie')).toContain('SameSite=Strict');
 const auth=new Request('https://local.test/api/admin/growth?days=7',{headers:{cookie:token}});
 const growth=await handlePrivateAdmin(auth,new URL(auth.url));
 expect(growth?.status).toBe(200);
 const body=await growth?.json();
 expect(body.kind).toBe('HHBA_PRIVATE_GROWTH_V1');
 const exitUrl=new URL('https://local.test/management/logout');
 const denied=await handlePrivateAdmin(new Request(exitUrl,{method:'POST',headers:{cookie:token,origin:'https://bad.test'}}),exitUrl);
 expect(denied?.status).toBe(403);
 const logout=await handlePrivateAdmin(new Request(exitUrl,{method:'POST',headers:{cookie:token,origin:exitUrl.origin}}),exitUrl);
 expect(logout?.status).toBe(303);expect(logout?.headers.get('set-cookie')).toContain('Max-Age=0');
});
test('growth query preserves zero vs unavailable and distinguishes daily UV sum',()=>{
 expect(privateGrowth(normalizePeriod('1')).traffic.quality).toBe('unavailable');
 const traffic=new Database(join(root,'hhba-engagement.sqlite'),{create:true});
 traffic.exec('CREATE TABLE engagement_events(day TEXT,event_type TEXT,visitor_hash TEXT)');
 traffic.query('INSERT INTO engagement_events VALUES(?,?,?)').run(today,'page_view','a');
 traffic.query('INSERT INTO engagement_events VALUES(?,?,?)').run(today,'page_view','a');
 traffic.query('INSERT INTO engagement_events VALUES(?,?,?)').run(today,'page_view','b');
 traffic.query('INSERT INTO engagement_events VALUES(?,?,?)').run(yesterday,'page_view','a');
 traffic.query('INSERT INTO engagement_events VALUES(?,?,?)').run(today,'job_search','a');
 traffic.close();
 const saved=new Database(join(root,'hhba-saved.sqlite'),{create:true});
 saved.exec('CREATE TABLE saved_jobs(device_hash TEXT,job_id TEXT);CREATE TABLE saved_events(day TEXT,event TEXT,quantity INTEGER)');
 saved.query('INSERT INTO saved_jobs VALUES(?,?)').run('deviceA','jobA');
 saved.query('INSERT INTO saved_events VALUES(?,?,?)').run(today,'added',1);
 saved.close();
 const result=privateGrowth(normalizePeriod('7'));
 expect(result.traffic.pv).toBe(4);
 expect(result.traffic.dailyUvSum).toBe(3); // a counted once yesterday, once today; b today.
 expect(result.traffic.searches).toBe(1);
 expect(result.bookmarks.totalActive).toBe(1);
 expect(result.bookmarks.added).toBe(1);
 expect(result.unavailable.registeredUsers).toBeNull();
});
test('custom period validated and never future dates',()=>{
 const custom=normalizePeriod('30',new Date('2026-10-21T02:00:00Z'),'2026-10-10','2026-10-20');
 expect(custom).toEqual({days:11,from:'2026-10-10',today:'2026-10-20'});
 const fallback=normalizePeriod('7',new Date('2026-10-21T02:00:00Z'),'2026-10-10','2026-11-10');
 expect(fallback.days).toBe(7);
});

test('admin login succeeds with browser HTTPS origin when Railway forwards an HTTP internal URL',async()=>{
 const prior=Bun.env.RAILWAY_PUBLIC_DOMAIN;
 const trusted='hhba-web-production-024c.up.railway.app';
 Bun.env.RAILWAY_PUBLIC_DOMAIN=trusted;
 try{
  const u=new URL('http://127.0.0.1:3000/management/login');
  const mk=(origin:string,credential:string)=>new Request(u,{method:'POST',headers:{
   origin,'sec-fetch-site':'same-origin','content-type':'application/x-www-form-urlencoded'
  },body:new URLSearchParams({password:credential})});
  const wrong=await handlePrivateAdmin(mk('https://'+trusted,'incorrect'),u);
  expect(wrong?.status).toBe(200); // Not a proxy-origin 403.
  const good=await handlePrivateAdmin(mk('https://'+trusted,secret),u);
  expect(good?.status).toBe(303);
  expect(good?.headers.get('location')).toBe('/management/');
  const token=good?.headers.get('set-cookie')?.split(';')[0]||'';
  expect(token.startsWith('hhba_admin_v1=')).toBe(true);
  const statsUrl=new URL('http://127.0.0.1:3000/api/admin/growth?days=7');
  const stats=await handlePrivateAdmin(new Request(statsUrl,{headers:{cookie:token}}),statsUrl);
  expect(stats?.status).toBe(200);
  // A browser that does not emit an Origin header can still authenticate.
  // Wrong or missing password never creates a privileged session.
  const originless=await handlePrivateAdmin(new Request(u,{method:'POST',headers:{
   'content-type':'application/x-www-form-urlencoded'
  },body:new URLSearchParams({password:secret})}),u);
  expect(originless?.status).toBe(303);
  expect(originless?.headers.get('set-cookie')).toContain('hhba_admin_v1=');
  const invalid=await handlePrivateAdmin(mk('https://attacker.invalid','wrong'),u);
  expect(invalid?.headers.get('set-cookie')).toBeNull();
  const logoutUrl=new URL('http://127.0.0.1:3000/management/logout');
  const logout=await handlePrivateAdmin(new Request(logoutUrl,{method:'POST',headers:{
   cookie:token,origin:'https://'+trusted,'sec-fetch-site':'same-origin'}}),logoutUrl);
  expect(logout?.status).toBe(303);
  expect(logout?.headers.get('set-cookie')).toContain('Path=/;');
 }finally{
  if(prior===undefined)delete Bun.env.RAILWAY_PUBLIC_DOMAIN;
  else Bun.env.RAILWAY_PUBLIC_DOMAIN=prior;
 }
});
