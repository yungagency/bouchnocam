// Inscription Bouchnocam par numéro de téléphone + mot de passe.
// Crée le compte directement « confirmé » : aucun e-mail n'est envoyé, quel que soit
// le réglage « Confirm email » de Supabase. L'application se connecte ensuite normalement.
const URL_SB = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DOMAIN = 'telephone.bouchnocam.example';
const ROLES = ['usager', 'taximan', 'moto'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (status: number, code: string) => reply(status, { error_code: code });

const admin = (path: string, init: RequestInit) => fetch(URL_SB + path, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail(400, 'bad_request'); }

  const phone = String(b.phone ?? '');
  const password = String(b.password ?? '');
  const name = String(b.display_name ?? '').trim().slice(0, 40);
  const role = ROLES.includes(String(b.role)) ? String(b.role) : 'usager';
  if (!/^[62]\d{8}$/.test(phone)) return fail(400, 'invalid_phone');
  if (password.length < 6 || password.length > 72) return fail(400, 'weak_password');
  if (name.length < 2) return fail(400, 'invalid_name');

  // Limite anti-abus : 10 comptes par heure et par adresse IP
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const rl = await admin('/rest/v1/rpc/register_signup_attempt', { method: 'POST', body: JSON.stringify({ p_ip: ip }) });
  if (rl.ok && (await rl.json()) === false) return fail(429, 'over_request_rate_limit');

  const res = await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: `237${phone}@${DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: { display_name: name, role },
    }),
  });
  if (res.ok) return reply(200, { ok: true });

  const err = await res.json().catch(() => ({})) as Record<string, string>;
  const code = err.error_code || err.code || err.msg || '';
  if (res.status === 422 || /exist|registered/i.test(String(code) + (err.msg || ''))) return fail(409, 'user_already_exists');
  if (/password/i.test(String(code))) return fail(400, 'weak_password');
  console.error('phone-signup', res.status, JSON.stringify(err));
  return fail(500, 'signup_failed');
});
