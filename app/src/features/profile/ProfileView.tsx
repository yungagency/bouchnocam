import * as api from '../../lib/api';
import { ROLES, ago, reportColor, reportLabel } from '../../lib/format';
import {
  closeOverlay, isStandalone, openOverlay, promptInstall, refreshUser, startGeo, toast, useApp,
} from '../../lib/store';
import { GLYPH, IconCheck, IconInstall, IconLocate, IconMegaphone, IconShield, IconStar } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';

const STATUS = {
  actif: ['tag--wait', 'En attente'],
  confirme: ['tag--ok', 'Confirmé'],
  retire: ['tag--bad', 'Retiré'],
  expire: ['tag--off', 'Expiré'],
} as const;

function Rules() {
  return (
    <ul className="rules">
      <li><span>Votre signalement est confirmé par 2 usagers</span><b>+10 pts</b></li>
      <li><span>Vous confirmez un incident réel</span><b>+2 pts</b></li>
      <li><span>Vous signalez la fin d'un incident</span><b>+2 pts</b></li>
      <li><span>Votre signalement est contesté</span><b className="neg">−5 pts</b></li>
    </ul>
  );
}

function Leaderboard() {
  const board = useApp((s) => s.leaderboard);
  const me = api.currentUserId();
  if (!board?.length) return <p className="fine">Personne n'a encore de points. Soyez le premier !</p>;
  return (
    <div>
      {board.map((p, i) => (
        <div key={p.id} className={`leader ${p.id === me ? 'is-me' : ''}`}>
          <span className="leader__rank">{i + 1}</span>
          <span className="leader__name"><strong>{p.display_name}</strong><small>{ROLES[p.role]}</small></span>
          <b>{p.points} pts</b>
        </div>
      ))}
    </div>
  );
}

function InstallCard() {
  if (isStandalone()) return null;
  return (
    <div className="card">
      <h3>Installer Bouchnocam</h3>
      <p className="fine">Ajoutez l'application à votre écran d'accueil : elle s'ouvre plus vite, en plein écran.</p>
      <button type="button" className="btn btn--primary btn--block" onClick={promptInstall}><IconInstall size={20} />Installer l'application</button>
    </div>
  );
}

