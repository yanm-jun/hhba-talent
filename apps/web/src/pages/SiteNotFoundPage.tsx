import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';

/** Neutral 404 view for in-app navigation; Pages Functions own HTTP 404 for direct requests. */
export function SiteNotFoundPage({user}:{user:User|null}){
 return <Shell user={user}>
  <main role="main" style={{maxWidth:560,margin:'90px auto',padding:'32px 24px',textAlign:'center'}}>
   <p style={{color:'#6e8aa9',fontWeight:800,letterSpacing:'.15em',fontSize:12}}>404</p>
   <h1 style={{color:'#1f4167',fontSize:28,margin:'12px 0'}}>页面不存在</h1>
   <p style={{color:'#7589a0',fontSize:13,lineHeight:1.9}}>你访问的地址不存在，或者已经无法使用。</p>
   <Link to="/" style={{color:'#286ab3',fontSize:13,fontWeight:700,textDecoration:'none'}}>返回首页</Link>
  </main>
 </Shell>;
}
