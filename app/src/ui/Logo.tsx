import { useEffect, useRef, useState } from 'react';

/** Logo officiel Bouchnocam (icône : voiture vert/jaune et ondes rouges). */
export function LogoMark({ className = '', size }: { className?: string; size?: number }) {
  return (
    <img
      className={`logo-mark ${className}`}
      src="./brand/logo-mark.png"
      alt="Bouchnocam"
      width={size}
      height={size ? Math.round(size * 0.91) : undefined}
      draggable={false}
    />
  );
}

/** Écran d'ouverture : le logo officiel apparaît en fondu, avec une barre de chargement discrète. */
export function Splash({ ready }: { ready: boolean }) {
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>('show');
  const start = useRef(Date.now());
  const minMs = 1200;

  useEffect(() => {
    const hard = setTimeout(() => setPhase((p) => (p === 'show' ? 'leave' : p)), 3000);
    return () => clearTimeout(hard);
  }, []);
  useEffect(() => {
    if (!ready || phase !== 'show') return undefined;
    const t = setTimeout(() => setPhase('leave'), Math.max(0, minMs - (Date.now() - start.current)));
    return () => clearTimeout(t);
  }, [ready, phase]);
  useEffect(() => {
    if (phase !== 'leave') return undefined;
    const t = setTimeout(() => setPhase('gone'), 350);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div className={`splash ${phase === 'leave' ? 'is-leaving' : ''}`} aria-hidden="true">
      <img className="splash__logo" src="./brand/logo.png" alt="" draggable={false} />
      <div className="splash__road"><span /></div>
    </div>
  );
}

/** Indicateur de connexion : bandeau sobre quand le réseau est perdu, puis « rétablie ». */
export function ConnectionPill({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const [restored, setRestored] = useState(false);
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) {
      setRestored(true);
      const t = setTimeout(() => setRestored(false), 2500);
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
      <span className="conn__dot" />
      <div className="conn__text">
        <strong>{offline ? 'Pas de connexion' : 'Connexion rétablie'}</strong>
        <span>{offline ? 'Nouvel essai automatique… la carte reste consultable.' : 'Les signalements sont à jour.'}</span>
      </div>
      {offline && <button type="button" className="conn__retry" onClick={onRetry}>Réessayer</button>}
    </div>
  );
}
