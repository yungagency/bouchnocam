-- =====================================================================
-- Bouchnocam : nom du lieu sur chaque signalement (historique du profil)
-- et compteurs nécessaires aux badges.
-- =====================================================================

alter table public.reports add column if not exists place_label text check (char_length(place_label) <= 80);
grant select (place_label) on public.reports to anon, authenticated;

-- Nouvelle signature : on supprime l'ancienne pour éviter toute ambiguïté côté API
drop function if exists public.create_report(text, integer, double precision, double precision, real);

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
revoke all on function public.create_report(text, integer, double precision, double precision, real, text) from public, anon;
grant execute on function public.create_report(text, integer, double precision, double precision, real, text) to authenticated;

-- Profil : compteurs pour les badges
create or replace function public.me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'role', p.role, 'points', p.points,
    'is_admin', p.is_admin,
    'rank', (select count(*) + 1 from public.profiles o where o.points > p.points),
    'reports_count', (select count(*) from public.reports r where r.user_id = p.id),
    'confirmed_count', (select count(*) from public.reports r where r.user_id = p.id and r.confirmations >= 2),
    'useful_votes', (select count(*) from public.points_ledger l
                      where l.user_id = p.id and l.reason in ('confirmation_utile', 'contestation_utile')),
    'morning_reports', (select count(*) from public.reports r
                         where r.user_id = p.id and extract(hour from r.created_at at time zone 'Africa/Douala') < 8)
  )
  from public.profiles p where p.id = auth.uid()
$$;

-- Historique : nom du lieu
drop function if exists public.my_reports(integer);
create or replace function public.my_reports(p_limit integer default 30)
returns table (id uuid, type text, severity smallint, status text, confirmations integer,
               contestations integer, created_at timestamptz, expires_at timestamptz,
               lat double precision, lng double precision, points integer, place_label text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.type, r.severity,
         case when r.status <> 'retire' and r.expires_at <= now() then 'expire' else r.status end,
         r.confirmations, r.contestations, r.created_at, r.expires_at, r.lat, r.lng,
         coalesce((select sum(l.amount)::integer from public.points_ledger l
                    where l.report_id = r.id and l.user_id = r.user_id), 0),
         r.place_label
    from public.reports r
   where r.user_id = auth.uid()
   order by r.created_at desc
   limit least(greatest(p_limit, 1), 100)
$$;
revoke all on function public.my_reports(integer) from public, anon;
grant execute on function public.my_reports(integer) to authenticated;
