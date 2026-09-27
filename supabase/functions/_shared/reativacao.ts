// v29.246.0 — Texto do lembrete de reativação (customer-reactivation), separado da function para
// ser testado no vitest (tests/unit/reativacao.spec.js), como o da senha digital.
//
// Regra do Juliano (26/09/2026): "mensagem curta, breve; o objetivo é lembrar, não incomodar".
// Duas frases, sem pergunta (a resposta cai na JuIA como pedido de horário), sem palpite sobre a
// aparência de quem lê (v29.208.0), sem emoji (a function passa por semEmoji), link do site sempre.
// O texto muda com a etapa para não repetir a mesma frase a cada 15 dias.

export const LINK_AGENDAR = 'https://www.barbeariadoju.com.br/agendar/'

// "um mês", "um mês e meio", "dois meses", … como o Juliano diria, sem número de dias.
export function tempoDesde(dias: number): string {
  if (dias < 40) return 'um mês'
  if (dias < 55) return 'um mês e meio'
  if (dias < 70) return 'dois meses'
  if (dias < 85) return 'dois meses e meio'
  if (dias < 100) return 'três meses'
  if (dias < 115) return 'três meses e meio'
  const meses = Math.floor(dias / 30)
  const nomes = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze']
  return meses >= 12 ? 'um ano' : `${nomes[meses] || meses} meses`
}

// stage: 1 = primeiro lembrete (30 dias), 2 = segundo (45), 3+ = os seguintes.
export function montarMensagemReativacao(opts: { nome?: string; servico: string; dias: number; stage: number }): string {
  const nome = String(opts.nome || '').trim()
  const servico = String(opts.servico || '').trim() || 'atendimento'
  const tempo = tempoDesde(Number(opts.dias) || 0)
  const saud = `Olá${nome ? `, ${nome}` : ''}. `
  const stage = Number(opts.stage) || 1
  if (stage <= 1) return `${saud}Aqui é da Barbearia do Ju. Já faz ${tempo} do seu último ${servico} com o Juliano. Quando quiser marcar o próximo, é só responder aqui com o dia ou agendar em ${LINK_AGENDAR}`
  if (stage === 2) return `${saud}Aqui é da Barbearia do Ju, passando só para lembrar: já faz ${tempo} do seu último ${servico}. Se quiser marcar, responda aqui com o dia ou agende em ${LINK_AGENDAR}`
  return `${saud}Só um lembrete da Barbearia do Ju: já faz ${tempo} desde o seu último ${servico}. Quando quiser, é só responder com o dia ou agendar em ${LINK_AGENDAR}`
}

// v29.248.0 — Lembrete para quem agendou e cancelou (ou faltou) sem nunca ter vindo
// (leads_cancelled_due_for_followup, migração 182). Mesma régua: duas frases, sem pergunta, sem emoji,
// sem falar da aparência, link sempre. "Acabou não acontecendo" serve tanto para o cancelamento quanto
// para a falta, sem cobrar ninguém. Só existem duas etapas: a 2ª só lembra que a agenda está aberta.
export function montarMensagemFollowupCancelado(opts: { nome?: string; servico: string; stage: number }): string {
  const nome = String(opts.nome || '').trim()
  const servico = String(opts.servico || '').trim() || 'atendimento'
  const saud = `Olá${nome ? `, ${nome}` : ''}. `
  const stage = Number(opts.stage) || 1
  if (stage <= 1) return `${saud}Aqui é da Barbearia do Ju. Seu horário de ${servico} acabou não acontecendo; quando quiser remarcar, é só responder aqui com o dia ou agendar em ${LINK_AGENDAR}`
  return `${saud}Aqui é da Barbearia do Ju, passando só para lembrar que a agenda continua aberta para você. Para marcar o ${servico}, é só responder aqui com o dia ou agendar em ${LINK_AGENDAR}`
}
