// État global de l'application et actions (sans bibliothèque externe).
import { useSyncExternalStore } from 'react';
import * as api from './api';
import { CONFIG } from './config';
import { distanceM, errorText, inCameroon, isFresh } from './format';
import type {
  EmergencyResult, Hospital, Leader, Me, MyReport, Overlay, Pos, Report, ReportType, Severity, Tab,
} from './types';

export interface AppState {
  reports: Report[];
  votes: Record<string, number>;
  mine: Record<string, true>;
  myReports: MyReport[];
  me: Me | null;
  signedIn: boolean;
  pos: Pos | null;
  geo: 'unknown' | 'granted' | 'denied' | 'unavailable';
  offline: boolean;
  loadedOnce: boolean;
  leaderboard: Leader[] | null;
  tab: Tab;
  overlay: Overlay | null;
  toast: { id: number; text: string } | null;
  undo: { reportId: string; label: string; until: number } | null;
  emergency: { status: 'idle' | 'locating' | 'loading' | 'ready' | 'error'; data: EmergencyResult | null; selected: number; error?: string };
  installAvailable: boolean;
}

let state: AppState = {
  reports: [],
  votes: {},
  mine: {},
  myReports: [],
  me: null,
  signedIn: api.isSignedIn(),
  pos: null,
  geo: 'unknown',
  offline: false,
  loadedOnce: false,
  leaderboard: null,
  tab: 'map',
  overlay: null,
  toast: null,
  undo: null,
  emergency: { status: 'idle', data: null, selected: 0 },
  installAvailable: false,
};
const listeners = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

// ---------------------------------------------------------------- Carte (enregistrée par MapView)
export interface MapApi {
  flyTo(lat: number, lng: number, zoom?: number): void;
  bounds(): { south: number; west: number; north: number; east: number } | null;
  fitPoints(points: [number, number][]): void;
}
let mapApi: MapApi | null = null;
export const registerMap = (m: MapApi | null) => { mapApi = m; };
export const map = () => mapApi;

// ---------------------------------------------------------------- Messages
let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, ms = 4200) {
  toastId += 1;
  setState({ toast: { id: toastId, text } });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setState({ toast: null }), ms);
}
export const vibrate = (pattern: number | number[] = 60) => { try { navigator.vibrate?.(pattern); } catch { /* ignoré */ } };

// ---------------------------------------------------------------- Feuilles et écrans (bouton retour Android)
let ignoreNextPop = false;
export function openOverlay(o: Overlay) {
  if (!state.overlay) history.pushState({ overlay: true }, '');
  setState({ overlay: o });
}
export function closeOverlay(fromPop = false) {
  if (!state.overlay) return;
  const wasEmergency = state.overlay.kind === 'emergency';
  setState({ overlay: null });
  if (wasEmergency) setState({ emergency: { status: 'idle', data: null, selected: 0 } });
  if (!fromPop) { ignoreNextPop = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (ignoreNextPop) { ignoreNextPop = false; return; }
  if (state.overlay) closeOverlay(true);
});

export function setTab(tab: Tab) {
  setState({ tab });
  if (tab === 'nearby') loadReports();
  if (tab === 'profile') { refreshUser(); loadLeaderboard(); }
}

