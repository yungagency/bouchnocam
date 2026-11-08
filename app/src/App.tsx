import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CONFIG } from './lib/config';
import { SEVERITY, TYPES } from './lib/format';
import {
  centerOnUser, closeOverlay, getState, loadReports, map, markUserMovedMap, openOverlay, pruneExpired, refreshUser,
  setState, setTab, startEmergency, startGeo, toast, toggleTraffic, undoReport, useApp,
} from './lib/store';
import type { Tab } from './lib/types';
import { MapView } from './features/map/MapView';
import { ReportScreen } from './features/report/ReportScreen';
import { ReportDetail } from './features/report/ReportDetail';
import { EmergencyScreen } from './features/emergency/EmergencyScreen';
import { NearbyView } from './features/nearby/NearbyView';
import { AccountSheet, InstallSheet, OnboardingSheet, ProfileView } from './features/profile/ProfileView';
import { ConnectionPill, LogoMark, Splash } from './ui/Logo';
import { Sheet } from './ui/Sheet';
import { giveDriveConsent, requestDrive, startDrive, stopDrive } from './lib/drive';
import { AuthSheet, EditProfileSheet, PrivacySheet } from './features/auth/AuthSheet';
import {
  GLYPH, IconAmbulance, IconSteering, IconClose, IconLayers, IconLocate, IconMap, IconMegaphone, IconNearby, IconProfile, IconSearch, IconStar,
} from './ui/icons';

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

// ------------------------------------------------------------------ Barre du haut : recherche + avatar
interface Place { display_name: string; lat: string; lon: string }

function TopBar() {
  const me = useApp((s) => s.me);
  const signedIn = useApp((s) => s.signedIn);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=cm&accept-language=fr`
        + `&viewbox=11.38,4.00,11.65,3.70&q=${encodeURIComponent(q.trim())}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = (await res.json()) as Place[];
      setResults(data);
      if (!data.length) toast('Aucun lieu trouvé.');
    } catch {
      toast('Recherche indisponible pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <form className="search" onSubmit={search} role="search">
        <LogoMark size={34} className="search__logo" />
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setResults(null); }}
          placeholder="Rechercher un lieu…" aria-label="Rechercher un lieu" enterKeyHint="search" />
        {q ? (
          <button type="button" className="search__btn" aria-label="Effacer" onClick={() => { setQ(''); setResults(null); }}><IconClose size={20} /></button>
        ) : (
          <button type="submit" className="search__btn" aria-label="Rechercher" disabled={busy}><IconSearch size={22} /></button>
        )}
        {results && results.length > 0 && (
          <ul className="search__results">
            {results.map((p) => (
              <li key={`${p.lat},${p.lon}`}>
                <button type="button" onClick={() => {
                  setTab('map');
                  markUserMovedMap();
                  map()?.flyTo(Number(p.lat), Number(p.lon), 16);
                  setResults(null);
                }}>{p.display_name}</button>
              </li>
            ))}
          </ul>
        )}
      </form>
      <button type="button" className="avatar-btn" onClick={() => (signedIn ? setTab('profile') : openOverlay({ kind: 'auth', mode: 'login' }))}
        aria-label={signedIn ? 'Mon profil' : 'Se connecter'}>
        <span className="avatar">{signedIn && me ? initials(me.display_name) : <IconProfile size={24} />}</span>
        {signedIn && me && <span className="avatar-btn__pts"><IconStar size={12} />{me.points}</span>}
      </button>
    </header>
  );
}

