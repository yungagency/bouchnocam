import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CONFIG } from '../../lib/config';
import { isConfirmed, reportColor, reportLabel } from '../../lib/format';
import {
  getState, loadReports, markUserMovedMap, openOverlay, registerMap, useApp,
} from '../../lib/store';
import type { Report } from '../../lib/types';
import { CHECK_SVG, GLYPH_SVG, HOSPITAL_SVG } from '../../ui/icons';

const glyphHtml = GLYPH_SVG;
const checkHtml = CHECK_SVG;
const hospitalHtml = HOSPITAL_SVG;

function pinIcon(r: Report) {
  const ok = isConfirmed(r);
  return L.divIcon({
    className: 'pin-wrap',
    iconSize: [44, 44],
    iconAnchor: [22, 52],
    html: `<div class="pin ${ok ? 'is-confirmed' : 'is-pending'}" style="--c:${reportColor(r)}">${glyphHtml[r.type] || ''}${ok ? `<span class="pin__badge">${checkHtml}</span>` : ''}</div>`,
  });
}

export function LeafletMapView() {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, { m: L.Marker; key: string }>());
  const user = useRef<{ dot: L.Marker; acc: L.Circle } | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);

  const reports = useApp((s) => s.reports);
  const pos = useApp((s) => s.pos);
  const emergency = useApp((s) => s.emergency);

  // Création de la carte
  useEffect(() => {
    if (!el.current) return undefined;
    const map = L.map(el.current, { zoomControl: false, minZoom: 6, maxZoom: 19, attributionControl: true })
      .setView(CONFIG.mapCenter, CONFIG.mapZoom);
    L.tileLayer(CONFIG.tiles.url, {
      attribution: CONFIG.tiles.attribution, subdomains: CONFIG.tiles.subdomains, maxZoom: 19, detectRetina: true,
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    layerRef.current = L.layerGroup().addTo(map);
    routeLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on('dragstart', markUserMovedMap);
    let t: ReturnType<typeof setTimeout>;
    map.on('moveend', () => { clearTimeout(t); t = setTimeout(() => loadReports(), 300); });

    registerMap({
      flyTo: (lat, lng, zoom) => map.flyTo([lat, lng], Math.max(map.getZoom(), zoom ?? 15), { duration: 0.7 }),
      bounds: () => {
        const b = map.getBounds().pad(0.6);
        return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
      },
      fitPoints: (pts) => {
        if (!pts.length) return;
        const h = map.getSize().y;
        map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 90], paddingBottomRight: [40, Math.round(h * 0.55)], maxZoom: 16 });
      },
    });
    loadReports();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      clearTimeout(t);
      registerMap(null);
      map.remove();
      mapRef.current = null;
      markers.current.clear();
      user.current = null;
    };
  }, []);

  // Marqueurs des signalements
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const ids = new Set(reports.map((r) => r.id));
    for (const [id, { m }] of markers.current) {
      if (!ids.has(id)) { layer.removeLayer(m); markers.current.delete(id); }
    }
    for (const r of reports) {
      const key = `${r.type}|${r.severity}|${isConfirmed(r)}`;
      const cur = markers.current.get(r.id);
      if (cur && cur.key === key) continue;
      if (cur) layer.removeLayer(cur.m);
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(r), title: reportLabel(r), riseOnHover: true });
      m.on('click', () => { if (getState().overlay?.kind !== 'emergency') openOverlay({ kind: 'detail', id: r.id }); });
      m.addTo(layer);
      markers.current.set(r.id, { m, key });
    }
  }, [reports]);

  // Position de l'usager
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pos) return;
    const ll: L.LatLngExpression = [pos.lat, pos.lng];
    if (!user.current) {
      const acc = L.circle(ll, { radius: pos.acc, color: '#1A73E8', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(map);
      const dot = L.marker(ll, {
        icon: L.divIcon({ className: 'pin-wrap', html: '<div class="user-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        interactive: false, zIndexOffset: -100,
      }).addTo(map);
      user.current = { dot, acc };
    } else {
      user.current.dot.setLatLng(ll);
      user.current.acc.setLatLng(ll).setRadius(pos.acc);
    }
  }, [pos]);

  // Itinéraire d'urgence
  useEffect(() => {
    const layer = routeLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const opt = emergency.status === 'ready' ? emergency.data?.results[emergency.selected] : null;
    if (!opt) return;
    if (opt.geometry) {
      const latlngs = opt.geometry.map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polyline(latlngs, { color: '#ffffff', weight: 11, opacity: 0.95, interactive: false }).addTo(layer);
      L.polyline(latlngs, { color: '#1565D8', weight: 7, opacity: 1, interactive: false }).addTo(layer);
    }
    L.marker([opt.hospital.lat, opt.hospital.lng], {
      icon: L.divIcon({ className: 'pin-wrap', html: `<div class="hospital-pin">${hospitalHtml}</div>`, iconSize: [44, 44], iconAnchor: [22, 22] }),
      interactive: false, zIndexOffset: 1000,
    }).addTo(layer);
  }, [emergency]);

  return <div ref={el} className="map" aria-label="Carte des signalements" />;
}
