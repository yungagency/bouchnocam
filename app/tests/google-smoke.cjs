// Test de l'intégration Google Maps avec une imitation de l'API Google (aucun appel réel).
// Compiler avec VITE_GOOGLE_MAPS_KEY=test, puis : node tests/google-smoke.cjs <captures> tests/fake-gmaps.js [url]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const FAKE = fs.readFileSync(process.argv[3], 'utf8');
const now = Date.now(); const iso = (m) => new Date(now - m * 60000).toISOString(); const later = (m) => new Date(now + m * 60000).toISOString();
const reports = [
  { id: 'r1', type: 'embouteillage', severity: 3, lat: 3.8705, lng: 11.5150, status: 'confirme', confirmations: 3, contestations: 0, created_at: iso(12), expires_at: later(30) },
  { id: 'r2', type: 'accident', severity: null, lat: 3.8620, lng: 11.5230, status: 'actif', confirmations: 1, contestations: 0, created_at: iso(5), expires_at: later(110) },
  { id: 'r3', type: 'travaux', severity: null, lat: 3.8760, lng: 11.5080, status: 'confirme', confirmations: 4, contestations: 1, created_at: iso(300), expires_at: later(2000) },
  { id: 'r6', type: 'route_barree', severity: null, lat: 3.8655, lng: 11.5300, status: 'confirme', confirmations: 2, contestations: 0, created_at: iso(40), expires_at: later(200) },
];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], geolocation: { latitude: 3.8667, longitude: 11.5167, accuracy: 18 }, permissions: ['geolocation'], locale: 'fr-FR' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('bcm.onboarded', '1'); } catch {} });
  await ctx.route(/maps\.googleapis\.com/, (r) => { const cb = new URL(r.request().url()).searchParams.get('callback'); r.fulfill({ contentType: 'text/javascript', body: FAKE + `\nsetTimeout(() => window.${cb}(), 30);` }); });
  await ctx.route(/basemaps\.cartocdn\.com|nominatim/, (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => { const p = new URL(r.request().url()).pathname;
    const j = (d) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(d) });
    if (p === '/rest/v1/reports') return j(reports);
    if (p === '/functions/v1/emergency-route') return j({ incidents_in_area: 1, results: [{ hospital: { id: 1, name: 'Hôpital Central de Yaoundé', lat: 3.8760, lng: 11.5150, phone: '222231000', emergency_24h: true, verified: true }, distance_m: 2400, duration_s: 380, avoided: 1, incidents_on_route: 0, routed: true, geometry: [[11.5167, 3.8667], [11.5180, 3.8690], [11.5172, 3.8720], [11.5150, 3.8760]] }] });
    return j([]); });
  await page.goto('' + (process.argv[4] || 'http://127.0.0.1:8766/bouchnocam/') + '', { waitUntil: 'commit' });
  await page.waitForTimeout(4500);
  const st1 = await page.evaluate(() => ({ markers: window.__gm.markers.size, traffic: window.__gm.traffic, leaflet: !!document.querySelector('.leaflet-container'), google: !!document.querySelector('.map--google') }));
  console.log('Carte Google chargée :', JSON.stringify(st1));
  await page.screenshot({ path: `${OUT}/g1-trafic.png` });
  await page.locator('.map-chip').click(); await page.waitForTimeout(400);
  const st2 = await page.evaluate(() => window.__gm.traffic);
  console.log('Trafic après clic sur « Trafic » :', st2);
  await page.screenshot({ path: `${OUT}/g2-sans-trafic.png` });
  await page.locator('.map-chip').click(); await page.waitForTimeout(300);
  await page.locator('.fake-marker[title="Accident"]').click(); await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/g3-detail.png` });
  console.log('Détail ouvert :', await page.locator('.dt-band').count() === 1);
  await page.getByRole('button', { name: 'Fermer' }).first().click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Urgence : hôpital le plus rapide' }).click(); await page.waitForTimeout(1800);
  console.log('Itinéraire tracé (lignes) :', await page.evaluate(() => window.__gm.polylines.size));
  await page.screenshot({ path: `${OUT}/g4-urgence.png` });
  await page.getByRole('button', { name: 'Fermer' }).first().click(); await page.waitForTimeout(400);
  console.log('Itinéraire effacé à la fermeture :', await page.evaluate(() => window.__gm.polylines.size) === 0);
  await page.evaluate(() => window.gm_authFailure()); await page.waitForTimeout(1500);
  console.log('Clé refusée -> repli OpenStreetMap :', await page.evaluate(() => !!document.querySelector('.leaflet-container') && !document.querySelector('.map--google')));
  await page.screenshot({ path: `${OUT}/g5-repli.png` });
  console.log('ERREURS:', JSON.stringify(errors.filter((e) => !/cartocdn|ERR_FAILED|net::|504|Google Maps indisponible/.test(e))));
  await browser.close();
})().catch((e) => { console.error('ECHEC', e.message); process.exit(1); });