// ------------------------------------------------------------------ Gros boutons Urgence + Signaler
function FabStack() {
  return (
    <div className="fabs">
      <button type="button" className="fab fab--urgence" onClick={startEmergency} aria-label="Urgence : hôpital le plus rapide">
        <IconAmbulance size={34} /><span>Urgence</span>
      </button>
      <button type="button" className="fab fab--signal" onClick={() => openOverlay({ kind: 'report' })} aria-label="Signaler un problème">
        <IconMegaphone size={40} /><span>Signaler</span>
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Légende + trafic
const TRAFFIC_SCALE = [
  { label: 'Fluide', color: '#3FBF5F' },
  { label: 'Ralenti', color: '#FF974D' },
  { label: 'Chargé', color: '#F23C32' },
  { label: 'Bloqué', color: '#811F1F' },
];

function Legend() {
  const [open, setOpen] = useState(true);
  const provider = useApp((s) => s.mapProvider);
  const traffic = useApp((s) => s.traffic);
  const live = provider === 'google' && traffic;
  const own = useApp((s) => s.trafficCells.length > 0);
  if (!open) {
    return <button type="button" className="legend-toggle" onClick={() => setOpen(true)} aria-label="Afficher la légende"><IconLayers size={22} /></button>;
  }
  return (
    <div className="legend" onClick={() => setOpen(false)} role="button" tabIndex={0} aria-label="Légende (toucher pour masquer)">
      {live ? (
        <>
          <span className="legend__title"><i className="legend__live" />Trafic en direct</span>
          <span className="legend__scale">{TRAFFIC_SCALE.map((t) => <i key={t.label} style={{ background: t.color }} />)}</span>
          <span className="legend__scale-labels"><span>Fluide</span><span>Bloqué</span></span>
        </>
      ) : (
        ([3, 2, 1] as const).map((s) => (
          <span key={s} className="legend__row"><i style={{ background: SEVERITY[s].color }} />{SEVERITY[s].label}</span>
        ))
      )}
      {own && <span className="legend__own"><i />Trafic Bouchnocam (bêta)</span>}
      <span className="legend__icons">
        {(['accident', 'route_barree', 'travaux', 'inondation', 'route_impraticable'] as const).map((t) => (
          <span key={t} className="legend__glyph" style={{ ['--c' as string]: TYPES[t].color }} title={TYPES[t].label}>{GLYPH[t]}</span>
        ))}
      </span>
    </div>
  );
}

function DriveChip() {
  const active = useApp((s) => s.drive.active);
  if (active) return null;
  return (
    <button type="button" className="map-chip map-chip--drive" onClick={requestDrive}>
      <IconSteering size={20} />Je roule
    </button>
  );
}

function DriveBanner() {
  const drive = useApp((s) => s.drive);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!drive.active) return undefined;
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, [drive.active]);
  if (!drive.active) return null;
  const min = Math.max(0, Math.round((Date.now() - drive.startedAt) / 60000));
  return (
    <div className="drive-banner" role="status">
      <span className="drive-banner__dot" />
      <div className="drive-banner__text">
        <strong>Mode conduite actif</strong>
        <span>{min} min · {drive.sent} positions partagées{drive.wakeLock ? ' · écran maintenu allumé' : ''}</span>
      </div>
      <button type="button" className="drive-banner__stop" onClick={() => stopDrive()}>Arrêter</button>
    </div>
  );
}

function DriveSheet() {
  return (
    <Sheet label="Mode conduite">
      <div className="auth-head">
        <span className="drive-hero"><IconSteering size={40} /></span>
        <h2 className="sheet__title">Mode conduite</h2>
        <p className="muted">Pendant vos trajets, votre téléphone aide Bouchnocam à calculer le trafic en temps réel.</p>
      </div>
      <ul className="drive-list">
        <li><b>Ce qui est partagé</b><span>Position, vitesse, direction et heure, toutes les 4 secondes.</span></li>
        <li><b>Anonyme</b><span>Sans votre nom ni votre numéro. L'identifiant change à chaque trajet, le début et la fin de vos trajets sont ignorés, et les positions sont effacées après 48 h.</span></li>
        <li><b>Écran allumé</b><span>L'écran reste allumé pendant le trajet : branchez le téléphone si possible. Moins de 1 Mo de données par heure.</span></li>
        <li><b>Sécurité</b><span>Posez le téléphone sur un support avant de démarrer. Ne le manipulez pas en conduisant.</span></li>
      </ul>
      <div className="stack">
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => { giveDriveConsent(); closeOverlay(); startDrive(); }}>Activer le Mode conduite</button>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => closeOverlay()}>Pas maintenant</button>
      </div>
    </Sheet>
  );
}

function TrafficToggle() {
  const provider = useApp((s) => s.mapProvider);
  const traffic = useApp((s) => s.traffic);
  if (provider !== 'google') return null;
  return (
    <button type="button" className={`map-chip ${traffic ? 'is-on' : ''}`} onClick={toggleTraffic} aria-pressed={traffic}>
      <span className="map-chip__dots"><i /><i /><i /></span>Trafic
    </button>
  );
}

