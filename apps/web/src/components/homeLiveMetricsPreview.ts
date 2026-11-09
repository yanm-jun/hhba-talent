/**
 * HHBA homepage visual-design preview model (not operational analytics).
 * All four values are illustrative. 2026/2027 China holiday overrides follow
 * the State Council holiday schedules; later years fall back to weekdays.
 * Offer and application claims must use verified events before production use.
 */
export type BeijingParts = {
  day: string; month: number; hour: number; minute: number; second: number;
};
export type LivePreviewMetrics = {
  heat: number; offers: number; active: number; applications: number;
  hour: number; day: string; period: string;
};

export const PREVIEW_ANCHOR_MS = Date.parse('2026-11-09T15:00:00+08:00');
export const PREVIEW_START = Object.freeze({
  heat: 368527, offers: 28651, active: 12846, applications: 486329
});

type DateMode = 'workday' | 'weekend' | 'holiday';
const holidayPeriods: ReadonlyArray<readonly [string, string]> = [
  ['2026-01-01','2026-01-03'],['2026-02-15','2026-02-23'],
  ['2026-04-04','2026-04-06'],['2026-05-01','2026-05-05'],
  ['2026-06-19','2026-06-21'],['2026-09-25','2026-09-27'],
  ['2026-10-01','2026-10-07'],
  ['2027-01-01','2027-01-03'],['2027-02-05','2027-02-13'],
  ['2027-04-03','2027-04-05'],['2027-05-01','2027-05-05'],
  ['2027-06-09','2027-06-09'],['2027-09-15','2027-09-15'],
  ['2027-10-01','2027-10-07']
];
const adjustedWorkdays = new Set([
  '2026-01-04','2026-02-14','2026-02-28','2026-05-09',
  '2026-09-20','2026-10-10',
  '2027-01-31','2027-02-14','2027-05-08',
  '2027-09-26','2027-10-09'
]);
const seasonalWeight = [
  0.84,0.83,1.12,1.08,1.03,1.08,0.99,1.09,1.20,1.21,1.15,0.92
] as const;

const clamp = (n:number, low:number, high:number) => Math.min(high, Math.max(low,n));
const dayMs = 86400000;
function asDayNumber(day:string):number { return Math.floor(Date.parse(day+'T00:00:00Z')/dayMs); }
function asDayString(index:number):string { return new Date(index*dayMs).toISOString().slice(0,10); }
const baseDayNumber=asDayNumber('2026-11-09');

export function beijingParts(epochMs:number):BeijingParts {
  const parts = new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Shanghai', year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(epochMs));
  const part = (kind:string) => parts.find(x=>x.type===kind)?.value||'00';
  const hour=Number(part('hour'))%24;
  return {
    day:[part('year'),part('month'),part('day')].join('-'),
    month:Number(part('month')), hour, minute:Number(part('minute')),second:Number(part('second'))
  };
}
export function chineseDateMode(day:string):DateMode {
  if(adjustedWorkdays.has(day)) return 'workday';
  if(holidayPeriods.some(([start,end])=>day>=start&&day<=end)) return 'holiday';
  const weekDay=new Date(day+'T12:00:00Z').getUTCDay();
  return (weekDay===0||weekDay===6)?'weekend':'workday';
}
function hash(n:number,salt:number):number {
  const x=Math.sin((n+salt*31.57)*127.131)*43758.5453123;
  return (x-Math.floor(x))*2-1;
}
function smoothNoise(x:number,salt:number):number {
  const base=Math.floor(x), t=x-base;
  const ease=t*t*(3-2*t);
  return hash(base,salt)*(1-ease)+hash(base+1,salt)*ease;
}
const workdayPoints:ReadonlyArray<readonly [number,number]>=[
  [0,.20],[2,.08],[4,.05],[6,.10],[8,.47],[10,.78],
  [12,.69],[14,.92],[16,1],[18,.76],[20,.80],[22,.52],[24,.20]
];
const nonWorkPoints:ReadonlyArray<readonly [number,number]>=[
  [0,.29],[2,.13],[4,.06],[6,.08],[8,.20],[10,.43],
  [12,.68],[14,.77],[16,.84],[18,.83],[20,.89],[22,.73],[24,.29]
];
function easedCurve(t:number, points:ReadonlyArray<readonly [number,number]>):number {
  for(let i=0;i<points.length-1;i++){
    const [left,from]=points[i],[right,to]=points[i+1];
    if(t<=right){
      const u=clamp((t-left)/(right-left),0,1);
      const smooth=u*u*(3-2*u);
      return from+(to-from)*smooth;
    }
  }
  return points[points.length-1][1];
}
function activity(epochMs:number):number {
  const clock=beijingParts(epochMs);
  const mode=chineseDateMode(clock.day);
  const hour=clock.hour+clock.minute/60+clock.second/3600;
  const base=easedCurve(hour,mode==='workday'?workdayPoints:nonWorkPoints);
  const monthly=seasonalWeight[clock.month-1];
  const schedule=mode==='holiday'?0.73:mode==='weekend'?0.88:1;
  return base*monthly*schedule;
}
function baseHeat(ms:number):number {
  return 103000+278000*activity(ms);
}
function baseActive(ms:number):number {
  return 2200+11800*activity(ms);
}
function heatNoise(ms:number):number {
  return 1400*smoothNoise(ms/890,11)+1200*smoothNoise(ms/4600,32)+
    1900*smoothNoise(ms/26000,43);
}
function activeNoise(ms:number):number {
  return 95*smoothNoise(ms/2200,21)+145*smoothNoise(ms/14500,27);
}

