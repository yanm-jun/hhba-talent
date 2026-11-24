import {useEffect,useId,useRef,useState} from 'react';
import {Bookmark,BriefcaseBusiness,ChevronDown,ChevronRight,ClipboardList,FileUser,LayoutDashboard,Scale,Search,Settings,UserRound} from 'lucide-react';
import {Link} from '../router';
import '../styles/candidate-account-dropdown.css';

// The personal center is a navigation disclosure, not a separate candidate account system.
// Quick links expose active services; account settings opens the existing profile workspace.
export const CANDIDATE_ACCOUNT_LINKS=[
 {label:'工作台',path:'/candidate/account',Icon:LayoutDashboard},
 {label:'智能岗位匹配',path:'/candidate/match',Icon:Search},
 {label:'我的简历',path:'/candidate/account/resume',Icon:FileUser},
 {label:'我的收藏',path:'/candidate/saved',Icon:Bookmark},
 {label:'历史查找',path:'/candidate/account/applications',Icon:ClipboardList},
 {label:'职业成长档案',path:'/candidate/account/career',Icon:BriefcaseBusiness},
 {label:'劳动权益知识',path:'/candidate/account/legal-aid',Icon:Scale},
 {label:'账户设置',path:'/candidate/account/profile',Icon:Settings}
] as const;

export function CandidateAccountDropdown({displayName}:{displayName?:string}){
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
   aria-label={(displayName||'个人中心')+'账户导航'} aria-expanded={open} aria-controls={id}
   onClick={event=>setOpen(event.detail>0?!pointerWasOpen.current:true)}>
   <UserRound size={15} aria-hidden="true"/><span>{displayName||'个人中心'}</span><ChevronDown size={13} aria-hidden="true"/>
  </button>
  {open&&<div id={id} role="navigation" className="hhba-account-dropdown-panel" aria-label="个人中心快速导航">
    <div className="hhba-account-dropdown-links">
     {CANDIDATE_ACCOUNT_LINKS.map(({label,path,Icon})=><Link
       to={path} key={path} className="hhba-account-dropdown-item"
       onClick={()=>setOpen(false)}>
       <Icon size={16} strokeWidth={1.8} aria-hidden="true"/>
       <span className="hhba-account-dropdown-copy">
        <strong>{label}</strong>
       </span>
       <ChevronRight size={15} aria-hidden="true" className="hhba-account-dropdown-chevron"/>
      </Link>)}
    </div>
   </div>}
 </div>;
}
