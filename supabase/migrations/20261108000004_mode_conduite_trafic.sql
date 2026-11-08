-- =====================================================================
-- Bouchnocam : « Route impraticable » + Mode conduite (trafic calculé à partir du GPS)
--
-- Confidentialité :
--   * les positions brutes sont stockées SANS identifiant d'usager, avec un identifiant
--     de trajet aléatoire qui change à chaque trajet ;
--   * elles sont dans le schéma private (non exposé par l'API) et supprimées après 48 h ;
--   * les 200 premiers mètres de chaque trajet (et les 200 derniers d'un trajet terminé)
--     sont ignorés pour ne pas révéler domicile ou destination ;
--   * seules des vitesses médianes par zone d'environ 160 m, vues par au moins 3 véhicules,
--     sont publiées.
-- =====================================================================

-- 1. Nouveau type de signalement
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports add constraint reports_type_check
  check (type in ('embouteillage', 'accident', 'route_barree', 'travaux', 'inondation', 'route_impraticable'));

create or replace function private.report_ttl(p_type text)
returns interval language sql immutable set search_path = '' as $$
  select case p_type
    when 'embouteillage'      then interval '45 minutes'
    when 'accident'           then interval '2 hours'
    when 'inondation'         then interval '3 hours'
    when 'route_barree'       then interval '4 hours'
    when 'route_impraticable' then interval '12 hours'
    when 'travaux'            then interval '3 days'
  end
$$;

create or replace function public.create_report(p_type text, p_severity integer, p_lat double precision,
                                                p_lng double precision, p_accuracy real default null,
                                                p_place text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_pt extensions.geography;
  v_existing public.reports;
  v_id uuid;
  v_place text := nullif(left(trim(coalesce(p_place, '')), 80), '');
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_type is null or p_type not in ('embouteillage', 'accident', 'route_barree', 'travaux', 'inondation', 'route_impraticable') then
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
        null;
      end;
    end if;
    return jsonb_build_object('id', v_existing.id, 'merged', true);
  end if;

  insert into public.reports (user_id, type, severity, lat, lng, geom, accuracy_m, expires_at, place_label)
  values (v_uid, p_type, p_severity, p_lat, p_lng, v_pt, p_accuracy, now() + private.report_ttl(p_type), v_place)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'merged', false);
end
$$;

-- 2. Positions brutes du Mode conduite (schéma privé, sans identifiant d'usager)
create table private.probe_points (
  id         bigint generated always as identity primary key,
  session_id uuid not null,
  role       text not null default 'usager',
  ts         timestamptz not null,
  lat        double precision not null,
  lng        double precision not null,
  speed_kmh  real not null,
  heading    real,
  accuracy_m real,
  received_at timestamptz not null default now()
);
create index probe_points_ts_idx on private.probe_points (ts);
create index probe_points_session_idx on private.probe_points (session_id, ts);

-- 3. Trafic agrégé par zone (public, sans donnée personnelle)
create table public.traffic_cells (
  cell_lat       double precision not null,
  cell_lng       double precision not null,
  heading_bucket smallint not null,
  window_start   timestamptz not null,
  vehicles       integer not null,
  samples        integer not null,
  median_speed   real not null,
  primary key (cell_lat, cell_lng, heading_bucket, window_start)
);
create index traffic_cells_window_idx on public.traffic_cells (window_start);
alter table public.traffic_cells enable row level security;
revoke all on public.traffic_cells from anon, authenticated;
grant select on public.traffic_cells to anon, authenticated;
create policy "trafic agrégé lisible par tous" on public.traffic_cells for select to anon, authenticated using (true);

-- Réception des positions (par lots de 120 maximum)
create or replace function public.ingest_probes(p_session uuid, p_role text, p_points jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if p_session is null or jsonb_typeof(p_points) <> 'array' then raise exception 'invalid_payload'; end if;
  if jsonb_array_length(p_points) > 120 then raise exception 'too_many_points'; end if;
  if (select count(*) from private.probe_points where session_id = p_session and received_at > now() - interval '1 minute') > 400 then
    raise exception 'rate_limited';
  end if;

  insert into private.probe_points (session_id, role, ts, lat, lng, speed_kmh, heading, accuracy_m)
  select p_session,
         case when p_role in ('usager', 'taximan', 'moto') then p_role else 'usager' end,
         to_timestamp((e ->> 't')::double precision / 1000),
         (e ->> 'lat')::double precision, (e ->> 'lng')::double precision,
         least(greatest(coalesce((e ->> 's')::real, 0), 0), 160),
         nullif(e ->> 'h', '')::real,
         nullif(e ->> 'a', '')::real
    from jsonb_array_elements(p_points) e
   where (e ->> 'lat')::double precision between 1.6 and 13.1
     and (e ->> 'lng')::double precision between 8.4 and 16.2
     and coalesce(nullif(e ->> 'a', '')::real, 0) <= 60
     and to_timestamp((e ->> 't')::double precision / 1000) between now() - interval '15 minutes' and now() + interval '1 minute';

  get diagnostics v_count = row_count;
  return v_count;
end
$$;
revoke all on function public.ingest_probes(uuid, text, jsonb) from public, anon;
grant execute on function public.ingest_probes(uuid, text, jsonb) to authenticated;

-- Calcul toutes les 5 minutes : vitesse médiane par zone (~160 m) et par sens de circulation
create or replace function private.aggregate_traffic()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := date_trunc('hour', now()) + floor(extract(minute from now()) / 5) * interval '5 minutes';
  v_count integer;
begin
  with sess as (
    select session_id,
           (array_agg(lat order by ts))[1] as lat0, (array_agg(lng order by ts))[1] as lng0,
           (array_agg(lat order by ts desc))[1] as latn, (array_agg(lng order by ts desc))[1] as lngn,
           max(ts) as last_ts
      from private.probe_points
     where ts > now() - interval '3 hours'
     group by session_id
  ),
  pts as (
    select p.*,
           round(p.lat / 0.0015) * 0.0015 as cell_lat,
           round(p.lng / 0.0015) * 0.0015 as cell_lng,
           case when p.heading is null then -1 else (floor(((p.heading::numeric % 360) + 360) % 360 / 90))::smallint end as hb
      from private.probe_points p
      join sess s using (session_id)
     where p.ts > now() - interval '10 minutes'
       and p.role <> 'moto'                                   -- les motos se faufilent : vitesses non représentatives
       and extensions.st_distance(private.point(p.lat, p.lng), private.point(s.lat0, s.lng0)) > 200
       and (s.last_ts > now() - interval '10 minutes'          -- trajet en cours
            or extensions.st_distance(private.point(p.lat, p.lng), private.point(s.latn, s.lngn)) > 200)
  ),
  per_vehicle as (
    select cell_lat, cell_lng, hb, session_id, avg(speed_kmh) as v, count(*) as n
      from pts group by 1, 2, 3, 4
  )
  insert into public.traffic_cells (cell_lat, cell_lng, heading_bucket, window_start, vehicles, samples, median_speed)
  select cell_lat, cell_lng, hb, v_window, count(*), sum(n)::integer,
         percentile_cont(0.5) within group (order by v)
    from per_vehicle
   group by 1, 2, 3
  on conflict (cell_lat, cell_lng, heading_bucket, window_start) do update
     set vehicles = excluded.vehicles, samples = excluded.samples, median_speed = excluded.median_speed;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Lecture du trafic actuel. Seuils initiaux (km/h), à calibrer route par route :
--   >= 35 fluide · 20-35 modéré · 8-20 dense · < 8 embouteillage
create or replace function public.traffic_now(p_south double precision, p_west double precision,
                                              p_north double precision, p_east double precision,
                                              p_min_vehicles integer default 3)
returns table (lat double precision, lng double precision, heading_bucket smallint, vehicles integer,
               speed real, state text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (c.cell_lat, c.cell_lng, c.heading_bucket)
         c.cell_lat, c.cell_lng, c.heading_bucket, c.vehicles, c.median_speed,
         case when c.median_speed >= 35 then 'fluide'
              when c.median_speed >= 20 then 'modere'
              when c.median_speed >= 8 then 'dense'
              else 'bouchon' end,
         c.window_start
    from public.traffic_cells c
   where c.window_start > now() - interval '15 minutes'
     and c.vehicles >= greatest(p_min_vehicles, 2)
     and c.cell_lat between p_south and p_north
     and c.cell_lng between p_west and p_east
   order by c.cell_lat, c.cell_lng, c.heading_bucket, c.window_start desc
   limit 2000
$$;
grant execute on function public.traffic_now(double precision, double precision, double precision, double precision, integer) to anon, authenticated;

-- 4. Tâches planifiées : calcul toutes les 5 minutes, purge des positions brutes après 48 h
create extension if not exists pg_cron;
select cron.schedule('bcm-trafic-calcul', '*/5 * * * *', 'select private.aggregate_traffic()');
select cron.schedule('bcm-trafic-purge', '17 * * * *',
  $$delete from private.probe_points where ts < now() - interval '48 hours';
    delete from public.traffic_cells where window_start < now() - interval '30 days'$$);
