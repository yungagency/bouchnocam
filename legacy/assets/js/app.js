// Bouchnocam — application principale
import { CONFIG } from './config.js';
import * as api from './api.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignoré */ } },
};

// ------------------------------------------------------------------ Icônes
const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;
const stroke = (d) => svg(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
const ICON = {
  map: stroke('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14'),
  nearby: stroke('M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'),
  profile: stroke('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'),
  locate: stroke('M12 2v3M12 19v3M2 12h3M19 12h3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'),
  megaphone: stroke('M3 10v4a1 1 0 0 0 1 1h3l5 4V5L7 9H4a1 1 0 0 0-1 1zM16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'),
  close: stroke('M6 6l12 12M18 6 6 18'),
  check: stroke('M5 12.5l4.5 4.5L19 7.5'),
  x: stroke('M7 7l10 10M17 7 7 17'),
  star: svg('<path d="M12 3.2l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.6l6-.9z" fill="currentColor"/>'),
  gps: stroke('M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'),
  install: stroke('M12 3v12M7 10l5 5 5-5M5 21h14'),
  refresh: stroke('M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'),
  shield: stroke('M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z'),
};
const GLYPH = {
  embouteillage: svg('<path d="M4.5 12.5 6.3 7.4A2.2 2.2 0 0 1 8.4 6h7.2a2.2 2.2 0 0 1 2.1 1.4l1.8 5.1V18a1 1 0 0 1-1 1h-1.3a1 1 0 0 1-1-1v-1H7.8v1a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1z" fill="currentColor"/><path d="M7 11.5 8.2 8h7.6l1.2 3.5z" style="fill:var(--c)"/><circle cx="7.7" cy="14.2" r="1.2" style="fill:var(--c)"/><circle cx="16.3" cy="14.2" r="1.2" style="fill:var(--c)"/>'),
  accident: svg('<path d="M12 3.2 2.6 19.8h18.8z" fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5"/><path d="M12 9.5v4.6" style="stroke:var(--c)" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.3" style="fill:var(--c)"/>'),
  route_barree: svg('<circle cx="12" cy="12" r="9" fill="currentColor"/><rect x="6.5" y="10.4" width="11" height="3.2" rx="1.2" style="fill:var(--c)"/>'),
  travaux: svg('<path d="M10.3 3.5h3.4l4.6 14.5H5.7z" fill="currentColor"/><path d="M8.8 9h6.4M7.4 13.5h9.2" style="stroke:var(--c)" stroke-width="2"/><rect x="3.5" y="18" width="17" height="2.6" rx="1.2" fill="currentColor"/>'),
  inondation: svg('<path d="M12 2.8s-5.6 6.1-5.6 10a5.6 5.6 0 0 0 11.2 0c0-3.9-5.6-10-5.6-10z" fill="currentColor"/><path d="M9.4 13.6a2.8 2.8 0 0 0 2.6 2.4" style="stroke:var(--c)" stroke-width="1.8" stroke-linecap="round" fill="none"/>'),
};

// ------------------------------------------------------------------ Vocabulaire
const TYPES = {
  embouteillage: { label: 'Embouteillage', color: '#EF7D00' },
  accident: { label: 'Accident', color: '#B3122E' },
  route_barree: { label: 'Route barrée', color: '#263F73' },
  travaux: { label: 'Travaux', color: '#8A5A00' },
  inondation: { label: 'Inondation', color: '#0A6FB0' },
};
const SEVERITY = {
  1: { label: 'Léger', hint: 'ça roule au ralenti', color: '#D9A400' },
  2: { label: 'Moyen', hint: 'ça avance par à-coups', color: '#EF7D00' },
  3: { label: 'Bloqué', hint: "tout est à l'arrêt", color: '#D62828' },
};
const ROLES = { usager: 'Usager', taximan: 'Taximan', moto: 'Moto-taximan' };
const STATUS = {
  actif: ['tag--wait', 'En attente'],
  confirme: ['tag--ok', 'Confirmé'],
  retire: ['tag--bad', 'Retiré'],
  expire: ['tag--off', 'Expiré'],
};

const ERRORS = {
  network: 'Pas de connexion internet. Réessayez.',
  invalid_credentials: 'Numéro ou mot de passe incorrect.',
  'Invalid login credentials': 'Numéro ou mot de passe incorrect.',
  user_already_exists: 'Ce numéro a déjà un compte. Connectez-vous.',
  'User already registered': 'Ce numéro a déjà un compte. Connectez-vous.',
  weak_password: 'Mot de passe trop faible : 6 caractères minimum.',
  email_not_confirmed: "Compte pas encore activé. Contactez l'équipe Bouchnocam.",
  confirmation_required: "Compte créé mais pas encore activé. Contactez l'équipe Bouchnocam.",
  signup_disabled: 'Les inscriptions sont fermées pour le moment.',
  over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes.',
  over_email_send_rate_limit: 'Trop de tentatives. Patientez quelques minutes.',
  email_address_invalid: "Inscription refusée par le serveur. Contactez l'équipe Bouchnocam.",
  own_report: "C'est votre signalement : ce sont les autres usagers qui le confirment.",
  already_voted: 'Vous avez déjà donné votre avis sur ce signalement.',
  too_far: 'Vous devez être à moins de 3 km pour confirmer ou contester.',
  report_inactive: "Ce signalement n'est plus actif.",
  rate_limited: 'Trop de signalements en peu de temps. Réessayez dans un moment.',
  out_of_zone: 'Votre position est en dehors de la zone couverte (Cameroun).',
  gps_imprecise: 'Position GPS trop imprécise. Placez-vous à découvert et réessayez.',
  forbidden: 'Action réservée aux modérateurs.',
  auth_required: "Connectez-vous d'abord.",
  geo_denied: 'Localisation refusée. Autorisez-la dans les réglages du navigateur pour signaler.',
  geo_unavailable: 'Impossible de trouver votre position. Activez le GPS et réessayez.',
};
const msg = (e) => ERRORS[e?.code] || ERRORS[e?.message] || 'Une erreur est survenue. Réessayez.';

// ------------------------------------------------------------------ Outils
const isConfirmed = (r) => r.status === 'confirme' || r.confirmations >= CONFIG.confirmationsNeeded;
const reportColor = (r) => (r.type === 'embouteillage' ? SEVERITY[r.severity]?.color : TYPES[r.type]?.color) || '#555';
const reportLabel = (r) => (r.type === 'embouteillage' && r.severity
  ? `Embouteillage · ${SEVERITY[r.severity].label}` : TYPES[r.type]?.label || 'Signalement');

function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtDist = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`);
function ago(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;
  const d = Math.floor(h / 24);
  return `il y a ${d} jour${d > 1 ? 's' : ''}`;
}
function until(iso) {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 1) return "dans moins d'une minute";
  if (min < 60) return `dans ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `dans ${h} h`;
  const d = Math.round(h / 24);
  return `dans ${d} jour${d > 1 ? 's' : ''}`;
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const inCameroon = (p) => p.lat > 1.6 && p.lat < 13.1 && p.lng > 8.4 && p.lng < 16.2;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// ------------------------------------------------------------------ État
const state = {
  reports: new Map(),
  votes: new Map(),
  mine: new Set(),
  myReports: [],
  me: null,
  pos: null,
  geo: 'unknown',
  tab: 'map',
  install: null,
  userMovedMap: false,
  centeredOnUser: false,
  loadedOnce: false,
};

// ------------------------------------------------------------------ Habillage statique
$('#btn-report').innerHTML = `${ICON.megaphone}<span>Signaler</span>`;
$('#btn-locate').innerHTML = ICON.locate;
$('.sheet__close').innerHTML = ICON.close;
const TAB_LABELS = { map: ['map', 'Carte'], nearby: ['nearby', 'Autour de moi'], profile: ['profile', 'Profil'] };
document.querySelectorAll('.tabbar button').forEach((b) => {
  const [icon, label] = TAB_LABELS[b.dataset.tab];
  b.innerHTML = `${ICON[icon]}<span>${label}</span>`;
});

// ------------------------------------------------------------------ Toast
let toastTimer;
function toast(text, ms = 4200) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
$('#toast').addEventListener('click', () => { $('#toast').hidden = true; });

// ------------------------------------------------------------------ Feuilles
const sheetRoot = $('#sheet-root');
const sheetBody = $('.sheet__body', sheetRoot);
let sheetOpen = false;
let sheetName = null;
let ignoreNextPop = false;

function openSheet(name, html, onMount) {
  sheetName = name;
  sheetBody.innerHTML = html;
  sheetRoot.hidden = false;
  requestAnimationFrame(() => sheetRoot.classList.add('is-open'));
  if (!sheetOpen) {
    history.pushState({ sheet: true }, '');
    sheetOpen = true;
  }
  onMount?.(sheetBody);
}
function closeSheet({ fromPop = false } = {}) {
  if (!sheetOpen) return;
  sheetOpen = false;
  sheetName = null;
  sheetRoot.classList.remove('is-open');
  setTimeout(() => { if (!sheetOpen) { sheetRoot.hidden = true; sheetBody.innerHTML = ''; } }, 230);
  if (!fromPop) { ignoreNextPop = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (ignoreNextPop) { ignoreNextPop = false; return; }
  if (sheetOpen) closeSheet({ fromPop: true });
});
sheetRoot.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// ------------------------------------------------------------------ Carte
const map = L.map('map', { zoomControl: false, minZoom: 6, maxZoom: 19 }).setView(CONFIG.mapCenter, CONFIG.mapZoom);
L.tileLayer(CONFIG.tiles.url, {
  attribution: CONFIG.tiles.attribution, subdomains: CONFIG.tiles.subdomains,
  maxZoom: CONFIG.tiles.maxZoom, detectRetina: true,
}).addTo(map);
map.attributionControl.setPrefix(false);
const reportLayer = L.layerGroup().addTo(map);
const markers = new Map();
let userDot = null;
let userAcc = null;

map.on('dragstart', () => { state.userMovedMap = true; $('#btn-locate').classList.remove('is-active'); });
map.on('moveend', debounce(() => loadReports(), 350));

function pinIcon(r) {
  const confirmed = isConfirmed(r);
  return L.divIcon({
    className: 'pin-wrap',
    iconSize: [40, 40],
    iconAnchor: [20, 47],
    html: `<div class="pin ${confirmed ? 'is-confirmed' : 'is-pending'}" style="--c:${reportColor(r)}">${GLYPH[r.type] || ''}${confirmed ? `<span class="pin__badge">${ICON.check}</span>` : ''}</div>`,
  });
}

function renderMarkers() {
  for (const [id, m] of markers) {
    if (!state.reports.has(id)) { reportLayer.removeLayer(m); markers.delete(id); }
  }
  for (const r of state.reports.values()) {
    const key = `${r.type}|${r.severity}|${isConfirmed(r)}`;
    let m = markers.get(r.id);
    if (m && m.bcmKey === key) continue;
    if (m) reportLayer.removeLayer(m);
    m = L.marker([r.lat, r.lng], { icon: pinIcon(r), title: reportLabel(r), riseOnHover: true });
    m.bcmKey = key;
    m.on('click', () => openReport(r.id));
    m.addTo(reportLayer);
    markers.set(r.id, m);
  }
}

function pruneExpired() {
  const now = Date.now();
  let changed = false;
  for (const [id, r] of state.reports) {
    if (new Date(r.expires_at).getTime() <= now) { state.reports.delete(id); changed = true; }
  }
  if (changed) { renderMarkers(); renderNearby(); updateMapHint(); }
}

function updateMapHint() {
  const hint = $('#map-hint');
  const bounds = map.getBounds();
  const visible = [...state.reports.values()].some((r) => bounds.contains([r.lat, r.lng]));
  if (!state.loadedOnce || visible) { hint.hidden = true; return; }
  hint.innerHTML = '<strong>Aucun incident signalé ici pour le moment.</strong><br>Vous voyez un problème sur la route ? Appuyez sur « Signaler ».';
  hint.hidden = false;
}

let loading = null;
async function loadReports({ silent = true } = {}) {
  if (loading) return loading;
  const b = map.getBounds().pad(0.6);
  loading = (async () => {
    try {
      const rows = await api.fetchReports({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
      const now = Date.now();
      state.reports = new Map(rows.filter((r) => new Date(r.expires_at).getTime() > now).map((r) => [r.id, r]));
      state.loadedOnce = true;
      setOffline(false);
      renderMarkers();
      renderNearby();
      updateMapHint();
    } catch (e) {
      if (e.code === 'network') setOffline(true);
      else if (!silent) toast(msg(e));
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// ------------------------------------------------------------------ Géolocalisation
let watchId = null;
let wantCenter = false;

function startGeo({ center = false } = {}) {
  if (center) wantCenter = true;
  if (!('geolocation' in navigator)) { state.geo = 'unavailable'; if (center) toast(ERRORS.geo_unavailable); return; }
  if (watchId !== null) { if (center && state.pos) centerOnUser(); return; }
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError,
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 25000 });
}

function onPosition(p) {
  state.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() };
  state.geo = 'granted';
  drawUser();
  if (wantCenter || (!state.userMovedMap && !state.centeredOnUser)) {
    wantCenter = false;
    centerOnUser();
  }
  const line = $('#gps-line');
  if (line) line.outerHTML = gpsLine();
  if (state.tab === 'nearby') renderNearbySoon();
}

function onPositionError(err) {
  if (err.code === 1) {
    state.geo = 'denied';
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    if (wantCenter) toast(ERRORS.geo_denied, 6000);
    wantCenter = false;
  }
  const line = $('#gps-line');
  if (line) line.outerHTML = gpsLine();
}

function drawUser() {
  const ll = [state.pos.lat, state.pos.lng];
  if (!userDot) {
    userAcc = L.circle(ll, { radius: state.pos.acc, color: '#1A73E8', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
    userDot = L.marker(ll, { icon: L.divIcon({ className: 'pin-wrap', html: '<div class="user-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, zIndexOffset: -100 }).addTo(map);
  } else {
    userDot.setLatLng(ll);
    userAcc.setLatLng(ll).setRadius(state.pos.acc);
  }
}

function centerOnUser() {
  if (!state.pos) return;
  if (!inCameroon(state.pos)) { if (wantCenter) toast('Vous semblez hors du Cameroun : la carte reste sur Yaoundé.'); return; }
  state.centeredOnUser = true;
  state.userMovedMap = false;
  $('#btn-locate').classList.add('is-active');
  map.flyTo([state.pos.lat, state.pos.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
}

function getFreshPosition() {
  if (state.pos && Date.now() - state.pos.ts < 60000) return Promise.resolve(state.pos);
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new api.ApiError('geo_unavailable')); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      onPosition(p);
      resolve(state.pos);
    }, (err) => {
      onPositionError(err);
      reject(new api.ApiError(err.code === 1 ? 'geo_denied' : 'geo_unavailable'));
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
  });
}

function gpsLine() {
  let cls = '', text;
  if (state.geo === 'denied') { cls = 'is-bad'; text = 'Localisation refusée : autorisez-la pour signaler.'; }
  else if (state.pos && Date.now() - state.pos.ts < 120000) {
    const acc = Math.round(state.pos.acc);
    if (acc > 200) { cls = 'is-bad'; text = `Position imprécise (± ${acc} m). Placez-vous à découvert si possible.`; }
    else text = `Position GPS trouvée (± ${acc} m). Le signalement sera placé ici.`;
  } else text = 'Recherche de votre position…';
  return `<p class="gps-line ${cls}" id="gps-line">${ICON.gps}<span>${text}</span></p>`;
}

$('#btn-locate').addEventListener('click', () => startGeo({ center: true }));

// ------------------------------------------------------------------ Signaler
function openReportFlow() {
  if (!api.isSignedIn()) {
    openAuth({ mode: 'signup', reason: 'Créez un compte gratuit pour signaler et gagner des points.' });
    return;
  }
  startGeo();
  const sel = { type: null, severity: null };

  const render = () => {
    const ready = sel.type && (sel.type !== 'embouteillage' || sel.severity);
    openSheet('report', `
      <h2 class="sheet__title">Que se passe-t-il ici ?</h2>
      <p class="notice notice--warn">Au volant ? Laissez votre passager signaler.</p>
      <div class="type-grid">
        ${Object.entries(TYPES).map(([k, t]) => `
          <button type="button" class="type-tile ${sel.type === k ? 'is-selected' : ''}" data-type="${k}" style="--c:${t.color}" aria-pressed="${sel.type === k}">
            <span class="type-tile__icon">${GLYPH[k]}</span><span>${t.label}</span>
          </button>`).join('')}
      </div>
      ${sel.type === 'embouteillage' ? `
        <h3 class="sheet__sub">Quelle intensité ?</h3>
        <div class="sev-row">
          ${[1, 2, 3].map((s) => `
            <button type="button" class="sev ${sel.severity === s ? 'is-selected' : ''}" data-sev="${s}" style="--c:${SEVERITY[s].color}" aria-pressed="${sel.severity === s}">
              <strong>${SEVERITY[s].label}</strong><small>${SEVERITY[s].hint}</small>
            </button>`).join('')}
        </div>` : ''}
      ${gpsLine()}
      <button type="button" class="btn btn--primary btn--block" id="send-report" ${ready ? '' : 'disabled'}>Envoyer le signalement</button>
      <p class="fine" style="margin-top:10px;text-align:center">+10 points quand 2 autres usagers le confirment.</p>
    `, (el) => {
      el.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
        sel.type = b.dataset.type;
        if (sel.type !== 'embouteillage') sel.severity = null;
        render();
      }));
      el.querySelectorAll('[data-sev]').forEach((b) => b.addEventListener('click', () => {
        sel.severity = Number(b.dataset.sev);
        render();
      }));
      $('#send-report', el).addEventListener('click', (ev) => sendReport(sel, ev.currentTarget));
    });
  };
  render();
}

async function sendReport(sel, btn) {
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';
  try {
    const pos = await getFreshPosition();
    const res = await api.createReport({ type: sel.type, severity: sel.severity, lat: pos.lat, lng: pos.lng, accuracy: pos.acc });
    closeSheet();
    toast(res.merged
      ? 'Ce problème était déjà signalé ici : votre signalement compte comme une confirmation.'
      : 'Signalement envoyé, merci ! +10 points dès que 2 usagers le confirment.', 5500);
    state.userMovedMap = false;
    map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    await loadReports();
    refreshUser();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Envoyer le signalement';
    toast(msg(e), 6000);
  }
}

$('#btn-report').addEventListener('click', openReportFlow);

// ------------------------------------------------------------------ Détail d'un signalement
function openReport(id) {
  const r = state.reports.get(id);
  if (!r) return;
  const dist = state.pos ? distanceM(state.pos, r) : null;
  const confirmed = isConfirmed(r);
  const mine = state.mine.has(id);
  const voted = state.votes.get(id);

  let actions;
  if (!api.isSignedIn()) {
    actions = '<button type="button" class="btn btn--primary btn--block" data-act="login">Se connecter pour confirmer</button>';
  } else if (mine) {
    actions = '<p class="notice">C\'est votre signalement. Les autres usagers le confirmeront.</p>';
  } else if (voted) {
    actions = `<p class="notice notice--ok">Merci, vous avez répondu « ${voted > 0 ? 'Toujours là' : 'Plus là'} ».</p>`;
  } else if (dist !== null && dist > CONFIG.voteRadiusM) {
    actions = '<p class="notice">Approchez-vous à moins de 3 km pour confirmer ou contester.</p>';
  } else {
    actions = `
      <p style="margin:14px 0 8px;font-weight:600">Vous y êtes ? Dites-nous :</p>
      <div class="vote-row">
        <button type="button" class="btn btn--confirm" data-vote="1">${ICON.check}Toujours là</button>
        <button type="button" class="btn btn--ghost" data-vote="-1">${ICON.x}Plus là</button>
      </div>`;
  }
  const n = r.confirmations;
  openSheet('detail', `
    <div class="detail-head">
      <span class="detail-icon" style="--c:${reportColor(r)}">${GLYPH[r.type]}</span>
      <div>
        <h2 class="sheet__title">${esc(reportLabel(r))}</h2>
        <p class="muted">Signalé ${ago(r.created_at)}${dist !== null ? ` · à ${fmtDist(dist)}` : ''}</p>
      </div>
    </div>
    <div class="reliability ${confirmed ? 'is-ok' : ''}">
      ${confirmed ? `${ICON.check}Confirmé par ${n} usager${n > 1 ? 's' : ''}` : `En attente de confirmation (${n}/${CONFIG.confirmationsNeeded})`}
      ${r.contestations ? `<span class="muted" style="font-weight:500"> · ${r.contestations} « Plus là »</span>` : ''}
    </div>
    <p class="fine">Disparaît ${until(r.expires_at)} sans nouvelle confirmation.</p>
    ${actions}
    ${state.me?.is_admin ? '<button type="button" class="btn btn--danger btn--block" style="margin-top:14px" data-act="moderate">Retirer (modération)</button>' : ''}
  `, (el) => {
    el.querySelector('[data-act="login"]')?.addEventListener('click', () => openAuth({ mode: 'login' }));
    el.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => doVote(r, Number(b.dataset.vote), el)));
    el.querySelector('[data-act="moderate"]')?.addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true;
      try {
        await api.adminRemoveReport(r.id);
        state.reports.delete(r.id);
        renderMarkers(); renderNearby();
        closeSheet();
        toast('Signalement retiré.');
      } catch (e) { ev.currentTarget.disabled = false; toast(msg(e)); }
    });
  });
}

async function doVote(r, vote, el) {
  el.querySelectorAll('[data-vote]').forEach((b) => { b.disabled = true; });
  try {
    const pos = await getFreshPosition();
    const res = await api.voteReport({ id: r.id, vote, lat: pos.lat, lng: pos.lng });
    state.votes.set(r.id, vote);
    Object.assign(r, { status: res.status, confirmations: res.confirmations, contestations: res.contestations });
    if (res.status === 'retire') state.reports.delete(r.id);
    renderMarkers();
    renderNearby();
    closeSheet();
    if (res.status === 'retire') toast('Merci ! Le signalement a été retiré de la carte.');
    else if (vote > 0) toast(isConfirmed(r) ? 'Merci ! Signalement confirmé (+2 points).' : 'Merci ! Encore une confirmation et il sera validé.');
    else toast('Merci ! Votre avis est enregistré.');
    refreshUser();
  } catch (e) {
    el.querySelectorAll('[data-vote]').forEach((b) => { b.disabled = false; });
    if (e.code === 'already_voted') state.votes.set(r.id, vote);
    toast(msg(e), 6000);
  }
}

// ------------------------------------------------------------------ Connexion / inscription
function openAuth({ mode = 'login', reason = '' } = {}) {
  const signup = mode === 'signup';
  openSheet('auth', `
    <h2 class="sheet__title">${signup ? 'Créer mon compte' : 'Se connecter'}</h2>
    ${reason ? `<p class="muted">${esc(reason)}</p>` : ''}
    <form id="auth-form" novalidate>
      ${signup ? `
        <label class="field"><span>Nom ou surnom (visible dans le classement)</span>
          <input type="text" name="name" maxlength="40" autocomplete="nickname" required></label>` : ''}
      <label class="field"><span>Numéro de téléphone</span>
        <div class="phone-input"><b>+237</b><input type="tel" name="phone" inputmode="numeric" autocomplete="tel-national" placeholder="6XX XX XX XX" required></div></label>
      <label class="field"><span>Mot de passe${signup ? ' (6 caractères minimum)' : ''}</span>
        <input type="password" name="password" minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
      ${signup ? `
        <div class="field"><span>Je suis</span>
          <div class="role-row">
            ${Object.entries(ROLES).map(([k, l], i) => `<label><input type="radio" name="role" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          </div></div>
        <label class="check"><input type="checkbox" name="consent" required>
          <span>J'accepte les <button type="button" class="btn--link" data-act="privacy" style="min-height:0;border:0;background:none;color:var(--green);font-weight:600;padding:0;text-decoration:underline">règles et la confidentialité</button> du pilote Bouchnocam.</span></label>` : ''}
      <p class="form-error" id="auth-error"></p>
      <button type="submit" class="btn btn--primary btn--block">${signup ? 'Créer mon compte' : 'Se connecter'}</button>
    </form>
    <p class="switch-line">${signup
      ? 'Déjà un compte ? <button type="button" class="btn btn--link" data-act="switch">Se connecter</button>'
      : 'Pas encore de compte ? <button type="button" class="btn btn--link" data-act="switch">Créer un compte</button>'}</p>
    ${signup ? '' : '<p class="fine" style="text-align:center">Mot de passe oublié ? Appelez l\'équipe Bouchnocam au +237 681 03 12 18.</p>'}
  `, (el) => {
    el.querySelector('[data-act="switch"]').addEventListener('click', () => openAuth({ mode: signup ? 'login' : 'signup', reason }));
    el.querySelector('[data-act="privacy"]')?.addEventListener('click', () => openPrivacy({ back: () => openAuth({ mode, reason }) }));
    const form = $('#auth-form', el);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const err = $('#auth-error', el);
      const fd = new FormData(form);
      const phone = api.normalizePhone(fd.get('phone'));
      const password = String(fd.get('password') || '');
      const name = String(fd.get('name') || '').trim();
      if (signup && name.length < 2) { err.textContent = 'Indiquez un nom ou surnom (2 caractères minimum).'; return; }
      if (!phone) { err.textContent = 'Numéro invalide : 9 chiffres commençant par 6 ou 2.'; return; }
      if (password.length < 6) { err.textContent = 'Mot de passe : 6 caractères minimum.'; return; }
      if (signup && !fd.get('consent')) { err.textContent = 'Veuillez accepter les règles du pilote.'; return; }
      err.textContent = '';
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Un instant…';
      try {
        if (signup) await api.signUp({ phone, password, displayName: name, role: fd.get('role') });
        else await api.signIn({ phone, password });
        closeSheet();
        await refreshUser();
        toast(state.me ? `Bienvenue, ${state.me.display_name} !` : 'Vous êtes connecté.');
      } catch (e) {
        submit.disabled = false;
        submit.textContent = signup ? 'Créer mon compte' : 'Se connecter';
        err.textContent = msg(e);
      }
    });
  });
}

function openPrivacy({ back } = {}) {
  openSheet('privacy', `
    <h2 class="sheet__title">Règles et confidentialité</h2>
    <p class="muted">Bouchnocam est en phase pilote à Yaoundé.</p>
    <div class="card" style="box-shadow:none;background:var(--bg)">
      <h3>Ce que nous enregistrons</h3>
      <ul style="margin:0;padding-left:18px;font-size:14px">
        <li>Votre numéro de téléphone, uniquement pour vous connecter. Il n'est jamais affiché.</li>
        <li>Votre nom ou surnom et votre profil (usager, taximan, moto-taximan), visibles dans le classement.</li>
        <li>La position GPS de chaque signalement. Le signalement est public, sans votre nom.</li>
        <li>Vos confirmations. Votre position au moment d'une confirmation sert à vérifier la distance puis n'est pas conservée.</li>
      </ul>
      <p style="font-size:14px;margin:10px 0 0">Nous ne suivons pas vos trajets. Les données sont hébergées chez Supabase (Europe).</p>
    </div>
    <div class="card" style="box-shadow:none;background:var(--bg)">
      <h3>Les règles</h3>
      <ul style="margin:0;padding-left:18px;font-size:14px">
        <li>Ne signalez que ce que vous voyez vraiment, à l'endroit où vous êtes.</li>
        <li>Ne manipulez pas le téléphone en conduisant.</li>
        <li>Les fausses alertes font perdre des points et peuvent être retirées par la modération.</li>
      </ul>
    </div>
    <p class="fine">Pour supprimer votre compte ou poser une question : +237 681 03 12 18 · contacts.bouchnocam@gmail.com</p>
    ${back ? '<button type="button" class="btn btn--ghost btn--block" data-act="back">Retour</button>' : ''}
  `, (el) => el.querySelector('[data-act="back"]')?.addEventListener('click', back));
}

// ------------------------------------------------------------------ Utilisateur
async function refreshUser() {
  if (!api.isSignedIn()) {
    state.me = null;
    state.votes = new Map();
    state.mine = new Set();
    state.myReports = [];
    renderChrome();
    if (state.tab === 'profile') renderProfile();
    return;
  }
  try {
    const [me, votes, mine] = await Promise.all([api.fetchMe(), api.fetchMyVotes(), api.fetchMyReports()]);
    state.me = me;
    state.votes = new Map((votes || []).map((v) => [v.report_id, v.vote]));
    state.myReports = mine || [];
    state.mine = new Set(state.myReports.map((r) => r.id));
  } catch (e) {
    if (e.code !== 'network') console.warn('refreshUser', e);
  }
  renderChrome();
  if (state.tab === 'profile') renderProfile();
}

function renderChrome() {
  const chip = $('#points-chip');
  const login = $('#login-chip');
  if (api.isSignedIn() && state.me) {
    chip.innerHTML = `${ICON.star}${state.me.points} pts`;
    chip.hidden = false;
    login.hidden = true;
  } else {
    chip.hidden = true;
    login.hidden = api.isSignedIn();
  }
}
$('#points-chip').addEventListener('click', () => setTab('profile'));
$('#login-chip').addEventListener('click', () => openAuth({ mode: 'login' }));
api.onSessionChange(() => renderChrome());

// ------------------------------------------------------------------ Onglets
function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabbar button').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#view-nearby').hidden = tab !== 'nearby';
  $('#view-profile').hidden = tab !== 'profile';
  $('#btn-report').hidden = tab === 'profile';
  if (tab === 'map') map.invalidateSize();
  if (tab === 'nearby') { renderNearby(); loadReports(); }
  if (tab === 'profile') { renderProfile(); refreshUser(); loadLeaderboard(); }
}
document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

// ------------------------------------------------------------------ Autour de moi
const renderNearbySoon = debounce(() => renderNearby(), 1500);
function renderNearby() {
  if (state.tab !== 'nearby') return;
  const el = $('#view-nearby');
  const list = [...state.reports.values()].map((r) => ({ r, d: state.pos ? distanceM(state.pos, r) : null }));
  if (state.pos) list.sort((a, b) => a.d - b.d);
  else list.sort((a, b) => new Date(b.r.created_at) - new Date(a.r.created_at));
  const rows = list.slice(0, 50).map(({ r, d }) => {
    const ok = isConfirmed(r);
    return `<button type="button" class="row-btn" data-id="${r.id}">
      <span class="row-btn__icon" style="--c:${reportColor(r)}">${GLYPH[r.type]}</span>
      <span class="row-btn__main"><strong>${esc(reportLabel(r))}</strong>
        <small>${d !== null ? `${fmtDist(d)} · ` : ''}${ago(r.created_at)}</small></span>
      <span class="tag ${ok ? 'tag--ok' : 'tag--wait'}">${ok ? `${ICON.check}Confirmé` : `${r.confirmations}/${CONFIG.confirmationsNeeded}`}</span>
    </button>`;
  }).join('');
  el.innerHTML = `
    <h2 class="panel-title">Autour de moi</h2>
    <p class="panel-sub">${state.pos ? 'Incidents actifs, du plus proche au plus loin.' : 'Incidents actifs, du plus récent au plus ancien.'}</p>
    ${state.pos ? '' : `<div class="card"><p style="margin:0 0 10px">Activez votre position pour voir les incidents les plus proches de vous.</p>
      <button type="button" class="btn btn--primary btn--block" data-act="geo">${ICON.locate}Activer ma position</button></div>`}
    <div class="card" style="padding-top:4px;padding-bottom:4px">
      ${rows || `<div class="empty">${ICON.check}<p style="margin:0">Aucun incident signalé dans cette zone.<br>La route semble dégagée.</p></div>`}
    </div>
    <button type="button" class="btn btn--ghost btn--block" data-act="refresh">${ICON.refresh}Actualiser</button>`;
  el.querySelector('[data-act="geo"]')?.addEventListener('click', () => startGeo());
  el.querySelector('[data-act="refresh"]').addEventListener('click', async () => { await loadReports({ silent: false }); toast('Liste à jour.', 1800); });
  el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
    const r = state.reports.get(b.dataset.id);
    if (!r) return;
    setTab('map');
    state.userMovedMap = true;
    map.setView([r.lat, r.lng], Math.max(map.getZoom(), 16));
    openReport(r.id);
  }));
}

// ------------------------------------------------------------------ Profil
let leaderboard = null;
async function loadLeaderboard() {
  try { leaderboard = await api.fetchLeaderboard(); } catch { /* garde l'ancien */ }
  if (state.tab === 'profile') renderProfile();
}

const RULES_HTML = `
  <ul class="rules">
    <li><span>Votre signalement est confirmé par 2 usagers</span><b>+10 pts</b></li>
    <li><span>Vous confirmez un incident réel</span><b>+2 pts</b></li>
    <li><span>Vous signalez la fin d'un incident</span><b>+2 pts</b></li>
    <li><span>Votre signalement est contesté</span><b style="color:var(--red)">−5 pts</b></li>
  </ul>`;

function installCard() {
  if (isStandalone()) return '';
  return `<div class="card">
    <h3>Installer Bouchnocam</h3>
    <p class="fine" style="margin-bottom:10px">Ajoutez l'application à votre écran d'accueil : elle s'ouvre plus vite et en plein écran.</p>
    <button type="button" class="btn btn--primary btn--block" data-act="install">${ICON.install}Installer l'application</button>
  </div>`;
}

function renderProfile() {
  const el = $('#view-profile');
  const board = (leaderboard || []).map((p, i) => `
    <div class="leader ${p.id === api.currentUserId() ? 'is-me' : ''}">
      <span class="leader__rank">${i + 1}</span>
      <span class="leader__name"><strong>${esc(p.display_name)}</strong><small>${ROLES[p.role] || ''}</small></span>
      <b>${p.points} pts</b>
    </div>`).join('') || '<p class="fine" style="margin:0">Personne n\'a encore de points. Soyez le premier !</p>';

  if (!api.isSignedIn()) {
    el.innerHTML = `
      <h2 class="panel-title">Profil</h2>
      <p class="panel-sub">Signalez, confirmez, gagnez des points.</p>
      <div class="card">
        <p style="margin:0 0 12px">Créez un compte gratuit pour signaler les incidents, confirmer ceux des autres et apparaître dans le classement.</p>
        <div class="stack">
          <button type="button" class="btn btn--primary btn--block" data-act="signup">Créer un compte</button>
          <button type="button" class="btn btn--ghost btn--block" data-act="login">J'ai déjà un compte</button>
        </div>
      </div>
      <div class="card"><h3>Comment gagner des points</h3>${RULES_HTML}</div>
      <div class="card"><h3>Classement</h3>${board}</div>
      ${installCard()}
      <button type="button" class="btn btn--link btn--block" data-act="privacy">${ICON.shield}Règles et confidentialité</button>`;
  } else {
    const me = state.me;
    const hist = state.myReports.map((r) => {
      const [cls, label] = STATUS[r.status] || STATUS.expire;
      return `<div class="row-btn" style="cursor:default">
        <span class="row-btn__icon" style="--c:${reportColor(r)}">${GLYPH[r.type]}</span>
        <span class="row-btn__main"><strong>${esc(reportLabel(r))}</strong>
          <small>${ago(r.created_at)} · ${r.confirmations} confirmation${r.confirmations > 1 ? 's' : ''}${r.points ? ` · ${r.points > 0 ? '+' : ''}${r.points} pts` : ''}</small></span>
        <span class="tag ${cls}">${label}</span>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div class="hero">
        <div class="hero__name">${esc(me?.display_name || '…')}</div>
        <div class="hero__role">${ROLES[me?.role] || ''}${me?.is_admin ? ' · Modérateur' : ''}</div>
        <div class="hero__points"><b>${me?.points ?? 0}</b><span>points</span></div>
      </div>
      <div class="stats">
        <div class="stat"><b>${me ? `${me.rank}<sup style="font-size:12px">e</sup>` : '–'}</b><span>au classement</span></div>
        <div class="stat"><b>${me?.reports_count ?? 0}</b><span>signalements</span></div>
        <div class="stat"><b>${me?.confirmed_count ?? 0}</b><span>confirmés</span></div>
      </div>
      <div class="card" style="padding-top:12px;padding-bottom:4px"><h3>Mes signalements</h3>
        ${hist || '<p class="fine" style="margin:0 0 12px">Aucun signalement pour l\'instant. Appuyez sur « Signaler » quand vous voyez un problème.</p>'}
      </div>
      <div class="card"><h3>Classement</h3>${board}</div>
      <div class="card"><h3>Comment gagner des points</h3>${RULES_HTML}</div>
      ${installCard()}
      <div class="card">
        <h3>Mon compte</h3>
        <div class="stack">
          <button type="button" class="btn btn--ghost btn--block" data-act="edit">Modifier mon nom ou mon profil</button>
          <button type="button" class="btn btn--ghost btn--block" data-act="privacy">${ICON.shield}Règles et confidentialité</button>
          <button type="button" class="btn btn--danger btn--block" data-act="logout">Se déconnecter</button>
        </div>
      </div>`;
  }
  el.querySelector('[data-act="signup"]')?.addEventListener('click', () => openAuth({ mode: 'signup' }));
  el.querySelector('[data-act="login"]')?.addEventListener('click', () => openAuth({ mode: 'login' }));
  el.querySelector('[data-act="privacy"]')?.addEventListener('click', () => openPrivacy());
  el.querySelector('[data-act="install"]')?.addEventListener('click', installApp);
  el.querySelector('[data-act="edit"]')?.addEventListener('click', openEditProfile);
  el.querySelector('[data-act="logout"]')?.addEventListener('click', async () => {
    await api.signOut();
    await refreshUser();
    toast('Vous êtes déconnecté.');
  });
}

function openEditProfile() {
  const me = state.me || {};
  openSheet('edit', `
    <h2 class="sheet__title">Mon profil</h2>
    <form id="edit-form">
      <label class="field"><span>Nom ou surnom</span>
        <input type="text" name="name" maxlength="40" value="${esc(me.display_name)}" required></label>
      <div class="field"><span>Je suis</span>
        <div class="role-row">
          ${Object.entries(ROLES).map(([k, l]) => `<label><input type="radio" name="role" value="${k}" ${me.role === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div></div>
      <p class="form-error" id="edit-error"></p>
      <button type="submit" class="btn btn--primary btn--block">Enregistrer</button>
    </form>
  `, (el) => {
    $('#edit-form', el).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.currentTarget);
      const name = String(fd.get('name') || '').trim();
      if (name.length < 2) { $('#edit-error', el).textContent = 'Nom trop court.'; return; }
      try {
        await api.updateProfile({ displayName: name, role: fd.get('role') });
        closeSheet();
        await refreshUser();
        loadLeaderboard();
        toast('Profil mis à jour.');
      } catch (e) { $('#edit-error', el).textContent = msg(e); }
    });
  });
}

// ------------------------------------------------------------------ Installation (PWA)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.install = e;
});
window.addEventListener('appinstalled', () => {
  state.install = null;
  toast('Bouchnocam est installé sur votre écran d\'accueil.');
  if (state.tab === 'profile') renderProfile();
});

