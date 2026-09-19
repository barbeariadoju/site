// v29.212.0 — primeiro nome pra falar com o cliente. Fonte única.
//
// Havia nove cópias de "primeira palavra do nome" espalhadas pelas functions, e só uma (a dos
// benefícios, v29.209.0) pulava o tratamento. O cadastro do caso Sr. Magno (16/09/2026) é "Sr
// Magno": a JuIA reservou com "Reservado! Sr, na quinta…" e o lembrete saiu "Oi, Sr!". Aqui:
//   - tratamento na frente (Sr, Sra, Dr, Dra, Seu, Dona, Prof…) não é nome, pula pro próximo;
//   - nome gravado todo em maiúscula ("MOISES") vira "Moises" — grito não é nome;
//   - nome do WhatsApp que é só emoji/símbolo ("🤓") não tem nome nenhum: devolve o padrão.
// O padrão muda por mensagem ("Cliente" no cupom, '' onde a frase funciona sem nome), por isso
// é parâmetro.

const TRATAMENTO = /^(sr|sra|srta|sto|dr|dra|seu|dona|prof|profa|senhor|senhora|doutor|doutora)\.?,?$/i

export const primeiroNome = (nome: unknown, padrao = ''): string => {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean)
  const achado = partes.find((p) => !TRATAMENTO.test(p) && /\p{L}/u.test(p)) || ''
  const limpo = achado.replace(/[,.;:!?]+$/, '')
  if (!limpo) return padrao
  const tudoMaiusculo = limpo.length > 1 && limpo === limpo.toLocaleUpperCase('pt-BR') && limpo !== limpo.toLocaleLowerCase('pt-BR')
  const base = tudoMaiusculo ? limpo.toLocaleLowerCase('pt-BR') : limpo
  return base.charAt(0).toLocaleUpperCase('pt-BR') + base.slice(1)
}
