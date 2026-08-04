import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const formatDateBR = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const textFromResponses = (d: any): string =>
  typeof d?.output_text === 'string'
    ? d.output_text.trim()
    : (d?.output || []).flatMap((x: any) => x.content || []).filter((x: any) => x.type === 'output_text').map((x: any) => x.text).join('\n').trim()

async function generateCaption(openaiKey: string | undefined, prompt: string): Promise<string> {
  if (!openaiKey) return ''
  try {
    const r = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'low' },
        max_output_tokens: 220,
        instructions: prompt,
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'Escreva o texto de hoje.' }] }],
      }),
    }, 20000)
    if (!r.ok) return ''
    const d = await r.json().catch(() => ({}))
    return textFromResponses(d)
  } catch (error) {
    console.error('[content-generate-daily] openai', error instanceof Error ? error.message : error)
    return ''
  }
}

// Central de Conteúdo (v28.44.0, estendido em v28.45.0): gera 1 rascunho por dia pra
// cada plataforma ainda sem rascunho hoje (Status do WhatsApp + Facebook), sempre
// baseado em dado real (vaga aberta hoje, ou serviço em destaque via
// public.pick_featured_service). NUNCA publica sozinho — só cria o rascunho e avisa o
// Juliano; publicar é sempre uma ação humana explícita no admin (ver
// content-publish-whatsapp/content-publish-meta).
// Instagram fica de fora daqui de propósito: a Graph API exige imagem pra publicar lá,
// e ainda não existe geração automática de arte (fase futura) — rascunho de Instagram
// continua sendo criado manualmente por enquanto.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok')

  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

    const todaySP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const dow = new Date(`${todaySP}T12:00:00-03:00`).getUTCDay()
    if (dow === 0 || dow === 1) return json({ ok: true, skipped: 'fechado_hoje' })

    const startOfTodayISO = new Date(`${todaySP}T00:00:00-03:00`).toISOString()
    const platformsToGenerate: string[] = []
    for (const platform of ['whatsapp_business', 'facebook']) {
      const { data: existing } = await admin
        .from('content_posts')
        .select('id')
        .eq('source', 'ia')
        .eq('platform', platform)
        .gte('created_at', startOfTodayISO)
        .maybeSingle()
      if (!existing) platformsToGenerate.push(platform)
    }
    if (!platformsToGenerate.length) return json({ ok: true, skipped: 'ja_gerado_hoje' })

    // Dado real #1: tem vaga aberta hoje pro serviço mais comum (Corte de cabelo, 30min)?
    const { data: slots } = await admin.rpc('get_available_slots', { p_date: todaySP, p_duration_minutes: 30 })
    const slotList = Array.isArray(slots) ? slots : []
    const openSlotsCount = slotList.length

    let contextFact: string
    let context: Record<string, unknown>

    if (openSlotsCount > 0) {
      // Regra de posicionamento (pedido explícito do Juliano, 2026-08-04): NUNCA comunicar
      // quantidade de horários livres nem qualquer sinal de agenda vazia — isso sinaliza
      // falta de procura. Apresentar no máximo 1-3 horários como oportunidade escassa
      // ("tenho uma janela às X", "quem agenda primeiro escolhe"). A contagem real fica
      // só no context (dado interno), jamais no texto publicado.
      const sampleTimes = slotList.slice(0, 3).map((s: { slot_time: unknown }) => String(s.slot_time).slice(0, 5))
      const firstSlot = sampleTimes[0]
      const extraTimes = sampleTimes.slice(1)
      contextFact = `Hoje (${formatDateBR(todaySP)}) existe oportunidade de encaixe: uma janela às ${firstSlot}${extraTimes.length ? ` e mais algumas poucas ao longo do dia (ex.: ${extraTimes.join(', ')})` : ''}. Apresente como OPORTUNIDADE escassa e valorizada ("tenho uma janela às X", "quem agenda primeiro escolhe"). É PROIBIDO: dizer quantos horários existem, dizer que a agenda está livre/aberta/vazia, ou qualquer frase que sugira pouca procura.`
      context = { tipo: 'vaga_aberta', data: todaySP, horarios_livres: openSlotsCount, primeiro_horario: firstSlot }
    } else {
      const { data: featuredRows } = await admin.rpc('pick_featured_service')
      const featured = Array.isArray(featuredRows) ? featuredRows[0] : featuredRows
      if (!featured) return json({ ok: true, skipped: 'sem_servico_ativo' })
      const priceLabel = Number(featured.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      contextFact = `Hoje a agenda já está cheia, então destaque o serviço "${featured.name}" (R$${priceLabel}, ${featured.duration_minutes} minutos) como sugestão pra quem quer agendar pros próximos dias.`
      context = { tipo: 'servico_destaque', servico: featured.name, preco: featured.price, duracao_minutos: featured.duration_minutes }
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    const fallbackCaption = context.tipo === 'vaga_aberta'
      ? `📅 Abriu um horário hoje às ${context.primeiro_horario}! Chama pra garantir o seu.`
      : `✂️ Hoje em destaque: ${context.servico} por R$${Number(context.preco).toFixed(2).replace('.', ',')}. Agenda pelos próximos dias!`
    const fallbackCaptionFacebook = context.tipo === 'vaga_aberta'
      ? `📅 Abriu um horário hoje às ${context.primeiro_horario} na Barbearia do Ju! Agende pelo site www.barbeariadoju.com.br/agendar/ ou chame no WhatsApp.`
      : `✂️ Hoje em destaque: ${context.servico} por R$${Number(context.preco).toFixed(2).replace('.', ',')}. Agende pelos próximos dias no site www.barbeariadoju.com.br/agendar/ ou pelo WhatsApp.`

    const insertedRows: { id: string; platform: string; caption: string }[] = []

    if (platformsToGenerate.includes('whatsapp_business')) {
      const prompt = `Você escreve o texto de um Status (Stories) de WhatsApp pra Barbearia do Ju, uma barbearia real em Bragança Paulista/SP. Tom: caloroso, direto, nunca robótico nem "vendedor demais" — é uma barbearia de bairro, não uma grande marca. Use no máximo 2 frases curtas, pode usar 1 emoji no começo, sem hashtag. NUNCA invente preço, horário ou dado que não foi passado. NUNCA mencione quantidade de horários livres nem diga que a agenda está vazia, livre ou aberta — a barbearia é procurada e os horários são apresentados como oportunidade escassa. Fato real de hoje: ${contextFact}`
      const caption = (await generateCaption(openaiKey, prompt)) || fallbackCaption
      const { data: inserted, error } = await admin
        .from('content_posts')
        .insert({ platform: 'whatsapp_business', caption, status: 'rascunho', source: 'ia', context })
        .select('id')
        .single()
      if (error || !inserted) console.error('[content-generate-daily] insert whatsapp', error)
      else insertedRows.push({ id: inserted.id, platform: 'whatsapp_business', caption })
    }

    if (platformsToGenerate.includes('facebook')) {
      const prompt = `Você escreve o texto de um post do Facebook pra Barbearia do Ju, uma barbearia real em Bragança Paulista/SP. Tom: caloroso e um pouco mais descritivo que uma mensagem de WhatsApp (Facebook aceita texto mais completo), mas ainda direto — no máximo 3 frases curtas. Pode usar 1 ou 2 emojis, sem hashtag. Mencione que dá pra agendar pelo site ou WhatsApp. NUNCA invente preço, horário ou dado que não foi passado. NUNCA mencione quantidade de horários livres nem diga que a agenda está vazia, livre ou aberta — a barbearia é procurada e os horários são apresentados como oportunidade escassa. Fato real de hoje: ${contextFact}`
      const caption = (await generateCaption(openaiKey, prompt)) || fallbackCaptionFacebook
      const { data: inserted, error } = await admin
        .from('content_posts')
        .insert({ platform: 'facebook', caption, status: 'rascunho', source: 'ia', context })
        .select('id')
        .single()
      if (error || !inserted) console.error('[content-generate-daily] insert facebook', error)
      else insertedRows.push({ id: inserted.id, platform: 'facebook', caption })
    }

    if (!insertedRows.length) return json({ error: 'Falha ao salvar rascunho(s).' }, 500)

    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (pushSecret) {
      const platformLabel: Record<string, string> = { whatsapp_business: 'Status do WhatsApp', facebook: 'Facebook' }
      const title = insertedRows.length > 1 ? '📝 Novos rascunhos de conteúdo prontos' : '📝 Novo rascunho de conteúdo pronto'
      const body = insertedRows.map((r) => `${platformLabel[r.platform] || r.platform}: ${r.caption.slice(0, 80)}`).join('\n')
      await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
        body: JSON.stringify({
          custom: { title, body, url: '/admin-conteudo.html?app=1', tag: `content-draft-${todaySP}` },
        }),
      }).catch((error) => console.error('[content-generate-daily] push', error))
    }

    return json({ ok: true, generated: insertedRows, context })
  } catch (error) {
    console.error('[content-generate-daily]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
