// v29.149.0 — Telefone do WhatsApp com e sem o nono dígito (caso Pedro, 08/09/2026).
//
// O WhatsApp identifica alguns celulares brasileiros pelo número ANTIGO, de 8 dígitos
// (quem criou a conta antes do nono dígito). O JID que a Evolution entrega ao webhook vem
// então com 12 dígitos (55 + DDD + 8), enquanto o cadastro, o agendamento e tudo o que NÓS
// enviamos usam 13 (55 + DDD + 9 + 8). Em 60 dias, 27 telefones chegaram assim — 1 em cada 8.
//
// Consequência real: o convite de retorno foi gravado com 13 dígitos; a resposta do cliente
// chegou com 12; o webhook procurou o convite pelo telefone literal, não achou, e a mensagem
// "me chama daqui 14 dias" caiu na IA livre, que respondeu que não consegue.
//
// O banco já resolve isso com phone_match_key() nas RPCs. Esta função faz o equivalente na
// borda: transforma o JID de 12 dígitos no formato de 13 que o resto do sistema usa, e só
// quando é celular (8 dígitos começando em 6-9). Telefone fixo (2-5) fica como está.
// Enviar para o número de 13 dígitos funciona — é o que o return-invite-dispatch sempre fez.
export const telefoneCanonicoWhatsapp = (valor: string): string => {
  const d = String(valor || '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('55') && /[6-9]/.test(d.charAt(4))) return `${d.slice(0, 4)}9${d.slice(4)}`
  return d
}
