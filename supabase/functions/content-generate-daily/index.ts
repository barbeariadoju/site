import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'

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

// v28.55.2 — Rastreamento de origem (auditoria 05/08/2026): os rascunhos gerados pela IA
// saíam com o link do site CRU (www.barbeariadoju.com.br/agendar/), sem UTM — só os posts
// escritos à mão tinham. Resultado: nenhum acesso vindo do conteúdo automático aparecia
// separado no GA4, justamente a métrica que os relatórios usam pra provar o que converte.
// A regra "todo link de marketing leva UTM" já estava na marketing_memory, mas nunca tinha
// sido implementada aqui. Agora o link é montado em código (não depende do modelo escrever
// certo) e qualquer URL do site que o modelo tenha inventado no texto é removida antes.
const BOOKING_URL = 'https://www.barbeariadoju.com.br/agendar/'
const bookingLink = (utmSource: string, campaign = 'conteudo-diario') =>
  `${BOOKING_URL}?utm_source=${utmSource}&utm_medium=social&utm_campaign=${campaign}`

// Remove qualquer URL do próprio site escrita pelo modelo (com ou sem http/www, com ou sem
// parâmetros), pra não duplicar link nem publicar versão sem rastreio.
const stripSiteUrls = (text: string) =>
  text
    .replace(/(?:https?:\/\/)?(?:www\.)?barbeariadoju\.com\.br[^\s)]*/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const withBookingLink = (caption: string, utmSource: string) => {
  const clean = stripSiteUrls(caption).replace(/[\s.:;,-]+$/g, '')
  return `${clean}\n${bookingLink(utmSource)}`
}

