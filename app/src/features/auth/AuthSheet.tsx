import { useState, type FormEvent } from 'react';
import * as api from '../../lib/api';
import { CONFIG } from '../../lib/config';
import { ROLES, errorText } from '../../lib/format';
import {
  closeOverlay, flushPendingReport, getState, loadLeaderboard, openOverlay, refreshUser, toast, useApp,
} from '../../lib/store';
import type { Role } from '../../lib/types';
import { Sheet } from '../../ui/Sheet';
import { LogoMark } from '../../ui/Logo';

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div className="field"><span>Je suis</span>
      <div className="role-row" role="radiogroup">
        {(Object.keys(ROLES) as Role[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'is-on' : ''} onClick={() => onChange(k)}>
            {ROLES[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AuthSheet({ mode, reason }: { mode: 'login' | 'signup'; reason?: string }) {
  const signup = mode === 'signup';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('usager');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = api.normalizePhone(phone);
    if (signup && name.trim().length < 2) return setError('Indiquez un nom ou surnom (2 caractères minimum).');
    if (!p) return setError('Numéro invalide : 9 chiffres commençant par 6 ou 2.');
    if (password.length < 6) return setError('Mot de passe : 6 caractères minimum.');
    if (signup && !consent) return setError('Veuillez accepter les règles du pilote.');
    setError('');
    setBusy(true);
    try {
      if (signup) await api.signUp({ phone: p, password, displayName: name.trim(), role });
      else await api.signIn({ phone: p, password });
      closeOverlay();
      await refreshUser();
      const me = getState().me;
      toast(me ? `Bienvenue, ${me.display_name} !` : 'Vous êtes connecté.');
      await flushPendingReport();
    } catch (err) {
      setBusy(false);
      setError(errorText(err));
    }
  };

  return (
    <Sheet label={signup ? 'Créer mon compte' : 'Se connecter'}>
      <div className="auth-head">
        <LogoMark size={72} />
        <h2 className="sheet__title">{signup ? 'Créer mon compte' : 'Bon retour !'}</h2>
        <p className="muted">{reason || (signup ? 'Gratuit, en 30 secondes, avec votre numéro.' : 'Connectez-vous avec votre numéro de téléphone.')}</p>
      </div>
      <form onSubmit={submit} noValidate>
        {signup && (
          <label className="field"><span>Nom ou surnom (visible dans le classement)</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" />
          </label>
        )}
        <label className="field"><span>Numéro de téléphone</span>
          <div className="phone-input"><b>+237</b>
            <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XX XX XX" autoComplete="tel-national" />
          </div>
        </label>
        <label className="field"><span>Mot de passe{signup ? ' (6 caractères minimum)' : ''}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} />
        </label>
        {signup && <RolePicker value={role} onChange={setRole} />}
        {signup && (
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>J'accepte les <button type="button" className="link" onClick={() => openOverlay({ kind: 'privacy' })}>règles et la confidentialité</button> du pilote Bouchnocam.</span>
          </label>
        )}
        <p className="form-error" role="alert">{error}</p>
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Un instant…' : signup ? 'Créer mon compte' : 'Se connecter'}
        </button>
      </form>
      <p className="switch-line">
        {signup ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
        <button type="button" className="link" onClick={() => openOverlay({ kind: 'auth', mode: signup ? 'login' : 'signup', reason })}>
          {signup ? 'Se connecter' : 'Créer un compte'}
        </button>
      </p>
      {!signup && <p className="fine center">Mot de passe oublié ? Appelez l'équipe Bouchnocam au {CONFIG.teamPhone}.</p>}
    </Sheet>
  );
}

export function PrivacySheet() {
  return (
    <Sheet label="Règles et confidentialité">
      <h2 className="sheet__title">Règles et confidentialité</h2>
      <p className="muted">Bouchnocam est en phase pilote à Yaoundé.</p>
      <div className="card card--flat">
        <h3>Ce que nous enregistrons</h3>
        <ul>
          <li>Votre numéro de téléphone, uniquement pour vous connecter. Il n'est jamais affiché.</li>
          <li>Votre nom ou surnom et votre profil (usager, taximan, moto-taximan), visibles dans le classement.</li>
          <li>La position GPS de chaque signalement. Le signalement est public, sans votre nom.</li>
          <li>Vos confirmations. Votre position sert à vérifier la distance puis n'est pas conservée.</li>
          <li>Bouton Urgence : votre position est envoyée pour calculer l'itinéraire, sans être enregistrée.</li>
        </ul>
        <p>Nous ne suivons pas vos trajets. Les données sont hébergées chez Supabase (Europe).</p>
      </div>
      <div className="card card--flat">
        <h3>Les règles</h3>
        <ul>
          <li>Ne signalez que ce que vous voyez vraiment, à l'endroit où vous êtes.</li>
          <li>Ne manipulez pas le téléphone en conduisant.</li>
          <li>Les fausses alertes font perdre des points et peuvent être retirées par la modération.</li>
        </ul>
      </div>
      <p className="fine">Supprimer votre compte ou poser une question : {CONFIG.teamPhone} · {CONFIG.teamEmail}</p>
    </Sheet>
  );
}

export function EditProfileSheet() {
  const me = useApp((s) => s.me);
  const [name, setName] = useState(me?.display_name ?? '');
  const [role, setRole] = useState<Role>(me?.role ?? 'usager');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Nom trop court.');
    try {
      await api.updateProfile({ displayName: name.trim(), role });
      closeOverlay();
      await refreshUser();
      loadLeaderboard();
      toast('Profil mis à jour.');
    } catch (err) { setError(errorText(err)); }
  };
  return (
    <Sheet label="Mon profil">
      <h2 className="sheet__title">Mon profil</h2>
      <form onSubmit={submit}>
        <label className="field"><span>Nom ou surnom</span>
          <input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <RolePicker value={role} onChange={setRole} />
        <p className="form-error" role="alert">{error}</p>
        <button type="submit" className="btn btn--primary btn--block btn--lg">Enregistrer</button>
      </form>
    </Sheet>
  );
}
