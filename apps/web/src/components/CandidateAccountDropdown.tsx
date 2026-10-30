import {useEffect,useId,useRef,useState} from 'react';
import {Bookmark,ChevronDown,ChevronRight,ClipboardList,FileUser,LayoutDashboard,Scale,SlidersHorizontal,UserRound} from 'lucide-react';
import {Link} from '../router';
import '../styles/candidate-account-dropdown.css';

// The personal center is a navigation disclosure, not a separate candidate account system.
// Every existing path remains unchanged; legal aid is a clearly labeled, non-collecting placeholder.
export const CANDIDATE_ACCOUNT_LINKS=[
 {label:'工作台',path:'/candidate/account',Icon:LayoutDashboard},
 {label:'我的收藏',path:'/candidate/saved',Icon:Bookmark},
 {label:'个人资料',path:'/candidate/account/profile',Icon:UserRound},
 {label:'求职偏好',path:'/candidate/account/preferences',Icon:SlidersHorizontal},
 {label:'我的简历',path:'/candidate/account/resume',Icon:FileUser},
 {label:'求职记录',path:'/candidate/account/applications',Icon:ClipboardList},
 {label:'法律援助',path:'/candidate/account/legal-aid',Icon:Scale,description:'法律服务筹备中'}
] as const;

export function CandidateAccountDropdown(){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 // Snapshot state before a touch/pointer focuses the trigger; focusing can open the menu.
 const pointerWasOpen=useRef(false);
 const id=useId();
 useEffect(()=>{
  if(!open)return;
  function outside(event:PointerEvent){
   if(event.target instanceof Node && !root.current?.contains(event.target))setOpen(false);
  }
  function escape(event:KeyboardEvent){
   if(event.key==='Escape'){
    setOpen(false);
    if(root.current?.contains(document.activeElement))trigger.current?.focus();
   }
  }
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return ()=>{
   document.removeEventListener('pointerdown',outside);
   document.removeEventListener('keydown',escape);
  };
 },[open]);
 return <div ref={root} className="hhba-account-dropdown"
  onPointerEnter={event=>{if(event.pointerType==='mouse')setOpen(true);}}
  onPointerLeave={event=>{if(event.pointerType==='mouse')setOpen(false);}}
  onPointerDownCapture={event=>{if(event.target===trigger.current)pointerWasOpen.current=open;}}
  onFocusCapture={()=>setOpen(true)}
  onBlurCapture={event=>{
   const next=event.relatedTarget;
   if(!(next instanceof Node)||!event.currentTarget.contains(next))setOpen(false);
  }}>
  <button ref={trigger} type="button" className="auth hhba-account-dropdown-trigger"
   aria-expanded={open} aria-controls={id}
   onClick={event=>setOpen(event.detail>0?!pointerWasOpen.current:true)}>
   <UserRound size={15} aria-hidden="true"/><span>个人中心</span><ChevronDown size={13} aria-hidden="true"/>
  </button>
  {open&&<div id={id} role="navigation" className="hhba-account-dropdown-panel" aria-label="个人中心快速导航">
    <div className="hhba-account-dropdown-links">
     {CANDIDATE_ACCOUNT_LINKS.map(({label,path,Icon,...rest})=><Link
       to={path} key={path} className="hhba-account-dropdown-item"
       onClick={()=>setOpen(false)}>
       <Icon size={16} strokeWidth={1.8} aria-hidden="true"/>
       <span className="hhba-account-dropdown-copy">
        <strong>{label}</strong>
        {'description' in rest&&<small>{rest.description}</small>}
       </span>
       <ChevronRight size={15} aria-hidden="true" className="hhba-account-dropdown-chevron"/>
      </Link>)}
    </div>
    <p className="hhba-account-dropdown-footnote">法律援助尚未开放材料提交，切勿上传个人敏感证据。</p>
   </div>}
 </div>;
}
