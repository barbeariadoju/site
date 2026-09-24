// v29.233.0 — Clube do Ju: a function pública da assinatura (página /clube/ e /clube/minha-assinatura/).
//
//   POST {action:'planos'}                        → planos, preços, vagas, horários da Cadeira Cativa, contrato
//   POST {action:'cotar', itens, visitas}         → mensalidade do Sob Medida (o servidor é quem calcula)
//   POST {action:'enviar_codigo', telefone}       → código de 6 dígitos no WhatsApp (confirma o telefone)
//   POST {action:'assinar', ...}                  → cria a assinatura, registra o aceite e devolve o link de pagamento
//   POST {action:'status', c, t}                  → resumo da assinatura (c = código, t = token do link)
//   POST {action:'pagar', c, t}                   → link de pagamento da cobrança em aberto (gera outro se venceu)
//   POST {action:'cancelar', c, t, motivo}        → desistência (até 7 dias) ou cancelamento no fim do ciclo
//   POST {action:'lista_espera', nome, telefone, plano}
//
// Nada aqui confia no navegador: preço, vagas, horário da Cativa e versão do contrato são conferidos no
// servidor. O aceite guarda data, IP, navegador, telefone confirmado, versão e hash do texto (contrato,
// cláusula 13). Anti-abuso do código: 3 por telefone por hora, 60 s entre pedidos, 10 por IP por hora,
// 5 tentativas por código, validade de 10 minutos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  TERMS_VERSION, TERMS_URL, TERMS_TXT_URL, TERMS_SHA256, SOB_MEDIDA_SERVICOS, SOB_MEDIDA_VISITAS, SOB_MEDIDA_TABELA_MINIMA,
  faixaDesconto, mensalidade, textoCodigo, textoLinkPagamento, textoCancelamento, textoArrependimento, DIAS_SEMANA_PT, money,
} from '../_shared/clube-regras.ts'
import {
  digitsOf, sha256, hojeSP, criarCheckoutClube, enviarWhats, pushJuliano, linkGerenciar, tokenDoCodigo,
} from '../_shared/clube-pagbank.ts'
import { normalizeServiceSet } from '../_shared/service-rules.ts'

const ALLOWED_ORIGINS = new Set(['https://www.barbeariadoju.com.br', 'https://barbeariadoju.com.br', 'http://127.0.0.1:8090', 'http://localhost:8090'])
let requestOrigin: string | null = null
const corsHeaders = () => ({
  'Access-Control-Allow-Origin': requestOrigin && ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : 'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders() })

const phoneKeyOf = (s: unknown) => { const d = digitsOf(s); return d.length >= 10 && d.length <= 13 ? d.slice(-8) : '' }
const telefoneValido = (d: string) => (d.length === 10 || d.length === 11) || ((d.length === 12 || d.length === 13) && d.startsWith('55'))
const randomCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
const codigoAssinatura = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'CJ-' + Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => abc[b % abc.length]).join('')
}
const ipDe = (req: Request) => String(req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64)

