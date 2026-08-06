import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tool-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 45000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

// Veo 3.1 Lite — variante mais barata (US$ 0,05/s em 720p, ~US$ 0,40 num vídeo de 8s).
// Escolhida pelo Juliano em 06/08/2026: as redes recomprimem o vídeo de qualquer jeito,
// então 720p não muda o resultado percebido no Reel/Status. Se a qualidade decepcionar,
// trocar por veo-3.1-fast-generate-preview (dobro do preço) — mesmo formato de chamada.
const VEO_MODEL = 'veo-3.1-lite-generate-preview'

// A API de vídeo NÃO tem camada gratuita: toda geração bem-sucedida é cobrada. O Google
// só cobra quando o vídeo sai — recusa por política ou erro não gera custo.
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const REFERENCE_ENV = 'ia-referencia/interior-1.jpeg'
const REFERENCE_JULIANO = 'juliano-corte.jpg'

// Mesma restrição que já vale pra imagem (ver content-generate-image): a loja tem UMA
// cadeira só e o barbeiro é uma pessoa real. Sem isso o modelo inventa uma segunda
// cadeira e troca o barbeiro por um genérico.
// v2 do prompt (06/08/2026), depois do 1º vídeo real: o Juliano apontou que o barbeiro
// "limpava a máquina na capa de proteção do cliente" — gesto que nenhum profissional faz.
// Descrever só a cena não basta: o modelo preenche as lacunas com gestos inventados, então
// o prompt precisa dizer explicitamente o que É comportamento correto de barbeiro e listar
// o que NÃO pode acontecer.
const DEFAULT_PROMPT = [
  'Continue a cena da foto em câmera lenta, mantendo o mesmo ambiente, o mesmo barbeiro e o mesmo enquadramento.',
  'O barbeiro trabalha com gestos profissionais, calmos e realistas: apoia o pente na nuca do cliente e passa a máquina rente ao pente em movimentos curtos e firmes de baixo para cima, afastando levemente a máquina no fim de cada passada.',
  'Comportamento obrigatório: movimentos precisos e naturais de um barbeiro experiente, postura estável, olhar concentrado no corte.',
  'NUNCA faça o barbeiro limpar, bater, esfregar ou apoiar a máquina na capa de proteção, na roupa ou no corpo do cliente.',
  'Não faça gestos bruscos, aleatórios, repetitivos demais nem movimentos que um barbeiro real não faria.',
  // v3: no vídeo anterior o "pai" ficou congelado na mesma pose sorrindo os 8s inteiros —
  // o ponto mais artificial da peça. Pedir reação VARIADA e descrever os micro-movimentos
  // resolve; "observa com orgulho" sozinho o modelo interpreta como estátua.
  'Um segundo homem adulto, mais velho e grisalho, está de pé ao lado observando com orgulho: ele acompanha o corte com o olhar, assente levemente com a cabeça e muda de expressão de forma natural ao longo da cena, nunca ficando parado na mesma pose.',
  // v3: o bordado do avental saiu com letras deformadas ("RBEARIA"). Texto é o ponto fraco
  // conhecido de vídeo por IA — a defesa é manter o logotipo longe do centro e sem close.
  'Mantenha o avental preto estável, sem aproximar a câmera do bordado e sem deformar nenhuma letra do logotipo.',
  'Não adicione, remova nem duplique móveis: esta loja tem APENAS 1 (uma) cadeira de barbeiro.',
  'Iluminação quente e dourada, clima acolhedor de família. Sem nenhum texto sobreposto na imagem.',
].join(' ')

async function fetchImageAsBase64(file: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const r = await fetch(`https://www.barbeariadoju.com.br/assets/${file}`)
    if (!r.ok) return null
    const buffer = await r.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return { mimeType: 'image/jpeg', data: btoa(binary) }
  } catch (error) {
    console.error('[content-generate-video] referencia', error instanceof Error ? error.message : error)
    return null
  }
}

