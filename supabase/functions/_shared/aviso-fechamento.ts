import { primeiroNome as primeiroNomeBase } from './primeiro-nome.ts'
// v29.226.0 — Aviso de fechamento (pedido do Juliano, 23/09/2026: viagem com a família de 15 a 17/10,
// "tem clientes que marcam todas as sextas, como o Sr. Longanesi e o Juliano Prando").
// Fonte única do texto e das contas de data; teste em tests/unit/aviso-fechamento.spec.js.
//
// Quando a agenda tem dias inteiros fechados (viagem, folga, feriado), quem costuma vir nesses dias
// ou tem o retorno previsto para eles recebe UM aviso uns 7 dias antes, com dias concretos antes e
// depois. A resposta cai na JuIA como pedido de horário. Tom da casa: formal e cordial, sem emoji,
// sem pergunta numerada (não disputa a fila de perguntas), sem expor agenda vazia, sem dizer o motivo
// do fechamento (é da vida do Juliano, não do cliente).

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const DIAS_PLURAL = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados']

const dow = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getUTCDay()
export const ddmm = (iso: string) => { const [, m, d] = String(iso || '').slice(0, 10).split('-'); return d && m ? `${d}/${m}` : '' }
const noDia = (iso: string) => { const n = DIAS[dow(iso)]; return `${/^(sábado|domingo)$/.test(n) ? 'no' : 'na'} ${n} (${ddmm(iso)})` }
export const somarDias = (iso: string, n: number) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// Domingo e segunda a barbearia não abre de qualquer jeito: não contam como "fechamento".
export const diaDeTrabalho = (iso: string) => { const w = dow(iso); return w >= 2 && w <= 6 }

// Dias fechados o dia inteiro (all_day) → períodos. Domingo e segunda no meio não quebram o período
// (fechar sábado e terça é UMA ausência para o cliente, não duas).
export const periodosDeFechamento = (fechados: string[]): { ini: string; fim: string; dias: string[] }[] => {
  const dias = [...new Set(fechados.map((d) => String(d).slice(0, 10)).filter(diaDeTrabalho))].sort()
  const out: { ini: string; fim: string; dias: string[] }[] = []
  for (const d of dias) {
    const atual = out[out.length - 1]
    if (atual) {
      let x = somarDias(atual.fim, 1)
      while (x < d && !diaDeTrabalho(x)) x = somarDias(x, 1)
      if (x === d) { atual.fim = d; atual.dias.push(d); continue }
    }
    out.push({ ini: d, fim: d, dias: [d] })
  }
  return out
}

// Dias abertos para oferecer: até 2 antes do fechamento (a partir de amanhã) e o 1º depois.
export const diasAlternativos = (p: { ini: string; fim: string }, hoje: string, fechados: Set<string>) => {
  const antes: string[] = []
  for (let x = somarDias(p.ini, -1); x > hoje && antes.length < 2; x = somarDias(x, -1)) {
    if (diaDeTrabalho(x) && !fechados.has(x)) antes.unshift(x)
  }
  let depois = ''
  for (let x = somarDias(p.fim, 1), i = 0; i < 21; x = somarDias(x, 1), i++) {
    if (diaDeTrabalho(x) && !fechados.has(x)) { depois = x; break }
  }
  return { antes, depois }
}

const faixa = (p: { ini: string; fim: string }) => p.ini === p.fim
  ? `${noDia(p.ini)} a barbearia não vai atender`
  : `de ${DIAS[dow(p.ini)]} (${ddmm(p.ini)}) a ${DIAS[dow(p.fim)]} (${ddmm(p.fim)}) a barbearia não vai atender`

const lista = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ou ${xs[xs.length - 1]}`

export const textoAvisoFechamento = (a: {
  nome?: string | null
  periodo: { ini: string; fim: string }
  motivo: 'habitual' | 'retorno'
  diaHabitual?: number | null // 0-6, o dia fechado em que ele mais vem
  antes: string[]
  depois: string
}) => {
  const n = primeiroNomeBase(a.nome, '')
  const abre = n ? `Olá, ${n}. Aqui é da Barbearia do Ju.` : 'Olá. Aqui é da Barbearia do Ju.'
  const porque = a.motivo === 'habitual' && a.diaHabitual != null
    ? `Como você costuma vir às ${DIAS_PLURAL[a.diaHabitual]}, estou avisando com antecedência.`
    : 'Pela data do seu último atendimento, o próximo cairia nesses dias, então estou avisando com antecedência.'
  const opcoes = [
    ...a.antes.map((d) => noDia(d)),
    ...(a.depois ? [`a partir de ${noDia(a.depois).replace(/^n[ao] /, '')}`] : []),
  ]
  const oferta = opcoes.length
    ? `Se quiser, eu já deixo o seu horário reservado ${lista(opcoes)}. É só me responder com o dia que fica melhor para você.`
    : 'Se quiser, eu já deixo o seu horário reservado para outro dia. É só me responder com o dia que fica melhor para você.'
  return `${abre} Um aviso: ${faixa(a.periodo)}. ${porque}\n\n${oferta}`
}
