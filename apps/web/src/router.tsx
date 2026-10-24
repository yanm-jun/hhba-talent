import { useEffect, useState } from 'react';

// GitHub Pages uses /hhba-talent/, while Railway keeps routes at /.
const prefix = import.meta.env.BASE_URL.replace(/\/$/,'');
const href = (to: string) => prefix + (to.startsWith('/') ? to : '/'+to);
function currentRoute() {
  const path = location.pathname;
  return prefix && path.startsWith(prefix + '/') ? path.slice(prefix.length) : (path === prefix ? '/' : path);
}

type MarketState={scope:'home'|'jobs';filters:Record<string,unknown>;draft:string;page:number};
type InternalNavigation={scrollY?:number;restoreMarketState?:MarketState};
type JobOrigin={to:string;scrollY:number;marketState?:MarketState};
const detailRoute=/^\/candidate\/jobs\/[A-Za-z0-9_-]{1,180}$/;
const companyRoute=/^\/companies\/(?:openai|anthropic|spacex|id\/[A-Za-z0-9_-]{12,600}|domestic\/(?:a-[0-9]{6}|cn-B1-[0-9]{3}|spot-[^/]{2,100}|rel-[a-z]+-[0-9]{3}|group-geely|profile-[a-z0-9-]{3,150}))$/;
const directoryRoute=/^\/companies$/;
const domesticDiscoveryRoute=/^\/companies\/discover$/;
const majorRoute=/^\/majors\/[a-z-]{3,80}$/;
function currentPathWithSearch(){return currentRoute()+location.search;}
function safeOrigin(to:unknown):to is string{
 if(typeof to!=='string'||to.length>700||!to.startsWith('/')||to.startsWith('//')||to.includes('\\'))return false;
 const path=to.split(/[?#]/,1)[0];
 return detailRoute.test(path)||companyRoute.test(path)||directoryRoute.test(path)||domesticDiscoveryRoute.test(path)||majorRoute.test(path)||path==='/'||path==='/candidate'||path==='/candidate/jobs'||path==='/candidate/match'||
   path==='/candidate/jobs/archive'||path==='/candidate/employer-jobs';
}
const safeScroll=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<10000000?value:0;
function saveScrollForCurrentEntry(){
 const previous=history.state&&typeof history.state==='object'?history.state:{};
 history.replaceState({...previous,hhbaScrollY:Math.max(0,window.scrollY||0)},'');
}
function restoreScrollOnNavigation(){
 const scrollY=safeScroll(history.state?.hhbaScrollY);
 // Route replacement happens in React; restore after the new page is committed.
 requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo(0,scrollY)));
}
export function navigate(to:string,options:InternalNavigation={}){
 const from=currentPathWithSearch();
 saveScrollForCurrentEntry();
 const source=history.state;
 const inheritedOrigin:JobOrigin|undefined=
   detailRoute.test(currentRoute())&&source?.hhbaJobOrigin&&safeOrigin(source.hhbaJobOrigin.to)
     ?source.hhbaJobOrigin:undefined;
 const restoredOrigin:JobOrigin|undefined=companyRoute.test(currentRoute())&&
   source?.hhbaCompanyOrigin?.to===to&&source?.hhbaReturnJobOrigin&&
   safeOrigin(source.hhbaReturnJobOrigin.to)?source.hhbaReturnJobOrigin:undefined;
 const jobOrigin=detailRoute.test(to.split('?',1)[0])
   ?restoredOrigin||inheritedOrigin||(safeOrigin(from)
     ?{to:from,scrollY:safeScroll(source?.hhbaScrollY),
       marketState:source?.hhbaMarketState}
     :undefined)
   :undefined;
 const state:Record<string,unknown>={hhbaScrollY:safeScroll(options.scrollY)};
 if(jobOrigin)state.hhbaJobOrigin=jobOrigin;
 if((companyRoute.test(to.split('?',1)[0])||majorRoute.test(to.split('?',1)[0]))&&safeOrigin(from)){
   state.hhbaCompanyOrigin={to:from,scrollY:safeScroll(source?.hhbaScrollY),
     marketState:source?.hhbaMarketState};
   if(detailRoute.test(currentRoute())&&source?.hhbaJobOrigin&&
     safeOrigin(source.hhbaJobOrigin.to))state.hhbaReturnJobOrigin=source.hhbaJobOrigin;
 }
 if(options.restoreMarketState)state.hhbaMarketState=options.restoreMarketState;
 history.pushState(state,'',href(to));
 dispatchEvent(new PopStateEvent('popstate',{state}));
}
export function getJobReturnTarget():JobOrigin{
 const origin=history.state?.hhbaJobOrigin;
 if(origin&&safeOrigin(origin.to)){
   return {to:origin.to,scrollY:safeScroll(origin.scrollY),
     marketState:origin.marketState};
 }
 return {to:'/candidate/jobs',scrollY:0};
}
export function getCompanyReturnTarget():JobOrigin{
 const origin=history.state?.hhbaCompanyOrigin;
 if(origin&&safeOrigin(origin.to))return {to:origin.to,
   scrollY:safeScroll(origin.scrollY),marketState:origin.marketState};
 return {to:'/candidate/jobs',scrollY:0};
}
export function useRoute(){
 const [route,setRoute]=useState(currentRoute);
 useEffect(()=>{
   const before=history.scrollRestoration;
   history.scrollRestoration='manual';
   const listener=()=>{setRoute(currentRoute());restoreScrollOnNavigation();};
   addEventListener('popstate',listener);
   return ()=>{removeEventListener('popstate',listener);history.scrollRestoration=before};
 },[]);
 return route;
}
export function useNavigate(){return navigate;}
export function Link({to,children,onClick,restoreScrollY,restoreMarketState,...props}:
 React.AnchorHTMLAttributes<HTMLAnchorElement>&{to:string;restoreScrollY?:number;restoreMarketState?:MarketState}){
 return <a href={href(to)} {...props} onClick={event=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.defaultPrevented)return;
   event.preventDefault();
   navigate(to,{scrollY:restoreScrollY,restoreMarketState});
   onClick?.(event);
 }}>{children}</a>;
}
