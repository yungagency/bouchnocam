// Test de bout en bout : parcours complet sur un téléphone simulé, Supabase simulé.
// Usage : node tests/e2e.cjs <dossier_captures> [url]
const { chromium, devices } = require('playwright');
const OUT = process.argv[2];
const URL_APP = process.argv[3] || 'http://127.0.0.1:8766/bouchnocam/';
require('fs').mkdirSync(OUT, { recursive: true });
const now = Date.now();
const iso = (m) => new Date(now - m * 60000).toISOString();
const later = (m) => new Date(now + m * 60000).toISOString();
let reports = [
  { id: 'r1', type: 'embouteillage', severity: 3, lat: 3.8705, lng: 11.5150, status: 'confirme', confirmations: 3, contestations: 0, created_at: iso(12), expires_at: later(30) },
  { id: 'r2', type: 'accident', severity: null, lat: 3.8620, lng: 11.5230, status: 'actif', confirmations: 1, contestations: 0, created_at: iso(5), expires_at: later(110) },
  { id: 'r3', type: 'travaux', severity: null, lat: 3.8760, lng: 11.5080, status: 'confirme', confirmations: 4, contestations: 1, created_at: iso(300), expires_at: later(2000) },
  { id: 'r4', type: 'embouteillage', severity: 1, lat: 3.8580, lng: 11.5100, status: 'actif', confirmations: 0, contestations: 0, created_at: iso(2), expires_at: later(43) },
  { id: 'r5', type: 'inondation', severity: null, lat: 3.8810, lng: 11.5220, status: 'actif', confirmations: 0, contestations: 0, created_at: iso(20), expires_at: later(150) },
  { id: 'r6', type: 'route_barree', severity: null, lat: 3.8655, lng: 11.5300, status: 'confirme', confirmations: 2, contestations: 0, created_at: iso(40), expires_at: later(200) },
  { id: 'r7', type: 'embouteillage', severity: 2, lat: 3.8690, lng: 11.5020, status: 'actif', confirmations: 1, contestations: 0, created_at: iso(8), expires_at: later(37) },
];
let me = null; let n = 0; let richHistory = false;
const calls = [];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], geolocation: { latitude: 3.8667, longitude: 11.5167, accuracy: 18 }, permissions: ['geolocation'], locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await ctx.route(/basemaps\.cartocdn\.com/, (r) => r.abort());
  await ctx.route(/nominatim\.openstreetmap\.org/, (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.includes('reverse')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ address: { suburb: 'Melen', city: 'Yaoundé' } }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ display_name: 'Carrefour Warda, Yaoundé, Centre, Cameroun', lat: '3.8730', lon: '11.5120' }, { display_name: 'Marché Mokolo, Yaoundé', lat: '3.8790', lon: '11.5030' }]) });
  });
  await ctx.route(/supabase\.co/, async (route) => {
    const req = route.request(); const u = new URL(req.url()); const body = req.postDataJSON?.() ?? null; const p = u.pathname;
    calls.push(`${req.method()} ${p} ${body ? JSON.stringify(body).slice(0, 110) : ''}`);
    const json = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (p === '/auth/v1/signup') { me = { id: 'u1', display_name: body.data.display_name, role: body.data.role, points: 0, is_admin: false, rank: 4, reports_count: 0, confirmed_count: 0 }; return json({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: 'u1' } }); }
    if (p === '/rest/v1/reports') return json(reports);
    if (p === '/rest/v1/rpc/me') return json(me);
    if (p === '/rest/v1/rpc/my_reports') return json(richHistory ? [
      { id: 'h1', type: 'embouteillage', severity: 3, status: 'confirme', confirmations: 3, contestations: 0, created_at: iso(180), expires_at: iso(100), lat: 3.87, lng: 11.51, points: 10, place_label: 'Awae escalier, Yaoundé' },
      { id: 'h2', type: 'accident', severity: null, status: 'confirme', confirmations: 2, contestations: 0, created_at: iso(300), expires_at: iso(200), lat: 3.87, lng: 11.51, points: 10, place_label: 'Coron, Yaoundé' },
      { id: 'h3', type: 'embouteillage', severity: 1, status: 'actif', confirmations: 1, contestations: 0, created_at: iso(20), expires_at: later(30), lat: 3.87, lng: 11.51, points: 0, place_label: 'Nlongkak, Yaoundé' },
      { id: 'h4', type: 'route_barree', severity: null, status: 'retire', confirmations: 0, contestations: 2, created_at: iso(1500), expires_at: iso(1400), lat: 3.87, lng: 11.51, points: -5, place_label: 'Mvog-Mbi, Yaoundé' }]
      : reports.filter(r => r.mine).map(r => ({ ...r, points: 0, place_label: 'Melen, Yaoundé' })));
    if (p === '/rest/v1/votes') return json([]);
    if (p === '/rest/v1/profiles') return json(richHistory
      ? [{ id: 'u1', display_name: 'Junior P.', role: 'taximan', points: 2850 }, { id: 'u9', display_name: 'Moussa K.', role: 'moto', points: 2410 }, { id: 'u8', display_name: 'Yannick R.', role: 'usager', points: 1960 }]
      : [{ id: 'u9', display_name: 'Moussa K.', role: 'moto', points: 120 }, { id: 'u8', display_name: 'Aline N.', role: 'usager', points: 64 }]);
    if (p === '/rest/v1/rpc/create_report') { n += 1; const id = 'new' + n; reports.unshift({ id, mine: true, type: body.p_type, severity: body.p_severity, lat: body.p_lat + 0.0004 * n, lng: body.p_lng, status: 'actif', confirmations: 0, contestations: 0, created_at: iso(0), expires_at: later(45) }); return json({ id, merged: false }); }
    if (p === '/rest/v1/rpc/cancel_report') { reports = reports.filter(r => r.id !== body.p_report_id); return route.fulfill({ status: 204, body: '' }); }
    if (p === '/rest/v1/rpc/vote_report') return json({ id: body.p_report_id, status: 'confirme', confirmations: 2, contestations: 0 });
    if (p === '/functions/v1/emergency-route') return json({ incidents_in_area: 2, results: [
      { hospital: { id: 1, name: 'Hôpital Central de Yaoundé', lat: 3.8760, lng: 11.5150, phone: '222231000', emergency_24h: true, verified: true }, distance_m: 2400, duration_s: 380, avoided: 1, incidents_on_route: 0, routed: true, geometry: [[11.5167, 3.8667], [11.5180, 3.8690], [11.5172, 3.8720], [11.5160, 3.8745], [11.5150, 3.8760]] },
      { hospital: { id: 2, name: 'Hôpital Général de Yaoundé', lat: 3.8920, lng: 11.5390, phone: null, emergency_24h: false, verified: false }, distance_m: 5200, duration_s: 720, avoided: 0, incidents_on_route: 1, routed: true, geometry: [[11.5167, 3.8667], [11.5300, 3.8800], [11.5390, 3.8920]] },
      { hospital: { id: 3, name: 'Polyclinique Mbarga', lat: 3.8480, lng: 11.5190, phone: null, emergency_24h: false, verified: false }, distance_m: 2100, duration_s: 600, avoided: 0, incidents_on_route: 0, routed: true, geometry: [[11.5167, 3.8667], [11.5190, 3.8480]] }] });
    return json({ message: 'not mocked ' + p }, 404);
  });
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  await page.goto(URL_APP, { waitUntil: 'commit' });
  await page.waitForTimeout(550); await shot('00a-ouverture');
  await page.waitForTimeout(800); await shot('00b-ouverture');
  await page.waitForTimeout(2400); await shot('01-bienvenue');
  await page.getByRole('button', { name: 'Activer ma position' }).click(); await page.waitForTimeout(1500); await shot('02-carte');
  await page.getByRole('button', { name: 'Signaler un problème' }).click(); await page.waitForTimeout(900); await shot('03-signaler');
  await page.locator('.rs-card--3').click(); await page.waitForTimeout(400); await shot('03b-choix');
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click(); await page.waitForTimeout(700); await shot('04-compte-requis');
  await page.fill('input[autocomplete="nickname"]', 'Junior P.');
  await page.fill('input[type="tel"]', '681031218');
  await page.fill('input[type="password"]', 'secret12');
  await page.getByRole('radio', { name: 'Taximan', exact: true }).click();
  await page.check('input[type="checkbox"]');
  await page.getByRole('button', { name: 'Créer mon compte' }).last().click();
  await page.waitForTimeout(1500); await shot('05-envoye-annuler');
  await page.locator('.undo__btn').click(); await page.waitForTimeout(800); await shot('06-annule');
  await page.getByRole('button', { name: 'Signaler un problème' }).click(); await page.waitForTimeout(600);
  await page.locator('.rs-other', { hasText: 'Accident' }).click();
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click(); await page.waitForTimeout(6500); await shot('07-apres-5s');
  await page.locator('.leaflet-marker-icon[title="Embouteillage · Moyen"]').first().dispatchEvent('click'); await page.waitForTimeout(600); await shot('08-detail');
  await page.getByRole('button', { name: 'Toujours là' }).click(); await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Urgence : hôpital le plus rapide' }).click(); await page.waitForTimeout(1800); await shot('09-urgence');
  await page.locator('.em-other').first().click(); await page.waitForTimeout(900); await shot('10-urgence-autre');
  await page.getByRole('button', { name: 'Fermer' }).first().click(); await page.waitForTimeout(600);
  await page.fill('input[type="search"]', 'Warda'); await page.keyboard.press('Enter'); await page.waitForTimeout(800); await shot('11-recherche');
  await page.locator('.search__results button').first().click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Autour de moi' }).click(); await page.waitForTimeout(700); await shot('12-autour');
  richHistory = true;
  me = { ...me, points: 2850, rank: 1, reports_count: 15, confirmed_count: 12, useful_votes: 8, morning_reports: 1 };
  await page.getByRole('button', { name: 'Profil', exact: true }).click(); await page.waitForTimeout(1200); await shot('13-profil');
  await page.evaluate(() => document.querySelector('.panel--profile').scrollTo(0, 560)); await page.waitForTimeout(400); await shot('14-profil-badges');
  await page.evaluate(() => document.querySelector('.panel--profile').scrollTo(0, 1100)); await page.waitForTimeout(400); await shot('15-profil-historique');
  await page.getByRole('button', { name: 'Carte', exact: true }).click(); await page.waitForTimeout(400);
  await ctx.setOffline(true); await page.waitForTimeout(900); await shot('16-hors-connexion');
  await ctx.setOffline(false); await page.waitForTimeout(500); await shot('17-connexion-retablie');
  await page.getByRole('button', { name: 'Profil', exact: true }).click(); await page.waitForTimeout(300);
  // retour Android : ouvrir puis fermer une feuille avec history.back
  await page.getByRole('button', { name: 'Carte', exact: true }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Signaler un problème' }).click(); await page.waitForTimeout(400);
  await page.goBack(); await page.waitForTimeout(500);
  const stillOpen = await page.locator('.screen--report').count();
  console.log('Retour Android ferme l\'écran Signaler :', stillOpen === 0);
  console.log('ERREURS/AVERTISSEMENTS:', JSON.stringify(errors.filter(e => !/cartocdn|ERR_FAILED|net::|504/.test(e)), null, 1));
  console.log('APPELS:\n' + calls.filter(c => !c.includes('/rest/v1/reports')).join('\n'));
  await browser.close();
})().catch((e) => { console.error('ECHEC', e.message); process.exit(1); });
