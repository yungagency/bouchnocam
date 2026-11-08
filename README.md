# Bouchnocam — application web (pilote)

Carte collaborative des incidents de circulation à Yaoundé : les usagers **signalent** (embouteillage, accident, route barrée, travaux, inondation), les autres **confirment** (« Toujours là ») ou **contestent** (« Plus là »), et les points ne sont gagnés qu'après confirmation.

Application web installable (PWA) : elle s'ajoute à l'écran d'accueil Android ou iPhone, sans passer par un store.

## Technique

| Brique | Choix |
| --- | --- |
| Interface | HTML, CSS et JavaScript sans framework ni étape de compilation |
| Carte | Leaflet 1.9.4 (inclus dans `assets/vendor`), fonds de carte CARTO / OpenStreetMap |
| Données et comptes | Supabase (PostgreSQL + PostGIS), projet `bouchnocam` |
| Hors connexion | Service worker `sw.js` : l'application et les fonds de carte déjà vus restent disponibles |

Toutes les écritures passent par des fonctions de la base (`create_report`, `vote_report`) qui appliquent les règles : position au Cameroun, limite de 6 signalements par heure, fusion des doublons à moins de 200 m, confirmation à moins de 3 km, un seul vote par signalement, points attribués par la base. Le schéma complet est dans `supabase/migrations/`.

## Mise en ligne : 3 réglages à faire une fois

### 1. Supabase : désactiver la confirmation par e-mail (obligatoire)

Les comptes utilisent le numéro de téléphone et un mot de passe. Supabase exige un e-mail : l'application en fabrique un à partir du numéro (`237XXXXXXXXX@telephone.bouchnocam.example`). Aucun e-mail ne doit donc être envoyé.

Supabase → projet **bouchnocam** → **Authentication** → **Sign In / Providers** → **Email** → désactiver **Confirm email** → **Save**.

Sans ce réglage, l'inscription échoue.

### 2. GitHub Pages : publier l'application

GitHub → dépôt **bouchnocam** → **Settings** → **Pages** → *Source* : **Deploy from a branch** → branche **main**, dossier **/ (root)** → **Save**.

Après une à deux minutes, l'application est en ligne sur **https://yungagency.github.io/bouchnocam/** (HTTPS, nécessaire pour le GPS et l'installation).

### 3. Devenir modérateur

Créez votre compte dans l'application, puis dans Supabase → **SQL Editor** :

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email like '237681031218@%');
```

(remplacez par votre numéro). Un modérateur voit un bouton « Retirer (modération) » sur chaque signalement.

## Pendant le pilote

**Suivre les indicateurs** (SQL Editor) :

```sql
select * from analytics.pilote_par_jour;            -- signalements, % confirmés, % retirés, signaleurs
select * from analytics.usagers_actifs_par_semaine; -- usagers qui signalent ou confirment
```

**Mot de passe oublié** (il n'y a pas de SMS au pilote) :

```sql
update auth.users
set encrypted_password = extensions.crypt('NouveauMotDePasse', extensions.gen_salt('bf'))
where email like '2376XXXXXXXX@%';
```

**Supprimer un compte à la demande d'un usager** : Supabase → Authentication → Users → supprimer l'utilisateur (ses signalements sont supprimés avec lui).

## Règles de fiabilité (réglables dans la migration)

| Type | Durée de vie sans confirmation |
| --- | --- |
| Embouteillage (léger, moyen, bloqué) | 45 min |
| Accident | 2 h |
| Inondation | 3 h |
| Route barrée | 4 h |
| Travaux | 3 jours |

- Chaque « Toujours là » prolonge le signalement.
- Deux « Plus là » consécutifs le retirent de la carte.
- Points : +10 quand son signalement est confirmé par 2 usagers, +2 par confirmation ou fin d'incident utile, −5 si son signalement est contesté sans avoir été confirmé.

## Développer en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

À chaque nouvelle version publiée, changer `VERSION` dans `sw.js` pour forcer la mise à jour du cache chez les usagers.

## Avant le lancement public

- Fonds de carte : CARTO est gratuit pour un usage limité et non commercial. Avant le lancement public, prendre une clé MapTiler ou Stadia Maps et changer `tiles` dans `assets/js/config.js`.
- Mot de passe oublié par SMS : brancher un fournisseur SMS sur Supabase.
- Notifications par zone.
