const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' }

Deno.serve((req: Request) => {
  const url = new URL(req.url)
  const providedSetupKey = url.searchParams.get('setup_key') || ''
  const expectedSetupKey = Deno.env.get('ZOHO_SETUP_KEY') || ''
  if (!expectedSetupKey || providedSetupKey !== expectedSetupKey) {
    return new Response('<h1>Acesso negado</h1><p>Chave de configuração inválida.</p>', { status: 403, headers: htmlHeaders })
  }

  const clientId = Deno.env.get('ZOHO_CLIENT_ID')
  const redirectUri = Deno.env.get('ZOHO_REDIRECT_URI')
  const accountsBase = Deno.env.get('ZOHO_ACCOUNTS_BASE_URL') || 'https://accounts.zoho.com'
  const state = Deno.env.get('ZOHO_OAUTH_STATE')
  if (!clientId || !redirectUri || !state) {
    return new Response('<h1>Configuração incompleta</h1><p>Cadastre ZOHO_CLIENT_ID, ZOHO_REDIRECT_URI e ZOHO_OAUTH_STATE nos Secrets.</p>', { status: 500, headers: htmlHeaders })
  }

  const auth = new URL(`${accountsBase}/oauth/v2/auth`)
  auth.searchParams.set('client_id', clientId)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('redirect_uri', redirectUri)
  auth.searchParams.set('scope', 'ZohoMail.messages.CREATE,ZohoMail.accounts.READ')
  auth.searchParams.set('access_type', 'offline')
  auth.searchParams.set('prompt', 'consent')
  auth.searchParams.set('state', state)
  return Response.redirect(auth.toString(), 302)
})
