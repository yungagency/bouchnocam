import { useEffect, useState } from 'react';
import { SEVERITY, TYPES, isFresh } from '../../lib/format';
import { closeOverlay, sendReport, startGeo, useApp } from '../../lib/store';
import type { ReportType, Severity } from '../../lib/types';
import { GLYPH, IconBack, IconCheck, IconMegaphone, IconNearby, TrafficArt } from '../../ui/icons';

// Nom du quartier (« Melen, Yaoundé »), comme sur la maquette
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

const OTHERS: ReportType[] = ['accident', 'route_barree', 'route_impraticable', 'travaux', 'inondation'];
const MEGAPHONE: Record<Severity, string> = { 1: '#F28C28', 2: '#1E8A45', 3: '#D62828' };

type Choice = { type: ReportType; severity: Severity | null } | null;

export function ReportScreen() {
  const pos = useApp((s) => s.pos);
  const geo = useApp((s) => s.geo);
  const [place, setPlace] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>(null);
  const [busy, setBusy] = useState(false);
  const located = isFresh(pos);

  useEffect(() => { startGeo(); }, []);
  const latKey = pos?.lat.toFixed(3);
  const lngKey = pos?.lng.toFixed(3);
  useEffect(() => {
    if (!pos) return undefined;
    let alive = true;
    placeName(pos.lat, pos.lng).then((n) => { if (alive) setPlace(n); });
    return () => { alive = false; };
  }, [latKey, lngKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (type: ReportType, severity: Severity | null) => {
    try { navigator.vibrate?.(15); } catch { /* ignoré */ }
    setChoice({ type, severity });
  };
  const send = async () => {
    if (!choice || busy) return;
    setBusy(true);
    await sendReport(choice.type, choice.severity, place);
    setBusy(false);
  };
  const isSel = (t: ReportType, s: Severity | null) => choice?.type === t && choice?.severity === s;

  return (
    <div className="screen screen--report" role="dialog" aria-modal="true" aria-label="Signal et gravité">
      <header className="rs-head">
        <button type="button" className="rs-back" aria-label="Retour" onClick={() => closeOverlay()}><IconBack size={26} /></button>
        <h1>Signal &amp; Gravité</h1>
        <span className="rs-head__spacer" />
      </header>

      <div className={`rs-place ${located ? '' : 'is-waiting'}`}>
        <IconNearby size={20} />
        {geo === 'denied'
          ? <span>Localisation refusée : autorisez-la dans les réglages</span>
          : <strong>{located ? (place || 'Votre position') : 'Recherche de votre position…'}</strong>}
      </div>

      <div className="rs-cards" role="radiogroup" aria-label="Intensité de l'embouteillage">
        {([1, 2, 3] as Severity[]).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={isSel('embouteillage', s)}
            className={`rs-card rs-card--${s} ${isSel('embouteillage', s) ? 'is-selected' : ''}`}
            onClick={() => pick('embouteillage', s)}>
            <span className="rs-card__mega" style={{ color: MEGAPHONE[s] }}><IconMegaphone size={30} /></span>
            <TrafficArt severity={s} />
            <strong>{SEVERITY[s].label}</strong>
            <small>{SEVERITY[s].hint}</small>
            {isSel('embouteillage', s) && <span className="rs-card__tick"><IconCheck size={16} /></span>}
          </button>
        ))}
      </div>

      <p className="rs-sub">Autre incident</p>
      <div className="rs-others" role="radiogroup" aria-label="Autre incident">
        {OTHERS.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={isSel(t, null)}
            className={`rs-other ${isSel(t, null) ? 'is-selected' : ''}`} style={{ ['--c' as string]: TYPES[t].color }}
            onClick={() => pick(t, null)}>
            <span className="rs-other__icon">{GLYPH[t]}</span>
            <span>{TYPES[t].label}</span>
          </button>
        ))}
      </div>

      <div className="rs-footer">
        <button type="button" className="rs-send" disabled={!choice || busy || geo === 'denied'} onClick={send}>
          {busy ? 'Envoi…' : 'Envoyer'}
        </button>
        <p className="rs-hint">+10 points quand 2 usagers confirment · Au volant, laissez le passager signaler</p>
      </div>
    </div>
  );
}
