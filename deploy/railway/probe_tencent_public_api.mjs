// Public, read-only employer API probe. No browser fingerprints, credentials or anti-bot bypass.
const base="https://careers.tencent.com/tencentcareer/api/post/Query";
const variants=[
 {keyword:"",pageIndex:1,pageSize:10,language:"zh-cn",area:"cn"},
 {keyword:"",pageIndex:1,pageSize:10,language:"zh-cn"},
 {keyword:"产品",pageIndex:1,pageSize:10,language:"zh-cn",area:"cn"},
];
function flatten(value,prefix="",max=40){if(!value||typeof value!=="object")return [];return Object.entries(value).slice(0,max).map(([key,v])=>({field:prefix+key,type:Array.isArray(v)?"array":typeof v,example:typeof v==="string"?v.slice(0,100):typeof v==="number"?v:Array.isArray(v)?v.length:undefined}));}
for(let i=0;i<variants.length;i++){
 const u=new URL(base);for(const [k,v] of Object.entries(variants[i]))u.searchParams.set(k,String(v));
 try{
  const response=await fetch(u,{signal:AbortSignal.timeout(16000),headers:{Accept:"application/json", "User-Agent":"HHBAOfficialJobBoardReader/0.1 (+read-only; source=careers.tencent.com)"}});
  const body=await response.text();let data=null;
  try{data=JSON.parse(body)}catch{}
  const posts=data?.Data?.Posts||data?.data?.posts||data?.Data?.PostList||[];
  const first=Array.isArray(posts)?posts[0]:null;
  console.log("HHBA_TENCENT_PUBLIC_PROBE",JSON.stringify({variant:i,status:response.status,contentType:response.headers.get("content-type"),bytes:body.length,apiKeys:flatten(data),dataKeys:flatten(data?.Data||data?.data),posts:Array.isArray(posts)?posts.length:null,postKeys:flatten(first),firstTitle:first?.RecruitPostName||first?.Title||null,firstId:first?.PostId||first?.RecruitPostId||null,error:body.length<900?body.slice(0,500):null}));
 }catch(e){console.log("HHBA_TENCENT_PUBLIC_PROBE_ERROR",JSON.stringify({variant:i,error:String(e.message||e).slice(0,140)}));}
 if(i<variants.length-1)await new Promise(r=>setTimeout(r,1100));
}
