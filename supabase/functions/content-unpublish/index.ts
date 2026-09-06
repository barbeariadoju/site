import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// content-unpublish — apaga nas plataformas publicações que já saíram pela Central de
// Conteúdo. Criada em 06/09/2026 a pedido do Juliano ("exclua as 3: face, insta e whats").
// A central nunca teve "excluir publicação": o fluxo só previa rascunho → aprovado →
// publicado. Esta function fecha esse buraco pelo caminho mais curto e seguro:
//   - Facebook e Instagram: DELETE /{post-id} na Graph API v23. Conferido em 06/09/2026:
//     os dois responderam {success:true} — inclusive o Instagram, que eu achava que a API
//     não deixava apagar (achava errado; registrado aqui pra ninguém repetir a dúvida).
//   - WhatsApp Status: Evolution /chat/deleteMessageForEveryone com remoteJid
//     status@broadcast. Responde 201 com protocolMessage type REVOKE (apaga para quem
//     ainda não abriu; quem já viu, já viu).
// Estado: usada uma vez em 06/09/2026 e deixada no ar SEM nonce (a tabela foi apagada),
// então recusa qualquer chamada. Pra virar recurso do painel, trocar o nonce por
// verify_jwt=true + is_admin(), como as outras functions da central.
// Autenticação: token de uso único gravado em public.content_unpublish_nonce (tabela com RLS
// e sem policy, só o service role lê), enviado no header x-unpublish-token. O token é
// consumido (apagado) no primeiro uso. Sem nonce na tabela a function recusa tudo.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const GRAPH_VERSION = 'v23.0'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const got = req.headers.get('x-unpublish-token')?.trim()
  if (!got || got.length < 32) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(requiredSecret('SUPABASE_URL'), requiredSecret('SUPABASE_SERVICE_ROLE_KEY'))
  const { data: nonce } = await admin.from('content_unpublish_nonce').select('token').eq('token', got).maybeSingle()
  if (!nonce) return json({ error: 'unauthorized' }, 401)
  await admin.from('content_unpublish_nonce').delete().eq('token', got)

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : []
  if (!ids.length) return json({ error: 'ids obrigatório' }, 400)
  const { data: rows, error } = await admin
    .from('content_posts')
    .select('id, platform, status, meta_post_id, evolution_message_id, context')
    .in('id', ids)
  if (error) return json({ error: error.message }, 500)

  const results: Record<string, unknown>[] = []
  for (const row of rows ?? []) {
    const r: Record<string, unknown> = { id: row.id, platform: row.platform }
    try {
      if (row.status !== 'publicado') throw new Error(`status ${row.status}, nada a apagar`)
      if (row.platform === 'facebook' || row.platform === 'instagram') {
        if (!row.meta_post_id) throw new Error('sem meta_post_id')
        const token = requiredSecret('META_PAGE_ACCESS_TOKEN')
        const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${row.meta_post_id}?access_token=${encodeURIComponent(token)}`, { method: 'DELETE' })
        const data = await res.json().catch(() => ({}))
        r.http = res.status
        r.response = data
        if (!res.ok || data?.success === false) throw new Error(data?.error?.message || `HTTP ${res.status}`)
      } else if (row.platform === 'whatsapp_business') {
        if (!row.evolution_message_id) throw new Error('sem evolution_message_id')
        const url = requiredSecret('EVOLUTION_API_URL').replace(/\/$/, '')
        const instance = requiredSecret('EVOLUTION_INSTANCE_NAME')
        const res = await fetch(`${url}/chat/deleteMessageForEveryone/${instance}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', apikey: requiredSecret('EVOLUTION_API_KEY') },
          body: JSON.stringify({ id: row.evolution_message_id, remoteJid: 'status@broadcast', fromMe: true }),
        })
        const text = await res.text().catch(() => '')
        r.http = res.status
        r.response = text.slice(0, 500)
        if (!res.ok) throw new Error(`Evolution HTTP ${res.status}`)
      } else {
        throw new Error(`plataforma ${row.platform} não suportada`)
      }
      const context = { ...(row.context ?? {}), excluido_em: new Date().toISOString(), excluido_motivo: 'Juliano pediu exclusão das 3 publicações de 06/09 (chat).' }
      await admin.from('content_posts').update({ status: 'rejeitado', context }).eq('id', row.id)
      r.ok = true
    } catch (e) {
      r.ok = false
      r.error = e instanceof Error ? e.message : String(e)
    }
    results.push(r)
  }
  return json({ results })
})
