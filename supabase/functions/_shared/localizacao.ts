import { MAPS_URL } from './aviso-chegada.ts'
// v29.275.1 — caso Renan (06/10/2026, 12h02). Ele mandou "18:10 pode ser" e, logo depois, "Pode me
// mandar a localização por favor". A JuIA respondeu só a lista "Qual serviço vai ser? 1-5": o pedido
// de localização sumiu, e nada dizia que o horário ainda não estava reservado. O Juliano assumiu.
//
// Regra: pedido de localização SEMPRE leva a localização na resposta, qualquer que seja o resto
// (pergunta do serviço, oferta de horário, preço...). Se a resposta ainda pede o serviço com um
// horário guardado, avisa com todas as letras que o agendamento não está concluído.
// Teste em tests/unit/localizacao.spec.js. Entrada normalizada (sem acento, minúsculo).

export const ENDERECO_COMPLETO = 'Rua Dr. Antônio da Cruz, 482, Centro, Bragança Paulista. Há vagas de Zona Azul nas proximidades.'

export const pediuLocalizacao = (t: string) =>
  /\blocaliza(cao|coes)?\b|\bendereco\b|\bonde (fica|ficam|voces ficam|e a barbearia|e o salao)\b|\bcomo (chego|chegar|faco pra chegar|faco para chegar)\b|\b(manda|mande|me manda|passa|me passa|envia|me envia)\s+(a\s+)?loc\b|\bmaps\b/.test(t)

export const jaTemLocalizacao = (reply: string) =>
  /maps\.app\.goo\.gl|ant[oô]nio da cruz/i.test(reply)

export const blocoLocalizacao = () =>
  ['Segue a localização da barbearia no Google Maps:', MAPS_URL, ENDERECO_COMPLETO].join('\n')

// reply: resposta já montada. aguardandoServico: a JuIA está pedindo o serviço e há horário guardado.
export const comLocalizacao = (normalizedMessage: string, reply: string, aguardandoServico = false) => {
  if (!pediuLocalizacao(normalizedMessage) || jaTemLocalizacao(reply)) return reply
  const aviso = aguardandoServico && /qual servi[cç]o vai ser/i.test(reply)
    ? 'Seu agendamento ainda não está concluído: falta escolher o serviço. '
    : ''
  // A saudação ("Boa tarde, Renan!") continua abrindo a mensagem.
  const m = reply.match(/^\s*((?:bom dia|boa tarde|boa noite|ol[aá]|oi)\b[^!.\n]{0,40}[!.])\s*/i)
  const saudacao = m ? `${m[1]}\n\n` : ''
  const resto = m ? reply.slice(m[0].length) : reply
  return `${saudacao}${blocoLocalizacao()}\n\n${aviso}${resto}`.trim()
}
