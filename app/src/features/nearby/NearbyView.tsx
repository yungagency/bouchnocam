import { CONFIG } from '../../lib/config';
import { ago, distanceM, fmtDist, isConfirmed, reportColor, reportLabel } from '../../lib/format';
import { loadReports, map, markUserMovedMap, openOverlay, setTab, startGeo, toast, useApp } from '../../lib/store';
import { GLYPH, IconCheck, IconLocate, IconRefresh } from '../../ui/icons';

export function NearbyView() {
  const reports = useApp((s) => s.reports);
  const pos = useApp((s) => s.pos);

  const list = reports.map((r) => ({ r, d: pos ? distanceM(pos, r) : null }));
  if (pos) list.sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  else list.sort((a, b) => new Date(b.r.created_at).getTime() - new Date(a.r.created_at).getTime());

  return (
    <section className="panel" aria-label="Autour de moi">
      <h2 className="panel-title">Autour de moi</h2>
      <p className="panel-sub">{pos ? 'Incidents actifs, du plus proche au plus loin.' : 'Incidents actifs, du plus récent au plus ancien.'}</p>
      {!pos && (
        <div className="card">
          <p>Activez votre position pour voir les incidents les plus proches de vous.</p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => startGeo(true)}><IconLocate size={20} />Activer ma position</button>
        </div>
      )}
      <div className="card card--list">
        {list.length === 0 && (
          <div className="empty"><IconCheck size={36} /><p>Aucun incident signalé dans cette zone.<br />La route semble dégagée.</p></div>
        )}
        {list.slice(0, 60).map(({ r, d }) => {
          const ok = isConfirmed(r);
          return (
            <button key={r.id} type="button" className="row-btn" onClick={() => {
              setTab('map');
              markUserMovedMap();
              map()?.flyTo(r.lat, r.lng, 16);
              openOverlay({ kind: 'detail', id: r.id });
            }}>
              <span className="row-btn__icon" style={{ ['--c' as string]: reportColor(r) }}>{GLYPH[r.type]}</span>
              <span className="row-btn__main">
                <strong>{reportLabel(r)}</strong>
                <small>{d !== null ? `${fmtDist(d)} · ` : ''}{ago(r.created_at)}</small>
              </span>
              <span className={`tag ${ok ? 'tag--ok' : 'tag--wait'}`}>{ok ? <><IconCheck size={12} />Confirmé</> : `${r.confirmations}/${CONFIG.confirmationsNeeded}`}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn btn--ghost btn--block" onClick={async () => { await loadReports({ silent: false }); toast('Liste à jour.', 1800); }}>
        <IconRefresh size={20} />Actualiser
      </button>
    </section>
  );
}
