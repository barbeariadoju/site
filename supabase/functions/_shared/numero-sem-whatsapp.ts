// v29.208.0 — anti-trote (caso Luiz, 19/09/2026). A Evolution responde 400 com
// response.message[].exists = false quando o número NÃO tem WhatsApp. É esse o sinal que
// marca o agendamento; queda de servidor, timeout ou 5xx NÃO marcam (senão um dia de
// Evolution fora do ar pintaria todo agendamento como trote). Telefone que nem chega a
// formar número válido (waPhone vazio) também conta como sem WhatsApp.
// Teste em tests/unit/numero-sem-whatsapp.spec.js.
export const numeroSemWhatsapp = (r: { status?: number; data?: unknown; waPhone?: string }) => {
  if (r.waPhone === '') return true
  if (r.status !== 400) return false
  const msgs = (r.data as { response?: { message?: unknown } } | null)?.response?.message
  return Array.isArray(msgs) && msgs.some((m) => m && typeof m === 'object' && (m as { exists?: unknown }).exists === false)
}
