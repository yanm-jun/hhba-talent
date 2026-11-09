import { useEffect, useState } from 'react';
import { Activity, Award, Clock3, Send, UsersRound } from 'lucide-react';
import '../styles/home-ambient-stats.css';

type Clock = { minute: number; day: string; hour: number };
type Snapshot = {
  heat: number;
  offers: number;
  activeToday: number;
  totalApplications: number;
  day: string;
  bars: number[];
};

const HEAT_CURVE: readonly [number, number][] = [
  [0, 149000], [120, 117000], [240, 108000], [360, 133000],
  [480, 243000], [600, 356000], [720, 310000], [840, 410000],
  [960, 468000], [1080, 427000], [1200, 371000], [1320, 263000],
  [1440, 149000],
];
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const rand = (low: number, high: number) => low + Math.floor(Math.random() * (high - low + 1));
const formatted = (value: number) => value.toLocaleString('en-US');

function chinaClock(): Clock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const value = (key: string) => parts.find(item => item.type === key)?.value ?? '00';
  const hour = Number(value('hour')) % 24;
  return { minute: hour * 60 + Number(value('minute')),
    hour, day: [value('year'), value('month'), value('day')].join('-') };
}

function heatTarget(minute: number): number {
  for (let i = 0; i < HEAT_CURVE.length - 1; i++) {
    const [start, from] = HEAT_CURVE[i];
    const [end, to] = HEAT_CURVE[i + 1];
    if (minute >= start && minute <= end) {
      const t = (minute - start) / (end - start);
      // Continuous transitions rather than abrupt jumps at hourly boundaries.
      const smooth = t * t * (3 - 2 * t);
      return Math.round(from + (to - from) * smooth);
    }
  }
  return 149000;
}

function period(hour: number): string {
  if (hour < 6) return '深夜时段';
  if (hour < 9) return '清晨时段';
  if (hour < 12) return '上午活跃';
  if (hour < 14) return '午间时段';
  if (hour < 18) return '下午活跃';
  if (hour < 22) return '晚间时段';
  return '夜间时段';
}

function initialSnapshot(): Snapshot {
  const clock = chinaClock();
  const heat = clamp(heatTarget(clock.minute) + rand(-11500, 11500), 100000, 499999);
  return {
    heat,
    offers: rand(18340, 18860),
    activeToday: clamp(Math.round(550 + (clock.minute / 1440) * 14000 + rand(-250, 250)), 0, 20000),
    totalApplications: rand(312000, 327000),
    day: clock.day,
    bars: Array.from({ length: 19 }, () => rand(23, 86)),
  };
}

function nextSnapshot(previous: Snapshot): Snapshot {
  const now = chinaClock();
  const target = heatTarget(now.minute);
  // Independent random magnitudes + a light mean-reverting force prevent
  // obvious arithmetic progressions while keeping the trend time-aware.
  const noise = Math.round((Math.random() + Math.random() + Math.random() - 1.5) * rand(3900, 11400));
  const surprise = Math.random() < 0.07 ? rand(-7400, 7400) : 0;
  let heat = Math.round(previous.heat + (target - previous.heat) * (0.07 + Math.random() * 0.11) + noise + surprise);
  heat = clamp(heat, Math.max(100000, target - 41000), Math.min(499999, target + 41000));
  // Cumulative-style counters only rise; daily counter resets on the Beijing date.
  const newDay = now.day !== previous.day;
  return {
    ...previous,
    heat,
    offers: previous.offers + (Math.random() < 0.38 ? rand(1, 3) : 0),
    activeToday: (newDay ? 0 : previous.activeToday) + (Math.random() < 0.18 ? 0 : rand(1, 14)),
    totalApplications: previous.totalApplications + (Math.random() < 0.13 ? 0 : rand(2, 23)),
    day: now.day,
    bars: [...previous.bars.slice(1), clamp(Math.round(38 + (heat - target) / 1450 + rand(-17, 30)), 19, 94)],
  };
}

/**
 * Visual review only. These synthetic numbers are NOT platform usage,
 * applications or verified Offer results. Production must use audited events.
 */
export function HomeAmbientStats() {
  const [stats, setStats] = useState<Snapshot>(initialSnapshot);
  const [hour, setHour] = useState(() => chinaClock().hour);
  useEffect(() => {
    let id: number | undefined;
    let active = true;
    const tick = () => {
      if (!active) return;
      setStats(current => nextSnapshot(current));
      setHour(chinaClock().hour);
      id = window.setTimeout(tick, rand(2600, 9200));
    };
    id = window.setTimeout(tick, rand(1800, 4100));
    return () => { active = false; window.clearTimeout(id); };
  }, []);
  return <div className="hhba-home-ambient" aria-label="HHBA 首页数据展示设计预览">
    <aside className="hhba-home-ambient-left">
      <div className="hhba-stats-caption"><span className="hhba-live-pulse" aria-hidden="true"/> HHBA · 机会探索</div>
      <h2><Activity size={18} aria-hidden="true"/> 当前求职热度</h2>
      <strong className="hhba-home-heat-number" aria-label={'求职热度指数 '+formatted(stats.heat)}>{formatted(stats.heat)}</strong>
      <div className="hhba-home-heat-bars" aria-hidden="true">
        {stats.bars.map((bar, index) => <i key={index} style={{height:bar + '%'}}/>)}
      </div>
      <div className="hhba-stats-period"><Clock3 size={13}/><span>北京时间 · {period(hour)}</span></div>
      <p className="hhba-stats-disclosure">设计预览数据 · 不代表真实在线人数</p>
    </aside>
    <aside className="hhba-home-ambient-right">
      <div className="hhba-stats-caption">HHBA · 成长足迹</div>
      <div className="hhba-home-mini-stat">
        <span className="hhba-mini-icon"><Award size={18}/></span>
        <div><p>已获得 Offer 人数</p><strong>{formatted(stats.offers)}</strong></div>
      </div>
      <div className="hhba-home-mini-stat">
        <span className="hhba-mini-icon"><UsersRound size={18}/></span>
        <div><p>今日活跃投递人数</p><strong>{formatted(stats.activeToday)}</strong></div>
      </div>
      <div className="hhba-home-mini-stat">
        <span className="hhba-mini-icon"><Send size={18}/></span>
        <div><p>累计投递次数</p><strong>{formatted(stats.totalApplications)}</strong></div>
      </div>
      <p className="hhba-stats-disclosure">设计预览数据 · 非真实平台业绩</p>
    </aside>
  </div>;
}
