// Client Supabase minimal (Auth + PostgREST), sans dépendance externe.
import { CONFIG } from './config.js';

const SESSION_KEY = 'bcm.session';
let session = readSession();
let refreshing = null;
const listeners = new Set();

export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function writeSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* stockage indisponible : session en mémoire seulement */ }
  listeners.forEach((fn) => fn(session));
}

function storeAuthResponse(d) {
  writeSession({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user_id: d.user?.id,
  });
}

export const onSessionChange = (fn) => listeners.add(fn);
export const isSignedIn = () => Boolean(session?.access_token);
export const currentUserId = () => session?.user_id || null;

async function ensureFresh() {
  if (!session) return;
  if (session.expires_at * 1000 - Date.now() > 60_000) return;
  refreshing ??= (async () => {
    try {
      const d = await http('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: session.refresh_token }, auth: false,
      });
      storeAuthResponse(d);
    } catch (e) {
      if (e.code !== 'network') writeSession(null);
    } finally {
      refreshing = null;
    }
  })();
  await refreshing;
}

async function http(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const h = { apikey: CONFIG.supabaseKey, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (auth && session) {
    await ensureFresh();
    if (session) h.Authorization = `Bearer ${session.access_token}`;
  }
  let res;
  try {
    res = await fetch(CONFIG.supabaseUrl + path, {
      method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const code = (data && (data.error_code || data.message || data.msg || data.error_description || data.error))
      || `http_${res.status}`;
    if (res.status === 401 && auth && session && /jwt|token/i.test(String(code))) writeSession(null);
    throw new ApiError(String(code), res.status);
  }
  return data;
}

// ---------------------------------------------------------------- Auth
export function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00237')) d = d.slice(5);
  else if (d.startsWith('237') && d.length === 12) d = d.slice(3);
  return /^[62]\d{8}$/.test(d) ? d : null;
}

const phoneToEmail = (digits) => `237${digits}@${CONFIG.phoneEmailDomain}`;

export async function signUp({ phone, password, displayName, role }) {
  const d = await http('/auth/v1/signup', {
    method: 'POST', auth: false,
    body: { email: phoneToEmail(phone), password, data: { display_name: displayName, role } },
  });
  if (!d?.access_token) throw new ApiError('confirmation_required', 200);
  storeAuthResponse(d);
}

export async function signIn({ phone, password }) {
  const d = await http('/auth/v1/token?grant_type=password', {
    method: 'POST', auth: false, body: { email: phoneToEmail(phone), password },
  });
  storeAuthResponse(d);
}

export async function signOut() {
  try { await http('/auth/v1/logout', { method: 'POST' }); } catch { /* sans importance */ }
  writeSession(null);
}

// ---------------------------------------------------------------- Données
const REPORT_COLUMNS = 'id,type,severity,lat,lng,status,confirmations,contestations,created_at,expires_at';

export function fetchReports({ south, west, north, east }) {
  const q = new URLSearchParams();
  q.set('select', REPORT_COLUMNS);
  q.append('lat', `gte.${south}`);
  q.append('lat', `lte.${north}`);
  q.append('lng', `gte.${west}`);
  q.append('lng', `lte.${east}`);
  q.set('order', 'created_at.desc');
  q.set('limit', '500');
  return http(`/rest/v1/reports?${q}`);
}

export const createReport = ({ type, severity, lat, lng, accuracy }) =>
  http('/rest/v1/rpc/create_report', {
    method: 'POST',
    body: { p_type: type, p_severity: severity ?? null, p_lat: lat, p_lng: lng, p_accuracy: accuracy ?? null },
  });

export const voteReport = ({ id, vote, lat, lng }) =>
  http('/rest/v1/rpc/vote_report', {
    method: 'POST', body: { p_report_id: id, p_vote: vote, p_lat: lat, p_lng: lng },
  });

export const fetchMe = () => http('/rest/v1/rpc/me', { method: 'POST', body: {} });
export const fetchMyReports = () => http('/rest/v1/rpc/my_reports', { method: 'POST', body: { p_limit: 30 } });
export const fetchMyVotes = () => http('/rest/v1/votes?select=report_id,vote&order=created_at.desc&limit=500');

export const fetchLeaderboard = () =>
  http('/rest/v1/profiles?select=id,display_name,role,points&points=gt.0&order=points.desc&limit=20');

export const updateProfile = ({ displayName, role }) =>
  http(`/rest/v1/profiles?id=eq.${encodeURIComponent(currentUserId())}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: { display_name: displayName, role },
  });

export const adminRemoveReport = (id) =>
  http('/rest/v1/rpc/admin_remove_report', { method: 'POST', body: { p_report_id: id } });
