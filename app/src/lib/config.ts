// Configuration publique. La clé "publishable" Supabase est faite pour être visible :
// la sécurité repose sur les règles RLS et les fonctions de la base.
export const CONFIG = {
  supabaseUrl: 'https://etnigfvbedlhihguyqch.supabase.co',
  supabaseKey: 'sb_publishable_oAHdg110Q_1kDh1587x_HQ_yjRfVv2U',
  // Comptes par téléphone : Supabase exige un e-mail, on le fabrique à partir du numéro.
  phoneEmailDomain: 'telephone.bouchnocam.example',

  mapCenter: [3.8667, 11.5167] as [number, number], // Yaoundé
  mapZoom: 13,
  tiles: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
  },

  refreshMs: 20000,
  voteRadiusM: 3000,
  confirmationsNeeded: 2,
  undoSeconds: 5,

  // Numéros d'urgence au Cameroun (source : voyage.gc.ca) — à confirmer sur le terrain
  emergencyNumbers: {
    medical: { label: 'Secours médicaux', number: '119' },
    fire: { label: 'Pompiers', number: '118' },
    police: { label: 'Police', number: '117' },
  },
  teamPhone: '+237 681 03 12 18',
  teamEmail: 'contacts.bouchnocam@gmail.com',
};
