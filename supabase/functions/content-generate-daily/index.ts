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

// Central de Conteúdo (v28.44.0): gera 1 rascunho de Status por dia, sempre baseado em
// dado real (vaga aberta hoje, ou serviço em destaque via public.pick_featured_service).
// NUNCA publica sozinho — só cria o rascunho e avisa o Juliano; publicar é sempre uma
// ação humana explícita no admin (ver content-publish-whatsapp).
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

    // Evita gerar duas vezes no mesmo dia se o cron rodar de novo por algum motivo.
    const startOfTodayISO = new Date(`${todaySP}T00:00:00-03:00`).toISOString()
    const { data: existing } = await admin
      .from('content_posts')
      .select('id')
      .eq('source', 'ia')
      .gte('created_at', startOfTodayISO)
      .maybeSingle()
    if (existing) return json({ ok: true, skipped: 'ja_gerado_hoje' })

    // Dado real #1: tem vaga aberta hoje pro serviço mais comum (Corte de cabelo, 30min)?
    const { data: slots } = await admin.rpc('get_available_slots', { p_date: todaySP, p_duration_minutes: 30 })
    const slotList = Array.isArray(slots) ? slots : []
    const openSlotsCount = slotList.length

    let contextFact: string
    let context: Record<string, unknown>

    if (openSlotsCount > 0) {
      const firstSlot = String(slotList[0].slot_time).slice(0, 5)
      contextFact = `Hoje (${formatDateBR(todaySP)}) tem ${openSlotsCount} horário(s) livre(s) na agenda, o mais próximo às ${firstSlot}. Convide o cliente a aproveitar esse horário livre hoje mesmo.`
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
    let caption = ''
    if (openaiKey) {
      const prompt = `Você escreve o texto de um Status (Stories) de WhatsApp pra Barbearia do Ju, uma barbearia real em Bragança Paulista/SP. Tom: caloroso, direto, nunca robótico nem "vendedor demais" — é uma barbearia de bairro, não uma grande marca. Use no máximo 2 frases curtas, pode usar 1 emoji no começo, sem hashtag. NUNCA invente preço, horário ou dado que não foi passado. Fato real de hoje: ${contextFact}`
      try {
        const r = await fetchWithTimeout('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-5.6-luna',
            reasoning: { effort: 'low' },
            max_output_tokens: 180,
            instructions: prompt,
            input: [{ role: 'user', content: [{ type: 'input_text', text: 'Escreva o texto do Status de hoje.' }] }],
          }),
        }, 20000)
        if (r.ok) {
          const d = await r.json().catch(() => ({}))
          caption = typeof d?.output_text === 'string'
            ? d.output_text.trim()
            : (d?.output || []).flatMap((x: any) => x.content || []).filter((x: any) => x.type === 'output_text').map((x: any) => x.text).join('\n').trim()
        }
      } catch (error) {
        console.error('[content-generate-daily] openai', error instanceof Error ? error.message : error)
      }
    }
    // Sem IA disponível (ou falhou): fallback determinístico, sempre baseado no mesmo fato real.
    if (!caption) {
      caption = context.tipo === 'vaga_aberta'
        ? `📅 Abriu um horário hoje às ${context.primeiro_horario}! Chama pra garantir o seu.`
        : `✂️ Hoje em destaque: ${context.servico} por R$${Number(context.preco).toFixed(2).replace('.', ',')}. Agenda pelos próximos dias!`
    }

    const { data: inserted, error: insertError } = await admin
      .from('content_posts')
      .insert({ caption, status: 'rascunho', source: 'ia', context })
      .select('id')
      .single()
    if (insertError || !inserted) {
      console.error('[content-generate-daily] insert', insertError)
      return json({ error: 'Falha ao salvar rascunho.' }, 500)
    }

    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (pushSecret) {
      await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
        body: JSON.stringify({
          custom: {
            title: '📝 Novo rascunho de Status pronto',
            body: caption.slice(0, 120),
            url: '/admin-conteudo.html?app=1',
            tag: `content-draft-${inserted.id}`,
          },
        }),
      }).catch((error) => console.error('[content-generate-daily] push', error))
    }

    return json({ ok: true, id: inserted.id, caption, context })
  } catch (error) {
    console.error('[content-generate-daily]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
