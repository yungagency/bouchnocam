-- =====================================================================
-- Bouchnocam — schéma initial (pilote)
-- Règles de fiabilité :
--   * un signalement = type + position GPS + heure, durée de vie selon le type
--   * « Toujours là » prolonge, deux « Plus là » consécutifs retirent
--   * les points ne sont accordés qu'après confirmation par 2 autres usagers
--   * toutes les écritures passent par des fonctions (RPC) contrôlées
-- =====================================================================

create extension if not exists postgis with schema extensions;

create schema if not exists private;
create schema if not exists analytics;
revoke all on schema private from public, anon, authenticated;
revoke all on schema analytics from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  role         text not null default 'usager' check (role in ('usager', 'taximan', 'moto')),
  points       integer not null default 0 check (points >= 0),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in ('embouteillage', 'accident', 'route_barree', 'travaux', 'inondation')),
  severity      smallint check (severity between 1 and 3),
  lat           double precision not null,
  lng           double precision not null,
  geom          extensions.geography(Point, 4326) not null,
  accuracy_m    real,
  status        text not null default 'actif' check (status in ('actif', 'confirme', 'retire')),
  confirmations integer not null default 0,
  contestations integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  constraint severity_only_for_jams check ((type = 'embouteillage') = (severity is not null))
);
create index reports_geom_idx on public.reports using gist (geom);
create index reports_expires_idx on public.reports (expires_at);
create index reports_user_idx on public.reports (user_id, created_at desc);

