import { useState } from 'react';
import * as api from '../../lib/api';
import { CONFIG } from '../../lib/config';
import { ago, distanceM, errorText, fmtDist, isConfirmed, reportColor, reportLabel, until } from '../../lib/format';
import { closeOverlay, openOverlay, setState, toast, useApp, vote } from '../../lib/store';
import { GLYPH, IconCheck, IconX } from '../../ui/icons';
import { Notice, Sheet } from '../../ui/Sheet';

export function ReportDetail({ id }: { id: string }) {
  const r = useApp((s) => s.reports.find((x) => x.id === id));
  const pos = useApp((s) => s.pos);
  const signedIn = useApp((s) => s.signedIn);
  const mine = useApp((s) => Boolean(s.mine[id]));
  const voted = useApp((s) => s.votes[id]);
  const isAdmin = useApp((s) => Boolean(s.me?.is_admin));
  const [busy, setBusy] = useState(false);

  if (!r) {
    return <Sheet label="Signalement"><h2 className="sheet__title">Signalement terminé</h2><p className="muted">Ce signalement n'est plus actif.</p></Sheet>;
  }
  const dist = pos ? distanceM(pos, r) : null;
  const ok = isConfirmed(r);
  const n = r.confirmations;

  const doVote = async (v: 1 | -1) => {
    setBusy(true);
    try {
      const res = await vote(r, v);
      closeOverlay();
      if (res.status === 'retire') toast('Merci ! Le signalement a été retiré de la carte.');
      else if (v > 0) toast(res.confirmations >= CONFIG.confirmationsNeeded ? 'Merci ! Signalement confirmé (+2 points).' : 'Merci ! Encore une confirmation et il sera validé.');
      else toast('Merci ! Votre avis est enregistré.');
    } catch (e) {
      setBusy(false);
      if ((e as api.ApiError).code === 'already_voted') setState((s) => ({ votes: { ...s.votes, [r.id]: v } }));
      toast(errorText(e), 6000);
    }
  };

  const moderate = async () => {
    setBusy(true);
    try {
      await api.adminRemoveReport(r.id);
      setState((s) => ({ reports: s.reports.filter((x) => x.id !== r.id) }));
      closeOverlay();
      toast('Signalement retiré.');
    } catch (e) { setBusy(false); toast(errorText(e)); }
  };

  let actions;
  if (!signedIn) {
    actions = <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => openOverlay({ kind: 'auth', mode: 'login' })}>Se connecter pour confirmer</button>;
  } else if (mine) {
    actions = <Notice>C'est votre signalement. Les autres usagers vont le confirmer.</Notice>;
  } else if (voted) {
    actions = <Notice tone="ok">Merci, vous avez répondu « {voted > 0 ? 'Toujours là' : 'Plus là'} ».</Notice>;
  } else if (dist !== null && dist > CONFIG.voteRadiusM) {
    actions = <Notice>Approchez-vous à moins de 3 km pour confirmer ou contester.</Notice>;
  } else {
    actions = (
      <>
        <p className="vote-q">Vous y êtes ?</p>
        <div className="vote-row">
          <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={() => doVote(1)}><IconCheck size={22} />Toujours là</button>
          <button type="button" className="btn btn--ghost btn--lg" disabled={busy} onClick={() => doVote(-1)}><IconX size={22} />Plus là</button>
        </div>
      </>
    );
  }

  return (
    <Sheet label={reportLabel(r)}>
      <div className="detail-head">
        <span className="detail-icon" style={{ ['--c' as string]: reportColor(r) }}>{GLYPH[r.type]}</span>
        <div>
          <h2 className="sheet__title">{reportLabel(r)}</h2>
          <p className="muted">Signalé {ago(r.created_at)}{dist !== null ? ` · à ${fmtDist(dist)}` : ''}</p>
        </div>
      </div>
      <div className={`reliability ${ok ? 'is-ok' : ''}`}>
        {ok ? <><IconCheck size={18} />Confirmé par {n} usager{n > 1 ? 's' : ''}</> : <>En attente de confirmation ({n}/{CONFIG.confirmationsNeeded})</>}
        {r.contestations > 0 && <span className="muted"> · {r.contestations} « Plus là »</span>}
      </div>
      <p className="fine">Disparaît {until(r.expires_at)} sans nouvelle confirmation.</p>
      {actions}
      {isAdmin && <button type="button" className="btn btn--danger btn--block" style={{ marginTop: 14 }} disabled={busy} onClick={moderate}>Retirer (modération)</button>}
    </Sheet>
  );
}
