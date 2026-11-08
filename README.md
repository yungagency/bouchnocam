# Bouchnocam

Carte collaborative des incidents de circulation à Yaoundé.

- **Signaler** en une touche : embouteillage léger, moyen ou bloqué, accident, route barrée, travaux, inondation. On peut annuler pendant 5 secondes.
- **Confirmer** (« Toujours là ») ou **contester** (« Plus là ») les signalements des autres. Les points ne sont gagnés qu'après confirmation.
- **Urgence** : l'hôpital le plus rapide, avec un itinéraire qui contourne les incidents signalés, la navigation Google Maps et les numéros de secours.

Une seule base de code sert l'application web installable (pilote), et plus tard les applications Android et iOS, grâce à Capacitor.

## Organisation du dépôt

| Dossier | Contenu |
| --- | --- |
| `app/` | **Application v2** : React + TypeScript + Vite, emballée par Capacitor pour Android et iOS |
| `supabase/migrations/` | Schéma de la base (tables, règles de sécurité, fonctions) |
| `supabase/functions/emergency-route/` | Fonction Urgence : itinéraire vers l'hôpital (openrouteservice) |
| `docs/REFONTE_V2.md` | Cahier des charges de la v2 |
| `legacy/` | Ancienne v1 en HTML et JavaScript simples (archive) |
| `.github/workflows/app.yml` | Compilation, tests et publication automatiques |

## Mise en ligne : deux réglages à faire une fois

### 1. Supabase : désactiver la confirmation par e-mail (obligatoire)

Les comptes utilisent le numéro de téléphone et un mot de passe. Supabase exige un e-mail : l'application en fabrique un à partir du numéro (`237XXXXXXXXX@telephone.bouchnocam.example`). Aucun e-mail ne doit donc être envoyé.

Supabase → projet **bouchnocam** → **Authentication** → **Sign In / Providers** → **Email** → désactiver **Confirm email** → **Save**.

### 2. GitHub Pages : publier depuis la branche `gh-pages`

À chaque envoi sur `main`, GitHub Actions compile l'application et la dépose sur la branche `gh-pages`.

GitHub → **Settings** → **Pages** → *Source* : **Deploy from a branch** → branche **gh-pages**, dossier **/ (root)** → **Save**.

L'application est alors en ligne sur **https://yungagency.github.io/bouchnocam/**.

### 3. Trafic en temps réel : la clé Google Maps (recommandé)

Sans clé, la carte est OpenStreetMap et n'affiche que les signalements. Avec une clé Google Maps, la carte affiche **le trafic en temps réel**, avec les routes colorées en vert, orange, rouge et bordeaux, et les signalements Bouchnocam par-dessus. Un bouton « Trafic » permet d'afficher ou de masquer cette couche.

1. Sur **console.cloud.google.com**, créez un projet « Bouchnocam » et activez la **facturation** (une carte bancaire est demandée).
2. **APIs et services** → **Bibliothèque** : activez **Maps JavaScript API**.
3. **Identifiants** → **Créer des identifiants** → **Clé API**, puis restreignez-la :
   - restriction d'application : **Sites web** → `https://yungagency.github.io/*` ;
   - restriction d'API : **Maps JavaScript API** uniquement.
4. **Facturation** → **Budgets et alertes** : créez une alerte, par exemple à 20 $ par mois.
5. GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :
   - nom : `GOOGLE_MAPS_KEY` ;
   - valeur : la clé.

   Relancez ensuite la compilation : **Actions** → **Application v2** → **Run workflow**.

**Coût** : la carte web relève de la catégorie « Essentials » de Google, avec 10 000 chargements gratuits par mois depuis mars 2025. Au-delà, le prix au millier est affiché dans le simulateur de Google. Dans l'application Android ou iOS, la carte native Google (plugin `@capacitor/google-maps`, qui gère aussi le trafic) reste gratuite sans limite d'après Google.

**Si la clé est refusée** (facturation coupée, mauvaise restriction), l'application repasse toute seule sur la carte OpenStreetMap.

**Pourquoi Google et pas Yango/Yandex** : Yandex n'a pas d'offre d'API utilisable pour Bouchnocam. La version gratuite interdit les usages de suivi et de dispatch, et la version commerciale est facturée en roubles. Aucune source ne montre que leur trafic couvre Yaoundé. Google affiche déjà le trafic de Yaoundé, comme on le voyait dans la maquette FlutterFlow.

## Compilation automatique (GitHub Actions)

À chaque modification du dossier `app/`, le workflow :

1. installe les paquets ;
2. vérifie les types TypeScript ;
3. compile l'application ;
4. rejoue le parcours complet sur un téléphone simulé (`app/tests/e2e.cjs`) ;
5. publie l'application sur `gh-pages` ;
6. dépose les journaux et les captures d'écran sur la branche `ci-results`.

## Applications Android et iOS (Capacitor)

**Android** (sur un ordinateur avec Android Studio) :

```bash
cd app
npm install
npm run build
npx cap add android        # la première fois seulement
npx cap sync android
npx cap open android       # ouvre Android Studio : Build > Generate Signed Bundle / APK
```

La première fois, ajoutez dans `android/app/src/main/AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

**iOS** (Mac avec Xcode) : `npx cap add ios`, puis ajoutez `NSLocationWhenInUseUsageDescription` dans `ios/App/App/Info.plist`. Le texte proposé : « Bouchnocam utilise votre position pour placer vos signalements et trouver l'hôpital le plus proche. »

## Bouton Urgence : ce que l'équipe doit faire

- **Vérifier les hôpitaux avant le pilote.** 92 établissements ont été importés d'OpenStreetMap. Certains ne sont pas des services d'urgence (par exemple des centres de recherche). Dans Supabase → **SQL Editor** :

```sql
-- Voir la liste
select id, name, phone, emergency_24h, verified, source from public.hospitals where active order by name;

