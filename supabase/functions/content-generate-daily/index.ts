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

// v29.31.4 — em dia emocional (domingo/segunda) o link de agendamento NAO entra: o post nao
// vende, e um link de agendar no meio de uma mensagem de domingo desmonta a mensagem.
const withBookingLink = (caption: string, utmSource: string, semLink = false) => {
  if (semLink) return stripSiteUrls(caption).replace(/[\s.:;,-]+$/g, '')
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

// v29.31.3 — texto de post agora é escrito com esforço de verdade (crítica do Juliano,
// 16/08/2026: "vazio", "parece algo pra encher linguiça", "quero algo EXCEPCIONAL").
// O que mudou e por quê:
//   • reasoning 'low' → 'medium': texto que emociona exige o modelo pensar antes de escrever;
//   • pede 3 versões e escolhe a melhor — a primeira ideia é quase sempre a mais óbvia;
//   • tokens maiores, porque o rascunho interno consome orçamento antes da resposta final.
async function generateCaption(openaiKey: string | undefined, prompt: string, exigente = false): Promise<string> {
  if (!openaiKey) return ''
  try {
    const pedido = exigente
      ? 'Escreva TRÊS versões bem diferentes entre si do texto de hoje. Depois releia as três com olhar crítico, pergunte-se qual delas faria alguém parar de rolar o feed e sentir alguma coisa, descarte as outras duas e devolva SOMENTE a melhor — sem numeração, sem títulos, sem comentário nenhum, apenas o texto final pronto pra publicar.'
      : 'Escreva o texto de hoje.'
    const r = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reasoning: { effort: exigente ? 'medium' : 'low' },
        max_output_tokens: exigente ? 1400 : 220,
        instructions: prompt,
        input: [{ role: 'user', content: [{ type: 'input_text', text: pedido }] }],
      }),
    }, exigente ? 45000 : 20000)
    if (!r.ok) return ''
    const d = await r.json().catch(() => ({}))
    return textFromResponses(d)
  } catch (error) {
    console.error('[content-generate-daily] openai', error instanceof Error ? error.message : error)
    return ''
  }
}

