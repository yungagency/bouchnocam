// Mode conduite : partage anonyme de la position, de la vitesse et de la direction
// pour calculer le trafic. Écran maintenu allumé, envoi par lots toutes les 30 secondes.
import * as api from './api';
import { distanceM, errorText } from './format';
import { getState, onRawPosition, openOverlay, setState, startGeo, toast } from './store';

interface Probe { t: number; lat: number; lng: number; s: number; h: number | null; a: number }

const CONSENT_KEY = 'bcm.drive.consent';
const SAMPLE_MS = 4000;
const FLUSH_MS = 30000;
const MAX_HOURS = 4;

let unsubscribe: (() => void) | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let session = '';
let buffer: Probe[] = [];
let last: { lat: number; lng: number; t: number } | null = null;
let wake: { release: () => Promise<void> } | null = null;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  }));

export const hasDriveConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; } };
export const giveDriveConsent = () => { try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* ignoré */ } };

async function keepScreenOn() {
  try {
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!nav.wakeLock) return;
    wake = await nav.wakeLock.request('screen');
    setState((s) => ({ drive: { ...s.drive, wakeLock: true } }));
  } catch {
    setState((s) => ({ drive: { ...s.drive, wakeLock: false } }));
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible' && getState().drive.active) keepScreenOn();
}

function onPosition(p: GeolocationPosition) {
  const t = Date.now();
  if (last && t - last.t < SAMPLE_MS) return;
  const acc = p.coords.accuracy;
  if (acc > 60) return;
  const here = { lat: p.coords.latitude, lng: p.coords.longitude };
  let speed = p.coords.speed; // m/s, parfois absent
  if (speed == null || Number.isNaN(speed)) {
    speed = last ? distanceM(last, here) / ((t - last.t) / 1000) : 0;
  }
  const kmh = speed * 3.6;
  if (kmh > 160) return; // saut GPS
  const heading = p.coords.heading;
  buffer.push({
    t, lat: Number(here.lat.toFixed(6)), lng: Number(here.lng.toFixed(6)),
    s: Math.round(kmh * 10) / 10, h: heading == null || Number.isNaN(heading) ? null : Math.round(heading), a: Math.round(acc),
  });
  last = { ...here, t };
  if (buffer.length >= 100) flush();
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer.splice(0, 110);
  const role = getState().me?.role ?? 'usager';
  try {
    const n = await api.ingestProbes(session, role, batch);
    setState((s) => ({ drive: { ...s.drive, sent: s.drive.sent + (n || 0) } }));
  } catch (e) {
    // Hors connexion : on garde les points (au plus 15 minutes) pour le prochain envoi
    if ((e as api.ApiError).code === 'network') buffer = [...batch, ...buffer].slice(-225);
  }
}

export function requestDrive() {
  if (!api.isSignedIn()) {
    openOverlay({ kind: 'auth', mode: 'signup', reason: 'Créez votre compte pour activer le Mode conduite.' });
    return;
  }
  if (!hasDriveConsent()) { openOverlay({ kind: 'drive' }); return; }
  startDrive();
}

export function startDrive() {
  if (getState().drive.active) return;
  if (!('geolocation' in navigator)) { toast(errorText({ code: 'geo_unavailable' })); return; }
  session = uuid();
  buffer = [];
  last = null;
  setState({ drive: { active: true, sent: 0, startedAt: Date.now(), wakeLock: false } });
  keepScreenOn();
  // On réutilise le suivi GPS de l'application (un seul suivi = moins de batterie)
  unsubscribe = onRawPosition(onPosition);
  startGeo();
  if (getState().geo === 'denied') { toast(errorText({ code: 'geo_denied' }), 6000); stopDrive(); return; }
  flushTimer = setInterval(flush, FLUSH_MS);
  stopTimer = setTimeout(() => { stopDrive(); toast('Mode conduite arrêté automatiquement après 4 heures.'); }, MAX_HOURS * 3600 * 1000);
  document.addEventListener('visibilitychange', onVisibility);
  try { navigator.vibrate?.(40); } catch { /* ignoré */ }
}

export async function stopDrive() {
  unsubscribe?.();
  unsubscribe = null;
  if (flushTimer) clearInterval(flushTimer);
  if (stopTimer) clearTimeout(stopTimer);
  flushTimer = null;
  stopTimer = null;
  document.removeEventListener('visibilitychange', onVisibility);
  try { await wake?.release(); } catch { /* ignoré */ }
  wake = null;
  await flush();
  const sent = getState().drive.sent;
  setState({ drive: { active: false, sent: 0, startedAt: 0, wakeLock: false } });
  if (sent > 0) toast(`Merci ! ${sent} positions partagées pour calculer le trafic.`, 4500);
}