// Autoriza por sessão de admin (uso normal, pelo painel) OU por token interno de
// ferramenta, usado quando a geração é disparada de fora do navegador. O token vive no
// secret VIDEO_TOOL_TOKEN e só existe enquanto for necessário.
async function authorize(request: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const toolToken = Deno.env.get('VIDEO_TOOL_TOKEN')?.trim()
  const sent = request.headers.get('x-tool-token')?.trim()
  if (toolToken && sent && sent === toolToken) return null

  const authHeader = request.headers.get('Authorization') || ''
  if (!authHeader) return 'Não autenticado.'
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData?.user) return 'Não autenticado.'
  const { data: isAdminResult } = await userClient.rpc('is_admin')
  if (!isAdminResult) return 'Acesso restrito ao administrador.'
  return null
}

// Geração de vídeo é uma operação longa (1-3 min) — mais que o tempo de vida confortável
// de uma requisição. Por isso a function tem dois passos: 'start' devolve o nome da
// operação e 'status' consulta até ficar pronta, baixa o mp4 e hospeda no bucket público
// (mesmo bucket da imagem), devolvendo a URL que o admin já sabe publicar.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const anonKey = requiredSecret('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
    const geminiKey = requiredSecret('GEMINI_API_KEY')

    const denied = await authorize(request, supabaseUrl, anonKey)
    if (denied) return json({ error: denied }, denied === 'Não autenticado.' ? 401 : 403)

    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || 'start')
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

    if (action === 'start') {
      const prompt = typeof body?.prompt === 'string' && body.prompt.trim() ? body.prompt.trim() : DEFAULT_PROMPT
      const aspectRatio = body?.aspectRatio === '16:9' ? '16:9' : '9:16'
      // Precisa ser número — a API recusa string com 400 explícito.
      const durationSeconds = Number(body?.durationSeconds) || 8

      // O Veo 3.1 Lite NÃO aceita `referenceImages` (a API responde 400 explícito) — só
      // aceita UMA imagem, como primeiro quadro do vídeo. Isso acabou sendo melhor pro
      // nosso caso: `juliano-corte.jpg` já mostra o barbeiro real trabalhando dentro da
      // loja real, então partir dela garante cenário E barbeiro corretos de uma vez, sem
      // depender do modelo obedecer a descrição textual.
      // O Veo herda a proporção da IMAGEM, ignorando o aspectRatio pedido: como
      // `juliano-corte.jpg` é quadrada, o 1º vídeo saiu com 720x720 úteis e tarja preta de
      // 280px em cima e embaixo — inútil como Reel. Por isso o quadro inicial pode vir
      // pronto em 9:16 via `imageBase64` (recortado fora daqui) em vez do arquivo do site.
      const inlineImage = typeof body?.imageBase64 === 'string' && body.imageBase64.trim() ? body.imageBase64.trim() : ''
      const firstFrameFile = typeof body?.image === 'string' && body.image.trim() ? body.image.trim() : REFERENCE_JULIANO
      const firstFrame = inlineImage
        ? { mimeType: String(body?.imageMimeType || 'image/jpeg'), data: inlineImage }
        : await fetchImageAsBase64(firstFrameFile)
      if (!firstFrame) return json({ error: `Não consegui baixar a foto de referência (${firstFrameFile}).` }, 502)

      const startResponse = await fetchWithTimeout(
        `${GEMINI_BASE}/models/${VEO_MODEL}:predictLongRunning`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            // `:predictLongRunning` usa o formato estilo Vertex (bytesBase64Encoded), não
            // o `inlineData` do generateContent — a API recusa inlineData com 400.
            instances: [{ prompt, image: { bytesBase64Encoded: firstFrame.data, mimeType: firstFrame.mimeType } }],
            // `generateAudio` NÃO é aceito por este modelo (400 explícito): o Veo Lite
            // sempre devolve uma faixa de áudio inventada. Como ninguém revisou esse som,
            // ele é removido depois do download (ffmpeg -an) antes de qualquer publicação —
            // a trilha certa é escolhida dentro do Instagram na hora de postar.
            parameters: { aspectRatio, resolution: '720p', durationSeconds },
          }),
        },
        60000,
      )
      const startData = await startResponse.json().catch(() => ({}))
      if (!startResponse.ok || !startData?.name) {
        console.error('[content-generate-video] start', startResponse.status, JSON.stringify(startData).slice(0, 700))
        return json({ error: startData?.error?.message || 'Falha ao iniciar a geração do vídeo.', status: startResponse.status }, 502)
      }
      return json({ ok: true, operation: startData.name })
    }

    if (action === 'status') {
      const operation = String(body?.operation || '')
      const id = String(body?.id || '')
      if (!operation) return json({ error: 'operation é obrigatório.' }, 400)

      const opResponse = await fetchWithTimeout(`${GEMINI_BASE}/${operation}`, {
        method: 'GET',
        headers: { 'x-goog-api-key': geminiKey },
      }, 30000)
      const opData = await opResponse.json().catch(() => ({}))
      if (!opResponse.ok) {
        console.error('[content-generate-video] status', opResponse.status, JSON.stringify(opData).slice(0, 700))
        return json({ error: opData?.error?.message || 'Falha ao consultar a operação.' }, 502)
      }
      if (!opData?.done) return json({ ok: true, done: false })
      if (opData?.error) return json({ error: opData.error?.message || 'O Gemini recusou ou falhou ao gerar o vídeo.', done: true }, 502)

      const sample = opData?.response?.generateVideoResponse?.generatedSamples?.[0]
        || opData?.response?.generatedSamples?.[0]
      const videoUri = sample?.video?.uri || sample?.video?.videoUri
      if (!videoUri) {
        console.error('[content-generate-video] sem uri', JSON.stringify(opData).slice(0, 700))
        return json({ error: 'A operação terminou sem devolver nenhum vídeo.', done: true }, 502)
      }

      // O arquivo só é acessível com a chave — baixar aqui dentro e reservir pelo bucket
      // público é o que torna a URL utilizável pela Meta/Evolution na hora de publicar.
      const fileResponse = await fetchWithTimeout(videoUri, { headers: { 'x-goog-api-key': geminiKey } }, 120000)
      if (!fileResponse.ok) {
        console.error('[content-generate-video] download', fileResponse.status)
        return json({ error: 'Vídeo gerado, mas falhou o download do arquivo.' }, 502)
      }
      const bytes = new Uint8Array(await fileResponse.arrayBuffer())

      const path = `videos/${id || 'avulso'}-${Date.now()}.mp4`
      const { error: uploadError } = await admin.storage.from('content-images').upload(path, bytes, {
        contentType: 'video/mp4',
        upsert: true,
      })
      if (uploadError) {
        console.error('[content-generate-video] upload', uploadError)
        return json({ error: 'Falha ao salvar o vídeo gerado.' }, 500)
      }
      const { data: publicUrlData } = admin.storage.from('content-images').getPublicUrl(path)
      const videoUrl = publicUrlData.publicUrl

      if (id) {
        const { data: post } = await admin.from('content_posts').select('context').eq('id', id).maybeSingle()
        if (post) {
          const newContext = { ...(post.context || {}), video_url: videoUrl }
          await admin.from('content_posts').update({ context: newContext }).eq('id', id)
        }
      }

      return json({ ok: true, done: true, video_url: videoUrl, size_bytes: bytes.length })
    }

    // Claude consegue VER o vídeo (extraindo quadros com ffmpeg), mas não consegue ouvir.
    // Como nenhuma peça pode ir pro ar sem revisão de verdade, esta action manda o arquivo
    // pro Gemini e pergunta o que há na trilha — é o jeito de auditar o áudio antes de
    // decidir se ele é aproveitável ou se tem que ser descartado.
    if (action === 'describe') {
      const videoBase64 = String(body?.videoBase64 || '')
      if (!videoBase64) return json({ error: 'videoBase64 é obrigatório.' }, 400)
      const question = String(body?.question || 'Descreva em detalhes APENAS o áudio deste vídeo: que sons existem, se há vozes ou fala (e em que idioma), se há música, e se algum som soa estranho, artificial ou desagradável. Responda em português.')

      const r = await fetchWithTimeout(
        // gemini-2.5-flash foi descontinuado pra novos usuários (erro explícito da API).
        `${GEMINI_BASE}/models/${Deno.env.get('GEMINI_ANALYSIS_MODEL')?.trim() || 'gemini-3.6-flash'}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: question }, { inline_data: { mime_type: 'video/mp4', data: videoBase64 } }] }],
          }),
        },
        120000,
      )
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        console.error('[content-generate-video] describe', r.status, JSON.stringify(d).slice(0, 500))
        return json({ error: d?.error?.message || 'Falha ao analisar o vídeo.' }, 502)
      }
      const text = d?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') || ''
      return json({ ok: true, description: text })
    }

    // O vídeo que vai pro ar não é o bruto do Veo: passa por tratamento local (remoção de
    // defeito, normalização de volume, fade). Esta action hospeda esse arquivo final e,
    // se vier `id`, aponta o rascunho pra ele.
    if (action === 'upload') {
      const videoBase64 = String(body?.videoBase64 || '')
      const id = String(body?.id || '')
      if (!videoBase64) return json({ error: 'videoBase64 é obrigatório.' }, 400)

      const bytes = Uint8Array.from(atob(videoBase64), (c) => c.charCodeAt(0))
      const path = `videos/${id || 'final'}-${Date.now()}.mp4`
      const { error: uploadError } = await admin.storage.from('content-images').upload(path, bytes, {
        contentType: 'video/mp4',
        upsert: true,
      })
      if (uploadError) {
        console.error('[content-generate-video] upload final', uploadError)
        return json({ error: 'Falha ao salvar o vídeo.' }, 500)
      }
      const { data: publicUrlData } = admin.storage.from('content-images').getPublicUrl(path)
      const videoUrl = publicUrlData.publicUrl

      if (id) {
        const { data: post } = await admin.from('content_posts').select('context').eq('id', id).maybeSingle()
        if (post) {
          const newContext = { ...(post.context || {}), video_url: videoUrl }
          await admin.from('content_posts').update({ context: newContext }).eq('id', id)
        }
      }
      return json({ ok: true, video_url: videoUrl, size_bytes: bytes.length })
    }

    // Geração de IMAGEM fora do painel. A `content-generate-image` exige sessão de admin
    // no navegador, então quando a arte precisa ser produzida e REVISADA antes de virar
    // rascunho (regra: nada vai pra Central sem passar pelo crivo), ela é gerada por aqui.
    // Mesmas referências reais e mesmas restrições da function original.
    if (action === 'image') {
      const id = String(body?.id || '')
      const extra = String(body?.prompt || '')
      const isStory = body?.story === true

      // Atalho: hospedar uma arte pronta (ex.: um quadro extraído de um vídeo já aprovado)
      // sem gerar nada novo — evita gastar geração quando o ativo bom já existe.
      const ready = String(body?.rawBase64 || '')
      if (ready) {
        const rb = Uint8Array.from(atob(ready), (c) => c.charCodeAt(0))
        const rp = `${id || 'arte'}/${Date.now()}.jpg`
        const { error: rErr } = await admin.storage.from('content-images').upload(rp, rb, { contentType: 'image/jpeg', upsert: true })
        if (rErr) return json({ error: 'Falha ao salvar a arte.' }, 500)
        const { data: rpu } = admin.storage.from('content-images').getPublicUrl(rp)
        if (id) {
          const { data: post } = await admin.from('content_posts').select('context').eq('id', id).maybeSingle()
          if (post) await admin.from('content_posts').update({ context: { ...(post.context || {}), image_url: rpu.publicUrl } }).eq('id', id)
        }
        return json({ ok: true, image_url: rpu.publicUrl })
      }

      const brand = 'Fotografia realista e sofisticada para a Barbearia do Ju, barbearia premium de bairro em Bragança Paulista/SP. Paleta dourada (#c89b55) e preta, iluminação quente, estética masculina clássica. Sem nenhum texto, letra, número ou logotipo sobreposto na imagem.'
      const refInstruction = 'As duas fotos anexadas são reais. A primeira é o ambiente real da Barbearia do Ju — EDITE exatamente essa foto: NÃO adicione, remova, duplique ou reposicione nenhum móvel, cadeira, poltrona, espelho, sofá ou objeto. IMPORTANTE: esta loja tem APENAS 1 (UMA) cadeira de barbeiro — nunca gere uma segunda estação de atendimento nem uma segunda pessoa sendo atendida ao mesmo tempo. A segunda foto mostra o rosto e a aparência real do Juliano, o barbeiro da loja — se a cena incluir o barbeiro, ele precisa ter a mesma aparência (mesmo rosto, cabelo e barba). Clientes são sempre fictícios e genéricos, com corpo inteiro visível, nunca partes cortadas ou flutuando.'
      const formatHint = isStory
        ? 'Formato vertical de Story, proporção 9:16 (retrato), composição ocupando a tela cheia de um celular, com espaço livre na parte superior e inferior para textos e figurinhas.'
        : 'Formato quadrado, proporção 1:1, composição centrada para post de feed.'

      const [amb, jul] = await Promise.all([fetchImageAsBase64(REFERENCE_ENV), fetchImageAsBase64(REFERENCE_JULIANO)])
      const parts: unknown[] = [{ text: [brand, amb ? refInstruction : '', formatHint, extra].filter(Boolean).join('\n\n') }]
      if (amb) parts.push({ inline_data: { mime_type: amb.mimeType, data: amb.data } })
      if (amb && jul) parts.push({ inline_data: { mime_type: jul.mimeType, data: jul.data } })

      const r = await fetchWithTimeout(
        `${GEMINI_BASE}/models/${Deno.env.get('GEMINI_IMAGE_MODEL')?.trim() || 'gemini-2.5-flash-image'}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } }),
        },
        60000,
      )
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        console.error('[content-generate-video] image', r.status, JSON.stringify(d).slice(0, 500))
        return json({ error: d?.error?.message || 'Falha ao gerar a imagem.' }, 502)
      }
      const p = d?.candidates?.[0]?.content?.parts || []
      const imgPart = p.find((x: any) => x?.inlineData?.data || x?.inline_data?.data)
      const b64 = imgPart?.inlineData?.data || imgPart?.inline_data?.data
      if (!b64) return json({ error: 'O Gemini não devolveu imagem (pode ter recusado o prompt).' }, 502)

      // Devolve em base64 de propósito: a arte é inspecionada antes de ser hospedada, e só
      // vira rascunho depois de aprovada — hospedar aqui puxaria peça não revisada pro ar.
      if (body?.upload !== true) return json({ ok: true, image_base64: b64 })

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const path = `${id || 'arte'}/${Date.now()}.png`
      const { error: upErr } = await admin.storage.from('content-images').upload(path, bytes, { contentType: 'image/png', upsert: true })
      if (upErr) return json({ error: 'Falha ao salvar a imagem.' }, 500)
      const { data: pu } = admin.storage.from('content-images').getPublicUrl(path)
      if (id) {
        const { data: post } = await admin.from('content_posts').select('context').eq('id', id).maybeSingle()
        if (post) await admin.from('content_posts').update({ context: { ...(post.context || {}), image_url: pu.publicUrl } }).eq('id', id)
      }
      return json({ ok: true, image_url: pu.publicUrl })
    }

    return json({ error: 'action inválida (use start, status, describe, upload ou image).' }, 400)
  } catch (error) {
    console.error('[content-generate-video]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
