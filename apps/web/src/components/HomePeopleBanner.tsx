import { useState } from 'react';
import { X } from 'lucide-react';
import '../styles/home-people-banner.css';

const STORAGE_KEY = 'hhba:home-people-banner:dismissed:v1';

function dismissedPreviously(): boolean {
  try { return window.localStorage.getItem(STORAGE_KEY) === '1'; }
  catch { return false; }
}

/** HHBA-owned brand message, not an external advertisement or navigation link. */
export function HomePeopleBanner() {
  const [dismissed, setDismissed] = useState(dismissedPreviously);
  if (dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch { /* private browsing */ }
  };
  return <aside className="hhba-people-banner" aria-label="HHBA 品牌理念">
    <button type="button" className="hhba-people-banner-close" aria-label="关闭 HHBA 品牌理念展示" onClick={dismiss} title="关闭">
      <X size={17} aria-hidden="true"/>
    </button>
    <img src={`${import.meta.env.BASE_URL}images/hhba-people-group.webp`} width="320" height="180"
      alt="中国各行各业的劳动者共同合影" loading="lazy" decoding="async"/>
    <p>从人民中来 到人民中去</p>
  </aside>;
}