// Fixed hourly density makes daily cumulative totals monotonic and avoids
// sudden midnight/day-change resets or a 'same increment each second' pattern.
const normalHourlyWeights=[1,1,1,1,1,2,3,5,8,11,13,12,10,12,14,15,14,12,10,10,11,10,6,3];
const weekendHourlyWeights=[2,2,1,1,1,1,2,3,5,7,9,11,12,14,15,15,16,17,16,18,19,16,10,5];
function dayShare(parts:BeijingParts, mode:DateMode):number {
  const weights=mode==='workday'?normalHourlyWeights:weekendHourlyWeights;
  const total=weights.reduce((sum,v)=>sum+v,0);
  const prior=weights.slice(0,parts.hour).reduce((sum,v)=>sum+v,0);
  return (prior+weights[parts.hour]*(parts.minute/60+parts.second/3600))/total;
}
function dailyGain(day:string,kind:'offers'|'applications'):number {
  const mode=chineseDateMode(day);
  const month=Number(day.slice(5,7));
  const weight=seasonalWeight[month-1]*(mode==='holiday'?0.42:mode==='weekend'?0.72:1);
  const serial=asDayNumber(day);
  const jitter=1+hash(serial,kind==='offers'?151:199)*0.16;
  return Math.max(1,Math.round((kind==='offers'?36:630)*weight*jitter));
}
function cumulativeProgress(ms:number,kind:'offers'|'applications'):number {
  const current=beijingParts(ms),serial=asDayNumber(current.day);
  if(serial<baseDayNumber)return 0;
  let amount=0;
  for(let i=baseDayNumber;i<serial;i++) amount+=dailyGain(asDayString(i),kind);
  amount+=dailyGain(current.day,kind)*dayShare(current,chineseDateMode(current.day));
  return amount;
}
const baseOfferProgress=cumulativeProgress(PREVIEW_ANCHOR_MS,'offers');
const baseAppProgress=cumulativeProgress(PREVIEW_ANCHOR_MS,'applications');
const baseHeatTarget=baseHeat(PREVIEW_ANCHOR_MS);
const baseActiveTarget=baseActive(PREVIEW_ANCHOR_MS);
const baseHeatNoise=heatNoise(PREVIEW_ANCHOR_MS);
const baseActiveNoise=activeNoise(PREVIEW_ANCHOR_MS);
function period(hour:number):string {
  if(hour<6)return '凌晨低谷';
  if(hour<9)return '清晨回升';
  if(hour<12)return '上午活跃';
  if(hour<14)return '午间时段';
  if(hour<18)return '下午高峰';
  if(hour<22)return '晚间活跃';
  return '夜间回落';
}
export function previewMetricsAt(epochMs:number):LivePreviewMetrics {
  const now=beijingParts(epochMs);
  // A deterministic timestamp, not client-local random state. All visitors
  // observing the same moment see the same review illustration.
  const heat=clamp(Math.round(
    PREVIEW_START.heat+baseHeat(epochMs)-baseHeatTarget+
    heatNoise(epochMs)-baseHeatNoise
  ),100000,499999);
  // 'Today active' acts as a rolling active-window visualization; rises and falls.
  const active=clamp(Math.round(
    PREVIEW_START.active+baseActive(epochMs)-baseActiveTarget+
    activeNoise(epochMs)-baseActiveNoise
  ),400,30000);
  const offers=PREVIEW_START.offers+Math.max(0,Math.floor(cumulativeProgress(epochMs,'offers')-baseOfferProgress+1e-8));
  const applications=PREVIEW_START.applications+Math.max(0,Math.floor(cumulativeProgress(epochMs,'applications')-baseAppProgress+1e-8));
  return {heat,offers,active,applications,hour:now.hour,day:now.day,period:period(now.hour)};
}
