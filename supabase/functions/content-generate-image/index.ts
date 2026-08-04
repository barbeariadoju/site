import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Modelo "Nano Banana" — confirmado ativo em 2026-08, aposentadoria anunciada pra
// 02/10/2026. Se essa function começar a falhar depois dessa data, trocar pra
// gemini-3.1-flash-image (sucessor, mesmo formato de chamada REST).
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'

const BRAND_STYLE = `Fotografia realista e sofisticada para a Barbearia do Ju, barbearia premium de bairro em Bragança Paulista/SP. Paleta visual: dourado (#c89b55) e preto, iluminação de estúdio quente, estética masculina clássica com toque moderno. Sem nenhum texto, letra, número ou logotipo sobreposto na imagem. Nunca gerar rosto de pessoa real/reconhecível nem simular um cliente real — mostrar apenas ambiente, produtos, texturas, detalhes de barbearia (navalha, pente, toalha quente, poltrona, espelho, luz), mãos anônimas trabalhando, ou composições sem rosto em primeiro plano.`

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
    console.error('[content-generate-image] referencia', error instanceof Error ? error.message : error)
    return null
  }
}

// Central de Marketing — Fase 2 (v28.49.0): gera a arte de um rascunho de content_posts
// via Gemini (imagem), sobe pro bucket público content-images e grava a URL em
// context.image_url (mesmo campo que content-publish-meta já lê pra publicar/prévia).
// Nunca publica nada sozinho — só prepara a arte pro Juliano revisar no admin antes de
// aprovar, mesmo princípio de toda a Central de Conteúdo.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const anonKey = requiredSecret('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
    const geminiKey = requiredSecret('GEMINI_API_KEY')

    const authHeader = request.headers.get('Authorization') || ''
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData?.user) return json({ error: 'Não autenticado.' }, 401)
    const { data: isAdminResult } = await userClient.rpc('is_admin')
    if (!isAdminResult) return json({ error: 'Acesso restrito ao administrador.' }, 403)

    const body = await request.json().catch(() => ({}))
    const id = String(body?.id || '')
    const extraPrompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!id) return json({ error: 'id é obrigatório.' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: post, error: fetchError } = await admin.from('content_posts').select('*').eq('id', id).maybeSingle()
    if (fetchError || !post) return json({ error: 'Rascunho não encontrado.' }, 404)

    const isStory = post.platform === 'facebook_story' || post.platform === 'instagram_story'
    const formatHint = isStory
      ? 'Formato vertical de Story, proporção 9:16 (retrato), composição pensada pra ocupar a tela cheia de um celular.'
      : 'Formato quadrado, proporção 1:1, composição centrada pra funcionar como post de feed.'

    const contextTheme = post.context?.tipo === 'servico_destaque'
      ? `Tema do dia: destaque para o serviço "${post.context.servico}" — sugerir a atmosfera desse tipo de atendimento sem escrever o nome/preço na imagem.`
      : post.context?.tipo === 'vaga_aberta'
      ? 'Tema do dia: convite pra agendar um horário — transmitir acolhimento e disponibilidade sem texto na imagem.'
      : `Tema do dia, baseado na legenda deste post: "${String(post.caption || '').slice(0, 200)}"`

    const reference = await fetchReferenceImage()
    const prompt = [BRAND_STYLE, reference ? REFERENCE_INSTRUCTION : '', formatHint, contextTheme, extraPrompt].filter(Boolean).join('\n\n')
    const requestParts: unknown[] = [{ text: prompt }]
    if (reference) requestParts.push({ inline_data: { mime_type: reference.mimeType, data: reference.data } })

    const geminiResponse = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: requestParts }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
      45000,
    )
    const geminiData = await geminiResponse.json().catch(() => ({}))
    if (!geminiResponse.ok) {
      console.error('[content-generate-image] gemini error', geminiResponse.status, JSON.stringify(geminiData).slice(0, 500))
      return json({ error: geminiData?.error?.message || 'Falha ao gerar a imagem no Gemini.' }, 502)
    }

    const parts = geminiData?.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data)
    const base64Data = imagePart?.inlineData?.data || imagePart?.inline_data?.data
    if (!base64Data) {
      console.error('[content-generate-image] sem imagem na resposta', JSON.stringify(geminiData).slice(0, 500))
      return json({ error: 'O Gemini não devolveu nenhuma imagem (pode ter recusado o prompt).' }, 502)
    }

    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
    const path = `${post.platform}/${id}-${Date.now()}.png`
    const { error: uploadError } = await admin.storage.from('content-images').upload(path, bytes, {
      contentType: 'image/png',
      upsert: true,
    })
    if (uploadError) {
      console.error('[content-generate-image] upload', uploadError)
      return json({ error: 'Falha ao salvar a imagem gerada.' }, 500)
    }
    const { data: publicUrlData } = admin.storage.from('content-images').getPublicUrl(path)
    const imageUrl = publicUrlData.publicUrl

    const newContext = { ...(post.context || {}), image_url: imageUrl }
    const { error: updateError } = await admin.from('content_posts').update({ context: newContext }).eq('id', id)
    if (updateError) {
      console.error('[content-generate-image] update', updateError)
      return json({ error: 'Imagem gerada mas falhou ao salvar no post.' }, 500)
    }

    return json({ ok: true, image_url: imageUrl })
  } catch (error) {
    console.error('[content-generate-image]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
