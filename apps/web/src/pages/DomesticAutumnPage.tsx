import {ArrowLeft} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {DomesticAutumnMarket} from '../components/DomesticAutumnMarket';
import type {User} from '../services/api';

/** Evidence-aware static directory based on the user's 2026-10-28 screenshots. */
export function DomesticAutumnPage({user}:{user:User|null}){
 return <Shell user={user}>
  <nav style={{maxWidth:1120,margin:'24px auto 0',padding:'0 16px'}}>
   <Link to="/candidate/jobs" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'#265e45',textDecoration:'none'}}>
     <ArrowLeft size={15}/> 返回国内外招聘市场
   </Link>
  </nav>
  <DomesticAutumnMarket standalone/>
 </Shell>;
}
