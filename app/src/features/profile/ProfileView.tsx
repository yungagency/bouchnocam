import * as api from '../../lib/api';
import { ROLES, SEVERITY, TYPES, ago, reportColor } from '../../lib/format';
import {
  closeOverlay, isStandalone, openOverlay, promptInstall, refreshUser, setTab, startGeo, toast, useApp,
} from '../../lib/store';
import type { Leader, MyReport } from '../../lib/types';
import { GLYPH, IconBack, IconCheck, IconInstall, IconLocate, IconMegaphone, IconShield, IconStar } from '../../ui/icons';
import { LogoMark } from '../../ui/Logo';
import { Sheet } from '../../ui/Sheet';
import { BadgeStrip } from './Badges';

const IconGear = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
const fmtPts = (n: number) => n.toLocaleString('fr-FR');

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xl' }) {
  return <span className={`pf-avatar pf-avatar--${size}`}>{initials(name)}</span>;
}

function Ranking({ board, meId, me }: { board: Leader[] | null; meId: string | null; me: { display_name: string; points: number; rank: number } | null }) {
  const top = (board ?? []).slice(0, 10);
  const meInTop = top.some((p) => p.id === meId);
  return (
    <div className="pf-ranking">
      <h3>Classements <small>Top 10</small></h3>
      {top.length === 0 && <p className="fine center">Personne n'a encore de points. Soyez le premier !</p>}
      <div className="pf-ranking__list">
      {top.map((p, i) => (
        <div key={p.id} className={`pf-rank ${p.id === meId ? 'is-me' : ''}`}>
          <span className={`pf-rank__pos pf-rank__pos--${i + 1}`}>{i + 1}</span>
          <Avatar name={p.display_name} />
          <span className="pf-rank__name">{p.display_name}<small>{ROLES[p.role]}</small></span>
          <b>{fmtPts(p.points)}</b>
        </div>
      ))}
      </div>
      {me && meId && !meInTop && me.points > 0 && (
        <div className="pf-rank is-me">
          <span className="pf-rank__pos">{me.rank}</span>
          <Avatar name={me.display_name} />
          <span className="pf-rank__name">{me.display_name}<small>Vous</small></span>
          <b>{fmtPts(me.points)}</b>
        </div>
      )}
    </div>
  );
}

const STATUS: Record<MyReport['status'], { label: string; cls: string }> = {
  confirme: { label: 'Approuvé', cls: 'is-ok' },
  actif: { label: 'En attente', cls: 'is-wait' },
  retire: { label: 'Retiré', cls: 'is-bad' },
  expire: { label: 'Expiré', cls: 'is-off' },
};

function History({ items }: { items: MyReport[] }) {
  if (!items.length) {
    return <p className="fine center pf-empty">Aucun signalement pour l'instant.<br />Touchez « Signaler » quand vous voyez un problème.</p>;
  }
  return (
    <div className="pf-history">
      {items.map((r) => {
        const st = STATUS[r.status] ?? STATUS.expire;
        const kind = r.type === 'embouteillage' && r.severity ? SEVERITY[r.severity].label : TYPES[r.type].label;
        return (
          <div key={r.id} className="pf-hist">
            <div className="pf-hist__place">
              <span className="pf-hist__icon" style={{ ['--c' as string]: reportColor(r) }}>{GLYPH[r.type]}</span>
              <strong>{r.place_label || TYPES[r.type].label}</strong>
            </div>
            <div className="pf-hist__grid">
              <span className="pf-hist__kind" style={{ color: reportColor(r) }}>{kind}</span>
              <em>{ago(r.created_at)}</em>
              <span className={`pf-hist__pts ${r.points < 0 ? 'neg' : ''}`}>{r.points > 0 ? '+' : ''}{r.points} points</span>
              <span className={`pf-hist__status ${st.cls}`}>{st.label}{r.status === 'confirme' && <i><IconCheck size={13} /></i>}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

export function ProfileView() {
  const signedIn = useApp((s) => s.signedIn);
  const me = useApp((s) => s.me);
  const mine = useApp((s) => s.myReports);
  const board = useApp((s) => s.leaderboard);
  const meId = api.currentUserId();

  return (
    <section className="panel panel--profile" aria-label="Profil">
      <header className="pf-hero">
        <div className="pf-hero__bar">
          <button type="button" className="pf-icon-btn" aria-label="Retour à la carte" onClick={() => setTab('map')}><IconBack size={24} /></button>
          {signedIn && <button type="button" className="pf-icon-btn" aria-label="Réglages du compte" onClick={() => openOverlay({ kind: 'account' })}><IconGear /></button>}
        </div>
        {signedIn && me ? (
          <>
            <div className="pf-hero__ring"><Avatar name={me.display_name} size="xl" /></div>
            <h2 className="pf-hero__name">{me.display_name}</h2>
            <p className="pf-hero__role">{ROLES[me.role]}{me.is_admin ? ' · Modérateur' : ''}</p>
            <p className="pf-hero__pts">{fmtPts(me.points)}</p>
            <p className="pf-hero__label">Points cumulés</p>
          </>
        ) : signedIn ? (
          <div className="pf-hero__loading"><LogoMark /></div>
        ) : (
          <>
            <div className="pf-hero__ring"><span className="pf-avatar pf-avatar--xl pf-avatar--guest"><IconStar size={40} /></span></div>
            <h2 className="pf-hero__name">Rejoignez le pilote</h2>
            <p className="pf-hero__label">Signalez, confirmez, gagnez des points.</p>
            <div className="pf-hero__cta">
              <button type="button" className="btn btn--gold btn--lg" onClick={() => openOverlay({ kind: 'auth', mode: 'signup' })}>Créer mon compte</button>
              <button type="button" className="btn btn--glass" onClick={() => openOverlay({ kind: 'auth', mode: 'login' })}>J'ai déjà un compte</button>
            </div>
          </>
        )}
      </header>

      <div className="pf-body">
        <Ranking board={board} meId={meId} me={me} />

        {signedIn && (
          <>
            <h3 className="pf-title">Badges</h3>
            <BadgeStrip me={me} />
            <h3 className="pf-title">Historiques / Statistiques</h3>
            {me && (
              <div className="pf-stats">
                <div><b>{me.rank}<sup>{me.rank === 1 ? 'er' : 'e'}</sup></b><span>au classement</span></div>
                <div><b>{me.reports_count}</b><span>signalements</span></div>
                <div><b>{me.confirmed_count}</b><span>approuvés</span></div>
              </div>
            )}
            <History items={mine} />
          </>
        )}

        <h3 className="pf-title">Comment gagner des points</h3>
        <div className="card"><Rules /></div>
        {!isStandalone() && (
          <div className="card pf-install">
            <LogoMark size={52} />
            <div>
              <strong>Installer Bouchnocam</strong>
              <p className="fine">Sur l'écran d'accueil, en plein écran.</p>
            </div>
            <button type="button" className="btn btn--primary" onClick={promptInstall} aria-label="Installer l'application"><IconInstall size={20} /></button>
          </div>
        )}
        {!signedIn && (
          <button type="button" className="btn btn--link btn--block" onClick={() => openOverlay({ kind: 'privacy' })}><IconShield size={18} />Règles et confidentialité</button>
        )}
      </div>
    </section>
  );
}

export function AccountSheet() {
  return (
    <Sheet label="Mon compte">
      <h2 className="sheet__title">Mon compte</h2>
      <div className="stack">
        <button type="button" className="btn btn--ghost btn--block" onClick={() => openOverlay({ kind: 'edit' })}>Modifier mon nom ou mon profil</button>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => openOverlay({ kind: 'privacy' })}><IconShield size={18} />Règles et confidentialité</button>
        {!isStandalone() && <button type="button" className="btn btn--ghost btn--block" onClick={() => { closeOverlay(); promptInstall(); }}><IconInstall size={18} />Installer l'application</button>}
        <button type="button" className="btn btn--danger btn--block" onClick={async () => { closeOverlay(); await api.signOut(); await refreshUser(); toast('Vous êtes déconnecté.'); }}>Se déconnecter</button>
      </div>
    </Sheet>
  );
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstallSheet() {
  return (
    <Sheet label="Installer l'application">
      <div className="center"><LogoMark size={88} /></div>
      <h2 className="sheet__title center" style={{ margin: '8px 0 12px' }}>{isIOS() ? 'Installer sur iPhone' : "Installer l'application"}</h2>
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
      <div className="center"><LogoMark size={96} /></div>
      <h2 className="sheet__title center" style={{ margin: '6px 0 4px' }}>Bienvenue sur Bouchnocam</h2>
      <p className="muted center">La carte des routes de Yaoundé, tenue à jour par ceux qui y roulent.</p>
      <ul className="onb">
        <li><span className="onb__icon onb__icon--red"><IconMegaphone size={24} /></span>
          <span><strong>Signale</strong><span>Le gros bouton rouge, l'intensité, Envoyer : c'est fait.</span></span></li>
        <li><span className="onb__icon onb__icon--green"><IconCheck size={24} /></span>
          <span><strong>Confirme</strong><span>Vous passez devant ? Dites « Toujours là » ou « Plus là ».</span></span></li>
        <li><span className="onb__icon onb__icon--yellow"><IconStar size={24} /></span>
          <span><strong>Gagne</strong><span>Des points et des badges quand vos signalements sont confirmés.</span></span></li>
      </ul>
      <p className="notice notice--warn"><strong>Urgence</strong> (bouton jaune) : en cas d'accident, l'hôpital le plus rapide et les numéros de secours.</p>
      <div className="stack">
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => { closeOverlay(); startGeo(true); }}><IconLocate size={22} />Activer ma position</button>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => closeOverlay()}>Plus tard</button>
      </div>
      <p className="fine center">Votre position sert à placer la carte et vos signalements. Vos trajets ne sont partagés que si vous activez le Mode conduite, de façon anonyme.</p>
    </Sheet>
  );
}
