import { useEffect, useRef, useState } from 'react';
import { Activity, Award, ChevronLeft, Clock3, Send, UsersRound, X } from 'lucide-react';
import '../styles/home-live-drawer.css';

type BeijingNow = { day: string; minute: number; hour: number };
type PreviewMetrics = { heat: number; offers: number; active: number; applications: number; day: string };

const CURVE: readonly [number, number][] = [
  [0, 152000], [120, 122000], [240, 108000], [360, 138000],
  [480, 242000], [600, 355000], [720, 309000], [840, 414000],
  [960, 462000], [1080, 423000], [1200, 373000], [1320, 258000], [1440, 152000]
];

const random = (low: number, high: number) => low + Math.floor(Math.random() * (high - low + 1));
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const show = (n: number) => n.toLocaleString('en-US');

function beijing(): BeijingNow {
  const tokens = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (key: string) => tokens.find(t => t.type === key)?.value || '00';
  const hour = Number(get('hour')) % 24;
  return {
    hour,
    minute: hour * 60 + Number(get('minute')),
    day: [get('year'), get('month'), get('day')].join('-')
  };
}

function heatBase(minute: number) {
  for (let i = 0; i < CURVE.length - 1; i++) {
    const [start, from] = CURVE[i];
    const [end, to] = CURVE[i + 1];
    if (minute <= end) {
      const t = clamp((minute - start) / (end - start), 0, 1);
      const eased = t * t * (3 - 2 * t);
      return Math.round(from + (to - from) * eased);
    }
  }
  return 152000;
}

function partOfDay(hour: number) {
  if (hour < 6) return '凌晨低峰';
  if (hour < 9) return '清晨回升';
  if (hour < 12) return '上午活跃';
  if (hour < 14) return '午间时段';
  if (hour < 18) return '午后高峰';
  if (hour < 22) return '晚间活跃';
  return '夜间回落';
}

function initialMetrics(): PreviewMetrics {
  const c = beijing();
  let previous: Partial<PreviewMetrics> = {};
  try { previous = JSON.parse(window.sessionStorage.getItem('hhba-home-drawer-design-preview') || '{}'); } catch { /* Fresh review session. */ }
  return {
    heat: clamp(heatBase(c.minute) + random(-7000, 7000), 100000, 499999),
    offers: Math.max(random(18520, 18780), previous.offers || 0),
    active: previous.day === c.day ? Math.max(Math.floor(c.minute / 1440 * 13500) + random(110, 360), previous.active || 0) : random(0, 12),
    applications: Math.max(random(325000, 329000), previous.applications || 0),
    day: c.day
  };
}

/** Strictly a review-only visual data source; none of these numbers are
 *  actual users, applications or successful offers. Wire event-backed
 *  analytics before any claim of real platform activity can be published.
 */
function usePreviewMetrics() {
  const [metrics, setMetrics] = useState<PreviewMetrics>(initialMetrics);
  useEffect(() => {
    let mounted = true;
    const timers = new Set<number>();
    const loop = (fn: () => void, minMs: number, maxMs: number) => {
      const schedule = () => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          if (!mounted) return;
          fn();
          schedule();
        }, random(minMs, maxMs));
        timers.add(timer);
      };
      schedule();
    };

    loop(() => {
      const c = beijing();
      setMetrics(prev => {
        const base = heatBase(c.minute);
        const drift = (base - prev.heat) * (0.025 + Math.random() * 0.06);
        // Bounded, variable random walk instead of predictable periodic steps.
        const noise = (Math.random() + Math.random() - 1) * random(550, 2700);
        const impulse = Math.random() < 0.04 ? random(-4300, 4300) : 0;
        return { ...prev, heat: clamp(Math.round(prev.heat + drift + noise + impulse),
          Math.max(100000, base - 33000), Math.min(499999, base + 33000)) };
      });
    }, 240, 830);

    loop(() => {
      const c = beijing();
      setMetrics(prev => ({
        ...prev,
        day: c.day,
        active: c.day === prev.day ? prev.active + random(1, 9) : random(0, 4)
      }));
    }, 750, 2600);

    loop(() => setMetrics(prev => ({ ...prev, applications: prev.applications + random(1, 14) })),
      550, 2100);

    loop(() => setMetrics(prev => ({ ...prev, offers: prev.offers + random(1, 2) })),
      18000, 49000);

    return () => { mounted = false; timers.forEach(timer => window.clearTimeout(timer)); };
  }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem('hhba-home-drawer-design-preview', JSON.stringify({
      day: metrics.day, offers: metrics.offers, active: metrics.active,
      applications: metrics.applications
    })); } catch { /* Storage is optional. */ }
  }, [metrics.day, metrics.offers, metrics.active, metrics.applications]);
  return metrics;
}

export function HomeLiveDrawer() {
  const stats = usePreviewMetrics();
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(() => beijing().hour);
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
    const timer = window.setInterval(() => setHour(beijing().hour), 60000);
    return () => window.clearInterval(timer);
  }, []);
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
    <section id="hhba-home-stats-drawer" className="hhba-stats-slideout" aria-label="HHBA 平台动态设计预览"
      aria-hidden={!open} inert={!open}>
      <div className="hhba-slideout-heading">
        <div><span className="hhba-slideout-eyebrow">HHBA · HUMAN CAPABILITY NETWORK</span>
          <h2>机会正在发生</h2></div>
        <button type="button" className="hhba-slideout-close" aria-label="关闭平台动态"
          onClick={() => setOpen(false)}><X size={16}/></button>
      </div>
      <div className="hhba-drawer-primary">
        <div className="hhba-primary-label"><Activity size={16}/><span>当前求职热度</span>
          <span className="hhba-primary-live"><i/>LIVE</span></div>
        <strong className="hhba-primary-number" aria-label={'当前求职热度指数 '+show(stats.heat)}>
          {show(stats.heat)}</strong>
        <span className="hhba-primary-context"><Clock3 size={12}/> 北京时间 · {partOfDay(hour)}</span>
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
