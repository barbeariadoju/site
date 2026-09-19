import { primeiroNome as primeiroNomeBase } from './primeiro-nome.ts'
// v29.163.0 — Mensagem de "Pix confirmado" no TEMPO CERTO (caso Marcelo, 09/09/2026).
//
// O Marcelo tinha horário às 17h00, declarou o Pix às 17h33 (já na cadeira) e o Juliano só
// conferiu o extrato às 18h00, ao concluir o atendimento. O cliente recebeu o comprovante e,
// logo abaixo, "Seu horário está garantido — é só chegar no horário combinado" — pra um
// horário que ele já tinha saído. Texto certo pra quem paga de manhã, errado pra quem paga
// na cadeira ou depois.
//
// A regra é uma só, e o corte é o HORÁRIO DO AGENDAMENTO (pedido do Juliano): antes dele, o
// Pix garante a vaga; do horário em diante, o Pix quita o atendimento. Cancelado ou ausência
// é outra situação — o dinheiro entrou e não houve atendimento — e a mensagem só registra o
// recebimento, sem inventar política de crédito ou devolução: isso é conversa do Juliano.
//
// Módulo puro (sem banco, sem rede) pra ser testado em tests/unit. SEM EMOJI de propósito
// (regra de 01/09/2026): a versão anterior abria com "✅" e o semEmoji() deixava um espaço
// órfão no começo da mensagem.

export type Momento = 'antes' | 'depois' | 'sem_atendimento'

export type DadosPixConfirmado = {
  /** nome completo do cadastro; só o primeiro nome sai */
  clienteNome: string
  /** serviço + produtos, em R$ */
  valor: number
  /** booking_date 'YYYY-MM-DD' */
  bookingDate: string
  /** start_time 'HH:MM' ou 'HH:MM:SS' */
  startTime: string
  /** status da reserva no banco */
  status: string
  /** agora em America/Sao_Paulo, 'YYYY-MM-DD HH:MM' */
  agoraSP: string
  /** v29.199.1 — quando o Pix é SINAL (parte do total): o que falta acertar no dia. 0/ausente = pagou tudo. */
  restante?: number
}

export const money = (v: unknown) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const primeiroNome = (nome: unknown) => primeiroNomeBase(nome, 'Tudo certo')

/** 'YYYY-MM-DD HH:MM' do agendamento, comparável por string com agoraSP. */
const inicioAgendamento = (d: Pick<DadosPixConfirmado, 'bookingDate' | 'startTime'>) =>
  `${String(d.bookingDate || '')} ${String(d.startTime || '').slice(0, 5)}`

/**
 * Em que momento o Pix está sendo confirmado em relação ao atendimento.
 *  - sem_atendimento: reserva cancelada ou ausência — pagou, mas não houve corte;
 *  - depois: já concluída, OU o relógio de São Paulo já passou do horário marcado
 *    (o Juliano confirma na cadeira ou ao fechar o dia);
 *  - antes: o caso original — pagou antecipado e o horário ainda vem.
 */
export const momentoDaConfirmacao = (d: DadosPixConfirmado): Momento => {
  const status = String(d.status || '').toLowerCase()
  if (status === 'cancelled' || status === 'no_show') return 'sem_atendimento'
  if (status === 'completed') return 'depois'
  const inicio = inicioAgendamento(d)
  if (!d.bookingDate || !d.startTime || !d.agoraSP) return 'antes'
  return d.agoraSP >= inicio ? 'depois' : 'antes'
}

export const mensagemPixConfirmado = (d: DadosPixConfirmado) => {
  const nome = primeiroNome(d.clienteNome)
  const valor = money(d.valor)
  const momento = momentoDaConfirmacao(d)
  // v29.199.1 — caso Murillo (17/09/2026): sinal de R$ 50 de um platinado de R$ 190. A mensagem
  // dizia "Pix de R$ 190,00" (o total). Com restante > 0 o texto fala em sinal e no que falta.
  const restante = Number(d.restante || 0)
  const sinal = restante > 0

  if (momento === 'depois') {
    return [
      'Pagamento confirmado.',
      '',
      sinal
        ? `${nome}, o Juliano conferiu e o seu Pix de ${valor} (sinal) foi recebido e já está abatido do atendimento de hoje.`
        : `${nome}, o Juliano conferiu e o seu Pix de ${valor} foi recebido. O atendimento de hoje está quitado, não há mais nada a acertar.`,
      '',
      'Obrigado pela confiança. Até a próxima!',
      'Barbearia do Ju',
    ].join('\n')
  }

  if (momento === 'sem_atendimento') {
    return [
      'Pagamento confirmado.',
      '',
      `${nome}, o Juliano conferiu e o seu Pix de ${valor} foi recebido e está registrado aqui na barbearia.`,
      '',
      'Qualquer dúvida sobre esse valor ou sobre um novo horário, é só responder esta mensagem.',
      'Barbearia do Ju',
    ].join('\n')
  }

  // antes — texto da v29.47.0 ("mensagem bonita e profissional pra tranquilizá-lo"), sem emoji
  return [
    'Pagamento confirmado.',
    '',
    sinal
      ? `${nome}, o Juliano conferiu e o seu Pix de ${valor} (sinal) foi recebido. Seu horário está garantido: é só chegar no horário combinado. O restante, ${money(restante)}, você acerta no dia do atendimento.`
      : `${nome}, o Juliano conferiu e o seu Pix de ${valor} foi recebido. Seu horário está garantido: é só chegar no horário combinado, sem precisar fazer mais nada.`,
    '',
    'Obrigado pela confiança, te esperamos!',
    'Barbearia do Ju',
  ].join('\n')
}
