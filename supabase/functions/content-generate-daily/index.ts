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

// Modelo "Nano Banana" — mesmo usado em content-generate-image. Aposenta 02/10/2026,
// trocar por gemini-3.1-flash-image antes disso (mesmo formato de chamada REST).
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'
const BRAND_STYLE = `Fotografia realista e sofisticada para a Barbearia do Ju, barbearia premium de bairro em Bragança Paulista/SP. Paleta visual: dourado (#c89b55) e preto, iluminação de estúdio quente, estética masculina clássica com toque moderno. Sem nenhum texto, letra, número ou logotipo sobreposto na imagem. Nunca gerar rosto de pessoa real/reconhecível nem simular um cliente real — mostrar apenas ambiente, produtos, texturas, detalhes de barbearia (navalha, pente, toalha quente, poltrona, espelho, luz), mãos anônimas trabalhando, ou composições sem rosto em primeiro plano.\n\nFormato quadrado, proporção 1:1, composição centrada pra funcionar como post de feed.`

// Fotos reais do ambiente (v28.52.0) — sem isso o Gemini às vezes "alucinava" composições
// desconexas (ex.: cabeça flutuando sem corpo). Anexar uma foto real como referência de
// ambiente/estilo funciona muito melhor do que só descrever em texto.
const REFERENCE_IMAGES = ['fachada.jpeg', 'interior-1.jpeg', 'interior-2.jpeg', 'interior-3.jpeg']
const REFERENCE_INSTRUCTION = 'A foto anexada mostra o ambiente REAL da barbearia — use-a como referência de luz, cores, texturas e composição, mas gere uma imagem NOVA e original (não é pra editar essa foto). Nunca gere pessoas com partes do corpo cortadas, desconexas ou "flutuando" — se incluir alguém, mostre o corpo inteiro ou enquadre só mãos/objetos/ambiente.'

async function fetchReferenceImage(): Promise<{ mimeType: string; data: string } | null> {
  try {
    const file = REFERENCE_IMAGES[Math.floor(Math.random() * REFERENCE_IMAGES.length)]
    const r = await fetch(`https://www.barbeariadoju.com.br/assets/ia-referencia/${file}`)
    if (!r.ok) return null
    const buffer = await r.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return { mimeType: 'image/jpeg', data: btoa(binary) }
  } catch (error) {
    console.error('[content-generate-daily] referencia', error instanceof Error ? error.message : error)
    return null
  }
}

// Fase 2 (v28.51.0): gera a arte do Instagram sozinho, mesma lógica de content-generate-image
// (função separada, admin-triggered) mas chamada aqui direto pelo cron — sem isso o
// Instagram sempre ficava de fora do gerador diário por falta de imagem.
async function generateAndUploadImage(admin: ReturnType<typeof createClient>, geminiKey: string | undefined, themeText: string, postId: string): Promise<string | null> {
  if (!geminiKey) return null
  try {
    const reference = await fetchReferenceImage()
    const prompt = [BRAND_STYLE, reference ? REFERENCE_INSTRUCTION : '', `Tema do dia: ${themeText}`].filter(Boolean).join('\n\n')
    const requestParts: unknown[] = [{ text: prompt }]
    if (reference) requestParts.push({ inline_data: { mime_type: reference.mimeType, data: reference.data } })
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: requestParts }], generationConfig: { responseModalities: ['IMAGE'] } }),
      },
      45000,
    )
    if (!r.ok) { console.error('[content-generate-daily] gemini', r.status, await r.text().catch(() => '')); return null }
    const d = await r.json().catch(() => ({}))
    const parts = d?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data)
    const base64Data = imagePart?.inlineData?.data || imagePart?.inline_data?.data
    if (!base64Data) { console.error('[content-generate-daily] gemini sem imagem na resposta'); return null }
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
    const path = `instagram/${postId}-${Date.now()}.png`
    const { error: uploadError } = await admin.storage.from('content-images').upload(path, bytes, { contentType: 'image/png', upsert: true })
    if (uploadError) { console.error('[content-generate-daily] upload', uploadError); return null }
    const { data: publicUrlData } = admin.storage.from('content-images').getPublicUrl(path)
    return publicUrlData.publicUrl
  } catch (error) {
    console.error('[content-generate-daily] imagem', error instanceof Error ? error.message : error)
    return null
  }
}

// Central de Conteúdo (v28.44.0, estendido em v28.45.0, Instagram+arte em v28.51.0):
// gera 1 rascunho por dia pra cada plataforma ainda sem rascunho hoje (Status do
// WhatsApp + Facebook + Instagram), sempre baseado em dado real (vaga aberta hoje, ou
// serviço em destaque via public.pick_featured_service). NUNCA publica sozinho — só
// cria o rascunho e avisa o Juliano; publicar é sempre uma ação humana explícita no
// admin (ver content-publish-whatsapp/content-publish-meta).
// Instagram também ganha arte automática via Gemini (generateAndUploadImage) — se a
// geração de imagem falhar por qualquer motivo, o rascunho de texto ainda é criado
// normalmente; o botão manual "Gerar imagem com IA" no admin cobre esse caso.
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
    for (const platform of ['whatsapp_business', 'facebook', 'instagram']) {
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

    if (platformsToGenerate.includes('instagram')) {
      const prompt = `Você escreve a legenda de um post do Instagram pra Barbearia do Ju, uma barbearia real em Bragança Paulista/SP. Tom: caloroso, direto, no máximo 3 frases curtas. Pode usar 1 ou 2 emojis, sem hashtag. Diga "agende pelo link na bio ou chame no WhatsApp" (NUNCA escreva a URL crua, Instagram não deixa link clicável na legenda). NUNCA invente preço, horário ou dado que não foi passado. NUNCA mencione quantidade de horários livres nem diga que a agenda está vazia, livre ou aberta — a barbearia é procurada e os horários são apresentados como oportunidade escassa. Fato real de hoje: ${contextFact}`
      const caption = (await generateCaption(openaiKey, prompt)) || fallbackCaptionFacebook.replace('site www.barbeariadoju.com.br/agendar/', 'link na bio')
      const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
      const themeText = context.tipo === 'servico_destaque'
        ? `destaque para o serviço "${context.servico}" — sugerir a atmosfera desse tipo de atendimento sem escrever nome/preço na imagem.`
        : 'convite pra agendar um horário — transmitir acolhimento e disponibilidade sem texto na imagem.'
      const { data: inserted, error } = await admin
        .from('content_posts')
        .insert({ platform: 'instagram', caption, status: 'rascunho', source: 'ia', context })
        .select('id')
        .single()
      if (error || !inserted) {
        console.error('[content-generate-daily] insert instagram', error)
      } else {
        insertedRows.push({ id: inserted.id, platform: 'instagram', caption })
        const imageUrl = await generateAndUploadImage(admin, geminiKey, themeText, inserted.id)
        if (imageUrl) {
          await admin.from('content_posts').update({ context: { ...context, image_url: imageUrl } }).eq('id', inserted.id)
        }
      }
    }

    if (!insertedRows.length) return json({ error: 'Falha ao salvar rascunho(s).' }, 500)

    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (pushSecret) {
      const platformLabel: Record<string, string> = { whatsapp_business: 'Status do WhatsApp', facebook: 'Facebook', instagram: 'Instagram' }
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