// v28.55.2 — Trava determinística da regra "nunca expor vacância" (feedback do Juliano,
// 04/08/2026). O prompt já proibia, mas proibição textual depende do modelo obedecer: no
// primeiro dia real o post do Facebook saiu com "tem alguns horários livres na agenda" —
// não citava número nem a palavra "agenda vazia", então escapou da instrução. Agora, se a
// legenda gerada casar com qualquer sinal de agenda ociosa, ela é DESCARTADA e o fallback
// escrito à mão (garantidamente seguro) entra no lugar.
// O `[^.!?\n]{0,20}` entre "agenda" e o adjetivo é proposital: sem ele, "agenda ESTÁ aberta"
// e "agenda ANDA tranquila" escapavam (só casava o adjetivo colado). Limitado a 20 caracteres
// e sem cruzar pontuação pra não casar duas frases distintas ("...da agenda. Aberta desde...").
// v28.58.0 — ampliada a pedido do Juliano (06/08): "janela às X" e "oportunidade de
// encaixe" TODO DIA também expõem cadeira vazia (viraram o post padrão de toda manhã).
// Agora qualquer menção a janela/encaixe/vaga aberta também derruba a legenda pro fallback.
const SCARCITY_VIOLATION = /hor[áa]ri?os?\s+(livres?|dispon[íi]ve|em aberto|vagos?|sobrando)|agenda[^.!?\n]{0,20}\b(livre|vazia|aberta|tranquila|folgada|sem movimento)|v[áa]rios?\s+hor[áa]rios|muitos?\s+hor[áa]rios|alguns?\s+hor[áa]rios|hor[áa]rios\s+sobrando|sobrando\s+hor[áa]rios|\bvagas?\s+(livres?|abertas?|dispon[íi]ve)|sem\s+fila|pouca\s+procura|movimento[^.!?\n]{0,15}\b(fraco|parado|devagar|baixo)|\bjanela\b|\bencaixe\b|vaga\s+aberta|oportunidade\s+(especial|de\s+hor[áa]rio)|quem\s+agenda\s+primeiro/i
const safeCaption = (generated: string, fallback: string, platform: string): string => {
  const candidate = String(generated || '').trim()
  if (!candidate) return fallback
  if (SCARCITY_VIOLATION.test(candidate)) {
    console.error('[content-generate-daily] legenda descartada por expor vacância', platform, candidate)
    return fallback
  }
  return candidate
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
// v29.8.0 (09/08/2026) — paleta REAL, ver comentário completo em content-generate-image.
// Aprovado pelo Juliano depois de testar com as 4 fotos reais da barbearia que ele mandou.
const BRAND_STYLE = `Imagem para o Instagram da Barbearia do Ju, barbearia masculina pequena, sofisticada e premium em Bragança Paulista/SP.

ESTILO: fotografia de produto / still life editorial, estética "Old Money" com toque de luxo contemporâneo. Iluminação quente e aconchegante, aproximadamente 2700–3000K, tons âmbar/dourados — NUNCA usar luz azul, roxa ou branca fria. Sombras profundas e definidas, reflexos naturais em metal e vidro, profundidade e contraste como fotografia cinematográfica. Sofisticação e exclusividade, sem exagero.

PALETA E MATERIAIS REAIS desta barbearia (use como ingredientes de uma composição still life, não como uma sala inteira): parede de tijolo aparente terracota como textura de fundo desfocada; couro preto capitonê; latão e metal preto escovado com pequenos detalhes dourados/bronze; madeira escura de bancada e viga de madeira clara aparente; vidro e cristal (potes de boticário com tampa, frascos âmbar de produto); folhagem verde-escura de samambaia; toalhas dobradas em tom creme; halo de luz âmbar/dourada ao redor de um espelho, sugerido apenas como brilho de fundo, não como espelho inteiro.

OBJETOS EM PRIMEIRO PLANO (still life, poucos por vez): navalha de barbeiro fechada, pente, tesoura de barbeiro, pincel de barba, frasco de produto em vidro âmbar, toalha dobrada — dispostos sobre uma superfície escura (madeira ou mármore preto), com espaço negativo generoso ao redor.

PROIBIDO — não gere em nenhuma hipótese: pessoas, rostos, mãos, corpos ou silhuetas humanas; o ambiente inteiro da barbearia como uma sala reconhecível (nada de porta, layout, múltiplos móveis simultâneos, televisão, cadeira de barbeiro dentro de um cômodo); qualquer texto, letra, número, frase, logotipo ou marca d'água na imagem — nunca tente escrever "Barbearia do Ju" nem nenhuma frase; estética de banco de imagens.

A marca é aplicada depois, por fora, como carimbo — deixe o canto inferior direito com espaço limpo para isso.

Formato quadrado, proporção 1:1, composição centrada pra funcionar como post de feed.`

// v29.7.0 — mesmo carimbo de marca real do content-generate-image. Ver o comentário
// completo naquele arquivo.
const WATERMARK_URL = 'https://www.barbeariadoju.com.br/assets/marca-selo-transparente.png'
async function applyWatermark(pngBytes: Uint8Array): Promise<Uint8Array> {
  try {
    const artwork = await Image.decode(pngBytes)
    const wmRes = await fetch(WATERMARK_URL)
    if (!wmRes.ok) return pngBytes
    const watermark = await Image.decode(new Uint8Array(await wmRes.arrayBuffer()))
    const targetW = Math.round(artwork.width * 0.34)
    const scale = targetW / watermark.width
    watermark.resize(targetW, Math.round(watermark.height * scale))
    const margin = Math.round(artwork.width * 0.04)
    artwork.composite(watermark, artwork.width - watermark.width - margin, artwork.height - watermark.height - margin)
    return await artwork.encode()
  } catch (error) {
    console.error('[content-generate-daily] watermark', error instanceof Error ? error.message : error)
    return pngBytes
  }
}

// Fase 2 (v28.51.0): gera a arte do Instagram sozinho, mesma lógica de content-generate-image
// (função separada, admin-triggered) mas chamada aqui direto pelo cron — sem isso o
// Instagram sempre ficava de fora do gerador diário por falta de imagem.
async function generateAndUploadImage(admin: ReturnType<typeof createClient>, geminiKey: string | undefined, themeText: string, postId: string): Promise<string | null> {
  if (!geminiKey) return null
  try {
    // v29.6.0 — pedido 100% texto, sem anexar foto do salão nem do Juliano.
    // v29.31.0 — domingo pede outra luz: a arte do dia de descanso não pode ter a mesma
    // energia comercial do resto da semana. Mantém a identidade da marca (mesma paleta,
    // mesmos materiais, sem pessoas) e muda só a atmosfera — manhã calma em vez de
    // barbearia em movimento.
    const isDomingo = /domingo/i.test(themeText)
    const MOOD_DOMINGO = `ATMOSFERA DE DOMINGO (obrigatória hoje): luz natural suave de manhã de domingo entrando de lado, clima calmo, silencioso e contemplativo, ferramentas de trabalho em REPOUSO e organizadas (guardadas, fechadas, alinhadas — nunca em uso), xícara de café sobre a bancada, sensação de descanso e casa. NÃO use luz noturna, néon, contraste dramático nem qualquer elemento que sugira movimento ou trabalho acontecendo. Nada de símbolos religiosos explícitos (cruz, igreja, terço, vela de altar).`
    const prompt = [BRAND_STYLE, isDomingo ? MOOD_DOMINGO : '', `Tema do dia: ${themeText}`].filter(Boolean).join('\n\n')
    const requestParts: unknown[] = [{ text: prompt }]
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: requestParts }], generationConfig: { responseModalities: ['IMAGE'] } }),
      },
      // v29.12.0: 45s era apertado — a geração normalmente leva 6-20s, mas num dia lento
      // estourou e o post do dia saiu sem arte. 90s ainda cabe folgado no cron.
      90000,
    )
    if (!r.ok) { console.error('[content-generate-daily] gemini', r.status, await r.text().catch(() => '')); return null }
    const d = await r.json().catch(() => ({}))
    const parts = d?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data)
    const base64Data = imagePart?.inlineData?.data || imagePart?.inline_data?.data
    if (!base64Data) { console.error('[content-generate-daily] gemini sem imagem na resposta'); return null }
    const rawBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
    const bytes = await applyWatermark(rawBytes)
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
    // v29.31.1 — CONTEÚDO TODO DIA, inclusive com a barbearia fechada (decisão do Juliano,
    // 16/08/2026: "o ideal é que tenha posts todos os dias"). O guard antigo pulava domingo e
    // segunda porque não se atende nesses dias — e com isso a marca sumia 2 dias de 7, ou
    // seja, 29% do ano. Perfil que some perde alcance, e some justamente quando o cliente
    // está em casa, sem pressa, com o celular na mão.
    // Dia fechado não vende horário — vende marca: domingo fala de descanso e família,
    // segunda fala de semana nova (e é o dia de maior intenção: "vou me arrumar essa semana").
    // Ver os temas mais abaixo. Nenhum dos dois menciona agenda.

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

    // v28.58.0 — REDESENHO DA ESTRATÉGIA (pedido direto do Juliano, 06/08/2026).
    // O desenho anterior usava "tem horário livre hoje?" como fato padrão do dia — como
    // quase sempre tem, TODO post de manhã virava "janela às 08:30 / oportunidade de
    // encaixe", ou seja, a barbearia anunciava a própria cadeira vazia diariamente
    // (anti-marketing). Regra nova:
    //   1. Agenda de hoje QUASE CHEIA (1-3 horários restando) → aí sim falar do dia,
    //      como sinal de procura alta ("últimos horários de hoje") — escassez verdadeira.
    //   2. Caso contrário, NUNCA mencionar a agenda de hoje. O post do dia vende marca:
    //      campanha ativa (marketing_memory categoria "campanha"), ou rotação de temas
    //      positivos (experiência da loja / cartão fidelidade / serviço em destaque).
    const { data: slots } = await admin.rpc('get_available_slots', { p_date: todaySP, p_duration_minutes: 30 })
    const slotList = Array.isArray(slots) ? slots : []
    const openSlotsCount = slotList.length

    const { data: campaignRows } = await admin
      .from('marketing_memory')
      .select('title, content')
      .eq('category', 'campanha')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    const campaign = Array.isArray(campaignRows) && campaignRows.length ? campaignRows[0] : null

    const NO_AGENDA_TALK = 'É PROIBIDO mencionar a agenda de hoje, disponibilidade, encaixe, janela de horário, vaga aberta ou qualquer coisa que sugira que existe horário sobrando — a barbearia é procurada e o post vende a experiência, não a vacância.'

    let contextFact: string
    let context: Record<string, unknown>

    // v29.31.0 — DOMINGO TEM VOZ PRÓPRIA (ideia do Juliano, 16/08/2026): "domingo é dia de
    // missa, é o primeiro dia da semana, é dia de descanso, é dia de família".
    //
    // A barbearia fecha domingo — então é o único dia em que o post NÃO tenta vender, e é
    // justamente por isso que ele funciona: constrói marca e afeto num dia em que todo
    // concorrente ou some ou empurra promoção. Prioridade acima de campanha e rotação,
    // porque no domingo o TOM importa mais que o conteúdo.
    //
    // Quatro ângulos girando por semana do mês pra não repetir o mesmo post todo domingo.
    // A fé aparece com leveza e acolhimento — nunca prega, nunca exclui quem não é religioso:
    // o cliente da barbearia é de todo tipo, e "descanso, família e recomeço" fala com todos.
    const dowSP = new Date(`${todaySP}T12:00:00-03:00`).getUTCDay() // 0 = domingo
    const NO_HARD_SELL = 'Hoje é DOMINGO e a barbearia está FECHADA. É PROIBIDO: falar de agenda, horário, preço, promoção, ou usar CTA de venda ("agende agora", "corra", "últimas vagas"). No máximo, uma assinatura leve no fim, tipo "até segunda 💈" ou "semana nova, visual novo — te esperamos". O post é sobre a PESSOA, não sobre o serviço.'

    if (dowSP === 0) {
      const semanaDoMes = Math.ceil(Number(todaySP.slice(-2)) / 7)
      const anguloDomingo = [
        'DESCANSO E FAMÍLIA: domingo é o dia de desacelerar, almoçar com quem se ama, ficar em casa sem pressa. Fale sobre o valor de parar — a semana inteira a gente corre, hoje não.',
        'GRATIDÃO: olhe pra semana que passou e agradeça — pelo trabalho, pela família, pelos clientes que passaram pela cadeira. Tom simples e sincero, sem grandiloquência.',
        'RECOMEÇO: domingo é o primeiro dia da semana, a página em branco. Fale de começar bem, com disposição e o visual em dia — sem virar propaganda.',
        'FÉ E PAZ: domingo de missa, de igreja, de casa cheia. Deseje um domingo de paz e bênçãos, com respeito e leveza — sem pregar, sem citar versículo, acolhendo quem crê e quem não crê.',
      ][(semanaDoMes - 1) % 4]

      contextFact = `Tema de hoje: DOMINGO na voz da Barbearia do Ju. Ângulo desta semana — ${anguloDomingo} Escreva curto (2 a 4 linhas), caloroso, em primeira pessoa do plural, como quem manda uma mensagem de bom domingo pra um amigo. ${NO_HARD_SELL}`
      context = { tipo: 'domingo', angulo: semanaDoMes, dia: todaySP }
    } else if (dowSP === 1) {
      // SEGUNDA — a barbearia fecha, mas é o dia de MAIOR intenção da semana: é quando as
      // pessoas decidem "essa semana eu me arrumo". O post não pode vender horário (não tem
      // atendimento hoje), mas planta a semente: terça a agenda abre.
      const semanaDoMes = Math.ceil(Number(todaySP.slice(-2)) / 7)
      const anguloSegunda = [
        'SEMANA NOVA: começar a semana com o visual em dia muda a postura, a confiança e o jeito de entrar numa reunião. Fale disso sem clichê de coach.',
        'PLANEJAMENTO: quem se organiza no começo da semana não corre no fim. Uma provocação leve para já deixar o cuidado marcado na semana.',
        'AUTOESTIMA MASCULINA: cuidar da própria imagem não é vaidade, é respeito por si — tom direto, adulto, sem piegas.',
        'BASTIDOR: segunda é o dia de afiar as ferramentas, organizar a casa e preparar a semana. Mostre o cuidado que existe antes do cliente sentar na cadeira.',
      ][(semanaDoMes - 1) % 4]

      contextFact = `Tema de hoje: SEGUNDA-FEIRA na voz da Barbearia do Ju. Ângulo desta semana — ${anguloSegunda} Escreva curto (2 a 4 linhas), com energia de começo de semana, sem clichê motivacional batido. Hoje a barbearia está FECHADA: é PROIBIDO falar de agenda de hoje, horário livre, encaixe ou vaga. Pode terminar com um convite leve para a semana ("a semana começa amanhã por aqui", "te esperamos a partir de terça").`
      context = { tipo: 'segunda', angulo: semanaDoMes, dia: todaySP }
    } else if (openSlotsCount > 0 && openSlotsCount <= 3) {
      // Escassez REAL: pouquíssimos horários restando é sinal de procura — pode falar.
      contextFact = `A agenda de hoje (${formatDateBR(todaySP)}) está QUASE CHEIA: restam só os últimos horários do dia. Convide a garantir um dos últimos horários de hoje, com tom de procura alta ("a agenda de hoje está fechando", "últimos horários do dia"). É PROIBIDO dizer o número exato de horários, citar horários específicos, ou usar as palavras "janela", "encaixe" e "vaga".`
      context = { tipo: 'reta_final', data: todaySP, horarios_livres: openSlotsCount }
    } else if (campaign) {
      contextFact = `Campanha ativa da barbearia — use como tema central do post de hoje, escolhendo um ângulo criativo (não repita o texto da campanha ao pé da letra): ${String(campaign.content).slice(0, 600)}. Use apenas preços e datas que estão descritos aí em cima — não invente. ${NO_AGENDA_TALK}`
      context = { tipo: 'campanha', campanha: campaign.title }
    } else {
      // Sem campanha: rotação de temas positivos pra não repetir o mesmo post toda manhã.
      const dayNumber = Number(todaySP.slice(-2))
      const rotation = dayNumber % 3
      if (rotation === 0) {
        contextFact = `Tema de hoje: a EXPERIÊNCIA real de ser atendido na Barbearia do Ju — escolha 1 ou 2 destes fatos verdadeiros (não liste todos): café na chegada, atendimento com hora marcada respeitada (sem fila e sem espera), atendimento sem pressa, ambiente climatizado, cartão fidelidade (a cada 10 cortes, 1 é grátis). ${NO_AGENDA_TALK}`
        context = { tipo: 'experiencia' }
      } else if (rotation === 1) {
        contextFact = `Tema de hoje: o CARTÃO FIDELIDADE da Barbearia do Ju — a cada 10 cortes, 1 é grátis, e todo corte conta automaticamente, sem precisar carimbar nada. ${NO_AGENDA_TALK}`
        context = { tipo: 'fidelidade' }
      } else {
        const { data: featuredRows } = await admin.rpc('pick_featured_service')
        const featured = Array.isArray(featuredRows) ? featuredRows[0] : featuredRows
        if (featured) {
          const priceLabel = Number(featured.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          contextFact = `Tema de hoje: destaque o serviço "${featured.name}" (R$${priceLabel}, ${featured.duration_minutes} minutos) — o que é, pra quem é, por que vale a pena. ${NO_AGENDA_TALK}`
          context = { tipo: 'servico_destaque', servico: featured.name, preco: featured.price, duracao_minutos: featured.duration_minutes }
        } else {
          contextFact = `Tema de hoje: a EXPERIÊNCIA real de ser atendido na Barbearia do Ju — escolha 1 ou 2 destes fatos verdadeiros: café na chegada, hora marcada respeitada, atendimento sem pressa, ambiente climatizado. ${NO_AGENDA_TALK}`
          context = { tipo: 'experiencia' }
        }
      }
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    // Fallbacks escritos à mão, garantidamente seguros, um por tema.
    const FALLBACK_BASE: Record<string, string> = {
      reta_final: '🔥 A agenda de hoje está quase fechando! Garanta um dos últimos horários do dia.',
      campanha: '💈 Semana especial na Barbearia do Ju — agende seu horário e viva a experiência completa: café, hora marcada e atendimento sem pressa.',
      experiencia: '💈 Café na chegada, hora marcada respeitada e atendimento sem pressa. Agende seu horário na Barbearia do Ju!',
      fidelidade: '🎁 Cartão fidelidade Barbearia do Ju: a cada 10 cortes, 1 é por nossa conta — e todo corte conta automaticamente. Agende o seu!',
      servico_destaque: context.tipo === 'servico_destaque' ? `✂️ Hoje em destaque: ${context.servico} por R$${Number(context.preco || 0).toFixed(2).replace('.', ',')}. Agende o seu!` : '',
      // Fallback de domingo: sem venda, sem agenda — só o recado do dia. Também rotaciona,
      // pra que uma falha de IA em dois domingos seguidos não repita a mesma frase.
      domingo: [
        '🙏 Bom domingo! Que hoje seja de descanso, mesa cheia e tempo com quem a gente ama. Até segunda 💈',
        '🙏 Domingo é dia de agradecer. Obrigado por cada visita e cada confiança desta semana. Bom descanso a todos! 💈',
        '☀️ Domingo, primeiro dia da semana — página em branco. Que a sua comece leve e com o pé direito. Até logo mais! 💈',
        '🙏 Que seu domingo seja de paz, fé e família. A gente se vê na semana! 💈',
      ][((Math.ceil(Number(todaySP.slice(-2)) / 7)) - 1) % 4],
      segunda: [
        '💈 Semana nova começando. Que tal encarar ela com o visual em dia? A gente te espera a partir de terça.',
        '📅 Segunda é dia de organizar a semana — deixe o seu horário garantido antes que ela encha. Abrimos terça!',
        '✂️ Cuidar da própria imagem não é vaidade, é respeito por si mesmo. Semana nova, visual novo.',
        '💈 Hoje é dia de afiar as ferramentas e deixar tudo pronto pra você. Te esperamos a partir de terça!',
      ][((Math.ceil(Number(todaySP.slice(-2)) / 7)) - 1) % 4],
    }
    const base = FALLBACK_BASE[String(context.tipo)] || FALLBACK_BASE.experiencia
    const fallbackCaption = base
    const fallbackCaptionFacebook = `${base} Agende pelo site ou chame no WhatsApp.`
    // Instagram não aceita link clicável na legenda — CTA é "link na bio", sem URL.
    const fallbackCaptionInstagram = `${base} Agende pelo link na bio ou chame no WhatsApp.`

    const insertedRows: { id: string; platform: string; caption: string }[] = []

    if (platformsToGenerate.includes('whatsapp_business')) {
      const prompt = `Você escreve o texto de um Status (Stories) de WhatsApp pra Barbearia do Ju, uma barbearia real em Bragança Paulista/SP. Tom: caloroso, direto, nunca robótico nem "vendedor demais" — é uma barbearia de bairro, não uma grande marca. Use no máximo 2 frases curtas, pode usar 1 emoji no começo, sem hashtag. NUNCA invente preço, horário ou dado que não foi passado. NUNCA escreva nenhum link/URL — o link de agendamento é acrescentado automaticamente depois do seu texto. NUNCA mencione quantidade de horários livres nem diga que a agenda está vazia, livre ou aberta, e NUNCA use as palavras "janela", "encaixe", "vaga" ou expressões como "horários livres", "vários horários", "alguns horários". O texto precisa ser POSITIVO e fortalecer a imagem da barbearia — procurada, premium e acolhedora: venda a experiência e o motivo pra agendar, nunca a disponibilidade. Fato real de hoje: ${contextFact}`
      const caption = withBookingLink(safeCaption(await generateCaption(openaiKey, prompt), fallbackCaption, 'whatsapp_business'), 'whatsapp_status')
      const { data: inserted, error } = await admin
        .from('content_posts')
        .insert({ platform: 'whatsapp_business', caption, status: 'rascunho', source: 'ia', context })
        .select('id')
        .single()
      if (error || !inserted) console.error('[content-generate-daily] insert whatsapp', error)
      else insertedRows.push({ id: inserted.id, platform: 'whatsapp_business', caption })
    }

    if (platformsToGenerate.includes('facebook')) {
      const prompt = `Você escreve o texto de um post do Facebook pra Barbearia do Ju, uma barbearia real em Bragança Paulista/SP. Tom: caloroso e um pouco mais descritivo que uma mensagem de WhatsApp (Facebook aceita texto mais completo), mas ainda direto — no máximo 3 frases curtas. Pode usar 1 ou 2 emojis, sem hashtag. Mencione que dá pra agendar pelo site ou WhatsApp, mas NUNCA escreva o endereço/URL — o link de agendamento é acrescentado automaticamente depois do seu texto. NUNCA invente preço, horário ou dado que não foi passado. NUNCA mencione quantidade de horários livres nem diga que a agenda está vazia, livre ou aberta, e NUNCA use as palavras "janela", "encaixe", "vaga" ou expressões como "horários livres", "vários horários", "alguns horários". O texto precisa ser POSITIVO e fortalecer a imagem da barbearia — procurada, premium e acolhedora: venda a experiência e o motivo pra agendar, nunca a disponibilidade. Fato real de hoje: ${contextFact}`
      const caption = withBookingLink(safeCaption(await generateCaption(openaiKey, prompt), fallbackCaptionFacebook, 'facebook'), 'facebook')
      const { data: inserted, error } = await admin
        .from('content_posts')
        .insert({ platform: 'facebook', caption, status: 'rascunho', source: 'ia', context })
        .select('id')
        .single()
      if (error || !inserted) console.error('[content-generate-daily] insert facebook', error)
      else insertedRows.push({ id: inserted.id, platform: 'facebook', caption })
    }

    if (platformsToGenerate.includes('instagram')) {
      const prompt = `Você escreve a legenda de um post do Instagram pra Barbearia do Ju, uma barbearia real em Bragança Paulista/SP. Tom: caloroso, direto, no máximo 3 frases curtas. Pode usar 1 ou 2 emojis, sem hashtag. Diga "agende pelo link na bio ou chame no WhatsApp" (NUNCA escreva a URL crua, Instagram não deixa link clicável na legenda). NUNCA invente preço, horário ou dado que não foi passado. NUNCA mencione quantidade de horários livres nem diga que a agenda está vazia, livre ou aberta, e NUNCA use as palavras "janela", "encaixe", "vaga" ou expressões como "horários livres", "vários horários", "alguns horários". O texto precisa ser POSITIVO e fortalecer a imagem da barbearia — procurada, premium e acolhedora: venda a experiência e o motivo pra agendar, nunca a disponibilidade. Fato real de hoje: ${contextFact}`
      // Instagram: sem URL nenhuma na legenda (não é clicável) — só "link na bio". Por isso
      // passa por stripSiteUrls sem receber link de volta, diferente das outras plataformas.
      const caption = stripSiteUrls(safeCaption(await generateCaption(openaiKey, prompt), fallbackCaptionInstagram, 'instagram'))
      const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
      const themeText = context.tipo === 'servico_destaque'
        ? `destaque para o serviço "${context.servico}" — sugerir a atmosfera desse tipo de atendimento sem escrever nome/preço na imagem.`
        : context.tipo === 'campanha' && campaign
        ? `clima da campanha ativa da barbearia (${String(campaign.content).slice(0, 200)}) — transmitir o clima em imagem, sem escrever nenhum texto.`
        : context.tipo === 'fidelidade'
        ? 'clima de recompensa e cuidado contínuo — detalhes do ambiente e do ritual de barbearia, sem texto na imagem.'
        : 'a experiência de ser bem atendido — acolhimento, café, poltrona, ambiente premium, sem texto na imagem.'
      const { data: inserted, error } = await admin
        .from('content_posts')
        .insert({ platform: 'instagram', caption, status: 'rascunho', source: 'ia', context })
        .select('id')
        .single()
      if (error || !inserted) {
        console.error('[content-generate-daily] insert instagram', error)
      } else {
        insertedRows.push({ id: inserted.id, platform: 'instagram', caption })
        // v29.12.0 — em 11/08/2026 os 3 rascunhos do dia saíram SEM imagem nenhuma: a
        // chamada ao Gemini estourou o tempo (a função inteira levou 58s) e o código
        // simplesmente seguiu com null, em silêncio. Testado depois, o mesmo modelo
        // respondeu em 6 segundos — ou seja, foi lentidão passageira, não erro de
        // configuração. Duas correções: uma segunda tentativa antes de desistir, e a
        // MESMA arte aproveitada no Facebook e no Status do WhatsApp (antes só o
        // Instagram recebia imagem, e post com foto rende muito mais nos outros dois).
        let imageUrl = await generateAndUploadImage(admin, geminiKey, themeText, inserted.id)
        if (!imageUrl) {
          console.error('[content-generate-daily] imagem falhou na 1a tentativa, tentando de novo')
          imageUrl = await generateAndUploadImage(admin, geminiKey, themeText, inserted.id)
        }
        if (imageUrl) {
          await admin.from('content_posts').update({ context: { ...context, image_url: imageUrl } }).eq('id', inserted.id)
          const outrosIds = insertedRows.filter((r) => r.platform !== 'instagram').map((r) => r.id)
          for (const outroId of outrosIds) {
            const { data: outro } = await admin.from('content_posts').select('context').eq('id', outroId).maybeSingle()
            await admin.from('content_posts').update({ context: { ...((outro?.context as Record<string, unknown>) || {}), image_url: imageUrl } }).eq('id', outroId)
          }
        } else {
          console.error('[content-generate-daily] imagem falhou nas 2 tentativas — rascunhos ficam sem arte')
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