// ---------------------------------------------------------------- Signalements
let loading: Promise<void> | null = null;
export function loadReports({ silent = true } = {}) {
  if (loading) return loading;
  const b = mapApi?.bounds();
  if (!b) return Promise.resolve();
  loading = (async () => {
    try {
      const rows = await api.fetchReports(b);
      const now = Date.now();
      setState({ reports: rows.filter((r) => new Date(r.expires_at).getTime() > now), loadedOnce: true, offline: false });
    } catch (e) {
      if ((e as api.ApiError).code === 'network') setState({ offline: true });
      else if (!silent) toast(errorText(e));
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export function pruneExpired() {
  const now = Date.now();
  const kept = state.reports.filter((r) => new Date(r.expires_at).getTime() > now);
  if (kept.length !== state.reports.length) setState({ reports: kept });
}

let pendingReport: { type: ReportType; severity: Severity | null } | null = null;

export async function sendReport(type: ReportType, severity: Severity | null) {
  if (!api.isSignedIn()) {
    pendingReport = { type, severity };
    openOverlay({ kind: 'auth', mode: 'signup', reason: 'Créez votre compte (30 secondes) : votre signalement partira tout de suite après.' });
    return;
  }
  let pos: Pos;
  try {
    pos = await getFreshPosition();
  } catch (e) {
    toast(errorText(e), 6000);
    return;
  }
  vibrate(70);
  if (state.overlay?.kind === 'report') closeOverlay();
  const label = type === 'embouteillage' && severity
    ? `Embouteillage ${['', 'léger', 'moyen', 'bloqué'][severity]}` : ({
      accident: 'Accident', route_barree: 'Route barrée', travaux: 'Travaux', inondation: 'Inondation', embouteillage: 'Embouteillage',
    } as const)[type];
  try {
    const res = await api.createReport({ type, severity, lat: pos.lat, lng: pos.lng, accuracy: pos.acc });
    if (res.merged) {
      toast(`${label} déjà signalé ici : votre signalement compte comme une confirmation.`, 6000);
    } else {
      setState({ undo: { reportId: res.id, label, until: Date.now() + CONFIG.undoSeconds * 1000 } });
    }
    mapApi?.flyTo(pos.lat, pos.lng, 16);
    await loadReports();
    refreshUser();
  } catch (e) {
    vibrate([40, 60, 40]);
    toast(errorText(e), 6000);
  }
}

export async function undoReport() {
  const u = state.undo;
  if (!u) return;
  setState({ undo: null });
  try {
    await api.cancelReport(u.reportId);
    setState((s) => ({ reports: s.reports.filter((r) => r.id !== u.reportId) }));
    toast('Signalement annulé.');
    refreshUser();
  } catch (e) {
    toast(errorText(e));
  }
}

export async function flushPendingReport() {
  if (!pendingReport || !api.isSignedIn()) return;
  const p = pendingReport;
  pendingReport = null;
  await sendReport(p.type, p.severity);
}

export async function vote(r: Report, value: 1 | -1) {
  const pos = await getFreshPosition();
  const res = await api.voteReport({ id: r.id, vote: value, lat: pos.lat, lng: pos.lng });
  vibrate(40);
  setState((s) => ({
    votes: { ...s.votes, [r.id]: value },
    reports: res.status === 'retire'
      ? s.reports.filter((x) => x.id !== r.id)
      : s.reports.map((x) => (x.id === r.id ? { ...x, status: res.status, confirmations: res.confirmations, contestations: res.contestations } : x)),
  }));
  refreshUser();
  return res;
}

// ---------------------------------------------------------------- Utilisateur
export async function refreshUser() {
  if (!api.isSignedIn()) {
    setState({ signedIn: false, me: null, votes: {}, mine: {}, myReports: [] });
    return;
  }
  setState({ signedIn: true });
  try {
    const [me, votes, mine] = await Promise.all([api.fetchMe(), api.fetchMyVotes(), api.fetchMyReports()]);
    setState({
      me,
      votes: Object.fromEntries((votes || []).map((v) => [v.report_id, v.vote])),
      myReports: mine || [],
      mine: Object.fromEntries((mine || []).map((r) => [r.id, true as const])),
    });
  } catch (e) {
    if ((e as api.ApiError).code !== 'network') console.warn('refreshUser', e);
  }
}
api.onSessionChange(() => setState({ signedIn: api.isSignedIn() }));

export async function loadLeaderboard() {
  try { setState({ leaderboard: await api.fetchLeaderboard() }); } catch { /* garde l'ancien */ }
}

// ---------------------------------------------------------------- Géolocalisation
let watchId: number | null = null;
let wantCenter = false;
let centeredOnce = false;
let userMovedMap = false;
export const markUserMovedMap = () => { userMovedMap = true; };

function onPosition(p: GeolocationPosition) {
  const pos: Pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() };
  setState({ pos, geo: 'granted' });
  if (wantCenter || (!userMovedMap && !centeredOnce)) {
    wantCenter = false;
    centerOnUser();
  }
}

function onPositionError(err: GeolocationPositionError) {
  if (err.code === 1) {
    setState({ geo: 'denied' });
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    if (wantCenter) toast(errorText({ code: 'geo_denied' }), 6000);
    wantCenter = false;
  }
}

export function startGeo(center = false) {
  if (center) wantCenter = true;
  if (!('geolocation' in navigator)) { setState({ geo: 'unavailable' }); return; }
  if (watchId !== null) { if (center && state.pos) centerOnUser(); return; }
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy: true, maximumAge: 15000, timeout: 25000 });
}

export function centerOnUser() {
  const p = state.pos;
  if (!p) return;
  if (!inCameroon(p)) { toast('Vous semblez hors du Cameroun : la carte reste sur Yaoundé.'); return; }
  centeredOnce = true;
  userMovedMap = false;
  mapApi?.flyTo(p.lat, p.lng, 15);
}

export function getFreshPosition(): Promise<Pos> {
  if (isFresh(state.pos, 60000)) return Promise.resolve(state.pos);
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new api.ApiError('geo_unavailable')); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      onPosition(p);
      resolve(getState().pos as Pos);
    }, (err) => {
      onPositionError(err);
      reject(new api.ApiError(err.code === 1 ? 'geo_denied' : 'geo_unavailable'));
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
  });
}

