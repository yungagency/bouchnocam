(function () {
  const maps = {};
  class MVC { constructor() { this._l = {}; } addListener(e, f) { (this._l[e] = this._l[e] || []).push(f); return { remove() {} }; } _fire(e) { (this._l[e] || []).forEach((f) => f()); } }
  class LatLng { constructor(a, b) { this.a = a; this.b = b; } lat() { return this.a; } lng() { return this.b; } }
  maps.Size = class { constructor(w, h) { this.width = w; this.height = h; } };
  maps.Point = class { constructor(x, y) { this.x = x; this.y = y; } };
  maps.SymbolPath = { CIRCLE: 0 };
  maps.LatLngBounds = class { constructor() { this.s = 90; this.n = -90; this.w = 180; this.e = -180; }
    extend(p) { this.s = Math.min(this.s, p.lat); this.n = Math.max(this.n, p.lat); this.w = Math.min(this.w, p.lng); this.e = Math.max(this.e, p.lng); return this; }
    getNorthEast() { return new LatLng(this.n, this.e); } getSouthWest() { return new LatLng(this.s, this.w); } };
  const objs = (window.__gm = { markers: new Set(), polylines: new Set(), traffic: false });
  maps.Map = class extends MVC {
    constructor(el, o) { super(); this.el = el; this.c = o.center; this.z = o.zoom; this.items = new Set();
      el.style.background = '#F3F5F2'; this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; el.appendChild(this.svg);
      this.layer = document.createElement('div'); this.layer.style.cssText = 'position:absolute;inset:0'; el.appendChild(this.layer);
      window.__fakeMap = this; setTimeout(() => this._fire('idle'), 60); }
    scale() { return 256 * Math.pow(2, this.z) / 360; }
    proj(lat, lng) { const s = this.scale(); return [(lng - this.c.lng) * s + this.el.clientWidth / 2, (this.c.lat - lat) * s + this.el.clientHeight / 2]; }
    getBounds() { const s = this.scale(); const w = this.el.clientWidth / 2 / s; const h = this.el.clientHeight / 2 / s; const b = new maps.LatLngBounds(); b.s = this.c.lat - h; b.n = this.c.lat + h; b.w = this.c.lng - w; b.e = this.c.lng + w; return b; }
    getZoom() { return this.z; } setZoom(z) { this.z = z; this.redraw(); this._fire('idle'); }
    panTo(p) { this.c = p; this.redraw(); this._fire('idle'); }
    fitBounds(b) { this.c = { lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 }; this.z = 14; this.redraw(); this._fire('idle'); }
    redraw() { this.items.forEach((o) => o.draw()); }
  };
  class Overlay extends MVC { constructor(o) { super(); this.o = o; this.map = null; if (o.map) this.setMap(o.map); }
    setMap(m) { if (this.map) this.map.items.delete(this); this.remove(); this.map = m; if (m) { m.items.add(this); this.draw(); } }
    remove() {} draw() {} }
  maps.Marker = class extends Overlay {
    constructor(o) { super(o); objs.markers.add(this); }
    setMap(m) { super.setMap(m); if (!m) objs.markers.delete(this); else objs.markers.add(this); }
    setPosition(p) { this.o.position = p; this.draw(); }
    remove() { this.node?.remove(); this.node = null; }
    draw() { if (!this.map) return; const [x, y] = this.map.proj(this.o.position.lat, this.o.position.lng);
      if (!this.node) { const ic = this.o.icon || {};
        if (ic.url) { this.node = document.createElement('img'); this.node.src = ic.url; this.node.style.cssText = `position:absolute;width:${ic.scaledSize.width}px;height:${ic.scaledSize.height}px;cursor:pointer`; this.ax = ic.anchor.x; this.ay = ic.anchor.y; }
        else { this.node = document.createElement('div'); this.node.style.cssText = 'position:absolute;width:18px;height:18px;border-radius:50%;background:#1A73E8;border:4px solid #fff;box-sizing:content-box'; this.ax = 13; this.ay = 13; }
        if (this.o.title) this.node.title = this.o.title;
        this.node.className = 'fake-marker'; this.node.onclick = () => this._fire('click'); this.map.layer.appendChild(this.node); }
      this.node.style.left = `${x - this.ax}px`; this.node.style.top = `${y - this.ay}px`; }
  };
  maps.Circle = class extends Overlay { setCenter() {} setRadius() {} };
  maps.Polyline = class extends Overlay {
    constructor(o) { super(o); objs.polylines.add(this); }
    setMap(m) { super.setMap(m); if (!m) objs.polylines.delete(this); }
    remove() { this.node?.remove(); this.node = null; }
    draw() { if (!this.map) return; this.remove(); const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      p.setAttribute('points', this.o.path.map((q) => this.map.proj(q.lat, q.lng).join(',')).join(' '));
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', this.o.strokeColor); p.setAttribute('stroke-width', this.o.strokeWeight); p.setAttribute('stroke-linecap', 'round');
      this.map.svg.appendChild(p); this.node = p; }
  };
  // Couche trafic simulée : quelques axes colorés autour de Yaoundé
  const AXES = [
    { c: '#3FBF5F', pts: [[3.900, 11.480], [3.880, 11.500], [3.866, 11.517], [3.850, 11.540]] },
    { c: '#FF974D', pts: [[3.840, 11.500], [3.855, 11.510], [3.866, 11.517], [3.880, 11.530]] },
    { c: '#F23C32', pts: [[3.870, 11.495], [3.868, 11.505], [3.866, 11.517], [3.862, 11.528]] },
    { c: '#811F1F', pts: [[3.873, 11.512], [3.869, 11.514], [3.866, 11.517]] },
    { c: '#3FBF5F', pts: [[3.890, 11.520], [3.875, 11.522], [3.858, 11.522], [3.845, 11.518]] },
  ];
  maps.TrafficLayer = class { setMap(m) { objs.traffic = Boolean(m); (this.lines || []).forEach((l) => l.setMap(null)); this.lines = [];
      if (m) this.lines = AXES.map((a) => new maps.Polyline({ map: m, path: a.pts.map(([lat, lng]) => ({ lat, lng })), strokeColor: a.c, strokeWeight: 6 }));
      this.lines.forEach((l) => objs.polylines.delete(l)); } };
  window.google = { maps };
})();
