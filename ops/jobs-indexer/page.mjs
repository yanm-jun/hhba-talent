import {boards} from "./store.mjs";
const escape=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function home(){
 const companies=[...new Set(boards.map(x=>x.company))].sort();
 const options=companies.map(x=>'<option value="'+escape(x)+'">'+escape(x)+'</option>').join("");
 return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1"><title>HHBA · 招聘索引预发布</title>'+
 '<style>*{box-sizing:border-box}body{margin:0;background:#f5f7f5;color:#183729;font:15px system-ui,"PingFang SC",sans-serif}'+
 'header{background:#143f2c;color:#fff;padding:40px max(20px,calc((100vw - 1080px)/2))}h1{font-size:34px;margin:0 0 8px}header p{color:#c8e3d1}'+
 'main{max-width:1080px;margin:auto;padding:24px}form{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}input,select,button{font:inherit;border:1px solid #d6dfd9;border-radius:10px;padding:12px}input{flex:2;min-width:220px}select{flex:1;min-width:160px}button{background:#247248;color:#fff;cursor:pointer}.job{display:flex;gap:17px;align-items:flex-start;background:#fff;border:1px solid #e4ebe5;border-radius:14px;margin:12px 0;padding:20px}.logo{width:50px;height:50px;flex-shrink:0;background:#ebf4ee;border-radius:11px;display:grid;place-items:center;font-weight:800;color:#36634a}.logo img{width:38px;height:38px;object-fit:contain}.job-body{flex:1;min-width:0}.job a{text-decoration:none;font-size:18px;font-weight:700;color:#214c36}.company{margin-top:8px;font-weight:600}.meta{font-size:12px;color:#728076;margin-top:9px}.note{padding:15px;background:#fff8e9;border:1px solid #f3e6c6;border-radius:9px;line-height:1.6}small{color:#708076}#more{display:block;margin:20px auto}#more[hidden]{display:none}footer{padding:28px 0}'+
 '</style><script src="/app.js" defer></script></head><body>'+
 '<header><h1>HHBA · 全球招聘市场（预发布）</h1><p>来自企业官方公开 ATS 数据接口的具体职位 · 可搜索 · 直达官方投递</p></header>'+
 '<main><div class="note">此页面是新版海外招聘索引服务的独立测试地址，不是现有 HHBA 主站。原有国内小米等岗位仍在旧服务中。历史缓存不能当作当前招聘，申请状态以企业官方页面为准。</div>'+
 '<form id="filters"><input id="q" placeholder="搜索职位、公司、城市" aria-label="关键词">'+
 '<select id="company" aria-label="企业"><option value="">全部企业</option>'+options+'</select>'+
 '<select id="remote" aria-label="远程筛选"><option value="">全部工作方式</option><option value="true">仅远程</option></select>'+
 '<button type="submit">搜索岗位</button></form>'+
 '<p id="summary">正在核验公开招聘来源…</p><div id="jobs"></div><button id="more" type="button" hidden>查看更多岗位</button>'+
 '<footer><small>HHBA 非招聘企业官方平台，亦不代表与这些企业存在合作关系。部分企业的招聘网站在某些网络环境下可能无法访问。</small></footer></main></body></html>';
}
