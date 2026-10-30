import { useState } from 'react';
import { X } from 'lucide-react';
import '../styles/home-people-banner.css';

/** Dismissal lasts only until this homepage component is mounted again. */
export function HomePeopleBanner() {
  const [dismissed, setDismissed] = useState(false);
  const fontUrl = `${import.meta.env.BASE_URL}fonts/hhba-people-xingshu.woff2`;
  if (dismissed) return null;
  return <>
    <style>{`@font-face{font-family:"HHBA People Xingshu";src:url("${fontUrl}") format("woff2");font-weight:400;font-style:normal;font-display:swap}`}</style>
    <aside className="hhba-people-banner" aria-label="HHBA 品牌理念">
      <button type="button" className="hhba-people-banner-close" aria-label="关闭 HHBA 品牌理念展示"
        onClick={() => setDismissed(true)} title="关闭">
        <X size={17} aria-hidden="true"/>
      </button>
      <picture>
        <source type="image/avif" srcSet={`${import.meta.env.BASE_URL}images/hhba-people-group-hd.avif`}/>
        <img src={`${import.meta.env.BASE_URL}images/hhba-people-group.webp`} width="1200" height="676"
          alt="中国各行各业的劳动者共同合影" loading="eager" decoding="async"/>
      </picture>
      <p>从人民中来 到人民中去</p>
    </aside>
  </>;
}
