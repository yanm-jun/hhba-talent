/**
 * HHBA city-level recruitment location lookup.
 *
 * Geolocation is requested only through a deliberate user action. For a pilot,
 * Vite dev mode can use OpenStreetMap Nominatim (moderate manual requests only).
 * Production MUST configure an operator-controlled, licensed reverse-geocoding
 * endpoint via VITE_HHBA_REVERSE_GEOCODE_URL; no public Nominatim fallback there.
 * That endpoint accepts lat/lon/zoom/addressdetails and emits OSM-style
 * {address:{country_code,state,city,...}}. No coordinates are persisted.
 */
import chinaDivisions from '../data/china_pca_2026.json';
import type { JobFilterSelection } from '../components/JobFilterPanel';

type Region = {n: string; ch?: Region[]};
type ReverseLocation = {address?: Record<string, unknown>};
export type LocatedRegion = Pick<JobFilterSelection, 'country'|'province'|'city'|'district'>;
export const SAVED_CITY_KEY = 'hhba-recruitment-saved-city-v1';
export const GEO_PROVIDER_ATTRIBUTION = '© OpenStreetMap contributors';
const PILOT_URL = 'https://nominatim.openstreetmap.org/reverse';
const LOCATION_TTL_MS = 24 * 60 * 60 * 1000;

const norm = (v: string) => v.toLocaleLowerCase().replace(/[\s·]/g,'')
    .replace(/(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市|地区|州)$/g,'');

function regionalName(actual: string, candidates: Region[]): Region | undefined {
  const target = norm(actual);
  if (!target || target.length < 2) return undefined;
  return candidates.find(candidate => {
    const value = norm(candidate.n);
    return value === target || (target.length >= 3 && (target.includes(value) || value.includes(target)));
  });
}
function nonEmpty(value: unknown): string {
  return typeof value==='string' && value.length<=150 ? value.trim() : '';
}
export function resolveJobRegion(payload: ReverseLocation): LocatedRegion {
  const address=payload?.address;
  if (!address || typeof address!=='object') throw new Error('定位服务未返回地区信息，请手动选择城市。');
  const country=nonEmpty(address.country_code).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('定位服务无法确认国家或地区。');
  const rawCity=nonEmpty(address.city) || nonEmpty(address.town) ||
      nonEmpty(address.municipality) || nonEmpty(address.village);
  if (country!=='CN') {
    const city=/^[\x20-\x7E\u00C0-\u024F]+$/.test(rawCity) ? rawCity : '';
    const state=nonEmpty(address.state);
    const province=/^[\x20-\x7E\u00C0-\u024F]+$/.test(state) ? state : '';
    return {country,province,city,district:''};
  }
  // Pin the names to HHBA's official-source filtering directory, not guesses.
  const provinces=chinaDivisions as Region[];
  const name=nonEmpty(address.state) || nonEmpty(address.province) || nonEmpty(address.region);
  const province=regionalName(name,provinces);
  if (!province) return {country:'CN',province:'',city:'',district:''};
  const city=regionalName(rawCity,province.ch||[]);
  // Municipalities: Beijing/Shanghai/etc. are both province and prefecture.
  const cityName=city?.n || (rawCity && norm(rawCity)===norm(province.n) && province.ch?.length===1 ?
    province.ch[0].n : '');
  return {country:'CN',province:province.n,city:cityName,district:''};
}

export function getPosition(): Promise<GeolocationPosition> {
  if (typeof window==='undefined' || !window.isSecureContext ||
      !('geolocation' in navigator))
    return Promise.reject(new Error('当前浏览器不支持安全定位，请使用 HTTPS 或手动选择城市。'));
  return new Promise((resolve,reject) => {
    navigator.geolocation.getCurrentPosition(resolve,(error)=>{
      reject(new Error(error.code===1 ? '你尚未允许定位，可在浏览器设置中开启，也可以手动选择城市。' :
        error.code===3 ? '定位超时，请检查手机定位服务后重试。' :
        '暂时无法获取设备位置，请手动选择地区。'));
    },{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
  });
}
export async function locateRegion(signal:AbortSignal):Promise<{region:LocatedRegion; provider:string}> {
  const configured=import.meta.env.VITE_HHBA_REVERSE_GEOCODE_URL as string|undefined;
  const endpoint=configured || (import.meta.env.DEV ? PILOT_URL : '');
  if(!endpoint) throw new Error('正式环境的地理编码服务尚未配置，可先手动选择城市。');
  // Validate endpoint before prompting for precise device location.
  const parsed=new URL(endpoint,window.location.origin);
  if (!['https:','http:'].includes(parsed.protocol) ||
      (parsed.protocol==='http:' && parsed.origin!==window.location.origin) ||
      parsed.username || parsed.password)
    throw new Error('地理编码服务配置不安全。');
  const pos=await getPosition();
  if(signal.aborted) throw new DOMException('Cancelled','AbortError');
  if (!Number.isFinite(pos.coords.latitude)||!Number.isFinite(pos.coords.longitude) ||
      pos.coords.accuracy>150000)
    throw new Error('设备定位精度过低，无法可靠推荐当前城市。请改为手动选择。');
  // ~1km rounded coordinates; never transmit full-precision GPS coordinates.
  parsed.searchParams.set('lat',pos.coords.latitude.toFixed(2));
  parsed.searchParams.set('lon',pos.coords.longitude.toFixed(2));
  parsed.searchParams.set('zoom','10');
  parsed.searchParams.set('addressdetails','1');
  if(!configured){
    parsed.searchParams.set('format','jsonv2');
    parsed.searchParams.set('accept-language','zh-CN,en');
  }
  const response=await fetch(parsed.toString(),{signal,headers:{Accept:'application/json'},credentials:'omit',cache:'no-store'});
  if(!response.ok)throw new Error('定位城市解析失败，请稍后再试或手动选择城市。');
  const result=await response.json() as ReverseLocation;
  return {region:resolveJobRegion(result),provider:!configured?'osm-pilot':'configured'};
}

export type SavedCity = {region:LocatedRegion; savedAt:number};
export function readSavedCity():SavedCity|null {
  try {
    const raw=window.localStorage.getItem(SAVED_CITY_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as SavedCity;
    if(!parsed || !Number.isFinite(parsed.savedAt) ||
        Date.now()-parsed.savedAt>LOCATION_TTL_MS ||
        !/^[A-Z]{2}$/.test(parsed.region?.country||'') ||
        !['province','city','district'].every(key=>
          typeof parsed.region[key as keyof LocatedRegion]==='string' &&
          parsed.region[key as keyof LocatedRegion].length<=120)){
      window.localStorage.removeItem(SAVED_CITY_KEY);
      return null;
    }
    return parsed;
  }catch{return null;}
}
export function saveCity(region:LocatedRegion) {
  try {window.localStorage.setItem(SAVED_CITY_KEY,
    JSON.stringify({region,savedAt:Date.now()}));} catch {/* storage disabled */}
}
export function forgetCity() {
  try {window.localStorage.removeItem(SAVED_CITY_KEY);} catch {/* no-op */}
}
