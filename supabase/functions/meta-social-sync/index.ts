import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const fetchWithTimeout = async (url: string, timeoutMs = 20000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: controller.signal })
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }
  } finally {
    clearTimeout(timeout)
  }
}

const fetchPostWithTimeout = async (url: string, init: RequestInit, timeoutMs = 20000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(url, { ...init, signal: controller.signal })
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }
  } finally {
    clearTimeout(timeout)
  }
}

const GRAPH_VERSION = 'v23.0'
const SINCE_MS = 3 * 24 * 60 * 60 * 1000 // só os últimos 3 dias — evita dragar conversas antigas já resolvidas por fora, na primeira vez que o cron roda

async function askAI(openaiKey: string | undefined, systemPrompt: string, userText: string): Promise<string> {
  if (!openaiKey) return ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'low' },
        max_output_tokens: 220,
        instructions: systemPrompt,
        input: [{ role: 'user', content: [{ type: 'input_text', text: userText }] }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!r.ok) return ''
    const d = await r.json().catch(() => ({}))
    if (typeof d?.output_text === 'string') return d.output_text.trim()
    return (d?.output || []).flatMap((x: any) => x.content || []).filter((x: any) => x.type === 'output_text').map((x: any) => x.text).join('\n').trim()
  } catch (error) {
    console.error('[meta-social-sync] openai', error instanceof Error ? error.message : error)
    return ''
  }
}

type Candidate = {
  platform: 'facebook' | 'instagram'
  kind: 'comment' | 'message'
  external_id: string
  thread_id: string
  sender_psid: string | null
  sender_name: string | null
  original_text: string
  context: Record<string, unknown>
}

