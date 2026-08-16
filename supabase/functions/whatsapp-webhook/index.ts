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

const normalize = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const formatDateBR = (value: any) => {
  const iso = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Saudação pelo horário de Brasília — mesmo cálculo do ju-ia-site, duplicado aqui (funções
// não compartilham módulo neste projeto) só pro caso de fallback de áudio não transcrito.
const greetingNow = () => {
  const hour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()))
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

// v28.38.0 (item 6): meia-noite de hoje em Brasília, usada como início da janela de
// histórico enviada ao modelo (ver HISTORY_LIMIT/recentMessages abaixo) — "o dia
// inteiro", não um número fixo de horas pra trás.
const startOfTodaySP = () => {
  const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return new Date(`${todayISO}T00:00:00-03:00`).toISOString()
}

// Cliente manda áudio (mensagem de voz) em vez de texto — sem isso, a JuIA ficava em
// silêncio total (bug real relatado pelo Juliano). Baixa o áudio via Evolution API
// (getBase64FromMediaMessage, que já devolve descriptografado) e transcreve com o Whisper
// da OpenAI (mesma chave já usada pela JuIA em ju-ia-site). Falha graciosamente (string
// vazia) em qualquer etapa — quem chama decide o fallback educado pro cliente.
const transcribeAudioMessage = async (
  key: unknown,
  evolutionApiUrl: string,
  evolutionApiKey: string,
  evolutionInstance: string,
): Promise<string> => {
  try {
    const mediaResponse = await fetchWithTimeout(`${evolutionApiUrl}/chat/getBase64FromMediaMessage/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ message: { key } }),
    }, 20000)
    if (!mediaResponse.ok) return ''
    const mediaData = await mediaResponse.json().catch(() => ({}))
    const base64 = String(mediaData?.base64 || '')
    if (!base64) return ''

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    if (!openaiKey) return ''

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'audio/ogg' }), 'audio.ogg')
    form.append('model', 'whisper-1')

    const transcriptionResponse = await fetchWithTimeout('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    }, 30000)
    if (!transcriptionResponse.ok) return ''
    const transcriptionData = await transcriptionResponse.json().catch(() => ({}))
    return String(transcriptionData?.text || '').trim()
  } catch (error) {
    console.error('[whatsapp-webhook] transcribe_audio', error instanceof Error ? error.message : error)
    return ''
  }
}

// v28.35.0: cliente manda uma FOTO de referência (corte, barba, cor) em vez de descrever
// com palavras — antes disso a JuIA ficava em silêncio total (pior que "recusa
// educadamente": nem chegava a responder, porque a legenda da imagem [imageMessage.caption]
// nunca era lida e a mensagem caía direto no skip de "mídia sem texto"). Baixa a imagem via
// Evolution API (mesmo endpoint getBase64FromMediaMessage já usado pro áudio) e manda pro
// modelo com visão (mesmo gpt-5.6-luna da JuIA, Responses API aceita input multimodal).
// Se a imagem não mostrar claramente um corte/barba/coloração, o modelo devolve o token
// NAO_RELACIONADO e a função responde educadamente sem inventar nada. Se a análise falhar
// por qualquer motivo, cai num fallback educado (mesmo padrão do áudio) em vez de silêncio.
const describeReferenceImage = async (
  key: unknown,
  mimetype: string | undefined,
  evolutionApiUrl: string,
  evolutionApiKey: string,
  evolutionInstance: string,
): Promise<string> => {
  try {
    const mediaResponse = await fetchWithTimeout(`${evolutionApiUrl}/chat/getBase64FromMediaMessage/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ message: { key } }),
    }, 20000)
    if (!mediaResponse.ok) return ''
    const mediaData = await mediaResponse.json().catch(() => ({}))
    const base64 = String(mediaData?.base64 || '')
    if (!base64) return ''

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    if (!openaiKey) return ''

    const visionPrompt = 'Você ajuda uma barbearia a entender fotos de referência enviadas por clientes no WhatsApp. Descreva em português do Brasil, em até 2 frases objetivas, o corte de cabelo, estilo de barba ou coloração capilar mostrado na imagem, com detalhes úteis pra um barbeiro entender o que o cliente quer (comprimento, tipo de degradê, risco, formato da barba, técnica de cor etc.). Não sugira nome de serviço nem preço. Se a imagem não mostrar claramente um corte de cabelo, barba ou coloração capilar em uma pessoa, responda SOMENTE o texto NAO_RELACIONADO, sem mais nada.'
    const r = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'low' },
        max_output_tokens: 250,
        instructions: visionPrompt,
        input: [{ role: 'user', content: [{ type: 'input_image', image_url: `data:${mimetype || 'image/jpeg'};base64,${base64}` }] }],
      }),
    }, 25000)
    if (!r.ok) return ''
    const d = await r.json().catch(() => ({}))
    const textOut = typeof d?.output_text === 'string'
      ? d.output_text.trim()
      : (d?.output || []).flatMap((x: any) => x.content || []).filter((x: any) => x.type === 'output_text').map((x: any) => x.text).join('\n').trim()
    return textOut
  } catch (error) {
    console.error('[whatsapp-webhook] describe_image', error instanceof Error ? error.message : error)
    return ''
  }
}

// v28.38.0 (item 6): antes só as últimas 10 mensagens dentro de 6h iam pro prompt do
// modelo — uma conversa de manhã e outra à tarde no MESMO dia (comum: cliente pergunta
// preço de manhã, some, volta à tarde pra agendar) perdia o contexto da parte da manhã,
// arriscando uma resposta fora de contexto (ex.: repetir uma pergunta já respondida, ou
// não reconhecer que já é a segunda vez que ele pergunta). Limite maior comporta o
// volume normal de mensagens de um dia inteiro sem custo desproporcional (mensagens de
// cliente são capadas em 500 caracteres).
const HISTORY_LIMIT = 40
// v28.30.0: human_takeover nunca expirava sozinho — depois de QUALQUER handoff (mesmo um
// pedido simples "quero falar com o Juliano"), o cliente ficava em silêncio permanente,
// sem nenhuma tela de admin pra limpar isso. Expira sozinho depois de 3h — tempo razoável
// pro Juliano assumir a conversa pessoalmente, sem deixar clientes ignorados pra sempre.
const HUMAN_TAKEOVER_WINDOW_MS = 3 * 60 * 60 * 1000
// v28.30.0: se o cliente manda várias mensagens picadas em sequência rápida (ex.: "oi" /
// "quero cortar" / "sexta de tarde"), espera um pouco e junta tudo numa única chamada à
// JuIA em vez de responder cada uma isoladamente — conversa mais natural, menos respostas
// fragmentadas/contraditórias.
const DEBOUNCE_MS = 6000
// v28.30.3: conversa parada há mais de 6h = conversa NOVA. Sem isso, o state (data/serviço
// escolhidos) e o histórico de dias atrás contaminavam a conversa de hoje — caso real
// (Nicole, 31/07/2026): "Quero agendar" respondido com "A data escolhida já passou" porque
// o state ainda guardava a data do agendamento dela de 23/07, e o upsell pulou etapas
// porque o serviço antigo continuava preenchido.
const STALE_CONVERSATION_MS = 6 * 60 * 60 * 1000

// v29.12.0: intervalo mínimo entre dois pushes de "cliente escreveu durante o takeover"
// para o MESMO telefone. 10 min é curto o bastante pra não perder uma pergunta e longo
// o bastante pra uma conversa de várias mensagens não virar chuva de notificação.
const TAKEOVER_PUSH_COOLDOWN_MS = 10 * 60 * 1000

const isTakeoverActive = (row: { human_takeover?: boolean; human_takeover_at?: string | null } | null | undefined) => {
  if (!row?.human_takeover) return false
  if (!row.human_takeover_at) return true // registro antigo sem timestamp — trata como ativo, expira na próxima vez que for setado de novo
  return Date.now() - new Date(row.human_takeover_at).getTime() < HUMAN_TAKEOVER_WINDOW_MS
}

