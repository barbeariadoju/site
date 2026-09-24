// v29.233.0 — Clube do Ju: o que acontece quando o PagBank confirma o pagamento de uma mensalidade.
// Chamado pelo pagbank-webhook para referências "CLB-<código>-<n>". Idempotente: o PagBank reenvia
// notificações, e uma cobrança já paga não ativa nada de novo.
import { textoBoasVindas, textoRenovado, DIAS_SEMANA_PT } from './clube-regras.ts'
import { hojeSP, fimDoCiclo, enviarWhats, pushJuliano, linkGerenciar, tokenDoCodigo, marcarCativa, somaDias } from './clube-pagbank.ts'

const METHOD_MAP: Record<string, string> = { PIX: 'pix', CREDIT_CARD: 'credito', DEBIT_CARD: 'debito' }
const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const resumoPlano = (s: { visit_items: string[]; visits_per_cycle: number | null; fixed_weekday: number | null; extras_per_cycle: Record<string, number> }) => {
  const itens = (s.visit_items || []).join(' + ')
  const extras = Object.entries(s.extras_per_cycle || {}).map(([k, n]) => `${n} ${k} por ciclo`).join(', ')
  if (s.fixed_weekday) return `Toda semana: ${itens}${extras ? `, e ${extras}` : ''}.`
  return `${s.visits_per_cycle} visita(s) por ciclo: ${itens}.`
}

// deno-lint-ignore no-explicit-any
export async function processarPagamentoClube(admin: any, referenceId: string, charges: Array<Record<string, any>>, checkoutId: string | null) {
  const { data: ch } = await admin.from('club_charges').select('*').eq('reference_id', referenceId).maybeSingle()
  if (!ch) return { ignored: 'cobrança do Clube não encontrada' }
  const paid = charges.find((c) => String(c?.status || '').toUpperCase() === 'PAID')
  if (!paid) return { ok: true, sem_pagamento: true }
  if (ch.status === 'paga') return { ok: true, repeated: true }

  const method = METHOD_MAP[String(paid?.payment_method?.type || '').toUpperCase()] || null
  const agora = new Date().toISOString()
  const { data: sub } = await admin.from('club_subscriptions').select('*').eq('id', ch.subscription_id).single()
  const { data: plano } = await admin.from('club_plans').select('name, kind').eq('id', sub.plan_id).single()

  // Pagou depois de cancelar/expirar (link antigo aberto): registra o pagamento e avisa o Juliano para
  // devolver ou reativar à mão. Nada é ativado sozinho fora do fluxo.
  if (!['aguardando_pagamento', 'ativa', 'atrasada'].includes(sub.status) || ch.status !== 'pendente') {
    await admin.from('club_charges').update({ status: 'paga', paid_at: agora, method, pagbank_charge_id: String(paid.id || '') || null, pagbank_checkout_id: checkoutId || ch.pagbank_checkout_id }).eq('id', ch.id)
    await pushJuliano('Clube do Ju: pagamento fora de hora', `${sub.name} pagou ${money(ch.amount)} numa assinatura ${sub.status}. Conferir no painel do Clube (devolver ou reativar).`, `clube-fora-${sub.code}`)
    return { ok: true, fora_de_hora: true }
  }

  let inicio = ch.cycle_start as string | null
  let fim = ch.cycle_end as string | null
  if (ch.seq === 1 || !inicio) {
    inicio = hojeSP(); fim = fimDoCiclo(inicio)
  }
  await admin.from('club_charges').update({
    status: 'paga', paid_at: agora, method, pagbank_charge_id: String(paid.id || '') || null,
    pagbank_checkout_id: checkoutId || ch.pagbank_checkout_id, cycle_start: inicio, cycle_end: fim,
  }).eq('id', ch.id)

  const token = await tokenDoCodigo(sub.code)
  if (ch.seq === 1) {
    await admin.from('club_subscriptions').update({
      status: 'ativa', cycle_anchor: inicio, current_cycle_start: inicio, current_cycle_end: fim, activated_at: agora, updated_at: agora,
    }).eq('id', sub.id)
    let cativa: string | null = null
    if (sub.fixed_weekday) {
      await marcarCativa(admin, sub.id, inicio!, fim!)
      cativa = `${DIAS_SEMANA_PT[sub.fixed_weekday]}, ${String(sub.fixed_time).slice(0, 5)}`
    }
    await enviarWhats(admin, sub.phone, textoBoasVindas({
      nome: sub.name, plano: plano?.name || 'Clube do Ju', valor: Number(sub.price), inicio: inicio!, fim: fim!,
      resumo: resumoPlano(sub), gerenciar: linkGerenciar(sub.code, token), cativa,
    }))
    await pushJuliano('Clube do Ju: assinatura ativa', `${sub.name} · ${plano?.name} · ${money(sub.price)} pago (${method || 'PagBank'}).${cativa ? ` Horário fixo: ${cativa}.` : ''}`, `clube-ativa-${sub.code}`)
    return { ok: true, ativada: true }
  }

  // Renovação. Paga dentro do prazo: o ciclo novo começa quando o atual acabar (o clube-ciclo vira a
  // página). Paga com a assinatura em aberto: volta a valer na hora e recupera a cobertura (cláusula 3.3).
  if (sub.status === 'atrasada') {
    await admin.from('club_subscriptions').update({ status: 'ativa', current_cycle_start: inicio, current_cycle_end: fim, updated_at: agora }).eq('id', sub.id)
    await admin.rpc('club_recover_coverage', { p_subscription: sub.id })
  }
  if (sub.fixed_weekday) await marcarCativa(admin, sub.id, inicio!, fim!)
  await enviarWhats(admin, sub.phone, textoRenovado({ nome: sub.name, inicio: inicio!, fim: fim! }))
  await pushJuliano('Clube do Ju: mensalidade paga', `${sub.name} renovou (${money(ch.amount)}, ${method || 'PagBank'}).`, `clube-renova-${sub.code}-${ch.seq}`)
  return { ok: true, renovada: true, proximo_ciclo: somaDias(fim!, 1) }
}