-- Marquer un hôpital comme vérifié (il passe en priorité)
update public.hospitals set verified = true, emergency_24h = true, phone = '222XXXXXX' where id = 12;

-- Retirer un établissement qui n'accueille pas les urgences
update public.hospitals set active = false where id = 49;

-- Ajouter un hôpital
insert into public.hospitals (name, lat, lng, phone, emergency_24h, verified, source)
values ('Nom de l''hôpital', 3.8700, 11.5100, '222XXXXXX', true, true, 'equipe');

-- Mettre à jour depuis OpenStreetMap (n'écrase jamais une fiche vérifiée)
select private.import_osm_hospitals();
```

- **Numéros de secours** : 119 (assistance médicale), 118 (pompiers), 117 (police). Ils viennent de voyage.gc.ca et sont à confirmer sur le terrain. Ils se changent dans `app/src/lib/config.ts`.
- **Clé openrouteservice** : elle est rangée dans Supabase Vault sous le nom `ors_api_key`, jamais dans le code. Pour la remplacer :

```sql
select vault.update_secret((select id from vault.secrets where name = 'ors_api_key'), 'NOUVELLE_CLE');
```

## Mode conduite et trafic Bouchnocam (bêta)

Première étape de l'architecture « sondes GPS » : les usagers volontaires partagent anonymement leur position pendant qu'ils roulent, et Bouchnocam calcule son propre trafic.

- **Côté application** : bouton « Je roule » sur la carte. Il faut un compte et un accord explicite (affiché une seule fois). Un point est pris toutes les 4 secondes. Les points imprécis (plus de 60 m) ou aberrants (plus de 160 km/h) sont écartés. L'envoi se fait par lots de 30 secondes. L'écran reste allumé, et le mode s'arrête seul après 4 heures. Hors connexion, environ 15 minutes de points sont gardées.
- **Côté Supabase** (migration `20261108000004`) :
  - `ingest_probes` reçoit les points. Ils sont rattachés à une session tirée au hasard, jamais au compte.
  - Le job pg_cron `bcm-trafic-calcul` regroupe les points des 10 dernières minutes, toutes les 5 minutes, dans des cases d'environ 160 m, en tenant compte du sens de circulation. Il exclut les motos ainsi que les 200 premiers et derniers mètres de chaque trajet, et prend la vitesse médiane des véhicules.
  - Une case n'est affichée qu'à partir de 3 véhicules différents. Les seuils sont : 35 km/h et plus, fluide ; de 20 à 35, modéré ; de 8 à 20, dense ; en dessous de 8, bouchon.
  - Le job `bcm-trafic-purge` efface les points bruts après 48 heures et les cases après 30 jours.
- **Limite connue** : tant qu'il y a peu de conducteurs en Mode conduite, la carte Bouchnocam restera vide à la plupart des endroits. Le trafic Google (si la clé est configurée) reste la référence pendant le pilote.

Nouveau type de signalement : **Route impraticable** (nids-de-poule, boue, chaussée défoncée), valable 12 heures. Le bouton Urgence évite ces routes comme les accidents, les routes barrées et les inondations.

## Logo

Les images de la marque sont dans `app/public/brand/` (`logo.png` pour le logo complet, `logo-mark.png` pour le pictogramme). Les icônes de l'application, dans `app/public/icons/`, en sont tirées. Pour changer de logo, remplacez ces fichiers en gardant les mêmes noms et les mêmes tailles.

## Pendant le pilote

**Devenir modérateur** (après avoir créé son compte dans l'application) :

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email like '237681031218@%');
```

**Suivre les indicateurs** :

```sql
select * from analytics.pilote_par_jour;            -- signalements, % confirmés, % retirés, signaleurs
select * from analytics.usagers_actifs_par_semaine; -- usagers qui signalent ou confirment
```

**Mot de passe oublié** (pas de SMS au pilote) :

```sql
update auth.users
set encrypted_password = extensions.crypt('NouveauMotDePasse', extensions.gen_salt('bf'))
where email like '2376XXXXXXXX@%';
```

**Supprimer un compte à la demande d'un usager** : Supabase → Authentication → Users.

## Règles de fiabilité

| Type | Durée de vie sans confirmation |
| --- | --- |
| Embouteillage (léger, moyen, bloqué) | 45 min |
| Accident | 2 h |
| Inondation | 3 h |
| Route barrée | 4 h |
| Travaux | 3 jours |

- Le signalement est placé à la position GPS du téléphone.
- Au maximum 6 signalements par heure et par compte.
- Un signalement identique à moins de 200 m compte comme une confirmation.
- On confirme ou on conteste à moins de 3 km ; chaque « Toujours là » prolonge le signalement, et deux « Plus là » consécutifs le retirent.
- Annulation possible dans la minute, tant que personne n'a répondu.
- Points :
  - +10 quand son signalement est confirmé par 2 usagers ;
  - +2 par confirmation ou fin d'incident utile ;
  - −5 si son signalement est contesté sans avoir été confirmé.

## Développer en local

```bash
cd app
npm install
npm run dev
```

## Avant le lancement public

- **Fonds de carte** : CARTO est gratuit pour un usage limité et non commercial. Avant le lancement public, prenez une clé MapTiler ou Stadia Maps et changez `tiles` dans `app/src/lib/config.ts`.
- **Recherche et nom du quartier** : ils passent par Nominatim (OpenStreetMap), qui convient à un faible volume. Au-delà, il faudra un service payant ou auto-hébergé.
- **Mot de passe oublié par SMS** : brancher un fournisseur SMS sur Supabase.
- **Notifications par zone.**