// ---------------------------------------------------------------- Urgence
let hospitalsCache: Hospital[] | null = null;

export async function startEmergency() {
  vibrate([60, 40, 60]);
  openOverlay({ kind: 'emergency' });
  setState({ emergency: { status: 'locating', data: null, selected: 0 } });
  let pos: Pos;
  try {
    pos = await getFreshPosition();
  } catch (e) {
    setState({ emergency: { status: 'error', data: null, selected: 0, error: errorText(e) } });
    return;
  }
  if (state.overlay?.kind !== 'emergency') return;
  setState({ emergency: { status: 'loading', data: null, selected: 0 } });
  try {
    const data = await api.emergencyRoute({ lat: pos.lat, lng: pos.lng });
    if (state.overlay?.kind !== 'emergency') return;
    if (!data.results?.length) throw new api.ApiError('no_hospitals');
    setState({ emergency: { status: 'ready', data, selected: 0 } });
    showRoute(0);
  } catch (e) {
    // Repli : hôpitaux les plus proches à vol d'oiseau, sans itinéraire
    try {
      hospitalsCache ??= await api.fetchHospitals();
      const near = hospitalsCache
        .map((h) => ({ h, d: distanceM(pos, h) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map(({ h, d }) => ({ hospital: h, distance_m: Math.round(d), duration_s: null, geometry: null, avoided: 0, incidents_on_route: 0, routed: false }));
      if (state.overlay?.kind !== 'emergency') return;
      if (!near.length) throw e;
      setState({ emergency: { status: 'ready', data: { incidents_in_area: 0, results: near }, selected: 0 } });
      showRoute(0);
    } catch {
      setState({ emergency: { status: 'error', data: null, selected: 0, error: errorText(e) } });
    }
  }
}

export function showRoute(index: number) {
  const data = state.emergency.data;
  const opt = data?.results[index];
  if (!opt) return;
  setState((s) => ({ emergency: { ...s.emergency, selected: index } }));
  const pts: [number, number][] = opt.geometry
    ? opt.geometry.map(([lng, lat]) => [lat, lng])
    : [[opt.hospital.lat, opt.hospital.lng]];
  if (state.pos) pts.push([state.pos.lat, state.pos.lng]);
  mapApi?.fitPoints(pts);
}

// ---------------------------------------------------------------- Installation
let installEvent: { prompt: () => void; userChoice: Promise<unknown> } | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e as unknown as typeof installEvent;
  setState({ installAvailable: true });
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  setState({ installAvailable: false });
  toast("Bouchnocam est installé sur votre écran d'accueil.");
});
export async function promptInstall() {
  if (!installEvent) { openOverlay({ kind: 'install' }); return; }
  installEvent.prompt();
  try { await installEvent.userChoice; } catch { /* ignoré */ }
  installEvent = null;
  setState({ installAvailable: false });
}
export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  || Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

// ---------------------------------------------------------------- Réseau
window.addEventListener('online', () => { setState({ offline: false }); loadReports(); });
window.addEventListener('offline', () => setState({ offline: true }));