// Envia de verdade no Graph API — mesma chamada que meta-social-reply faz quando o
// Juliano clica manualmente. Aqui é disparada sozinha pelo cron, sem clique nenhum.
async function sendReply(pageToken: string, pageId: string, igId: string, c: Candidate, text: string) {
  if (c.kind === 'comment') {
    const endpoint = c.platform === 'facebook' ? 'comments' : 'replies'
    const params = new URLSearchParams({ message: text, access_token: pageToken })
    return fetchPostWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${c.external_id}/${endpoint}`, { method: 'POST', body: params })
  }
  if (!c.sender_psid) return { ok: false, status: 400, data: { error: { message: 'Sem PSID do destinatário.' } } }
  const targetId = c.platform === 'facebook' ? pageId : igId
  return fetchPostWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${targetId}/messages?access_token=${pageToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      c.platform === 'facebook'
        ? { recipient: { id: c.sender_psid }, messaging_type: 'RESPONSE', message: { text } }
        : { recipient: { id: c.sender_psid }, message: { text } },
    ),
  })
}

// JuIA Social — v29.9.0 (2026-08-09): lê comentários novos (FB+IG) e mensagens novas
// (Messenger+Instagram Direct), gera a resposta com IA e ENVIA DE VERDADE sozinha —
// pedido explícito do Juliano ("total, igual o WhatsApp"), depois de rodar semanas em
// modo rascunho-aprovação sem nenhum envio real acontecer. Só cai pra 'rascunho'
// (esperando aprovação manual) em 2 casos: mensagem sem texto (figurinha/mídia — a IA
// não tem o que responder de verdade) ou falha real no envio (Graph API).
Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  // dry_run: usado só pra testar a lógica de roteamento sem publicar nada de verdade
  // na Meta (ex. validar antes de confiar 100% na automação nova). Nunca chamado pelo
  // cron normal.
  const dryRun = await request.json().then((b) => b?.dry_run === true).catch(() => false)

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
    const pageToken = requiredSecret('META_PAGE_ACCESS_TOKEN')
    const pageId = requiredSecret('META_PAGE_ID')
    const igId = requiredSecret('META_IG_USER_ID')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

    const sinceISO = new Date(Date.now() - SINCE_MS).toISOString()

    const { data: existingRows } = await admin.from('social_inbox').select('external_id')
    const known = new Set((existingRows || []).map((r: any) => r.external_id))

    const candidates: Candidate[] = []

    // --- Comentários do Facebook (posts recentes da Página)
    const fbPosts = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/posts?fields=id,permalink_url,comments.limit(50){id,message,from,created_time}&limit(15)&access_token=${pageToken}`)
    for (const post of fbPosts.data?.data || []) {
      for (const comment of post.comments?.data || []) {
        if (comment.from?.id === pageId) continue
        if (new Date(comment.created_time).getTime() < Date.now() - SINCE_MS) continue
        if (known.has(comment.id)) continue
        candidates.push({
          platform: 'facebook', kind: 'comment', external_id: comment.id, thread_id: post.id,
          sender_psid: null, sender_name: comment.from?.name || null, original_text: comment.message || '',
          context: { post_permalink: post.permalink_url },
        })
      }
    }

    // --- Comentários do Instagram (mídias recentes)
    const igMedia = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media?fields=id,permalink,comments.limit(50){id,text,username,timestamp}&limit(15)&access_token=${pageToken}`)
    for (const media of igMedia.data?.data || []) {
      for (const comment of media.comments?.data || []) {
        if (comment.username === 'barbeariadoju_') continue
        if (new Date(comment.timestamp).getTime() < Date.now() - SINCE_MS) continue
        if (known.has(comment.id)) continue
        candidates.push({
          platform: 'instagram', kind: 'comment', external_id: comment.id, thread_id: media.id,
          sender_psid: null, sender_name: comment.username || null, original_text: comment.text || '',
          context: { post_permalink: media.permalink },
        })
      }
    }

    // --- Mensagens do Messenger
    const fbConversations = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/conversations?fields=messages.limit(3){id,message,from,created_time}&limit(25)&access_token=${pageToken}`)
    for (const conv of fbConversations.data?.data || []) {
      const latest = conv.messages?.data?.[0]
      if (!latest || latest.from?.id === pageId) continue
      if (new Date(latest.created_time).getTime() < Date.now() - SINCE_MS) continue
      if (known.has(latest.id)) continue
      candidates.push({
        platform: 'facebook', kind: 'message', external_id: latest.id, thread_id: conv.id,
        sender_psid: latest.from?.id || null, sender_name: latest.from?.name || null, original_text: latest.message || '',
        context: {},
      })
    }

    // --- Mensagens do Instagram Direct
    const igConversations = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/conversations?platform=instagram&fields=messages.limit(3){id,message,from,created_time}&limit(25)&access_token=${pageToken}`)
    for (const conv of igConversations.data?.data || []) {
      const latest = conv.messages?.data?.[0]
      if (!latest || latest.from?.id === igId) continue
      if (new Date(latest.created_time).getTime() < Date.now() - SINCE_MS) continue
      if (known.has(latest.id)) continue
      candidates.push({
        platform: 'instagram', kind: 'message', external_id: latest.id, thread_id: conv.id,
        sender_psid: latest.from?.id || null, sender_name: latest.from?.name || null, original_text: latest.message || '',
        context: {},
      })
    }

    const inserted: { id: string; kind: string; platform: string; status: string }[] = []
    for (const c of candidates) {
      const systemPrompt = c.kind === 'comment'
        ? `Você é a Barbearia do Ju (Bragança Paulista/SP) respondendo um comentário público em ${c.platform === 'facebook' ? 'Facebook' : 'Instagram'}. Tom caloroso, curto (1-2 frases), nunca robótico. Pode mencionar o nome da barbearia e a cidade naturalmente (bom pro SEO), sem forçar. NUNCA invente preço, horário ou informação que não foi dada. Se for elogio, agradeça breve. Se for dúvida sobre serviço/preço/horário, responda com o que puder e convide a chamar no WhatsApp ou ver o site www.barbeariadoju.com.br/agendar/ pra confirmar detalhes.`
        : `Você é a Barbearia do Ju (Bragança Paulista/SP) respondendo uma mensagem direta recebida no ${c.platform === 'facebook' ? 'Messenger' : 'Instagram Direct'}. Tom caloroso, direto, 1-3 frases. NUNCA invente preço, horário ou informação que não foi dada. NÃO tente agendar, cancelar ou remarcar por aqui — para qualquer coisa transacional, convide a pessoa a chamar no WhatsApp (11) 96707-3038 ou agendar direto em www.barbeariadoju.com.br/agendar/, onde a assistente consegue ver a agenda de verdade.`

      const hasText = c.original_text.trim().length > 0

      // v29.43.1 — BUG REAL (comentario da Nicole no IG, 16/08/2026): a resposta foi
      // publicada ~11 vezes, uma a cada cron de 15 min. Causa: o codigo ENVIAVA primeiro e
      // so gravava em social_inbox depois — qualquer excecao no meio (timeout de 20s da
      // Graph API, que aborta o fetch DEPOIS de a Meta ja ter publicado; erro da IA; queda
      // da function) derrubava a rodada inteira sem gravar nada, e a rodada seguinte via o
      // comentario como novo e respondia de novo. Regra nova, na ordem certa:
      //   1. RESERVA a linha em social_inbox ANTES de qualquer envio (unique em
      //      platform+kind+external_id: se outra rodada ja reservou, esta pula);
      //   2. gera o rascunho e envia, cada etapa em try/catch proprio — uma falha vira
      //      'rascunho' com o erro anotado, nunca excecao solta;
      //   3. atualiza a linha com o resultado. Reenvio automatico NUNCA acontece: se o
      //      registro existe, o cron nao toca mais nele (o Juliano decide na mao pelo admin).
      const { data: reserved, error: reserveError } = await admin.from('social_inbox').insert({
        platform: c.platform, kind: c.kind, external_id: c.external_id, thread_id: c.thread_id,
        sender_psid: c.sender_psid, sender_name: c.sender_name, original_text: c.original_text,
        ai_draft: null, reply_text: null, status: 'rascunho', replied_at: null,
        context: { ...c.context, auto_send_state: 'reservado' },
      }).select('id').maybeSingle()
      if (reserveError || !reserved) {
        // 23505 = ja existe (outra rodada reservou); qualquer outro erro tambem pula — sem
        // registro nao ha como garantir "uma resposta so", entao e melhor nao responder.
        console.warn('[meta-social-sync] reserva pulada', c.kind, c.platform, c.external_id, reserveError?.code || 'sem linha')
        continue
      }

      // v29.45.0 — DM vazia REPETIDA (figurinha/mídia sem texto) do mesmo perfil: o psid
      // 1061649352872645 mandou a 3ª DM vazia em 19/08 (06/08 e 08/08 já tinham sido
      // ignoradas na mão) e cada uma virou push "esperando você" pro Juliano. A partir da 3ª
      // vazia do mesmo remetente, arquiva como 'ignorado' em silêncio (a linha fica reservada,
      // então nunca reprocessa) e não entra no push. DM vazia de perfil novo continua
      // chegando pra ele decidir — pode ser cliente de verdade mandando um print.
      if (!hasText && c.kind === 'message' && c.sender_psid) {
        const { count: vaziasAntes } = await admin.from('social_inbox')
          .select('id', { count: 'exact', head: true })
          .eq('sender_psid', c.sender_psid).eq('kind', 'message').eq('original_text', '')
          .neq('id', reserved.id)
        if ((vaziasAntes || 0) >= 2) {
          await admin.from('social_inbox').update({
            status: 'ignorado', updated_at: new Date().toISOString(),
            context: { ...c.context, auto_send_state: 'ignorado', motivo: 'dm vazia repetida do mesmo perfil' },
          }).eq('id', reserved.id)
          console.log('[meta-social-sync] dm vazia repetida arquivada sem push', c.platform, c.sender_psid)
          continue
        }
      }

      let draft = ''
      let status: 'enviado' | 'rascunho' = 'rascunho'
      let repliedAt: string | null = null
      let sendError: string | null = null
      try {
        draft = hasText ? await askAI(openaiKey, systemPrompt, c.original_text) : ''
        // Sem texto (figurinha/midia) = nada real pra IA responder; fica em rascunho pro
        // Juliano decidir na mao. Com texto e rascunho gerado, envia de verdade — se a
        // Graph API falhar (token, permissao, timeout), fica em rascunho com o erro anotado.
        if (hasText && draft && dryRun) {
          sendError = '(dry_run — não enviado de verdade)'
        } else if (hasText && draft) {
          const sendResult = await sendReply(pageToken, pageId, igId, c, draft)
          if (sendResult.ok) {
            status = 'enviado'
            repliedAt = new Date().toISOString()
          } else {
            sendError = sendResult.data?.error?.message || `HTTP ${sendResult.status}`
            console.error('[meta-social-sync] envio automático falhou', c.kind, c.platform, c.external_id, sendResult.status, sendResult.data)
          }
        }
      } catch (e) {
        sendError = e instanceof Error ? e.message : String(e)
        console.error('[meta-social-sync] excecao no envio (linha ja reservada, nao reenvia)', c.kind, c.platform, c.external_id, sendError)
      }

      const { error: updateError } = await admin.from('social_inbox').update({
        ai_draft: draft || null, reply_text: draft || null, status, replied_at: repliedAt,
        updated_at: new Date().toISOString(),
        context: sendError ? { ...c.context, auto_send_error: sendError } : { ...c.context, auto_send_state: status },
      }).eq('id', reserved.id)
      if (updateError) console.error('[meta-social-sync] update', updateError)
      inserted.push({ id: reserved.id, kind: c.kind, platform: c.platform, status })
    }

    if (inserted.length) {
      const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
      if (pushSecret) {
        const sent = inserted.filter((i) => i.status === 'enviado')
        const pending = inserted.filter((i) => i.status !== 'enviado')
        const parts = []
        if (sent.length) parts.push(`${sent.length} respondido(s) automaticamente`)
        if (pending.length) parts.push(`${pending.length} esperando você (sem texto ou falha no envio)`)
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
          body: JSON.stringify({ custom: { title: '💬 JuIA Social', body: parts.join(' · '), url: '/admin-conteudo.html?app=1', tag: `social-inbox-${Date.now()}` } }),
        }).catch(() => {})
      }
    }

    return json({ ok: true, checked: candidates.length, inserted: inserted.length, sent: inserted.filter((i) => i.status === 'enviado').length })
  } catch (error) {
    console.error('[meta-social-sync]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
