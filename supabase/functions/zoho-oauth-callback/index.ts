const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const page = (title: string, body: string, status = 200) => new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><style>body{font-family:Arial;background:#0d1020;color:#fff;padding:32px;line-height:1.5}.box{max-width:760px;margin:auto;background:#171b31;padding:28px;border-radius:18px}code{display:block;background:#090b14;padding:14px;border-radius:10px;overflow-wrap:anywhere;margin:8px 0 18px;color:#c8f7d4}.ok{color:#72e39b}.warn{color:#ffd479}</style><div class="box"><h1>${esc(title)}</h1>${body}</div></html>`, { status, headers: {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'} })

Deno.serve(async (req: Request) => {
  const u = new URL(req.url)
  const error = u.searchParams.get('error')
  if (error) return page('Autorização não concluída', `<p>${esc(error)}</p>`, 400)
  const code = u.searchParams.get('code') || ''
  const state = u.searchParams.get('state') || ''
  const expectedState = Deno.env.get('ZOHO_OAUTH_STATE') || ''
  if (!code || !expectedState || state !== expectedState) return page('Link inválido', '<p>O código ou a validação de segurança não conferem.</p>', 400)

  const clientId = Deno.env.get('ZOHO_CLIENT_ID')
  const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET')
  const redirectUri = Deno.env.get('ZOHO_REDIRECT_URI')
  const callbackAccountsServer = u.searchParams.get('accounts-server')
  const accountsBase = callbackAccountsServer || Deno.env.get('ZOHO_ACCOUNTS_BASE_URL') || 'https://accounts.zoho.com'
  const mailBase = Deno.env.get('ZOHO_MAIL_BASE_URL') || 'https://mail.zoho.com'
  if (!clientId || !clientSecret || !redirectUri) return page('Configuração incompleta', '<p>Os Secrets OAuth ainda não foram cadastrados.</p>', 500)

  const tokenUrl = new URL(`${accountsBase}/oauth/v2/token`)
  tokenUrl.searchParams.set('code', code)
  tokenUrl.searchParams.set('grant_type', 'authorization_code')
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('redirect_uri', redirectUri)
  const tokenRes = await fetch(tokenUrl, { method: 'POST', headers: {'Accept':'application/json'} })
  const tokenData = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok || !tokenData.access_token) return page('Falha ao gerar tokens', `<p>${esc(JSON.stringify(tokenData))}</p>`, 400)

  const accountRes = await fetch(`${mailBase}/api/accounts`, { headers: {'Accept':'application/json','Authorization':`Zoho-oauthtoken ${tokenData.access_token}`} })
  const accountData = await accountRes.json().catch(() => ({}))
  const accounts = Array.isArray(accountData?.data) ? accountData.data : []
  const preferred = accounts.find((a:any) => String(a.primaryEmailAddress || a.mailboxAddress || '').toLowerCase() === 'contato@barbeariadoju.com.br') || accounts[0]

  return page('Zoho autorizado com sucesso', `
    <p class="ok"><strong>Conexão concluída.</strong> Copie os valores abaixo para os Secrets do Supabase. Esta tela não será necessária novamente.</p>
    <p><strong>ZOHO_REFRESH_TOKEN</strong></p><code>${esc(tokenData.refresh_token || 'NÃO RETORNADO — refaça com prompt=consent')}</code>
    <p><strong>ZOHO_ACCOUNT_ID</strong></p><code>${esc(preferred?.accountId || 'NÃO ENCONTRADO')}</code>
    <p><strong>ZOHO_FROM_ADDRESS</strong></p><code>${esc(preferred?.primaryEmailAddress || preferred?.mailboxAddress || 'contato@barbeariadoju.com.br')}</code>
    <p><strong>ZOHO_ACCOUNTS_BASE_URL</strong></p><code>${esc(accountsBase)}</code>
    <p><strong>ZOHO_MAIL_BASE_URL</strong></p><code>${esc(mailBase)}</code>
    <p class="warn">Não publique nem envie o Refresh Token para outras pessoas.</p>
  `)
})
