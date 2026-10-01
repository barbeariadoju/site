// v29.272.0 — ritmo humano nos robôs que abrem conversa (depois da restrição do WhatsApp de 01/10/2026,
// quando o anúncio do Clube mandou 50 mensagens frias em 4 h). Duas peças, usadas juntas:
//   digitandoMs(texto) — vai no campo `delay` do sendText da Evolution: o cliente vê "digitando…" por
//     esse tempo antes de a mensagem chegar (3 a 9 s, proporcional ao tamanho, com variação);
//   pausaEntreEnvios() — espera de 15 a 30 s entre uma mensagem e a próxima da mesma rodada.
// Teto de tempo: a função da Supabase tem limite de execução; por isso cada robô também manda poucas
// mensagens por rodada (MAX_POR_RODADA no próprio robô). O timeout do fetch precisa cobrir o `delay`.
const sorteio = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

export const digitandoMs = (texto: string) => Math.min(9000, Math.max(3000, 1500 + String(texto || '').length * 15)) + sorteio(0, 1500)

export const pausaEntreEnvios = () => new Promise((r) => setTimeout(r, sorteio(15000, 30000)))

// Timeout do fetch do sendText com `delay`: o tempo de "digitando" + folga de 15 s.
export const timeoutComDigitando = (delayMs: number) => delayMs + 15000
