import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CONFIG } from './lib/config';
import { SEVERITY, TYPES } from './lib/format';
import {
  centerOnUser, getState, loadReports, map, markUserMovedMap, openOverlay, pruneExpired, refreshUser,
  setState, setTab, startEmergency, startGeo, toast, undoReport, useApp,
} from './lib/store';
import type { Tab } from './lib/types';
import { MapView } from './features/map/MapView';
import { ReportScreen } from './features/report/ReportScreen';
import { ReportDetail } from './features/report/ReportDetail';
import { EmergencyScreen } from './features/emergency/EmergencyScreen';
import { NearbyView } from './features/nearby/NearbyView';
import { AccountSheet, InstallSheet, OnboardingSheet, ProfileView } from './features/profile/ProfileView';
import { ConnectionPill, LogoMark, Splash } from './ui/Logo';
import { AuthSheet, EditProfileSheet, PrivacySheet } from './features/auth/AuthSheet';
import {
  GLYPH, IconAmbulance, IconClose, IconLayers, IconLocate, IconMap, IconMegaphone, IconNearby, IconProfile, IconSearch, IconStar,
} from './ui/icons';

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
        <span className="avatar">{signedIn && me ? me.display_name.slice(0, 1).toUpperCase() : <IconProfile size={24} />}</span>
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

// ------------------------------------------------------------------ Légende
function Legend() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return <button type="button" className="legend-toggle" onClick={() => setOpen(true)} aria-label="Afficher la légende"><IconLayers size={22} /></button>;
  }
  return (
    <div className="legend" onClick={() => setOpen(false)} role="button" tabIndex={0} aria-label="Légende (toucher pour masquer)">
      {([3, 2, 1] as const).map((s) => (
        <span key={s} className="legend__row"><i style={{ background: SEVERITY[s].color }} />{SEVERITY[s].label}</span>
      ))}
      <span className="legend__icons">
        {(['accident', 'route_barree', 'travaux', 'inondation'] as const).map((t) => (
          <span key={t} className="legend__glyph" style={{ ['--c' as string]: TYPES[t].color }} title={TYPES[t].label}>{GLYPH[t]}</span>
        ))}
      </span>
    </div>
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
      <span className="undo__text"><strong>Merci !</strong>{undo.label} signalé · +10 points dès 2 confirmations</span>
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
              <Legend />
            </div>
          </>
        )}
        {!emergencyOpen && <ConnectionPill offline={offline} onRetry={() => { loadReports(); }} />}
        {tab === 'nearby' && <NearbyView />}
        {tab === 'profile' && <ProfileView />}
        {tab !== 'profile' && !emergencyOpen && <FabStack />}
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
      {overlay?.kind === 'install' && <InstallSheet />}
      {overlay?.kind === 'onboarding' && <OnboardingSheet />}
      <Toast />
    </div>
  );
}
