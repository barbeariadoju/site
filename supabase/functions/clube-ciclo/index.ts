// v29.233.0 — Clube do Ju: a rotina das assinaturas. Cron bdj-clube-ciclo, a cada 10 minutos das 9h às 19h
// (relógio de Brasília; tudo aqui é idempotente, rodar de novo não repete nada). Cada rodada:
//   1. expira assinatura que não pagou a 1ª mensalidade em 48 h (libera a vaga);
//   2. vira o ciclo de quem já pagou a renovação; quem não pagou fica "em aberto" (cláusula 3.3):
//      os horários seguem na agenda pelo preço normal;
//   3. encerra quem ficou 15 dias em aberto (cláusula 3.4) e fecha quem pediu cancelamento no fim do ciclo;
//   4. gera o link da renovação 3 dias antes do fim do ciclo e manda pelo WhatsApp;
//   5. manda 1 a 3 mensagens de lançamento (club_announcements), só se o envio estiver ligado
//      (club_settings.anuncio_ativo), com intervalo aleatório entre elas: ~12 por hora, nunca em rajada
//      (a Evolution não é API oficial; envio em massa é o que derruba número).
// Autenticação: x-webhook-secret (mesma do resto dos crons). Corpo opcional { dry_run: true }.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { textoRenovacao, textoEmAberto, textoEncerrada, textosAnuncio } from '../_shared/clube-regras.ts'
import { hojeSP, somaDias, fimDoCicloAncorado, criarCheckoutClube, enviarWhats, linkGerenciar, tokenDoCodigo, pushJuliano } from '../_shared/clube-pagbank.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || req.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)
  const body = await req.json().catch(() => ({}))
  const dryRun = body?.dry_run === true
  const hora = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (!dryRun && (hora >= 20 || hora < 9)) return json({ ok: true, quiet_hours: true })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const hoje = hojeSP()
  const agora = new Date().toISOString()
  const log: Record<string, unknown[]> = { expiradas: [], viradas: [], em_aberto: [], encerradas: [], canceladas: [], renovacoes: [], anuncio: [] }

  // 1. Primeira mensalidade não paga em 48 h
  const { data: pendentes } = await admin.from('club_subscriptions').select('id, code').eq('status', 'aguardando_pagamento').lt('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
  for (const s of pendentes || []) {
    log.expiradas.push(s.code)
    if (dryRun) continue
    await admin.from('club_charges').update({ status: 'expirada' }).eq('subscription_id', s.id).eq('status', 'pendente')
    await admin.from('club_subscriptions').update({ status: 'expirada', updated_at: agora }).eq('id', s.id)
  }

  // 2 e 3. Fim de ciclo
  const { data: vencidas } = await admin.from('club_subscriptions').select('*').eq('status', 'ativa').lt('current_cycle_end', hoje)
  for (const s of vencidas || []) {
    const proximo = somaDias(s.current_cycle_end, 1)
    if (s.cancel_at_cycle_end) {
      log.canceladas.push(s.code)
      if (dryRun) continue
      await admin.rpc('club_uncover_future', { p_subscription: s.id, p_from: proximo })
      await admin.from('club_subscriptions').update({ status: 'cancelada', cancelled_at: agora, updated_at: agora }).eq('id', s.id)
      continue
    }
    const { data: paga } = await admin.from('club_charges').select('cycle_start, cycle_end').eq('subscription_id', s.id).eq('status', 'paga').eq('cycle_start', proximo).maybeSingle()
    if (paga) {
      log.viradas.push(s.code)
      if (!dryRun) await admin.from('club_subscriptions').update({ current_cycle_start: paga.cycle_start, current_cycle_end: paga.cycle_end, updated_at: agora }).eq('id', s.id)
      continue
    }
    log.em_aberto.push(s.code)
    if (dryRun) continue
    await admin.rpc('club_uncover_future', { p_subscription: s.id, p_from: proximo })
    await admin.from('club_subscriptions').update({ status: 'atrasada', updated_at: agora }).eq('id', s.id)
    const { data: ch } = await admin.from('club_charges').select('pay_link, expires_at').eq('subscription_id', s.id).eq('status', 'pendente').order('seq', { ascending: false }).limit(1).maybeSingle()
    const link = ch?.pay_link && new Date(ch.expires_at).getTime() > Date.now() ? ch.pay_link : linkGerenciar(s.code, await tokenDoCodigo(s.code))
    await enviarWhats(admin, s.phone, textoEmAberto({ nome: s.name, link }))
    await pushJuliano('Clube do Ju: mensalidade em aberto', `${s.name}: a renovação não foi paga. Horários seguem pelo preço normal.`, `clube-aberto-${s.code}`)
  }

  const { data: atrasadas } = await admin.from('club_subscriptions').select('*').eq('status', 'atrasada').lt('current_cycle_end', somaDias(hoje, -15))
  for (const s of atrasadas || []) {
    log.encerradas.push(s.code)
    if (dryRun) continue
    await admin.from('club_charges').update({ status: 'cancelada' }).eq('subscription_id', s.id).eq('status', 'pendente')
    await admin.from('club_subscriptions').update({ status: 'encerrada', cancelled_at: agora, cancel_reason: 'Mensalidade não paga em 15 dias', cancel_channel: 'automatico', updated_at: agora }).eq('id', s.id)
    await enviarWhats(admin, s.phone, textoEncerrada({ nome: s.name }))
  }

  // 4. Link da renovação, 3 dias antes do fim do ciclo
  const { data: renovar } = await admin.from('club_subscriptions').select('*').eq('status', 'ativa').eq('cancel_at_cycle_end', false).lte('current_cycle_end', somaDias(hoje, 3)).gte('current_cycle_end', hoje)
  for (const s of renovar || []) {
    const inicio = somaDias(s.current_cycle_end, 1)
    const { data: jaTem } = await admin.from('club_charges').select('id').eq('subscription_id', s.id).eq('cycle_start', inicio).in('status', ['pendente', 'paga']).maybeSingle()
    if (jaTem) continue
    log.renovacoes.push(s.code)
    if (dryRun) continue
    const { data: ult } = await admin.from('club_charges').select('seq').eq('subscription_id', s.id).order('seq', { ascending: false }).limit(1).maybeSingle()
    const seq = Number(ult?.seq || 1) + 1
    const reference = `CLB-${s.code}-${seq}`
    const { data: plano } = await admin.from('club_plans').select('name').eq('id', s.plan_id).single()
    const gerenciar = linkGerenciar(s.code, await tokenDoCodigo(s.code))
    // O link vale até 2 dias depois do fim do ciclo; depois disso, a página da assinatura gera outro.
    const horas = Math.max(24, Math.round((new Date(`${somaDias(s.current_cycle_end, 2)}T23:00:00-03:00`).getTime() - Date.now()) / 3600000))
    const ck = await criarCheckoutClube({ reference, amountCents: Math.round(Number(s.price) * 100), descricao: `Clube do Ju — ${plano?.name || 'mensalidade'}`, redirectUrl: `${gerenciar}&pago=1`, horasValidade: horas })
    await admin.from('club_charges').insert({
      subscription_id: s.id, seq, cycle_start: inicio, cycle_end: fimDoCicloAncorado(s.cycle_anchor, inicio), amount: s.price, status: 'pendente', reference_id: reference,
      pagbank_checkout_id: ck.ok ? ck.checkoutId : null, pay_link: ck.ok ? ck.payUrl : null, expires_at: ck.ok ? ck.expiresAt : null,
    })
    await enviarWhats(admin, s.phone, textoRenovacao({ nome: s.name, plano: plano?.name || 'Clube do Ju', valor: Number(s.price), fimCiclo: s.current_cycle_end, link: ck.ok ? ck.payUrl : gerenciar }))
  }

  // 5. Mensagem de lançamento para a base (lote pequeno por rodada, intervalo aleatório de 20 a 55 s).
  const { data: cfg } = await admin.from('club_settings').select('anuncio_ativo, anuncio_por_rodada').eq('id', 1).single()
  const diaUtil = (() => { const wd = new Date(`${hoje}T12:00:00-03:00`).getUTCDay(); return wd >= 2 && wd <= 6 })()
  if (cfg?.anuncio_ativo && diaUtil && hora >= 9 && hora < 19) {
    const lote = Math.max(1, Math.min(3, Number(cfg.anuncio_por_rodada || 2)))
    const { data: fila } = await admin.from('club_announcements').select('*').eq('status', 'fila').order('queued_at').limit(lote)
    for (const [i, a] of (fila || []).entries()) {
      // Conferência de última hora: saiu da lista (SAIR) ou já assinou? Pula.
      const { data: perfil } = await admin.from('customer_profiles').select('marketing_opt_out_at, archived').eq('id', a.customer_id).maybeSingle()
      const { data: assinante } = await admin.from('club_subscriptions').select('id').eq('phone_mkey', a.phone_mkey).in('status', ['aguardando_pagamento', 'ativa', 'atrasada']).maybeSingle()
      if (perfil?.marketing_opt_out_at || perfil?.archived || assinante) {
        if (!dryRun) await admin.from('club_announcements').update({ status: 'pulada', sent_at: agora }).eq('phone_mkey', a.phone_mkey)
        log.anuncio.push({ tel: a.phone_mkey, pulada: true })
        continue
      }
      const textos = textosAnuncio(a.name || '')
      const variante = Math.floor(Math.random() * textos.length)
      log.anuncio.push({ tel: a.phone_mkey, variante })
      if (dryRun) continue
      if (i > 0) await esperar(20000 + Math.floor(Math.random() * 35000))
      const ok = await enviarWhats(admin, a.phone, textos[variante])
      await admin.from('club_announcements').update({ status: ok ? 'enviada' : 'falhou', variant: variante, sent_at: new Date().toISOString(), error: ok ? null : 'envio falhou' }).eq('phone_mkey', a.phone_mkey)
    }
  }

  return json({ ok: true, hoje, dry_run: dryRun, ...log })
})
