// Client Supabase minimal (Auth + PostgREST + Edge Functions), sans dépendance externe.
import { CONFIG } from './config';
import type { TrafficCell, EmergencyResult, Hospital, Leader, Me, MyReport, Report, ReportType, Role, Severity } from './types';

const SESSION_KEY = 'bcm.session';

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 0) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function readSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

let session: Session | null = readSession();
let refreshing: Promise<void> | null = null;
const listeners = new Set<() => void>();

function writeSession(next: Session | null) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* stockage indisponible */ }
  listeners.forEach((fn) => fn());
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id: string };
}

function storeAuth(d: AuthResponse) {
  if (!d.access_token || !d.refresh_token || !d.user) throw new ApiError('confirmation_required', 200);
  writeSession({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user_id: d.user.id,
  });
}

export const onSessionChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const isSignedIn = () => Boolean(session?.access_token);
export const currentUserId = () => session?.user_id ?? null;

async function ensureFresh() {
  if (!session || session.expires_at * 1000 - Date.now() > 60_000) return;
  refreshing ??= (async () => {
    try {
      const d = await http<AuthResponse>('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: session?.refresh_token }, auth: false,
      });
      storeAuth(d);
    } catch (e) {
      if ((e as ApiError).code !== 'network') writeSession(null);
    } finally {
      refreshing = null;
    }
  })();
  await refreshing;
}

interface HttpOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

async function http<T>(path: string, { method = 'GET', body, auth = true, headers = {}, timeoutMs = 20000 }: HttpOptions = {}): Promise<T> {
  const h: Record<string, string> = { apikey: CONFIG.supabaseKey, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (auth && session) {
    await ensureFresh();
    if (session) h.Authorization = `Bearer ${session.access_token}`;
  }
  let res: Response;
  try {
    res = await fetch(CONFIG.supabaseUrl + path, {
      method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError('network');
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const d = (data || {}) as Record<string, string>;
    const code = d.error_code || d.message || d.msg || d.error_description || d.error || `http_${res.status}`;
    if (res.status === 401 && auth && session && /jwt|token/i.test(String(code))) writeSession(null);
    throw new ApiError(String(code), res.status);
  }
  return data as T;
}

// ---------------------------------------------------------------- Comptes
export function normalizePhone(input: string): string | null {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00237')) d = d.slice(5);
  else if (d.startsWith('237') && d.length === 12) d = d.slice(3);
  return /^[62]\d{8}$/.test(d) ? d : null;
}

const phoneToEmail = (digits: string) => `237${digits}@${CONFIG.phoneEmailDomain}`;

export async function signUp(p: { phone: string; password: string; displayName: string; role: Role }) {
  // Le compte est créé côté serveur, déjà activé (aucun e-mail envoyé), puis on se connecte.
  await http<{ ok: boolean }>('/functions/v1/phone-signup', {
    method: 'POST', auth: false, timeoutMs: 25000,
    body: { phone: p.phone, password: p.password, display_name: p.displayName, role: p.role },
  });
  await signIn({ phone: p.phone, password: p.password });
}

export async function signIn(p: { phone: string; password: string }) {
  const d = await http<AuthResponse>('/auth/v1/token?grant_type=password', {
    method: 'POST', auth: false, body: { email: phoneToEmail(p.phone), password: p.password },
  });
  storeAuth(d);
}

export async function signOut() {
  try { await http('/auth/v1/logout', { method: 'POST' }); } catch { /* sans importance */ }
  writeSession(null);
}

// ---------------------------------------------------------------- Données
const REPORT_COLUMNS = 'id,type,severity,lat,lng,status,confirmations,contestations,created_at,expires_at';

export function fetchReports(b: { south: number; west: number; north: number; east: number }) {
  const q = new URLSearchParams();
  q.set('select', REPORT_COLUMNS);
  q.append('lat', `gte.${b.south}`);
  q.append('lat', `lte.${b.north}`);
  q.append('lng', `gte.${b.west}`);
  q.append('lng', `lte.${b.east}`);
  q.set('order', 'created_at.desc');
  q.set('limit', '500');
  return http<Report[]>(`/rest/v1/reports?${q}`);
}

export const createReport = (p: { type: ReportType; severity: Severity | null; lat: number; lng: number; accuracy: number; place: string | null }) =>
  http<{ id: string; merged: boolean }>('/rest/v1/rpc/create_report', {
    method: 'POST',
    body: { p_type: p.type, p_severity: p.severity, p_lat: p.lat, p_lng: p.lng, p_accuracy: Math.round(p.accuracy), p_place: p.place },
  });

export const cancelReport = (id: string) =>
  http<void>('/rest/v1/rpc/cancel_report', { method: 'POST', body: { p_report_id: id } });

export const voteReport = (p: { id: string; vote: 1 | -1; lat: number; lng: number }) =>
  http<{ id: string; status: Report['status']; confirmations: number; contestations: number }>('/rest/v1/rpc/vote_report', {
    method: 'POST', body: { p_report_id: p.id, p_vote: p.vote, p_lat: p.lat, p_lng: p.lng },
  });

export const fetchMe = () => http<Me | null>('/rest/v1/rpc/me', { method: 'POST', body: {} });
export const fetchMyReports = () => http<MyReport[]>('/rest/v1/rpc/my_reports', { method: 'POST', body: { p_limit: 30 } });
export const fetchMyVotes = () => http<{ report_id: string; vote: number }[]>('/rest/v1/votes?select=report_id,vote&order=created_at.desc&limit=500');

export const fetchLeaderboard = () =>
  http<Leader[]>('/rest/v1/profiles?select=id,display_name,role,points&points=gt.0&order=points.desc&limit=20');

export const updateProfile = (p: { displayName: string; role: Role }) =>
  http<void>(`/rest/v1/profiles?id=eq.${encodeURIComponent(currentUserId() || '')}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { display_name: p.displayName, role: p.role },
  });

export const adminRemoveReport = (id: string) =>
  http<void>('/rest/v1/rpc/admin_remove_report', { method: 'POST', body: { p_report_id: id } });

export const fetchHospitals = () =>
  http<Hospital[]>('/rest/v1/hospitals?select=id,name,lat,lng,phone,emergency_24h,verified&limit=1000', { auth: false });

export const emergencyRoute = (p: { lat: number; lng: number }) =>
  http<EmergencyResult>('/functions/v1/emergency-route', { method: 'POST', body: p, auth: false, timeoutMs: 30000 });

export const ingestProbes = (session: string, role: Role, points: unknown[]) =>
  http<number>('/rest/v1/rpc/ingest_probes', { method: 'POST', body: { p_session: session, p_role: role, p_points: points } });

export const fetchTraffic = (b: { south: number; west: number; north: number; east: number }) =>
  http<TrafficCell[]>('/rest/v1/rpc/traffic_now', {
    method: 'POST', auth: false,
    body: { p_south: b.south, p_west: b.west, p_north: b.north, p_east: b.east, p_min_vehicles: 3 },
  });
