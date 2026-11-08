import { useEffect, useState } from 'react';
import { SEVERITY, TYPES, isFresh } from '../../lib/format';
import { closeOverlay, sendReport, startGeo, useApp } from '../../lib/store';
import type { ReportType, Severity } from '../../lib/types';
import { GLYPH, IconBack, IconLocate, TrafficArt } from '../../ui/icons';

// Nom du quartier (affiché comme sur la maquette : « Melen, Yaoundé »)
const placeCache = new Map<string, string>();
async function placeName(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (placeCache.has(key)) return placeCache.get(key)!;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=fr&lat=${lat}&lon=${lng}`,
      { signal: AbortSignal.timeout(6000) });
    const d = await res.json();
    const a = d?.address || {};
    const quarter = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.road;
    const city = a.city || a.town || a.village;
    const name = [quarter, city].filter(Boolean).join(', ') || null;
    if (name) placeCache.set(key, name);
    return name;
  } catch {
    return null;
  }
}

const OTHERS: ReportType[] = ['accident', 'route_barree', 'travaux', 'inondation'];

export function ReportScreen() {
  const pos = useApp((s) => s.pos);
  const geo = useApp((s) => s.geo);
  const [place, setPlace] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = isFresh(pos);

  useEffect(() => { startGeo(); }, []);
  useEffect(() => {
    if (!pos) return;
    let alive = true;
    placeName(pos.lat, pos.lng).then((n) => { if (alive) setPlace(n); });
    return () => { alive = false; };
  }, [pos?.lat.toFixed(3), pos?.lng.toFixed(3)]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (type: ReportType, severity: Severity | null) => {
    if (busy) return;
    setBusy(true);
    await sendReport(type, severity);
    setBusy(false);
  };

  return (
    <div className="screen screen--report" role="dialog" aria-modal="true" aria-label="Signaler un problème">
      <header className="screen__head">
        <button type="button" className="round-btn" aria-label="Retour" onClick={() => closeOverlay()}><IconBack size={24} /></button>
        <h1>Que se passe-t-il ?</h1>
      </header>

      <div className={`place-chip ${ready ? '' : 'is-waiting'}`}>
        <IconLocate size={18} />
        {geo === 'denied'
          ? <span>Localisation refusée : autorisez-la dans les réglages</span>
          : ready
            ? <span><strong>{place || 'Votre position'}</strong>{pos && pos.acc > 150 ? ` · précision ± ${Math.round(pos.acc)} m` : ''}</span>
            : <span>Recherche de votre position…</span>}
      </div>

      <h2 className="screen__section">Embouteillage</h2>
      <div className="sev-cards">
        {([1, 2, 3] as Severity[]).map((s) => (
          <button key={s} type="button" className="sev-card" disabled={busy || geo === 'denied'}
            style={{ ['--c' as string]: SEVERITY[s].color, ['--t' as string]: SEVERITY[s].tint }}
            onClick={() => go('embouteillage', s)}>
            <TrafficArt severity={s} color={SEVERITY[s].color} />
            <strong>{SEVERITY[s].label}</strong>
            <small>{SEVERITY[s].hint}</small>
          </button>
        ))}
      </div>

      <h2 className="screen__section">Autre problème</h2>
      <div className="type-cards">
        {OTHERS.map((t) => (
          <button key={t} type="button" className="type-card" disabled={busy || geo === 'denied'}
            style={{ ['--c' as string]: TYPES[t].color }} onClick={() => go(t, null)}>
            <span className="type-card__icon">{GLYPH[t]}</span>
            <strong>{TYPES[t].label}</strong>
          </button>
        ))}
      </div>

      <p className="screen__foot">
        <strong>Une touche suffit</strong> : le signalement part tout de suite, et vous pouvez l'annuler pendant 5 secondes.
        <br />Au volant ? Laissez votre passager signaler.
      </p>
    </div>
  );
}
