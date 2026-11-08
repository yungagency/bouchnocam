import { useEffect, useState, type ReactNode } from 'react';
import { closeOverlay } from '../lib/store';
import { IconClose } from './icons';

/** Feuille qui monte du bas de l'écran. */
export function Sheet({ children, label }: { children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={`sheet-root ${open ? 'is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={() => closeOverlay()} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" className="sheet__close" aria-label="Fermer" onClick={() => closeOverlay()}>
          <IconClose size={22} />
        </button>
        {children}
      </div>
    </div>
  );
}

/** Message éphémère. */
export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn' | 'ok' | 'bad'; children: ReactNode }) {
  return <p className={`notice notice--${tone}`}>{children}</p>;
}
