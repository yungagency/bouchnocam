/// <reference types="google.maps" />
// Carte Google Maps avec la couche trafic en temps réel (routes colorées vert / orange / rouge),
// et les signalements Bouchnocam par-dessus. Si Google ne se charge pas, on repasse sur Leaflet.
import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../../lib/config';
import { isConfirmed, reportColor, reportLabel } from '../../lib/format';
import { getState, loadReports, markUserMovedMap, openOverlay, registerMap, useApp } from '../../lib/store';
import type { Report } from '../../lib/types';
import { CHECK_SVG, GLYPH_SVG, HOSPITAL_SVG } from '../../ui/icons';

type G = typeof google;
let loader: Promise<G> | null = null;
let authFailedHandler: (() => void) | null = null;

function loadGoogleMaps(key: string): Promise<G> {
  if (loader) return loader;
  loader = new Promise<G>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown> & { google?: G };
    if (w.google?.maps) { resolve(w.google); return; }
    const timer = setTimeout(() => reject(new Error('timeout')), 15000);
    w.__bcmGoogleReady = () => { clearTimeout(timer); resolve((window as unknown as { google: G }).google); };
    // Clé invalide ou facturation non activée : Google appelle cette fonction
    w.gm_authFailure = () => { authFailedHandler?.(); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=fr&region=CM&loading=async&callback=__bcmGoogleReady`;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); reject(new Error('load')); };
    document.head.appendChild(s);
  }).catch((e) => { loader = null; throw e; });
  return loader;
}

// Style épuré : on garde les routes et les noms de quartiers, on retire le bruit (commerces, transports)
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', elementType: 'labels', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#DDEEDD' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F3F5F2' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE3F2' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

const svgUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

function pinSvg(r: Report, small: boolean) {
  const color = reportColor(r);
  const ok = isConfirmed(r);
  const glyph = (GLYPH_SVG[r.type] || '')
    .replace('<svg ', '<svg x="10" y="8" width="24" height="24" ')
    .replace(/var\(--c\)/g, color)
    .replace(/currentColor/g, '#fff');
  const badge = ok
    ? `<circle cx="36" cy="9" r="8" fill="#14773A" stroke="#fff" stroke-width="2"/>${CHECK_SVG.replace('<svg ', '<svg x="30.5" y="3.5" width="11" height="11" ').replace(/currentColor/g, '#fff')}`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
    <path d="M22 51C22 51 4 33 4 21a18 18 0 1 1 36 0c0 12-18 30-18 30z" fill="${color}" stroke="#fff" stroke-width="3" ${ok ? '' : 'opacity=".88"'}/>
    ${glyph}${badge}</svg>`;
  const s = small ? 0.72 : 1;
  return { url: svgUrl(svg), scaledSize: new google.maps.Size(46 * s, 54 * s), anchor: new google.maps.Point(22 * s, 51 * s) };
}

const hospitalIcon = () => ({
  url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="12" fill="#fff"/><g color="#D62828">${HOSPITAL_SVG.replace('<svg ', '<svg x="7" y="7" width="34" height="34" ').replace(/currentColor/g, '#D62828')}</g></svg>`),
  scaledSize: new google.maps.Size(48, 48),
  anchor: new google.maps.Point(24, 24),
});

export function GoogleMapView({ apiKey, onFail }: { apiKey: string; onFail: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const markers = useRef(new Map<string, { m: google.maps.Marker; key: string }>());
  const user = useRef<{ dot: google.maps.Marker; acc: google.maps.Circle } | null>(null);
  const routeObjs = useRef<(google.maps.Polyline | google.maps.Marker)[]>([]);
  const [ready, setReady] = useState(false);

  const reports = useApp((s) => s.reports);
  const pos = useApp((s) => s.pos);
  const emergency = useApp((s) => s.emergency);
  const traffic = useApp((s) => s.traffic);

  useEffect(() => {
    let cancelled = false;
    let idleTimer: ReturnType<typeof setTimeout>;
    authFailedHandler = onFail;
    loadGoogleMaps(apiKey).then((g) => {
      if (cancelled || !el.current) return;
      const map = new g.maps.Map(el.current, {
        center: { lat: CONFIG.mapCenter[0], lng: CONFIG.mapCenter[1] },
        zoom: CONFIG.mapZoom,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        styles: MAP_STYLE,
        backgroundColor: '#E8ECE9',
        minZoom: 6,
      });
      mapRef.current = map;
      trafficRef.current = new g.maps.TrafficLayer({ autoRefresh: true } as google.maps.TrafficLayerOptions);
      if (getState().traffic) trafficRef.current.setMap(map);
      map.addListener('dragstart', markUserMovedMap);
      map.addListener('idle', () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => loadReports(), 300); });

      registerMap({
        flyTo: (lat, lng, zoom) => {
          map.panTo({ lat, lng });
          map.setZoom(Math.max(map.getZoom() ?? CONFIG.mapZoom, zoom ?? 15));
        },
        bounds: () => {
          const b = map.getBounds();
          if (!b) return null;
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          const dLat = (ne.lat() - sw.lat()) * 0.6;
          const dLng = (ne.lng() - sw.lng()) * 0.6;
          return { south: sw.lat() - dLat, west: sw.lng() - dLng, north: ne.lat() + dLat, east: ne.lng() + dLng };
        },
        fitPoints: (pts) => {
          if (!pts.length) return;
          const b = new g.maps.LatLngBounds();
          pts.forEach(([lat, lng]) => b.extend({ lat, lng }));
          const h = el.current?.clientHeight ?? 600;
          map.fitBounds(b, { top: 90, left: 40, right: 40, bottom: Math.round(h * 0.55) });
        },
      });
      setReady(true);
      setTimeout(() => loadReports(), 0);
    }).catch(() => { if (!cancelled) onFail(); });

    return () => {
      cancelled = true;
      clearTimeout(idleTimer);
      authFailedHandler = null;
      registerMap(null);
      markers.current.forEach(({ m }) => m.setMap(null));
      markers.current.clear();
      user.current?.dot.setMap(null);
      user.current?.acc.setMap(null);
      user.current = null;
      routeObjs.current.forEach((o) => o.setMap(null));
      trafficRef.current?.setMap(null);
      mapRef.current = null;
    };
  }, [apiKey, onFail]);

  // Afficher / masquer le trafic
  useEffect(() => {
    if (trafficRef.current && mapRef.current) trafficRef.current.setMap(traffic ? mapRef.current : null);
  }, [traffic]);

  // Signalements (les embouteillages signalés deviennent discrets quand le trafic est affiché)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ids = new Set(reports.map((r) => r.id));
    for (const [id, { m }] of markers.current) {
      if (!ids.has(id)) { m.setMap(null); markers.current.delete(id); }
    }
    for (const r of reports) {
      const small = traffic && r.type === 'embouteillage';
      const key = `${r.type}|${r.severity}|${isConfirmed(r)}|${small}`;
      const cur = markers.current.get(r.id);
      if (cur && cur.key === key) continue;
      cur?.m.setMap(null);
      const m = new google.maps.Marker({
        map, position: { lat: r.lat, lng: r.lng }, icon: pinSvg(r, small), title: reportLabel(r),
        zIndex: r.type === 'embouteillage' ? 10 : 20,
      });
      m.addListener('click', () => { if (getState().overlay?.kind !== 'emergency') openOverlay({ kind: 'detail', id: r.id }); });
      markers.current.set(r.id, { m, key });
    }
  }, [reports, traffic, ready]);

  // Position de l'usager
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pos) return;
    const ll = { lat: pos.lat, lng: pos.lng };
    if (!user.current) {
      const acc = new google.maps.Circle({ map, center: ll, radius: pos.acc, strokeColor: '#1A73E8', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#1A73E8', fillOpacity: 0.1, clickable: false });
      const dot = new google.maps.Marker({
        map, position: ll, clickable: false, zIndex: 5,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#1A73E8', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 4 },
      });
      user.current = { dot, acc };
    } else {
      user.current.dot.setPosition(ll);
      user.current.acc.setCenter(ll);
      user.current.acc.setRadius(pos.acc);
    }
  }, [pos, ready]);

  // Itinéraire d'urgence
  useEffect(() => {
    const map = mapRef.current;
    routeObjs.current.forEach((o) => o.setMap(null));
    routeObjs.current = [];
    if (!map) return;
    const opt = emergency.status === 'ready' ? emergency.data?.results[emergency.selected] : null;
    if (!opt) return;
    if (opt.geometry) {
      const path = opt.geometry.map(([lng, lat]) => ({ lat, lng }));
      routeObjs.current.push(new google.maps.Polyline({ map, path, strokeColor: '#ffffff', strokeWeight: 11, strokeOpacity: 0.95, clickable: false, zIndex: 30 }));
      routeObjs.current.push(new google.maps.Polyline({ map, path, strokeColor: '#1565D8', strokeWeight: 7, strokeOpacity: 1, clickable: false, zIndex: 31 }));
    }
    routeObjs.current.push(new google.maps.Marker({ map, position: { lat: opt.hospital.lat, lng: opt.hospital.lng }, icon: hospitalIcon(), clickable: false, zIndex: 40 }));
  }, [emergency, ready]);

  return <div ref={el} className="map map--google" aria-label="Carte du trafic et des signalements" />;
}
