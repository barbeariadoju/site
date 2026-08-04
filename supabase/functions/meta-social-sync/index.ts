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

// JuIA Social — Fase 1 (v28.50.0): lê comentários novos (FB+IG) e mensagens novas
// (Messenger+Instagram Direct), gera um rascunho de resposta com IA e salva em
// social_inbox pra o Juliano aprovar no admin. NUNCA responde sozinho — só prepara.
Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

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

    const candidates: {
      platform: 'facebook' | 'instagram'
      kind: 'comment' | 'message'
      external_id: string
      thread_id: string
      sender_psid: string | null
      sender_name: string | null
      original_text: string
      context: Record<string, unknown>
    }[] = []

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

    const inserted: { id: string; kind: string; platform: string }[] = []
    for (const c of candidates) {
      const systemPrompt = c.kind === 'comment'
        ? `Você é a Barbearia do Ju (Bragança Paulista/SP) respondendo um comentário público em ${c.platform === 'facebook' ? 'Facebook' : 'Instagram'}. Tom caloroso, curto (1-2 frases), nunca robótico. Pode mencionar o nome da barbearia e a cidade naturalmente (bom pro SEO), sem forçar. NUNCA invente preço, horário ou informação que não foi dada. Se for elogio, agradeça breve. Se for dúvida sobre serviço/preço/horário, responda com o que puder e convide a chamar no WhatsApp ou ver o site www.barbeariadoju.com.br/agendar/ pra confirmar detalhes.`
        : `Você é a Barbearia do Ju (Bragança Paulista/SP) respondendo uma mensagem direta recebida no ${c.platform === 'facebook' ? 'Messenger' : 'Instagram Direct'}. Tom caloroso, direto, 1-3 frases. NUNCA invente preço, horário ou informação que não foi dada. NÃO tente agendar, cancelar ou remarcar por aqui — para qualquer coisa transacional, convide a pessoa a chamar no WhatsApp (11) 96707-3038 ou agendar direto em www.barbeariadoju.com.br/agendar/, onde a assistente consegue ver a agenda de verdade.`
      const draft = await askAI(openaiKey, systemPrompt, c.original_text)
      const { data: row, error } = await admin.from('social_inbox').insert({
        platform: c.platform, kind: c.kind, external_id: c.external_id, thread_id: c.thread_id,
        sender_psid: c.sender_psid, sender_name: c.sender_name, original_text: c.original_text,
        ai_draft: draft, reply_text: draft, status: 'rascunho', context: c.context,
      }).select('id').maybeSingle()
      if (error) { console.error('[meta-social-sync] insert', error); continue }
      if (row) inserted.push({ id: row.id, kind: c.kind, platform: c.platform })
    }

    if (inserted.length) {
      const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
      if (pushSecret) {
        const comments = inserted.filter((i) => i.kind === 'comment').length
        const messages = inserted.filter((i) => i.kind === 'message').length
        const parts = []
        if (comments) parts.push(`${comments} comentário(s)`)
        if (messages) parts.push(`${messages} mensagem(ns)`)
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
          body: JSON.stringify({ custom: { title: '💬 Novos rascunhos da JuIA Social', body: `${parts.join(' e ')} esperando aprovação.`, url: '/admin-conteudo.html?app=1', tag: `social-inbox-${Date.now()}` } }),
        }).catch(() => {})
      }
    }

    return json({ ok: true, checked: candidates.length, inserted: inserted.length })
  } catch (error) {
    console.error('[meta-social-sync]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