export function ProfileView() {
  const signedIn = useApp((s) => s.signedIn);
  const me = useApp((s) => s.me);
  const mine = useApp((s) => s.myReports);

  if (!signedIn) {
    return (
      <section className="panel" aria-label="Profil">
        <h2 className="panel-title">Profil</h2>
        <p className="panel-sub">Signalez, confirmez, gagnez des points.</p>
        <div className="card">
          <p>Créez un compte gratuit pour signaler les incidents, confirmer ceux des autres et apparaître dans le classement.</p>
          <div className="stack">
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => openOverlay({ kind: 'auth', mode: 'signup' })}>Créer un compte</button>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => openOverlay({ kind: 'auth', mode: 'login' })}>J'ai déjà un compte</button>
          </div>
        </div>
        <div className="card"><h3>Comment gagner des points</h3><Rules /></div>
        <div className="card"><h3>Classement</h3><Leaderboard /></div>
        <InstallCard />
        <button type="button" className="btn btn--link btn--block" onClick={() => openOverlay({ kind: 'privacy' })}><IconShield size={18} />Règles et confidentialité</button>
      </section>
    );
  }

  return (
    <section className="panel" aria-label="Profil">
      <div className="hero">
        <span className="avatar avatar--xl">{(me?.display_name || '?').slice(0, 1).toUpperCase()}</span>
        <div className="hero__who">
          <div className="hero__name">{me?.display_name ?? '…'}</div>
          <div className="hero__role">{me ? ROLES[me.role] : ''}{me?.is_admin ? ' · Modérateur' : ''}</div>
        </div>
        <div className="hero__points"><b>{me?.points ?? 0}</b><span>points</span></div>
      </div>
      <div className="stats">
        <div className="stat"><b>{me ? <>{me.rank}<sup>e</sup></> : '–'}</b><span>au classement</span></div>
        <div className="stat"><b>{me?.reports_count ?? 0}</b><span>signalements</span></div>
        <div className="stat"><b>{me?.confirmed_count ?? 0}</b><span>confirmés</span></div>
      </div>
      <div className="card card--list">
        <h3>Mes signalements</h3>
        {mine.length === 0 && <p className="fine">Aucun signalement pour l'instant. Touchez « Signaler » quand vous voyez un problème.</p>}
        {mine.map((r) => {
          const [cls, label] = STATUS[r.status] ?? STATUS.expire;
          return (
            <div key={r.id} className="row-btn row-btn--static">
              <span className="row-btn__icon" style={{ ['--c' as string]: reportColor(r) }}>{GLYPH[r.type]}</span>
              <span className="row-btn__main"><strong>{reportLabel(r)}</strong>
                <small>{ago(r.created_at)} · {r.confirmations} confirmation{r.confirmations > 1 ? 's' : ''}{r.points ? ` · ${r.points > 0 ? '+' : ''}${r.points} pts` : ''}</small>
              </span>
              <span className={`tag ${cls}`}>{label}</span>
            </div>
          );
        })}
      </div>
      <div className="card"><h3>Classement</h3><Leaderboard /></div>
      <div className="card"><h3>Comment gagner des points</h3><Rules /></div>
      <InstallCard />
      <div className="card">
        <h3>Mon compte</h3>
        <div className="stack">
          <button type="button" className="btn btn--ghost btn--block" onClick={() => openOverlay({ kind: 'edit' })}>Modifier mon nom ou mon profil</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => openOverlay({ kind: 'privacy' })}><IconShield size={18} />Règles et confidentialité</button>
          <button type="button" className="btn btn--danger btn--block" onClick={async () => { await api.signOut(); await refreshUser(); toast('Vous êtes déconnecté.'); }}>Se déconnecter</button>
        </div>
      </div>
    </section>
  );
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstallSheet() {
  return (
    <Sheet label="Installer l'application">
      <h2 className="sheet__title">{isIOS() ? 'Installer sur iPhone' : "Installer l'application"}</h2>
      {isIOS() ? (
        <ol className="steps">
          <li>Ouvrez cette page dans <strong>Safari</strong>.</li>
          <li>Touchez <strong>Partager</strong> (le carré avec une flèche).</li>
          <li>Choisissez <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.</li>
        </ol>
      ) : (
        <ol className="steps">
          <li>Ouvrez cette page dans <strong>Chrome</strong>.</li>
          <li>Touchez le menu <strong>⋮</strong> en haut à droite.</li>
          <li>Choisissez <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.</li>
        </ol>
      )}
      <button type="button" className="btn btn--primary btn--block" onClick={() => closeOverlay()}>J'ai compris</button>
    </Sheet>
  );
}

export function OnboardingSheet() {
  return (
    <Sheet label="Bienvenue">
      <h2 className="sheet__title">Bienvenue sur Bouchnocam</h2>
      <p className="muted">La carte des routes de Yaoundé, tenue à jour par ceux qui y roulent.</p>
      <ul className="onb">
        <li><span className="onb__icon onb__icon--red"><IconMegaphone size={24} /></span>
          <span><strong>Signale</strong><span>Une touche sur le gros bouton rouge, une touche sur le problème : c'est envoyé.</span></span></li>
        <li><span className="onb__icon onb__icon--green"><IconCheck size={24} /></span>
          <span><strong>Confirme</strong><span>Vous passez devant ? Dites « Toujours là » ou « Plus là ».</span></span></li>
        <li><span className="onb__icon onb__icon--yellow"><IconStar size={24} /></span>
          <span><strong>Gagne</strong><span>Des points quand vos signalements sont confirmés par d'autres.</span></span></li>
      </ul>
      <p className="notice notice--warn"><strong>Urgence</strong> (bouton jaune) : en cas d'accident, l'hôpital le plus rapide et les numéros de secours.</p>
      <div className="stack">
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => { closeOverlay(); startGeo(true); }}><IconLocate size={22} />Activer ma position</button>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => closeOverlay()}>Plus tard</button>
      </div>
      <p className="fine center">Votre position sert à placer la carte et vos signalements. Nous ne suivons pas vos trajets.</p>
    </Sheet>
  );
}
