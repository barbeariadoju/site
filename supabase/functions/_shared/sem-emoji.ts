// v29.102.0 — Regra do Juliano (01/09/2026): NENHUMA mensagem nossa para cliente leva
// emoji. Quem aparece como remetente do WhatsApp é o Juliano, e o cliente ainda não sabe
// que quem responde é uma IA — piscadinha de homem para homem constrange e é lida como
// outra coisa. O tom passa a ser formal e cordial, com a simpatia vindo da palavra
// escrita: nas palavras dele, "ética não tem sentimento".
//
// Único emoji permitido: as duas mãos juntas (🙏), e só em agradecimento.
//
// Por que um filtro determinístico, e não só instrução no prompt: (1) o modelo desobedece
// esse tipo de regra com frequência — a saudação duplicada da v28.62.0 é o precedente;
// (2) existem dezenas de emojis escritos à mão nas mensagens fixas do próprio código, e
// caçar um por um deixaria os que ainda vão ser escritos.
//
// Aplicar SEMPRE na saída (no ponto de envio), NUNCA na entrada: as regex que detectam
// emoji do CLIENTE (reação 👍, encerramento 🤝) continuam precisando do texto original.
export const semEmoji = (t = '') => String(t || '')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, m => m === '\u{1F64F}' ? m : '')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/ +([,.!?;:])/g, '$1')
  .replace(/ +\n/g, '\n')
  .trim()
