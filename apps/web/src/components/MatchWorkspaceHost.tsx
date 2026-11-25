import {createContext,Suspense,useContext,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

const WorkspaceContainer=createContext<HTMLDivElement|null>(null);
export const isMatchWorkspaceRoute=(route:string)=>route==='/candidate/match'||route==='/candidate/account/match';

// The portal container identity never changes during an authenticated session.
// Moving its DOM node does not unmount its React tree or cancel the request.
// When away from both match pages, detach the form; the existing body portal
// (task dock/result dialog) remains mounted and interactive.
export function MatchWorkspaceHost({route,workspace,children,fallback=null}:{route:string;workspace:ReactNode;children:ReactNode;fallback?:ReactNode}){
 const [container]=useState(()=>{const node=document.createElement('div');node.className='hhba-match-workspace-host';return node;});
 const [visited,setVisited]=useState(()=>isMatchWorkspaceRoute(route));
 const active=isMatchWorkspaceRoute(route);
 useLayoutEffect(()=>{if(active)setVisited(true);},[active]);
 return <WorkspaceContainer.Provider value={container}>
  {children}
  {(visited||active)&&createPortal(<Suspense fallback={fallback}>{workspace}</Suspense>,container)}
 </WorkspaceContainer.Provider>;
}
export function MatchWorkspaceSlot(){
 const container=useContext(WorkspaceContainer);
 const slot=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const node=slot.current;
  if(!node||!container)return;
  node.appendChild(container);
  return()=>{if(container.parentNode===node)container.remove();};
 },[container]);
 return <div ref={slot} className="hhba-match-workspace-slot"/>;
}