// Trava de processamento por telefone (lease com expiração): evita que duas mensagens
// do mesmo cliente, chegando quase ao mesmo tempo, sejam respondidas em paralelo com
// estado desatualizado (uma delas via ver o resultado da outra antes de responder).
// Se a trava expirar (função anterior travou/caiu), libera sozinha depois de leaseMs.
async function acquireLock(admin: any, phone: string, leaseMs = 20000, maxWaitMs = 18000, pollMs = 400): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs
  while (true) {
    const now = new Date()
    const lockUntil = new Date(now.getTime() + leaseMs).toISOString()
    const { data } = await admin
      .from('whatsapp_conversations')
      .update({ processing_locked_until: lockUntil })
      .eq('phone', phone)
      .or(`processing_locked_until.is.null,processing_locked_until.lt.${now.toISOString()}`)
      .select('phone')
      .maybeSingle()
    if (data) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, pollMs))
  }
}
async function releaseLock(admin: any, phone: string) {
  await admin.from('whatsapp_conversations').update({ processing_locked_until: null }).eq('phone', phone)
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const url = new URL(request.url)
  const provided = request.headers.get('x-webhook-secret') || url.searchParams.get('token') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const payload = await request.json().catch(() => ({}))
    if (payload?.event !== 'messages.upsert') return json({ ok: true, skipped: 'event' })

    const data = payload?.data || {}
    const remoteJid = String(data?.key?.remoteJid || '')
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.startsWith('status@')) {
      return json({ ok: true, skipped: 'not_direct_chat' })
    }

    const phone = remoteJid.split('@')[0].replace(/\D/g, '')
    if (phone.length < 10) return json({ ok: true, skipped: 'invalid_phone' })

    // Nome do contato como salvo no WhatsApp dele — usado pela JuIA pra saudação
    // personalizada (ex.: "Bom dia, Alexandre!") quando o telefone ainda não tem
    // cadastro confirmado no CRM. Pode vir null (ex.: mensagem de anúncio).
    const pushName = String(data?.pushName || '').trim()

    const fromMe = data?.key?.fromMe === true
    const messageId = String(data?.key?.id || '')
    let text = String(data?.message?.conversation || data?.message?.extendedTextMessage?.text || '').trim()

    // v29.17.0 — caso Robson (13/08/2026): o cliente respondeu CITANDO (reply do WhatsApp)
    // a pergunta específica — "Sim" citando o "quer cancelar? responda sim ou não" e "1"
    // citando a pesquisa de satisfação — e nós ignorávamos a citação: o "Sim" foi engolido
    // pela pesquisa pendente ("Não entendi 🙂") e o cancelamento nunca rodou, deixando um
    // agendamento errado de pé. A citação diz EXATAMENTE a qual pergunta o cliente está
    // respondendo, então ela roteia a resposta: cada interceptador abaixo só age se a
    // mensagem não citar a pergunta de OUTRO fluxo. Citação de pergunta da JuIA
    // ("Responda sim ou não"/"Confirmando:") derruba todos os interceptadores e deixa a
    // mensagem chegar nela. Mensagem sem citação segue o comportamento de sempre.
    const quotedRaw = data?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const quotedText = String(quotedRaw?.conversation || quotedRaw?.extendedTextMessage?.text || '').trim()
    const quotedTarget = !quotedText
      ? null
      : (/satisfeito/i.test(quotedText) && /insatisfeito/i.test(quotedText))
        ? 'survey'
        : /deixar seu retorno reservado|Pode reservar|retorno está reservado/i.test(quotedText)
          ? 'invite'
          : /Confirmo presen|vaga foi liberada|Confirmo presença/i.test(quotedText)
            ? 'presence'
            : /lista de espera|abriu uma vaga|vaga aberta/i.test(quotedText)
              ? 'waitlist'
              : /Responda sim ou não|Confirmando:|Só confirmando/i.test(quotedText)
                ? 'juia'
                : null

    const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
    const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
    const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')

    if (fromMe) {
      if (messageId) {
        const { data: ownMessage } = await admin
          .from('whatsapp_messages')
          .select('id')
          .eq('phone', phone)
          .eq('direction', 'out')
          .eq('evolution_message_id', messageId)
          .maybeSingle()
        if (ownMessage) return json({ ok: true, skipped: 'own_echo' })
      }

      await admin.from('whatsapp_conversations').upsert({
        phone,
        human_takeover: true,
        human_takeover_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' })

      await admin.from('whatsapp_messages').insert({
        phone,
        direction: 'out',
        body: text || '[mensagem sem texto]',
        sent_by: 'human',
        evolution_message_id: messageId || null,
      })

      return json({ ok: true, human_takeover: true })
    }

    // v28.69.1 — caso Walter (07/08/2026): ele mandou "Oi bom dia", "Consegue cortar meu
    // cabelo hj as 19:30" e "?" em 3 segundos. A JuIA já estava gerando resposta para o "oi"
    // quando o pedido real chegou, e mandou "Bom dia! Como posso ajudar?" — ignorando a
    // pergunta que ele acabara de fazer. Ele teve de repetir 40 minutos depois.
    // Antes de enviar, conferimos se o cliente falou de novo depois da mensagem que gerou
    // esta resposta. Se falou, a resposta nasceu velha: descartamos, e quem processa a
    // mensagem nova responde o conjunto (o buffer junta os textos).
    let obsoleteCutoffMs = 0
    const respostaFicouObsoleta = async () => {
      if (!obsoleteCutoffMs) return false
      const { data } = await admin
        .from('whatsapp_messages')
        .select('id')
        .eq('phone', phone)
        .eq('direction', 'in')
        .gt('created_at', new Date(obsoleteCutoffMs).toISOString())
        .limit(1)
      return !!(data && data.length > 0)
    }

    const sendWhatsapp = async (to: string, body: string) => {
      if (await respostaFicouObsoleta()) {
        console.warn('[whatsapp-webhook] resposta descartada: cliente escreveu de novo antes do envio', to)
        return true
      }
      const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number: to, text: body }),
      })
      const sendData = await sendResponse.json().catch(() => ({}))
      const sentMessageId = String(sendData?.key?.id || '') || null
      await admin.from('whatsapp_messages').insert({ phone: to, direction: 'out', body, sent_by: 'bot', evolution_message_id: sentMessageId })
      return sendResponse.ok
    }

    // Cliente mandou áudio em vez de texto — tenta transcrever (ver transcribeAudioMessage
    // acima); se não der certo por qualquer motivo, avisa educadamente em vez de ficar em
    // silêncio (bug real: cliente mandava áudio e nunca recebia resposta nenhuma).
    let audioTranscribed = false
    if (!text && data?.message?.audioMessage) {
      const transcribed = await transcribeAudioMessage(data?.key, evolutionApiUrl, evolutionApiKey, evolutionInstance)
      if (transcribed) {
        text = transcribed
        audioTranscribed = true
      } else {
        const fallback = `${greetingNow()}! 😊 Recebi seu áudio, mas por aqui ainda não consigo ouvir mensagens de voz — poderia escrever, por gentileza? Como posso ajudar você hoje?`
        await sendWhatsapp(phone, fallback)
        await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: '[áudio recebido, não foi possível transcrever]' })
        return json({ ok: true, skipped: 'audio_not_transcribed' })
      }
    }

    // Cliente mandou uma FOTO de referência (corte/barba/cor) em vez de texto — ver
    // describeReferenceImage acima. A legenda (imageMessage.caption) nunca era lida antes
    // disso, então mesmo uma foto COM legenda caía direto no skip de "mídia sem texto"
    // (silêncio total, pior que uma recusa educada).
    let imageDescribed = false
    if (!text && data?.message?.imageMessage) {
      const caption = String(data.message.imageMessage.caption || '').trim()
      const description = await describeReferenceImage(data?.key, data.message.imageMessage?.mimetype, evolutionApiUrl, evolutionApiKey, evolutionInstance)
      if (description === 'NAO_RELACIONADO') {
        await sendWhatsapp(phone, `${greetingNow()}! 😊 Recebi sua foto, mas não consegui identificar nela um corte, barba ou coloração. Pode me contar com palavras o que você gostaria?`)
        await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: '[foto recebida, sem relação com corte/barba/cor identificada]' })
        return json({ ok: true, skipped: 'image_not_related' })
      } else if (description) {
        text = `Cliente enviou uma foto de referência de corte/barba/cor. Descrição da imagem: ${description}${caption ? ` Legenda que o cliente escreveu junto: "${caption}"` : ''}`
        imageDescribed = true
      } else {
        const fallback = `${greetingNow()}! 😊 Recebi sua foto, mas no momento não consigo analisar imagens de referência por aqui — poderia descrever com palavras o que você gostaria? Assim já te ajudo certinho.`
        await sendWhatsapp(phone, fallback)
        await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: '[foto recebida, não foi possível analisar]' })
        return json({ ok: true, skipped: 'image_not_analyzed' })
      }
    }

    if (!text) {
      await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: '[mídia ou mensagem sem texto]' })
      return json({ ok: true, skipped: 'no_text' })
    }

    // Registra a mensagem individual no histórico ANTES de agrupar — o histórico mostra
    // cada mensagem real como o cliente mandou, mesmo que a IA processe várias juntas.
    await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: imageDescribed ? `📷 ${text}` : audioTranscribed ? `🎙️ ${text}` : text })

    // Buffer/debounce: junta esta mensagem com qualquer outra que ainda esteja "fresca"
    // (chegou nos últimos DEBOUNCE_MS) pro mesmo telefone, espera um pouco, e só a
    // invocação que continuar sendo "a mais recente" depois da espera de fato processa
    // o texto combinado — as outras (mensagens que já foram superadas por uma mais nova)
    // saem silenciosamente, sem responder nada (a próxima que vencer responde por todas).
    const { data: beforeBuffer } = await admin.from('whatsapp_conversations').select('buffer_text, last_message_at').eq('phone', phone).maybeSingle()
    // Conversa parada há mais de STALE_CONVERSATION_MS: zera o state ANTES de processar,
    // pra JuIA começar do zero (sem data/serviço de uma conversa de dias atrás). A decisão
    // é tomada aqui (antes do upsert tocar last_message_at) — mensagens picadas em sequência
    // não re-zeram, porque a partir da primeira o last_message_at já fica recente.
    const staleConversation = beforeBuffer?.last_message_at
      ? Date.now() - new Date(beforeBuffer.last_message_at).getTime() > STALE_CONVERSATION_MS
      : false
    const combinedSoFar = beforeBuffer?.buffer_text && !staleConversation ? `${beforeBuffer.buffer_text}\n${text}` : text
    const myStamp = new Date().toISOString()
    await admin.from('whatsapp_conversations').upsert({
      phone,
      buffer_text: combinedSoFar,
      buffer_updated_at: myStamp,
      last_message_at: myStamp,
      updated_at: myStamp,
      ...(staleConversation ? { state: {} } : {}),
    }, { onConflict: 'phone' })

    // v28.30.1: o debounce (espera de DEBOUNCE_MS) e todo o processamento que vem depois
    // (IA + envio da resposta) agora rodam em segundo plano via EdgeRuntime.waitUntil, DEPOIS
    // de já termos respondido "ok" pro Evolution API. Motivo: manter a requisição HTTP presa
    // por 6s+ (debounce sozinho já são 6s, fora IA e envio) arriscava ser cortada pelo lado
    // de quem chama o webhook antes de terminar — a mensagem já tinha sido gravada (linha
    // acima), mas a função nunca chegava a responder, e por fora parecia silêncio total.
    // Foi exatamente o que aconteceu na madrugada/manhã de 31/07/2026: várias conversas
    // (inclusive uma resposta simples de "Satisfeito") ficaram sem resposta nenhuma por
    // horas, até o Juliano assumir na mão. Com o ack imediato abaixo, o debounce continua
    // esperando os 6s pra juntar mensagens picadas — só não trava mais a conexão do webhook.
    const processBuffered = async () => {
      try {
        await new Promise((r) => setTimeout(r, DEBOUNCE_MS))

        const { data: afterWait } = await admin.from('whatsapp_conversations').select('buffer_updated_at, buffer_text, human_takeover, human_takeover_at').eq('phone', phone).maybeSingle()
        // BUG CORRIGIDO (v28.30.2): comparar as duas datas como TEXTO nunca batia — o JS grava
        // "...207Z" e o PostgREST devolve "...207+00:00" — então TODA invocação se achava
        // "superada" e ninguém nunca respondia (silêncio total de 31/07/2026, o dia inteiro).
        // Compara como instante numérico (epoch ms), que é imune ao formato.
        const stampMs = new Date(myStamp).getTime()
        const bufferVazio = !afterWait?.buffer_updated_at
        const storedMs = bufferVazio ? NaN : new Date(afterWait!.buffer_updated_at).getTime()

        if (!bufferVazio && storedMs !== stampMs) {
          // Uma mensagem mais nova chegou enquanto esperávamos — ela (ou a próxima depois
          // dela) é responsável por processar o texto combinado. Esta invocação não responde.
          return
        }

        // v28.69.0 — BURACO REAL (caso Walter, 07/08/2026): o buffer podia estar NULO aqui,
        // porque outra invocação em voo já tinha limpado. `storedMs` virava NaN, o teste
        // `storedMs !== stampMs` dava true e esta invocação desistia em SILÊNCIO — mas quem
        // limpou o buffer processou o texto ANTERIOR, não este. Resultado: a mensagem do
        // cliente morria sem resposta e sem erro em log nenhum (o cliente mandou "Corte +
        // lavagem" e ficou 1h esperando).
        // Regra nova: buffer vazio NÃO é motivo pra desistir. Só desiste se já saiu uma
        // resposta DEPOIS desta mensagem — aí sim alguém cobriu por nós. Sem isso, responde,
        // porque silêncio é pior que uma eventual mensagem repetida.
        if (bufferVazio) {
          const { data: jaRespondido } = await admin
            .from('whatsapp_messages')
            .select('id')
            .eq('phone', phone)
            .eq('direction', 'out')
            .gte('created_at', new Date(stampMs).toISOString())
            .limit(1)
          if (jaRespondido && jaRespondido.length > 0) return
          console.warn('[whatsapp-webhook] buffer vazio sem resposta enviada — assumindo o processamento', phone)
        }

        // Somos a mensagem "mais recente" depois da espera — reivindica o buffer completo
        // (pode ter crescido mais do que só esta mensagem, se chegaram picadas antes) e limpa.
        text = afterWait?.buffer_text || text
        // A partir daqui, qualquer mensagem NOVA do cliente torna esta resposta obsoleta.
        obsoleteCutoffMs = Date.now()
        await admin.from('whatsapp_conversations').update({ buffer_text: null, buffer_updated_at: null }).eq('phone', phone)
        // v29.17.1 — caso Helder (13/08/2026): mensagem morreu em silêncio total entre o ack e a
        // chamada da IA, sem UM log sequer pra dizer onde. Marcos de log baratos no caminho feliz:
        // se o silêncio se repetir, o último marco presente diz exatamente onde parou.
        console.log('[whatsapp-webhook] marco:processando', phone, 'chars', String(text || '').length)

        // v28.31.1: checagem de human_takeover MOVIDA pra cá, antes de tudo — bug real
        // (Lucas, 31/07/2026): o Juliano assumiu a conversa pessoalmente (respondeu do
        // próprio WhatsApp), mas as mensagens seguintes do cliente ainda caíam na pesquisa
        // de satisfação pendente ("Não entendi... satisfeito ou insatisfeito?"), porque essa
        // checagem só rodava DEPOIS da pesquisa/lead — um "Isso", "kkkk" ou qualquer resposta
        // curta do cliente disparava a pesquisa por cima da conversa que o Juliano já estava
        // conduzindo. Agora, se o Juliano está no controle, a JuIA nem olha pra pesquisa,
        // lead ou IA — só atualiza o carimbo de hora e sai, em silêncio.
        const { data: conversation } = await admin
          .from('whatsapp_conversations')
          .select('state, human_takeover, human_takeover_at')
          .eq('phone', phone)
          .maybeSingle()

        // v29.17.0 — caso Robson: a pergunta mais recente do PRÓPRIO bot tem prioridade.
        // Se a JuIA está no meio de uma confirmação crítica (cancelar/remarcar/trocar
        // serviço/produtos — os pending_* do state dela), a resposta curta do cliente
        // ("sim"/"não") pertence a ELA: a pesquisa de satisfação, o convite de retorno,
        // a lista de espera e a pesquisa de lead não podem atropelar. Sem isso, o "Sim"
        // do cancelamento caiu na pesquisa pendente e o agendamento errado ficou de pé.
        const aiState = (conversation?.state || {}) as Record<string, unknown>
        const juiaAwaitingAnswer = !!(
          aiState.pending_cancel_booking_id ||
          aiState.pending_reschedule_booking_id ||
          aiState.pending_reschedule_new_date ||
          aiState.pending_products_summary ||
          aiState.pending_change_service_new_name
        )

        const stillActive = isTakeoverActive(conversation)
        await admin.from('whatsapp_conversations').upsert({
          phone,
          state: conversation?.state || {},
          human_takeover: stillActive,
          human_takeover_at: stillActive ? conversation?.human_takeover_at : null,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'phone' })

        // v29.12.0 — caso Deisler (11/08/2026): o Juliano mandou o pedido de avaliação do
        // próprio celular (o que liga o human_takeover por 3h) e, 1 minuto depois, o cliente
        // perguntou quantos cortes faltavam pro corte grátis. A JuIA sabe responder isso
        // (intent 'loyalty'), mas ficou calada por causa do takeover — CORRETO, porque quem
        // está conduzindo é o Juliano — só que ninguém avisou ele, e a pergunta morreu ali.
        // Silêncio continua sendo a regra (a JuIA nunca fala por cima dele), mas agora ele
        // recebe um push com a pergunta pra decidir se responde. Deduplicado por 10 min em
        // integration_alerts pra uma conversa animada não virar chuva de notificação.
        if (stillActive) {
          try {
            const alertKey = `takeover_msg_${phone}`
            const { data: lastAlert } = await admin
              .from('integration_alerts')
              .select('last_alerted_at')
              .eq('alert_key', alertKey)
              .maybeSingle()
            const lastAlertMs = lastAlert?.last_alerted_at ? new Date(lastAlert.last_alerted_at).getTime() : 0
            const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
            if (pushSecret && Date.now() - lastAlertMs > TAKEOVER_PUSH_COOLDOWN_MS) {
              const { data: profile } = await admin.rpc('get_customer_commercial_context', { p_phone: phone }).then(
                (r: any) => ({ data: Array.isArray(r?.data) ? r.data[0] : r?.data }),
                () => ({ data: null }),
              )
              const who = profile?.customer_name || phone
              await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
                body: JSON.stringify({
                  custom: {
                    title: '💬 Cliente te escreveu (você assumiu a conversa)',
                    body: `${who}: "${String(text || '[mensagem sem texto]').slice(0, 120)}" — a JuIA está em silêncio porque você respondeu por último.`,
                    url: '/admin-atendimento.html?app=1',
                    tag: `takeover-msg-${phone}`,
                  },
                }),
              }).catch((error) => console.error('[whatsapp-webhook] takeover push', error))
              await admin.from('integration_alerts').upsert({
                alert_key: alertKey,
                last_value: { phone, text: String(text || '').slice(0, 200) },
                last_checked_at: new Date().toISOString(),
                last_alerted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'alert_key' })
            }
          } catch (takeoverPushError) {
            console.error('[whatsapp-webhook] takeover push', takeoverPushError)
          }
          return
        }

        // v28.32.0: confirmação de presença automática (pedido do Juliano, 31/07/2026 à
        // noite) — checada ANTES da pesquisa de satisfação, mesmo raciocínio do fix do
        // human_takeover: uma resposta curta e transacional como essa não pode ser
        // atropelada por outra checagem. O pedido em si (texto + confirmation_requested_at)
        // é mandado pelo cron whatsapp-booking-confirmation; aqui só interpretamos a
        // resposta do cliente.
        const { data: pendingConfirmationRows } = await admin.rpc('find_pending_confirmation_by_phone', { p_phone: phone })
        const pendingConfirmation = Array.isArray(pendingConfirmationRows) ? pendingConfirmationRows[0] : pendingConfirmationRows

        if (pendingConfirmation && (!quotedTarget || quotedTarget === 'presence')) {
          const normalizedReply = normalize(text)
          const trimmedNormalized = normalizedReply.trim()
          const ambiguousShortReply = trimmedNormalized.length <= 40
          // v28.59.0 — menu numérico (1 confirmo / 2 remarcar / 3 cancelar), sugestão do
          // Juliano (caso Graziela). Números exatos seguem o mesmo padrão da pesquisa de
          // satisfação (^N com pontuação opcional); as palavras continuam valendo por
          // compatibilidade com quem responde por texto.
          // Remarcar checado PRIMEIRO: "não consigo nesse horário, quero remarcar" tem
          // negação E intenção de remarcar — cancelar aqui seria perder o cliente.
          const isReschedule = /^2[\s!.,]*$/.test(trimmedNormalized) || /remarc|reagend|mudar\s+(o\s+)?horari|trocar\s+(o\s+)?horari|outro\s+horari|outro\s+dia/.test(normalizedReply)
          // "não" decide sobre confirmação solta: "não vou poder ir, pode cancelar".
          // Mesmo padrão de simpleYes/simpleNo do ju-ia-site.
          const isDecline = !isReschedule && (/^3[\s!.,]*$/.test(trimmedNormalized) || /\bnao\b|nao vou|nao posso|nao consigo|cancela|infelizmente/.test(normalizedReply))
          const isConfirm = !isReschedule && !isDecline && (/^1[\s!.,]*$/.test(trimmedNormalized) || /\bsim\b|confirmo|confirmado|\bpode ser\b|\bcerto\b|^ok$/.test(normalizedReply))

          if (isReschedule) {
            // Só orienta e devolve pro fluxo normal da JuIA — ela já sabe remarcar
            // (intent reschedule + phone_reschedule_booking, que desde a migration 090
            // marca o horário novo como confirmado).
            await sendWhatsapp(phone, 'Sem problema! 🔄 Me diz o dia e o horário que ficam melhores pra você que eu já remarco por aqui mesmo.')
            return
          }

          if (isDecline) {
            const { data: cancelledRows, error: cancelError } = await admin.rpc('whatsapp_cancel_booking', { p_phone: phone, p_booking_id: pendingConfirmation.id })
            const cancelled = Array.isArray(cancelledRows) ? cancelledRows[0] : cancelledRows
            if (!cancelError && cancelled) {
              await sendWhatsapp(phone, 'Tudo bem, obrigado por avisar! 🙏 Já liberei seu horário. Se quiser remarcar outro dia, é só me chamar.')
              const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
              if (pushSecret) {
                await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
                  body: JSON.stringify({
                    custom: {
                      title: '❌ Cliente avisou que não vai',
                      body: `${cancelled.customer_name || phone} cancelou ${formatDateBR(cancelled.booking_date)} às ${String(cancelled.start_time).slice(0, 5)} — respondeu que não confirma presença.`,
                      url: '/admin-agenda.html?app=1',
                      tag: `booking-confirmation-declined-${cancelled.id}`,
                    },
                  }),
                }).catch((error) => console.error('[whatsapp-webhook] push confirmation decline', error))
              }
              return
            }
            // Erro (ex.: já passou do horário) — cai pro fluxo normal abaixo, sem travar o cliente.
          } else if (isConfirm) {
            const { data: confirmedRows, error: confirmError } = await admin.rpc('phone_confirm_booking', { p_phone: phone, p_booking_id: pendingConfirmation.id })
            const confirmed = Array.isArray(confirmedRows) ? confirmedRows[0] : confirmedRows
            if (!confirmError && confirmed) {
              // v28.59.0: a janela do pedido é de 24h — o horário pode ser hoje OU amanhã,
              // não dá pra cravar "hoje" (bug de texto herdado da janela antiga de 3h).
              const confirmedTodaySP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
              const confirmedDayWord = String(confirmed.booking_date) === confirmedTodaySP ? 'hoje' : 'amanhã'
              await sendWhatsapp(phone, `Confirmado! ✅ Te esperamos ${confirmedDayWord} às ${String(confirmed.start_time).slice(0, 5)}. Qualquer imprevisto, é só me chamar por aqui. 😊`)
              return
            }
          } else if (ambiguousShortReply) {
            const pendingTodaySP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
            const pendingDayWord = String(pendingConfirmation.booking_date) === pendingTodaySP ? 'hoje' : 'amanhã'
            await sendWhatsapp(phone, `Só pra eu não te perder na agenda 😊 Sobre seu horário de ${pendingDayWord} às ${String(pendingConfirmation.start_time).slice(0, 5)} (${pendingConfirmation.service_name}), me responde com um número?\n*1* — Confirmo presença ✅\n*2* — Quero remarcar 🔄\n*3* — Preciso cancelar ❌`)
            return
          }
          // Mensagem longa/claramente sobre outro assunto — cai pro fluxo normal da JuIA.
        }

        // v28.60.0 — caso Kelvin (06/08/2026): o cancelamento automático liberou a vaga
        // às 12:00 e o cliente confirmou às 12:01 — e não existia caminho de volta, a
        // resposta dele caía no fluxo genérico. Agora, se o cliente manda uma mensagem
        // de confirmação e existe um cancelamento AUTOMÁTICO recente (últimas 3h, com
        // pedido de confirmação pendente, horário ainda futuro), o horário é reativado
        // na hora — desde que ninguém tenha ocupado (a RPC valida colisão e bloqueio).
        if (!pendingConfirmation && (!quotedTarget || quotedTarget === 'presence')) {
          const reactivateReply = normalize(text)
          const wantsBack = /^1[\s!.,]*$/.test(reactivateReply.trim()) || (/\bsim\b|confirmo|confirmado|ainda quero|ainda vou|consigo ir|vou conseguir|pode manter|reativa/.test(reactivateReply) && !/\bnao\b/.test(reactivateReply))
          if (wantsBack) {
            const { data: reactivatedRows, error: reactivateError } = await admin.rpc('phone_reactivate_recent_booking', { p_phone: phone })
            const reactivated = Array.isArray(reactivatedRows) ? reactivatedRows[0] : reactivatedRows
            if (reactivateError && String(reactivateError.message || '').includes('horario_ocupado')) {
              await sendWhatsapp(phone, 'Poxa, esse horário acabou de ser preenchido por outro cliente 😔 Me diz outro dia e horário que ficam bons pra você que eu encaixo por aqui mesmo.')
              return
            }
            if (!reactivateError && reactivated) {
              const reactTodaySP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
              const reactDayWord = String(reactivated.booking_date) === reactTodaySP ? 'hoje' : `dia ${formatDateBR(reactivated.booking_date)}`
              await sendWhatsapp(phone, `Prontinho! ✅ Reativei seu horário de ${reactDayWord} às ${String(reactivated.start_time).slice(0, 5)} (${reactivated.service_name}). Te esperamos! 💈`)
              const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
              if (pushSecret) {
                await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
                  body: JSON.stringify({
                    custom: {
                      title: '↩️ Horário reativado pelo cliente',
                      body: `${reactivated.customer_name || phone} confirmou depois do cancelamento automático — ${formatDateBR(reactivated.booking_date)} às ${String(reactivated.start_time).slice(0, 5)} está confirmado de novo.`,
                      url: '/admin-agenda.html?app=1',
                      tag: `booking-reactivated-${reactivated.id}`,
                    },
                  }),
                }).catch((error) => console.error('[whatsapp-webhook] push reactivate', error))
              }
              return
            }
            // Sem cancelamento recente reativável — segue o fluxo normal (JuIA).
          }
        }

        // v28.40.0 (item 1, fechar o loop da lista de espera): resposta à oferta
        // proativa de vaga (mandada pelo whatsapp-lead-followup quando o trigger
        // bookings_notify_waitlist_slot_reopened marca um horário compatível). Mesmo
        // padrão de sim/não do bloco de confirmação de presença acima — checado
        // ANTES do fluxo normal da JuIA pra não deixar a resposta cair no lugar errado.
        const { data: pendingWaitlistOfferRows } = await admin.rpc('find_pending_waitlist_offer_by_phone', { p_phone: phone })
        const pendingWaitlistOffer = Array.isArray(pendingWaitlistOfferRows) ? pendingWaitlistOfferRows[0] : pendingWaitlistOfferRows

        if (pendingWaitlistOffer && !juiaAwaitingAnswer && (!quotedTarget || quotedTarget === 'waitlist')) {
          const normalizedReply = normalize(text)
          const trimmedNormalized = normalizedReply.trim()
          const ambiguousShortReply = trimmedNormalized.length <= 40
          const isDecline = /\bnao\b|nao vou|nao posso|nao quero|nao consigo|infelizmente/.test(normalizedReply)
          const isConfirm = !isDecline && /\bsim\b|confirmo|confirmado|\bpode ser\b|\bcerto\b|\bquero\b|^ok$/.test(normalizedReply)
          const dateLabel = formatDateBR(pendingWaitlistOffer.offered_date)
          const timeLabel = String(pendingWaitlistOffer.offered_start_time).slice(0, 5)

          if (isConfirm) {
            const { data: confirmedRows, error: confirmError } = await admin.rpc('phone_confirm_waitlist_booking', { p_phone: phone, p_waitlist_id: pendingWaitlistOffer.id })
            const confirmed = Array.isArray(confirmedRows) ? confirmedRows[0] : confirmedRows
            if (!confirmError && confirmed) {
              await sendWhatsapp(phone, `Prontinho! ✅ Confirmado pra ${formatDateBR(confirmed.booking_date)} às ${String(confirmed.start_time).slice(0, 5)} (${confirmed.service_name}). Te esperamos!`)
              const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
              if (pushSecret) {
                await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
                  body: JSON.stringify({
                    custom: {
                      title: '🎉 Vaga da lista de espera confirmada',
                      body: `${confirmed.customer_name || phone} confirmou ${formatDateBR(confirmed.booking_date)} às ${String(confirmed.start_time).slice(0, 5)} (${confirmed.service_name}).`,
                      url: '/admin-agenda.html?app=1',
                      tag: `waitlist-confirmed-${confirmed.id}`,
                    },
                  }),
                }).catch((error) => console.error('[whatsapp-webhook] push waitlist confirm', error))
              }
              return
            }
            // Erro (ex.: alguém confirmou primeiro e o horário já foi ocupado) — devolve
            // a pessoa pra fila de espera em vez de deixá-la achando que agendou.
            await admin.from('waitlist').update({ status: 'esperando', offered_date: null, offered_start_time: null, notified_at: null, updated_at: new Date().toISOString() }).eq('id', pendingWaitlistOffer.id)
            await sendWhatsapp(phone, 'Poxa, esse horário acabou de ser ocupado por outra pessoa 😕 Continuo te avisando assim que abrir outra vaga.')
            return
          } else if (isDecline) {
            await admin.from('waitlist').update({ status: 'esperando', offered_date: null, offered_start_time: null, notified_at: null, updated_at: new Date().toISOString() }).eq('id', pendingWaitlistOffer.id)
            await sendWhatsapp(phone, 'Tudo bem, sem problemas! Você continua na lista de espera — aviso assim que abrir outra vaga.')
            return
          } else if (ambiguousShortReply) {
            await sendWhatsapp(phone, `Só confirmando: você ainda quer o horário de ${dateLabel} às ${timeLabel}${pendingWaitlistOffer.service_name ? ` (${pendingWaitlistOffer.service_name})` : ''}? Responda *sim* ou *não*.`)
            return
          }
          // Mensagem longa/claramente sobre outro assunto — cai pro fluxo normal da JuIA.
        }

        // v29.16.0 — resposta ao convite de retorno pós-atendimento (mandado pelo cron
        // return-invite-dispatch na manhã seguinte ao atendimento). Checado ANTES da
        // pesquisa de satisfação de propósito: o convite é sempre a pergunta mais RECENTE
        // (a pesquisa sai no mesmo dia do atendimento, o convite só no dia seguinte), então
        // um "1"/"sim" solto aqui é resposta ao convite, não à pesquisa. Regra do Juliano:
        // nunca insistir — qualquer resposta que não seja 1/2/3 (ou sim/não claro) tira o
        // convite do caminho na hora e deixa a mensagem seguir o fluxo normal da JuIA.
        const { data: returnInviteRows } = await admin
          .from('return_invites')
          .select('*')
          .eq('phone', phone)
          .eq('status', 'sent')
          .gte('sent_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
          .order('sent_at', { ascending: false })
          .limit(1)
        const returnInvite = returnInviteRows && returnInviteRows.length ? returnInviteRows[0] : null
        if (returnInvite && !juiaAwaitingAnswer && (!quotedTarget || quotedTarget === 'invite')) {
          const inviteReply = normalize(text)
          const inviteTrimmed = inviteReply.trim()
          // Ordem importa: "não, prefiro outro dia" tem negação E pedido de outro horário —
          // outro-dia primeiro; "agora não" é recusa; só então o sim.
          const inviteOtherDay = /^2[\s!.,]*$/.test(inviteTrimmed) || /outro dia|outro horari|prefiro outr|remarc|mudar o dia|mudar o horari|semana que vem/.test(inviteReply)
          const inviteDecline = !inviteOtherDay && (/^3[\s!.,]*$/.test(inviteTrimmed) || /\bnao\b|agora nao|deixa pra depois|sem interesse|nao precisa/.test(inviteReply))
          const inviteAccept = !inviteOtherDay && !inviteDecline && (/^1[\s!.,]*$/.test(inviteTrimmed) || /\bsim\b|pode reservar|pode marcar|\breserva\b|confirmo|confirmado|fechou|fechado|\bbora\b|\bpode ser\b/.test(inviteReply))
          const canonInvitePhone = (v: unknown) => {
            const d = String(v || '').replace(/\D/g, '')
            return d.length === 10 || d.length === 11 ? `55${d}` : d
          }
          if (inviteAccept) {
            // Segurança: se nesse meio-tempo o cliente já marcou por outro caminho, não duplica.
            const inviteTodaySP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
            const { data: futureRows } = await admin.from('bookings').select('id,customer_phone,booking_date,start_time').gte('booking_date', inviteTodaySP).in('status', ['pending', 'confirmed'])
            const alreadyBooked = (futureRows || []).find((fb: any) => canonInvitePhone(fb.customer_phone) === phone)
            if (alreadyBooked) {
              await admin.from('return_invites').update({ status: 'expired', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', returnInvite.id)
              await sendWhatsapp(phone, `Você já está com horário marcado pra ${formatDateBR(alreadyBooked.booking_date)} às ${String(alreadyBooked.start_time).slice(0, 5)} 😊 Te espero! Se quiser mudar, é só me falar.`)
              return
            }
            const { data: newBookingId, error: inviteBookError } = await admin.rpc('create_public_booking_v15', {
              p_customer_name: returnInvite.customer_name || 'Cliente',
              p_customer_phone: phone,
              p_customer_email: null,
              p_service_name: returnInvite.service_name,
              p_service_price: returnInvite.service_price,
              p_duration_minutes: returnInvite.duration_minutes || 30,
              p_booking_date: returnInvite.suggested_date,
              p_start_time: returnInvite.suggested_time,
              p_notes: 'Retorno pré-agendado pelo convite da JuIA',
              p_selected_products: [],
            })
            if (inviteBookError || !newBookingId) {
              // Horário sugerido foi ocupado entre o convite e a resposta — devolve pro
              // fluxo de conversa em vez de deixar o cliente no vácuo.
              console.error('[whatsapp-webhook] convite retorno book', inviteBookError)
              await admin.from('return_invites').update({ status: 'counter', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', returnInvite.id)
              await sendWhatsapp(phone, 'Poxa, esse horário acabou de ser ocupado 😔 Me diz outro dia e horário que ficam bons pra você que eu encaixo por aqui mesmo.')
              return
            }
            await admin.from('bookings').update({ channel: 'juia_whatsapp' }).eq('id', newBookingId)
            await admin.from('return_invites').update({ status: 'accepted', result_booking_id: newBookingId, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', returnInvite.id)
            await sendWhatsapp(phone, `Prontinho! ✅ Seu retorno está reservado: ${returnInvite.service_name} em ${formatDateBR(returnInvite.suggested_date)} às ${String(returnInvite.suggested_time).slice(0, 5)}. Te espero! 💈 Qualquer imprevisto, é só me chamar por aqui.`)
            const invitePushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
            if (invitePushSecret) {
              await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-webhook-secret': invitePushSecret },
                body: JSON.stringify({
                  custom: {
                    title: '🔁 Retorno pré-agendado pelo convite',
                    body: `${returnInvite.customer_name || phone} aceitou o convite: ${returnInvite.service_name} em ${formatDateBR(returnInvite.suggested_date)} às ${String(returnInvite.suggested_time).slice(0, 5)}.`,
                    url: '/admin-agenda.html?app=1',
                    tag: `return-invite-${returnInvite.id}`,
                  },
                }),
              }).catch((error) => console.error('[whatsapp-webhook] push convite retorno', error))
            }
            return
          } else if (inviteOtherDay) {
            await admin.from('return_invites').update({ status: 'counter', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', returnInvite.id)
            await sendWhatsapp(phone, 'Claro! Me diz o dia e o horário que ficam melhores pra você que eu já confiro por aqui 😊')
            return
          } else if (inviteDecline) {
            await admin.from('return_invites').update({ status: 'declined', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', returnInvite.id)
            await sendWhatsapp(phone, 'Tudo bem! 👍 Obrigado de novo pela visita — quando quiser marcar, é só me chamar por aqui. 💈')
            return
          }
          // Outro assunto: convite sai do caminho (não intercepta mais nada) e a mensagem
          // segue pro fluxo normal da JuIA, que vê o convite no histórico da conversa.
          await admin.from('return_invites').update({ status: 'counter', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', returnInvite.id)
        }

        // v29.29.0 — ETAPA 2 da avaliação: o cliente já respondeu a pesquisa (1 = satisfeito),
        // recebeu o pedido de avaliação no Google e agora responde. "1" aqui significa
        // *já avaliei, não peça mais* — e vale para sempre, em todos os atendimentos futuros.
        // Checado ANTES da pesquisa de satisfação porque é a pergunta mais recente que a JuIA
        // fez a este cliente (mesmo raciocínio dos outros interceptadores).
        if (!juiaAwaitingAnswer && (!quotedTarget || quotedTarget === 'survey')) {
          const { data: openAskRows } = await admin.rpc('find_open_google_ask_by_phone', { p_phone: phone })
          const openAsk = Array.isArray(openAskRows) ? openAskRows[0] : openAskRows
          if (openAsk) {
            const askReply = normalize(text).trim()
            const jaAvaliou = /^1[\s!.,]*$/.test(askReply)
              || /ja avaliei|ja fiz a avaliacao|ja deixei a avaliacao|ja tinha avaliado|ja avaliamos|avaliei voces|ja fiz/.test(askReply)
            if (jaAvaliou) {
              await admin.rpc('declare_already_reviewed', { p_token: openAsk.token })
              await sendWhatsapp(phone, 'Muito obrigado mesmo! 🙏 Já anotei aqui e não peço mais. Sua avaliação ajuda demais a gente a crescer. Até a próxima! 💈')
              return
            }
            // Qualquer outra coisa (sugestão, novo pedido, agradecimento) segue o fluxo normal.
          }
        }

        const { data: pendingExperience } = await admin.rpc('find_pending_experience_by_phone', { p_phone: phone })
        const pending = Array.isArray(pendingExperience) ? pendingExperience[0] : pendingExperience

        if (pending && !juiaAwaitingAnswer && (!quotedTarget || quotedTarget === 'survey')) {
          const normalizedReply = normalize(text)
          const trimmedNormalized = normalizedReply.trim()
          // Emoji de satisfação/insatisfação: cobre a família toda de reações comuns, não só o
          // 😊/🙁 exato oferecido no menu — caso real (Adalton, 30/07/2026): cliente respondeu
          // 😂 e depois 😄, a JuIA não reconheceu nenhum dos dois e ficou repetindo "não entendi".
          // Caso real 2 (04/08/2026): cliente respondeu ☺️ — visualmente parecida com 😊, mas é
          // de um bloco Unicode totalmente diferente (carinhas "clássicas" tipo ☺/☹, não o bloco
          // moderno 😀-🥰) e não estava coberta. Alternação de emoji literal (não classe [...])
          // porque char class sem flag /u quebra com emoji fora do BMP (par substituto vira 2
          // "caracteres" errados).
          // v28.52.1 (04/08/2026, pedido do Juliano): lista ampliada de vez pra cobrir "qualquer
          // emoji que sinalize positivo/negativo" — não só carinhas, também joia/joia-pra-baixo
          // e variações de coração.
          const positiveEmoji = /😀|😁|😂|😃|😄|😅|😆|🙂|😊|☺|🥰|😍|🤩|😌|🥲|😇|😻|🤗|🥳|👍|🙌|👏|💪|✅|❤|💛|💚|💙|💜|🧡|🖤|🤍|🤎|💕|💖|💗|💓|💞|✨|🎉|💯/
          const negativeEmoji = /🙁|☹|😕|😞|😟|😢|😭|😡|🤬|😠|😤|😩|😫|🤮|💩|❌|👎|💔/
          // v28.54.2 (05/08/2026, pedido do Juliano): pergunta agora pede "digite 1 ou 2" em vez
          // de emoji (mais confiável de digitar/entender que carinha) — número puro, com ou sem
          // pontuação solta ("1", "1.", "1!"), conta como resposta. Emoji/palavra continuam
          // funcionando também (compatibilidade com pesquisas já enviadas antes dessa mudança).
          // v28.67.0 (caso Vaz, 06/08/2026): a mensagem "Me manda o Pix que já faço 😄" foi
          // lida como resposta da pesquisa SÓ por causa do emoji — a JuIA respondeu o texto
          // de "satisfeito" e ignorou o pedido de Pix, que o Juliano teve que atender na mão.
          // Quando a mensagem traz um pedido concreto, ela não é resposta de pesquisa, tenha
          // o emoji que tiver: cai pro fluxo normal da JuIA, que sabe resolver.
          const asksSomethingElse = /\bpix\b|pagar|pagamento|transferir|chave|agendar|marcar|remarcar|cancelar|horario|hora marcada|amanha|quanto custa|pre[cç]o|valor|aberto|abre|funciona/.test(normalizedReply)
          // v28.67.0 (caso Marcelo, 06/08/2026): cliente mandou áudio elogiando e depois
          // escreveu "só elogios hein" — a JuIA respondeu "não entendi" e NÃO disparou o
          // pedido de avaliação no Google. Cliente satisfeito que avaliaria, não avaliou:
          // prejuízo direto. Elogio em texto livre agora conta como satisfeito.
          const praise = /elogi|gostei|gostamos|amei|adorei|perfeit|excelent|maravilh|sensacional|nota ?10|recomend|parabens|caprichad|impec|top\b|show\b|massa\b|daora|curti|melhor|satisfeit|otimo|otima|muito bo[am]|ficou bo[am]|arrasou|show de bola|gratid/.test(normalizedReply)
          // v29.17.0 — caso Robson: "O 1 é relativo a pesquisa." é metafala SOBRE a pesquisa
          // e caía no "não entendi". Quem cita a pesquisa/avaliação e diz 1 ou 2 no meio da
          // frase está respondendo a ela, mesmo sem o número vir sozinho no início.
          const refersToSurvey = /pesquis|avaliacao/.test(normalizedReply)
          const isUnsatisfied = /insatisfeit|ruim|pessimo|horrivel|nao gostei|nao curti|nao amei|nao recomendo/.test(normalizedReply) || negativeEmoji.test(text) || /^2[\s!.,]*$/.test(trimmedNormalized)
            || (refersToSurvey && /\b2\b/.test(normalizedReply) && !/\b1\b/.test(normalizedReply))
          // `&& !isUnsatisfied` é essencial: "não gostei" contém "gostei" e cairia como
          // elogio, mandando pedido de avaliação pra quem reclamou.
          const isSatisfied = !isUnsatisfied && !asksSomethingElse
            && (praise || positiveEmoji.test(text) || /^bo[am]!?$/.test(trimmedNormalized) || /^1[\s!.,]*$/.test(trimmedNormalized)
              || (refersToSurvey && /\b1\b/.test(normalizedReply)))
          // Mensagem claramente NÃO é resposta à pesquisa (pedido de agendamento, pergunta longa,
          // áudio transcrito sobre outro assunto etc.) — sem isso, qualquer cliente com pesquisa
          // pendente ficava travado num "não entendi, satisfeito ou insatisfeito?" repetido pra
          // sempre, mesmo tentando marcar um horário novo. Caso real (Lucas, 30/07/2026): tentou
          // agendar por texto e por áudio com uma pesquisa pendente, os dois caíram na armadilha.
          // Respostas de satisfação são sempre curtas (emoji, "bom", "satisfeito" etc.) — só
          // aplica o gate de "não entendi" pra mensagens curtas; o resto cai pro fluxo normal.
          // Pedido concreto nunca fica preso no "não entendi" da pesquisa.
          const ambiguousShortReply = trimmedNormalized.length <= 40 && !asksSomethingElse

          if (pending.status === 'feedback') {
            const { data: submitResult } = await admin.rpc('submit_experience_response', { p_token: pending.token, p_response: 'feedback', p_feedback: text })
            if (submitResult?.ok) {
              const reply = 'Muito obrigado pela sua sinceridade! 🙏 Já anotei aqui e o Juliano vai entrar em contato pra combinar seu retoque sem custo. Qualquer coisa, estou por aqui.'
              await sendWhatsapp(phone, reply)
              const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
              if (pushSecret) {
                await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
                  body: JSON.stringify({
                    custom: {
                      title: '📝 Sugestão de cliente insatisfeito',
                      body: `${pending.customer_name || phone}: ${text}`.slice(0, 180),
                      url: 'https://wa.me/' + phone,
                      tag: `whatsapp-feedback-${phone}`,
                    },
                  }),
                }).catch((error) => console.error('[whatsapp-webhook] push feedback', error))
              }
              return
            }
          } else if (isSatisfied) {
            const { data: submitResult } = await admin.rpc('submit_experience_response', { p_token: pending.token, p_response: 'satisfied', p_feedback: null })
            if (submitResult?.ok) {
              const { data: alreadyReviewed } = await admin.rpc('customer_already_reviewed', { p_customer_id: pending.customer_id })
              // v28.25.0: o Juliano controla por atendimento (checkbox no "Concluir") se quer
              // pedir avaliação no Google — desmarcado quando já sabe que aquele cliente já
              // avaliou (a checagem automática abaixo só cobre quem clicou no nosso link antes).
              const skipGoogleAsk = alreadyReviewed || pending.request_google_review === false
              // v29.29.0 — ETAPA 2 (correção do Juliano, 16/08/2026): a pesquisa de satisfação
              // é 1/2 e termina aqui. O pedido de avaliação no Google é um segundo momento,
              // com sua própria saída: "1 = já avaliei, não peça mais". Antes eu tinha jogado
              // essa opção dentro da pesquisa — confunde o cliente e polui a medição de
              // satisfação, que é outra coisa.
              //
              // O link agora é RASTREADO (go-review): em 60 dias, 65 clientes disseram
              // "satisfeito" e o sistema registrou zero cliques — porque o link direto nunca
              // deu pra medir. Quem clica é marcado como avaliado e nunca mais é cobrado.
              const trackedReviewLink = `${supabaseUrl}/functions/v1/go-review?t=${pending.token}`
              const reply = alreadyReviewed
                ? 'Que bom saber disso! 😊 Muito obrigado por confiar sempre na Barbearia do Ju. Se tiver alguma 💬 sugestão, pode deixar aqui.'
                : skipGoogleAsk
                  ? 'Que ótimo saber disso! 😊 Muito obrigado por confiar na Barbearia do Ju — foi um prazer cuidar do seu visual!\n\nEstamos sempre à disposição pra cuidar de você, seja marcando pelo nosso site https://www.barbeariadoju.com.br/agendar/, por aqui no WhatsApp ou direto na barbearia. Será sempre uma honra recebê-lo! 🙏\n\nE se tiver alguma 💬 sugestão pra melhorarmos, pode deixar aqui.'
                  : `Que ótimo saber disso! 😊 Ficamos muito felizes que você saiu satisfeito.\n\nSe puder deixar sua avaliação no Google, ajuda demais a gente — leva menos de um minuto: 🙏\n⭐ ${trackedReviewLink}\n\nSe você *já nos avaliou antes*, responda *1* que eu não peço mais. 😉\n\nE se tiver alguma 💬 sugestão, pode deixar aqui também.`
              await sendWhatsapp(phone, reply)
              // Marca que a etapa 2 saiu — é isso que permite interpretar um "1" seguinte
              // como "já avaliei" em vez de resposta solta.
              if (!alreadyReviewed && !skipGoogleAsk) {
                await admin.rpc('mark_google_ask_sent', { p_token: pending.token })
              }
              return
            }
          } else if (isUnsatisfied) {
            const { data: submitResult } = await admin.rpc('submit_experience_response', { p_token: pending.token, p_response: 'feedback', p_feedback: null })
            if (submitResult?.ok) {
              const reply = 'Poxa, sinto muito que sua experiência não tenha sido como esperávamos. 😕 O que podemos fazer pra você se sentir melhor? Se for algo no serviço, podemos fazer um retoque ou reparo agora mesmo, sem nenhum custo — é só me dizer o melhor dia e horário.\n\nE se quiser, deixe aqui sua 💬 sugestão também, vou ler com atenção.'
              await sendWhatsapp(phone, reply)
              await admin.from('whatsapp_conversations').upsert({ phone, human_takeover: true, human_takeover_at: new Date().toISOString(), last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
              const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
              if (pushSecret) {
                await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
                  body: JSON.stringify({
                    custom: {
                      title: '😕 Cliente insatisfeito',
                      body: `${pending.customer_name || phone} ficou insatisfeito. Combine o retoque sem custo pelo WhatsApp.`,
                      url: 'https://wa.me/' + phone,
                      tag: `whatsapp-unsatisfied-${phone}`,
                    },
                  }),
                }).catch((error) => console.error('[whatsapp-webhook] push unsatisfied', error))
              }
              return
            }
          } else if (ambiguousShortReply) {
            const reply = 'Não entendi 🙂 Digite *1* se ficou satisfeito, ou *2* se ficou insatisfeito.'
            await sendWhatsapp(phone, reply)
            return
          }
          // Mensagem longa/claramente sobre outro assunto (não curta e ambígua) ou
          // submitResult veio ok:false (ex: token expirado após 30 dias) — cai pro fluxo
          // normal da JuIA abaixo, sem travar o cliente na pesquisa.
        }

        // v28.31.0: resposta à pesquisa "por que você não agendou?" (mandada pelo
        // whatsapp-lead-followup no dia seguinte ao 1º nudge sem resposta). Só intercepta
        // mensagem CURTA (<=60 caracteres) — igual ao gate da pesquisa de satisfação — pra
        // não sequestrar um pedido novo de verdade ("quero agendar amanhã às 15h" não devia
        // virar "motivo: outro"). Mensagem longa ou sem lead pendente cai pro fluxo normal.
        const trimmedText = text.trim()
        if (trimmedText.length <= 60 && !juiaAwaitingAnswer && !quotedTarget) {
          const { data: pendingLead } = await admin
            .from('conversation_leads')
            .select('phone')
            .eq('phone', phone)
            .eq('followup_stage', 2)
            .is('reason', null)
            .maybeSingle()
          if (pendingLead) {
            const normalizedLeadReply = normalize(trimmedText)
            let reason: string | null = null
            if (/^1\b|horario|\bdia\b|\bdata\b/.test(normalizedLeadReply)) reason = 'sem_horario_desejado'
            else if (/^2\b|preco|caro|valor/.test(normalizedLeadReply)) reason = 'preco'
            else if (/^3\b|pesquisando|so olhando|cotando|so vendo/.test(normalizedLeadReply)) reason = 'so_pesquisando'
            else reason = 'outro'
            await admin.from('conversation_leads').update({
              reason,
              reason_detail: reason === 'outro' ? trimmedText : null,
              responded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('phone', phone)
            await sendWhatsapp(phone, 'Entendido, muito obrigado pelo retorno! 🙏 Qualquer coisa, é só me chamar por aqui.')
            if (reason === 'outro') {
              const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
              if (pushSecret) {
                await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
                  body: JSON.stringify({
                    custom: {
                      title: '💬 Motivo de não-agendamento',
                      body: `${phone}: ${trimmedText}`.slice(0, 180),
                      url: 'https://wa.me/' + phone,
                      tag: `lead-reason-${phone}`,
                    },
                  }),
                }).catch((error) => console.error('[whatsapp-webhook] push lead reason', error))
              }
            }
            return
          }
        }

        // A partir daqui a resposta é gerada e enviada — trava por telefone para não
        // processar duas mensagens do mesmo cliente em paralelo (ver acquireLock acima).
        console.log('[whatsapp-webhook] marco:interceptadores-ok', phone)
        const locked = await acquireLock(admin, phone)
        try {
          // Relê o estado mais recente: se esperamos pela trava, outra mensagem pode
          // ter atualizado o estado (ex.: um agendamento concluído) enquanto esperávamos.
          const { data: freshConversation } = await admin
            .from('whatsapp_conversations')
            .select('state, human_takeover, human_takeover_at')
            .eq('phone', phone)
            .maybeSingle()
          if (isTakeoverActive(freshConversation)) return
          const activeState = freshConversation?.state || conversation?.state || {}

          const { data: recentMessages } = await admin
            .from('whatsapp_messages')
            .select('direction, body, created_at')
            .eq('phone', phone)
            // v28.38.0 (item 6): janela é o DIA CALENDÁRIO atual (Brasília), não mais um
            // rolling de 6h — histórico de dias ANTERIORES continua de fora (histórico de
            // dias atrás no prompt fazia o modelo responder no contexto errado, mesmo caso
            // da Nicole), mas dentro do mesmo dia o modelo agora vê a conversa inteira,
            // mesmo com um intervalo de várias horas no meio (ex.: pergunta de manhã,
            // agendamento à tarde). Não confundir com STALE_CONVERSATION_MS (6h) abaixo,
            // que continua controlando só o reset do state ESTRUTURADO (data/serviço
            // escolhidos) — são propósitos diferentes.
            .gte('created_at', startOfTodaySP())
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT)

          const history = (recentMessages || [])
            .reverse()
            .slice(0, -1)
            .map((m) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.body }))

          console.log('[whatsapp-webhook] marco:chamando-ia', phone)
          const aiResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/ju-ia-site`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              message: text,
              state: activeState,
              session_id: `whatsapp:${phone}`,
              history,
              verified_phone: phone,
              whatsapp_name: pushName,
            }),
          })

          const ai = await aiResponse.json().catch(() => ({}))
          if (!aiResponse.ok || !ai?.reply) {
            console.error('[whatsapp-webhook] ju-ia-site falhou', aiResponse.status, ai)
            return
          }

          let reply = String(ai.reply)
          let handoff = Boolean(ai.handoff)

          // v28.44.4: anti-papagaio — caso real (Juliano, 02/08/2026): ele encaminhou 3
          // mensagens de divulgação com a palavra "barba" (link + textos do lançamento do
          // e-book) e a JuIA respondeu o MESMO menu de barba 3 vezes em 3 minutos, uma pra
          // cada mensagem (espaçadas >6s, então o debounce não agrupa). Se a resposta
          // gerada é idêntica à última que o bot mandou pra esse telefone há menos de 10
          // minutos, fica em silêncio em vez de repetir feito robô — quem mandou a mesma
          // coisa de novo em seguida já recebeu a resposta.
          const { data: lastOut } = await admin
            .from('whatsapp_messages')
            .select('body, created_at')
            .eq('phone', phone)
            .eq('direction', 'out')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          // v29.27.0 — BURACO REAL (caso Vitoria, 15/08/2026, 11:07): o anti-papagaio acima
          // engoliu uma resposta a uma pergunta NOVA e o cliente ficou no vácuo — perdemos a
          // venda. Ela pediu "corte + barba express", a JuIA respondeu "não encontrei
          // horário"; ela emendou "então quero somente corte / para hoje" (com 12:15, 12:30,
          // 14:15 e 14:30 livres!), a IA regerou a MESMA frase, o anti-papagaio suprimiu e
          // ninguém falou mais nada. A cliente nunca foi respondida.
          //
          // A distinção que faltava: repetir resposta para o cliente que repetiu a mensagem é
          // papagaio (suprimir é certo). Repetir resposta para quem perguntou algo NOVO é a IA
          // travada — e aí silêncio é o pior desfecho possível. Nesse caso não calamos: a
          // JuIA assume que empacou, responde curto e honesto, e chama o Juliano.
          if (lastOut && lastOut.body === reply && Date.now() - new Date(lastOut.created_at).getTime() < 10 * 60 * 1000) {
            const { data: ultimasEntradas } = await admin
              .from('whatsapp_messages')
              .select('body')
              .eq('phone', phone)
              .eq('direction', 'in')
              .order('created_at', { ascending: false })
              .limit(2)
            const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
            const clienteRepetiu =
              (ultimasEntradas?.length ?? 0) >= 2 && norm(ultimasEntradas![0].body) === norm(ultimasEntradas![1].body)

            if (clienteRepetiu) {
              console.log('[whatsapp-webhook] anti-papagaio: cliente repetiu a mesma mensagem, resposta suprimida', phone)
              return
            }

            console.warn('[whatsapp-webhook] IA repetiu resposta para pergunta nova — contornando em vez de calar', phone)
            reply = 'Desculpe, me embolei aqui. 🙏 Já estou vendo isso certinho com o Juliano e te respondo em instantes.'
            handoff = true
          }

          const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
            body: JSON.stringify({ number: phone, text: reply }),
          })
          const sendData = await sendResponse.json().catch(() => ({}))
          const sentMessageId = String(sendData?.key?.id || '') || null

          await admin.from('whatsapp_messages').insert({
            phone,
            direction: 'out',
            body: reply,
            sent_by: 'bot',
            evolution_message_id: sentMessageId,
          })

          await admin.from('whatsapp_conversations').update({
            state: ai.state || activeState,
            human_takeover: handoff,
            human_takeover_at: handoff ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }).eq('phone', phone)

          if (handoff) {
            const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
            if (pushSecret) {
              await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
                body: JSON.stringify({
                  custom: {
                    title: '💬 WhatsApp precisa de você',
                    body: `A JuIA não conseguiu resolver com ${phone}. Continue a conversa pelo WhatsApp.`,
                    url: 'https://wa.me/' + phone,
                    tag: `whatsapp-handoff-${phone}`,
                  },
                }),
              }).catch((error) => console.error('[whatsapp-webhook] push handoff', error))
            }
          }
        } finally {
          if (locked) await releaseLock(admin, phone)
        }
      } catch (error) {
        console.error('[whatsapp-webhook] background', error)
      }
    }

    // @ts-ignore — EdgeRuntime é global do runtime das Edge Functions da Supabase (não existe
    // no Deno padrão): roda a promise depois de já termos mandado a resposta HTTP abaixo.
    EdgeRuntime.waitUntil(processBuffered())

    return json({ ok: true, buffered: true })
  } catch (error) {
    console.error('[whatsapp-webhook]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
