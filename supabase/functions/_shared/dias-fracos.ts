// v29.193.0 (16/09/2026) — DIAS FRACOS: terça, quarta e quinta.
//
// Números das 8 semanas de 20/07 a 13/09/2026 (atendimentos concluídos por dia aberto):
// terça 6,5 · quarta 5,3 · quinta 6,5 · sexta 8,9 · sábado 6,7 (sábado fecha às 15h).
// Quarta e quinta são decididas em cima da hora (antecedência média de meio dia, contra mais de
// um dia na sexta e no sábado) e a manhã é a faixa mais vazia. Pedido do Juliano (16/09/2026):
// quando o cliente não tem dia fixo, a JuIA oferece esses dias primeiro; na saída do atendimento,
// sugere o retorno neles. Este módulo é só regra pura (sem banco), testada em
// tests/unit/dias-fracos.spec.js — quem consulta a agenda é o chamador.
//
// Todas as datas são ISO (AAAA-MM-DD) no fuso de São Paulo: o meio-dia local nunca cruza a
// meia-noite em UTC, então getUTCDay() devolve o dia da semana certo.

export const DIAS_FRACOS: ReadonlySet<number> = new Set([2, 3, 4]) // 2=terça, 3=quarta, 4=quinta

export const diaDaSemana = (iso: string): number => new Date(`${iso}T12:00:00-03:00`).getUTCDay()

export const ehDiaFraco = (iso: string): boolean => DIAS_FRACOS.has(diaDaSemana(iso))

export const somarDias = (iso: string, dias: number): string => {
  const d = new Date(`${iso}T12:00:00-03:00`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Dias fracos primeiro (na ordem em que vieram), depois os outros (idem). Estável.
export const diasFracosPrimeiro = <T extends { date: string }>(dias: T[]): T[] => [
  ...dias.filter((d) => ehDiaFraco(d.date)),
  ...dias.filter((d) => !ehDiaFraco(d.date)),
]

// O dia cujos horários a JuIA mostra em destaque quando lista vários dias: o primeiro dia
// fraco da lista ou, sem nenhum, o primeiro dia.
export const diaDestaque = <T extends { date: string }>(dias: T[]): T | null =>
  dias.find((d) => ehDiaFraco(d.date)) || dias[0] || null

// Quais dias oferecer quando o cliente não tem dia fixo ("essa semana", "quais dias você tem?").
// Até `maxFracos` dias fracos (os mais próximos) e o resto pelos dias mais próximos de qualquer
// tipo — quem pergunta na sexta continua vendo hoje e amanhã, só não em destaque. A `lista` sai
// em ordem cronológica (é assim que se fala); `destaque` é o dia cujos horários aparecem na
// resposta e o primeiro botão de resposta rápida.
export const selecionarDiasOferta = <T extends { date: string }>(dias: T[], max = 3, maxFracos = 2): { lista: T[]; destaque: T | null } => {
  const ordenados = [...dias].sort((a, b) => a.date.localeCompare(b.date))
  const escolhidos: T[] = []
  for (const d of ordenados) {
    if (escolhidos.length >= Math.min(max, maxFracos)) break
    if (ehDiaFraco(d.date)) escolhidos.push(d)
  }
  for (const d of ordenados) {
    if (escolhidos.length >= max) break
    if (!escolhidos.includes(d)) escolhidos.push(d)
  }
  const lista = escolhidos.sort((a, b) => a.date.localeCompare(b.date))
  return { lista, destaque: diaDestaque(lista) }
}

// Datas candidatas pro retorno sugerido na saída do atendimento. Alvo = última visita + retorno
// (a cadência do próprio cliente, quando o banco a conhece, ou o retorno típico do serviço);
// candidatos = terça, quarta e quinta entre 3 dias antes e 7 dias depois do alvo, nunca antes
// de amanhã, do mais perto do alvo pro mais longe (empate: o mais cedo). O chamador consulta a
// agenda nessa ordem e fica com o primeiro dia que tem horário.
export const candidatosRetorno = (ultimaVisitaIso: string, retornoDias: number, hojeIso: string): string[] => {
  const alvo = somarDias(ultimaVisitaIso, Math.max(3, Math.round(Number(retornoDias) || 0)))
  const amanha = somarDias(hojeIso, 1)
  const out: { iso: string; dist: number }[] = []
  for (let k = -3; k <= 7; k++) {
    const iso = somarDias(alvo, k)
    if (iso < amanha || !ehDiaFraco(iso)) continue
    out.push({ iso, dist: Math.abs(k) })
  }
  return out.sort((a, b) => a.dist - b.dist || a.iso.localeCompare(b.iso)).map((x) => x.iso)
}

// Entre os horários livres do dia, o mais próximo do horário em que o cliente costuma vir
// (o do atendimento que acabou de terminar). Empate: o mais cedo.
export const horarioMaisProximo = (slots: string[], hhmm: string): string => {
  const min = (t: string) => {
    const [h, m] = String(t || '').split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  if (!slots.length) return ''
  const alvo = min(/^\d{1,2}:\d{2}/.test(String(hhmm || '')) ? hhmm : '10:00')
  return [...slots].sort((a, b) => Math.abs(min(a) - alvo) - Math.abs(min(b) - alvo) || min(a) - min(b))[0]
}
