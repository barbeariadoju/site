import { primeiroNome as primeiroNomeBase } from './primeiro-nome.ts'
// v29.206.0 — aviso de chegada com a rota do Google Maps, ~30 min antes do horário
// (dica do cliente Rafael, repassada pelo Juliano em 18/09/2026). Fonte única do texto e da
// janela de envio; teste em tests/unit/aviso-chegada.spec.js.
//
// Texto sem emoji (regra de 01/09/2026) e sem pergunta: não entra na fila de perguntas
// numeradas da JuIA e não pede resposta. É só a localização na mão de quem já está saindo.

// Link curto da ficha "Barbearia do Ju" no Maps (o mesmo do hasMap no schema da home).
// Abre o pin da barbearia com o botão de rota, não uma busca por endereço.
export const MAPS_URL = 'https://maps.app.goo.gl/VJAfv4MJpd84tmDY7'

// Janela em minutos antes do início. O cron roda a cada 5 min, então todo horário cai em
// pelo menos uma rodada dentro dela; a marca arrival_route_sent_at impede o segundo envio.
export const JANELA_MIN = 25
export const JANELA_MAX = 35

// Quem marcou há menos disso acabou de receber a confirmação com o endereço: não repete.
export const CRIADO_HA_MIN = 30

export const primeiroNome = (nome: unknown) => primeiroNomeBase(nome, '')

export const montarAvisoChegada = (p: { nome?: string | null; horario: string }) => {
  const nome = primeiroNome(p.nome)
  const hora = String(p.horario || '').slice(0, 5)
  return [
    `Olá${nome ? `, ${nome}` : ''}. Seu horário na Barbearia do Ju é hoje às ${hora}.`,
    '',
    'Para facilitar a sua chegada, segue a localização no Google Maps:',
    MAPS_URL,
    '',
    'Rua Dr. Antônio da Cruz, 482, Centro. Há vagas de Zona Azul nas proximidades.',
    '',
    'Até já.',
  ].join('\n')
}

// minutos entre "agora" e o início do atendimento, ambos no relógio de Brasília.
// agoraLocal e inicioLocal no formato 'YYYY-MM-DDTHH:MM[:SS]' (sem fuso).
export const minutosAte = (agoraLocal: string, inicioLocal: string) =>
  (Date.parse(`${inicioLocal.slice(0, 16)}:00Z`) - Date.parse(`${agoraLocal.slice(0, 16)}:00Z`)) / 60000

export const dentroDaJanela = (minutos: number) => minutos >= JANELA_MIN && minutos <= JANELA_MAX

// v29.207.0 — o aviso de chegada FURA o silêncio da manhã (regra do Juliano, 19/09/2026): quem
// marcou às 8h00 recebe às 7h30, porque o horário foi o cliente quem escolheu e a mensagem só
// existe por causa dele. Exceção estreita, como a do comprovante: só este aviso, só dentro da
// janela de 30 min do próprio agendamento, e nunca antes das 7h nem depois das 20h.
// Lembrete, aniversário, reativação e o resto continuam presos ao juia_quiet_now().
export const HORA_MINIMA = 7
export const HORA_MAXIMA = 20
export const horaPermitida = (hora: number) => hora >= HORA_MINIMA && hora < HORA_MAXIMA
