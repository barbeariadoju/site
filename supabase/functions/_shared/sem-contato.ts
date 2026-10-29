// v29.317.0 — "nunca contatar" (pedido do Juliano, 29/10/2026, dois clientes: "não mandar nenhuma mensagem
// pra eles de nada"). O cadastro marca customer_profiles.no_contact_at.
//
// São mais de 20 functions, cada uma com o próprio fetch para a Evolution. Em vez de uma trava em cada envio,
// esta importação embrulha o fetch global: toda chamada /message/send* para um número marcado não sai. A
// function recebe 200 com key.id 'NAO-ENVIADO-sem-contato' — segue o fluxo sem tentar de novo (cron não fica
// repetindo), e o histórico em whatsapp_messages mostra no evolution_message_id que a mensagem não saiu.
//
// Importar na PRIMEIRA linha da function: `import '../_shared/sem-contato.ts'`.
// Fora de propósito: whatsapp-send (envio manual do próprio Juliano pelo painel) e Status do WhatsApp.
// Se a lista não carregar (rede), o envio segue — falha aberta, para nunca parar o WhatsApp de todo mundo.

const fetchOriginal = globalThis.fetch.bind(globalThis)
let cache: { em: number; chaves: Set<string> } | null = null

async function semContato(): Promise<Set<string>> {
  if (cache && Date.now() - cache.em < 60_000) return cache.chaves
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const chaves = new Set<string>()
  if (url && key) {
    try {
      const r = await fetchOriginal(`${url}/rest/v1/customer_profiles?select=phone&no_contact_at=not.is.null`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      if (r.ok) {
        for (const c of await r.json()) {
          const d = String(c?.phone || '').replace(/\D/g, '')
          if (d.length >= 8) chaves.add(d.slice(-8))
        }
      }
    } catch (_) { /* falha aberta */ }
  }
  cache = { em: Date.now(), chaves }
  return chaves
}

// Exportado para teste.
export async function envioBarrado(url: string, body: unknown): Promise<boolean> {
  if (!/\/message\/send/.test(url) || typeof body !== 'string') return false
  let numero = ''
  try { numero = String(JSON.parse(body)?.number || '') } catch (_) { return false }
  const k = numero.replace(/\D/g, '').slice(-8)
  return k.length === 8 && (await semContato()).has(k)
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (await envioBarrado(url, init?.body)) {
    console.log('[sem-contato] envio barrado para o final', String(JSON.parse(String(init?.body)).number).slice(-4))
    return new Response(JSON.stringify({ key: { id: 'NAO-ENVIADO-sem-contato' }, bloqueado: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
  return fetchOriginal(input, init)
}) as typeof fetch