Deno.serve(async (req: Request) => {
  requestOrigin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!Deno.env.get('CLUBE_TOKEN_SECRET')) return json({ error: 'Clube indisponível no momento.' }, 503)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim()
  const pepper = Deno.env.get('CLUBE_TOKEN_SECRET')!

  // Data de tabela: os preços do Clube são os da tabela de 01/10/2026 em diante.
  const dataTabela = () => { const h = hojeSP(); return h < '2026-10-01' ? '2026-10-01' : h }
  const precosSobMedida = async () => {
    const d = dataTabela()
    const out: { name: string; price: number }[] = []
    for (const name of SOB_MEDIDA_SERVICOS) {
      const { data } = await admin.rpc('club_item_price', { p_item: name, p_date: d })
      const price = Number(data || 0)
      if (price > 0) out.push({ name, price })
    }
    return out
  }
  const cotarSobMedida = async (itensRaw: unknown, visitasRaw: unknown) => {
    const itens = Array.isArray(itensRaw) ? itensRaw.map((x) => String(x || '').trim()).filter(Boolean) : []
    const visitas = Math.floor(Number(visitasRaw))
    if (!itens.length) return { error: 'Escolha pelo menos um serviço.' }
    if (!Number.isFinite(visitas) || visitas < SOB_MEDIDA_VISITAS.min || visitas > SOB_MEDIDA_VISITAS.max) return { error: `Escolha de ${SOB_MEDIDA_VISITAS.min} a ${SOB_MEDIDA_VISITAS.max} visitas por mês.` }
    if (itens.some((i) => !SOB_MEDIDA_SERVICOS.includes(i)) || new Set(itens).size !== itens.length) return { error: 'Serviço inválido para o Sob Medida.' }
    const norm = normalizeServiceSet(itens)
    if (norm.removed.length) return { error: 'Cada visita pode ter só 1 corte e 1 barba. O combo já inclui os dois.' }
    const tabela = await precosSobMedida()
    const porVisita = itens.reduce((a, i) => a + (tabela.find((t) => t.name === i)?.price || 0), 0)
    const tabelaMensal = Math.round(porVisita * visitas * 100) / 100
    if (tabelaMensal < SOB_MEDIDA_TABELA_MINIMA) return { error: `O Sob Medida começa em ${money(SOB_MEDIDA_TABELA_MINIMA)} de tabela por mês. Aumente as visitas ou os serviços.` }
    return { itens, visitas, porVisita, tabelaMensal, pct: faixaDesconto(tabelaMensal), preco: mensalidade(tabelaMensal) }
  }
  const acharPorLink = async () => {
    const code = String(body?.c || '').trim().toUpperCase()
    const t = String(body?.t || '').trim()
    if (!/^CJ-[A-Z0-9]{6}$/.test(code) || !/^[0-9a-f]{40}$/.test(t)) return null
    if (t !== await tokenDoCodigo(code)) return null
    const { data } = await admin.from('club_subscriptions').select('*').eq('code', code).maybeSingle()
    return data
  }

  try {
    if (action === 'planos') {
      const [{ data: planos }, { data: vagas }, sob] = await Promise.all([
        admin.from('club_plans').select('id,name,summary,kind,visit_items,visits_per_cycle,extras_per_cycle,table_value,price,discount_pct,pool,sort').eq('active', true).order('sort'),
        admin.rpc('club_vagas'),
        precosSobMedida(),
      ])
      const livresCativa = (vagas || []).find((v: { pool: string }) => v.pool === 'cativa')?.livres || 0
      let cativa: { weekday: number; time: string }[] = []
      if (livresCativa > 0) {
        const { data: slots } = await admin.rpc('club_cativa_slots')
        cativa = (slots || []).map((s: { weekday: number; slot_time: string }) => ({ weekday: s.weekday, time: String(s.slot_time).slice(0, 5) }))
      }
      return json({
        ok: true, planos: planos || [], vagas: vagas || [],
        sob_medida: { servicos: sob, visitas: SOB_MEDIDA_VISITAS, tabela_minima: SOB_MEDIDA_TABELA_MINIMA },
        cativa_horarios: cativa,
        contrato: { versao: TERMS_VERSION, url: TERMS_URL, txt: TERMS_TXT_URL, sha256: TERMS_SHA256 },
      })
    }

    if (action === 'cotar') {
      const c = await cotarSobMedida(body?.itens, body?.visitas)
      if ('error' in c) return json({ error: c.error }, 400)
      return json({ ok: true, ...c })
    }

    if (action === 'enviar_codigo') {
      const phone = digitsOf(body?.telefone)
      const key = phoneKeyOf(phone)
      if (!key || !telefoneValido(phone)) return json({ error: 'Informe um WhatsApp válido com DDD.' }, 400)
      const umaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: recentes } = await admin.from('club_phone_codes').select('created_at').eq('phone_mkey', key).gte('created_at', umaHora).order('created_at', { ascending: false })
      const lista = recentes || []
      if (lista.length >= 3) return json({ error: 'Você já pediu 3 códigos na última hora. Tente mais tarde ou fale com a barbearia pelo WhatsApp.' }, 429)
      if (lista.length && Date.now() - new Date(lista[0].created_at).getTime() < 60 * 1000) return json({ ok: true, waitSeconds: 60 })
      const ip = ipDe(req)
      if (ip) {
        const { count } = await admin.from('club_phone_codes').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', umaHora)
        if ((count || 0) >= 10) return json({ error: 'Muitos pedidos deste aparelho. Tente mais tarde.' }, 429)
      }
      const code = randomCode()
      const { error } = await admin.from('club_phone_codes').insert({
        phone_mkey: key, code_hash: await sha256(`${pepper}:${key}:${code}`), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), ip: ip || null,
      })
      if (error) throw new Error(error.message)
      await enviarWhats(admin, phone, textoCodigo(code), textoCodigo('******'))
      return json({ ok: true })
    }

    if (action === 'assinar') {
      const nome = String(body?.nome || '').trim().replace(/\s+/g, ' ').slice(0, 120)
      const phone = digitsOf(body?.telefone)
      const key = phoneKeyOf(phone)
      const email = String(body?.email || '').trim().toLowerCase().slice(0, 120)
      const codigo = digitsOf(body?.codigo).slice(0, 6)
      const aceite = body?.aceite && typeof body.aceite === 'object' ? body.aceite : {}
      if (nome.split(' ').length < 2) return json({ error: 'Informe nome e sobrenome.' }, 400)
      if (!key || !telefoneValido(phone)) return json({ error: 'Informe um WhatsApp válido com DDD.' }, 400)
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Informe um e-mail válido.' }, 400)
      if (codigo.length !== 6) return json({ error: 'Digite o código de 6 dígitos que chegou no WhatsApp.' }, 400)
      if (body?.contrato_versao !== TERMS_VERSION || body?.contrato_sha256 !== TERMS_SHA256) return json({ error: 'O contrato foi atualizado. Recarregue a página e leia a versão nova.' }, 409)
      if (aceite.contrato !== true || aceite.regras !== true || aceite.privacidade !== true) return json({ error: 'Para assinar, marque as três confirmações.' }, 400)

      // Código do WhatsApp
      const { data: rows } = await admin.from('club_phone_codes').select('id, code_hash, attempts, expires_at, used_at')
        .eq('phone_mkey', key).is('used_at', null).order('created_at', { ascending: false }).limit(1)
      const otp = rows && rows.length ? rows[0] : null
      if (!otp || new Date(otp.expires_at).getTime() < Date.now()) return json({ error: 'Código vencido. Peça um novo.' }, 400)
      if (Number(otp.attempts) >= 5) return json({ error: 'Muitas tentativas com este código. Peça um novo.' }, 429)
      if (otp.code_hash !== await sha256(`${pepper}:${key}:${codigo}`)) {
        await admin.from('club_phone_codes').update({ attempts: Number(otp.attempts) + 1 }).eq('id', otp.id)
        return json({ error: 'Código incorreto.' }, 400)
      }

      // Assinatura viva no mesmo telefone
      const { data: mkeyRow } = await admin.rpc('phone_match_key', { p_phone: phone })
      const mkey = String(mkeyRow || key)
      const { data: viva } = await admin.from('club_subscriptions').select('id, code, status').eq('phone_mkey', mkey).in('status', ['aguardando_pagamento', 'ativa', 'atrasada']).maybeSingle()
      if (viva && viva.status !== 'aguardando_pagamento') return json({ error: 'Este telefone já tem uma assinatura do Clube. Para trocar de plano, fale com a barbearia pelo WhatsApp.' }, 409)
      if (viva) {
        await admin.from('club_charges').update({ status: 'cancelada' }).eq('subscription_id', viva.id).eq('status', 'pendente')
        await admin.from('club_subscriptions').update({ status: 'expirada', updated_at: new Date().toISOString(), notes: 'Substituída por nova tentativa de assinatura.' }).eq('id', viva.id)
      }

      // Plano
      const planoId = String(body?.plano || '')
      const { data: plano } = await admin.from('club_plans').select('*').eq('id', planoId).eq('active', true).maybeSingle()
      if (!plano) return json({ error: 'Plano não encontrado.' }, 400)
      let visitItems: string[] = plano.visit_items, visitas: number | null = plano.visits_per_cycle, tabela = Number(plano.table_value), preco = Number(plano.price), pct = Number(plano.discount_pct || 0)
      let fixedWeekday: number | null = null, fixedTime: string | null = null
      if (plano.kind === 'sob_medida') {
        const c = await cotarSobMedida(body?.itens, body?.visitas)
        if ('error' in c) return json({ error: c.error }, 400)
        visitItems = c.itens; visitas = c.visitas; tabela = c.tabelaMensal; preco = c.preco; pct = c.pct
      }
      if (plano.kind === 'cativa') {
        fixedWeekday = Math.floor(Number(body?.cativa?.dia))
        fixedTime = String(body?.cativa?.hora || '').slice(0, 5)
        const { data: slots } = await admin.rpc('club_cativa_slots')
        const ok = (slots || []).some((s: { weekday: number; slot_time: string }) => s.weekday === fixedWeekday && String(s.slot_time).slice(0, 5) === fixedTime)
        if (!ok) return json({ error: 'Esse horário fixo acabou de ser escolhido por outra pessoa. Escolha outro.' }, 409)
        pct = Math.round((1 - preco / tabela) * 100)
      }

      // Vagas
      const { data: vagas } = await admin.rpc('club_vagas')
      const v = (vagas || []).find((x: { pool: string }) => x.pool === plano.pool)
      if (!v || !v.vendas_abertas || Number(v.livres) <= 0) {
        await admin.from('club_waitlist').insert({ name: nome, phone, phone_mkey: mkey, plan_id: plano.id })
        await pushJuliano('Clube do Ju: lista de espera', `${nome} entrou na lista de espera (${plano.name}).`, `clube-espera-${mkey}`)
        return json({ ok: true, lista_espera: true })
      }

      const { data: perfil } = await admin.from('customer_profiles').select('id').eq('phone_key', key).eq('archived', false).limit(1)
      const code = codigoAssinatura()
      const token = await tokenDoCodigo(code)
      const agora = new Date().toISOString()
      const { data: sub, error: subErr } = await admin.from('club_subscriptions').insert({
        code, manage_token_hash: await sha256(token), customer_id: perfil && perfil.length ? perfil[0].id : null,
        name: nome, phone, phone_mkey: mkey, email, plan_id: plano.id, visit_items: visitItems, visits_per_cycle: visitas,
        extras_per_cycle: plano.extras_per_cycle || {}, table_value: tabela, price: preco, discount_pct: pct,
        fixed_weekday: fixedWeekday, fixed_time: fixedTime, payment_method: 'link', status: 'aguardando_pagamento',
        terms_version: TERMS_VERSION, accepted_at: agora, accept_ip: ipDe(req) || null,
        accept_user_agent: String(req.headers.get('user-agent') || '').slice(0, 300),
        accept_checks: { ...aceite, contrato_sha256: TERMS_SHA256 }, phone_verified_at: agora,
      }).select('*').single()
      if (subErr) {
        if (String(subErr.code) === '23505') return json({ error: 'Este telefone já tem uma assinatura do Clube.' }, 409)
        throw new Error(subErr.message)
      }
      await admin.from('club_phone_codes').update({ used_at: agora }).eq('id', otp.id)

      const reference = `CLB-${code}-1`
      const gerenciar = linkGerenciar(code, token)
      const ck = await criarCheckoutClube({ reference, amountCents: Math.round(preco * 100), descricao: `Clube do Ju — ${plano.name} (1ª mensalidade)`, redirectUrl: `${gerenciar}&pago=1` })
      if (!ck.ok) {
        await admin.from('club_subscriptions').delete().eq('id', sub.id)
        return json({ error: 'O pagamento online está fora do ar agora. Tente de novo em alguns minutos.' }, 503)
      }
      await admin.from('club_charges').insert({
        subscription_id: sub.id, seq: 1, amount: preco, status: 'pendente', reference_id: reference,
        pagbank_checkout_id: ck.checkoutId, pay_link: ck.payUrl, expires_at: ck.expiresAt,
      })
      await enviarWhats(admin, phone, `${textoLinkPagamento({ nome, plano: plano.name, valor: preco, link: ck.payUrl })}\n\nSua assinatura, a qualquer momento: ${gerenciar}`)
      const cativaTxt = fixedWeekday ? ` · ${DIAS_SEMANA_PT[fixedWeekday]} ${fixedTime}` : ''
      await pushJuliano('Clube do Ju: nova assinatura', `${nome} · ${plano.name}${cativaTxt} · ${money(preco)}/mês. Aguardando o pagamento.`, `clube-${code}`)
      return json({ ok: true, code, pay_url: ck.payUrl, gerenciar })
    }

    if (action === 'status') {
      const sub = await acharPorLink()
      if (!sub) return json({ error: 'Link inválido.' }, 401)
      const { data: resumo } = await admin.rpc('club_summary', { p_subscription: sub.id })
      return json({ ok: true, assinatura: resumo, contrato: { versao: sub.terms_version, url: TERMS_URL } })
    }

    if (action === 'pagar') {
      const sub = await acharPorLink()
      if (!sub) return json({ error: 'Link inválido.' }, 401)
      const { data: ch } = await admin.from('club_charges').select('*').eq('subscription_id', sub.id).eq('status', 'pendente').order('seq', { ascending: false }).limit(1).maybeSingle()
      if (!ch) return json({ ok: true, nada_a_pagar: true })
      if (ch.pay_link && ch.expires_at && new Date(ch.expires_at).getTime() > Date.now() + 10 * 60 * 1000) return json({ ok: true, pay_url: ch.pay_link })
      const { data: plano } = await admin.from('club_plans').select('name').eq('id', sub.plan_id).single()
      const ck = await criarCheckoutClube({ reference: ch.reference_id, amountCents: Math.round(Number(ch.amount) * 100), descricao: `Clube do Ju — ${plano?.name || 'mensalidade'}`, redirectUrl: `${linkGerenciar(sub.code, await tokenDoCodigo(sub.code))}&pago=1` })
      if (!ck.ok) return json({ error: 'O pagamento online está fora do ar agora. Tente de novo em alguns minutos.' }, 503)
      await admin.from('club_charges').update({ pay_link: ck.payUrl, pagbank_checkout_id: ck.checkoutId, expires_at: ck.expiresAt }).eq('id', ch.id)
      return json({ ok: true, pay_url: ck.payUrl })
    }

    if (action === 'cancelar') {
      const sub = await acharPorLink()
      if (!sub) return json({ error: 'Link inválido.' }, 401)
      const motivo = String(body?.motivo || '').trim().slice(0, 300) || null
      const agora = new Date().toISOString()
      const hoje = hojeSP()
      if (!['aguardando_pagamento', 'ativa', 'atrasada'].includes(sub.status)) return json({ ok: true, ja_encerrada: true })
      if (sub.cancel_at_cycle_end) return json({ ok: true, ja_cancelada: true, fim: sub.current_cycle_end })
      await admin.from('club_charges').update({ status: 'cancelada' }).eq('subscription_id', sub.id).eq('status', 'pendente')

      const dentroDos7 = Date.now() - new Date(sub.accepted_at).getTime() <= 7 * 24 * 60 * 60 * 1000
      if (sub.status === 'aguardando_pagamento' || dentroDos7 || sub.status === 'atrasada') {
        // Desistência (art. 49 do CDC, contrato cláusula 7): devolve o pago menos a tabela do que já foi feito.
        const { data: pagas } = await admin.from('club_charges').select('amount, refunded_amount').eq('subscription_id', sub.id).eq('status', 'paga')
        const pago = (pagas || []).reduce((a: number, c: { amount: number; refunded_amount: number }) => a + Number(c.amount) - Number(c.refunded_amount || 0), 0)
        const { data: usos } = await admin.from('club_usage').select('booking_id, covered_value, status').eq('subscription_id', sub.id).in('status', ['usada', 'perdida'])
        const usado = (usos || []).reduce((a: number, u: { covered_value: number }) => a + Number(u.covered_value || 0), 0)
        const devolver = sub.status === 'atrasada' && !dentroDos7 ? 0 : Math.max(0, Math.round((pago - usado) * 100) / 100)
        const novoStatus = sub.status === 'atrasada' && !dentroDos7 ? 'cancelada' : 'arrependida'
        await admin.rpc('club_uncover_future', { p_subscription: sub.id, p_from: hoje })
        await admin.from('club_subscriptions').update({
          status: novoStatus, cancelled_at: agora, cancel_requested_at: agora, cancel_reason: motivo, cancel_channel: 'site',
          refund_due: devolver > 0 ? devolver : null, updated_at: agora,
        }).eq('id', sub.id)
        if (sub.status !== 'aguardando_pagamento') await enviarWhats(admin, sub.phone, novoStatus === 'arrependida' ? textoArrependimento({ nome: sub.name, devolver }) : textoCancelamento({ nome: sub.name, fimCiclo: null }))
        if (devolver > 0) await pushJuliano('Clube do Ju: devolver dinheiro', `${sub.name} desistiu no prazo de 7 dias. Devolver ${money(devolver)} pelo PagBank (painel do Clube).`, `clube-devolver-${sub.code}`)
        else await pushJuliano('Clube do Ju: cancelamento', `${sub.name} cancelou a assinatura.`, `clube-cancel-${sub.code}`)
        return json({ ok: true, tipo: novoStatus, devolver })
      }

      // Cancelamento comum: usa o ciclo pago até o fim, sem novas cobranças (cláusula 8).
      await admin.from('club_subscriptions').update({ cancel_at_cycle_end: true, cancel_requested_at: agora, cancel_reason: motivo, cancel_channel: 'site', updated_at: agora }).eq('id', sub.id)
      await enviarWhats(admin, sub.phone, textoCancelamento({ nome: sub.name, fimCiclo: sub.current_cycle_end }))
      await pushJuliano('Clube do Ju: cancelamento', `${sub.name} cancelou. Usa o ciclo pago até ${String(sub.current_cycle_end || '').split('-').reverse().slice(0, 2).join('/')}.`, `clube-cancel-${sub.code}`)
      return json({ ok: true, tipo: 'fim_do_ciclo', fim: sub.current_cycle_end })
    }

    if (action === 'lista_espera') {
      const nome = String(body?.nome || '').trim().slice(0, 120)
      const phone = digitsOf(body?.telefone)
      const key = phoneKeyOf(phone)
      if (!nome || !key || !telefoneValido(phone)) return json({ error: 'Informe nome e WhatsApp com DDD.' }, 400)
      const { data: mkeyRow } = await admin.rpc('phone_match_key', { p_phone: phone })
      const { data: pl } = await admin.from('club_plans').select('id').eq('id', String(body?.plano || '')).maybeSingle()
      await admin.from('club_waitlist').insert({ name: nome, phone, phone_mkey: String(mkeyRow || key), plan_id: pl?.id || null })
      return json({ ok: true })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (e) {
    console.error('[clube]', e)
    return json({ error: 'Não foi possível concluir agora. Tente de novo em instantes.' }, 500)
  }
})