create table public.votes (
  report_id  uuid not null references public.reports(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
create index votes_user_idx on public.votes (user_id, created_at desc);
create index votes_report_idx on public.votes (report_id, created_at desc);

create table public.points_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     integer not null,
  reason     text not null,
  report_id  uuid references public.reports(id) on delete set null,
  created_at timestamptz not null default now()
);
create index points_ledger_user_idx on public.points_ledger (user_id, created_at desc);
create index points_ledger_report_idx on public.points_ledger (report_id);

-- ---------------------------------------------------------------------
-- Droits : rien en écriture directe, lecture limitée aux colonnes utiles
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.reports       enable row level security;
alter table public.votes         enable row level security;
alter table public.points_ledger enable row level security;

revoke all on public.profiles, public.reports, public.votes, public.points_ledger from anon, authenticated;

grant select (id, display_name, role, points, created_at) on public.profiles to anon, authenticated;
grant update (display_name, role) on public.profiles to authenticated;
grant select (id, type, severity, lat, lng, status, confirmations, contestations, created_at, expires_at)
  on public.reports to anon, authenticated;
grant select (report_id, vote, created_at) on public.votes to authenticated;
grant select (amount, reason, report_id, created_at) on public.points_ledger to authenticated;

create policy "profils lisibles par tous" on public.profiles
  for select to anon, authenticated using (true);
create policy "chacun modifie son profil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "signalements actifs visibles par tous" on public.reports
  for select to anon, authenticated
  using (status in ('actif', 'confirme') and expires_at > now());

create policy "chacun voit ses votes" on public.votes
  for select to authenticated using (user_id = (select auth.uid()));

create policy "chacun voit ses points" on public.points_ledger
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Fonctions internes (schéma private, non exposé par l'API)
-- ---------------------------------------------------------------------
create or replace function private.report_ttl(p_type text)
returns interval language sql immutable set search_path = '' as $$
  select case p_type
    when 'embouteillage' then interval '45 minutes'
    when 'accident'      then interval '2 hours'
    when 'inondation'    then interval '3 hours'
    when 'route_barree'  then interval '4 hours'
    when 'travaux'       then interval '3 days'
  end
$$;

create or replace function private.award(p_user uuid, p_amount integer, p_reason text, p_report uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.points_ledger (user_id, amount, reason, report_id)
  values (p_user, p_amount, p_reason, p_report);
  update public.profiles set points = greatest(0, points + p_amount) where id = p_user;
$$;

create or replace function private.point(p_lat double precision, p_lng double precision)
returns extensions.geography language sql immutable set search_path = '' as $$
  select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40);
  v_role text := new.raw_user_meta_data ->> 'role';
begin
  if char_length(v_name) < 2 then v_name := 'Usager'; end if;
  if v_role is null or v_role not in ('usager', 'taximan', 'moto') then v_role := 'usager'; end if;
  insert into public.profiles (id, display_name, role) values (new.id, v_name, v_role);
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- API publique (RPC)
-- ---------------------------------------------------------------------

-- Voter sur un signalement : +1 « Toujours là », -1 « Plus là »
create or replace function public.vote_report(p_report_id uuid, p_vote integer, p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  r public.reports;
  v_was_confirmed boolean;
  v_last_two integer;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_vote not in (-1, 1) then raise exception 'invalid_vote'; end if;

  if (select count(*) from public.votes where user_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;

  select * into r from public.reports where id = p_report_id for update;
  if not found or r.status = 'retire' or r.expires_at <= now() then raise exception 'report_inactive'; end if;
  if r.user_id = v_uid then raise exception 'own_report'; end if;
  if not extensions.st_dwithin(r.geom, private.point(p_lat, p_lng), 3000) then raise exception 'too_far'; end if;

  insert into public.votes (report_id, user_id, vote) values (p_report_id, v_uid, p_vote)
  on conflict do nothing;
  if not found then raise exception 'already_voted'; end if;

  v_was_confirmed := r.status = 'confirme';

  if p_vote = 1 then
    update public.reports
       set confirmations = confirmations + 1,
           expires_at = greatest(expires_at, now() + private.report_ttl(type) * 0.75),
           updated_at = now()
     where id = p_report_id
     returning * into r;

    if r.status = 'actif' and r.confirmations >= 2 then
      update public.reports set status = 'confirme' where id = r.id returning * into r;
      perform private.award(r.user_id, 10, 'signalement_confirme', r.id);
      perform private.award(v.user_id, 2, 'confirmation_utile', r.id)
         from public.votes v where v.report_id = r.id and v.vote = 1;
    elsif r.status = 'confirme' then
      perform private.award(v_uid, 2, 'confirmation_utile', r.id);
    end if;
  else
    update public.reports
       set contestations = contestations + 1, updated_at = now()
     where id = p_report_id
     returning * into r;

    -- Retrait quand les deux derniers votes disent « Plus là »
    select coalesce(sum(vote), 0) into v_last_two from (
      select vote from public.votes where report_id = r.id order by created_at desc limit 2
    ) last_votes;

    if r.contestations >= 2 and v_last_two = -2 then
      update public.reports set status = 'retire', expires_at = now(), updated_at = now()
       where id = r.id returning * into r;
      if not v_was_confirmed then
        perform private.award(r.user_id, -5, 'signalement_conteste', r.id);
      end if;
      perform private.award(v.user_id, 2, 'contestation_utile', r.id)
         from public.votes v where v.report_id = r.id and v.vote = -1;
    end if;
  end if;

  return jsonb_build_object('id', r.id, 'status', r.status,
                            'confirmations', r.confirmations, 'contestations', r.contestations);
end
$$;

-- Créer un signalement (fusionné avec un signalement identique à moins de 200 m)
create or replace function public.create_report(p_type text, p_severity integer, p_lat double precision,
                                                p_lng double precision, p_accuracy real default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_pt extensions.geography;
  v_existing public.reports;
  v_id uuid;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_type is null or p_type not in ('embouteillage', 'accident', 'route_barree', 'travaux', 'inondation') then
    raise exception 'invalid_type';
  end if;
  if p_type = 'embouteillage' and (p_severity is null or p_severity not between 1 and 3) then
    raise exception 'invalid_severity';
  end if;
  if p_type <> 'embouteillage' then p_severity := null; end if;
  if p_lat is null or p_lng is null or p_lat not between 1.6 and 13.1 or p_lng not between 8.4 and 16.2 then
    raise exception 'out_of_zone';
  end if;
  if p_accuracy is not null and p_accuracy > 1000 then raise exception 'gps_imprecise'; end if;
  if (select count(*) from public.reports where user_id = v_uid and created_at > now() - interval '1 hour') >= 6 then
    raise exception 'rate_limited';
  end if;

  v_pt := private.point(p_lat, p_lng);

  select * into v_existing from public.reports r
   where r.type = p_type and r.status in ('actif', 'confirme') and r.expires_at > now()
     and extensions.st_dwithin(r.geom, v_pt, 200)
   order by r.created_at desc limit 1;

  if found then
    if v_existing.user_id <> v_uid then
      begin
        perform public.vote_report(v_existing.id, 1, p_lat, p_lng);
      exception when others then
        null; -- déjà voté : on ne crée pas de doublon
      end;
    end if;
    return jsonb_build_object('id', v_existing.id, 'merged', true);
  end if;

  insert into public.reports (user_id, type, severity, lat, lng, geom, accuracy_m, expires_at)
  values (v_uid, p_type, p_severity, p_lat, p_lng, v_pt, p_accuracy, now() + private.report_ttl(p_type))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'merged', false);
end
$$;

-- Mon profil, avec rang et rôle admin
create or replace function public.me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'role', p.role, 'points', p.points,
    'is_admin', p.is_admin,
    'rank', (select count(*) + 1 from public.profiles o where o.points > p.points),
    'reports_count', (select count(*) from public.reports r where r.user_id = p.id),
    'confirmed_count', (select count(*) from public.reports r where r.user_id = p.id and r.confirmations >= 2)
  )
  from public.profiles p where p.id = auth.uid()
$$;

-- Mes signalements (tous statuts), pour l'historique
create or replace function public.my_reports(p_limit integer default 30)
returns table (id uuid, type text, severity smallint, status text, confirmations integer,
               contestations integer, created_at timestamptz, expires_at timestamptz,
               lat double precision, lng double precision, points integer)
language sql stable security definer set search_path = '' as $$
  select r.id, r.type, r.severity,
         case when r.status <> 'retire' and r.expires_at <= now() then 'expire' else r.status end,
         r.confirmations, r.contestations, r.created_at, r.expires_at, r.lat, r.lng,
         coalesce((select sum(l.amount)::integer from public.points_ledger l
                    where l.report_id = r.id and l.user_id = r.user_id), 0)
    from public.reports r
   where r.user_id = auth.uid()
   order by r.created_at desc
   limit least(greatest(p_limit, 1), 100)
$$;

-- Modération (administrateurs uniquement)
create or replace function public.admin_remove_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'forbidden';
  end if;
  update public.reports set status = 'retire', expires_at = now(), updated_at = now()
   where id = p_report_id and status <> 'retire'
   returning user_id into v_author;
  if v_author is not null then
    perform private.award(v_author, -10, 'moderation', p_report_id);
  end if;
end
$$;

revoke all on function public.vote_report(uuid, integer, double precision, double precision) from public, anon;
revoke all on function public.create_report(text, integer, double precision, double precision, real) from public, anon;
revoke all on function public.me() from public, anon;
revoke all on function public.my_reports(integer) from public, anon;
revoke all on function public.admin_remove_report(uuid) from public, anon;
grant execute on function public.vote_report(uuid, integer, double precision, double precision) to authenticated;
grant execute on function public.create_report(text, integer, double precision, double precision, real) to authenticated;
grant execute on function public.me() to authenticated;
grant execute on function public.my_reports(integer) to authenticated;
grant execute on function public.admin_remove_report(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Indicateurs du pilote (schéma analytics, lisible depuis le tableau de bord Supabase)
-- ---------------------------------------------------------------------
create or replace view analytics.pilote_par_jour as
select (r.created_at at time zone 'Africa/Douala')::date             as jour,
       count(*)                                                       as signalements,
       count(*) filter (where r.confirmations >= 2)                   as confirmes,
       round(100.0 * count(*) filter (where r.confirmations >= 2) / count(*), 1) as pct_confirmes,
       count(*) filter (where r.status = 'retire')                    as retires,
       round(100.0 * count(*) filter (where r.status = 'retire') / count(*), 1)  as pct_retires,
       count(distinct r.user_id)                                      as signaleurs
  from public.reports r
 group by 1
 order by 1 desc;

create or replace view analytics.usagers_actifs_par_semaine as
select date_trunc('week', a.at at time zone 'Africa/Douala')::date as semaine,
       count(distinct a.user_id) as usagers_actifs
  from (select user_id, created_at as at from public.reports
        union all
        select user_id, created_at from public.votes) a
 group by 1
 order by 1 desc;
