import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,ArrowUpRight,BriefcaseBusiness,Sparkles,X} from 'lucide-react';
import {Link} from '../router';
import '../styles/winter-internship.css';

/**
 * Every normal homepage visit and reload starts with the campaign visible.
 * Legacy 'seen' / 'hide' browser keys are deliberately ignored. A direct
 * public-letter share remains its own explicit destination, not a homepage ad.
 */
function showOnHomeVisit(){
 return new URLSearchParams(window.location.search).get('letter')!=='1';
}
export function WinterInternshipPopup(){
 const [open,setOpen]=useState(showOnHomeVisit);
 const dialogRef=useRef<HTMLDivElement>(null);
 const close=useCallback(()=>setOpen(false),[]);
 useEffect(()=>{
  if(!open)return;
  const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const dialog=dialogRef.current;
  dialog?.querySelector<HTMLElement>('[data-winter-close]')?.focus();
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close();return;}
   if(event.key!=='Tab')return;
   const elements=[...(dialog?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')||[])];
   if(!elements.length)return;
   const first=elements[0],last=elements[elements.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',onKey);previouslyFocused?.focus();};
 },[open,close]);
 if(!open)return null;
 return createPortal(
  <div className="hhba-winter-modal-overlay" data-hhba-winter-modal="2027"
     onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
   <div className="hhba-winter-modal" role="dialog" aria-modal="true" aria-labelledby="hhba-winter-modal-title" ref={dialogRef}>
    <button type="button" className="hhba-winter-modal-close" data-winter-close aria-label="关闭寒假实习广告" onClick={close}><X size={21}/></button>
    <div className="hhba-winter-modal-copy">
     <div className="hhba-winter-brand"><span className="hhba-winter-brand-dot">HHBA.</span><span>2027 WINTER INTERNSHIP</span></div>
     <div className="hhba-winter-year"><Sparkles size={18}/> 2027 寒假专场</div>
     <h2 id="hhba-winter-modal-title">寒假实习季<span>抢先一步</span></h2>
     <p className="hhba-winter-modal-subtitle">这个寒假，提前遇见未来。</p>
     <p className="hhba-winter-modal-description">从第一份真实实习开始，走进职场，探索自己的可能。</p>
     <div className="hhba-winter-modal-highlights"><span><BriefcaseBusiness size={15}/> 官方项目</span><span>多元行业</span><span>成长从此刻开始</span></div>
     <Link to="/winter-internship" className="hhba-winter-join" onClick={close}>立即参加 <ArrowRight size={22}/></Link>
     <p className="hhba-winter-modal-footnote">企业项目与申请入口来自官方公开资料 · 实际名额请以官网为准</p>
    </div>
    <div className="hhba-winter-modal-visual" aria-hidden="true">
      <img src={import.meta.env.BASE_URL+'images/hhba-join-team.webp'} alt="" width="900" height="600"/>
      <span className="hhba-winter-sun"/>
      <div className="hhba-winter-visual-note"><Sparkles size={17}/><strong>未来可期</strong><span>GO BEYOND 2027</span></div>
      <span className="hhba-winter-visual-credit">主题宣传视觉 · 人物仅作示意</span>
    </div>
    <Link className="hhba-winter-modal-secondary" to="/winter-internship" onClick={close}>了解寒假实习专题 <ArrowUpRight size={16}/></Link>
   </div>
  </div>,document.body);
}
