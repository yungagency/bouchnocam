import { CONFIG } from '../../lib/config';
import { ago, distanceM, fmtDist, isConfirmed, reportColor, reportLabel } from '../../lib/format';
import { loadReports, map, markUserMovedMap, openOverlay, setTab, startGeo, toast, useApp } from '../../lib/store';
import { GLYPH, IconBack, IconCheck, IconLocate, IconRefresh } from '../../ui/icons';
import { LogoMark } from '../../ui/Logo';

export function NearbyView() {
  const reports = useApp((s) => s.reports);
  const pos = useApp((s) => s.pos);

  const list = reports.map((r) => ({ r, d: pos ? distanceM(pos, r) : null }));
  if (pos) list.sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  else list.sort((a, b) => new Date(b.r.created_at).getTime() - new Date(a.r.created_at).getTime());
  const near = pos ? list.filter((x) => (x.d ?? 0) < 2000).length : null;
  const confirmed = reports.filter(isConfirmed).length;

  return (
    <section className="panel panel--hero" aria-label="Autour de moi">
      <header className="hero-band">
        <div className="hero-band__bar">
          <button type="button" className="pf-icon-btn" aria-label="Retour à la carte" onClick={() => setTab('map')}><IconBack size={24} /></button>
          <button type="button" className="pf-icon-btn" aria-label="Actualiser" onClick={async () => { await loadReports({ silent: false }); toast('Liste à jour.', 1800); }}><IconRefresh size={22} /></button>
        </div>
        <h2>Autour de moi</h2>
        <p>{pos ? 'Les incidents les plus proches en premier' : 'Les incidents les plus récents en premier'}</p>
        <div className="hero-band__stats">
          <div><b>{reports.length}</b><span>incidents actifs</span></div>
          <div><b>{near ?? '–'}</b><span>à moins de 2 km</span></div>
          <div><b>{confirmed}</b><span>confirmés</span></div>
        </div>
      </header>

      <div className="hero-body">
        {!pos && (
          <div className="card card--cta">
            <p>Activez votre position pour voir les incidents sur votre route.</p>
            <button type="button" className="btn btn--primary btn--block" onClick={() => startGeo(true)}><IconLocate size={20} />Activer ma position</button>
          </div>
        )}
        {list.length === 0 && (
          <div className="card empty-state">
            <LogoMark size={84} />
            <strong>La route semble dégagée</strong>
            <p className="fine">Aucun incident signalé dans cette zone. Vous voyez un problème ? Touchez « Signaler ».</p>
          </div>
        )}
        <div className="nb-list">
          {list.slice(0, 60).map(({ r, d }) => {
            const ok = isConfirmed(r);
            return (
              <button key={r.id} type="button" className="nb-item" style={{ ['--c' as string]: reportColor(r) }} onClick={() => {
                setTab('map');
                markUserMovedMap();
                map()?.flyTo(r.lat, r.lng, 16);
                openOverlay({ kind: 'detail', id: r.id });
              }}>
                <span className="nb-item__icon">{GLYPH[r.type]}</span>
                <span className="nb-item__main">
                  <strong>{reportLabel(r)}</strong>
                  <small>{ago(r.created_at)}{r.contestations ? ` · ${r.contestations} « Plus là »` : ''}</small>
                </span>
                <span className="nb-item__side">
                  {d !== null && <b>{fmtDist(d)}</b>}
                  <span className={`tag ${ok ? 'tag--ok' : 'tag--wait'}`}>{ok ? <><IconCheck size={12} />Confirmé</> : `${r.confirmations}/${CONFIG.confirmationsNeeded}`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
