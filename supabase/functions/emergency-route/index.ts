// Bouchnocam — fonction Urgence
// Entrée : { lat, lng } (position de l'usager)
// Sortie : les 3 hôpitaux candidats, avec un itinéraire openrouteservice qui contourne
//          les incidents actifs signalés dans le secteur, triés par durée.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Pt = { lat: number; lng: number };
type Hospital = Pt & { id: number; name: string; phone: string | null; emergency_24h: boolean; verified: boolean };
type Incident = Pt & { type: string; severity: number | null };

const R = 6371000;
const rad = Math.PI / 180;
function dist(a: Pt, b: Pt) {
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Octogone d'environ `m` mètres autour d'un point, au format GeoJSON [lng, lat]
function octagon(p: Pt, m: number) {
  const dLat = m / 111320;
  const dLng = m / (111320 * Math.cos(p.lat * rad));
  const ring: number[][] = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI / 4) * i;
    ring.push([p.lng + dLng * Math.cos(a), p.lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return [ring];
}

// Distance (m) d'un point à une polyligne [lng, lat], en projection locale
function distToLine(p: Pt, line: number[][]) {
  const kx = 111320 * Math.cos(p.lat * rad);
  const ky = 111320;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i += 1) {
    const ax = (line[i][0] - p.lng) * kx, ay = (line[i][1] - p.lat) * ky;
    const bx = (line[i + 1][0] - p.lng) * kx, by = (line[i + 1][1] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

// Pénalité (secondes) quand l'itinéraire passe malgré tout par un incident
const penalty = (i: Incident) =>
  i.type === 'embouteillage' ? ((i.severity ?? 0) >= 3 ? 600 : 300) : 900;

// Incidents qui ralentissent ou bloquent un véhicule
const blocking = (i: Incident) =>
  ['accident', 'route_barree', 'inondation'].includes(i.type) || (i.type === 'embouteillage' && (i.severity ?? 0) >= 2);

let cachedKey: string | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { lat?: unknown; lng?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const from = { lat: Number(body?.lat), lng: Number(body?.lng) };
  if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng)
    || from.lat < 1.6 || from.lat > 13.1 || from.lng < 8.4 || from.lng > 16.2) {
    return json({ error: 'out_of_zone' }, 400);
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const key = Deno.env.get('ORS_API_KEY') || cachedKey || (await sb.rpc('get_ors_key')).data as string | null;
  cachedKey = key;

  const { data: hs, error: hErr } = await sb.from('hospitals')
    .select('id,name,lat,lng,phone,emergency_24h,verified').eq('active', true);
  if (hErr || !hs?.length) return json({ error: 'no_hospitals' }, 503);

  // Les hôpitaux vérifiés avec urgences 24h/24 sont favorisés (distance pondérée)
  const ranked = (hs as Hospital[])
    .map((h) => ({ h, d: dist(from, h) }))
    .sort((a, b) => (a.d * (a.h.verified && a.h.emergency_24h ? 0.75 : 1)) - (b.d * (b.h.verified && b.h.emergency_24h ? 0.75 : 1)))
    .slice(0, 3);

  // Incidents actifs dans le secteur (cadre englobant + 2 km)
  const pts = [from, ...ranked.map((r) => r.h)];
  const pad = 0.02;
  const south = Math.min(...pts.map((p) => p.lat)) - pad;
  const north = Math.max(...pts.map((p) => p.lat)) + pad;
  const west = Math.min(...pts.map((p) => p.lng)) - pad;
  const east = Math.max(...pts.map((p) => p.lng)) + pad;
  const { data: inc } = await sb.from('reports').select('type,severity,lat,lng')
    .in('status', ['actif', 'confirme']).gt('expires_at', new Date().toISOString())
    .gte('lat', south).lte('lat', north).gte('lng', west).lte('lng', east).limit(200);
  const incidents = ((inc || []) as Incident[]).filter(blocking);

  async function route(to: Hospital) {
    // On n'évite pas un incident collé au départ ou à l'arrivée (sinon aucun itinéraire possible)
    const avoid = incidents.filter((i) => dist(i, from) > 120 && dist(i, to) > 120);
    const call = async (withAvoid: boolean) => {
      const payload: Record<string, unknown> = {
        coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
        instructions: false,
        preference: 'fastest',
      };
      if (withAvoid && avoid.length) {
        payload.options = { avoid_polygons: { type: 'MultiPolygon', coordinates: avoid.map((i) => octagon(i, 100)) } };
      }
      const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { Authorization: key!, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`ors_${res.status}`);
      const g = await res.json();
      const f = g?.features?.[0];
      if (!f) throw new Error('ors_empty');
      return {
        distance_m: Math.round(f.properties.summary.distance),
        duration_s: Math.round(f.properties.summary.duration),
        geometry: f.geometry.coordinates as number[][],
      };
    };
    const onRoute = (geometry: number[][]) => incidents.filter((i) => distToLine(i, geometry) < 60);
    const finish = (r: { distance_m: number; duration_s: number; geometry: number[][] }, avoided: number) => {
      const crossed = onRoute(r.geometry);
      return {
        ...r,
        avoided: Math.max(0, avoided - crossed.length),
        incidents_on_route: crossed.length,
        score_s: r.duration_s + crossed.reduce((t, i) => t + penalty(i), 0),
        routed: true,
      };
    };
    try {
      return finish(await call(true), avoid.length);
    } catch {
      try {
        return finish(await call(false), 0);
      } catch {
        const d = Math.round(dist(from, to));
        return { distance_m: d, duration_s: null, geometry: null, avoided: 0, incidents_on_route: 0, score_s: d / 8, routed: false };
      }
    }
  }

  const results = key
    ? await Promise.all(ranked.map(async ({ h }) => ({ hospital: h, ...(await route(h)) })))
    : ranked.map(({ h, d }) => ({
      hospital: h, distance_m: Math.round(d), duration_s: null, geometry: null,
      avoided: 0, incidents_on_route: 0, score_s: d / 8, routed: false,
    }));

  results.sort((a, b) => a.score_s - b.score_s);

  return json({ incidents_in_area: incidents.length, results });
});
