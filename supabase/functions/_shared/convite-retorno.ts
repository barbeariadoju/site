// v29.154.0 — Convite de retorno no TEMPO DO CLIENTE (08/09/2026).
//
// O que os números mostraram (112 convites enviados entre 13/08 e 08/09): o convite saía 1 a 3
// dias depois do corte, junto com a pesquisa de satisfação e o pedido de avaliação (mediana de
// 3 mensagens nossas em 72h), pedindo pra reservar "o próximo horário" a quem acabou de sair
// da cadeira. Resultado: 68% ignoraram, 12% recusaram, 2 aceitaram. E quem voltou, voltou por
// conta própria: dos 76 convites expirados, 19 clientes retornaram — 15 deles ANTES da data
// que o convite tinha calculado (média 26 dias; retorno real, 12).
//
// Intervalo real entre visitas (80 retornos, banco de 08/09/2026):
//   com corte      p25 = 10 dias · mediana 17 · p75 = 27
//   só barba/outro p25 = 5  dias · mediana 7  · p75 = 12
//
// A regra nova: o convite chega quando o cliente está PERTO de precisar de novo — alguns dias
// antes do retorno típico dele — e não no dia seguinte. Cliente com cadência própria (3+
// visitas) recebe no ritmo dele; sem histórico, vale o padrão da família do serviço.
//
// Este módulo é só regra pura (sem banco, sem rede), pra ser testado em tests/unit. Quem age é
// o return-invite-dispatch (escolhe o dia e manda) e o whatsapp-webhook (interpreta a resposta).

export type Familia = 'corte' | 'barba' | 'outro'

// Dias após o atendimento em que o convite SAI, por família, quando o cliente não tem cadência.
// Corte no dia 12: depois do p25 (quem volta rápido já voltou sozinho) e antes da mediana.
// Barba no dia 5: mesma lógica, ciclo mais curto.
export const ALVO_PADRAO: Record<Familia, number> = { corte: 12, barba: 5, outro: 12 }

// Retorno típico (dias) usado só pra sugerir uma data ao checar se existe agenda e pra relatório.
export const RETORNO_TIPICO: Record<Familia, number> = { corte: 17, barba: 7, outro: 17 }

// Tolerância depois do dia-alvo: pesquisa pendente, conversa com o Juliano, domingo e feriado
// seguram o envio, e o cron tenta de novo nos dias seguintes. Passou disso, não manda mais —
// convite atrasado vira insistência, e a regra é zero insistência.
export const JANELA_DIAS = 3

// Quantos dias ANTES do retorno típico o convite sai (dá tempo de escolher dia e horário).
export const ANTECEDENCIA_DIAS = 4

export const familiaDoServico = (nome: string): Familia => {
  const n = String(nome || '').toLowerCase()
  if (/corte|raspar|infantil|luzes|platinado|nevou|alisamento|relaxamento|tintura|pigmenta[cç][aã]o capilar|lavagem/.test(n)) return 'corte'
  if (/barba|barboterapia/.test(n)) return 'barba'
  return 'outro'
}

// Dia-alvo do envio. Cadência conhecida (mediana dos intervalos do próprio cliente, calculada
// pelo banco em customer_visit_cadence_days) manda; sem cadência, padrão da família.
export const alvoDias = (cadenciaDias: number | null | undefined, servico: string): number => {
  const c = Number(cadenciaDias) || 0
  if (c >= 4) return Math.max(3, c - ANTECEDENCIA_DIAS)
  return ALVO_PADRAO[familiaDoServico(servico)]
}

export const retornoTipicoDias = (cadenciaDias: number | null | undefined, servico: string): number => {
  const c = Number(cadenciaDias) || 0
  return c >= 4 ? c : RETORNO_TIPICO[familiaDoServico(servico)]
}

export type Decisao = 'esperar' | 'enviar' | 'perdeu'

export const decisaoEnvio = (diasDesde: number, alvo: number): Decisao => {
  if (diasDesde < alvo) return 'esperar'
  if (diasDesde <= alvo + JANELA_DIAS) return 'enviar'
  return 'perdeu'
}

