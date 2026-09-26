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
export const montarMensagemSenha = (p: {
  nome?: string | null; senha: number; servico: string; horario: string; posicao: number; link: string
}) => {
  const nome = primeiroNome(p.nome)
  const linhas = [
    `Olá${nome ? `, ${nome}` : ''}. Sua senha na Barbearia do Ju é a ${p.senha}.`,
    '',
    `${p.servico}, com previsão para as ${hhmm(p.horario)}.`,
  ]
  if (p.posicao <= 0) {
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
