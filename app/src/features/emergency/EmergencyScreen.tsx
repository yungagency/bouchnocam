import { CONFIG } from '../../lib/config';
import { fmtDist, fmtDuration, mapsHref, telHref } from '../../lib/format';
import { closeOverlay, showRoute, startEmergency, startGeo, useApp } from '../../lib/store';
import type { RouteOption } from '../../lib/types';
import { IconAlert, IconAmbulance, IconCheck, IconClose, IconHospital, IconNavigate, IconPhone } from '../../ui/icons';

function Badges({ o }: { o: RouteOption }) {
  return (
    <div className="badges">
      {o.hospital.verified && o.hospital.emergency_24h && <span className="badge badge--ok"><IconCheck size={14} />Urgences 24h/24 vérifiées</span>}
      {!o.hospital.verified && <span className="badge">Fiche non vérifiée</span>}
      {o.avoided > 0 && <span className="badge badge--ok">Évite {o.avoided} incident{o.avoided > 1 ? 's' : ''} signalé{o.avoided > 1 ? 's' : ''}</span>}
      {o.incidents_on_route > 0 && <span className="badge badge--bad"><IconAlert size={14} />Passe près de {o.incidents_on_route} incident{o.incidents_on_route > 1 ? 's' : ''}</span>}
    </div>
  );
}

const SosButtons = () => (
  <div className="sos-row">
    <a className="sos-btn sos-btn--main" href={telHref(CONFIG.emergencyNumbers.medical.number)}>
      <IconPhone size={22} /><span><strong>{CONFIG.emergencyNumbers.medical.number}</strong>{CONFIG.emergencyNumbers.medical.label}</span>
    </a>
    <a className="sos-btn" href={telHref(CONFIG.emergencyNumbers.fire.number)}>
      <strong>{CONFIG.emergencyNumbers.fire.number}</strong>{CONFIG.emergencyNumbers.fire.label}
    </a>
    <a className="sos-btn" href={telHref(CONFIG.emergencyNumbers.police.number)}>
      <strong>{CONFIG.emergencyNumbers.police.number}</strong>{CONFIG.emergencyNumbers.police.label}
    </a>
  </div>
);

export function EmergencyScreen() {
  const em = useApp((s) => s.emergency);
  const geo = useApp((s) => s.geo);
  const results = em.data?.results ?? [];
  const best = results[em.selected];

  return (
    <div className="emergency" role="dialog" aria-modal="true" aria-label="Urgence">
      <div className="emergency__panel">
        <header className="emergency__head">
          <span className="emergency__icon"><IconAmbulance size={28} /></span>
          <div>
            <h1>Urgence</h1>
            <p>Hôpital le plus rapide, en évitant les incidents signalés</p>
          </div>
          <button type="button" className="round-btn round-btn--light" aria-label="Fermer" onClick={() => closeOverlay()}><IconClose size={22} /></button>
        </header>

        <div className="emergency__body">
          {(em.status === 'locating' || em.status === 'loading') && (
            <div className="em-loading">
              <span className="spinner" aria-hidden="true" />
              <strong>{em.status === 'locating' ? 'Recherche de votre position…' : "Calcul de l'itinéraire le plus rapide…"}</strong>
            </div>
          )}

          {em.status === 'error' && (
            <div className="em-error">
              <p>{em.error}</p>
              {geo === 'denied'
                ? <p className="fine">Autorisez la localisation dans les réglages du téléphone, puis réessayez.</p>
                : <button type="button" className="btn btn--dark btn--block" onClick={() => { startGeo(); startEmergency(); }}>Réessayer</button>}
            </div>
          )}

          {em.status === 'ready' && best && (
            <>
              <article className="hospital-card">
                <span className="hospital-card__icon"><IconHospital size={34} /></span>
                <div className="hospital-card__main">
                  <p className="eyebrow">{em.selected === 0 ? 'Recommandé' : 'Autre choix'}</p>
                  <h2>{best.hospital.name}</h2>
                  <p className="hospital-card__eta">
                    {best.duration_s ? <><strong>{fmtDuration(best.duration_s)}</strong> · {fmtDist(best.distance_m)}</> : <>{fmtDist(best.distance_m)} à vol d'oiseau</>}
                  </p>
                  <Badges o={best} />
                </div>
              </article>
              <div className="em-actions">
                <a className="btn btn--go btn--block btn--xl" href={mapsHref(best.hospital.lat, best.hospital.lng)} target="_blank" rel="noopener">
                  <IconNavigate size={24} />Y aller
                </a>
                {best.hospital.phone && (
                  <a className="btn btn--ghost btn--block" href={telHref(best.hospital.phone)}><IconPhone size={20} />Appeler l'hôpital</a>
                )}
              </div>
              {results.length > 1 && (
                <div className="em-others">
                  {results.map((o, i) => (i === em.selected ? null : (
                    <button key={o.hospital.id} type="button" className="em-other" onClick={() => showRoute(i)}>
                      <IconHospital size={22} />
                      <span><strong>{o.hospital.name}</strong>
                        <small>{o.duration_s ? `${fmtDuration(o.duration_s)} · ` : ''}{fmtDist(o.distance_m)}{o.incidents_on_route ? ' · incident sur le trajet' : ''}</small>
                      </span>
                    </button>
                  )))}
                </div>
              )}
              {!best.routed && <p className="fine">Itinéraire indisponible pour le moment : « Y aller » ouvre la navigation Google Maps.</p>}
            </>
          )}

          <h3 className="em-sos-title">Appeler les secours</h3>
          <SosButtons />
          <p className="fine">Bouchnocam ne connaît que les incidents signalés par ses usagers ; Google Maps tient compte du reste du trafic.</p>
        </div>
      </div>
    </div>
  );
}
