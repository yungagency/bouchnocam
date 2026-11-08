-- =====================================================================
-- Bouchnocam v2 : hôpitaux (bouton Urgence) et annulation d'un signalement
-- =====================================================================

create table public.hospitals (
  id            bigint generated always as identity primary key,
  name          text not null check (char_length(name) between 2 and 160),
  lat           double precision not null,
  lng           double precision not null,
  phone         text,
  emergency_24h boolean not null default false,
  verified      boolean not null default false,
  source        text not null default 'equipe' check (source in ('equipe', 'osm')),
  osm_id        text unique,
  active        boolean not null default true,
  updated_at    timestamptz not null default now()
);
create index hospitals_active_idx on public.hospitals (active);

alter table public.hospitals enable row level security;
revoke all on public.hospitals from anon, authenticated;
grant select (id, name, lat, lng, phone, emergency_24h, verified, source) on public.hospitals to anon, authenticated;
create policy "hôpitaux actifs visibles par tous" on public.hospitals
  for select to anon, authenticated using (active);

-- Annuler son propre signalement dans la minute qui suit, tant que personne n'a voté
create or replace function public.cancel_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  delete from public.reports
   where id = p_report_id
     and user_id = auth.uid()
     and created_at > now() - interval '60 seconds'
     and confirmations = 0 and contestations = 0;
  if not found then raise exception 'cannot_cancel'; end if;
end
$$;
revoke all on function public.cancel_report(uuid) from public, anon;
grant execute on function public.cancel_report(uuid) to authenticated;

-- Import / mise à jour des hôpitaux depuis OpenStreetMap (à lancer depuis le SQL Editor)
create extension if not exists http with schema extensions;

create or replace function private.import_osm_hospitals(
  p_south double precision default 3.70, p_west double precision default 11.38,
  p_north double precision default 4.00, p_east double precision default 11.65)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_query text;
  v_json jsonb;
  v_count integer;
begin
  v_query := format(
    '[out:json][timeout:60];(nwr["amenity"="hospital"](%1$s,%2$s,%3$s,%4$s);nwr["healthcare"="hospital"](%1$s,%2$s,%3$s,%4$s););out center tags;',
    p_south, p_west, p_north, p_east);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '90000');
  select content::jsonb into v_json
    from extensions.http_get('https://overpass-api.de/api/interpreter?data=' || extensions.urlencode(v_query));

  with els as (
    select e,
           coalesce((e ->> 'lat')::double precision, (e -> 'center' ->> 'lat')::double precision) as lat,
           coalesce((e ->> 'lon')::double precision, (e -> 'center' ->> 'lon')::double precision) as lng
      from jsonb_array_elements(v_json -> 'elements') e
     where coalesce(e -> 'tags' ->> 'name', '') <> ''
  )
  insert into public.hospitals (name, lat, lng, phone, emergency_24h, source, osm_id)
  select left(e -> 'tags' ->> 'name', 160), lat, lng,
         coalesce(e -> 'tags' ->> 'phone', e -> 'tags' ->> 'contact:phone'),
         coalesce(e -> 'tags' ->> 'emergency', '') = 'yes',
         'osm', (e ->> 'type') || '/' || (e ->> 'id')
    from els where lat is not null and lng is not null
  on conflict (osm_id) do update
     set name = excluded.name, lat = excluded.lat, lng = excluded.lng,
         phone = coalesce(public.hospitals.phone, excluded.phone),
         emergency_24h = public.hospitals.emergency_24h or excluded.emergency_24h,
         updated_at = now()
   where public.hospitals.verified = false;   -- une fiche vérifiée par l'équipe n'est jamais écrasée

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Clé openrouteservice : stockée dans Supabase Vault sous le nom 'ors_api_key'
-- (select vault.create_secret('<clé>', 'ors_api_key');), jamais dans le code.
create or replace function public.get_ors_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'ors_api_key' limit 1
$$;
revoke all on function public.get_ors_key() from public, anon, authenticated;
grant execute on function public.get_ors_key() to service_role;
