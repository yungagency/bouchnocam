import { CONFIG } from './config';
import type { Pos, Report, ReportType, Role, Severity } from './types';

export const TYPES: Record<ReportType, { label: string; short: string; color: string }> = {
  embouteillage: { label: 'Embouteillage', short: 'Bouchon', color: '#EF7D00' },
  accident: { label: 'Accident', short: 'Accident', color: '#B3122E' },
  route_barree: { label: 'Route barrée', short: 'Route barrée', color: '#263F73' },
  travaux: { label: 'Travaux', short: 'Travaux', color: '#8A5A00' },
  inondation: { label: 'Inondation', short: 'Inondation', color: '#0A6FB0' },
  route_impraticable: { label: 'Route impraticable', short: 'Impraticable', color: '#5D4037' },
};

// Phrase de confirmation, accordée au type (« Route barrée signalée », « Travaux signalés »…)
export const reportedPhrase = (type: ReportType, severity: Severity | null) => {
  if (type === 'embouteillage') return `Embouteillage ${severity ? SEVERITY[severity].label.toLowerCase() : ''} signalé`.replace('  ', ' ');
  return ({
    accident: 'Accident signalé',
    route_barree: 'Route barrée signalée',
    travaux: 'Travaux signalés',
    inondation: 'Inondation signalée',
    route_impraticable: 'Route impraticable signalée',
  } as const)[type];
};

export const TRAFFIC_STATES: Record<'fluide' | 'modere' | 'dense' | 'bouchon', { label: string; color: string }> = {
  fluide: { label: 'Fluide', color: '#3FBF5F' },
  modere: { label: 'Modéré', color: '#FF974D' },
  dense: { label: 'Dense', color: '#F23C32' },
  bouchon: { label: 'Embouteillage', color: '#811F1F' },
};

export const SEVERITY: Record<Severity, { label: string; hint: string; color: string; tint: string }> = {
  1: { label: 'Léger', hint: 'ça roule au ralenti', color: '#E0A800', tint: '#FFF4CC' },
  2: { label: 'Moyen', hint: 'ça avance par à-coups', color: '#EF7D00', tint: '#FFE6CC' },
  3: { label: 'Bloqué', hint: "tout est à l'arrêt", color: '#D62828', tint: '#FDDCDC' },
};

export const ROLES: Record<Role, string> = { usager: 'Usager', taximan: 'Taximan', moto: 'Moto-taximan' };

export const isConfirmed = (r: Pick<Report, 'status' | 'confirmations'>) =>
  r.status === 'confirme' || r.confirmations >= CONFIG.confirmationsNeeded;

export const reportColor = (r: Pick<Report, 'type' | 'severity'>) =>
  (r.type === 'embouteillage' && r.severity ? SEVERITY[r.severity].color : TYPES[r.type]?.color) || '#555';

export const reportLabel = (r: Pick<Report, 'type' | 'severity'>) =>
  r.type === 'embouteillage' && r.severity ? `Embouteillage · ${SEVERITY[r.severity].label}` : TYPES[r.type]?.label || 'Signalement';

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const fmtDist = (m: number) =>
  m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;

export function fmtDuration(s: number) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;
  const d = Math.floor(h / 24);
  return `il y a ${d} jour${d > 1 ? 's' : ''}`;
}

export function until(iso: string) {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 1) return "dans moins d'une minute";
  if (min < 60) return `dans ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `dans ${h} h`;
  const d = Math.round(h / 24);
  return `dans ${d} jour${d > 1 ? 's' : ''}`;
}

export const inCameroon = (p: { lat: number; lng: number }) => p.lat > 1.6 && p.lat < 13.1 && p.lng > 8.4 && p.lng < 16.2;
export const isFresh = (p: Pos | null, ms = 120000): p is Pos => Boolean(p && Date.now() - p.ts < ms);

export const telHref = (num: string) => {
  const d = num.replace(/[^\d+]/g, '');
  if (d.startsWith('+') || d.length <= 4) return `tel:${d}`;
  return `tel:+237${d.replace(/^237/, '')}`;
};

export const mapsHref = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

export const ERRORS: Record<string, string> = {
  network: 'Pas de connexion internet. Réessayez.',
  invalid_credentials: 'Numéro ou mot de passe incorrect.',
  'Invalid login credentials': 'Numéro ou mot de passe incorrect.',
  user_already_exists: 'Ce numéro a déjà un compte. Connectez-vous.',
  'User already registered': 'Ce numéro a déjà un compte. Connectez-vous.',
  weak_password: 'Mot de passe trop faible : 6 caractères minimum.',
  invalid_phone: 'Numéro invalide : 9 chiffres, par exemple 6XX XX XX XX.',
  invalid_name: 'Indiquez votre nom (2 lettres minimum).',
  signup_failed: "La création du compte n'a pas abouti. Réessayez dans un instant.",
  email_not_confirmed: "Compte pas encore activé. Contactez l'équipe Bouchnocam.",
  confirmation_required: "Compte créé mais pas encore activé. Contactez l'équipe Bouchnocam.",
  signup_disabled: 'Les inscriptions sont fermées pour le moment.',
  over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes.',
  over_email_send_rate_limit: 'Trop de tentatives. Patientez quelques minutes.',
  email_address_invalid: "Inscription refusée par le serveur. Contactez l'équipe Bouchnocam.",
  own_report: "C'est votre signalement : ce sont les autres usagers qui le confirment.",
  already_voted: 'Vous avez déjà donné votre avis sur ce signalement.',
  too_far: 'Vous devez être à moins de 3 km pour confirmer ou contester.',
  report_inactive: "Ce signalement n'est plus actif.",
  rate_limited: 'Trop de signalements en peu de temps. Réessayez dans un moment.',
  out_of_zone: 'Votre position est en dehors de la zone couverte (Cameroun).',
  gps_imprecise: 'Position GPS trop imprécise. Placez-vous à découvert et réessayez.',
  forbidden: 'Action réservée aux modérateurs.',
  auth_required: "Connectez-vous d'abord.",
  cannot_cancel: "Trop tard pour annuler : quelqu'un a déjà répondu à ce signalement.",
  geo_denied: 'Localisation refusée. Autorisez-la dans les réglages du téléphone.',
  geo_unavailable: 'Position introuvable. Activez le GPS et réessayez.',
  no_hospitals: 'Aucun hôpital enregistré pour le moment.',
  too_many_points: 'Envoi trop volumineux, nouvel essai en cours.',
  wake_lock: "Impossible de garder l'écran allumé : laissez-le allumé vous-même.",
};

export const errorText = (e: unknown) => {
  const code = (e as { code?: string; message?: string })?.code || (e as Error)?.message || '';
  return ERRORS[code] || 'Une erreur est survenue. Réessayez.';
};
