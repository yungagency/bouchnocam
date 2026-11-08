import type { ReactNode } from 'react';
import type { ReportType, Severity } from '../lib/types';

const Stroke = ({ d, size, w = 2 }: { d: string; size?: number; w?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type P = { size?: number };
export const IconMap = (p: P) => <Stroke {...p} d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />;
export const IconNearby = (p: P) => <Stroke {...p} d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />;
export const IconProfile = (p: P) => <Stroke {...p} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />;
export const IconLocate = (p: P) => <Stroke {...p} d="M12 2v3M12 19v3M2 12h3M19 12h3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />;
export const IconClose = (p: P) => <Stroke {...p} w={2.4} d="M6 6l12 12M18 6 6 18" />;
export const IconBack = (p: P) => <Stroke {...p} w={2.4} d="M15 5 8 12l7 7" />;
export const IconCheck = (p: P) => <Stroke {...p} w={2.6} d="M5 12.5l4.5 4.5L19 7.5" />;
export const IconX = (p: P) => <Stroke {...p} w={2.4} d="M7 7l10 10M17 7 7 17" />;
export const IconSearch = (p: P) => <Stroke {...p} d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />;
export const IconPhone = (p: P) => <Stroke {...p} d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />;
export const IconNavigate = (p: P) => <Stroke {...p} d="M3 11 21 3l-8 18-2-8-8-2z" />;
export const IconInstall = (p: P) => <Stroke {...p} d="M12 3v12M7 10l5 5 5-5M5 21h14" />;
export const IconRefresh = (p: P) => <Stroke {...p} d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />;
export const IconShield = (p: P) => <Stroke {...p} d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />;
export const IconLayers = (p: P) => <Stroke {...p} d="M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5" />;
export const IconAlert = (p: P) => <Stroke {...p} d="M12 3 2 20h20L12 3zM12 10v4M12 17h.01" />;

export const IconStar = ({ size }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M12 3.2l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.6l6-.9z" fill="currentColor" />
  </svg>
);

export const IconMegaphone = ({ size }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M3 10v4a1 1 0 0 0 1 1h2.5l5.5 4.2V4.8L6.5 9H4a1 1 0 0 0-1 1z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const IconAmbulance = ({ size }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6H14v11H2z" fill="currentColor" />
    <path d="M14 9h3.6a1.5 1.5 0 0 1 1.2.6l2.7 3.6V17H14z" fill="currentColor" />
    <path d="M8 8.5v6M5 11.5h6" stroke="var(--amb-cross, #F2C200)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M15.5 10.5h2.2l1.6 2.2h-3.8z" fill="var(--amb-cross, #F2C200)" />
    <circle cx="6" cy="17.5" r="2.2" fill="currentColor" stroke="var(--amb-cross, #F2C200)" strokeWidth="1.4" />
    <circle cx="17" cy="17.5" r="2.2" fill="currentColor" stroke="var(--amb-cross, #F2C200)" strokeWidth="1.4" />
  </svg>
);

export const IconHospital = ({ size }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" />
    <path d="M12 7.5v9M7.5 12h9" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
  </svg>
);

// Pictogrammes des types d'incident, en texte SVG : utilisés tels quels dans les marqueurs
// de la carte (Leaflet) et dans l'interface React. La couleur de fond vient de --c.
export const GLYPH_SVG: Record<ReportType, string> = {
  embouteillage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 6.3 7.4A2.2 2.2 0 0 1 8.4 6h7.2a2.2 2.2 0 0 1 2.1 1.4l1.8 5.1V18a1 1 0 0 1-1 1h-1.3a1 1 0 0 1-1-1v-1H7.8v1a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1z" fill="currentColor"/><path d="M7 11.5 8.2 8h7.6l1.2 3.5z" style="fill:var(--c)"/><circle cx="7.7" cy="14.2" r="1.2" style="fill:var(--c)"/><circle cx="16.3" cy="14.2" r="1.2" style="fill:var(--c)"/></svg>',
  accident: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 2.6 19.8h18.8z" fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5"/><path d="M12 9.5v4.6" style="stroke:var(--c)" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.3" style="fill:var(--c)"/></svg>',
  route_barree: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><rect x="6.5" y="10.4" width="11" height="3.2" rx="1.2" style="fill:var(--c)"/></svg>',
  travaux: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.5h3.4l4.6 14.5H5.7z" fill="currentColor"/><path d="M8.8 9h6.4M7.4 13.5h9.2" style="stroke:var(--c)" stroke-width="2"/><rect x="3.5" y="18" width="17" height="2.6" rx="1.2" fill="currentColor"/></svg>',
  inondation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8s-5.6 6.1-5.6 10a5.6 5.6 0 0 0 11.2 0c0-3.9-5.6-10-5.6-10z" fill="currentColor"/><path d="M9.4 13.6a2.8 2.8 0 0 0 2.6 2.4" style="stroke:var(--c)" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
};
export const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const HOSPITAL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor"/><path d="M12 7.5v9M7.5 12h9" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/></svg>';

const Glyph = ({ type }: { type: ReportType }) => <span className="glyph" dangerouslySetInnerHTML={{ __html: GLYPH_SVG[type] }} />;
export const GLYPH: Record<ReportType, ReactNode> = {
  embouteillage: <Glyph type="embouteillage" />,
  accident: <Glyph type="accident" />,
  route_barree: <Glyph type="route_barree" />,
  travaux: <Glyph type="travaux" />,
  inondation: <Glyph type="inondation" />,
};

// Illustration des cartes Léger / Moyen / Bloqué, comme sur la maquette : 1, 3 ou 4 voitures
function Car({ x, y, s, body, dark }: { x: number; y: number; s: number; body: string; dark: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M3 17.5 6.2 9.4A3.2 3.2 0 0 1 9.2 7.3h11.6a3.2 3.2 0 0 1 3 2.1L27 17.5v7.3a1.6 1.6 0 0 1-1.6 1.6h-2.6a1.6 1.6 0 0 1-1.6-1.6v-1.3H8.8v1.3a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 24.8z" fill={body} stroke={dark} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7.4 15.8 9.3 10.6h11.4l1.9 5.2z" fill="#E8F4FF" stroke={dark} strokeWidth="1" strokeLinejoin="round" />
      <circle cx="7.8" cy="20.2" r="1.9" fill="#FFF7D6" stroke={dark} strokeWidth=".8" />
      <circle cx="22.2" cy="20.2" r="1.9" fill="#FFF7D6" stroke={dark} strokeWidth=".8" />
      <path d="M12 21h6" stroke={dark} strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

export function TrafficArt({ severity }: { severity: Severity }) {
  const c = { 1: ['#F4C20D', '#8A6A00'], 2: ['#F28C28', '#9A4A00'], 3: ['#E53945', '#8E1420'] }[severity];
  return (
    <svg viewBox="0 0 90 70" className="traffic-art" aria-hidden="true">
      {severity === 1 && (<><path d="M41 12h8l2 4h-12z" fill="#2B2B2B" /><Car x={18} y={10} s={1.8} body={c[0]} dark={c[1]} /></>)}
      {severity === 2 && (<><Car x={26} y={2} s={1.25} body={c[0]} dark={c[1]} /><Car x={6} y={26} s={1.25} body={c[0]} dark={c[1]} /><Car x={46} y={26} s={1.25} body={c[0]} dark={c[1]} /></>)}
      {severity === 3 && (<><Car x={26} y={0} s={1.15} body={c[0]} dark={c[1]} /><Car x={8} y={20} s={1.15} body={c[0]} dark={c[1]} /><Car x={44} y={20} s={1.15} body={c[0]} dark={c[1]} /><Car x={26} y={38} s={1.15} body={c[0]} dark={c[1]} /></>)}
    </svg>
  );
}
