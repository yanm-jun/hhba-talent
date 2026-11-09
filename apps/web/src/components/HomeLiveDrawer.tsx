import { useEffect, useRef, useState } from 'react';
import { Activity, Award, ChevronLeft, Clock3, Send, UsersRound, X } from 'lucide-react';
import { previewMetricsAt } from './homeLiveMetricsPreview';
import '../styles/home-live-drawer.css';

const show = (value: number): string => value.toLocaleString('en-US');

function usePreviewMetrics() {
  const [metrics,setMetrics]=useState(()=>previewMetricsAt(Date.now()));
  useEffect(()=>{
    let timer:number|undefined;
    let active=true;
    const tick=()=>{
      if(!active)return;
      setMetrics(previewMetricsAt(Date.now()));
      timer=window.setTimeout(tick,260+Math.floor(Math.random()*630));
    };
    timer=window.setTimeout(tick,290);
    return ()=>{active=false;window.clearTimeout(timer);};
  },[]);
  return metrics;
}

export function HomeLiveDrawer() {
  const stats = usePreviewMetrics();
  const [open, setOpen] = useState(false);
  const closeDelay = useRef<number | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const cancelClose = () => {
    if (closeDelay.current !== null) window.clearTimeout(closeDelay.current);
    closeDelay.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeDelay.current = window.setTimeout(() => setOpen(false), 230);
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !drawerRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => () => { if (closeDelay.current !== null) window.clearTimeout(closeDelay.current); }, []);

  return <div className={'hhba-hover-rail'+(open ? ' is-open' : '')}
    ref={drawerRef}
    onMouseEnter={() => { cancelClose(); setOpen(true); }}
    onMouseLeave={scheduleClose}
    onFocusCapture={() => { cancelClose(); setOpen(true); }}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
    }}>
    <button type="button" className="hhba-rail-trigger" aria-expanded={open}
      aria-controls="hhba-home-stats-drawer" aria-label={open ? '收起平台动态' : '展开平台动态'}
      onClick={() => { cancelClose(); setOpen(true); }}>
      <span className="hhba-rail-dot" aria-hidden="true"/>
      <span className="hhba-rail-title">平台动态</span>
      <ChevronLeft size={15} className="hhba-rail-arrow" aria-hidden="true"/>
    </button>
    <section id="hhba-home-stats-drawer" className="hhba-stats-slideout" aria-label="汇方职场 HHBA 平台动态设计预览"
      aria-hidden={!open} inert={!open}>
      <div className="hhba-slideout-heading">
        <div><span className="hhba-slideout-eyebrow">HHBA · HUMAN CAPABILITY NETWORK · 汇方职场</span>
          <h2>机会正在发生</h2></div>
        <button type="button" className="hhba-slideout-close" aria-label="关闭平台动态"
          onClick={() => setOpen(false)}><X size={16}/></button>
      </div>
      <div className="hhba-drawer-primary">
        <div className="hhba-primary-label"><Activity size={16}/><span>当前求职热度</span>
          <span className="hhba-primary-live"><i/>LIVE</span></div>
        <strong className="hhba-primary-number" aria-label={'当前求职热度指数 '+show(stats.heat)}>
          {show(stats.heat)}</strong>
        <span className="hhba-primary-context"><Clock3 size={12}/> 北京时间 · {stats.period}</span>
      </div>
      <div className="hhba-drawer-secondary">
        <div className="hhba-drawer-metric">
          <span className="hhba-metric-symbol"><Award size={17}/></span>
          <span className="hhba-metric-copy">已获得 Offer 人数<strong>{show(stats.offers)}</strong></span>
        </div>
        <div className="hhba-drawer-metric">
          <span className="hhba-metric-symbol"><UsersRound size={17}/></span>
          <span className="hhba-metric-copy">今日活跃投递人数<strong>{show(stats.active)}</strong></span>
        </div>
        <div className="hhba-drawer-metric">
          <span className="hhba-metric-symbol"><Send size={17}/></span>
          <span className="hhba-metric-copy">累计投递次数<strong>{show(stats.applications)}</strong></span>
        </div>
      </div>
      <div className="hhba-stats-review-note">设计验收数据 · 不代表真实在线、投递或 Offer 成果</div>
    </section>
  </div>;
}
