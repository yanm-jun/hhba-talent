import '../styles/hhba-brand.css';

/** Always load the exact user-provided SVG, from the active Vite/GitHub Pages base path. */
export const hhbaLogoUrl=`${import.meta.env.BASE_URL}images/hhba-logo.svg`;
export function BrandMark({variant='lockup',size='nav',className=''}:{
  variant?:'lockup'|'icon'|'signature';size?:'nav'|'hero'|'small'|'large';className?:string;
}) {
 return <span className={['hhba-brand-mark','hhba-brand-'+variant,'hhba-brand-'+size,className].filter(Boolean).join(' ')}>
  <img src={hhbaLogoUrl} alt={variant==='icon'?'HHBA 品牌标志':''} width={64} height={64} decoding="async"/>
  {variant!=='icon'&&<span className="hhba-brand-text"><strong>HHBA<span className="hhba-brand-dot">.</span></strong>{variant==='signature'&&<small>让劳动更有尊严，让商业更有温度</small>}</span>}
 </span>;
}