// Dias inteiros entre duas datas ISO (YYYY-MM-DD), sem fuso: 2026-09-08 → 2026-09-20 = 12.
export const diasEntre = (deIso: string, ateIso: string): number => {
  const de = Date.parse(`${String(deIso).slice(0, 10)}T12:00:00Z`)
  const ate = Date.parse(`${String(ateIso).slice(0, 10)}T12:00:00Z`)
  if (!Number.isFinite(de) || !Number.isFinite(ate)) return 0
  return Math.round((ate - de) / (24 * 3600 * 1000))
}

export const somarDiasIso = (iso: string, dias: number): string =>
  new Date(Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`) + dias * 24 * 3600 * 1000).toISOString().slice(0, 10)

// "Já faz quase duas semanas do seu corte" — o tempo como o cliente fala, não em dias contados.
export const tempoDesde = (dias: number): string => {
  if (dias <= 4) return 'alguns dias'
  if (dias <= 8) return 'uma semana'
  if (dias <= 11) return 'uns dez dias'
  if (dias <= 16) return 'quase duas semanas'
  if (dias <= 23) return 'quase três semanas'
  if (dias <= 34) return 'quase um mês'
  return 'mais de um mês'
}

// Texto do convite. Sem emoji (regra de 01/09/2026). "próximo horário reservado" e "Quero sim"
// ficam de propósito: são as âncoras que o webhook usa pra reconhecer um "1" tardio como
// resposta ao convite (caso Sabrino, v29.144.0). Nunca cita preço, reajuste nem "agenda livre".
export const mensagemConvite = (primeiroNome: string, diasDesde: number, servico: string): string => {
  const oi = primeiroNome ? `Oi, ${primeiroNome}.` : 'Oi.'
  const fam = familiaDoServico(servico)
  const oQue = fam === 'corte' ? 'do seu corte' : fam === 'barba' ? 'da sua barba' : 'da sua última visita'
  return `${oi} Já faz ${tempoDesde(diasDesde)} ${oQue} aqui na barbearia. Quer deixar o próximo horário reservado?\n*1* — Quero sim\n*2* — Agora não, obrigado\n\nSe preferir outro momento, é só me dizer.`
}

// Etapa 2 (webhook): o convite já chega perto do retorno, então as opções contam A PARTIR DE
// HOJE — não mais "1 semana / 15 / 30 dias depois do último corte", que só fazia sentido quando
// o convite saía no dia seguinte.
export const OPCOES_PRAZO: Array<{ numero: number; rotulo: string; dias: number }> = [
  { numero: 1, rotulo: 'Nos próximos dias', dias: 1 },
  { numero: 2, rotulo: 'Semana que vem', dias: 7 },
  { numero: 3, rotulo: 'Daqui a 15 dias', dias: 15 },
]

export const mensagemPrazo = (): string =>
  `Boa. Pra quando você quer deixar reservado?\n${OPCOES_PRAZO.map((o) => `*${o.numero}* — ${o.rotulo}`).join('\n')}\n\nSe preferir outra data, é só me dizer qual.`

export const diasDaOpcao = (numero: number): number =>
  OPCOES_PRAZO.find((o) => o.numero === numero)?.dias || 0

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Linha de valor na oferta de horários: serviço e preço VIGENTE NA DATA escolhida, ditos de
// forma neutra. Regra do Juliano (03/09/2026, prompt da JuIA): nunca anunciar reajuste por conta
// própria, nunca comparar valor velho com novo, nunca citar a data da virada — o valor se
// sustenta pelo que a casa entrega. Então o cliente vê o preço certo pra data e escolhe o
// horário sabendo, sem "lembrando que a partir de…". (A v29.154.0 tinha um aviso comparativo
// aqui; saiu na v29.155.0 por contrariar essa regra.)
export const linhaValor = (servico: string, preco: number | null | undefined): string => {
  const v = Number(preco)
  if (!Number.isFinite(v) || v <= 0 || !String(servico || '').trim()) return ''
  return `${servico}: ${moeda.format(v)}.`
}
