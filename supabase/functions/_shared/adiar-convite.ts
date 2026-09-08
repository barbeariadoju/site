// v29.149.0 — "Decidir depois, me chama daqui 14 dias" (caso Pedro, 08/09/2026).
//
// O convite de retorno oferece 1 (quero) e 2 (agora não), e diz "se preferir decidir depois,
// é só me chamar". O Pedro fez a terceira coisa, a mais natural: pediu pra SER chamado,
// com prazo. Nenhuma regra do convite cobria isso, a mensagem caiu na IA livre e ela
// respondeu que "não consegue iniciar uma mensagem daqui a 14 dias" — o que é falso e
// joga fora um cliente que acabou de dizer quando quer voltar.
//
// Este módulo só interpreta o texto (já normalizado: sem acento, minúsculo). Quem age é o
// whatsapp-webhook (grava remind_at) e o return-invite-dispatch (manda o lembrete no dia).

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8,
  nove: 9, dez: 10, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, sessenta: 60,
}

// Dias pedidos no texto, ou null quando não há prazo. Aceita número em algarismo ou por
// extenso, com dia/semana/mês, e as formas "semana que vem", "mês que vem", "uma quinzena".
export const diasPedidos = (texto: string): number | null => {
  const t = String(texto || '').toLowerCase()
  const m = t.match(/\b(\d{1,3}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|doze|quinze|vinte|trinta|quarenta|sessenta)\s*(dias?|semanas?|mes(?:es)?|quinzenas?)\b/)
  if (m) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMEROS[m[1]] || 0
    const unidade = m[2]
    const dias = unidade.startsWith('semana') ? n * 7 : unidade.startsWith('mes') ? n * 30 : unidade.startsWith('quinzena') ? n * 15 : n
    return dias > 0 ? dias : null
  }
  if (/\b(semana que vem|proxima semana|semana seguinte)\b/.test(t)) return 7
  if (/\b(uma quinzena|quinze dias)\b/.test(t)) return 15
  if (/\b(mes que vem|proximo mes|mes seguinte)\b/.test(t)) return 30
  return null
}

// O cliente pediu pra ser procurado depois ("me chama", "me lembra", "me avisa", "decidir
// depois", "mais pra frente")? Com ou sem prazo — sem prazo, o webhook pergunta quantos dias.
export const pediuLembrete = (texto: string): boolean => {
  const t = String(texto || '').toLowerCase()
  return /\bme\s+(chama|chame|chamar|lembra|lembre|lembrar|avisa|avise|avisar|manda|mande|fala|fale|procura|procure|cobra|cobre)\b/.test(t)
    || /\b(decid\w*|vejo|ve|falo|respondo|marco|combino)\s+(depois|mais tarde|mais pra frente|mais para frente|mais adiante)\b/.test(t)
    || /\b(depois|mais tarde|mais pra frente|mais para frente|mais adiante)\s+(eu\s+)?(decido|vejo|falo|respondo|marco|te chamo|combino)\b/.test(t)
}

// Data do lembrete: hoje (São Paulo) + dias, com piso e teto pra não gravar "daqui a 1 dia"
// nem "daqui a 2 anos". Domingo não tem envio, então cai pra segunda.
export const dataDoLembrete = (hojeIso: string, dias: number): string => {
  const d = Math.min(120, Math.max(2, Math.round(dias)))
  const alvo = new Date(new Date(`${hojeIso}T12:00:00Z`).getTime() + d * 24 * 3600 * 1000)
  if (alvo.getUTCDay() === 0) alvo.setUTCDate(alvo.getUTCDate() + 1)
  return alvo.toISOString().slice(0, 10)
}
