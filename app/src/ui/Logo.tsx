import { useEffect, useId, useRef, useState } from 'react';

/**
 * Logo Bouchnocam (voiture vert/jaune + ondes rouges), découpé en éléments animables :
 * .lm-car (la voiture) et .lm-wave--1/2/3 (les trois ondes, de la plus petite à la plus grande).
 */
export function LogoMark({ className = '', size }: { className?: string; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const g = `lmg${uid}`;
  const y = `lmy${uid}`;
  const car = `lmc${uid}`;
  return (
    <svg className={`logo-mark ${className}`} viewBox="84 100 344 316" width={size} height={size} role="img" aria-label="Bouchnocam">
      <defs>
        <clipPath id={g}><path d="M-20 -20 H148 L166 60 L208 98 L170 230 H-20 Z" /></clipPath>
        <clipPath id={y}><path d="M148 -20 H330 V230 H170 L208 98 L166 60 Z" /></clipPath>
        <g id={car}>
          <rect x="-8" y="70" width="32" height="20" rx="8" />
          <rect x="276" y="70" width="32" height="20" rx="8" />
          <path d="M50 86 L80 22 Q88 6 106 6 H194 Q212 6 220 22 L250 86 Z" />
          <path d="M18 88 Q22 70 42 68 H258 Q278 70 282 88 L290 128 Q292 162 280 174 Q274 180 258 180 H42 Q26 180 20 174 Q8 162 10 128 Z" />
          <rect x="28" y="160" width="54" height="46" rx="13" />
          <rect x="218" y="160" width="54" height="46" rx="13" />
        </g>
      </defs>
      <g className="lm-car">
        <g transform="translate(101 211) scale(0.82 0.9)">
          <g clipPath={`url(#${g})`} fill="#1E8A45"><use href={`#${car}`} /></g>
          <g clipPath={`url(#${y})`} fill="#F4C20D"><use href={`#${car}`} /></g>
          <path d="M104 30 Q107 24 114 24 H186 Q193 24 196 30 L218 72 H82 Z" fill="#fff" />
          <path className="lm-light" d="M28 114 Q38 101 74 105 Q85 111 79 121 Q52 127 33 123 Q24 120 28 114 Z" fill="#fff" />
          <path className="lm-light" d="M272 114 Q262 101 226 105 Q215 111 221 121 Q248 127 267 123 Q276 120 272 114 Z" fill="#fff" />
        </g>
      </g>
      <g fill="none" stroke="#D0213A" strokeWidth="18" strokeLinecap="round">
        <path className="lm-wave lm-wave--1" d="M280 200 A48 48 0 0 1 328 248" />
        <path className="lm-wave lm-wave--2" d="M280 159 A89 89 0 0 1 369 248" />
        <path className="lm-wave lm-wave--3" d="M280 118 A130 130 0 0 1 410 248" />
      </g>
    </svg>
  );
}

/** Écran d'ouverture animé : la voiture arrive, les ondes s'allument une à une, puis le nom. */
export function Splash({ ready }: { ready: boolean }) {
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>('show');
  const start = useRef(Date.now());
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minMs = reduce ? 300 : 1900;

  useEffect(() => {
    // On n'attend jamais plus de 3,5 s, même sans réseau
    const hard = setTimeout(() => setPhase((p) => (p === 'show' ? 'leave' : p)), 3500);
    return () => clearTimeout(hard);
  }, []);
  useEffect(() => {
    if (!ready || phase !== 'show') return undefined;
    const wait = Math.max(0, minMs - (Date.now() - start.current));
    const t = setTimeout(() => setPhase('leave'), wait);
    return () => clearTimeout(t);
  }, [ready, phase, minMs]);
  useEffect(() => {
    if (phase !== 'leave') return undefined;
    const t = setTimeout(() => setPhase('gone'), 450);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div className={`splash ${phase === 'leave' ? 'is-leaving' : ''}`} aria-hidden="true">
      <div className="splash__glow" />
      <LogoMark className="is-intro" />
      <div className="splash__word">Bouchnocam</div>
      <div className="splash__tag">Bouge, Signal, Gagne !</div>
      <div className="splash__road"><span /></div>
    </div>
  );
}

/** Indicateur de connexion : ondes qui « cherchent » le réseau, puis qui se rallument. */
export function ConnectionPill({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const [restored, setRestored] = useState(false);
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) {
      setRestored(true);
      const t = setTimeout(() => setRestored(false), 2600);
      wasOffline.current = offline;
      return () => clearTimeout(t);
    }
    wasOffline.current = offline;
    return undefined;
  }, [offline]);
  useEffect(() => {
    if (!offline) return undefined;
    const t = setInterval(onRetry, 6000);
    return () => clearInterval(t);
  }, [offline, onRetry]);

  if (!offline && !restored) return null;
  return (
    <div className={`conn ${offline ? 'is-offline' : 'is-restored'}`} role="status" aria-live="polite">
      <LogoMark className={offline ? 'is-searching' : 'is-restored'} />
      <div className="conn__text">
        <strong>{offline ? 'Connexion perdue' : 'Connexion rétablie'}</strong>
        <span>{offline ? 'On cherche le réseau… la carte reste disponible.' : 'Les signalements sont à jour.'}</span>
      </div>
      {offline && <button type="button" className="conn__retry" onClick={onRetry}>Réessayer</button>}
    </div>
  );
}
