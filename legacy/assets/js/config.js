// Configuration publique de l'application.
// La clé "publishable" Supabase est faite pour être visible côté navigateur :
// la sécurité repose sur les règles RLS et les fonctions de la base.
export const CONFIG = {
  supabaseUrl: 'https://etnigfvbedlhihguyqch.supabase.co',
  supabaseKey: 'sb_publishable_oAHdg110Q_1kDh1587x_HQ_yjRfVv2U',

  // Les comptes sont créés avec le numéro de téléphone + mot de passe.
  // Supabase exige un e-mail : on en fabrique un à partir du numéro.
  // Aucun e-mail n'est envoyé (« Confirm email » doit être désactivé dans Supabase).
  phoneEmailDomain: 'telephone.bouchnocam.example',

  mapCenter: [3.8667, 11.5167], // Yaoundé
  mapZoom: 13,
  tiles: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  },

  refreshMs: 30000,      // rafraîchissement des signalements
  voteRadiusM: 3000,     // distance maximale pour confirmer / contester
  confirmationsNeeded: 2,
};
