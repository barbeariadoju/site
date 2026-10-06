import { primeiroNome as primeiroNomeBase } from './primeiro-nome.ts'
// v29.241.0 — Senha Digital: fonte única dos textos do WhatsApp e da regra "quem é o próximo".
// Teste em tests/unit/senha-digital.spec.js.
//
// Textos sem emoji (regra de 01/09/2026) e sem pergunta: não entram na fila de perguntas
// numeradas da JuIA e não pedem resposta.

export const ENDERECO = 'Rua Dr. Antônio da Cruz, 482, Centro'

export const primeiroNome = (nome: unknown) => primeiroNomeBase(nome, '')

const hhmm = (t: unknown) => String(t || '').slice(0, 5)

// Mensagem na hora em que a senha é criada. posicao = quantas pessoas ainda vêm antes.
const minutos = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

// v29.275.0 (teste do Juliano, 06/10 11h20): com a cadeira livre, "previsão para as 11:45" criava
// expectativa ruim. `agora` (HH:MM de Brasília): se ninguém vem antes e o horário é daqui a até
// 5 min, a mensagem diz que a cadeira está livre em vez de dar previsão.
export const cadeiraLivreAgora = (horario: string, posicao: number, agora?: string) =>
  posicao <= 0 && Boolean(agora) && minutos(hhmm(horario)) - minutos(hhmm(agora)) <= 5

export const montarMensagemSenha = (p: {
  nome?: string | null; senha: number; servico: string; horario: string; posicao: number; link: string; agora?: string
}) => {
  const nome = primeiroNome(p.nome)
  const livre = cadeiraLivreAgora(p.horario, p.posicao, p.agora)
  const linhas = [
    `Olá${nome ? `, ${nome}` : ''}. Sua senha na Barbearia do Ju é a ${p.senha}.`,
    '',
    livre ? `${p.servico}. A cadeira está livre: o Juliano já te chama.` : `${p.servico}, com previsão para as ${hhmm(p.horario)}.`,
  ]
  if (livre) {
    // nada a acrescentar: é ele agora
  } else if (p.posicao <= 0) {
    linhas.push('Você é o próximo: pode entrar assim que a cadeira liberar.')
  } else {
    linhas.push(
      p.posicao === 1 ? 'Há 1 pessoa antes de você.' : `Há ${p.posicao} pessoas antes de você.`,
      'Pode dar uma volta no centro. Aviso por aqui quando você for o próximo.',
    )
  }
  linhas.push('', 'Para acompanhar a fila:', p.link)
  return linhas.join('\n')
}

export const montarMensagemProximo = (p: { nome?: string | null; horario: string }) => {
  const nome = primeiroNome(p.nome)
  return [
    `${nome ? `${nome}, você` : 'Você'} é o próximo na Barbearia do Ju.`,
    '',
    `Pode vir: seu horário é às ${hhmm(p.horario)}, na ${ENDERECO}.`,
    '',
    'Até já.',
  ].join('\n')
}

export type Compromisso = { start_time: string; end_time: string; status: string }

// Alguém ainda vem antes de mim? Conta só quem tem horário ativo, começa antes do meu e ainda
// não terminou (end_time depois de agora). Horário que já passou do fim e ficou "confirmado"
// porque ninguém clicou em Concluir conta como acabado — senão o aviso nunca sairia.
export const alguemAntes = (agoraHHMM: string, meuInicio: string, outros: Compromisso[]) =>
  outros.some((o) =>
    ['pending', 'confirmed'].includes(o.status) && hhmm(o.start_time) < hhmm(meuInicio) && hhmm(o.end_time) > hhmm(agoraHHMM))

export const ehProximo = (agoraHHMM: string, meuInicio: string, outros: Compromisso[]) =>
  !alguemAntes(agoraHHMM, meuInicio, outros)

// Piso 8h / teto 20h: a senha só existe no expediente, mas o cron é guardado do mesmo jeito.
export const horaPermitida = (hora: number) => hora >= 8 && hora < 20
