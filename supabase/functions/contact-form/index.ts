const ALLOWED_ORIGINS = new Set([
  'https://www.barbeariadoju.com.br',
  'https://barbeariadoju.com.br',
]);

function corsHeaders(origin: string): Record<string, string> {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://www.barbeariadoju.com.br';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  };
}

function json(origin: string, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function cleanPhone(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 13);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function findSecretKey(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('sb_secret_') || trimmed.startsWith('eyJ')) return trimmed;
    try {
      return findSecretKey(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSecretKey(item);
      if (found) return found;
    }
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findSecretKey(item);
      if (found) return found;
    }
  }

  return null;
}

function getAdminKey(): string | null {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (legacy) return legacy;

  return findSecretKey(Deno.env.get('SUPABASE_SECRET_KEYS'));
}

async function restRequest(
  supabaseUrl: string,
  adminKey: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: adminKey,
      Authorization: `Bearer ${adminKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin') ?? '';
  const requestId = crypto.randomUUID();

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders(origin) });
    }

    if (req.method !== 'POST') {
      return json(origin, { error: 'Método não permitido.', request_id: requestId }, 405);
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json(origin, { error: 'Origem não autorizada.', request_id: requestId }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const name = cleanText(body.name, 80);
    const customerPhone = cleanPhone(body.phone);
    const message = cleanText(body.message, 1000);
    const website = cleanText(body.website, 120);
    const pageUrl = cleanText(body.page_url, 500);
    const userAgent = cleanText(body.user_agent || req.headers.get('user-agent'), 500);

    // Honeypot: robôs recebem sucesso aparente, mas nada é gravado.
    if (website) return json(origin, { ok: true, email_sent: false });

    if (name.length < 2) return json(origin, { error: 'Nome inválido.', request_id: requestId }, 400);
    if (customerPhone.length < 10) return json(origin, { error: 'WhatsApp inválido.', request_id: requestId }, 400);
    if (message.length < 10) return json(origin, { error: 'Mensagem muito curta.', request_id: requestId }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
    const adminKey = getAdminKey();

    if (!supabaseUrl || !adminKey) {
      console.error('[contact-form] configuração ausente', {
        requestId,
        hasUrl: Boolean(supabaseUrl),
        hasLegacyKey: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
        hasSecretKeys: Boolean(Deno.env.get('SUPABASE_SECRET_KEYS')),
      });
      return json(origin, {
        error: 'Configuração interna indisponível.',
        request_id: requestId,
      }, 500);
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const countResponse = await restRequest(
      supabaseUrl,
      adminKey,
      `contact_messages?phone=eq.${encodeURIComponent(customerPhone)}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      {
        method: 'HEAD',
        headers: { Prefer: 'count=exact' },
      },
    );

    if (!countResponse.ok) {
      const detail = await countResponse.text();
      console.error('[contact-form] falha na contagem', { requestId, status: countResponse.status, detail });
      return json(origin, { error: 'Não foi possível validar o envio.', request_id: requestId }, 500);
    }

    const range = countResponse.headers.get('content-range') ?? '';
    const totalText = range.split('/')[1];
    const recentCount = totalText && totalText !== '*' ? Number(totalText) : 0;

    if (Number.isFinite(recentCount) && recentCount >= 5) {
      return json(origin, {
        error: 'Muitas mensagens em pouco tempo. Fale diretamente pelo WhatsApp.',
        request_id: requestId,
      }, 429);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
    const insertResponse = await restRequest(supabaseUrl, adminKey, 'contact_messages?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        name,
        phone: customerPhone,
        message,
        page_url: pageUrl || null,
        user_agent: userAgent || null,
        email_status: resendKey ? 'pending' : 'disabled',
      }),
    });

    const insertedPayload = await insertResponse.json().catch(() => null);
    if (!insertResponse.ok) {
      console.error('[contact-form] falha ao gravar', {
        requestId,
        status: insertResponse.status,
        payload: insertedPayload,
      });
      return json(origin, {
        error: 'Não foi possível registrar a mensagem.',
        request_id: requestId,
      }, 500);
    }

    const savedId = Array.isArray(insertedPayload)
      ? insertedPayload[0]?.id
      : insertedPayload?.id;

    console.log('[contact-form] mensagem salva', { requestId, savedId, phone: customerPhone });

    // O e-mail é opcional. Sem Resend, a mensagem permanece salva no painel.
    if (!resendKey) {
      return json(origin, { ok: true, email_sent: false, id: savedId });
    }

    const to = Deno.env.get('CONTACT_TO_EMAIL') || 'contato@barbeariadoju.com.br';
    const from = Deno.env.get('CONTACT_FROM_EMAIL') || 'Barbearia do Ju <contato@barbeariadoju.com.br>';

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Nova mensagem do site — ${name}`,
        html: `<h2>Nova mensagem pelo site</h2><p><b>Nome:</b> ${escapeHtml(name)}</p><p><b>WhatsApp:</b> ${escapeHtml(customerPhone)}</p><p><b>Mensagem:</b></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>${pageUrl ? `<p><small>Página: ${escapeHtml(pageUrl)}</small></p>` : ''}`,
      }),
    });

    const emailPayload = await emailResponse.json().catch(() => ({}));
    const updateBody = emailResponse.ok
      ? { email_status: 'sent', email_error: null }
      : {
          email_status: 'failed',
          email_error: cleanText(emailPayload?.message || 'Falha no envio', 500),
        };

    if (savedId) {
      const updateResponse = await restRequest(
        supabaseUrl,
        adminKey,
        `contact_messages?id=eq.${encodeURIComponent(savedId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(updateBody),
        },
      );

      if (!updateResponse.ok) {
        console.error('[contact-form] falha ao atualizar e-mail', {
          requestId,
          savedId,
          status: updateResponse.status,
          detail: await updateResponse.text(),
        });
      }
    }

    if (!emailResponse.ok) {
      console.error('[contact-form] mensagem salva, e-mail falhou', {
        requestId,
        savedId,
        status: emailResponse.status,
        payload: emailPayload,
      });
    }

    return json(origin, {
      ok: true,
      email_sent: emailResponse.ok,
      id: savedId,
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error('[contact-form] erro não tratado', { requestId, detail, stack: error instanceof Error ? error.stack : null });
    return json(origin, {
      error: 'Erro interno ao registrar a mensagem.',
      request_id: requestId,
    }, 500);
  }
});
