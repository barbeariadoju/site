// Runner do banco de cenários da JuIA (ver scenarios.mjs). Roda cenários reais
// contra o ju-ia-site EM PRODUÇÃO (mesma function que WhatsApp/site usam), usando
// só a chave publicável (pública, sem risco) — nunca a service_role. Por isso
// cenários que dependem de um agendamento/pontos de fidelidade já existentes
// precisam ser preparados ANTES de rodar (ver tests/juia/README.md) — o phone de
// teste é sempre 5599900011234 ("Teste Claude"), nunca um número real.
//
// Uso:
//   node tests/juia/run-scenarios.mjs                 # roda só cenários sem "setup" (stateless)
//   node tests/juia/run-scenarios.mjs --setup=upcoming_booking
//   node tests/juia/run-scenarios.mjs --setup=upcoming_booking_pending_cancel
//   node tests/juia/run-scenarios.mjs --setup=two_upcoming_bookings
//   node tests/juia/run-scenarios.mjs --setup=loyalty_context
//
// Cenários com setup:'survey_pending' NÃO rodam aqui — a pesquisa de satisfação é
// tratada em supabase/functions/whatsapp-webhook/index.ts, que exige o segredo
// WHATSAPP_WEBHOOK_SECRET (não exposto a este script). Ver check-survey-logic.mjs
// pra validar essa parte por replicação da lógica, sem chamada HTTP real.

import { scenarios } from './scenarios.mjs'

const SUPABASE_URL = 'https://rpkqluaxhqsxnewunhfm.supabase.co'
const ANON_KEY = 'sb_publishable__DjSquVnGXP8VX4DdwlKAQ_QRPB2ph2'
const TEST_PHONE = '5599900011234'
const FN_URL = `${SUPABASE_URL}/functions/v1/ju-ia-site`

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/)
  return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]
}))
const setupFilter = args.setup || null

const targets = scenarios.filter(s => {
  if (s.setup === 'survey_pending') return false // tratado à parte, ver comentário acima
  return setupFilter ? s.setup === setupFilter : !s.setup
})

console.log(`Rodando ${targets.length} cenário(s)${setupFilter ? ` (setup=${setupFilter})` : ' (sem setup / stateless)'}...\n`)

async function callJuIA(message, { verifiedPhone, state, sessionId, history } = {}) {
  const body = {
    message,
    session_id: sessionId || `juia-bank-${Math.random().toString(36).slice(2)}`,
    history: history || [{ role: 'user', content: 'oi' }],
  }
  if (verifiedPhone) body.verified_phone = verifiedPhone
  if (state) body.state = state
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function redFlags(scenario, reply, intent, handoff) {
  const flags = []
  if (!reply || !reply.trim()) flags.push('resposta_vazia')
  const lower = (reply || '').toLowerCase()
  if (lower.includes('não entendi') && scenario.category !== 'pos_atendimento') flags.push('nao_entendi_fora_de_contexto')
  if (lower.includes('undefined') || lower.includes('[object object]')) flags.push('erro_de_template_na_resposta')
  if (reply && reply.length > 900) flags.push('resposta_muito_longa')
  return flags
}

const results = []
let i = 0
for (const scenario of targets) {
  i++
  const needsPhone = Boolean(scenario.setup)
  let extra = {}
  if (scenario.setup === 'upcoming_booking_pending_cancel') {
    // Prime: manda "quero cancelar" primeiro pra JuIA identificar o agendamento e
    // devolver pending_cancel_booking_id no state — só então mandamos a mensagem
    // real do cenário com esse estado, sem o script precisar saber o ID do banco.
    const prime = await callJuIA('quero cancelar', { verifiedPhone: TEST_PHONE })
    extra.state = prime.data?.state || {}
  } else if (needsPhone) {
    extra.verifiedPhone = TEST_PHONE
  }
  const { ok, status, data } = await callJuIA(scenario.message, extra)
  const reply = data?.reply || ''
  const intent = data?.intent || ''
  const handoff = Boolean(data?.handoff)
  const flags = ok ? redFlags(scenario, reply, intent, handoff) : ['http_error_' + status]
  results.push({ id: scenario.id, category: scenario.category, message: scenario.message, reply, intent, handoff, flags, note: scenario.note })
  const flagTxt = flags.length ? `  ⚠ ${flags.join(', ')}` : ''
  console.log(`[${i}/${targets.length}] ${scenario.id} (${scenario.category})${flagTxt}`)
  await new Promise(r => setTimeout(r, 250))
}

const flagged = results.filter(r => r.flags.length)
console.log(`\n=== Resumo ===`)
console.log(`Total: ${results.length} | Com alerta automático: ${flagged.length}`)
if (flagged.length) {
  console.log('\nCenários com alerta (revisar manualmente):')
  for (const r of flagged) console.log(`- ${r.id}: ${r.flags.join(', ')}\n  msg: "${r.message}"\n  reply: "${r.reply.slice(0, 200)}"`)
}

const fs = await import('node:fs')
const outPath = new URL(`./results-${setupFilter || 'stateless'}.json`, import.meta.url)
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
console.log(`\nResultado completo salvo em ${outPath.pathname.replace(/^\//, '')}`)
