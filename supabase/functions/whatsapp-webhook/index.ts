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

// Saudação pelo horário de Brasília — mesmo cálculo do ju-ia-site, duplicado aqui (funções
// não compartilham módulo neste projeto) só pro caso de fallback de áudio não transcrito.
const greetingNow = () => {
  const hour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()))
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
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

const HISTORY_LIMIT = 10
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

    const sendWhatsapp = async (to: string, body: string) => {
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

    if (!text) {
      await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: '[mídia ou mensagem sem texto]' })
      return json({ ok: true, skipped: 'no_text' })
    }

    // Registra a mensagem individual no histórico ANTES de agrupar — o histórico mostra
    // cada mensagem real como o cliente mandou, mesmo que a IA processe várias juntas.
    await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: audioTranscribed ? `🎙️ ${text}` : text })

    // Buffer/debounce: junta esta mensagem com qualquer outra que ainda esteja "fresca"
    // (chegou nos últimos DEBOUNCE_MS) pro mesmo telefone, espera um pouco, e só a
    // invocação que continuar sendo "a mais recente" depois da espera de fato processa
    // o texto combinado — as outras (mensagens que já foram superadas por uma mais nova)
    // saem silenciosamente, sem responder nada (a próxima que vencer responde por todas).
    const { data: beforeBuffer } = await admin.from('whatsapp_conversations').select('buffer_text').eq('phone', phone).maybeSingle()
    const combinedSoFar = beforeBuffer?.buffer_text ? `${beforeBuffer.buffer_text}\n${text}` : text
    const myStamp = new Date().toISOString()
    await admin.from('whatsapp_conversations').upsert({
      phone,
      buffer_text: combinedSoFar,
      buffer_updated_at: myStamp,
      last_message_at: myStamp,
      updated_at: myStamp,
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
        if (afterWait?.buffer_updated_at !== myStamp) {
          // Uma mensagem mais nova chegou enquanto esperávamos — ela (ou a próxima depois
          // dela) é responsável por processar o texto combinado. Esta invocação não responde.
          return
        }

        // Somos a mensagem "mais recente" depois da espera — reivindica o buffer completo
        // (pode ter crescido mais do que só esta mensagem, se chegaram picadas antes) e limpa.
        text = afterWait?.buffer_text || text
        await admin.from('whatsapp_conversations').update({ buffer_text: null, buffer_updated_at: null }).eq('phone', phone)

        const { data: pendingExperience } = await admin.rpc('find_pending_experience_by_phone', { p_phone: phone })
        const pending = Array.isArray(pendingExperience) ? pendingExperience[0] : pendingExperience

        if (pending) {
          const normalizedReply = normalize(text)
          const trimmedNormalized = normalizedReply.trim()
          // Emoji de satisfação/insatisfação: cobre a família toda de reações comuns, não só o
          // 😊/🙁 exato oferecido no menu — caso real (Adalton, 30/07/2026): cliente respondeu
          // 😂 e depois 😄, a JuIA não reconheceu nenhum dos dois e ficou repetindo "não entendi".
          // Alternação de emoji literal (não classe [...]) porque char class sem flag /u quebra
          // com emoji fora do BMP (par substituto vira 2 "caracteres" errados).
          const positiveEmoji = /😀|😁|😂|😃|😄|😅|😆|🙂|😊|🥰|😍|🤩|👍|🙌|❤/
          const negativeEmoji = /🙁|☹|😕|😞|😟|😢|😭|😡|🤬|👎|💔/
          const isSatisfied = /satisfeit|otimo|otima/.test(normalizedReply) || positiveEmoji.test(text) || /^bo[am]!?$/.test(trimmedNormalized)
          const isUnsatisfied = /insatisfeit|ruim|nao gostei/.test(normalizedReply) || negativeEmoji.test(text)
          // Mensagem claramente NÃO é resposta à pesquisa (pedido de agendamento, pergunta longa,
          // áudio transcrito sobre outro assunto etc.) — sem isso, qualquer cliente com pesquisa
          // pendente ficava travado num "não entendi, satisfeito ou insatisfeito?" repetido pra
          // sempre, mesmo tentando marcar um horário novo. Caso real (Lucas, 30/07/2026): tentou
          // agendar por texto e por áudio com uma pesquisa pendente, os dois caíram na armadilha.
          // Respostas de satisfação são sempre curtas (emoji, "bom", "satisfeito" etc.) — só
          // aplica o gate de "não entendi" pra mensagens curtas; o resto cai pro fluxo normal.
          const ambiguousShortReply = trimmedNormalized.length <= 40

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
              const reply = alreadyReviewed
                ? 'Que bom saber disso! 😊 Muito obrigado por confiar sempre na Barbearia do Ju. Se tiver alguma 💬 sugestão, pode deixar aqui.'
                : skipGoogleAsk
                  ? 'Que ótimo saber disso! 😊 Muito obrigado por confiar na Barbearia do Ju — foi um prazer cuidar do seu visual!\n\nEstamos sempre à disposição pra cuidar de você, seja marcando pelo nosso site https://www.barbeariadoju.com.br/agendar/, por aqui no WhatsApp ou direto na barbearia. Será sempre uma honra recebê-lo! 🙏\n\nE se tiver alguma 💬 sugestão pra melhorarmos, pode deixar aqui.'
                  : 'Que ótimo saber disso! 😊 Ficamos muito felizes que você tenha saído satisfeito.\n\nSe puder dedicar um minutinho pra deixar sua avaliação no Google, isso nos ajuda demais a continuar crescendo — ficaríamos muito gratos com sua ajuda! 🙏\n⭐ https://g.page/r/CaQfC5axIQQIEBM/review\n\n(Se você já nos avaliou antes, pode desconsiderar — muito obrigado!)\n\nE se tiver alguma 💬 sugestão pra melhorarmos ainda mais, pode deixar aqui.'
              await sendWhatsapp(phone, reply)
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
            const reply = 'Não entendi 🙂 Você pode responder com 😊 se ficou satisfeito, ou 🙁 se ficou insatisfeito.'
            await sendWhatsapp(phone, reply)
            return
          }
          // Mensagem longa/claramente sobre outro assunto (não curta e ambígua) ou
          // submitResult veio ok:false (ex: token expirado após 30 dias) — cai pro fluxo
          // normal da JuIA abaixo, sem travar o cliente na pesquisa.
        }

        const { data: conversation } = await admin
          .from('whatsapp_conversations')
          .select('state, human_takeover, human_takeover_at')
          .eq('phone', phone)
          .maybeSingle()

        const stillActive = isTakeoverActive(conversation)
        await admin.from('whatsapp_conversations').upsert({
          phone,
          state: conversation?.state || {},
          human_takeover: stillActive,
          human_takeover_at: stillActive ? conversation?.human_takeover_at : null,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'phone' })

        if (stillActive) return

        // A partir daqui a resposta é gerada e enviada — trava por telefone para não
        // processar duas mensagens do mesmo cliente em paralelo (ver acquireLock acima).
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
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT)

          const history = (recentMessages || [])
            .reverse()
            .slice(0, -1)
            .map((m) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.body }))

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

          const reply = String(ai.reply)
          const handoff = Boolean(ai.handoff)

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
