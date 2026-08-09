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

// v29.6.0 (08/08/2026) — MUDANÇA DE DIREÇÃO, e vale saber o porquê antes de mexer aqui.
//
// Até a v28.53.2 este prompt tentava fazer a IA recriar a barbearia real e o próprio
// Juliano, anexando a foto do salão e a foto do rosto dele como referência. Isso nasceu
// de um problema real ("o barbeiro gerado não se parecia com ele"), mas a solução não
// funciona: modelo de imagem não mantém identidade entre gerações. Cada peça saía com um
// rosto um pouco diferente, e o Juliano confirmou isso na prática.
//
// A decisão de 08/08/2026 foi parar de tentar: PESSOA E AMBIENTE = FOTO REAL, tirada no
// celular. IA = só o que não tem rosto nem cômodo. O site inteiro é construído sobre o
// Juliano ser uma pessoa real (formação, 69 avaliações assinadas) — publicar um "quase
// ele" toda semana corrói justamente esse ativo.
//
// Por isso não há mais foto de referência: o pedido é 100% texto e só produz still life.
const BRAND_STYLE = `Imagem para o Instagram da Barbearia do Ju, barbearia de bairro em Bragança Paulista/SP.

ESTILO: fotografia de produto / still life editorial. Fundo preto quente (#080808), iluminação lateral dura vindo de uma única fonte, sombras profundas e definidas, reflexos metálicos dourados (#c89b55). Textura de grão fino de filme. Alto contraste. Clima sofisticado, masculino, silencioso.

MATERIAIS PERMITIDOS: couro escuro, madeira escura, latão e metal escovado, mármore preto, tecido de barbeiro, vidro âmbar, navalha fechada, pente, tesoura, toalha dobrada, pincel de barba, frascos de produto.

PROIBIDO — não gere em nenhuma hipótese: pessoas, rostos, mãos, corpos ou silhuetas humanas; interior ou fachada de barbearia reconhecível; cadeira de barbeiro dentro de um ambiente; qualquer texto, letra, número, logotipo ou marca d'água na imagem; estética de banco de imagens.

O texto da peça é aplicado depois, fora da imagem — deixe espaço negativo generoso e limpo para isso.`

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

    // v29.6.0 — sem fotos de referência. Ver comentário do BRAND_STYLE: mandar a foto do
    // salão e do rosto do Juliano era a tentativa de fazer a IA "acertar" a barbearia, e
    // ela não acerta. Agora o pedido é 100% texto e só produz peça de marca sem gente.
    const prompt = [BRAND_STYLE, formatHint, contextTheme, extraPrompt].filter(Boolean).join('\n\n')
    const requestParts: unknown[] = [{ text: prompt }]

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
