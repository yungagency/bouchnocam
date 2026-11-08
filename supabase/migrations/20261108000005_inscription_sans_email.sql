-- Inscription par téléphone sans e-mail de confirmation.
-- La fonction Edge « phone-signup » crée le compte déjà activé (aucun e-mail envoyé).
-- Ce compteur limite les créations de comptes par adresse IP (anti-abus).

create table if not exists private.signup_attempts (
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists signup_attempts_ip_idx on private.signup_attempts (ip, created_at desc);

create or replace function public.register_signup_attempt(p_ip text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from private.signup_attempts where created_at < now() - interval '1 day';
  select count(*) into v_n from private.signup_attempts
   where ip = coalesce(p_ip, 'inconnue') and created_at > now() - interval '1 hour';
  if v_n >= 10 then return false; end if;
  insert into private.signup_attempts (ip) values (coalesce(p_ip, 'inconnue'));
  return true;
end
$$;

revoke all on function public.register_signup_attempt(text) from public, anon, authenticated;
grant execute on function public.register_signup_attempt(text) to service_role;
