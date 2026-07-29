// Mock do Supabase para testar o painel admin SEM login e SEM tocar no banco real.
//
// Como funciona:
// 1. addInitScript planta uma sessão falsa no localStorage (chave sb-<ref>-auth-token)
//    ANTES de qualquer script da página rodar. O supabase-js confia nessa sessão no
//    lado do cliente, então `sb.auth.getSession()` devolve o "usuário" fictício e as
//    telas pulam direto da tela de login para o app.
// 2. page.route intercepta TODA requisição para *.supabase.co e responde localmente
//    com os dados de _fixtures.js. Nada sai para a internet: nenhum dado real é lido,
//    nenhuma notificação/push/e-mail é disparado, nenhuma senha é usada.
//
// Uso num teste:
//   import { mockAdmin } from './_supabase-mock.js';
//   const { fixtures, log } = await mockAdmin(page);
//   await page.goto('/admin-relatorios.html');   // abre já "logado", com dados fictícios

import { makeFixtures } from './_fixtures.js';

const PROJECT_REF = 'rpkqluaxhqsxnewunhfm';
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated', role: 'authenticated',
    email: 'admin-de-teste@mock.local',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  };
  // JWT sintaticamente válido (3 partes base64url) mas com assinatura falsa — o
  // supabase-js só decodifica no cliente, e a rede está toda interceptada mesmo.
  const access_token = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 8 * 3600, session_id: 'mock-session' }),
    'assinatura-falsa',
  ].join('.');
  return { access_token, token_type: 'bearer', expires_in: 8 * 3600, expires_at: now + 8 * 3600, refresh_token: 'mock-refresh-token', user };
}

// ---- mini-PostgREST: aplica os filtros que o supabase-js manda na query string ----

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'apikey', 'on_conflict', 'columns', 'and', 'or']);

function cmp(a, b) {
  const na = Number(a), nb = Number(b);
  if (a !== null && b !== null && a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function matches(row, key, raw) {
  const i = raw.indexOf('.');
  const op = i === -1 ? 'eq' : raw.slice(0, i);
  const val = i === -1 ? raw : raw.slice(i + 1);
  const v = row[key];
  switch (op) {
    case 'eq': return String(v) === val;
    case 'neq': return String(v) !== val;
    case 'gt': return v != null && cmp(v, val) > 0;
    case 'gte': return v != null && cmp(v, val) >= 0;
    case 'lt': return v != null && cmp(v, val) < 0;
    case 'lte': return v != null && cmp(v, val) <= 0;
    case 'in': return val.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).includes(String(v));
    case 'is': return val === 'null' ? v == null : String(v) === val;
    case 'like': case 'ilike': {
      const re = new RegExp('^' + val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$', op === 'ilike' ? 'i' : '');
      return re.test(String(v));
    }
    default: return true; // operador não implementado: não filtra (melhor sobrar linha que sumir)
  }
}

function applyFilters(rows, params) {
  let out = rows.filter((row) => {
    for (const [key, raw] of params.entries()) {
      if (RESERVED.has(key)) continue;
      if (!matches(row, key, raw)) return false;
    }
    return true;
  });
  const orders = params.getAll('order').flatMap((o) => o.split(','));
  for (const spec of orders.reverse()) {
    const [col, ...mods] = spec.split('.');
    const desc = mods.includes('desc');
    out = [...out].sort((a, b) => (desc ? -1 : 1) * cmp(a[col], b[col]));
  }
  return out;
}

function shape(rows, params) {
  let out = rows;
  const offset = Number(params.get('offset') || 0);
  const limit = params.get('limit') != null ? Number(params.get('limit')) : null;
  if (offset) out = out.slice(offset);
  if (limit != null) out = out.slice(0, limit);
  return out;
}

// ---- o mock em si ----

export async function mockAdmin(page, overrides = {}) {
  const fixtures = makeFixtures(overrides);
  const session = fakeSession();
  const log = [];

  await page.addInitScript(({ key, sess }) => {
    try { window.localStorage.setItem(key, JSON.stringify(sess)); } catch { /* storage indisponível: a tela de login aparece e o teste falha visivelmente */ }
  }, { key: STORAGE_KEY, sess: session });

  await page.route((u) => u.hostname.endsWith('.supabase.co'), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    log.push(`${method} ${url.pathname}${url.search}`);
    const json = (body, status = 200, headers = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

    if (url.pathname.startsWith('/auth/v1/token')) return json(session);
    if (url.pathname.startsWith('/auth/v1/user')) return json(session.user);
    if (url.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });

    if (url.pathname.startsWith('/functions/v1/')) {
      const name = url.pathname.split('/')[3];
      return json(fixtures.functions[name] ?? { ok: true, mock: true });
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/')[4];
      const def = fixtures.rpcs[name];
      let body = null;
      try { body = JSON.parse(req.postData() || 'null'); } catch { /* sem corpo */ }
      return json(typeof def === 'function' ? def(body) : def ?? null);
    }

    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/')[3];
      const rows = fixtures.tables[table];
      if (!rows) return json([], 200, { 'content-range': '*/0' });

      if (method === 'GET' || method === 'HEAD') {
        const out = shape(applyFilters(rows, url.searchParams), url.searchParams);
        const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
        const range = out.length ? `0-${out.length - 1}/${out.length}` : '*/0';
        return json(single ? out[0] ?? null : out, 200, { 'content-range': range });
      }

      const wantsRows = (req.headers()['prefer'] || '').includes('return=representation');
      let body = null;
      try { body = JSON.parse(req.postData() || 'null'); } catch { /* sem corpo */ }

      if (method === 'POST') { // insert/upsert
        const arr = Array.isArray(body) ? body : [body ?? {}];
        arr.forEach((r) => { if (r.id == null) r.id = 'mock-novo-' + Math.random().toString(36).slice(2, 10); });
        rows.push(...arr);
        return wantsRows ? json(arr, 201) : route.fulfill({ status: 201, body: '' });
      }
      if (method === 'PATCH') {
        const targets = applyFilters(rows, url.searchParams);
        targets.forEach((r) => Object.assign(r, body || {}));
        return wantsRows ? json(targets) : route.fulfill({ status: 204, body: '' });
      }
      if (method === 'DELETE') {
        const targets = new Set(applyFilters(rows, url.searchParams));
        fixtures.tables[table] = rows.filter((r) => !targets.has(r));
        return wantsRows ? json([...targets]) : route.fulfill({ status: 204, body: '' });
      }
    }

    // Qualquer outra coisa (realtime, storage…): responde vazio. Nunca deixa passar pra internet.
    return json({});
  });

  return { fixtures, session, log };
}