async function installApp() {
  if (state.install) {
    state.install.prompt();
    try { await state.install.userChoice; } catch { /* ignoré */ }
    state.install = null;
    return;
  }
  openSheet('install', isIOS() ? `
    <h2 class="sheet__title">Installer sur iPhone</h2>
    <ol style="padding-left:20px;margin:0 0 16px">
      <li>Ouvrez cette page dans <strong>Safari</strong>.</li>
      <li>Touchez le bouton <strong>Partager</strong> (carré avec une flèche).</li>
      <li>Choisissez <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.</li>
    </ol>
    <button type="button" class="btn btn--primary btn--block" data-close>J'ai compris</button>` : `
    <h2 class="sheet__title">Installer l'application</h2>
    <ol style="padding-left:20px;margin:0 0 16px">
      <li>Ouvrez cette page dans <strong>Chrome</strong>.</li>
      <li>Touchez le menu <strong>⋮</strong> en haut à droite.</li>
      <li>Choisissez <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.</li>
    </ol>
    <button type="button" class="btn btn--primary btn--block" data-close>J'ai compris</button>`);
}

// ------------------------------------------------------------------ Bienvenue
function maybeOnboard() {
  if (store.get('bcm.onboarded')) return;
  openSheet('onboarding', `
    <h2 class="sheet__title">Bienvenue sur Bouchnocam</h2>
    <p class="muted">La carte des routes de Yaoundé, tenue à jour par ceux qui y roulent.</p>
    <ul class="onb">
      <li><span class="onb__icon" style="--c:var(--red)">${ICON.megaphone}</span>
        <span><strong>Signale</strong><span>Embouteillage, accident, route barrée : 2 touches suffisent.</span></span></li>
      <li><span class="onb__icon" style="--c:var(--green)">${ICON.check}</span>
        <span><strong>Confirme</strong><span>Vous passez devant ? Dites « Toujours là » ou « Plus là ».</span></span></li>
      <li><span class="onb__icon" style="--c:#C99A00">${ICON.star}</span>
        <span><strong>Gagne</strong><span>Des points quand vos signalements sont confirmés par d'autres.</span></span></li>
    </ul>
    <div class="stack">
      <button type="button" class="btn btn--primary btn--block" data-act="geo">${ICON.locate}Activer ma position</button>
      <button type="button" class="btn btn--ghost btn--block" data-close>Plus tard</button>
    </div>
    <p class="fine" style="margin-top:12px;text-align:center">Votre position sert à placer la carte et vos signalements. Nous ne suivons pas vos trajets.</p>
  `, (el) => {
    el.querySelector('[data-act="geo"]').addEventListener('click', () => { closeSheet(); startGeo({ center: true }); });
  });
  store.set('bcm.onboarded', '1');
}

// ------------------------------------------------------------------ Connexion réseau
function setOffline(off) { $('#offline-banner').hidden = !off; }
window.addEventListener('online', () => { setOffline(false); loadReports(); });
window.addEventListener('offline', () => setOffline(true));

// ------------------------------------------------------------------ Démarrage
async function boot() {
  renderChrome();
  loadReports();
  refreshUser();
  try {
    const perm = await navigator.permissions?.query({ name: 'geolocation' });
    if (perm?.state === 'granted') startGeo();
    else if (perm?.state === 'denied') state.geo = 'denied';
  } catch { /* API absente : on attend un geste de l'usager */ }
  maybeOnboard();

  setInterval(() => {
    if (document.visibilityState === 'visible') { loadReports(); pruneExpired(); }
  }, CONFIG.refreshMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { loadReports(); refreshUser(); }
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }
}
boot();
