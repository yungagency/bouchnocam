# Bouchnocam v2 — cahier des charges de la refonte

Décisions du 8 novembre 2026 (journal des décisions D12 à D14) :

- l'interface passe en **React + TypeScript**, emballée avec **Capacitor** pour le Play Store et l'App Store ;
- le **bouton Urgence** entre dans le MVP ;
- la liste des hôpitaux est **vérifiée par l'équipe et complétée par OpenStreetMap** ;
- le design revient aux principes de la maquette FlutterFlow du fondateur : de gros boutons, utilisables en quelques secondes sous le stress.

La base Supabase de la v1 (`supabase/migrations/20261108000001_init.sql`) est **conservée telle quelle**. La v1 en HTML/JS simple reste en ligne jusqu'à ce que la v2 la remplace.

## 1. Pile technique

| Brique | Choix | Remarque |
| --- | --- | --- |
| Langage | TypeScript (mode strict) | |
| Interface | React 18 + Vite | |
| Mobile | Capacitor (Android puis iOS) | Plugins : Geolocation, Haptics (vibration), App, Browser |
| Web installable | vite-plugin-pwa | Remplace le `sw.js` écrit à la main |
| Carte | Leaflet via react-leaflet, fonds CARTO au pilote | Léger pour les petits téléphones ; MapLibre envisageable plus tard |
| Données | @supabase/supabase-js | Le temps réel (Realtime) remplace le rafraîchissement toutes les 30 s |
| Itinéraires | openrouteservice (clé gratuite), appelé par une Edge Function Supabase | La clé reste côté serveur |
| Déploiement web | GitHub Actions qui compile puis publie sur GitHub Pages | |

Organisation du code : `src/features/{map,report,emergency,profile,auth}`, `src/lib/supabase.ts`, `src/ui/` pour les composants partagés (gros boutons, feuilles, toasts).

## 2. Design : principes repris de la maquette

1. **Deux gros boutons ronds, en bas à droite, à portée de pouce** :
   - **Signaler** en rouge, environ 88 px, au-dessus de la barre d'onglets ;
   - **Urgence** en jaune, environ 72 px, juste au-dessus de Signaler ;
   - une icône et un libellé sous chacun, une ombre marquée, un retour tactile (vibration) à l'appui.
2. **Barre du haut** : la recherche d'un lieu ou d'un quartier, et l'avatar avec une pastille de points.
3. **Légende** en bas à gauche, repliable : Bloqué, Moyen, Léger, Accident, Route barrée, Travaux, Inondation.
4. **Lisible au soleil et sous le stress** : texte de 17 px minimum sur les actions, cibles de 64 px minimum, contrastes forts, pas plus de 2 touches pour une action critique.
5. Couleurs de la marque : vert `#14773A`, jaune `#F2C200`, rouge `#D62828`.

## 3. Signaler en 1 ou 2 touches

- **Écran plein**, pas une petite feuille.
- **Ligne du haut, embouteillage** : trois grandes cartes hautes, **Léger, Moyen, Bloqué**, avec l'illustration des voitures comme sur la maquette. Une touche envoie.
- **En dessous** : quatre grandes tuiles, **Accident, Route barrée, Travaux, Inondation**. Une touche envoie.
- **Pas de bouton « Envoyer »**. Après l'envoi :
  - vibration ;
  - bandeau plein écran « Signalement envoyé ✓ » ;
  - bouton **Annuler** pendant 5 secondes.
- L'annulation demande une nouvelle fonction `cancel_report(id)` dans la base : seulement son propre signalement, moins de 30 secondes après l'envoi, sans vote reçu.
- **Sans GPS** : un message clair et un bouton pour activer la localisation.
- **Sans compte** : l'inscription en une seule étape, puis le signalement part automatiquement.

## 4. Urgence

**But :** en cas d'accident, mener le plus vite possible à l'hôpital adapté le plus proche, en évitant les incidents connus.

**Parcours (1 touche) :**

1. L'écran Urgence s'ouvre avec, en grand, **l'hôpital recommandé** :
   - nom, distance et temps estimé ;
   - mention « urgences 24h/24 » si l'hôpital est vérifié ;
   - nombre d'incidents évités.
2. L'itinéraire s'affiche sur la carte, en contournant les signalements actifs : Bloqué, Moyen, accident, route barrée, inondation.
3. Trois gros boutons :
   - **Y aller** : ouvre la navigation Google Maps vers l'hôpital (Google connaît le trafic général) ;
   - **Appeler l'hôpital**, si un numéro est connu ;
   - **Appeler les secours**.
4. En dessous, deux ou trois autres hôpitaux, avec leur distance et leur temps.

**Numéros d'urgence** : police 117, pompiers 118, assistance médicale 119 ([source : voyage.gc.ca](https://voyage.gc.ca/fr/assistance/ambassades-consulats/cameroun)). À confirmer sur le terrain avant le pilote.

**Données :**

- Nouvelle table `public.hospitals` : `name`, `lat`, `lng`, `phone`, `emergency_24h`, `verified` (booléen), `source` (`equipe` ou `osm`), `osm_id`, `updated_at`. Lecture publique, écriture réservée aux administrateurs.
- **Import OpenStreetMap** : les éléments `amenity=hospital` et `healthcare=hospital` de la région de Yaoundé, via l'API Overpass, par une Edge Function lancée à la main ou une fois par semaine.
- **Liste vérifiée** : l'équipe vérifie les principaux hôpitaux (position exacte, téléphone, urgences 24h/24). Les hôpitaux vérifiés passent en tête.

**Itinéraire :** Edge Function `emergency-route`.

- **Entrée** : la position de l'usager.
- **Calcul** :
  1. elle choisit les 3 hôpitaux les plus proches à vol d'oiseau ;
  2. elle construit des polygones de 150 m autour des incidents actifs ;
  3. elle appelle openrouteservice (`driving-car`, option `avoid_polygons`) pour chacun ;
  4. elle renvoie les itinéraires triés par durée.
- **Sans réseau ou sans réponse du service** : on affiche l'hôpital le plus proche avec les boutons Google Maps et Appeler.

**Limite à dire clairement aux usagers :** Bouchnocam ne connaît que les incidents signalés par ses usagers, pas tout le trafic.

## 5. Ce qui ne change pas

- La base Supabase, les règles de fiabilité et les points (voir le README).
- Les comptes par téléphone et mot de passe.
- Les écrans « Autour de moi » et Profil, avec leur classement et leur historique, redessinés dans le nouveau style.
- La page Règles et confidentialité, à compléter pour la fonction Urgence.

## 6. Ordre de réalisation

1. Projet Vite + React + TypeScript + Capacitor ; déploiement automatique sur GitHub Pages.
2. Carte, gros boutons et légende.
3. Signaler en 1 ou 2 touches, avec annulation (`cancel_report`).
4. Table `hospitals`, import OpenStreetMap, Edge Function `emergency-route`, écran Urgence.
5. Autour de moi, Profil, connexion.
6. Tests sur un vrai téléphone Android d'entrée de gamme en 3G ; génération de l'APK Android avec Capacitor.

## Prérequis pour la prochaine session

- Autoriser les installations de paquets (npm) dans claude.ai : Paramètres → Capacités.
- Une clé gratuite openrouteservice : créer un compte sur openrouteservice.org, puis enregistrer la clé dans les secrets des Edge Functions Supabase sous le nom `ORS_API_KEY`.