// Trava determinística contra texto vazio — mesma ideia do SCARCITY_VIOLATION, mas para
// qualidade em vez de estratégia. O modelo pode desobedecer uma instrução de estilo; não
// pode desobedecer um filtro. Se a legenda cair em clichê de cartão ou virar lista de
// objetos, ela é descartada e outra é pedida.
const CLICHE_VAZIO = /que a semana comece leve|disposi[çc][ãa]o renovada|novos? recome[çc]os?|energias? renovadas?|recarregar as energias|momentos? especiais|o visual em dia|sua melhor vers[ãa]o|aproveite o dia em fam[íi]lia|dia de descanso e renova[çc][ãa]o|desejamos a todos/i
// v29.74.0 — clichê INSTITUCIONAL de dia útil (26/08/2026): três dias seguidos de rascunho
// reprovado no crivo com a mesma voz de agência ("Seu visual merece o cuidado e a precisão",
// "experiência premium", "acabamento impecável"). São frases que serviriam pra qualquer
// barbearia do país — o oposto do que o Juliano aprova. Mesma lógica do CLICHE_VAZIO:
// o prompt proíbe, mas proibição textual depende do modelo; o filtro não.
const CLICHE_INSTITUCIONAL = /\b(visual|estilo|corte|cabelo|barba|voc[êe])\s+(merece|pede)\b|merece\s+(o\s+)?cuidado|cuidado\s+(e\s+(a\s+)?(precis[ãa]o|estilo)|à\s+altura|nos\s+detalhes)|experi[êe]ncia\s+(premium|[úu]nica|completa|exclusiva)|momento\s+de\s+cuidado|acabamento\s+impec[áa]vel|atendimento\s+(de\s+excel[êe]ncia|impec[áa]vel|diferenciado)|cada\s+corte\s+[ée]\s+pensado|eleve\s+(o\s+)?seu|autoestima\s+em\s+dia|garanta\s+seu\s+momento/i
// v29.31.5 — nunca revelar quando a barbearia abriu (decisão do Juliano, 16/08/2026).
// Um texto emocionou de verdade dizendo "comecei do zero em março" — mas datar o começo
// entrega a quem ainda não é cliente que a casa é recente, e isso trabalha contra a
// percepção de autoridade sem acrescentar nada à emoção. A memória ("lembro do silêncio
// daquela cadeira") emociona igual e não revela idade.
const REVELA_IDADE = /\b(em|desde|no in[íi]cio de|come[çc]o de)\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b|\bh[áa]\s+\d+\s+(meses|anos|semanas)\b|\bdesde\s+20\d\d\b|\b20\d\d\b|\bnossos?\s+primeiros?\s+(meses|anos)\b|\brec[ée]m[- ]inaugurad/i
const textoRaso = (t: string) => {
  const txt = String(t || '').trim()
  if (!txt) return true
  if (CLICHE_VAZIO.test(txt)) return true
  if (CLICHE_INSTITUCIONAL.test(txt)) return true
  if (REVELA_IDADE.test(txt)) return true
  // "domingo" repetido 3+ vezes = texto girando em torno de si mesmo, sem conteúdo.
  if ((txt.toLowerCase().match(/domingo/g) || []).length >= 3) return true
  return false
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

PROIBIDO — não gere em nenhuma hipótese: pessoas, rostos, mãos, corpos ou silhuetas humanas — EM NENHUMA FORMA: nem como pessoa real, nem como silhueta, sombra, reflexo em espelho, figura dentro de quadro/pôster/pintura pendurado na parede, manequim, busto ou boneco. Se houver um quadro na parede, ele deve ser abstrato, geométrico ou vazio; o ambiente inteiro da barbearia como uma sala reconhecível (nada de porta, layout, múltiplos móveis simultâneos, televisão, cadeira de barbeiro dentro de um cômodo); qualquer texto, letra, número, frase, logotipo ou marca d'água na imagem — nunca tente escrever "Barbearia do Ju" nem nenhuma frase; estética de banco de imagens.

PROIBIDO TAMBÉM, SEM EXCEÇÃO (regra permanente da marca, definida pelo Juliano em 16/08/2026 — ele repudia o estímulo, mesmo inconsciente, a drogas legalizadas): qualquer bebida alcoólica ou objeto que a sugira — copo de whisky/uísque, dose, taça de vinho, garrafa ou decanter de licor, rótulo de destilado, rolha, saca-rolhas, balde de gelo com garrafa, chope, cerveja; qualquer produto de tabaco ou fumo — cigarro, charuto, cachimbo, cinzeiro, isqueiro, fósforo aceso, narguilé, vaporizador, fumaça de cigarro; e qualquer outro elemento imoral, ilegal ou inadequado para público de todas as idades (armas, jogos de azar, apostas, conteúdo sensual). O frasco âmbar permitido é SEMPRE de produto de barbearia (tônico, óleo de barba, loção pós-barba) — nunca com aparência de garrafa de bebida. Na dúvida entre um objeto ambíguo e nenhum objeto, escolha nenhum.

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
// v29.31.6 — BUG REAL encontrado em 16/08/2026, depois de CINCO artes de domingo saírem
// escuras. A direção de arte de domingo existia e estava certa, mas NUNCA era acionada: o
// gatilho é a palavra "domingo" dentro deste texto, e nenhum dos casos abaixo a produzia.
// Domingo caía no texto genérico — "acolhimento, café, poltrona, ambiente premium" — que é
// exatamente a imagem escura com poltrona e xícara que voltava toda vez. Não era o modelo
// desobedecendo o prompt; era o prompt certo nunca chegando ao modelo.
// Virou função à parte porque o modo de regerar só a arte (abaixo) precisa do mesmo texto.
// Contas pessoais do Juliano e da esposa. Marcadas na legenda do Instagram para que eles
// possam repostar no story — o alcance do post deixa de ser só o da barbearia.
const CONTAS_PARCEIRAS = ['@julianoblpadilha', '@nicolefpadilha']
const comMarcacoes = (caption: string) => {
  const texto = String(caption || '').trimEnd()
  const faltando = CONTAS_PARCEIRAS.filter((c) => !texto.toLowerCase().includes(c.toLowerCase()))
  return faltando.length ? `${texto}\n\n${faltando.join(' ')}` : texto
}

function themeTextFor(context: Record<string, unknown>, campanha = ''): string {
  switch (context.tipo) {
    case 'domingo':
      return 'domingo de manhã: a barbearia em repouso, luz clara de sol, silêncio e descanso, sem texto na imagem.'
    case 'segunda':
      return 'começo de semana: ferramentas limpas e organizadas, casa preparada para receber, luz clara de manhã, sem texto na imagem.'
    case 'servico_destaque':
      return `destaque para o serviço "${context.servico}" — sugerir a atmosfera desse tipo de atendimento sem escrever nome/preço na imagem.`
    case 'campanha':
      return `clima da campanha ativa da barbearia (${campanha.slice(0, 200)}) — transmitir o clima em imagem, sem escrever nenhum texto.`
    case 'fidelidade':
      return 'clima de recompensa e cuidado contínuo — detalhes do ambiente e do ritual de barbearia, sem texto na imagem.'
    default:
      return 'a experiência de ser bem atendido — acolhimento, café, poltrona, ambiente premium, sem texto na imagem.'
  }
}

async function generateAndUploadImage(admin: ReturnType<typeof createClient>, geminiKey: string | undefined, themeText: string, postId: string): Promise<string | null> {
  if (!geminiKey) return null
  try {
    // v29.6.0 — pedido 100% texto, sem anexar foto do salão nem do Juliano.
    // v29.31.0 — domingo pede outra luz: a arte do dia de descanso não pode ter a mesma
    // energia comercial do resto da semana. Mantém a identidade da marca (mesma paleta,
    // mesmos materiais, sem pessoas) e muda só a atmosfera — manhã calma em vez de
    // barbearia em movimento.
    // v29.31.4 — o domingo ganhou prompt PRÓPRIO em vez de "estilo padrão + exceções".
    // Motivo: o BRAND_STYLE é longo e insiste em "sombras profundas / clima cinematográfico",
    // e o modelo obedecia a ele mesmo com o override — três tentativas seguidas voltaram
    // escuras, com objetos demais e até texto na arte. Empilhar exceção sobre instrução
    // contrária não funciona; escrever a instrução certa desde a primeira linha, sim.
    const DOMINGO_STYLE = `Fotografia still life editorial de altíssimo padrão para o Instagram de uma barbearia masculina sofisticada em Bragança Paulista/SP. Estética "quiet luxury": elegante, silenciosa, contemplativa.

A IDEIA: a barbearia em repouso numa manhã de domingo. O trabalho parou. É o retrato do silêncio de um lugar que trabalhou a semana inteira.

LUZ — O ELEMENTO MAIS IMPORTANTE DA IMAGEM, e o que diferencia o post de domingo de todo o resto do feed (que é escuro e amadeirado): esta foto é CLARA, ENSOLARADA E ALEGRE. Sol de manhã de verdade entrando por uma janela, feixe de luz visível cruzando a cena, respingos de sol na superfície, sombras longas e suaves, brancos limpos e luminosos, high key, exposição generosa. O clima é de manhã bonita, otimista, com ar de recomeço — não é uma foto sóbria.
PALETA DE DOMINGO (diferente da paleta padrão da marca, de propósito, para criar contraste no feed): predominam tons CLAROS — creme, areia, off-white, madeira clara, dourado do sol. Marrom escuro e preto entram só como detalhe pequeno, nunca como fundo dominante.
É PROIBIDO: imagem escura, marrom-escura, penumbra, ambiente noturno, luz artificial amarelada como fonte principal, néon, LED aceso, clima sombrio ou pesado.

COMPOSIÇÃO — MÁXIMO 3 ELEMENTOS NA IMAGEM INTEIRA, e pelo menos 45% de espaço vazio: um objeto herói em foco nítido e no máximo dois apoios discretos e desfocados. Escolha UMA composição: (a) uma navalha de barbeiro fechada, de cabo escuro, repousando sobre uma toalha creme dobrada; (b) uma xícara branca de café sobre uma bancada de madeira escura vazia; (c) uma tesoura e um pente alinhados sobre couro preto; (d) um pincel de barba em pé, sozinho, sobre mármore claro. NUNCA misture louça de café com ferramentas de barbear na mesma superfície — não faz sentido narrativo.

MATERIAIS PERMITIDOS: madeira escura, mármore claro, couro preto, latão, aço polido, algodão creme, vidro âmbar liso e SEM RÓTULO. Fundo: parede de tijolo aparente muito desfocada ou parede lisa clara.

ÓPTICA: 85mm, abertura f/2.0, profundidade de campo rasa, câmera na altura da superfície, composição assimétrica com o objeto fora do centro.

PROIBIDO ABSOLUTAMENTE (a arte é descartada se aparecer): qualquer letra, palavra, número, rótulo escrito, logotipo, marca d'água, assinatura ou texto de qualquer tipo — inclusive em frascos, potes e etiquetas, que devem ser LISOS; pessoas, rostos, mãos, corpos, silhuetas, reflexos ou figuras humanas em quadros; bebida alcoólica ou qualquer objeto que a sugira (copo de whisky, taça, garrafa de destilado, decanter); cigarro, charuto, cinzeiro, isqueiro ou fumaça de tabaco; ambiente escuro, penumbra, luz noturna, néon, anel de LED aceso; poltrona, sofá, espelho ou planta como assunto principal; mesa cheia de objetos.

Deixe o canto inferior direito limpo e desimpedido — a marca é aplicada depois, por fora. Formato quadrado 1:1.`

    // A direção clara vale para os dois dias de porta fechada. Domingo é a barbearia em
    // repouso; segunda é a casa arrumada esperando terça — mesma luz, mesma contenção,
    // ideia diferente. O resto da semana continua no BRAND_STYLE escuro de sempre; é o
    // contraste entre os dois que o Juliano quis ver no feed.
    const isDomingo = /domingo/i.test(themeText)
    const isSegunda = /começo de semana/i.test(themeText)
    const prompt = isDomingo || isSegunda
      ? DOMINGO_STYLE.replace(
          'A IDEIA: a barbearia em repouso numa manhã de domingo. O trabalho parou. É o retrato do silêncio de um lugar que trabalhou a semana inteira.',
          isSegunda
            ? 'A IDEIA: a barbearia arrumada e pronta, esperando a semana começar. Ferramentas limpas e alinhadas, tudo no lugar. É o retrato de quem se preparou antes de abrir a porta.'
            : 'A IDEIA: a barbearia em repouso numa manhã de domingo. O trabalho parou. É o retrato do silêncio de um lugar que trabalhou a semana inteira.',
        )
      : [BRAND_STYLE, `Tema do dia: ${themeText}`].filter(Boolean).join('\n\n')
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

// v29.31.3 — escreve com esforço e NÃO aceita a primeira resposta se ela vier rasa.
// Dias de conteúdo emocional (domingo/segunda) usam o modo exigente e ganham uma segunda
// chance com aviso explícito do que deu errado — em vez de publicar texto morno.
// v29.74.0 — a revisão de qualidade passou a valer TODO dia, não só domingo/segunda: os
// rascunhos de ter-sáb saíam na primeira tentativa (esforço baixo, sem gate) e três dias
// seguidos vieram institucionais vagos, reprovados no crivo. Dia útil continua barato
// (primeira tentativa em esforço baixo); só quando cai no filtro é que paga a segunda
// tentativa em modo exigente.
async function captionComQualidade(openaiKey: string | undefined, prompt: string, emocional: boolean): Promise<string> {
  let texto = await generateCaption(openaiKey, prompt, emocional)
  if (textoRaso(texto)) {
    console.warn('[content-generate-daily] 1a versao rasa, pedindo de novo')
    const promptDuro = `${prompt}

ATENÇÃO — sua tentativa anterior foi REPROVADA por soar vazia ou institucional: clichê de cartão, elogio genérico à própria barbearia ("seu visual merece", "experiência premium", "cuidado e precisão"), repetição da palavra do dia ou lista de objetos. Recomece do zero. Abra com uma pessoa, uma cena ou um fato concreto desta barbearia, não com um elogio. Nada de frase que caberia em qualquer negócio.`
    const segunda = await generateCaption(openaiKey, promptDuro, true)
    if (!textoRaso(segunda)) texto = segunda
  }
  return texto
}

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

    // v29.31.6 — { "only_image": true } refaz SÓ a arte dos rascunhos de hoje e preserva a
    // legenda. Nasceu de um caso concreto: a frase de domingo saiu do jeito que o Juliano
    // queria ("encheu meus olhos de lágrimas") e a arte não. Regerar o dia inteiro para
    // consertar a imagem jogaria fora um texto aprovado — e texto bom é mais raro que arte boa.
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    if (body?.only_image === true) {
      const inicio = new Date(`${todaySP}T00:00:00-03:00`).toISOString()
      const { data: posts } = await admin
        .from('content_posts')
        .select('id, platform, context')
        .eq('source', 'ia')
        .gte('created_at', inicio)
      if (!posts || posts.length === 0) return json({ ok: false, message: 'Nenhum rascunho de hoje para trocar a arte.' })

      const ctx = (posts[0].context as Record<string, unknown>) || {}
      const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
      const alvo = posts.find((p) => p.platform === 'instagram') || posts[0]
      let novaArte = await generateAndUploadImage(admin, geminiKey, themeTextFor(ctx), alvo.id)
      if (!novaArte) novaArte = await generateAndUploadImage(admin, geminiKey, themeTextFor(ctx), alvo.id)
      if (!novaArte) return json({ ok: false, message: 'Gemini não devolveu imagem.' }, 502)

      for (const p of posts) {
        await admin
          .from('content_posts')
          .update({ context: { ...((p.context as Record<string, unknown>) || {}), image_url: novaArte } })
          .eq('id', p.id)
      }
      return json({ ok: true, only_image: true, image_url: novaArte, posts: posts.length })
    }
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

    // v29.74.0 — a mesma lição do domingo (v29.31.2) aplicada ao dia útil: conceito abstrato
    // vira frase de agência. Três dias seguidos de rascunho reprovado no crivo ("Seu visual
    // merece o cuidado e a precisão...") provaram que dizer o TEMA não basta — é preciso
    // dizer COMO se escreve. Regra: um fato concreto por post, voz do Juliano, zero elogio
    // genérico à própria casa.
    const VOZ_CONCRETA = `COMO ESCREVER (é isso que decide se o texto é aprovado ou reprovado na revisão): escolha UM detalhe concreto e construa o texto em volta dele — uma cena ou um fato verificável (o café servido na chegada, o horário que começa na hora que foi marcado, o espelho no final pro cliente conferir o acabamento, um cliente por vez na cadeira). Escreva como o Juliano falaria com um cliente na cadeira: simples, direto, de pessoa pra pessoa. É PROIBIDO elogiar a própria barbearia com adjetivo genérico ("seu visual/estilo merece", "cuidado e precisão", "experiência premium/única", "acabamento impecável", "atendimento de excelência", "momento de cuidado") e é PROIBIDA qualquer frase que serviria igual pra qualquer outra barbearia do Brasil — se não tem um fato concreto DESTA barbearia, reescreva antes de entregar.`

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
    // ERRO REAL cometido no primeiro post de domingo (16/08/2026): o texto fechou com "até
    // segunda 💈", mas a barbearia NÃO abre segunda — fecha domingo E segunda, reabre TERÇA.
    // Mandar o cliente na segunda é mandá-lo bater na porta fechada e gerar falsa expectativa.
    const NO_HARD_SELL = 'Hoje é DOMINGO e a barbearia está FECHADA — e segue fechada na segunda. É PROIBIDO: falar de agenda, horário, preço, promoção, ou usar CTA de venda ("agende agora", "corra", "últimas vagas"). ATENÇÃO AO DIA DE REABERTURA: a barbearia reabre na TERÇA-FEIRA. Nunca escreva "até segunda", "nos vemos segunda" nem nada que sugira atendimento na segunda — isso cria falsa expectativa e manda o cliente numa porta fechada. Se quiser fechar com assinatura leve, use "até terça 💈" ou simplesmente "bom domingo 💈". O post é sobre a PESSOA, não sobre o serviço.'

    if (dowSP === 0) {
      const semanaDoMes = Math.ceil(Number(todaySP.slice(-2)) / 7)
      // v29.31.2 — reescrito depois da crítica do Juliano ao primeiro post ("ficou pobre, não
      // emociona, não toca quem lê"). Ele estava certo: eu tinha dado CONCEITOS abstratos ao
      // modelo ("fale sobre o valor de parar") e recebi frase de cartão de banco.
      // Emoção não mora no conceito, mora na CENA CONCRETA — o cheiro do almoço, a mesa cheia,
      // o barulho da casa. Agora cada ângulo entrega cenas específicas, exemplos de tom e uma
      // lista explícita de clichês proibidos.
      const anguloDomingo = [
        'O ESFORÇO DA SEMANA, RECONHECIDO. Fale com quem trabalhou a semana inteira e chegou no domingo cansado. Reconheça o que ninguém viu: acordar cedo, resolver o que não aparece, aguentar calado. Hoje ele merece parar. Exemplo do nível esperado: "Você acordou cedo cinco dias seguidos. / Resolveu o que ninguém viu, aguentou o que ninguém soube. / Hoje não. Hoje é de ficar. / Bom domingo — você merece esse."',
        'UMA HISTÓRIA DA CADEIRA. Conte uma micro-história verdadeira do tipo que acontece numa barbearia de bairro: o pai que trouxe o filho pro primeiro corte, o rapaz que se arrumou pra entrevista, o noivo na véspera, o senhor que vem toda semana mais pela conversa. Duas ou três frases, com um detalhe humano que faça o leitor ver a cena. Exemplo do nível esperado: "Semana passada um pai trouxe o filho pro primeiro corte. / O menino chorou. O pai segurou a mão dele. / No fim, os dois se olharam no espelho e riram. / É por causa desses cinco minutos que eu abro todo dia. Bom domingo."',
        'GRATIDÃO DE QUEM COMEÇOU DO ZERO. Fale do que é ver a cadeira ocupada por gente que confia no seu trabalho, sem drama e sem se gabar. NUNCA cite data, mês, ano ou tempo de casa ("em março", "abrimos há 5 meses", "no começo do ano") — a emoção mora na memória da cadeira vazia, não no calendário, e datar o começo entrega ao cliente novo que a casa é recente. Use memória sem data: "lembro do silêncio dessa cadeira", "no começo", "quando tudo era só uma cadeira e uma ideia". Exemplo do nível esperado: "Eu ainda lembro do silêncio dessa cadeira. / Dias inteiros esperando alguém sentar. / Hoje eu perco a conta das histórias que passam por ela toda semana. / Não é sobre cabelo. É sobre confiança. Obrigado por isso."',
        'FÉ, PAZ E O QUE SE OUVE NA CADEIRA. Domingo de igreja, de família reunida, de silêncio bom. Pode partir do que as pessoas contam enquanto cortam: quem vai casar, quem vai ser pai, quem conseguiu o emprego, quem está passando por dificuldade. Deseje paz com respeito — sem pregar, sem versículo, acolhendo quem crê e quem não crê. Exemplo do nível esperado: "Tem gente que senta aqui e conta que vai casar. Outro que vai ser pai. / Um que finalmente conseguiu o emprego. / Essa cadeira já ouviu mais oração do que muita gente imagina. / Que o seu domingo seja de paz."',
      ][(semanaDoMes - 1) % 4]

      contextFact = `Tema de hoje: DOMINGO, na voz do JULIANO — o dono da Barbearia do Ju, barbeiro e farmacêutico de formação, em Bragança Paulista, que atende sozinho, um cliente por vez. IMPORTANTE: nunca revele há quanto tempo a barbearia existe, nem cite mês/ano de abertura — isso não acrescenta emoção e sinaliza casa recente para quem ainda não é cliente. Ângulo desta semana — ${anguloDomingo}

A REGRA QUE MAIS IMPORTA: o texto tem que EMOCIONAR. O leitor precisa sentir alguma coisa — reconhecimento, gratidão, saudade, orgulho, acolhimento. Se ele lê e não sente nada, o texto falhou e você tem que reescrever antes de entregar.

COMO SE CONSEGUE ISSO (e como se perde):
• Fale de GENTE, nunca de móveis. Café, sofá, televisão e almoço são cenário — cenário não emociona. Pessoa emociona: o pai, o filho, o cliente cansado, o noivo, o senhor de toda semana, VOCÊ que lê.
• Escreva em PRIMEIRA PESSOA DO SINGULAR (eu, o Juliano). Nada de "nós da Barbearia do Ju" — voz de empresa não toca ninguém.
• Traga uma VERDADE que a pessoa reconheça em si, ou uma MICRO-HISTÓRIA com um detalhe específico (o menino que chorou, a mão que segurou).
• Use CONTRASTE: a semana inteira correndo / hoje não. A cadeira vazia em março / cheia hoje.
• DÊ algo (reconhecimento, agradecimento sincero), nunca peça nada.
• Frases curtas, uma por linha, com respiro. 3 a 5 linhas no total.

PROIBIDO — se aparecer, reescreva do zero:
• Repetir "domingo" mais de duas vezes, ou terminar com "hoje ainda é domingo" / "bom domingo" quando o texto inteiro já é sobre isso (fica repetitivo e vazio).
• Enumerar objetos ("café, jogo na TV e o sofá") — isso é encher linguiça, não é conteúdo.
• Clichê de cartão: "que a semana comece leve", "disposição renovada", "novos recomeços", "energias renovadas", "recarregar as energias", "momentos especiais", "o visual em dia", "sua melhor versão", "aproveite o dia em família".
• Qualquer frase que serviria igual para uma loja de colchões, uma pizzaria ou um banco. Se serve pra qualquer negócio, não serve pra este.

${NO_HARD_SELL}`
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
      contextFact = `Campanha ativa da barbearia — use como tema central do post de hoje, escolhendo um ângulo criativo (não repita o texto da campanha ao pé da letra): ${String(campaign.content).slice(0, 600)}. Use apenas preços e datas que estão descritos aí em cima — não invente. ${VOZ_CONCRETA} ${NO_AGENDA_TALK}`
      context = { tipo: 'campanha', campanha: campaign.title }
    } else {
      // Sem campanha: rotação de temas positivos pra não repetir o mesmo post toda manhã.
      const dayNumber = Number(todaySP.slice(-2))
      const rotation = dayNumber % 3
      if (rotation === 0) {
        // v29.78.0 — "exclusividade de fato" entrou na lista (26/08, insight de um cliente
        // diretor de escola: é o oceano azul da casa). REGRA: descrever o fato, nunca usar
        // "exclusivo/premium" como adjetivo (segue proibido).
        contextFact = `Tema de hoje: a EXPERIÊNCIA real de ser atendido na Barbearia do Ju — escolha 1 (no máximo 2) destes fatos verdadeiros e construa o texto NELE, sem listar os outros: a barbearia inteira é sua na sua hora (um barbeiro, um cliente por vez — você chega no seu horário e o Juliano está pronto te esperando, e a conversa na cadeira não tem plateia); café na chegada; atendimento com hora marcada respeitada (sem fila e sem espera); atendimento sem pressa; ambiente climatizado; cartão fidelidade (a cada 10 cortes, 1 é grátis). ATENÇÃO: nunca escreva a palavra "exclusivo/exclusividade" como elogio — descreva o fato ("um cliente por vez", "ninguém entra no seu horário"). ${VOZ_CONCRETA} ${NO_AGENDA_TALK}`
        context = { tipo: 'experiencia' }
      } else if (rotation === 1) {
        contextFact = `Tema de hoje: o CARTÃO FIDELIDADE da Barbearia do Ju — a cada 10 cortes, 1 é grátis, e todo corte conta automaticamente, sem precisar carimbar nada. ${VOZ_CONCRETA} ${NO_AGENDA_TALK}`
        context = { tipo: 'fidelidade' }
      } else {
        const { data: featuredRows } = await admin.rpc('pick_featured_service')
        const featured = Array.isArray(featuredRows) ? featuredRows[0] : featuredRows
        if (featured) {
          const priceLabel = Number(featured.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          contextFact = `Tema de hoje: destaque o serviço "${featured.name}" (R$${priceLabel}, ${featured.duration_minutes} minutos) — o que acontece nesse atendimento, pra quem ele é, por que vale a pena. Descreva o serviço de verdade (gesto, etapa, resultado), não um elogio a ele. ${VOZ_CONCRETA} ${NO_AGENDA_TALK}`
          context = { tipo: 'servico_destaque', servico: featured.name, preco: featured.price, duracao_minutos: featured.duration_minutes }
        } else {
          contextFact = `Tema de hoje: a EXPERIÊNCIA real de ser atendido na Barbearia do Ju — escolha 1 (no máximo 2) destes fatos verdadeiros e construa o texto NELE: a barbearia inteira é sua na sua hora (um barbeiro, um cliente por vez, o Juliano pronto te esperando, conversa sem plateia), café na chegada, hora marcada respeitada, atendimento sem pressa, ambiente climatizado. Nunca use "exclusivo/exclusividade" como elogio — descreva o fato. ${VOZ_CONCRETA} ${NO_AGENDA_TALK}`
          context = { tipo: 'experiencia' }
        }
      }
    }

    // Domingo e segunda são os dias de conteúdo emocional (a barbearia está fechada e o post
    // constrói marca, não vende) — vale o custo de gerar com mais esforço e revisar.
    const diaEmocional = context.tipo === 'domingo' || context.tipo === 'segunda'
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
        '🙏 Bom domingo! Que hoje seja de descanso, mesa cheia e tempo com quem a gente ama. até terça 💈',
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
      const caption = withBookingLink(safeCaption(await captionComQualidade(openaiKey, prompt, diaEmocional), fallbackCaption, 'whatsapp_business'), 'whatsapp_status', diaEmocional)
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
      const caption = withBookingLink(safeCaption(await captionComQualidade(openaiKey, prompt, diaEmocional), fallbackCaptionFacebook, 'facebook'), 'facebook', diaEmocional)
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
      // v29.31.7 — marcação do Juliano e da Nicole em toda legenda do Instagram (pedido dele,
      // 16/08/2026): eles repostam no story e o post alcança duas redes pessoais além da
      // barbearia. Só no Instagram — @ de Instagram não vira link no Facebook nem no Status.
      // Vai numa linha separada, depois de uma linha em branco, para não atropelar o texto.
      const caption = comMarcacoes(stripSiteUrls(safeCaption(await captionComQualidade(openaiKey, prompt, diaEmocional), fallbackCaptionInstagram, 'instagram')))
      const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
      const themeText = themeTextFor(context, campaign ? String(campaign.content) : '')
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
