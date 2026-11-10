#!/usr/bin/env node
/**
 * Generate crawlable, public-only HTML entries and a sitemap for hhba.work.
 * Run AFTER Vite and materialize-company-route-entries.mjs.
 * React replaces the meaningful static fallback on startup; no private data is emitted.
 */
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const ORIGIN = 'https://hhba.work';
const BRAND = '汇方职场 HHBA';
const dist = resolve('dist');
const shellPath = join(dist, 'index.html');
const shell = readFileSync(shellPath, 'utf8');
assert.match(shell, /<div id="root"><\/div>/, 'Vite root shell changed');
assert.match(shell, /\/assets\//, 'Run this for Cloudflare Pages root-domain builds only');
const escapeHTML = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const clip = (value, length = 260) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, length);
const canonical = (path) => ORIGIN + (path === '/' ? '/' : encodeURI(path.replace(/\/+$/, '') + '/'));
const targetFor = (path) => path === '/' ? shellPath : join(dist, decodeURIComponent(path).replace(/^\/+/, ''), 'index.html');
const LINKED = [
  ['/', '官方网站'],
  ['/candidate/jobs', '国内招聘岗位'],
  ['/companies/discover', '企业发现'],
  ['/winter-internship', '寒假实习'],
  ['/talent-service', '人才政策与住房'],
  ['/talent-service/cities', '城市政策目录'],
  ['/study-abroad', '留学与海外发展']
];
const pages = [
  {path:'/', title:'汇方职场 HHBA｜让机会与人才，找到彼此。',
   description:'汇方职场 HHBA，提供中国大陆企业招聘岗位、简历智能匹配、寒假实习、城市人才政策与留学发展信息。',
   heading:'汇方职场 HHBA',
   body:'让机会与人才，找到彼此。浏览真实企业招聘信息、寒假实习机会、人才政策与城市住房指南，了解汇方职场。'},
  {path:'/candidate/jobs',title:'中国大陆招聘岗位与官方投递入口｜汇方职场 HHBA',
   description:'在汇方职场浏览中国大陆企业招聘岗位，查看招聘来源与企业官方投递入口，了解岗位要求。',
   heading:'国内企业招聘岗位',body:'汇方职场提供公开招聘信息和企业官方招聘入口；具体岗位是否开放及任职要求，请以招聘企业官网为准。'},
  {path:'/companies/discover',title:'企业发现与校园招聘信息｜汇方职场 HHBA',
   description:'探索汇方职场收录的企业档案、主营业务和校园招聘方向，了解企业并访问招聘官网。',
   heading:'企业发现',body:'浏览不同企业的业务介绍与校园招聘资料。汇方职场不是企业官方招聘代理，岗位信息以企业官网为准。'},
  {path:'/winter-internship',title:'国内寒假实习岗位与项目｜汇方职场 HHBA',
   description:'汇方职场寒假实习专区，查看中国大陆企业公开实习岗位、招聘来源和申请状态。',
   heading:'寒假实习',body:'关注国内寒假实习岗位和实习项目资料，查看官方申请渠道并核实当前招聘状态。'},
  {path:'/talent-service',title:'人才政策、住房补贴与申请指南｜汇方职场 HHBA',
   description:'查询城市人才政策、人才公寓、租房补贴、落户支持和申请指南，政策以地方官方公告为准。',
   heading:'人才服务与城市政策',body:'搜索城市人才政策、安居住房、人才公寓、就业创业补贴和政策申请指南。请以官方最新公告为准。'},
  {path:'/talent-service/cities',title:'全国城市人才政策目录｜汇方职场 HHBA',
   description:'按城市了解人才引进、补贴、人才安居及申请指南。选择城市查看当地政策。',
   heading:'全国城市人才政策目录',body:'按城市浏览人才政策和住房信息，实际申请资格、补贴额度及办理时间以当地最新官方公告为准。'},
  {path:'/candidate/domestic-autumn',title:'国内秋招校招与企业招聘｜汇方职场 HHBA',
   description:'查看国内校园招聘与秋招企业信息、岗位方向和官方投递入口。',
   heading:'国内校园招聘与秋招',body:'汇方职场整理国内校园招聘资料、企业信息及可核验的招聘入口；岗位是否在招以官方发布为准。'},
  {path:'/study-abroad',title:'留学机会与海外发展信息｜汇方职场 HHBA',
   description:'查看留学机会、国家方案和海外发展信息，了解升学与职业发展路径。',
   heading:'留学机会与海外发展',body:'了解不同国家的留学方案和发展路径。学校、签证、费用与申请要求以官方最新信息为准。'},
  {path:'/join',title:'加入汇方职场｜HHBA',
   description:'了解汇方职场的使命、团队理念与合作机会。',
   heading:'加入汇方职场',body:'我们希望让人才与机会更好地相遇。了解汇方职场的团队理念、使命和开放合作信息。'},
  {path:'/vision',title:'品牌愿景与理念｜汇方职场 HHBA',
   description:'了解汇方职场 HHBA 的平台使命与品牌愿景：让机会与人才，找到彼此。',
   heading:'汇方职场品牌愿景',body:'汇方职场致力于建设更透明、更尊重求职者的职场机会连接平台。'},
  {path:'/data-use',title:'隐私与信息使用说明｜汇方职场 HHBA',
   description:'查看汇方职场的隐私保护、数据使用与简历授权说明。',
   heading:'隐私与信息使用说明',body:'了解账号信息、简历上传和智能匹配相关数据的使用范围及隐私说明。'}
];
const cities=['北京','上海','杭州','深圳','济南','青岛'];
for (const city of cities) {
  pages.push({
    path:'/talent-service/city/'+city,
    title:city+'人才政策、补贴与人才住房｜汇方职场 HHBA',
    description:'通过汇方职场浏览'+city+'人才政策、住房与补贴信息及办理指南。具体资格、期限和房源以官方公告为准。',
    heading:city+'人才政策与住房指南',
    body:'了解'+city+'的人才引进政策、住房补贴、人才公寓及申请指南。信息为公开资料整理，不替代政府官方公告。'
  });
}
const companyDir = resolve('src/data/employerProfiles');
const directoryEntries=[];
let companyCount=0;
for(const filename of readdirSync(companyDir).filter(n=>/^cn-autumn-\d{3}\.json$/.test(n)).sort()){
  const profile=JSON.parse(readFileSync(join(companyDir,filename),'utf8'));
  assert.equal(profile.id, filename.slice(0,-5));
  const path='/companies/autumn/'+profile.id;
  const name=clip(profile.displayName || profile.name,80);
  assert(name.length>0, 'Missing company name: '+filename);
  const overview=clip(profile.overview || profile.subtitle || '企业业务与招聘方向',550);
  const industry=clip(profile.industry || '',120);
  const subtitle=clip(profile.subtitle || '',170);
  const jobs=[...new Set((Array.isArray(profile.jobs)?profile.jobs:[])
    .map(j=>clip(j?.title||'',90)).filter(Boolean))].slice(0,8);
  const recruitUrl=String(profile.recruitment?.url||'');
  // University bulletins and archived-source links are NOT company-owned portals.
  // Never present those as a direct official application URL in search results.
  const officialUrl=profile.recruitment?.status==='official_portal'
    &&/^https:\/\/[a-z0-9.-]+(?:[:/??#]|$)/i.test(recruitUrl) ? recruitUrl : '';
  const verifiedSource=officialUrl
    ? '<p><a href="'+escapeHTML(officialUrl)+'" rel="noopener noreferrer">访问企业官方招聘入口</a></p>'
    : '<p>当前档案未核验企业官方在线投递入口。招聘信息与申请渠道请以企业官方公告为准。</p>';
  const extra='<section aria-label="企业公开招聘资料">'
    +(subtitle?'<h2>企业背景</h2><p>'+escapeHTML(subtitle)+'</p>':'')
    +(industry?'<p>行业方向：'+escapeHTML(industry)+'</p>':'')
    +(jobs.length?'<h2>公开资料中的招聘方向</h2><ul>'+jobs.map(job=>'<li>'+escapeHTML(job)+'</li>').join('')+'</ul>':'')
    +verifiedSource
    +'<p>以上岗位方向来自已有公开招聘资料，不表示当前均可投递；是否在招及任职条件以招聘企业官网为准。</p>'
    +'<p><a href="'+canonical('/companies/discover')+'">返回汇方职场企业目录</a></p></section>';
  pages.push({path,title:name+'企业档案与招聘方向｜汇方职场 HHBA',
    description:clip(name+'：'+overview+' 招聘信息与投递状态请以企业官网为准。',160),
    heading:name+'企业档案',body:overview,extraHtml:extra,
    lastmod:/^\d{4}-\d{2}-\d{2}$/.test(profile.lastReviewed || '') ? profile.lastReviewed : null});
  directoryEntries.push({path,name,industry});
  companyCount++;
}
// Expose actual links in the server-returned HTML for crawlers that do not
// execute React. This is a public directory, not a new enterprise API.
const directoryPage=pages.find(p=>p.path==='/companies/discover');
assert(directoryPage,'Public company directory is required');
directoryPage.extraHtml='<section aria-label="国内企业档案目录"><h2>已整理企业档案（'+directoryEntries.length+' 家）</h2>'
  +'<ul>'+directoryEntries.map(({path,name,industry})=>'<li><a href="'+escapeHTML(canonical(path))+'">'+escapeHTML(name)+'</a>'
     +(industry?' · '+escapeHTML(industry):'')+'</li>').join('')+'</ul></section>';
const cityDirectory=pages.find(p=>p.path==='/talent-service/cities');
assert(cityDirectory,'Public city directory is required');
cityDirectory.extraHtml='<section aria-label="可浏览城市人才政策"><h2>可浏览城市</h2><ul>'
  +cities.map(city=>'<li><a href="'+escapeHTML(canonical('/talent-service/city/'+city))+'">'+escapeHTML(city)+'人才政策与住房</a></li>').join('')
  +'</ul><p>以上为当前已生成搜索入口的城市，不代表已经覆盖全部城市。</p></section>';
function setTag(html, regex, replacement, name){
  assert(regex.test(html),'Missing expected SEO shell tag: '+name);
  return html.replace(regex,replacement);
}
function publicHTML(page){
  const url=canonical(page.path);
  let html=shell;
  html=setTag(html,/<title>[\s\S]*?<\/title>/,'<title>'+escapeHTML(page.title)+'</title>','title');
  html=setTag(html,/<meta name="description" content="[^"]*" \/>/,'<meta name="description" content="'+escapeHTML(page.description)+'" />','description');
  html=setTag(html,/<link rel="canonical" href="[^"]*" \/>/,'<link rel="canonical" href="'+escapeHTML(url)+'" />','canonical');
  html=setTag(html,/<meta property="og:title" content="[^"]*" \/>/,'<meta property="og:title" content="'+escapeHTML(page.title)+'" />','og:title');
  html=setTag(html,/<meta property="og:description" content="[^"]*" \/>/,'<meta property="og:description" content="'+escapeHTML(page.description)+'" />','og:description');
  html=setTag(html,/<meta property="og:url" content="[^"]*" \/>/,'<meta property="og:url" content="'+escapeHTML(url)+'" />','og:url');
  // Render an actual, responsive public entry instead of the raw blue-link
  // crawler text when a mobile browser cannot fetch/execute the React bundle.
  // Keep the real H1, links and full public directory in HTML for no-JS crawlers.
  const navigation=LINKED.map(([path,label])=>'<a class="hhba-seo-link" href="'+escapeHTML(canonical(path))+'">'+escapeHTML(label)+'</a>').join('');
  const citiesLinks=page.path==='/' ? '<section class="hhba-seo-cities" aria-label="热门城市人才政策"><h2>城市人才政策</h2><div class="hhba-seo-city-links">'
    +cities.map(city=>'<a href="'+escapeHTML(canonical('/talent-service/city/'+city))+'">'+escapeHTML(city)+'人才政策</a>').join('')
    +'</div></section>' : '';
  // Inline minimal fallback CSS: it must work even if Vite's CSS is unreachable.
  // React replaces this entire fallback on successful bootstrap.
  const fallbackStyle='<style id="hhba-seo-fallback-style">'
    +'body:has(.hhba-seo-entry){margin:0;background:#f5f8f7}'
    +'.hhba-seo-entry,.hhba-seo-entry *{box-sizing:border-box}'
    +'.hhba-seo-entry{min-height:100vh;padding:0 20px 42px;margin:0 auto;color:#173c33;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;max-width:1060px}'
    +'.hhba-seo-entry a{color:inherit;text-decoration:none}'
    +'.hhba-seo-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:21px 0 25px}'
    +'.hhba-seo-brand{display:inline-flex;align-items:center;gap:9px;font-size:17px;font-weight:800;letter-spacing:.01em}'
    +'.hhba-seo-brand img{width:36px;height:36px;object-fit:contain}'
    +'.hhba-seo-login{border:1px solid #cbded6;border-radius:999px;padding:7px 15px;font-size:13px;font-weight:700;white-space:nowrap;background:#fff}'
    +'.hhba-seo-hero{background:linear-gradient(130deg,#e9f4ef 0%,#fff 65%,#f2f7fc 100%);border:1px solid #dfebe5;border-radius:25px;padding:clamp(24px,5vw,60px);box-shadow:0 16px 45px rgba(24,61,47,.05)}'
    +'.hhba-seo-eyebrow{margin:0 0 12px;font-size:12px;font-weight:800;letter-spacing:.14em;color:#327961}'
    +'.hhba-seo-hero h1{margin:0;font-size:clamp(28px,5vw,44px);font-weight:800;line-height:1.25;letter-spacing:-.02em;color:#173c33}'
    +'.hhba-seo-tagline{font-size:clamp(19px,3.2vw,27px);font-weight:750;margin:14px 0 6px;color:#214d42}'
    +'.hhba-seo-description{color:#546d62;max-width:690px;font-size:15px;margin:10px 0 0}'
    +'.hhba-seo-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:27px}'
    +'.hhba-seo-action{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 21px;border-radius:12px;font-size:14px;font-weight:750;background:#fff;border:1px solid #c5d9ce}'
    +'.hhba-seo-action-primary{background:#205942;color:#fff!important;border-color:#205942}'
    +'.hhba-seo-section-title{font-size:15px;color:#2d5445;margin:25px 0 12px}'
    +'.hhba-seo-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}'
    +'.hhba-seo-nav .hhba-seo-link{display:flex;align-items:center;min-height:54px;padding:12px 15px;background:#fff;border:1px solid #e0ebe5;border-radius:12px;font-size:14px;font-weight:650}'
    +'.hhba-seo-cities{margin-top:25px}.hhba-seo-cities h2{font-size:15px;margin:0 0 11px}'
    +'.hhba-seo-city-links{display:flex;flex-wrap:wrap;gap:8px}'
    +'.hhba-seo-city-links a{display:inline-block;padding:7px 13px;background:#e7f1eb;border-radius:30px;font-size:13px}'
    +'.hhba-seo-details{background:#fff;border:1px solid #e0ebe5;border-radius:14px;margin-top:22px;padding:14px 22px;font-size:14px;overflow-wrap:anywhere}'
    +'.hhba-seo-details a{color:#216f52;text-decoration:underline}'
    +'.hhba-seo-recovery{display:none;padding:13px 16px;margin:20px 0 0;background:#fff6e8;border:1px solid #efdbb5;border-radius:12px;font-size:13px;color:#65502b}'
    +'.hhba-seo-entry[data-boot="failed"] .hhba-seo-recovery,.hhba-seo-entry[data-boot="slow"] .hhba-seo-recovery{display:block}'
    +'.hhba-seo-recovery a{text-decoration:underline;font-weight:800}'
    +'.hhba-seo-footer{font-size:12px;color:#6d8176;padding-top:24px;text-align:center}'
    +'@media(max-width:560px){.hhba-seo-entry{padding:0 15px 28px}.hhba-seo-header{padding:16px 0 20px}.hhba-seo-brand{font-size:15px}.hhba-seo-brand img{width:31px;height:31px}.hhba-seo-hero{border-radius:18px;padding:25px 20px}.hhba-seo-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.hhba-seo-nav .hhba-seo-link{font-size:13px;padding:11px;min-height:52px}.hhba-seo-actions{gap:8px}.hhba-seo-action{flex:1 1 auto;padding:10px 12px}}'
    +'</style>';
  const fallback='<main class="hhba-seo-entry" id="hhba-seo-entry">'
    +'<header class="hhba-seo-header"><a class="hhba-seo-brand" href="'+ORIGIN+'/"><img src="/images/hhba-logo.svg" alt="" width="36" height="36" />汇方职场 · HHBA</a>'
    +'<a class="hhba-seo-login" href="'+canonical('/candidate/login')+'">登录 / 注册</a></header>'
    +'<section class="hhba-seo-hero"><p class="hhba-seo-eyebrow">HHBA · HUMAN CAPABILITY NETWORK</p>'
    +'<h1>'+escapeHTML(page.heading)+'</h1><p class="hhba-seo-tagline">让机会与人才，找到彼此。</p>'
    +'<p class="hhba-seo-description">'+escapeHTML(page.body)+'</p>'
    +'<div class="hhba-seo-actions"><a class="hhba-seo-action hhba-seo-action-primary" href="'+canonical('/candidate/jobs')+'">浏览招聘岗位</a>'
    +'<a class="hhba-seo-action" href="'+canonical('/candidate/match')+'">智能匹配简历</a></div></section>'
    +'<h2 class="hhba-seo-section-title">探索汇方职场</h2>'
    +'<nav aria-label="汇方职场公开页面" class="hhba-seo-nav">'+navigation+'</nav>'
    +citiesLinks
    +(page.extraHtml ? '<div class="hhba-seo-details">'+page.extraHtml+'</div>' : '')
    +'<aside class="hhba-seo-recovery" role="status">完整网站暂时未加载成功，可能是网络或浏览器资源加载异常。'
    +'<a href="'+escapeHTML(url)+'">点此重新打开完整页面</a>。若仍无法恢复，请尝试切换网络。</aside>'
    +'<footer class="hhba-seo-footer">汇方职场 HHBA · 让机会与人才，找到彼此。</footer></main>';
  // A verified failed JS/CSS asset gets one automatic retry per tab/path.
  // If it still fails, keep the real, usable static navigation and explain it.
  // Slow connections are never reloaded by a timer, so progress is not lost.
  const recoveryScript='<script>(function(){'
    +'function mark(status){var el=document.getElementById("hhba-seo-entry");if(el)el.setAttribute("data-boot",status)}'
    +'function assetFailed(){if(!document.getElementById("hhba-seo-entry"))return;'
    +'try{var key="hhba:asset-retry:v1:"+location.pathname;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,"1");location.reload();return}}catch(e){}mark("failed")}'
    +'window.addEventListener("error",function(e){var t=e.target;if(!t||!t.tagName)return;'
    +'var src=t.src||t.href||"";if((t.tagName==="SCRIPT"||t.tagName==="LINK")&&src.indexOf("/assets/")!==-1)assetFailed()},true);'
    +'setTimeout(function(){if(document.getElementById("hhba-seo-entry"))mark("slow")},12000)'
    +'})();</script>';
  html=setTag(html,/<div id="root"><\/div>/,'<div id="root">'+fallbackStyle+fallback+recoveryScript+'</div>','root');
  return html;
}
for (const page of pages){
  const target=targetFor(page.path);
  if(page.path.startsWith('/companies/autumn/')){
    assert(existsSync(target),'Missing approved company deep link '+target);
  }
  mkdirSync(resolve(target,'..'),{recursive:true});
  writeFileSync(target,publicHTML(page));
}
// Existing client-only matching flow must never appear as a publicly indexable page.
const privateMatch=join(dist,'candidate/match/index.html');
if(existsSync(privateMatch)){
  const original=readFileSync(privateMatch,'utf8');
  writeFileSync(privateMatch, original.replace('</head>','<meta name="robots" content="noindex,nofollow" /></head>'));
}
const urlEntries=pages.map(page=>{
  const lastmod=page.lastmod?'<lastmod>'+escapeHTML(page.lastmod)+'</lastmod>':'';
  return '  <url><loc>'+escapeHTML(canonical(page.path))+'</loc>'+lastmod+'</url>';
});
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n'
  +'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  +urlEntries.join('\n')+'\n</urlset>\n';
writeFileSync(join(dist,'sitemap.xml'),sitemap);
for(const asset of ['robots.txt','_headers']){
  assert(existsSync(join(dist,asset)), 'Missing deployment SEO asset: '+asset);
}
assert(readFileSync(join(dist,'robots.txt'),'utf8').includes('https://hhba.work/sitemap.xml'));
assert(!sitemap.includes('/candidate/match'));
const releaseSha=process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || '';
if(releaseSha){
  assert(/^[a-f0-9]{40}$/.test(releaseSha), 'Expected exact deployment git commit');
  writeFileSync(join(dist,'seo-release.json'),JSON.stringify({sha:releaseSha,site:ORIGIN,publicUrlCount:pages.length})+'\n');
}
console.log('HHBA_PUBLIC_SEARCH_INDEX_READY',JSON.stringify({pages:pages.length,companies:companyCount,cities:cities.length,sitemap:'https://hhba.work/sitemap.xml'}));