// ------------------------------------------------------------------ Bandeau « Annuler » après un signalement
function UndoBar() {
  const undo = useApp((s) => s.undo);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!undo) return undefined;
    const t = setInterval(() => {
      if (Date.now() >= undo.until) {
        setState({ undo: null });
        // le bandeau disparaît simplement
      } else tick((x) => x + 1);
    }, 250);
    return () => clearInterval(t);
  }, [undo]);
  if (!undo) return null;
  const left = Math.max(0, Math.ceil((undo.until - Date.now()) / 1000));
  return (
    <div className="undo" role="status">
      <span className="undo__check">✓</span>
      <span className="undo__text"><strong>Merci !</strong>{undo.label} · +10 points dès 2 confirmations</span>
      <button type="button" className="undo__btn" onClick={undoReport}>Annuler <small>{left}</small></button>
      <span className="undo__timer" style={{ animationDuration: `${CONFIG.undoSeconds}s` }} />
    </div>
  );
}

function Toast() {
  const t = useApp((s) => s.toast);
  if (!t) return null;
  return <div className="toast" role="status" aria-live="polite" onClick={() => setState({ toast: null })}>{t.text}</div>;
}

function MapHint() {
  const reports = useApp((s) => s.reports);
  const loaded = useApp((s) => s.loadedOnce);
  if (!loaded || reports.length) return null;
  return (
    <div className="map-hint">
      <strong>Aucun incident signalé ici pour le moment.</strong> Vous voyez un problème ? Touchez <b>Signaler</b>.
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'map', label: 'Carte', icon: <IconMap size={24} /> },
  { id: 'nearby', label: 'Autour de moi', icon: <IconNearby size={24} /> },
  { id: 'profile', label: 'Profil', icon: <IconProfile size={24} /> },
];

export function App() {
  const tab = useApp((s) => s.tab);
  const overlay = useApp((s) => s.overlay);
  const offline = useApp((s) => s.offline);
  const geoGranted = useApp((s) => s.geo === 'granted');
  const loadedOnce = useApp((s) => s.loadedOnce);

  useEffect(() => {
    refreshUser();
    (async () => {
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
        if (perm?.state === 'granted') startGeo();
        else if (perm?.state === 'denied') setState({ geo: 'denied' });
      } catch { /* API absente */ }
      try {
        if (!localStorage.getItem('bcm.onboarded')) {
          localStorage.setItem('bcm.onboarded', '1');
          if (!getState().overlay) openOverlay({ kind: 'onboarding' });
        }
      } catch { /* stockage indisponible */ }
    })();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') { loadReports(); pruneExpired(); }
    }, CONFIG.refreshMs);
    const onVis = () => { if (document.visibilityState === 'visible') { loadReports(); refreshUser(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const emergencyOpen = overlay?.kind === 'emergency';

  return (
    <div className={`app ${emergencyOpen ? 'is-emergency' : ''}`}>
      <Splash ready={loadedOnce || offline} />
      <main className="stage">
        <MapView />
        {tab === 'map' && !emergencyOpen && (
          <>
            <TopBar />
            <MapHint />
            <div className="map-left">
              <button type="button" className="map-btn" aria-label="Me localiser" onClick={() => { startGeo(true); if (geoGranted) centerOnUser(); }}>
                <IconLocate size={24} />
              </button>
              <DriveChip />
              <TrafficToggle />
              <Legend />
            </div>
          </>
        )}
        {!emergencyOpen && <DriveBanner />}
        {!emergencyOpen && <ConnectionPill offline={offline} onRetry={() => { loadReports(); }} />}
        {tab === 'nearby' && <NearbyView />}
        {tab === 'profile' && <ProfileView />}
        {tab === 'map' && !emergencyOpen && <FabStack />}
        <UndoBar />
      </main>

      {!emergencyOpen && (
        <nav className="tabbar" aria-label="Navigation">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'is-active' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {overlay?.kind === 'report' && <ReportScreen />}
      {overlay?.kind === 'emergency' && <EmergencyScreen />}
      {overlay?.kind === 'detail' && <ReportDetail id={overlay.id} />}
      {overlay?.kind === 'auth' && <AuthSheet key={overlay.mode} mode={overlay.mode} reason={overlay.reason} />}
      {overlay?.kind === 'privacy' && <PrivacySheet />}
      {overlay?.kind === 'edit' && <EditProfileSheet />}
      {overlay?.kind === 'account' && <AccountSheet />}
      {overlay?.kind === 'drive' && <DriveSheet />}
      {overlay?.kind === 'install' && <InstallSheet />}
      {overlay?.kind === 'onboarding' && <OnboardingSheet />}
      <Toast />
    </div>
  );
}
